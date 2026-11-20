/**
 * Published posts for the public pages, read on the server.
 *
 * Same rule as the public feed (`/api/posts/public`): status 'published' and a publishedAt that has come.
 * A slug is unique per author, not per site, so the newest post of that slug wins.
 */
import { cache } from 'react'
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

// cache(): generateMetadata and the page ask for the same post in one request
export const getPublishedPostBySlug = cache(async (slug: string): Promise<PublicPost | null> => {
  const rows = await queryWithRLS<PublicPost>(
    `SELECT id, title, slug, content, excerpt, "featuredImage", category, "publishedAt"
     FROM posts
     WHERE slug = $1 AND status = 'published' AND "publishedAt" <= NOW()
     ORDER BY "publishedAt" DESC
     LIMIT 1`,
    [slug],
  )
  return rows[0] ?? null
})

/** The latest published posts other than `postId`. */
export async function getRelatedPosts(postId: string, limit = 3): Promise<RelatedPost[]> {
  return queryWithRLS<RelatedPost>(
    `SELECT id, title, slug, "featuredImage", content
     FROM posts
     WHERE status = 'published' AND "publishedAt" <= NOW() AND id <> $1
     ORDER BY "publishedAt" DESC
     LIMIT $2`,
    [postId, limit],
  )
}
