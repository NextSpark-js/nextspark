import type { MetadataRoute } from 'next'
import { withBasePath } from '@nextsparkjs/core/lib/base-path'

/**
 * /robots.txt (#214): public pages are crawlable, the authenticated areas and the API are not.
 *
 * Answers `text/plain` 200 in Cache Components and legacy ISR alike, so a crawler never gets the public
 * catch-all page's HTML. A project overrides it with its own `robots.ts` (templates/robots.ts), which
 * replaces this route. Core has no sitemap, so none is declared.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: withBasePath('/'),
      disallow: ['/dashboard', '/superadmin', '/devtools', '/api'].map(withBasePath),
    },
  }
}
