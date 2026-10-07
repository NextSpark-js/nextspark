import { revalidatePath } from 'next/cache'
import { unstable_rethrow } from 'next/navigation'
import type { EntityConfig } from '../entities/types'
import { getEntityBasePath } from '../entities/schema-generator'
import { revalidateTag } from './revalidate-tag'

/**
 * The public pages of an entity are cached (`'use cache'` tagged `entity:<slug>` in public-item-route.cc; ISR
 * `revalidate` in the other host), so a write has to expire them. Every writer of an entity ends here: the
 * generic REST handler, the entity handler, GenericEntityService and the server actions reach it through the
 * `afterEntity*` hooks (entity-hooks.ts), and the one write that skips hooks (`deleteMany`) calls it itself.
 *
 * - Cache Components: `entity:<slug>` is on every cached read of the entity's items (found or not found), so
 *   one tag covers the old and the new slug of a rename, an unpublished item and a deleted one. It also
 *   drops the sibling items' entries; they are read again by their next visit.
 * - ISR: Next tags a page by its route file path, route group included, so the path is `/(public)<basePath>` with
 *   'layout' (item pages and archive of a base path) or the root item route with 'page'. `(public)` is the group the
 *   host generator puts those routes in (scripts/build/registry/host/entity-routes.mjs); a test keeps them equal.
 * - Patterns are tagged `patterns` and are expired by their own writes.
 *
 * Outside a request (a script, a test) Next refuses the call; there is no cache to expire there.
 */
/** Route group of the generated public routes. Keep equal to the one in scripts/build/registry/host/entity-routes.mjs. */
export const PUBLIC_ROUTE_GROUP = '(public)'

export function expirePublicEntity(config: Pick<EntityConfig, 'slug' | 'access' | 'builder'> | undefined): void {
  if (!config) return
  try {
    if (config.slug === 'patterns') revalidateTag('patterns')
    const basePath = getEntityBasePath(config as EntityConfig)
    if (!basePath) return
    revalidateTag(`entity:${config.slug}`)
    const group = `/${PUBLIC_ROUTE_GROUP}`
    if (basePath === '/') revalidatePath(`${group}${config.access?.allowNestedSlugs ? '/[...slug]' : '/[slug]'}`, 'page')
    else revalidatePath(`${group}${basePath}`, 'layout')
  } catch (error) {
    unstable_rethrow(error)
    // Outside a request (a seed, a script) there is no cache to expire: say it in one line, not a stack per row.
    console.warn(`[public-entity-cache] could not expire the public pages of ${config.slug}: ${error instanceof Error ? error.message : error}`)
  }
}
