import { SkeletonBillingPage } from '@nextsparkjs/core/components/ui/skeleton-settings'
import { getTemplateOrDefault } from '@nextsparkjs/registries/template-scopes/server/dashboard/settings/billing/loading'

function BillingLoading() {
  return <SkeletonBillingPage />
}

export default getTemplateOrDefault('app/dashboard/settings/billing/loading.tsx', BillingLoading)
