import { SkeletonPlansPage } from '@nextsparkjs/core/components/ui/skeleton-settings'
import { getTemplateOrDefault } from '@nextsparkjs/registries/template-scopes/server/dashboard/settings/plans/loading'

function PlansLoading() {
  return <SkeletonPlansPage />
}

export default getTemplateOrDefault('app/dashboard/settings/plans/loading.tsx', PlansLoading)
