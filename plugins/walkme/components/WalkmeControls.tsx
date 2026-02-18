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
 * Renders only the actions specified in the step configuration.
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
            className="rounded px-3 py-1.5 text-sm transition-colors"
            style={{
              color: 'var(--walkme-text-muted, #6b7280)',
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
            className="rounded px-3 py-1.5 text-sm transition-colors"
            style={{
              color: 'var(--walkme-text, #111827)',
              backgroundColor: 'var(--walkme-border, #e5e7eb)',
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
            className="rounded px-3 py-1.5 text-sm font-medium text-white transition-colors"
            style={{
              backgroundColor: 'var(--walkme-primary, #3b82f6)',
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
            className="rounded px-3 py-1.5 text-sm font-medium text-white transition-colors"
            style={{
              backgroundColor: 'var(--walkme-primary, #3b82f6)',
            }}
          >
            {labels?.complete ?? 'Complete'}
          </button>
        )}
      </div>
    </div>
  )
})
