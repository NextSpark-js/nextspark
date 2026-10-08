import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, createAuthFailureResponse, type DualAuthResult } from './auth/dual-auth'
import { checkPermission } from '../permissions/check'

/**
 * Post categories (`taxonomies` rows of type `post_category`) belong to a team: they are created in the caller's
 * team (`x-team-id`) and read, changed and deleted only there, under the same team-role permissions as the posts
 * entity (`posts.list`, `posts.create`, `posts.update`, `posts.delete`). Rows without a team (the only kind before
 * categories were scoped) stay readable by every team and by visitors; only a superadmin can change or delete them.
 */

/** A refusal the route returns as it is. */
export type Refusal = { response: NextResponse }

const deny = (status: number, code: string, error: string): Refusal => ({ response: NextResponse.json({ success: false, error, code }, { status }) })

// Stricter than the RLS policy of migration 030 (is_superadmin(), which also accepts a developer of the System Admin Team)
const isSuperadmin = (auth: DualAuthResult) => auth.user?.role === 'superadmin'

/**
 * The team whose categories a read sees, besides the rows without a team. No `x-team-id`: none (a visitor, or a
 * caller without a team context, sees only the rows without a team). With one: the caller must be able to list
 * posts there.
 */
export async function categoryReadTeam(request: NextRequest): Promise<{ teamId: string | null } | Refusal> {
  const teamId = request.headers.get('x-team-id')
  if (!teamId) return { teamId: null }
  const auth = await authenticateRequest(request, { requiredScope: 'posts:read' })
  if (!auth.success || !auth.user) return { response: createAuthFailureResponse(auth) }
  if (!isSuperadmin(auth) && !(await checkPermission(auth.user.id, teamId, 'posts.list'))) {
    return deny(403, 'PERMISSION_DENIED', 'Permission denied: insufficient permissions for posts.list')
  }
  return { teamId }
}

export interface CategoryWriter {
  userId: string
  /** The caller's team (`x-team-id`), when the caller holds `posts.<action>` there. */
  teamId: string | null
  /** A superadmin may change or delete the rows without a team. */
  superadmin: boolean
}

/** Who writes, and in which team, after the API-key scope and the team-role check for `posts.<action>`. */
export async function categoryWriter(request: NextRequest, action: 'create' | 'update' | 'delete'): Promise<CategoryWriter | Refusal> {
  const auth = await authenticateRequest(request, { requiredScope: action === 'delete' ? 'posts:delete' : 'posts:write' })
  if (!auth.success || !auth.user) return { response: createAuthFailureResponse(auth) }
  const superadmin = isSuperadmin(auth)
  const requested = request.headers.get('x-team-id')
  const teamId = requested && (await checkPermission(auth.user.id, requested, `posts.${action}`)) ? requested : null
  if (!teamId && !(superadmin && action !== 'create')) {
    return requested
      ? deny(403, 'PERMISSION_DENIED', `Permission denied: insufficient permissions for posts.${action}`)
      : deny(400, 'TEAM_CONTEXT_REQUIRED', 'Team context required. Include x-team-id header.')
  }
  return { userId: auth.user.id, teamId, superadmin }
}
