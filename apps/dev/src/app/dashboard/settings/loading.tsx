import { SkeletonSettingsOverview } from '@nextsparkjs/core/components/ui/skeleton-settings'
import { getTemplateOrDefault } from '@nextsparkjs/registries/template-scopes/server/dashboard/settings/loading'

function SettingsLoading() {
  return <SkeletonSettingsOverview />
}

export default getTemplateOrDefault('app/dashboard/settings/loading.tsx', SettingsLoading)
