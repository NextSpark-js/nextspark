'use client'

import { memo } from 'react'
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
 */
export const WalkmeOverlay = memo(function WalkmeOverlay({
  visible,
  onClick,
  spotlightTarget,
  spotlightPadding = 8,
}: WalkmeOverlayProps) {
  if (typeof window === 'undefined') return null
  if (!visible) return null

  const clipPath = spotlightTarget
    ? getSpotlightClipPath(spotlightTarget, spotlightPadding)
    : undefined

  return createPortal(
    <div
      data-cy="walkme-overlay"
      data-walkme
      onClick={onClick}
      className="fixed inset-0 transition-opacity duration-300 ease-in-out"
      style={{
        zIndex: 9998,
        backgroundColor: 'var(--walkme-overlay-bg, rgba(0, 0, 0, 0.5))',
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
  const bottom = rect.bottom + padding
  const right = rect.right + padding

  // polygon that covers everything EXCEPT the target area
  return `polygon(
    0% 0%, 0% 100%,
    ${left}px 100%, ${left}px ${top}px,
    ${right}px ${top}px, ${right}px ${bottom}px,
    ${left}px ${bottom}px, ${left}px 100%,
    100% 100%, 100% 0%
  )`
}
