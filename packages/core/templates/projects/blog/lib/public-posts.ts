/**
 * Published posts for the public pages, read on the server.
 *
 * Same rule as the public feed (`/api/posts/public`): status 'published' and a publishedAt that has come.
 * A slug is unique per author, not per site, so the newest post of that slug wins.
 *
 * Both reads are `'use cache'` (the project has Cache Components on), so a visit does not query the database and the
 * post page is prerendered around them instead of being blocked by an uncached read (#493). Lifetime as core's public
 * item pages: regenerated an hour after it was filled, 5 minutes in the browser's router cache, gone after a day
 * without a visit. Tag `entity:posts`: core expires it on every write of a post (create, edit, publish, delete), so
 * an edit shows at once. A post scheduled for later appears in the related list within that hour; its own page is
 * not cached before it is published (the request hook answers 404 until then).
 */
import { cacheLife, cacheTag } from 'next/cache'
import { queryWithRLS } from '@nextsparkjs/core/lib/db'

export interface PublicPost {
  id: string
  title: string
  slug: string
  content: string
  excerpt: string | null
  featuredImage: string | null
  category: string | null
  publishedAt: Date | string | null // pg returns a Date
}

export interface RelatedPost {
  id: string
  title: string
  slug: string
  featuredImage: string | null
  content: string | null
}

const POSTS_TAG = 'entity:posts'
const MAX_SLUG_LENGTH = 200
const MAX_RELATED = 12

// A 'use cache' function is a server reference: its arguments are the cache key, so they are checked before anything else.
export async function getPublishedPostBySlug(slug: string): Promise<PublicPost | null> {
  'use cache'
  cacheLife({ stale: 300, revalidate: 3600, expire: 86400 })
  cacheTag(POSTS_TAG)
  if (typeof slug !== 'string' || slug.length === 0 || slug.length > MAX_SLUG_LENGTH) return null

  const rows = await queryWithRLS<PublicPost>(
    `SELECT id, title, slug, content, excerpt, "featuredImage", category, "publishedAt"
     FROM posts
     WHERE slug = $1 AND status = 'published' AND "publishedAt" <= NOW()
     ORDER BY "publishedAt" DESC
     LIMIT 1`,
    [slug],
  )
  return rows[0] ?? null
}

/** The latest published posts other than `postId`. */
export async function getRelatedPosts(postId: string, limit = 3): Promise<RelatedPost[]> {
  'use cache'
  cacheLife({ stale: 300, revalidate: 3600, expire: 86400 })
  cacheTag(POSTS_TAG)
  if (typeof postId !== 'string' || postId.length > MAX_SLUG_LENGTH || !Number.isInteger(limit) || limit < 1 || limit > MAX_RELATED) return []

  return queryWithRLS<RelatedPost>(
    `SELECT id, title, slug, "featuredImage", content
     FROM posts
     WHERE status = 'published' AND "publishedAt" <= NOW() AND id <> $1
     ORDER BY "publishedAt" DESC
     LIMIT $2`,
    [postId, limit],
  )
}
