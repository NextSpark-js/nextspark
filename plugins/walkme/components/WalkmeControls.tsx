'use client'

import { memo } from 'react'
import type { StepAction } from '../types/walkme.types'

interface WalkmeControlsProps {
  actions: StepAction[]
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
  onComplete: () => void
  isFirst: boolean
  isLast: boolean
  labels?: {
    next?: string
    prev?: string
    skip?: string
    complete?: string
  }
}

/**
 * Navigation button group for tour steps.
 * Premium styling with hover/active states and proper spacing.
 */
export const WalkmeControls = memo(function WalkmeControls({
  actions,
  onNext,
  onPrev,
  onSkip,
  onComplete,
  isFirst,
  isLast,
  labels,
}: WalkmeControlsProps) {
  const showPrev = actions.includes('prev') && !isFirst
  const showNext = actions.includes('next') && !isLast
  const showSkip = actions.includes('skip')
  const showComplete =
    actions.includes('complete') || (isLast && actions.includes('next'))

  return (
    <div
      data-cy="walkme-controls"
      data-walkme
      className="flex items-center justify-between gap-2"
    >
      <div className="flex gap-2">
        {showSkip && (
          <button
            data-cy="walkme-btn-skip"
            onClick={onSkip}
            type="button"
            className="rounded-lg px-3 py-1.5 text-sm transition-all duration-150 hover:opacity-80 active:scale-95"
            style={{
              color: 'var(--walkme-text-muted)',
              backgroundColor: 'transparent',
            }}
          >
            {labels?.skip ?? 'Skip'}
          </button>
        )}
      </div>

      <div className="flex gap-2">
        {showPrev && (
          <button
            data-cy="walkme-btn-prev"
            onClick={onPrev}
            type="button"
            className="rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all duration-150 hover:opacity-90 active:scale-95"
            style={{
              color: 'var(--walkme-text)',
              backgroundColor: 'var(--walkme-border)',
            }}
          >
            {labels?.prev ?? 'Previous'}
          </button>
        )}

        {showNext && (
          <button
            data-cy="walkme-btn-next"
            onClick={onNext}
            type="button"
            className="rounded-lg px-4 py-1.5 text-sm font-semibold text-white transition-all duration-150 hover:brightness-110 active:scale-95"
            style={{
              backgroundColor: 'var(--walkme-primary)',
            }}
          >
            {labels?.next ?? 'Next'}
          </button>
        )}

        {showComplete && (
          <button
            data-cy="walkme-btn-complete"
            onClick={onComplete}
            type="button"
            className="rounded-lg px-4 py-1.5 text-sm font-semibold text-white transition-all duration-150 hover:brightness-110 active:scale-95"
            style={{
              backgroundColor: 'var(--walkme-primary)',
            }}
          >
            {labels?.complete ?? 'Complete'}
          </button>
        )}
      </div>
    </div>
  )
})
