'use client'

import { useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { getTemplateOrDefaultClient } from '@nextsparkjs/registries/template-registry.client'
import { PricingTable } from '@nextsparkjs/core/components/billing'
import { useRouter } from 'next/navigation'

/**
 * Plans Settings Page
 *
 * Displays the pricing table with plan comparison.
 * Users can select a plan to initiate checkout.
 */
function PlansPage() {
  const t = useTranslations('settings')
  const router = useRouter()

  const handleSelectPlan = useCallback((planSlug: string) => {
    // Redirect to checkout API with selected plan
    router.push(`/api/v1/billing/checkout?plan=${planSlug}`)
  }, [router])

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
