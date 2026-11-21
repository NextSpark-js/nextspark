/**
 * Request hook (core's proxy runs it before its own checks).
 *
 * `/posts/<slug>` of a post that is not published answers 404, and `/posts/<id>` of a published post redirects to its slug. With Cache Components the page cannot do it: the
 * response status is sent before the page reads the slug, so its notFound() would reach the browser as a 200 with the
 * not-found page. Rewriting to a path no route matches gives the not-found page with a real 404
 * (see docs/18-page-builder/07-public-rendering.md).
 */
import { NextResponse, type NextRequest } from 'next/server'
import { NOT_FOUND_REWRITE } from '@nextsparkjs/registries/root-files'
import { queryWithRLS } from '@nextsparkjs/core/lib/db'

const POST_URL = /^\/posts\/([^/]+)\/?$/

/**
 * The slug of the published post `/posts/<segment>` names: the segment itself, or a post id (the archive's cards link
 * items by id, #540). Null when no published post has that slug or id.
 */
async function publishedPostSlug(segment: string): Promise<string | null> {
  const rows = await queryWithRLS<{ slug: string }>(
    `SELECT slug FROM posts
     WHERE (slug = $1 OR id = $1) AND status = 'published' AND "publishedAt" <= NOW()
     ORDER BY (slug = $1) DESC
     LIMIT 1`,
    [segment],
  )
  return rows[0]?.slug ?? null
}

export async function proxyHook(request: NextRequest) {
  const match = POST_URL.exec(request.nextUrl.pathname)
  if (!match) return null

  try {
    const segment = decodeURIComponent(match[1])
    const slug = await publishedPostSlug(segment)
    if (slug === segment) return null
    if (slug) {
      // A post linked by its id: the address of its page is its slug
      const url = request.nextUrl.clone()
      url.pathname = `/posts/${encodeURIComponent(slug)}`
      return NextResponse.redirect(url, 308)
    }
  } catch (error) {
    // A malformed escape is a slug no post has; a failed read leaves the answer to the page
    if (!(error instanceof URIError)) {
      console.error('[proxyHook] reading the post failed', error)
      return null
    }
  }

  const url = request.nextUrl.clone()
  url.pathname = NOT_FOUND_REWRITE.path
  return NextResponse.rewrite(url)
}
