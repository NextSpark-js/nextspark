/**
 * Metadata of a public page: title, description, the canonical link and the Open Graph tags that repeat them (#365).
 *
 * `path` is the page's own path ("/support"), written without the Next basePath; the canonical and `og:url` are the
 * absolute URL the sitemap lists for it. The `openGraph` key of a page replaces the
 * layout's whole object, so the defaults (`type`, `siteName`) are repeated here.
 */
import type { Metadata } from 'next'
import { APP_NAME } from '@nextsparkjs/core/lib/config/public-config-client'
import { withBasePath } from '@nextsparkjs/core/lib/base-path'
import { resolveAppUrl } from '@nextsparkjs/core/lib/utils/base-url'

export function pageMetadata({ title, description, path }: { title: string; description: string; path: string }): Metadata {
  // Absolute like the sitemap's <loc> (app URL + basePath + path), so it holds under a Next basePath and when a project's
  // layout declares no metadataBase
  const url = `${resolveAppUrl().replace(/\/+$/, '')}${withBasePath(path)}`
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'website', siteName: APP_NAME, title, description, url },
  }
}
