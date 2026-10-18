import type { MetadataRoute } from 'next'
import { withBasePath } from '@nextsparkjs/core/lib/base-path'

/**
 * The `robots()` of /robots.txt: public pages are crawlable, the authenticated areas and the API are not,
 * and the sitemap is advertised with its absolute URL, base path included (#273). The generated host composes the
 * route with `{ sitemap: false }` when nextspark.config.ts sets `sitemap.enabled: false`.
 */
export function createRobotsRoute({ sitemap = true }: { sitemap?: boolean } = {}) {
  return function robots(): MetadataRoute.Robots {
    const origin = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')
    return {
      rules: {
        userAgent: '*',
        allow: withBasePath('/'),
        disallow: ['/dashboard', '/superadmin', '/devtools', '/api'].map(withBasePath),
      },
      ...(sitemap ? { sitemap: `${origin}${withBasePath('/sitemap.xml')}` } : {}),
    }
  }
}
