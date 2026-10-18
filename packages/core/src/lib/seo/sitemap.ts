/**
 * The sitemap of a project (#273): which URLs, with which hreflang alternates. Pure: it gets the already-read
 * entries and the configuration, so the visibility rules live where the entries are read
 * (routes/_internal/sitemap-entries.ts) and everything here is testable without a database.
 *
 * URL format. The app picks the language of a visitor from a cookie, the account and Accept-Language
 * (docs/11-internationalization/06-locale-switching.md), not from the URL: there is no `/es/...` prefix and every
 * locale is served at the same URL. So an entry is one `<url>` (not one per locale: a repeated `<loc>` is invalid)
 * and its `alternates.languages` name that same URL for every enabled locale plus `x-default`. `localizedUrl` is
 * the one place that would change if the app gains a locale prefix.
 */

import type { MetadataRoute } from 'next'
import { getEntityItemPath } from '../entities/schema-generator'
import type { EntityConfig } from '../entities/types'

/** What a project sets in nextspark.config.ts `sitemap` (validated by validateNextSparkConfig). */
export interface SitemapConfig {
  /** `false` removes /sitemap.xml and the `Sitemap:` line of robots.txt. Default `true`. */
  enabled?: boolean
  /** Extra paths (from the app root, without the base path) listed as they are, such as `/pricing`. */
  urls?: string[]
  /** Paths left out of the sitemap: an exact path, or a prefix ending in `*` (`/blog/draft-*`, `/legal/*`). */
  exclude?: string[]
}

/** A published row of a public entity. */
export interface SitemapRow {
  slug: string
  updatedAt?: Date | string | null
}

/** A public entity and its published rows. */
export interface SitemapEntity {
  config: EntityConfig
  rows: SitemapRow[]
}

export interface BuildSitemapInput extends Pick<SitemapConfig, 'urls' | 'exclude'> {
  /** `https://example.com`, no trailing slash. */
  origin: string
  /** The Next `basePath`, or ''. */
  basePath?: string
  /** The enabled locales, and the one `x-default` points at. */
  locales: readonly string[]
  defaultLocale: string
  /** Static public pages of the project (`/support`), found by the host at build time. */
  staticPaths?: readonly string[]
  entities?: readonly SitemapEntity[]
}

/** The URL a locale's visitors use for `path` (the same URL for every locale, see the module comment). */
export function localizedUrl(origin: string, basePath: string, path: string, _locale?: string): string {
  const prefixed = path === '/' ? basePath || '/' : `${basePath}${path}`
  return `${origin}${prefixed}`
}

/** True for `*`-suffixed prefixes and exact paths. */
export function isExcluded(path: string, exclude: readonly string[] = []): boolean {
  return exclude.some(pattern => (pattern.endsWith('*') ? path.startsWith(pattern.slice(0, -1)) : path === pattern))
}

const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/')

/** Next writes `<loc>` and `href` as they are given, so what goes into the XML is escaped here: a `&` in a path stays valid. */
const xml = (url: string) => url.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

function lastModified(value: SitemapRow['updatedAt']): Date | undefined {
  if (!value) return undefined
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

/** The public entity pages are served only for a builder entity with a base path; `access.public` must be explicit. */
export function isSitemapEntity(config: EntityConfig): boolean {
  return config.builder?.enabled === true && config.access?.public === true && getEntityItemPath(config, 'x') !== undefined
}

export function buildSitemap(input: BuildSitemapInput): MetadataRoute.Sitemap {
  const { origin, basePath = '', locales, defaultLocale, exclude } = input
  const found = new Map<string, Date | undefined>() // path -> lastmod; first one wins, in order

  const add = (path: string, lastmod?: Date) => {
    if (!path.startsWith('/') || isExcluded(path, exclude) || found.has(path)) return
    found.set(path, lastmod)
  }

  for (const path of input.staticPaths ?? []) add(path)
  for (const { config, rows } of input.entities ?? []) {
    if (!isSitemapEntity(config)) continue
    if (config.ui?.public?.hasArchivePage) {
      const archive = getEntityItemPath(config, '')
      if (archive && archive !== '/') add(archive.replace(/\/$/, ''))
    }
    for (const row of rows) add(encodePath(getEntityItemPath(config, row.slug)!), lastModified(row.updatedAt))
  }
  for (const path of input.urls ?? []) add(path)

  const alternates = (path: string) => {
    const url = (locale: string) => xml(localizedUrl(origin, basePath, path, locale))
    return {
      languages: {
        ...Object.fromEntries(locales.map(locale => [locale, url(locale)])),
        'x-default': url(defaultLocale),
      },
    }
  }
  return [...found].map(([path, lastmod]) => ({
    url: xml(localizedUrl(origin, basePath, path)),
    ...(lastmod ? { lastModified: lastmod } : {}),
    alternates: alternates(path),
  }))
}
