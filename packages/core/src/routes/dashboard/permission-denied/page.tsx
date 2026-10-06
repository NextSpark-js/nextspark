/**
 * Permission Denied Page
 *
 * Server page that reads search params and renders the existing NoPermission component.
 * This page is displayed when a user attempts to access a resource they don't have permission for.
 */
import { Suspense } from 'react'
import { NoPermission } from '@nextsparkjs/core/components/permissions/NoPermission'

interface PermissionDeniedPageProps {
  searchParams: Promise<{
    entity?: string
    action?: string
  }>
}

async function DeniedMessage({
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

// The search parameters are request data: read behind a boundary of their own, the page's shell does not wait for them
function PermissionDeniedPage({ searchParams }: PermissionDeniedPageProps) {
  return (
    <Suspense fallback={null}>
      <DeniedMessage searchParams={searchParams} />
    </Suspense>
  )
}

export default PermissionDeniedPage
