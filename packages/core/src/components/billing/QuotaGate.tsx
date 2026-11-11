'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button } from '../ui/button'
import { Lock, ArrowLeft, ArrowRight } from 'lucide-react'
import { useQuotaCheck } from '../../hooks/useQuotaCheck'
import { FEATURES } from '../../lib/config/build-features'

interface QuotaGateProps {
  /** Action to check (e.g., 'professionals.create') */
  action: string
  /** Human-readable entity name for the message */
  entityName: string
  /** Link to go back to the list */
  backHref: string
  /** Content to render when allowed */
  children: ReactNode
}

/**
 * Wraps a create form. If quota is exceeded, shows an upgrade prompt
 * instead of the form. Prevents the user from filling a form they can't submit.
 *
 * Design: neutral card with border — avoids amber/orange full-screen that
 * was nearly invisible in dark mode and felt more like an error than a prompt.
 */
export function QuotaGate({ action, entityName, backHref, children }: QuotaGateProps) {
  const t = useTranslations('billing')
  const { canCreate, isLoading, isQuotaExceeded } = useQuotaCheck(action)

  // While loading, show nothing (prevents flash)
  if (isLoading) return null

  // If allowed, render children normally
  if (canCreate) return <>{children}</>

  // Blocked — show upgrade prompt
  return (
    <div className="px-2 sm:px-4 lg:px-6 py-12 max-w-md mx-auto" data-cy="quota-gate">
      <div className="rounded-xl border bg-card p-8 text-center space-y-5">
        {/* Icon in a neutral container — not amber full-bleed */}
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mx-auto">
          <Lock className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">
            {isQuotaExceeded
              ? t('quota.limitReached', { entity: entityName })
              : t('quota.featureNotIncluded')}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {isQuotaExceeded
              ? t('quota.limitReachedDetail', { entity: entityName })
              : t('quota.featureNotIncludedDetail')}
          </p>
        </div>

        {/* Primary CTA first (most important action) */}
        <div className="flex flex-col sm:flex-row justify-center gap-3 pt-1">
          {/* With `features.billing: false` there is no plans page (#425): the way back is the only action */}
          {FEATURES.billing && (
            <Button asChild className="gap-1.5">
              <Link href="/dashboard/settings/plans">
                {t('quota.viewPlans')}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" className="gap-1.5">
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {t('quota.goBack')}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
