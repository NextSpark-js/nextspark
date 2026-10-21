/**
 * /sitemap.xml (#273): the project's public pages and the published entries of its public entities, once per
 * URL (lib/seo/sitemap.ts builds the document).
 *
 * The generated host composes `src/app/sitemap.ts` from this factory with the project's `sitemap` settings
 * (nextspark.config.ts) and the static public pages it found as literals; core's own `routes/sitemap.ts` is the
 * same route without them.
 *
 * Visibility. An entry is listed exactly when the public item page would render it, no more:
 * - the entity is a builder entity with a base path, and the sitemap requires `access.public: true`; its rows are read
 *   through the service connection like `fetchPublishedItem`;
 * - the row is `status = 'published'`: drafts, scheduled and archived rows are never selected, a deleted row is gone;
 * - its slug is one the route answers (`ITEM_SLUG`, not a static-file name, no `/` without `allowNestedSlugs`).
 *
 * Caching. Both rendering modes use the same in-process cache: the sitemap is built at most once an hour per
 * server process (a failed read only for a minute), concurrent requests share one build, and a refresh that fails
 * keeps serving the last good document (a read that comes back `failed` included). `connection()` opens the
 * function, so neither mode reads the database at build; `revalidate` / `'use cache'` are not used. # ponytail: per-process cache, so N instances query
 * N times an hour; move to `'use cache'` + cacheLife when Cache Components is the only mode.
 *
 * Size. One sitemap holds 50,000 URLs (the protocol's ceiling). Past it the list is cut (entries sorted by slug,
 * so the cut is stable) and a warning is logged. # ponytail: one document up to 50,000 URLs; beyond that switch
 * to Next's `generateSitemaps` (a sitemap index) and page `readPublishedEntries` with OFFSET.
 */

import type { MetadataRoute } from 'next'
import { connection } from 'next/server'
import { ENTITY_REGISTRY } from '@nextsparkjs/registries/entity-registry'
import { query } from '@nextsparkjs/core/lib/db'
import type { EntityConfig } from '@nextsparkjs/core/lib/entities/types'
import { buildSitemap, type SitemapConfig } from '@nextsparkjs/core/lib/seo/sitemap'
import { readEntities, SITEMAP_MAX_URLS } from '@nextsparkjs/core/lib/seo/sitemap-entries'
import { resolveAppUrl } from '@nextsparkjs/core/lib/utils/base-url'

const FRESH_MS = 60 * 60 * 1000
const RETRY_MS = 60 * 1000

export interface SitemapRouteOptions extends Pick<SitemapConfig, 'urls' | 'exclude'> {
  /** Static public pages of the project, found by the host. */
  staticPaths?: string[]
}

/** The entities of the project and its plugins; core's own are never read. */
export function projectEntities(): EntityConfig[] {
  return Object.values(ENTITY_REGISTRY)
    .filter(entry => entry.source !== 'core')
    .map(entry => entry.config as unknown as EntityConfig)
}

/** The sitemap, read now. `failed` is true when an entity could not be read (its entries are missing). */
export async function readSitemap(options: SitemapRouteOptions): Promise<{ sitemap: MetadataRoute.Sitemap; failed: boolean }> {
  const { entities, failed } = await readEntities(projectEntities(), query)
  const sitemap = buildSitemap({
    origin: resolveAppUrl().replace(/\/+$/, ''),
    basePath: (process.env.__NEXT_ROUTER_BASEPATH || '').replace(/\/+$/, ''),
    staticPaths: options.staticPaths,
    entities,
    urls: options.urls,
    exclude: options.exclude,
  })
  if (sitemap.length > SITEMAP_MAX_URLS) {
    console.warn(`[sitemap] ${sitemap.length} URLs: only the first ${SITEMAP_MAX_URLS} are listed (one sitemap file's limit)`)
    sitemap.length = SITEMAP_MAX_URLS
  }
  return { sitemap, failed }
}

/** The `sitemap()` of the route: `read` is injectable for tests. */
export function createSitemapRoute(options: SitemapRouteOptions = {}, read = readSitemap, now = Date.now) {
  let current: { sitemap: MetadataRoute.Sitemap; until: number } | undefined
  let inflight: Promise<MetadataRoute.Sitemap> | undefined

  const refresh = async () => {
    try {
      const { sitemap, failed } = await read(options)
      // a partial read (an entity could not be read) never replaces a good document
      current = failed && current ? { sitemap: current.sitemap, until: now() + RETRY_MS } : { sitemap, until: now() + (failed ? RETRY_MS : FRESH_MS) }
    } catch (error) {
      console.error('[sitemap] refresh failed:', error)
      if (!current) throw error
      current = { sitemap: current.sitemap, until: now() + RETRY_MS } // keep the last good document
    }
    return current.sitemap
  }

  return async function sitemap(): Promise<MetadataRoute.Sitemap> {
    // Request time only, before any I/O: a build (either mode) renders nothing here and opens no connection.
    await connection()
    if (current && now() < current.until) return current.sitemap
    inflight ??= refresh().finally(() => {
      inflight = undefined
    })
    return inflight
  }
}
