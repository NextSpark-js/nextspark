import { SkeletonDashboardHome } from '@nextsparkjs/core/components/ui/skeleton-dashboard'
import { getTemplateOrDefault } from '@nextsparkjs/registries/template-scopes/server/dashboard/(main)/loading'

function DashboardLoading() {
  return <SkeletonDashboardHome />
}

export default getTemplateOrDefault('app/dashboard/(main)/loading.tsx', DashboardLoading)
