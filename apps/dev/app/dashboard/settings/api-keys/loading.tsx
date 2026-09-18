import { SkeletonApiKeysPage } from '@nextsparkjs/core/components/ui/skeleton-settings'
import { getTemplateOrDefault } from '@nextsparkjs/registries/template-scopes/server/dashboard/settings/api-keys/loading'

function ApiKeysLoading() {
  return <SkeletonApiKeysPage />
}

export default getTemplateOrDefault('app/dashboard/settings/api-keys/loading.tsx', ApiKeysLoading)
