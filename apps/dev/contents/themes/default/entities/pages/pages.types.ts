/**
 * Pages Service Types
 *
 * Type definitions for the PagesService.
 * Separates public types (for rendering) from internal types.
 *
 * @module PagesTypes
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
 * Page data for public rendering
 * Includes blocks for full page display
 */
export interface PagePublic {
  id: string
  slug: string
  title: string
  blocks: Block[]
  locale: string
}

/**
 * Lightweight page metadata for SEO/head tags
 * Does not include blocks
 */
export interface PageMetadata {
  title: string
  seoTitle?: string
  seoDescription?: string
  ogImage?: string
}

/**
 * Options for listing published pages
 */
export interface PageListOptions {
  limit?: number
  offset?: number
  locale?: string
  orderBy?: 'createdAt' | 'title'
  orderDir?: 'asc' | 'desc'
}

/**
 * Result of listing pages with pagination
 */
export interface PageListResult {
  pages: PagePublic[]
  total: number
}

// ============================================
// MANAGEMENT TYPES (for authenticated CRUD)
// ============================================

/**
 * Full page data including status and SEO fields
 * Used for dashboard/admin operations
 */
export interface PageFull extends PagePublic {
  status: 'draft' | 'published'
  seoTitle?: string
  seoDescription?: string
  ogImage?: string
  createdAt: string
  updatedAt: string
}

/**
 * Data for creating a new page
 */
export interface PageCreateData {
  slug: string
  title: string
  blocks?: Block[]
  locale?: string
  status?: 'draft' | 'published'
  seoTitle?: string
  seoDescription?: string
  ogImage?: string
  teamId: string
}

/**
 * Data for updating a page (metadata only, not blocks)
 */
export interface PageUpdateData {
  slug?: string
  title?: string
  status?: 'draft' | 'published'
  seoTitle?: string
  seoDescription?: string
  ogImage?: string
}

/**
 * Options for listing pages in management context
 */
export interface PageManagementListOptions {
  limit?: number
  offset?: number
  locale?: string
  status?: 'draft' | 'published' | 'all'
  orderBy?: 'createdAt' | 'updatedAt' | 'title'
  orderDir?: 'asc' | 'desc'
  teamId?: string
}

/**
 * Result of listing pages in management context
 */
export interface PageManagementListResult {
  pages: PageFull[]
  total: number
}
