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

/** One published row: the arguments are the cache key, so they are plain strings. */
async function readPublishedItem(entitySlug: string, tableName: string, selectClause: string, slug: string): Promise<PublishedItem | null> {
  'use cache'
  cacheLife({ stale: 300, revalidate: 3600, expire: 86400 })
  cacheTag(`entity:${entitySlug}`, `public-item:${entitySlug}:${slug}`)

  const result = await query<PublishedItem>(`SELECT ${selectClause} FROM "${tableName}" WHERE slug = $1 AND status = 'published'`, [slug])
  return result.rows[0] || null
}

/** The published patterns of some ids. */
async function readPatterns(ids: string[]): Promise<Pattern[]> {
  'use cache'
  cacheLife({ stale: 300, revalidate: 900, expire: 86400 })
  cacheTag('patterns')

  return PatternsResolverService.getByIds(ids)
}

const cachedSource: PublicItemSource = {
  async fetchItem(entity: EntityConfig, slug: string) {
    try {
      return await readPublishedItem(entity.slug, entity.tableName || entity.slug, buildPublicSelectClause(entity), slug)
    } catch (error) {
      console.error(`[fetchPublishedItem] Error fetching ${entity.slug}:`, error)
      return null
    }
  },
  resolveBlocks: (blocks: (BlockInstance | PatternReference)[]) => getResolvedBlocks(blocks, readPatterns),
}

const cachedRoutes = bindPublicItemRoutes(cachedSource)
// The page awaits `params` (and may answer notFound()): behind a boundary of its own, see suspended-route.tsx.
export const createPublicItemRoute = (...args: Parameters<typeof cachedRoutes.createPublicItemRoute>) => behindSuspense(cachedRoutes.createPublicItemRoute(...args))
export const createPublicItemMetadata = cachedRoutes.createPublicItemMetadata
export type { PublicItemTemplateProps } from './public-item-route'
