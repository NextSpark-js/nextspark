'use client'

import { useQuota } from '../../hooks/useQuota'
import { useTranslations } from 'next-intl'
import { cn } from '../../lib/utils'
import { Skeleton } from '../ui/skeleton'

interface UsageBarProps {
  limitSlug: string
  showLabel?: boolean
  className?: string
}

/**
 * UsageBar - Visual progress bar for quota usage
 *
 * @example
 * ```tsx
 * <UsageBar limitSlug="projects" showLabel />
 * ```
 */
export function UsageBar({ limitSlug, showLabel = true, className }: UsageBarProps) {
  const quota = useQuota(limitSlug)
  const t = useTranslations('billing.usage')

  if (quota.isLoading) {
    return (
      <div className={cn('space-y-1', className)} data-cy="usage-bar-loading">
        <Skeleton className="h-4 w-full" />
        {showLabel && <Skeleton className="h-3 w-24" />}
      </div>
    )
  }

  if (!quota || quota.max === undefined) {
    return null
  }

  const current = quota.current ?? 0
  const max = quota.max
  const isUnlimited = max === -1

  // Calculate percentage (0-100)
  const percentUsed = isUnlimited ? 0 : Math.min(Math.round((current / max) * 100), 100)

  // Color coding: green (0-74%), yellow (75-89%), red (90-100%)
  const colorVariant =
    percentUsed >= 90 ? 'destructive' :
    percentUsed >= 75 ? 'warning' :
    'default'

  return (
    <div className={cn('space-y-1', className)} data-cy={`usage-bar-${limitSlug}`}>
      {showLabel && (
        <div className="flex justify-between text-sm text-muted-foreground" data-cy="usage-bar-label">
          <span>
            {isUnlimited
              ? t('unlimited')
              : t('usedOf', { current, max })
            }
          </span>
          {!isUnlimited && (
            <span data-cy="usage-bar-percent">{t('percentUsed', { percent: percentUsed })}</span>
          )}
        </div>
      )}
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary" data-cy="usage-bar-progress">
        <div
          className={cn(
            "h-full transition-all",
            colorVariant === 'destructive' && 'bg-destructive',
            colorVariant === 'warning' && 'bg-yellow-500',
            colorVariant === 'default' && 'bg-primary'
          )}
          style={{ width: `${percentUsed}%` }}
        />
      </div>
    </div>
  )
}
