import { SkeletonSecurityPage } from '@nextsparkjs/core/components/ui/skeleton-settings'
import { getTemplateOrDefault } from '@nextsparkjs/registries/template-scopes/server/dashboard/settings/security/loading'

function SecurityLoading() {
  return <SkeletonSecurityPage />
}

export default getTemplateOrDefault('app/dashboard/settings/security/loading.tsx', SecurityLoading)
