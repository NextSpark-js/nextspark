/**
 * WalkMe Targeting Module
 *
 * DOM element targeting utilities for finding, waiting for,
 * and interacting with target elements for tour steps.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TargetResult {
  element: HTMLElement | null
  found: boolean
  selector: string
  method: 'css' | 'data-walkme' | 'data-cy'
}

export interface WaitForTargetOptions {
  /** Maximum time to wait in ms (default: 5000) */
  timeout?: number
  /** Polling interval in ms (default: 200) */
  interval?: number
}

// ---------------------------------------------------------------------------
// Element Finding
// ---------------------------------------------------------------------------

/**
 * Find a target element using various selector strategies.
 *
 * Supports:
 * 1. CSS selectors: `#id`, `.class`, `[attribute="value"]`
 * 2. Data-walkme attribute shorthand: if selector has no CSS special chars,
 *    tries `[data-walkme-target="selector"]` first
 * 3. Data-cy attribute: `[data-cy="value"]`
 */
export function findTarget(selector: string): TargetResult {
  if (typeof window === 'undefined') {
    return { element: null, found: false, selector, method: 'css' }
  }

  // Try data-walkme-target first if selector looks like a plain name
  if (/^[a-zA-Z0-9_-]+$/.test(selector)) {
    const walkmeEl = document.querySelector<HTMLElement>(
      `[data-walkme-target="${selector}"]`,
    )
    if (walkmeEl) {
      return { element: walkmeEl, found: true, selector, method: 'data-walkme' }
    }
  }

  // Try as CSS selector
  try {
    const el = document.querySelector<HTMLElement>(selector)
    if (el) {
      const method = selector.includes('data-cy') ? 'data-cy' : 'css'
      return { element: el, found: true, selector, method }
    }
  } catch {
    // Invalid selector - return not found
  }

  return { element: null, found: false, selector, method: 'css' }
}

/**
 * Wait for a target element to appear in the DOM.
 * Uses MutationObserver for efficient watching.
 */
export function waitForTarget(
  selector: string,
  options: WaitForTargetOptions = {},
): Promise<TargetResult> {
  const { timeout = 5000, interval = 200 } = options

  return new Promise((resolve) => {
    // Try immediately first
    const immediate = findTarget(selector)
    if (immediate.found) {
      resolve(immediate)
      return
    }

    if (typeof window === 'undefined') {
      resolve({ element: null, found: false, selector, method: 'css' })
      return
    }

    let resolved = false
    let observer: MutationObserver | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let intervalId: ReturnType<typeof setInterval> | null = null

    const cleanup = () => {
      resolved = true
      observer?.disconnect()
      if (timeoutId) clearTimeout(timeoutId)
      if (intervalId) clearInterval(intervalId)
    }

    // Set up timeout
    timeoutId = setTimeout(() => {
      if (!resolved) {
        cleanup()
        resolve({ element: null, found: false, selector, method: 'css' })
      }
    }, timeout)

    // Poll as a fallback (MutationObserver doesn't catch everything)
    intervalId = setInterval(() => {
      if (resolved) return
      const result = findTarget(selector)
      if (result.found) {
        cleanup()
        resolve(result)
      }
    }, interval)

    // MutationObserver for immediate detection
    observer = new MutationObserver(() => {
      if (resolved) return
      const result = findTarget(selector)
      if (result.found) {
        cleanup()
        resolve(result)
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-walkme-target', 'data-cy', 'id', 'class'],
    })
  })
}

// ---------------------------------------------------------------------------
// Element Utilities
// ---------------------------------------------------------------------------

/** Check if an element is visible (not hidden by CSS) */
export function isElementVisible(element: HTMLElement): boolean {
  if (typeof window === 'undefined') return false

  const style = window.getComputedStyle(element)
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    element.offsetParent !== null
  )
}

/** Check if an element is within the current viewport */
export function isElementInViewport(element: HTMLElement): boolean {
  if (typeof window === 'undefined') return false

  const rect = element.getBoundingClientRect()
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= window.innerHeight &&
    rect.right <= window.innerWidth
  )
}

/** Scroll the viewport to make an element visible */
export function scrollToElement(
  element: HTMLElement,
  options: { behavior?: ScrollBehavior; block?: ScrollLogicalPosition } = {},
): void {
  if (typeof window === 'undefined') return

  element.scrollIntoView({
    behavior: options.behavior ?? 'smooth',
    block: options.block ?? 'center',
  })
}

/** Get the bounding rect of an element */
export function getElementRect(element: HTMLElement): DOMRect {
  return element.getBoundingClientRect()
}
