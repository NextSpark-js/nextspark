/**
 * Posts Service Types
 *
 * Type definitions for the PostsService.
 * Separates public types (for rendering) from internal types.
 *
 * @module PostsTypes
 */

/**
 * Block structure for page builder content
 */
export interface Block {
  id: string
  blockSlug: string
  props: Record<string, unknown>
}

/**
 * Category attached to a post (from taxonomy relations)
 */
export interface PostCategory {
  id: string
  name: string
  slug: string
  color?: string
}

/**
 * Post data for public rendering
 * Includes blocks and categories for full page display
 */
export interface PostPublic {
  id: string
  slug: string
  title: string
  excerpt?: string
  featuredImage?: string
  blocks: Block[]
  createdAt: string
  categories?: PostCategory[]
}

/**
 * Lightweight post metadata for SEO/head tags
 * Does not include blocks or categories
 */
export interface PostMetadata {
  title: string
  excerpt?: string
  seoTitle?: string
  seoDescription?: string
  ogImage?: string
  featuredImage?: string
}

/**
 * Options for listing published posts
 */
export interface PostListOptions {
  limit?: number
  offset?: number
  categorySlug?: string
  orderBy?: 'createdAt' | 'title'
  orderDir?: 'asc' | 'desc'
}

/**
 * Result of listing posts with pagination
 */
export interface PostListResult {
  posts: PostPublic[]
  total: number
}
