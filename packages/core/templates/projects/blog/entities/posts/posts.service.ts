/**
 * Posts Service
 *
 * Provides data access methods for blog posts.
 * Posts is a private entity - users only see posts in their team.
 *
 * All methods require authentication (use RLS with userId filter).
 *
 * @module PostsService
 */

import { queryOneWithRLS, queryWithRLS, mutateWithRLS } from '@nextsparkjs/core/lib/db'

// Post status type
export type PostStatus = 'draft' | 'published' | 'scheduled'

// Post interface
export interface Post {
  id: string
  title: string
  slug: string
  excerpt?: string
  content: string
  featuredImage?: string
  featured?: boolean
  status: PostStatus
  publishedAt?: string
  createdAt: string
  updatedAt: string
}

// List options
export interface PostListOptions {
  limit?: number
  offset?: number
  status?: PostStatus
  featured?: boolean
  orderBy?: 'title' | 'publishedAt' | 'createdAt' | 'updatedAt'
  orderDir?: 'asc' | 'desc'
  teamId?: string
}

// List result
export interface PostListResult {
  posts: Post[]
  total: number
}

// Create data
export interface PostCreateData {
  title: string
  slug: string
  excerpt?: string
  content: string
  featuredImage?: string
  featured?: boolean
  status?: PostStatus
  publishedAt?: string
  teamId: string
}

// Update data
export interface PostUpdateData {
  title?: string
  slug?: string
  excerpt?: string
  content?: string
  featuredImage?: string
  featured?: boolean
  status?: PostStatus
  publishedAt?: string
}

// Database row type
interface DbPost {
  id: string
  title: string
  slug: string
  excerpt: string | null
  content: string
  featuredImage: string | null
  featured: boolean | null
  status: PostStatus
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export class PostsService {
  // ============================================
  // READ METHODS
  // ============================================

  /**
   * Get a post by ID
   */
  static async getById(id: string, userId: string): Promise<Post | null> {
    try {
      if (!id?.trim()) throw new Error('Post ID is required')
      if (!userId?.trim()) throw new Error('User ID is required')

      const post = await queryOneWithRLS<DbPost>(
        `SELECT id, title, slug, excerpt, content, "featuredImage", featured, status, "publishedAt", "createdAt", "updatedAt"
         FROM posts WHERE id = $1`,
        [id],
        userId
      )

      if (!post) return null

      return {
        id: post.id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt ?? undefined,
        content: post.content,
        featuredImage: post.featuredImage ?? undefined,
        featured: post.featured ?? undefined,
        status: post.status,
        publishedAt: post.publishedAt ?? undefined,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
      }
    } catch (error) {
      console.error('PostsService.getById error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch post')
    }
  }

  /**
   * Get a post by slug
   */
  static async getBySlug(slug: string, userId: string): Promise<Post | null> {
    try {
      if (!slug?.trim()) throw new Error('Slug is required')
      if (!userId?.trim()) throw new Error('User ID is required')

      const post = await queryOneWithRLS<DbPost>(
        `SELECT id, title, slug, excerpt, content, "featuredImage", featured, status, "publishedAt", "createdAt", "updatedAt"
         FROM posts WHERE slug = $1`,
        [slug],
        userId
      )

      if (!post) return null

      return {
        id: post.id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt ?? undefined,
        content: post.content,
        featuredImage: post.featuredImage ?? undefined,
        featured: post.featured ?? undefined,
        status: post.status,
        publishedAt: post.publishedAt ?? undefined,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
      }
    } catch (error) {
      console.error('PostsService.getBySlug error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch post')
    }
  }

  /**
   * List posts with pagination and filtering
   */
  static async list(userId: string, options: PostListOptions = {}): Promise<PostListResult> {
    try {
      if (!userId?.trim()) throw new Error('User ID is required')

      const {
        limit = 10,
        offset = 0,
        status,
        featured,
        orderBy = 'createdAt',
        orderDir = 'desc',
        teamId,
      } = options

      // Build WHERE clause
      const conditions: string[] = []
      const params: unknown[] = []
      let paramIndex = 1

      if (status) {
        conditions.push(`status = $${paramIndex++}`)
        params.push(status)
      }

      if (featured !== undefined) {
        conditions.push(`featured = $${paramIndex++}`)
        params.push(featured)
      }

      if (teamId) {
        conditions.push(`"teamId" = $${paramIndex++}`)
        params.push(teamId)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      // Validate orderBy
      const validOrderBy = ['title', 'publishedAt', 'createdAt', 'updatedAt'].includes(orderBy) ? orderBy : 'createdAt'
      const validOrderDir = orderDir === 'asc' ? 'ASC' : 'DESC'
      const orderColumnMap: Record<string, string> = {
        title: 'title',
        publishedAt: '"publishedAt"',
        createdAt: '"createdAt"',
        updatedAt: '"updatedAt"',
      }
      const orderColumn = orderColumnMap[validOrderBy] || '"createdAt"'

      // Get total count
      const countResult = await queryWithRLS<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM posts ${whereClause}`,
        params,
        userId
      )
      const total = parseInt(countResult[0]?.count || '0', 10)

      // Get posts
      params.push(limit, offset)
      const posts = await queryWithRLS<DbPost>(
        `SELECT id, title, slug, excerpt, content, "featuredImage", featured, status, "publishedAt", "createdAt", "updatedAt"
         FROM posts ${whereClause}
         ORDER BY ${orderColumn} ${validOrderDir}
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        params,
        userId
      )

      return {
        posts: posts.map((post) => ({
          id: post.id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt ?? undefined,
          content: post.content,
          featuredImage: post.featuredImage ?? undefined,
          featured: post.featured ?? undefined,
          status: post.status,
          publishedAt: post.publishedAt ?? undefined,
          createdAt: post.createdAt,
          updatedAt: post.updatedAt,
        })),
        total,
      }
    } catch (error) {
      console.error('PostsService.list error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to list posts')
    }
  }

  /**
   * Get published posts (for public display)
   */
  static async getPublished(userId: string, limit = 10, offset = 0): Promise<PostListResult> {
    return this.list(userId, {
      status: 'published',
      limit,
      offset,
      orderBy: 'publishedAt',
      orderDir: 'desc',
    })
  }

  /**
   * Get featured posts
   */
  static async getFeatured(userId: string, limit = 5): Promise<Post[]> {
    const { posts } = await this.list(userId, {
      status: 'published',
      featured: true,
      limit,
      orderBy: 'publishedAt',
      orderDir: 'desc',
    })
    return posts
  }

  // ============================================
  // WRITE METHODS
  // ============================================

  /**
   * Create a new post
   */
  static async create(userId: string, data: PostCreateData): Promise<Post> {
    try {
      if (!userId?.trim()) throw new Error('User ID is required')
      if (!data.title?.trim()) throw new Error('Title is required')
      if (!data.slug?.trim()) throw new Error('Slug is required')
      if (!data.content?.trim()) throw new Error('Content is required')
      if (!data.teamId?.trim()) throw new Error('Team ID is required')

      const id = crypto.randomUUID()
      const now = new Date().toISOString()

      const result = await mutateWithRLS<DbPost>(
        `INSERT INTO posts (id, "userId", "teamId", title, slug, excerpt, content, "featuredImage", featured, status, "publishedAt", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING id, title, slug, excerpt, content, "featuredImage", featured, status, "publishedAt", "createdAt", "updatedAt"`,
        [
          id,
          userId,
          data.teamId,
          data.title,
          data.slug,
          data.excerpt || null,
          data.content,
          data.featuredImage || null,
          data.featured || false,
          data.status || 'draft',
          data.publishedAt || null,
          now,
          now,
        ],
        userId
      )

      if (!result.rows[0]) throw new Error('Failed to create post')

      const post = result.rows[0]
      return {
        id: post.id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt ?? undefined,
        content: post.content,
        featuredImage: post.featuredImage ?? undefined,
        featured: post.featured ?? undefined,
        status: post.status,
        publishedAt: post.publishedAt ?? undefined,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
      }
    } catch (error) {
      console.error('PostsService.create error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to create post')
    }
  }

  /**
   * Update an existing post
   */
  static async update(userId: string, id: string, data: PostUpdateData): Promise<Post> {
    try {
      if (!userId?.trim()) throw new Error('User ID is required')
      if (!id?.trim()) throw new Error('Post ID is required')

      const updates: string[] = []
      const values: unknown[] = []
      let paramIndex = 1

      if (data.title !== undefined) {
        updates.push(`title = $${paramIndex++}`)
        values.push(data.title)
      }
      if (data.slug !== undefined) {
        updates.push(`slug = $${paramIndex++}`)
        values.push(data.slug)
      }
      if (data.excerpt !== undefined) {
        updates.push(`excerpt = $${paramIndex++}`)
        values.push(data.excerpt || null)
      }
      if (data.content !== undefined) {
        updates.push(`content = $${paramIndex++}`)
        values.push(data.content)
      }
      if (data.featuredImage !== undefined) {
        updates.push(`"featuredImage" = $${paramIndex++}`)
        values.push(data.featuredImage || null)
      }
      if (data.featured !== undefined) {
        updates.push(`featured = $${paramIndex++}`)
        values.push(data.featured)
      }
      if (data.status !== undefined) {
        updates.push(`status = $${paramIndex++}`)
        values.push(data.status)
      }
      if (data.publishedAt !== undefined) {
        updates.push(`"publishedAt" = $${paramIndex++}`)
        values.push(data.publishedAt || null)
      }

      if (updates.length === 0) throw new Error('No fields to update')

      updates.push(`"updatedAt" = $${paramIndex++}`)
      values.push(new Date().toISOString())
      values.push(id)

      const result = await mutateWithRLS<DbPost>(
        `UPDATE posts SET ${updates.join(', ')} WHERE id = $${paramIndex}
         RETURNING id, title, slug, excerpt, content, "featuredImage", featured, status, "publishedAt", "createdAt", "updatedAt"`,
        values,
        userId
      )

      if (!result.rows[0]) throw new Error('Post not found or update failed')

      const post = result.rows[0]
      return {
        id: post.id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt ?? undefined,
        content: post.content,
        featuredImage: post.featuredImage ?? undefined,
        featured: post.featured ?? undefined,
        status: post.status,
        publishedAt: post.publishedAt ?? undefined,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
      }
    } catch (error) {
      console.error('PostsService.update error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to update post')
    }
  }

  /**
   * Delete a post
   */
  static async delete(userId: string, id: string): Promise<boolean> {
    try {
      if (!userId?.trim()) throw new Error('User ID is required')
      if (!id?.trim()) throw new Error('Post ID is required')

      const result = await mutateWithRLS(`DELETE FROM posts WHERE id = $1`, [id], userId)
      return result.rowCount > 0
    } catch (error) {
      console.error('PostsService.delete error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to delete post')
    }
  }

  // ============================================
  // PUBLISHING METHODS
  // ============================================

  /**
   * Publish a post
   */
  static async publish(userId: string, id: string): Promise<Post> {
    return this.update(userId, id, {
      status: 'published',
      publishedAt: new Date().toISOString(),
    })
  }

  /**
   * Unpublish a post (revert to draft)
   */
  static async unpublish(userId: string, id: string): Promise<Post> {
    return this.update(userId, id, {
      status: 'draft',
    })
  }
}
