import { SkeletonPasswordPage } from '@nextsparkjs/core/components/ui/skeleton-settings'
import { getTemplateOrDefault } from '@nextsparkjs/registries/template-scopes/server/dashboard/settings/password/loading'

function PasswordLoading() {
  return <SkeletonPasswordPage />
}

export default getTemplateOrDefault('app/dashboard/settings/password/loading.tsx', PasswordLoading)
