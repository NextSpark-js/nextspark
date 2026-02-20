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
 * Theme-aware with CSS variables for premium dark/light mode.
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

  const { refs, floatingStyles, arrowRef, placement, isStable } = useStepPositioning(
    targetElement,
    {
      placement: getPlacementFromPosition(step.position ?? 'auto'),
      offset: 12,
      padding: 8,
    },
  )

  // Focus the tooltip when positioning has stabilized
  useEffect(() => {
    if (isStable) containerRef.current?.focus()
  }, [isStable])

  if (typeof window === 'undefined') return null
  if (!targetElement) return null

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
      className="w-80 max-w-[calc(100vw-2rem)] rounded-xl p-4 outline-none"
      style={{
        ...floatingStyles,
        zIndex: 9999,
        backgroundColor: 'var(--walkme-bg, #ffffff)',
        color: 'var(--walkme-text, #111827)',
        border: '1px solid var(--walkme-border, #e5e7eb)',
        boxShadow: 'var(--walkme-shadow, 0 20px 25px -5px rgba(0,0,0,.1), 0 8px 10px -6px rgba(0,0,0,.1))',
        // Hide until floating-ui has stabilized after scroll
        opacity: isStable ? 1 : 0,
        transition: 'opacity 150ms ease-out',
      }}
    >
      {/* Arrow */}
      <div
        ref={arrowRef}
        className="absolute h-2 w-2 rotate-45"
        style={{
          backgroundColor: 'var(--walkme-bg, #ffffff)',
          ...getArrowBorders(placement),
        }}
      />

      {/* Title */}
      <h3 className="mb-1 text-sm font-semibold tracking-tight">{step.title}</h3>

      {/* Content */}
      <p
        id={`walkme-tooltip-content-${step.id}`}
        className="mb-3 text-sm leading-relaxed"
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

/** Build individual border-* styles to avoid mixing shorthand + individual properties */
function getArrowBorders(placement: string): React.CSSProperties {
  const b = '1px solid var(--walkme-border, #e5e7eb)'
  if (placement.startsWith('bottom')) {
    // Arrow points up — show top + left borders
    return { top: -5, borderTop: b, borderLeft: b, borderBottom: 'none', borderRight: 'none' }
  }
  if (placement.startsWith('top')) {
    // Arrow points down — show bottom + right borders
    return { bottom: -5, borderBottom: b, borderRight: b, borderTop: 'none', borderLeft: 'none' }
  }
  if (placement.startsWith('left')) {
    // Arrow points right — show right + bottom borders
    return { right: -5, borderRight: b, borderBottom: b, borderTop: 'none', borderLeft: 'none' }
  }
  // Arrow points left — show top + left borders
  return { left: -5, borderTop: b, borderLeft: b, borderBottom: 'none', borderRight: 'none' }
}
