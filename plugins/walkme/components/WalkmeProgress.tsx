'use client'

import { memo } from 'react'

interface WalkmeProgressProps {
  current: number
  total: number
  /** Template string for progress label, e.g. "Step {current} of {total}" */
  progressTemplate?: string
}

/**
 * Progress bar indicator showing current step within a tour.
 * Uses theme-aware CSS variables with smooth transitions.
 */
export const WalkmeProgress = memo(function WalkmeProgress({
  current,
  total,
  progressTemplate,
}: WalkmeProgressProps) {
  const percentage = total > 0 ? Math.round(((current + 1) / total) * 100) : 0
  const progressLabel = (progressTemplate ?? 'Step {current} of {total}')
    .replace('{current}', String(current + 1))
    .replace('{total}', String(total))

  return (
    <div data-cy="walkme-progress" data-walkme className="flex items-center gap-3">
      <div
        className="h-1 flex-1 overflow-hidden rounded-full"
        style={{ backgroundColor: 'var(--walkme-border)' }}
        role="progressbar"
        aria-valuenow={current + 1}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label={progressLabel}
      >
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${percentage}%`,
            backgroundColor: 'var(--walkme-primary)',
          }}
        />
      </div>
      <span
        className="text-xs tabular-nums whitespace-nowrap"
        style={{ color: 'var(--walkme-text-muted)' }}
      >
        {current + 1} / {total}
      </span>
    </div>
  )
})
