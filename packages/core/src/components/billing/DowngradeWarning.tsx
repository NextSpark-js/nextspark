'use client'

import { useTranslations } from 'next-intl'
import { AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '../ui/alert'
import { Button } from '../ui/button'

interface DowngradeWarningProps {
  overLimitResources: Array<{
    limitSlug: string
    currentCount: number
    newLimit: number
  }>
  onConfirm: () => void
  onCancel: () => void
}

/**
 * DowngradeWarning - Display warning when downgrading with resources over new limits
 *
 * Shows which resources exceed the new plan limits and the enforcement policy.
 * Used in upgrade/downgrade flows to inform users of potential restrictions.
 *
 * @example
 * ```tsx
 * <DowngradeWarning
 *   overLimitResources={[
 *     { limitSlug: 'projects', currentCount: 50, newLimit: 5 },
 *     { limitSlug: 'team_members', currentCount: 10, newLimit: 1 }
 *   ]}
 *   onConfirm={() => handleDowngrade()}
 *   onCancel={() => closeModal()}
 * />
 * ```
 */
export function DowngradeWarning({
  overLimitResources,
  onConfirm,
  onCancel,
}: DowngradeWarningProps) {
  const t = useTranslations('billing.downgrade')

  if (overLimitResources.length === 0) {
    return null
  }

  return (
    <Alert variant="destructive" className="mb-4" data-cy="downgrade-warning">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle data-cy="downgrade-warning-title">{t('title')}</AlertTitle>
      <AlertDescription>
        <p className="mb-2" data-cy="downgrade-warning-description">
          {t('description')}
        </p>
        <ul
          className="list-disc list-inside space-y-1 mb-3"
          data-cy="downgrade-warning-list"
        >
          {overLimitResources.map((resource) => (
            <li key={resource.limitSlug} data-cy={`downgrade-limit-${resource.limitSlug}`}>
              {t('resource_over', {
                resource: resource.limitSlug,
                current: resource.currentCount,
                limit: resource.newLimit,
              })}
            </li>
          ))}
        </ul>
        <p
          className="mt-2 text-sm text-muted-foreground"
          data-cy="downgrade-warning-policy"
        >
          {t('policy')}
        </p>

        {/* Action buttons */}
        <div className="flex gap-2 mt-4">
          <Button
            variant="destructive"
            onClick={onConfirm}
            data-cy="downgrade-warning-confirm"
          >
            {t('confirm')}
          </Button>
          <Button variant="outline" onClick={onCancel} data-cy="downgrade-warning-cancel">
            {t('cancel')}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}
