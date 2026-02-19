'use client'

import { memo, useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'

interface WalkmeOverlayProps {
  visible: boolean
  onClick?: () => void
  spotlightTarget?: HTMLElement | null
  spotlightPadding?: number
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
}: WalkmeOverlayProps) {
  const [clipPath, setClipPath] = useState<string | undefined>(undefined)

  const recalculate = useCallback(() => {
    if (!spotlightTarget) {
      setClipPath(undefined)
      return
    }
    setClipPath(getSpotlightClipPath(spotlightTarget, spotlightPadding))
  }, [spotlightTarget, spotlightPadding])

  // Recalculate on mount and when target changes
  useEffect(() => {
    recalculate()
  }, [recalculate])

  // Track target position on scroll/resize (any scrollable container)
  useEffect(() => {
    if (!spotlightTarget) return

    // Recalculate after a short delay to let any scrollIntoView settle
    const initialTimer = setTimeout(recalculate, 100)

    const handler = () => recalculate()
    window.addEventListener('scroll', handler, true) // capture phase for nested scroll containers
    window.addEventListener('resize', handler)

    return () => {
      clearTimeout(initialTimer)
      window.removeEventListener('scroll', handler, true)
      window.removeEventListener('resize', handler)
    }
  }, [spotlightTarget, recalculate])

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

/** Generate a clip-path that cuts out a rectangle around the target element */
function getSpotlightClipPath(
  target: HTMLElement,
  padding: number,
): string {
  const rect = target.getBoundingClientRect()
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
