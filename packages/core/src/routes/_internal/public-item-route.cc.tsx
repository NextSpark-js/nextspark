/**
 * The public item pages of a host with `cacheComponents` on (the Cache Components counterpart of
 * public-item-route; the host imports this module for them, see `ENTITY_MODULES.publicItemCc`).
 *
 * Same routes and metadata, different source: a published item and the patterns its blocks reference are
 * read in `'use cache'` functions, so a visit does not query the database, and the page and its metadata
 * share one read. This replaces the `revalidate = 3600` of the ISR host, which Cache Components rejects.
 *
 * - Lifetime, `cacheLife({ stale: 300, revalidate: 3600, expire: 86400 })` for an item: the server regenerates
 *   the entry an hour after it was filled (the ISR host's `revalidate = 3600`), serving the old one while it does;
 *   `stale` is only how long a browser's client-side router cache reuses a page without asking the server again
 *   (5 minutes, so a visitor navigating around sees an edit at most that much after the server has it); after
 *   `expire` (a day without a request) the next visit waits for a fresh read. Patterns: refreshed every 15 minutes.
 * - Tags: `entity:<slug>` on every item of an entity and `public-item:<slug>:<item slug>` on one, for
 *   `revalidateTag` when a caller needs to publish a change at once.
 * - A read that fails throws inside the cached function, so a failure is never cached as "not found".
 */
import { cacheLife, cacheTag } from 'next/cache'
import { query } from '@nextsparkjs/core/lib/db'
import { PatternsResolverService } from '@nextsparkjs/core/lib/blocks/patterns-resolver.service'
import type { EntityConfig } from '@nextsparkjs/core/lib/entities/types'
import type { BlockInstance } from '@nextsparkjs/core/types/blocks'
import type { Pattern, PatternReference } from '@nextsparkjs/core/types/pattern-reference'
import { buildPublicSelectClause, getResolvedBlocks, type PublishedItem } from './public-entity-shared'
import { bindPublicItemRoutes, type PublicItemSource } from './public-item-route'
import { behindSuspense } from './suspended-route'

/**
 * A Next.js build registers a `'use cache'` function as a server reference, so whoever reaches it can call it with any
 * arguments. These two take only plain identifiers, validate them before anything else and derive the rest (table,
 * select clause, published status) themselves; an argument that does not fit answers "not found", not data.
 */
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/
const ITEM_SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/
const MAX_PATTERN_IDS = 50

/** The public entities whose routes this process built, by slug: where a cached read finds the entity's config. */
const publicEntities = new Map<string, EntityConfig>()

/** The config is the one a route facade imports and hands to the factories (never an argument of a cached read). */
function registerEntity(config: EntityConfig) {
  publicEntities.set(config.slug, config)
}

/** One published row of a public entity: the arguments are the cache key, so they are plain strings. */
export async function readPublishedItem(entitySlug: string, slug: string): Promise<PublishedItem | null> {
  'use cache'
  cacheLife({ stale: 300, revalidate: 3600, expire: 86400 })

  if (typeof entitySlug !== 'string' || typeof slug !== 'string' || !IDENTIFIER.test(entitySlug) || slug.length > 200 || !ITEM_SLUG.test(slug)) return null
  const entity = publicEntities.get(entitySlug)
  // Not a "not found": the entry would be cached untagged under the key the page uses once it is registered. A throw is not cached.
  if (!entity) throw new Error(`[readPublishedItem] no route of this process serves the entity "${entitySlug}"`)
  const tableName = entity.tableName || entity.slug
  if (!IDENTIFIER.test(tableName)) return null
  cacheTag(`entity:${entitySlug}`, `public-item:${entitySlug}:${slug}`)

  const result = await query<PublishedItem>(`SELECT ${buildPublicSelectClause(entity)} FROM "${tableName}" WHERE slug = $1 AND status = 'published'`, [slug])
  return result.rows[0] || null
}

/** The published patterns of some ids. */
export async function readPatterns(ids: string[]): Promise<Pattern[]> {
  'use cache'
  cacheLife({ stale: 300, revalidate: 900, expire: 86400 })

  if (!Array.isArray(ids) || ids.length > MAX_PATTERN_IDS) return []
  const valid = ids.filter(id => typeof id === 'string' && IDENTIFIER.test(id))
  if (valid.length === 0) return []
  cacheTag('patterns')

  return PatternsResolverService.getByIds(valid)
}

const cachedSource: PublicItemSource = {
  async fetchItem(entity: EntityConfig, slug: string) {
    registerEntity(entity)
    try {
      return await readPublishedItem(entity.slug, slug)
    } catch (error) {
      console.error(`[fetchPublishedItem] Error fetching ${entity.slug}:`, error)
      return null
    }
  },
  resolveBlocks: (blocks: (BlockInstance | PatternReference)[]) => getResolvedBlocks(blocks, readPatterns),
}

const cachedRoutes = bindPublicItemRoutes(cachedSource)
// The page awaits `params` (and may answer notFound()): behind a boundary of its own, see suspended-route.tsx.
// The facade calls these when its module loads, so the entity is known before any request (or any direct call of a cached read).
export const createPublicItemRoute = (...args: Parameters<typeof cachedRoutes.createPublicItemRoute>) => {
  registerEntity(args[0])
  return behindSuspense(cachedRoutes.createPublicItemRoute(...args))
}
export const createPublicItemMetadata = (...args: Parameters<typeof cachedRoutes.createPublicItemMetadata>) => {
  registerEntity(args[0])
  return cachedRoutes.createPublicItemMetadata(...args)
}
export type { PublicItemTemplateProps } from './public-item-route'
