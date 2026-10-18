import { createSitemapRoute } from './_internal/sitemap-route'

/**
 * /sitemap.xml (#273): the published entries of the public entities.
 *
 * Answers `application/xml` 200 in Cache Components and legacy ISR alike. The generated host replaces this module
 * with `createSitemapRoute` composed with the project's `sitemap` settings and static public pages; a project's own
 * `sitemap.ts` (templates/sitemap.ts) replaces the route altogether. See docs/23-search-engine-optimization.
 */
export default createSitemapRoute()
