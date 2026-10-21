import type { MetadataRoute } from 'next'
import { withBasePath } from '@nextsparkjs/core/lib/base-path'
import { resolveAppUrl } from '@nextsparkjs/core/lib/utils/base-url'

/** Each area is blocked by itself (`/api$`), its subpaths (`/api/`) and its query URLs (`/api?`), so `/apiary` stays crawlable. */
const DISALLOWED = ['/dashboard', '/superadmin', '/devtools', '/api']

/**
 * The `robots()` of /robots.txt: public pages are crawlable, the authenticated areas and the API are not,
 * and the sitemap is advertised with its absolute URL, base path included (#273). The generated host composes the
 * route with `{ sitemap: false }` when nextspark.config.ts sets `sitemap.enabled: false`.
 */
export function createRobotsRoute({ sitemap = true }: { sitemap?: boolean } = {}) {
  return function robots(): MetadataRoute.Robots {
    const origin = resolveAppUrl().replace(/\/+$/, '')
    return {
      rules: {
        userAgent: '*',
        allow: withBasePath('/'),
        disallow: DISALLOWED.flatMap(path => ['$', '/', '?'].map(end => `${withBasePath(path)}${end}`)),
      },
      ...(sitemap ? { sitemap: `${origin}${withBasePath('/sitemap.xml')}` } : {}),
    }
  }
}
