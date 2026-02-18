'use client'

import { memo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { TourStep } from '../types/walkme.types'
import { useStepPositioning, getPlacementFromPosition } from '../lib/positioning'
import { WalkmeOverlay } from './WalkmeOverlay'
import { WalkmeProgress } from './WalkmeProgress'
import { WalkmeControls } from './WalkmeControls'

interface WalkmeSpotlightProps {
  step: TourStep
  targetElement: HTMLElement | null
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
  onComplete: () => void
  isFirst: boolean
  isLast: boolean
  currentIndex: number
  totalSteps: number
  labels?: {
    next?: string
    prev?: string
    skip?: string
    complete?: string
    progress?: string
  }
}

/**
 * Spotlight/highlight that illuminates a specific element
 * with an overlay cutout and a tooltip explanation.
 */
export const WalkmeSpotlight = memo(function WalkmeSpotlight({
  step,
  targetElement,
  onNext,
  onPrev,
  onSkip,
  onComplete,
  isFirst,
  isLast,
  currentIndex,
  totalSteps,
  labels,
}: WalkmeSpotlightProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const { refs, floatingStyles } = useStepPositioning(targetElement, {
    placement: getPlacementFromPosition(step.position ?? 'bottom'),
    offset: 16,
    padding: 8,
  })

  useEffect(() => {
    containerRef.current?.focus()
  }, [step.id])

  if (typeof window === 'undefined') return null

  return (
    <>
      {/* Overlay with cutout around target */}
      <WalkmeOverlay
        visible
        spotlightTarget={targetElement}
        spotlightPadding={8}
      />

      {/* Tooltip near the target */}
      {createPortal(
        <div
          ref={(el) => {
            refs.setFloating(el)
            ;(containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el
          }}
          data-cy="walkme-spotlight"
          data-walkme
          role="dialog"
          aria-label={step.title}
          aria-describedby={`walkme-spotlight-content-${step.id}`}
          tabIndex={-1}
          className="w-80 max-w-[calc(100vw-2rem)] rounded-lg p-4 shadow-lg outline-none animate-in fade-in-0 zoom-in-95 duration-200"
          style={{
            ...floatingStyles,
            zIndex: 9999,
            backgroundColor: 'var(--walkme-bg, #ffffff)',
            color: 'var(--walkme-text, #111827)',
            border: '1px solid var(--walkme-border, #e5e7eb)',
            boxShadow: 'var(--walkme-shadow, 0 4px 6px -1px rgba(0, 0, 0, 0.1))',
          }}
        >
          <h3 className="mb-1 text-sm font-semibold">{step.title}</h3>

          <p
            id={`walkme-spotlight-content-${step.id}`}
            className="mb-3 text-sm"
            style={{ color: 'var(--walkme-text-muted, #6b7280)' }}
          >
            {step.content}
          </p>

          <div className="mb-3">
            <WalkmeProgress current={currentIndex} total={totalSteps} progressTemplate={labels?.progress} />
          </div>

          <WalkmeControls
            actions={step.actions}
            onNext={onNext}
            onPrev={onPrev}
            onSkip={onSkip}
            onComplete={onComplete}
            isFirst={isFirst}
            isLast={isLast}
            labels={labels}
          />
        </div>,
        document.body,
      )}
    </>
  )
})
