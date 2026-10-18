/**
 * Sitemap and robots of the generated host (#273)
 *
 * core ships `sitemap.ts` and `robots.ts` routes (src/routes). The host replaces them with a composed facade that
 * calls core's factory with literals, because only the host knows two things at build time:
 *
 * - the project's static public pages: the `(public)` pages of its templates and plugins whose URL has no dynamic
 *   segment (`templates/(public)/support/page.tsx` -> `/support`). Core's own public pages are not listed: its home
 *   redirects to the dashboard until a template replaces it, and the docs are not the project's content.
 * - nextspark.config.ts `sitemap`: `enabled`, extra `urls` and `exclude` patterns (validated by
 *   validateNextSparkConfig).
 *
 * ```ts
 * // Generated: src/app/sitemap.ts
 * import { createSitemapRoute } from "@nextsparkjs/core/routes/_internal/sitemap-route"
 * export default createSitemapRoute({"staticPaths":["/support"],"urls":["/pricing"],"exclude":["/legal/*"]})
 * ```
 *
 * A project's own `templates/sitemap.ts` or `templates/robots.ts` wins over the composed route. With
 * `sitemap.enabled: false` there is no sitemap route and robots is composed without the `Sitemap:` line.
 *
 * @module core/scripts/build/registry/host/sitemap
 */

import { CORE_ROUTES_SPECIFIER } from './core-routes.mjs'

const SITEMAP_MODULE = `${CORE_ROUTES_SPECIFIER}_internal/sitemap-route`
const ROBOTS_MODULE = `${CORE_ROUTES_SPECIFIER}_internal/robots-route`

/**
 * @param {object} input
 * @param {{ enabled?: boolean, urls?: string[], exclude?: string[] }|undefined} input.sitemap - nextspark.config.ts `sitemap`
 * @param {(specifier: string) => string|null} input.resolveFile - core module specifier -> file
 * @param {boolean} [input.cacheComponents] - the host's setting
 * @param {string[]} [input.modes] - cache modes the host serves (a host that builds both omits `dynamic`)
 */
export function sitemapPlan({ sitemap, resolveFile, cacheComponents, modes = [] }) {
  const factory = (name, specifier) => ({ name, specifier, file: resolveFile(specifier) })
  return {
    enabled: sitemap?.enabled !== false,
    // The route reads the database, so a legacy host must not freeze the document at build time (and a build
    // with no database would freeze a partial one): it answers on request, behind the route's own hour-long cache.
    // Cache Components rejects the setting, and serves the route on request because it reads uncached data.
    dynamic: cacheComponents !== true && !modes.includes('cc'),
    urls: sitemap?.urls ?? [],
    exclude: sitemap?.exclude ?? [],
    sitemapFactory: factory('createSitemapRoute', SITEMAP_MODULE),
    robotsFactory: factory('createRobotsRoute', ROBOTS_MODULE),
  }
}

/** The URL of a `(public)` page with only static segments (`/`, `/support`), or null. `origin` is the route's layer. */
function staticPublicPath(route) {
  if (route.kind !== 'page' || route.origin === 'core') return null
  const parts = route.target.split('/')
  if (parts[0] !== '(public)') return null
  const segments = parts.slice(1, -1).filter(part => !/^\(.*\)$/.test(part))
  if (segments.some(part => /[[@(]/.test(part))) return null
  return `/${segments.join('/')}`
}

const composed = (route, source, factory, args, literals = []) => ({
  ...route,
  specifier: null,
  file: null,
  generated: true,
  source,
  entityRoute: { name: route.kind, exportName: route.kind, source, reexport: [], named: [], literals, default: { factory, args } },
})

/**
 * The routes with the sitemap applied. Only core's own `sitemap.ts` / `robots.ts` are replaced (`origin: 'core'`): a
 * project or plugin file at that path is left as it is.
 *
 * @param {object[]} routes - the resolved plan (`origin` is the layer that won)
 * @param {ReturnType<typeof sitemapPlan>|undefined} plan
 */
export function applySitemap(routes, plan) {
  if (!plan) return routes
  const source = 'nextspark.config.ts sitemap'
  const staticPaths = [...new Set(routes.map(staticPublicPath).filter(path => path !== null))].sort()
  const out = []
  for (const route of routes) {
    const core = route.origin === 'core'
    if (core && route.kind === 'sitemap' && route.target === 'sitemap.ts') {
      if (plan.enabled) out.push(composed(route, source, plan.sitemapFactory, [{ literal: { staticPaths, urls: plan.urls, exclude: plan.exclude } }], plan.dynamic ? [{ name: 'dynamic', value: 'force-dynamic' }] : []))
    } else if (core && route.kind === 'robots' && route.target === 'robots.ts' && !plan.enabled) {
      out.push(composed(route, source, plan.robotsFactory, [{ literal: { sitemap: false } }]))
    } else {
      out.push(route)
    }
  }
  return out
}
