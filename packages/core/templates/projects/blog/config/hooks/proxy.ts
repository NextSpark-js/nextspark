/**
 * Request hook (core's proxy runs it before its own checks).
 *
 * `/posts/<slug>` of a post that is not published answers 404. With Cache Components the page cannot do it: the
 * response status is sent before the page reads the slug, so its notFound() would reach the browser as a 200 with the
 * not-found page. Rewriting to a path no route matches gives the not-found page with a real 404
 * (see docs/18-page-builder/07-public-rendering.md).
 */
import { NextResponse, type NextRequest } from 'next/server'
import { NOT_FOUND_REWRITE } from '@nextsparkjs/registries/root-files'
import { queryWithRLS } from '@nextsparkjs/core/lib/db'

const POST_URL = /^\/posts\/([^/]+)\/?$/

async function isPublishedSlug(slug: string): Promise<boolean> {
  const rows = await queryWithRLS<{ found: number }>(
    `SELECT 1 AS found FROM posts WHERE slug = $1 AND status = 'published' AND "publishedAt" <= NOW() LIMIT 1`,
    [slug],
  )
  return rows.length > 0
}

export async function proxyHook(request: NextRequest) {
  const match = POST_URL.exec(request.nextUrl.pathname)
  if (!match) return null

  try {
    if (await isPublishedSlug(decodeURIComponent(match[1]))) return null
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
