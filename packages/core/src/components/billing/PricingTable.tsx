'use client'

import { useState } from 'react'
import { BILLING_REGISTRY } from '@nextsparkjs/registries/billing-registry'
import { useSubscription } from '../../hooks/useSubscription'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Skeleton } from '../ui/skeleton'
import { Check, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '../../lib/utils'
import { ConfirmPlanChangeModal } from './ConfirmPlanChangeModal'

interface PricingTableProps {
  onSelectPlan?: (planSlug: string) => void
  className?: string
}

/**
 * Skeleton card shown while subscription data loads.
 * Prevents flash of billing.selectPlan on all buttons before
 * the current plan is known.
 */
function PricingCardSkeleton() {
  return (
    <Card className="relative flex flex-col">
      <CardHeader>
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-4 w-48 mt-2" />
        <Skeleton className="h-10 w-20 mt-4" />
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <Skeleton className="h-4 w-24 mb-3" />
        <div className="space-y-2.5 mb-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded-full shrink-0" />
              <Skeleton className="h-3.5 w-32" />
            </div>
          ))}
        </div>
        <Skeleton className="h-4 w-16 mb-3" />
        <div className="space-y-2.5 mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex justify-between">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3.5 w-16" />
            </div>
          ))}
        </div>
        <div className="mt-auto">
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * PricingTable - Plan comparison table with features and limits
 *
 * Shows skeleton cards while subscription data loads to avoid
 * a flash of incorrect button states (INP optimization).
 *
 * @example
 * ```tsx
 * <PricingTable onSelectPlan={(slug) => handleUpgrade(slug)} />
 * ```
 */
export function PricingTable({ onSelectPlan, className }: PricingTableProps) {
  const t = useTranslations('billing')
  const { planSlug: currentPlanSlug, subscription, isReady } = useSubscription()
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [targetPlanSlug, setTargetPlanSlug] = useState<string | null>(null)
  const [changePlanLoading, setChangePlanLoading] = useState(false)

  const hasActiveSubscription = !!subscription?.externalSubscriptionId

  const handleSelectPlan = (planSlug: string) => {
    if (hasActiveSubscription && currentPlanSlug && planSlug !== currentPlanSlug) {
      setTargetPlanSlug(planSlug)
      setConfirmModalOpen(true)
    } else {
      onSelectPlan?.(planSlug)
    }
  }

  const handleConfirmChange = async () => {
    if (!targetPlanSlug) return
    setChangePlanLoading(true)
    try {
      onSelectPlan?.(targetPlanSlug)
    } finally {
      setChangePlanLoading(false)
      setConfirmModalOpen(false)
      setTargetPlanSlug(null)
    }
  }

  // Filter plans to show only public ones (hide 'hidden' and 'invite_only')
  const visiblePlans = BILLING_REGISTRY.plans.filter(
    p => p.visibility === 'public' || p.visibility === undefined
  )

  // Show skeletons until subscription is fully resolved (team loaded + query fetched).
  // Prevents flash of incorrect button states on page load.
  if (!isReady) {
    return (
      <div
        className={cn('grid gap-6 md:grid-cols-2 lg:grid-cols-3', className)}
        data-cy="pricing-table-loading"
      >
        {visiblePlans.map((plan) => (
          <PricingCardSkeleton key={plan.slug} />
        ))}
      </div>
    )
  }

  return (
    <>
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
                'relative flex flex-col transition-all duration-200',
                isCurrentPlan
                  ? 'border-primary border-2 shadow-md ring-1 ring-primary/20'
                  : 'hover:border-border/80 hover:shadow-sm'
              )}
              data-cy={`pricing-plan-${plan.slug}`}
              aria-current={isCurrentPlan ? 'true' : undefined}
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
                      <span className="text-4xl font-bold tabular-nums">
                        ${priceMonthly.toFixed(0)}
                      </span>
                      <span className="text-muted-foreground text-sm">{t('perMonth')}</span>
                    </>
                  ) : plan.type === 'enterprise' ? (
                    <span className="text-2xl font-bold">{t('contactUs')}</span>
                  ) : (
                    <>
                      <span className="text-4xl font-bold tabular-nums">$0</span>
                      <span className="text-muted-foreground text-sm">{t('perMonth')}</span>
                    </>
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
                    onClick={() => handleSelectPlan(plan.slug)}
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

      {currentPlanSlug && targetPlanSlug && (
        <ConfirmPlanChangeModal
          open={confirmModalOpen}
          onOpenChange={setConfirmModalOpen}
          currentPlanSlug={currentPlanSlug}
          targetPlanSlug={targetPlanSlug}
          onConfirm={handleConfirmChange}
          loading={changePlanLoading}
        />
      )}
    </>
  )
}
