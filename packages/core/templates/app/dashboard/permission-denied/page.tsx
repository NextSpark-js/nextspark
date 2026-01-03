/**
 * Permission Denied Page
 *
 * Server page that reads search params and renders the existing NoPermission component.
 * This page is displayed when a user attempts to access a resource they don't have permission for.
 */
import { NoPermission } from '@nextsparkjs/core/components/permissions/NoPermission'

interface PermissionDeniedPageProps {
  searchParams: Promise<{
    entity?: string
    action?: string
  }>
}

export default async function PermissionDeniedPage({
  searchParams
}: PermissionDeniedPageProps) {
  const { entity, action } = await searchParams

  return (
    <NoPermission
      entityName={entity}
      action={action as 'list' | 'read' | 'create' | 'update' | 'delete'}
      showBackButton={true}
      showHomeButton={true}
    />
  )
}
