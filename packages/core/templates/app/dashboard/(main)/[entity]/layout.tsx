/**
 * Entity Permission Layout
 *
 * Server Component that validates entity permissions BEFORE rendering any page.
 * This layout is NOT overridable by themes to ensure security.
 *
 * IMPORTANT: Do NOT use getTemplateOrDefault here - security must not be bypassable.
 *
 * Flow:
 * 1. User navigates to /dashboard/companies/create
 * 2. Browser sends activeTeamId cookie automatically
 * 3. This layout reads cookie and checks permission via checkPermission()
 * 4. If denied, redirects to /dashboard/permission-denied
 * 5. If allowed, renders the page (children)
 */
import { headers, cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { checkPermission } from '@nextsparkjs/core/lib/permissions/check'
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

interface EntityLayoutProps {
  children: React.ReactNode
  params: Promise<{ entity: string }>
}

export default async function EntityPermissionLayout({
  children,
  params
}: EntityLayoutProps) {
  const { entity } = await params
  const headersList = await headers()
  const cookieStore = await cookies()

  // Get pathname from middleware header
  const pathname = headersList.get('x-pathname') || ''

  // Get userId from middleware header (set for all authenticated routes)
  const userId = headersList.get('x-user-id')

  // Get teamId from cookie (set by TeamContext and /api/v1/teams/switch)
  const teamId = cookieStore.get('activeTeamId')?.value

  // Skip validation if missing required data
  // - No userId: middleware will redirect to login (shouldn't happen for dashboard routes)
  // - No teamId: user hasn't selected a team yet, let page handle it
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
