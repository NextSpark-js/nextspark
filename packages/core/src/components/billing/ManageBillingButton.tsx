'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CreditCard, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '../ui/button'
import { useSubscription } from '../../hooks/useSubscription'
import { toast } from 'sonner'

interface ManageBillingButtonProps {
  className?: string
}

/**
 * ManageBillingButton - Redirect to Stripe Customer Portal
 *
 * Button that opens Stripe's hosted billing portal for subscription management.
 * Only visible for subscriptions with an external Stripe customer ID.
 *
 * Features:
 * - Update payment method
 * - View invoices
 * - Cancel subscription
 * - View billing history
 *
 * @example
 * ```tsx
 * <ManageBillingButton />
 * ```
 */
export function ManageBillingButton({ className }: ManageBillingButtonProps) {
  const t = useTranslations('billing.portal')
  const { subscription } = useSubscription()
  const [isLoading, setIsLoading] = useState(false)

  // Only show if there's a Stripe customer
  if (!subscription?.externalCustomerId) {
    return null
  }

  const handleClick = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/v1/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        const data = await response.json()
        toast.error(data.error || t('error'))
        setIsLoading(false)
        return
      }

      const data = await response.json()
      if (data.success && data.data?.url) {
        // Redirect to Stripe Customer Portal
        window.location.href = data.data.url
      } else {
        toast.error(data.error || t('error'))
        setIsLoading(false)
      }
    } catch (error) {
      console.error('Portal error:', error)
      toast.error(t('error'))
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      onClick={handleClick}
      disabled={isLoading}
      className={className}
      data-cy="manage-billing-button"
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {t('loading')}
        </>
      ) : (
        <>
          <CreditCard className="mr-2 h-4 w-4" />
          {t('manage')}
          <ExternalLink className="ml-2 h-3 w-3" />
        </>
      )}
    </Button>
  )
}
