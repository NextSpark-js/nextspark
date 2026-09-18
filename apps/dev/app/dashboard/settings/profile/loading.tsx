import { SkeletonProfileForm } from '@nextsparkjs/core/components/ui/skeleton-settings'
import { getTemplateOrDefault } from '@nextsparkjs/registries/template-scopes/server/dashboard/settings/profile/loading'

function ProfileLoading() {
  return <SkeletonProfileForm />
}

export default getTemplateOrDefault('app/dashboard/settings/profile/loading.tsx', ProfileLoading)
