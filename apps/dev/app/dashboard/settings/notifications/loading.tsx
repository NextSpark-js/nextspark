import { SkeletonNotificationsPage } from '@nextsparkjs/core/components/ui/skeleton-settings'
import { getTemplateOrDefault } from '@nextsparkjs/registries/template-scopes/server/dashboard/settings/notifications/loading'

function NotificationsLoading() {
  return <SkeletonNotificationsPage />
}

export default getTemplateOrDefault('app/dashboard/settings/notifications/loading.tsx', NotificationsLoading)
