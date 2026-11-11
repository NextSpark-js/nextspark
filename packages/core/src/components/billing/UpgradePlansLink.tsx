'use client'

import Link from 'next/link'
import { DashboardProviders } from '../../providers/DashboardProviders'
import { usePermission } from '../../lib/permissions/hooks'
import type { Permission } from '../../lib/permissions/types'
import { Button } from '../ui/button'
import { FEATURES } from '../../lib/config/build-features'
import { useTranslations } from 'next-intl'

function PlansLink() {
  const canAccessBilling = usePermission('settings.billing' as Permission)
  const t = useTranslations('permissions.forbidden')
  // With `features.billing: false` there is no billing page to link to (#425)
  if (!canAccessBilling || !FEATURES.billing) return null
  return (
    <Link href="/dashboard/settings/billing" className="block mt-2">
      <Button variant="outline" size="sm" className="w-full">
        {t('viewPlans')}
      </Button>
    </Link>
  )
}

/**
 * The "View plans" link of the 403 page. It needs the user's role in the team, so it brings its own team providers;
 * the page loads it only when the 403 asks for an upgrade, so any other 403 makes no request.
 */
export default function UpgradePlansLink() {
  return (
    <DashboardProviders>
      <PlansLink />
    </DashboardProviders>
  )
}
