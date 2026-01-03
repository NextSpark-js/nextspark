'use client'

import { useSubscription } from '../../hooks/useSubscription'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { useTranslations } from 'next-intl'
import { cn } from '../../lib/utils'
import { Calendar, CreditCard } from 'lucide-react'
import { Skeleton } from '../ui/skeleton'
import { ManageBillingButton } from './ManageBillingButton'

interface SubscriptionStatusProps {
  onUpgrade?: () => void
  className?: string
}

/**
 * SubscriptionStatus - Display current plan and subscription status
 *
 * @example
 * ```tsx
 * <SubscriptionStatus onUpgrade={() => setUpgradeModalOpen(true)} />
 * ```
 */
export function SubscriptionStatus({ onUpgrade, className }: SubscriptionStatusProps) {
  const { plan, subscription, status, isTrialing, isLoading } = useSubscription()
  const t = useTranslations('billing')

  if (isLoading) {
    return (
      <Card className={className} data-cy="subscription-status-loading">
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!plan || !subscription) {
    return null
  }

  // Status badge variant mapping
  const statusVariant =
    status === 'active' ? 'default' :
    status === 'trialing' ? 'secondary' :
    status === 'past_due' ? 'destructive' :
    status === 'canceled' ? 'outline' :
    'secondary'

  return (
    <Card className={className} data-cy="subscription-status">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle data-cy="subscription-status-plan">
            {t(`plans.${plan.slug}.name`)}
          </CardTitle>
          <Badge variant={statusVariant} data-cy="subscription-status-badge">
            {status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Billing Period */}
        {subscription.currentPeriodEnd && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground" data-cy="subscription-status-period">
            <Calendar className="h-4 w-4" />
            <span>
              {isTrialing
                ? `Trial ends ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                : `Next billing: ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
              }
            </span>
          </div>
        )}

        {/* Payment Method (if applicable) */}
        {subscription.paymentProvider && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground" data-cy="subscription-payment-provider">
            <CreditCard className="h-4 w-4" />
            <span className="capitalize">{subscription.paymentProvider}</span>
          </div>
        )}

        {/* Upgrade Button (if not on highest plan) */}
        {plan.type !== 'enterprise' && onUpgrade && (
          <Button
            variant="default"
            className="w-full"
            onClick={onUpgrade}
            data-cy="subscription-status-upgrade"
          >
            {t('upgrade')}
          </Button>
        )}

        {/* Manage Billing Button (if has Stripe customer) */}
        {subscription.externalCustomerId && (
          <div data-cy="subscription-manage-billing">
            <ManageBillingButton className="w-full" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
