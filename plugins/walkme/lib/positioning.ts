/**
 * WalkMe Positioning Module
 *
 * Wrapper around @floating-ui/react for smart element positioning.
 * Handles auto-flip, scroll tracking, viewport containment, and arrow placement.
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  arrow,
  type Placement,
} from '@floating-ui/react'
import type { StepPosition } from '../types/walkme.types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PositionConfig {
  placement: Placement
  offset?: number
  padding?: number
  fallbackPlacements?: Placement[]
}

export interface StepPositioningResult {
  refs: {
    setReference: (el: HTMLElement | null) => void
    setFloating: (el: HTMLElement | null) => void
  }
  floatingStyles: React.CSSProperties
  placement: Placement
  isPositioned: boolean
  arrowRef: React.RefObject<HTMLDivElement | null>
  middlewareData: Record<string, unknown>
  /** Force a position recalculation (useful after scroll/resize settles) */
  update: () => void
  /** Whether floating-ui has had time to stabilize after scroll */
  isStable: boolean
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Map StepPosition to @floating-ui Placement */
export function getPlacementFromPosition(position: StepPosition): Placement {
  switch (position) {
    case 'top':
      return 'top'
    case 'bottom':
      return 'bottom'
    case 'left':
      return 'left'
    case 'right':
      return 'right'
    case 'auto':
    default:
      return 'bottom'
  }
}

/** Get current viewport information */
export function getViewportInfo(): {
  width: number
  height: number
  scrollX: number
  scrollY: number
} {
  if (typeof window === 'undefined') {
    return { width: 0, height: 0, scrollX: 0, scrollY: 0 }
  }
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Hook for positioning a floating step element relative to a target.
 * Wraps @floating-ui/react with sensible defaults for WalkMe steps.
 *
 * IMPORTANT: Does NOT pass targetElement directly to useFloating's
 * `elements.reference`. Instead, sets the reference imperatively after
 * a short delay so that any scrollIntoView triggered by the provider
 * has fully settled. This prevents stale position computation on
 * backward navigation.
 */
export function useStepPositioning(
  targetElement: HTMLElement | null,
  config: PositionConfig,
): StepPositioningResult {
  const arrowRef = useRef<HTMLDivElement>(null)
  const [isStable, setIsStable] = useState(false)

  const { refs, floatingStyles, placement, isPositioned, middlewareData, update } =
    useFloating({
      placement: config.placement,
      // DO NOT set elements.reference here — we set it imperatively below
      // so floating-ui computes position AFTER scroll has settled.
      whileElementsMounted: autoUpdate,
      middleware: [
        offset(config.offset ?? 8),
        flip({
          fallbackPlacements: config.fallbackPlacements,
          padding: config.padding ?? 8,
        }),
        shift({ padding: config.padding ?? 8 }),
        arrow({ element: arrowRef }),
      ],
    })

  // Set reference imperatively after scroll settles
  useEffect(() => {
    setIsStable(false)

    if (!targetElement) {
      refs.setReference(null)
      return
    }

    // Double rAF ensures any scrollIntoView (even 'instant') has
    // fully reflowed the layout before we hand the element to floating-ui.
    let cancelled = false
    const rafOuter = requestAnimationFrame(() => {
      const rafInner = requestAnimationFrame(() => {
        if (cancelled) return
        refs.setReference(targetElement)
        // One more rAF for floating-ui to compute, then mark stable
        requestAnimationFrame(() => {
          if (!cancelled) setIsStable(true)
        })
      })
      // Store inner for cleanup (best-effort)
      innerRafRef.current = rafInner
    })
    const innerRafRef = { current: 0 }

    return () => {
      cancelled = true
      cancelAnimationFrame(rafOuter)
      cancelAnimationFrame(innerRafRef.current)
    }
  }, [targetElement, refs])

  return {
    refs: {
      setReference: refs.setReference,
      setFloating: refs.setFloating,
    },
    floatingStyles,
    placement,
    isPositioned,
    arrowRef,
    middlewareData,
    update,
    isStable,
  }
}
