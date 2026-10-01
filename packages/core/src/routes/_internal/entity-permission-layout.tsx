/**
 * Entity Permission Layout
 *
 * Server Component that validates entity permissions BEFORE rendering any page.
 * This layout is NOT overridable by themes to ensure security.
 *
 * IMPORTANT: Do NOT let a project template replace it - security must not be bypassable.
 *
 * Flow:
 * 1. User navigates to /dashboard/companies/create
 * 2. The user comes from the verified session and the team from the activeTeamId
 *    cookie only when this session wrote it (getDashboardPermissionContext; never
 *    from the proxy's identity headers); without one, the user's default team
 * 3. This layout checks permission in that team via checkPermission()
 * 4. If denied, redirects to /dashboard/permission-denied
 * 5. If allowed, renders the page (children)
 */
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { checkPermission } from '@nextsparkjs/core/lib/permissions/check'
import { getDashboardPermissionContext } from '@nextsparkjs/core/lib/auth/request-session'
import { isValidPermission } from '@nextsparkjs/core/lib/permissions/init'
import type { Permission } from '@nextsparkjs/core/lib/permissions/types'

type EntityAction = 'list' | 'read' | 'create' | 'update' | 'delete'

/**
 * Detect the required action from the pathname
 *
 * @param pathname - Full pathname (e.g., /dashboard/companies/create)
 * @param entitySlug - Entity slug (e.g., companies)
 * @returns The action being attempted
 */
function detectActionFromPathname(pathname: string, entitySlug: string): EntityAction {
  const entityPath = `/dashboard/${entitySlug}`
  const relativePath = pathname.replace(entityPath, '')

  // List: /dashboard/companies or /dashboard/companies/
  if (relativePath === '' || relativePath === '/') return 'list'

  // Create: /dashboard/companies/create
  if (relativePath === '/create') return 'create'

  // Update: /dashboard/companies/[id]/edit
  if (relativePath.match(/^\/[^/]+\/edit$/)) return 'update'

  // Read: /dashboard/companies/[id] (single detail view)
  if (relativePath.match(/^\/[^/]+$/)) return 'read'

  // Default fallback for any other path
  return 'read'
}

export interface EntityPermissionLayoutProps {
  entity: string
  children: React.ReactNode
}

/**
 * The permission check of one entity's dashboard routes. The generated host's per-entity
 * layouts pass their entity's slug.
 */
export async function EntityPermissionLayout({
  entity,
  children,
}: EntityPermissionLayoutProps) {
  const headersList = await headers()

  // The pathname the proxy forwards: a routing hint for the action, not an identity
  const pathname = headersList.get('x-pathname') || ''

  // The verified session's user, and the team it chose (or the user's default team until it has one)
  const { userId, teamId } = await getDashboardPermissionContext()

  // Skip validation if missing required data
  // - No session: nothing to check permissions for (the proxy sends it to login; the data APIs refuse it)
  // - No teamId: the user belongs to no team, let page handle it
  if (!userId || !teamId) {
    console.log('[EntityPermissionLayout] Skipping validation - missing data:', {
      entity,
      userId: !!userId,
      teamId: !!teamId
    })
    return <>{children}</>
  }

  // Skip permission validation for routes that don't have entity permissions
  // These are custom template pages (like agent-single, agent-multi) that aren't real entities
  if (!isValidPermission(`${entity}.list` as Permission)) {
    console.log('[EntityPermissionLayout] Skipping validation - no entity permission config for:', entity)
    return <>{children}</>
  }

  // Detect required action from pathname
  const action = detectActionFromPathname(pathname, entity)
  const permission = `${entity}.${action}` as Permission

  console.log('[EntityPermissionLayout] Checking permission:', {
    entity,
    action,
    permission,
    userId,
    teamId
  })

  // Check permission using existing core function
  const hasPermission = await checkPermission(userId, teamId, permission)

  if (!hasPermission) {
    console.log('[EntityPermissionLayout] Permission denied, redirecting')
    redirect(`/dashboard/permission-denied?entity=${entity}&action=${action}`)
  }

  return <>{children}</>
}
