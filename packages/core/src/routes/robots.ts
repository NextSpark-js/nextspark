import { createRobotsRoute } from './_internal/robots-route'

/**
 * /robots.txt (#214): public pages are crawlable, the authenticated areas, the auth pages and the API are not, and
 * the sitemap (#273) is advertised.
 *
 * Answers `text/plain` 200 in Cache Components and legacy ISR alike, so a crawler never gets the public
 * catch-all page's HTML. A project overrides it with its own `robots.ts` (templates/robots.ts), which
 * replaces this route. With `sitemap.enabled: false` in nextspark.config.ts the host composes it without the sitemap line.
 */
export default createRobotsRoute()
