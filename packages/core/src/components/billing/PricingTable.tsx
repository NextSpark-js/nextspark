'use client'

import { BILLING_REGISTRY } from '@nextsparkjs/registries/billing-registry'
import { useSubscription } from '../../hooks/useSubscription'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Check, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '../../lib/utils'

interface PricingTableProps {
  onSelectPlan?: (planSlug: string) => void
  className?: string
}

/**
 * PricingTable - Plan comparison table with features and limits
 *
 * @example
 * ```tsx
 * <PricingTable onSelectPlan={(slug) => handleUpgrade(slug)} />
 * ```
 */
export function PricingTable({ onSelectPlan, className }: PricingTableProps) {
  const t = useTranslations('billing')
  const { planSlug: currentPlanSlug } = useSubscription()

  // Filter plans to show only public ones (hide 'hidden' and 'invite_only')
  const visiblePlans = BILLING_REGISTRY.plans.filter(
    p => p.visibility === 'public' || p.visibility === undefined
  )

  return (
    <div
      className={cn('grid gap-6 md:grid-cols-2 lg:grid-cols-3', className)}
      data-cy="pricing-table"
    >
      {visiblePlans.map((plan) => {
        const isCurrentPlan = plan.slug === currentPlanSlug
        const priceMonthly = plan.price?.monthly ? plan.price.monthly / 100 : 0

        return (
          <Card
            key={plan.slug}
            className={cn(
              'relative flex flex-col',
              isCurrentPlan && 'border-primary border-2'
            )}
            data-cy={`pricing-plan-${plan.slug}`}
          >
            {isCurrentPlan && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge variant="default" data-cy="pricing-current-badge">
                  {t('currentPlan')}
                </Badge>
              </div>
            )}

            <CardHeader>
              <CardTitle className="text-2xl" data-cy="pricing-plan-name">
                {t(`plans.${plan.slug}.name`)}
              </CardTitle>
              <CardDescription data-cy="pricing-plan-description">
                {t(`plans.${plan.slug}.description`)}
              </CardDescription>
              <div className="mt-4" data-cy="pricing-plan-price">
                {priceMonthly > 0 ? (
                  <>
                    <span className="text-4xl font-bold">
                      ${priceMonthly.toFixed(0)}
                    </span>
                    <span className="text-muted-foreground">/mo</span>
                  </>
                ) : plan.type === 'enterprise' ? (
                  <span className="text-2xl font-bold">{t('contactUs')}</span>
                ) : (
                  <span className="text-4xl font-bold">{t('plans.free.name')}</span>
                )}
              </div>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col">
              {/* Features */}
              <div className="space-y-3 mb-6" data-cy="pricing-plan-features">
                <h4 className="font-semibold text-sm text-muted-foreground">
                  {t('features.title') || 'Features'}
                </h4>
                <ul className="space-y-2">
                  {Object.entries(BILLING_REGISTRY.features).map(([slug, feature]) => {
                    const hasFeature = plan.features.includes('*') || plan.features.includes(slug)
                    return (
                      <li key={slug} className="flex items-center gap-2" data-cy={`feature-${slug}`}>
                        {hasFeature ? (
                          <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )}
                        <span className={cn('text-sm', !hasFeature && 'text-muted-foreground')}>
                          {t(`features.${slug}`)}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>

              {/* Limits */}
              <div className="space-y-3 mb-6" data-cy="pricing-plan-limits">
                <h4 className="font-semibold text-sm text-muted-foreground">
                  {t('limits.title') || 'Limits'}
                </h4>
                <ul className="space-y-2">
                  {Object.entries(BILLING_REGISTRY.limits).map(([slug, limit]) => {
                    const value = plan.limits[slug]
                    const displayValue =
                      value === -1 ? t('unlimited') :
                      value !== undefined ? value.toString() : '-'

                    return (
                      <li key={slug} className="flex items-center justify-between text-sm" data-cy={`limit-${slug}`}>
                        <span className="text-muted-foreground">{t(`limits.${slug}`)}</span>
                        <span className="font-medium">{displayValue}</span>
                      </li>
                    )
                  })}
                </ul>
              </div>

              {/* Select Button */}
              <div className="mt-auto">
                <Button
                  className="w-full"
                  variant={isCurrentPlan ? 'outline' : 'default'}
                  disabled={isCurrentPlan}
                  onClick={() => onSelectPlan?.(plan.slug)}
                  data-cy={`pricing-select-${plan.slug}`}
                >
                  {isCurrentPlan
                    ? t('currentPlan')
                    : plan.type === 'enterprise'
                      ? t('contactSales')
                      : t('selectPlan')
                  }
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
