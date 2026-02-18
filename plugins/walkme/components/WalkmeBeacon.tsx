'use client'

import { memo } from 'react'
import { createPortal } from 'react-dom'
import type { TourStep } from '../types/walkme.types'
import { useStepPositioning } from '../lib/positioning'

interface WalkmeBeaconProps {
  step: TourStep
  targetElement: HTMLElement | null
  onClick: () => void
  labels?: {
    tourAvailable?: string
  }
}

/**
 * Pulsing beacon/hotspot indicator near a target element.
 * Clicking it starts or advances the tour.
 */
export const WalkmeBeacon = memo(function WalkmeBeacon({
  step,
  targetElement,
  onClick,
  labels,
}: WalkmeBeaconProps) {
  const { refs, floatingStyles } = useStepPositioning(targetElement, {
    placement: 'top-end',
    offset: 4,
    padding: 8,
  })

  if (typeof window === 'undefined') return null

  return createPortal(
    <button
      ref={refs.setFloating}
      data-cy="walkme-beacon"
      data-walkme
      onClick={onClick}
      type="button"
      role="button"
      aria-label={step.title || labels?.tourAvailable || 'Tour available'}
      tabIndex={0}
      className="relative flex h-6 w-6 items-center justify-center rounded-full outline-none"
      style={{
        ...floatingStyles,
        zIndex: 9999,
      }}
    >
      {/* Pulse ring */}
      <span
        className="absolute inset-0 animate-ping rounded-full opacity-75"
        style={{ backgroundColor: 'var(--walkme-beacon-color, #3b82f6)' }}
      />
      {/* Core dot */}
      <span
        className="relative h-3 w-3 rounded-full"
        style={{ backgroundColor: 'var(--walkme-beacon-color, #3b82f6)' }}
      />
    </button>,
    document.body,
  )
})
