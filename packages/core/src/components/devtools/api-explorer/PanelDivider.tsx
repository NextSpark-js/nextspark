'use client'

import { useCallback, useEffect, useRef } from 'react'
import { cn } from '../../../lib/utils'
import { sel } from '../../../lib/test'

interface PanelDividerProps {
  /** Current split, as the percentage of the container the LEFT panel takes. */
  value: number
  onChange: (percent: number) => void
  /** The element the percentage is measured against. */
  containerRef: React.RefObject<HTMLElement | null>
  min?: number
  max?: number
  label?: string
}

/**
 * Drag handle between two horizontally-split panels.
 *
 * Hand-rolled rather than pulled from a panel library: it needs one number, and a devtools
 * screen is not worth a dependency in every app the framework ships.
 *
 * It reports a PERCENTAGE, not pixels, so a split chosen on a wide monitor still looks
 * deliberate on a laptop. Pointer capture means a fast drag that outruns the cursor keeps
 * working instead of being dropped the moment the pointer leaves the 6px strip.
 *
 * It is also a real `separator` widget: focusable, moved with the arrow keys, and it reports
 * its position — dragging cannot be the only way to reach a layout.
 */
export function PanelDivider({
  value,
  onChange,
  containerRef,
  min = 25,
  max = 75,
  label = 'Resize panels',
}: PanelDividerProps) {
  const draggingRef = useRef(false)

  const clamp = useCallback((percent: number) => Math.min(max, Math.max(min, percent)), [min, max])

  const percentFromClientX = useCallback(
    (clientX: number) => {
      const container = containerRef.current
      if (!container) return null
      const rect = container.getBoundingClientRect()
      if (rect.width === 0) return null
      return clamp(((clientX - rect.left) / rect.width) * 100)
    },
    [containerRef, clamp]
  )

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    // Text elsewhere on the page would otherwise be selected while dragging over it.
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
  }, [])

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return
      const next = percentFromClientX(event.clientX)
      if (next !== null) onChange(next)
    },
    [percentFromClientX, onChange]
  )

  const endDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
  }, [])

  // A drag interrupted by an unmount must not leave the page unselectable.
  useEffect(
    () => () => {
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    },
    []
  )

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const step = event.shiftKey ? 10 : 2
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        onChange(clamp(value - step))
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        onChange(clamp(value + step))
      } else if (event.key === 'Home') {
        event.preventDefault()
        onChange(min)
      } else if (event.key === 'End') {
        event.preventDefault()
        onChange(max)
      }
    },
    [value, onChange, clamp, min, max]
  )

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
      className={cn(
        'hidden lg:flex shrink-0 w-1.5 cursor-col-resize items-center justify-center',
        'bg-border/40 hover:bg-primary/60 focus-visible:bg-primary/60 transition-colors',
        'focus-visible:outline-none'
      )}
      data-cy={sel('devtools.apiExplorer.panelDivider')}
    >
      {/* A grip that stays visible against either panel's background. */}
      <div className="h-8 w-0.5 rounded-full bg-foreground/25" />
    </div>
  )
}
