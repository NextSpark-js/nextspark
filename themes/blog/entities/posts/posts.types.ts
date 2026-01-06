/**
 * Posts Service Types
 *
 * Type definitions for the PostsService.
 * Posts is a private entity - users only see posts in their team.
 *
 * @module PostsTypes
 */

/**
 * Post status values
 */
export type PostStatus = 'draft' | 'published' | 'scheduled'

/**
 * Post entity
 */
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

/**
 * Options for listing posts
 */
export interface PostListOptions {
  limit?: number
  offset?: number
  status?: PostStatus
  featured?: boolean
  teamId?: string
  orderBy?: 'title' | 'publishedAt' | 'createdAt' | 'updatedAt'
  orderDir?: 'asc' | 'desc'
}

/**
 * Result of listing posts with pagination
 */
export interface PostListResult {
  posts: Post[]
  total: number
}

/**
 * Data required to create a new post
 */
export interface PostCreateData {
  title: string
  slug: string
  content: string
  teamId: string
  excerpt?: string
  featuredImage?: string
  featured?: boolean
  status?: PostStatus
  publishedAt?: string
}

/**
 * Data for updating an existing post
 */
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
