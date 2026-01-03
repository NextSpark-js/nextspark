'use client'

import { BILLING_REGISTRY } from '@nextsparkjs/registries/billing-registry'
import { UsageBar } from './UsageBar'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { useTranslations } from 'next-intl'
import { cn } from '../../lib/utils'

interface UsageDashboardProps {
  className?: string
}

/**
 * UsageDashboard - Overview of all usage limits with visual bars
 *
 * @example
 * ```tsx
 * <UsageDashboard />
 * ```
 */
export function UsageDashboard({ className }: UsageDashboardProps) {
  const t = useTranslations('billing')

  const limits = Object.entries(BILLING_REGISTRY.limits)

  return (
    <Card className={className} data-cy="usage-dashboard">
      <CardHeader>
        <CardTitle>{t('usage.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6" data-cy="usage-dashboard-limits">
        {limits.map(([slug, limit]) => (
          <div key={slug} className="space-y-2" data-cy={`usage-dashboard-limit-${slug}`}>
            <h4 className="text-sm font-medium">{t(`limits.${slug}`)}</h4>
            <UsageBar limitSlug={slug} showLabel />
          </div>
        ))}

        {limits.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            {t('usage.noLimits') || 'No usage limits configured'}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
