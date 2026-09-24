'use client'

import { useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import { getTemplateOrDefaultClient } from '@nextsparkjs/registries/template-scopes/client/dashboard/settings/plans/page'
import { PricingTable } from '@nextsparkjs/core/components/billing'
import { fetchWithTeam } from '@nextsparkjs/core/lib/api/entities'
import { toast } from 'sonner'

/**
 * Plans Settings Page
 *
 * Displays the pricing table with plan comparison.
 * Users can select a plan to initiate checkout.
 */
function PlansPage() {
  const t = useTranslations('settings')
  const [loading, setLoading] = useState<string | null>(null)

  const handleSelectPlan = useCallback(async (planSlug: string) => {
    setLoading(planSlug)
    try {
      const res = await fetchWithTeam('/api/v1/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planSlug, billingPeriod: 'monthly' }),
      })
      const data = await res.json()
      if (data.success && data.data?.url) {
        // New subscription — redirect to provider checkout
        window.location.href = data.data.url
      } else if (data.success && data.data?.changed) {
        // Plan changed via proration (existing subscription)
        toast.success('Plan changed successfully')
        window.location.reload()
      } else {
        toast.error(data.error || 'Failed to process plan change')
      }
    } catch {
      toast.error('Failed to start checkout')
    } finally {
      setLoading(null)
    }
  }, [])

  return (
    <div className="max-w-6xl" data-cy="plans-settings-main">
      {/* Header */}
      <header data-cy="plans-settings-header">
        <h1 className="text-2xl font-bold">{t('plans.title')}</h1>
        <p className="text-muted-foreground mt-1">{t('plans.description')}</p>
      </header>

      {/* Pricing Table */}
      <div className="mt-8" data-cy="plans-settings-table">
        <PricingTable onSelectPlan={handleSelectPlan} />
      </div>
    </div>
  )
}

export default getTemplateOrDefaultClient('app/dashboard/settings/plans/page.tsx', PlansPage)
