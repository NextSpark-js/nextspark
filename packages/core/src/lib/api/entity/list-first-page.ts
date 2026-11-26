/**
 * The first page of a dashboard entity list, read on the server (#574), so the empty state is in the page's HTML and
 * the list does not wait for its own request after hydrating.
 *
 * It answers what `GET /api/v1/<slug>?limit=50&includeMeta=true` (EntityListWrapper's first request) would answer the
 * same browser: the session read from the database as the API reads it (a revoked session or a suspended account is
 * none), the team this session chose while the user still belongs to it (else the default team), no admin bypass (the
 * dashboard never sends its header), the `<slug>.list` permission decided by checkPermission's rule, and then the
 * API's own read (listEntityRecords: hidden fields, ownership, soft delete, hooks). Whenever any of that says no, or
 * fails, it returns null and the list asks the API as before, which gives its own answer.
 */
import { randomUUID } from 'node:crypto'
import { getAuthorizationRequestSession, getSessionActiveTeamId, contextHasPermission } from '../../auth/request-session'
import { getDashboardMembership } from '../../teams/dashboard-team'
import { isApiOperationEnabled } from '../../entities/api-access'
import type { Permission } from '../../permissions/types'
import { resolveEntityFromUrl, validateEntityOperation } from './resolver'
import { listEntityRecords } from './generic-handler'

/** The list's first page as the server read it. */
export interface EntityListFirstPage {
  /** Unique per read: a page restored from the router cache (back/forward) carries one the list already showed. */
  key: string
  /** The team it was read in. */
  teamId: string
  /** The rows, as the API's JSON has them. */
  data: Record<string, unknown>[]
}

/** EntityListWrapper's first request: `listEntityData(slug, { limit: 50, includeMeta: true })`. */
const FIRST_PAGE_QUERY = 'limit=50&includeMeta=true'

/**
 * @param slug - the entity
 * @param searchParams - the page's query: with any parameter (a filter, a search) the list reads it itself, as before
 */
export async function readEntityListFirstPage(
  slug: string,
  searchParams: Record<string, string | string[] | undefined>
): Promise<EntityListFirstPage | null> {
  if (Object.keys(searchParams).length > 0) return null
  try {
    const session = await getAuthorizationRequestSession()
    const userId = session?.user?.id
    if (!session || !userId) return null
    const membership = await getDashboardMembership(userId, await getSessionActiveTeamId(session))
    if (!membership || !contextHasPermission(membership, `${slug}.list` as Permission)) return null

    const { entityConfig, entityName } = await resolveEntityFromUrl(`/api/v1/${slug}`)
    if (!entityConfig || !validateEntityOperation(entityConfig, 'list') || !isApiOperationEnabled(entityConfig, 'read')) return null

    const page = await listEntityRecords({
      entityConfig,
      entityName,
      url: new URL(`http://list/?${FIRST_PAGE_QUERY}`),
      userId,
      teamId: membership.teamId,
      isBypass: false,
    })
    if (!('meta' in page)) return null // a rejected parameter: the API answers it
    // The JSON the API sends (dates as strings), not the driver's values
    return { key: randomUUID(), teamId: membership.teamId, data: JSON.parse(JSON.stringify(page.data)) }
  } catch (error) {
    console.error(`[entity-list] Server read of the first page of "${slug}" failed:`, error)
    return null
  }
}
