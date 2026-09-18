import { SkeletonTeamsPage } from '@nextsparkjs/core/components/ui/skeleton-settings'
import { getTemplateOrDefault } from '@nextsparkjs/registries/template-scopes/server/dashboard/settings/teams/loading'

function TeamsLoading() {
  return <SkeletonTeamsPage />
}

export default getTemplateOrDefault('app/dashboard/settings/teams/loading.tsx', TeamsLoading)
