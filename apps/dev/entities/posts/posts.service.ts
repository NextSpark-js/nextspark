/**
 * Posts Service
 *
 * Provides data access methods for posts, separating public queries
 * (without RLS) from authenticated queries (with RLS).
 *
 * @module PostsService
 */

import { query, queryOne, queryOneWithRLS } from '@nextsparkjs/core/lib/db'
import type {
  PostPublic,
  PostMetadata,
  PostListOptions,
  PostListResult,
  Block,
  PostCategory,
} from './posts.types'

// Database row type for post with categories
interface DbPostWithCategories {
  id: string
  slug: string
  title: string
  excerpt: string | null
  featuredImage: string | null
  blocks: Block[]
  status: string
  createdAt: string
  categories: PostCategory[]
}

// Database row type for metadata query
interface DbPostMetadata {
  title: string
  excerpt: string | null
  seoTitle: string | null
  seoDescription: string | null
  ogImage: string | null
  featuredImage: string | null
}

export class PostsService {
  // ============================================
  // PUBLIC METHODS (sin RLS)
  // ============================================

  /**
   * Get a published post by slug with categories
   *
   * Fetches the full post data including blocks and taxonomy relations.
   * Only returns published posts.
   *
   * @param slug - Post slug
   * @returns Post data or null if not found/not published
   *
   * @example
   * const post = await PostsService.getPublishedBySlug('my-post-slug')
   * if (!post) notFound()
   */
  static async getPublishedBySlug(slug: string): Promise<PostPublic | null> {
    try {
      if (!slug || slug.trim() === '') {
        throw new Error('Post slug is required')
      }

      const post = await queryOne<DbPostWithCategories>(
        `
        SELECT
          p.id,
          p.slug,
          p.title,
          p.excerpt,
          p."featuredImage",
          p.blocks,
          p.status,
          p."createdAt",
          COALESCE(
            json_agg(
              json_build_object(
                'id', t.id,
                'name', t.name,
                'slug', t.slug,
                'color', t.color
              )
            ) FILTER (WHERE t.id IS NOT NULL),
            '[]'::json
          ) as categories
        FROM posts p
        LEFT JOIN entity_taxonomy_relations etr ON p.id::text = etr."entityId" AND etr."entityType" = 'posts'
        LEFT JOIN taxonomies t ON etr."taxonomyId" = t.id AND t."isActive" = true AND t."deletedAt" IS NULL
        WHERE p.slug = $1 AND p.status = 'published'
        GROUP BY p.id, p.slug, p.title, p.excerpt, p."featuredImage", p.blocks, p.status, p."createdAt"
        `,
        [slug]
      )

      if (!post) {
        return null
      }

      return {
        id: post.id,
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt ?? undefined,
        featuredImage: post.featuredImage ?? undefined,
        blocks: post.blocks,
        createdAt: post.createdAt,
        categories: post.categories,
      }
    } catch (error) {
      console.error('PostsService.getPublishedBySlug error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to fetch post'
      )
    }
  }

  /**
   * Get post metadata for SEO/head tags
   *
   * Lightweight query that only fetches SEO-related fields.
   * Used in generateMetadata for better performance.
   *
   * @param slug - Post slug
   * @returns Metadata or null if not found/not published
   *
   * @example
   * const metadata = await PostsService.getPublishedMetadata('my-post')
   * return { title: metadata?.seoTitle || metadata?.title }
   */
  static async getPublishedMetadata(slug: string): Promise<PostMetadata | null> {
    try {
      if (!slug || slug.trim() === '') {
        throw new Error('Post slug is required')
      }

      const result = await query<DbPostMetadata>(
        `
        SELECT
          title,
          excerpt,
          "seoTitle",
          "seoDescription",
          "ogImage",
          "featuredImage"
        FROM posts
        WHERE slug = $1 AND status = 'published'
        `,
        [slug]
      )

      if (result.rows.length === 0) {
        return null
      }

      const post = result.rows[0]

      return {
        title: post.title,
        excerpt: post.excerpt ?? undefined,
        seoTitle: post.seoTitle ?? undefined,
        seoDescription: post.seoDescription ?? undefined,
        ogImage: post.ogImage ?? undefined,
        featuredImage: post.featuredImage ?? undefined,
      }
    } catch (error) {
      console.error('PostsService.getPublishedMetadata error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to fetch post metadata'
      )
    }
  }

  /**
   * List published posts with pagination and filtering
   *
   * Used for archive pages like /blog.
   *
   * @param options - List options (limit, offset, categorySlug, orderBy, orderDir)
   * @returns Object with posts array and total count
   *
   * @example
   * const { posts, total } = await PostsService.listPublished({
   *   limit: 10,
   *   offset: 0,
   *   categorySlug: 'news'
   * })
   */
  static async listPublished(
    options: PostListOptions = {}
  ): Promise<PostListResult> {
    try {
      const {
        limit = 10,
        offset = 0,
        categorySlug,
        orderBy = 'createdAt',
        orderDir = 'desc',
      } = options

      // Build WHERE clause
      const conditions = ['p.status = $1']
      const params: unknown[] = ['published']
      let paramIndex = 2

      // Category filter with subquery
      if (categorySlug) {
        conditions.push(`
          EXISTS (
            SELECT 1 FROM entity_taxonomy_relations etr
            JOIN taxonomies t ON etr."taxonomyId" = t.id
            WHERE etr."entityId" = p.id::text
              AND etr."entityType" = 'posts'
              AND t.slug = $${paramIndex}
              AND t."isActive" = true
              AND t."deletedAt" IS NULL
          )
        `)
        params.push(categorySlug)
        paramIndex++
      }

      const whereClause = conditions.join(' AND ')

      // Validate orderBy to prevent SQL injection
      const validOrderBy = ['createdAt', 'title'].includes(orderBy) ? orderBy : 'createdAt'
      const validOrderDir = orderDir === 'asc' ? 'ASC' : 'DESC'
      const orderColumn = validOrderBy === 'createdAt' ? '"createdAt"' : 'title'

      // Get total count
      const countResult = await query<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM posts p WHERE ${whereClause}`,
        params
      )
      const total = parseInt(countResult.rows[0]?.count || '0', 10)

      // Get posts with categories
      params.push(limit, offset)
      const postsResult = await query<DbPostWithCategories>(
        `
        SELECT
          p.id,
          p.slug,
          p.title,
          p.excerpt,
          p."featuredImage",
          p.blocks,
          p.status,
          p."createdAt",
          COALESCE(
            json_agg(
              json_build_object(
                'id', t.id,
                'name', t.name,
                'slug', t.slug,
                'color', t.color
              )
            ) FILTER (WHERE t.id IS NOT NULL),
            '[]'::json
          ) as categories
        FROM posts p
        LEFT JOIN entity_taxonomy_relations etr ON p.id::text = etr."entityId" AND etr."entityType" = 'posts'
        LEFT JOIN taxonomies t ON etr."taxonomyId" = t.id AND t."isActive" = true AND t."deletedAt" IS NULL
        WHERE ${whereClause}
        GROUP BY p.id, p.slug, p.title, p.excerpt, p."featuredImage", p.blocks, p.status, p."createdAt"
        ORDER BY p.${orderColumn} ${validOrderDir}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `,
        params
      )

      const posts: PostPublic[] = postsResult.rows.map((post) => ({
        id: post.id,
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt ?? undefined,
        featuredImage: post.featuredImage ?? undefined,
        blocks: post.blocks,
        createdAt: post.createdAt,
        categories: post.categories,
      }))

      return { posts, total }
    } catch (error) {
      console.error('PostsService.listPublished error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to list posts'
      )
    }
  }

  // ============================================
  // AUTHENTICATED METHODS (con RLS)
  // ============================================

  /**
   * Get a post by ID (authenticated)
   *
   * For dashboard/admin views. Respects RLS policies.
   *
   * @param id - Post ID
   * @param userId - Current user ID for RLS
   * @returns Post data or null if not found/not authorized
   *
   * @example
   * const post = await PostsService.getById('post-uuid', currentUserId)
   */
  static async getById(
    id: string,
    userId: string
  ): Promise<PostPublic | null> {
    try {
      if (!id || id.trim() === '') {
        throw new Error('Post ID is required')
      }

      if (!userId || userId.trim() === '') {
        throw new Error('User ID is required for authentication')
      }

      const post = await queryOneWithRLS<DbPostWithCategories>(
        `
        SELECT
          p.id,
          p.slug,
          p.title,
          p.excerpt,
          p."featuredImage",
          p.blocks,
          p.status,
          p."createdAt",
          COALESCE(
            json_agg(
              json_build_object(
                'id', t.id,
                'name', t.name,
                'slug', t.slug,
                'color', t.color
              )
            ) FILTER (WHERE t.id IS NOT NULL),
            '[]'::json
          ) as categories
        FROM posts p
        LEFT JOIN entity_taxonomy_relations etr ON p.id::text = etr."entityId" AND etr."entityType" = 'posts'
        LEFT JOIN taxonomies t ON etr."taxonomyId" = t.id AND t."isActive" = true AND t."deletedAt" IS NULL
        WHERE p.id = $1
        GROUP BY p.id, p.slug, p.title, p.excerpt, p."featuredImage", p.blocks, p.status, p."createdAt"
        `,
        [id],
        userId
      )

      if (!post) {
        return null
      }

      return {
        id: post.id,
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt ?? undefined,
        featuredImage: post.featuredImage ?? undefined,
        blocks: post.blocks,
        createdAt: post.createdAt,
        categories: post.categories,
      }
    } catch (error) {
      console.error('PostsService.getById error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to fetch post'
      )
    }
  }
}
