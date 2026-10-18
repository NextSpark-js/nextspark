/**
 * The published rows of a public entity, for the sitemap (#273).
 *
 * The rule is the one the public item page applies in `fetchPublishedItem`: `status = 'published'` in the entity's
 * table, read as the service role (no user, no team: the page is public). A draft, scheduled or archived row is never
 * selected and a deleted row is gone, so a listed URL is one the page renders. The page also answers not found for a slug
 * its route does not take (`isServableSlug`), so those are dropped here too. `run` is the database call
 * (`query` of lib/db in the route), injected so this module needs no connection to be tested.
 */

import { isServableSlug } from '../entities/public-item-slug'
import type { EntityConfig } from '../entities/types'
import { isSitemapEntity, type SitemapEntity, type SitemapRow } from './sitemap'

export const SITEMAP_MAX_URLS = 50_000
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/

export type RunQuery = (sql: string, params: unknown[]) => Promise<{ rows: SitemapRow[] }>

/** One row per slug (the same slug can exist in several locales), the latest edit as `updatedAt`, sorted so a cut is stable. */
export async function readPublishedEntries(config: EntityConfig, run: RunQuery, limit = SITEMAP_MAX_URLS): Promise<SitemapRow[]> {
  const table = config.tableName || config.slug
  if (!IDENTIFIER.test(table)) return []
  const { rows } = await run(
    `SELECT slug, MAX("updatedAt") AS "updatedAt" FROM "${table}" WHERE status = 'published' GROUP BY slug ORDER BY slug LIMIT $1`,
    [limit]
  )
  return rows.filter(row => isServableSlug(config, row.slug))
}

/**
 * The public entities among `configs` with their published rows. An entity that is not public (`isSitemapEntity`) is not
 * even queried; one whose read fails is left out and `failed` says so, so the others are still listed.
 */
export async function readEntities(configs: readonly EntityConfig[], run: RunQuery): Promise<{ entities: SitemapEntity[]; failed: boolean }> {
  const entities: SitemapEntity[] = []
  let failed = false
  for (const config of configs.filter(isSitemapEntity)) {
    try {
      entities.push({ config, rows: await readPublishedEntries(config, run) })
    } catch (error) {
      failed = true
      console.error(`[sitemap] could not read the published ${config.slug}:`, error)
    }
  }
  return { entities, failed }
}
