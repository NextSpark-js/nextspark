'use client'

import { memo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { TourStep } from '../types/walkme.types'
import { useStepPositioning, getPlacementFromPosition } from '../lib/positioning'
import { WalkmeProgress } from './WalkmeProgress'
import { WalkmeControls } from './WalkmeControls'

interface WalkmeTooltipProps {
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
 * Floating tooltip anchored to a target element.
 * Uses @floating-ui/react for smart positioning.
 */
export const WalkmeTooltip = memo(function WalkmeTooltip({
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
}: WalkmeTooltipProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const { refs, floatingStyles, arrowRef, placement } = useStepPositioning(
    targetElement,
    {
      placement: getPlacementFromPosition(step.position ?? 'auto'),
      offset: 12,
      padding: 8,
    },
  )

  // Focus the tooltip when it appears
  useEffect(() => {
    containerRef.current?.focus()
  }, [step.id])

  if (typeof window === 'undefined') return null

  return createPortal(
    <div
      ref={(el) => {
        refs.setFloating(el)
        ;(containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el
      }}
      data-cy="walkme-tooltip"
      data-walkme
      role="dialog"
      aria-label={step.title}
      aria-describedby={`walkme-tooltip-content-${step.id}`}
      tabIndex={-1}
      className="w-80 max-w-[calc(100vw-2rem)] rounded-lg p-4 shadow-lg outline-none animate-in fade-in-0 zoom-in-95 duration-200"
      style={{
        ...floatingStyles,
        zIndex: 9999,
        backgroundColor: 'var(--walkme-bg, #ffffff)',
        color: 'var(--walkme-text, #111827)',
        border: '1px solid var(--walkme-border, #e5e7eb)',
        boxShadow: 'var(--walkme-shadow, 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1))',
      }}
    >
      {/* Arrow */}
      <div
        ref={arrowRef}
        className="absolute h-2 w-2 rotate-45"
        style={{
          backgroundColor: 'var(--walkme-bg, #ffffff)',
          border: '1px solid var(--walkme-border, #e5e7eb)',
          ...(placement.startsWith('bottom')
            ? { top: -5, borderBottom: 'none', borderRight: 'none' }
            : placement.startsWith('top')
              ? { bottom: -5, borderTop: 'none', borderLeft: 'none' }
              : placement.startsWith('left')
                ? { right: -5, borderLeft: 'none', borderTop: 'none' }
                : { left: -5, borderRight: 'none', borderBottom: 'none' }),
        }}
      />

      {/* Title */}
      <h3 className="mb-1 text-sm font-semibold">{step.title}</h3>

      {/* Content */}
      <p
        id={`walkme-tooltip-content-${step.id}`}
        className="mb-3 text-sm"
        style={{ color: 'var(--walkme-text-muted, #6b7280)' }}
      >
        {step.content}
      </p>

      {/* Progress */}
      <div className="mb-3">
        <WalkmeProgress current={currentIndex} total={totalSteps} progressTemplate={labels?.progress} />
      </div>

      {/* Controls */}
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
  )
})
