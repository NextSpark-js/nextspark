/**
 * Metadata of a public page: title, description, the canonical link and the Open Graph tags that repeat them (#365).
 *
 * `path` is the page's own path ("/support"); Next resolves it against the layout's `metadataBase` (the app URL, see
 * the public layout), so the canonical and `og:url` are absolute. The `openGraph` key of a page replaces the
 * layout's whole object, so the defaults (`type`, `siteName`) are repeated here.
 */
import type { Metadata } from 'next'
import { APP_NAME } from '@nextsparkjs/core/lib/config/public-config-client'

export function pageMetadata({ title, description, path }: { title: string; description: string; path: string }): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: 'website', siteName: APP_NAME, title, description, url: path },
  }
}
