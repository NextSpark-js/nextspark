'use client'

import { memo, useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'

interface WalkmeOverlayProps {
  visible: boolean
  onClick?: () => void
  spotlightTarget?: HTMLElement | null
  spotlightPadding?: number
  /** Pre-computed target rect — when provided, skip internal scroll/resize tracking */
  spotlightRect?: DOMRect | null
}

/**
 * Full-screen dark backdrop overlay.
 * Supports an optional spotlight cutout to highlight a target element.
 * Dynamically tracks target position on scroll/resize.
 */
export const WalkmeOverlay = memo(function WalkmeOverlay({
  visible,
  onClick,
  spotlightTarget,
  spotlightPadding = 8,
  spotlightRect: externalRect,
}: WalkmeOverlayProps) {
  const [internalClipPath, setInternalClipPath] = useState<string | undefined>(undefined)

  // When parent provides a pre-computed rect, derive clip-path from it directly
  const externalClipPath = externalRect
    ? getSpotlightClipPathFromRect(externalRect, spotlightPadding)
    : undefined

  const recalculate = useCallback(() => {
    if (!spotlightTarget) {
      setInternalClipPath(undefined)
      return
    }
    setInternalClipPath(getSpotlightClipPathFromRect(spotlightTarget.getBoundingClientRect(), spotlightPadding))
  }, [spotlightTarget, spotlightPadding])

  // Self-tracking mode: only active when no external rect is provided
  useEffect(() => {
    if (externalRect !== undefined) return
    recalculate()
  }, [recalculate, externalRect])

  useEffect(() => {
    if (externalRect !== undefined) return // skip self-tracking when parent provides rect
    if (!spotlightTarget) return

    const initialTimer = setTimeout(recalculate, 100)

    const handler = () => recalculate()
    window.addEventListener('scroll', handler, true)
    window.addEventListener('resize', handler)

    return () => {
      clearTimeout(initialTimer)
      window.removeEventListener('scroll', handler, true)
      window.removeEventListener('resize', handler)
    }
  }, [spotlightTarget, recalculate, externalRect])

  const clipPath = externalRect !== undefined ? externalClipPath : internalClipPath

  if (typeof window === 'undefined') return null
  if (!visible) return null

  return createPortal(
    <div
      data-cy="walkme-overlay"
      data-walkme
      onClick={onClick}
      className="fixed inset-0 transition-opacity duration-300 ease-in-out"
      style={{
        zIndex: 9998,
        backgroundColor: 'var(--walkme-overlay-bg, rgba(0, 0, 0, 0.65))',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        clipPath,
      }}
      aria-hidden="true"
    />,
    document.body,
  )
})

/** Generate a clip-path that cuts out a rectangle from a DOMRect */
function getSpotlightClipPathFromRect(
  rect: DOMRect,
  padding: number,
): string {
  const top = Math.max(0, rect.top - padding)
  const left = Math.max(0, rect.left - padding)
  const bottom = Math.min(window.innerHeight, rect.bottom + padding)
  const right = Math.min(window.innerWidth, rect.right + padding)

  // polygon that covers everything EXCEPT the target area
  return `polygon(
    0% 0%, 0% 100%,
    ${left}px 100%, ${left}px ${top}px,
    ${right}px ${top}px, ${right}px ${bottom}px,
    ${left}px ${bottom}px, ${left}px 100%,
    100% 100%, 100% 0%
  )`
}
