import { useEffect, useCallback, type RefObject } from 'react'
import { getInjectionScript } from '@/lib/block-selector-injection'

interface BlockSelectedMessage {
  type: 'nextspark:block-selected'
  blockSlug: string
  blockIndex: number
}

interface DashboardSelectedMessage {
  type: 'nextspark:dashboard-selected'
  zone: string
  entitySlug: string | null
  label: string
}

function isBlockSelectedMessage(data: unknown): data is BlockSelectedMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as Record<string, unknown>).type === 'nextspark:block-selected' &&
    typeof (data as Record<string, unknown>).blockSlug === 'string' &&
    typeof (data as Record<string, unknown>).blockIndex === 'number'
  )
}

function isDashboardSelectedMessage(data: unknown): data is DashboardSelectedMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as Record<string, unknown>).type === 'nextspark:dashboard-selected' &&
    typeof (data as Record<string, unknown>).zone === 'string'
  )
}

/**
 * Manages block-selector injection into the preview iframe.
 *
 * When `enabled` is true, injects hover/click highlight script into the
 * iframe and listens for postMessage events to relay block selection back.
 */
export function useBlockSelector(
  iframeRef: RefObject<HTMLIFrameElement | null>,
  enabled: boolean,
  onBlockSelected: (blockSlug: string, blockIndex: number) => void,
  onDashboardSelected?: (zone: string, entitySlug: string | null, label: string) => void,
) {
  // Inject or cleanup script when enabled changes or iframe reloads
  const inject = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    try {
      const doc = iframe.contentDocument
      if (!doc) return

      // Already injected
      if ((iframe.contentWindow as unknown as Record<string, unknown>)?.__nsBlockSelectorActive) return

      const script = doc.createElement('script')
      script.id = '__ns-block-selector-script'
      script.textContent = getInjectionScript()
      doc.head.appendChild(script)
    } catch {
      // Cross-origin or not-ready — silently ignore
    }
  }, [iframeRef])

  const cleanup = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    try {
      const win = iframe.contentWindow as unknown as Record<string, unknown> | null
      if (win && typeof win.__nsBlockSelectorCleanup === 'function') {
        ;(win.__nsBlockSelectorCleanup as () => void)()
      }
    } catch {
      // Cross-origin or already gone
    }
  }, [iframeRef])

  // Handle enable/disable + iframe load events
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    if (!enabled) {
      cleanup()
      return
    }

    // Inject now (iframe may already be loaded)
    inject()

    // Re-inject after each iframe navigation/reload
    const onLoad = () => {
      // Small delay so the iframe DOM is ready
      setTimeout(inject, 100)
    }

    iframe.addEventListener('load', onLoad)
    return () => {
      iframe.removeEventListener('load', onLoad)
      cleanup()
    }
  }, [enabled, iframeRef, inject, cleanup])

  // Listen for postMessage from iframe
  useEffect(() => {
    if (!enabled) return

    const onMessage = (e: MessageEvent) => {
      if (isBlockSelectedMessage(e.data)) {
        onBlockSelected(e.data.blockSlug, e.data.blockIndex)
      } else if (isDashboardSelectedMessage(e.data) && onDashboardSelected) {
        onDashboardSelected(e.data.zone, e.data.entitySlug, e.data.label)
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [enabled, onBlockSelected, onDashboardSelected])
}
