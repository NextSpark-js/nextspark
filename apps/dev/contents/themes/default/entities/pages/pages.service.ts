/**
 * Pages Service
 *
 * Provides data access methods for pages, separating public queries
 * (without RLS) from authenticated queries (with RLS).
 *
 * @module PagesService
 */

import { query, queryOne, queryOneWithRLS } from '@nextsparkjs/core/lib/db'
import type {
  PagePublic,
  PageMetadata,
  PageListOptions,
  PageListResult,
  Block,
} from './pages.types'

// Database row type for page
interface DbPage {
  id: string
  slug: string
  title: string
  blocks: Block[]
  locale: string
  status: string
  createdAt: string
}

// Database row type for metadata query
interface DbPageMetadata {
  title: string
  seoTitle: string | null
  seoDescription: string | null
  ogImage: string | null
}

export class PagesService {
  // ============================================
  // PUBLIC METHODS (sin RLS)
  // ============================================

  /**
   * Get a published page by slug
   *
   * Fetches the full page data including blocks.
   * Only returns published pages.
   *
   * @param slug - Page slug
   * @param locale - Optional locale filter (defaults to 'en')
   * @returns Page data or null if not found/not published
   *
   * @example
   * const page = await PagesService.getPublishedBySlug('about')
   * if (!page) notFound()
   */
  static async getPublishedBySlug(
    slug: string,
    locale: string = 'en'
  ): Promise<PagePublic | null> {
    try {
      if (!slug || slug.trim() === '') {
        throw new Error('Page slug is required')
      }

      const page = await queryOne<DbPage>(
        `
        SELECT
          id,
          slug,
          title,
          blocks,
          locale,
          status,
          "createdAt"
        FROM pages
        WHERE slug = $1 AND status = 'published' AND locale = $2
        `,
        [slug, locale]
      )

      if (!page) {
        return null
      }

      return {
        id: page.id,
        slug: page.slug,
        title: page.title,
        blocks: page.blocks,
        locale: page.locale,
      }
    } catch (error) {
      console.error('PagesService.getPublishedBySlug error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to fetch page'
      )
    }
  }

  /**
   * Get page metadata for SEO/head tags
   *
   * Lightweight query that only fetches SEO-related fields.
   * Used in generateMetadata for better performance.
   *
   * @param slug - Page slug
   * @param locale - Optional locale filter (defaults to 'en')
   * @returns Metadata or null if not found/not published
   *
   * @example
   * const metadata = await PagesService.getPublishedMetadata('about')
   * return { title: metadata?.seoTitle || metadata?.title }
   */
  static async getPublishedMetadata(
    slug: string,
    locale: string = 'en'
  ): Promise<PageMetadata | null> {
    try {
      if (!slug || slug.trim() === '') {
        throw new Error('Page slug is required')
      }

      const result = await query<DbPageMetadata>(
        `
        SELECT
          title,
          "seoTitle",
          "seoDescription",
          "ogImage"
        FROM pages
        WHERE slug = $1 AND status = 'published' AND locale = $2
        `,
        [slug, locale]
      )

      if (result.rows.length === 0) {
        return null
      }

      const page = result.rows[0]

      return {
        title: page.title,
        seoTitle: page.seoTitle ?? undefined,
        seoDescription: page.seoDescription ?? undefined,
        ogImage: page.ogImage ?? undefined,
      }
    } catch (error) {
      console.error('PagesService.getPublishedMetadata error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to fetch page metadata'
      )
    }
  }

  /**
   * List published pages with pagination
   *
   * @param options - List options (limit, offset, locale, orderBy, orderDir)
   * @returns Object with pages array and total count
   *
   * @example
   * const { pages, total } = await PagesService.listPublished({ limit: 10 })
   */
  static async listPublished(
    options: PageListOptions = {}
  ): Promise<PageListResult> {
    try {
      const {
        limit = 10,
        offset = 0,
        locale = 'en',
        orderBy = 'createdAt',
        orderDir = 'desc',
      } = options

      // Validate orderBy to prevent SQL injection
      const validOrderBy = ['createdAt', 'title'].includes(orderBy) ? orderBy : 'createdAt'
      const validOrderDir = orderDir === 'asc' ? 'ASC' : 'DESC'
      const orderColumn = validOrderBy === 'createdAt' ? '"createdAt"' : 'title'

      // Get total count
      const countResult = await query<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM pages WHERE status = 'published' AND locale = $1`,
        [locale]
      )
      const total = parseInt(countResult.rows[0]?.count || '0', 10)

      // Get pages
      const pagesResult = await query<DbPage>(
        `
        SELECT
          id,
          slug,
          title,
          blocks,
          locale,
          status,
          "createdAt"
        FROM pages
        WHERE status = 'published' AND locale = $1
        ORDER BY ${orderColumn} ${validOrderDir}
        LIMIT $2 OFFSET $3
        `,
        [locale, limit, offset]
      )

      const pages: PagePublic[] = pagesResult.rows.map((page) => ({
        id: page.id,
        slug: page.slug,
        title: page.title,
        blocks: page.blocks,
        locale: page.locale,
      }))

      return { pages, total }
    } catch (error) {
      console.error('PagesService.listPublished error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to list pages'
      )
    }
  }

  // ============================================
  // AUTHENTICATED METHODS (con RLS)
  // ============================================

  /**
   * Get a page by ID (authenticated)
   *
   * For dashboard/admin views. Respects RLS policies.
   *
   * @param id - Page ID
   * @param userId - Current user ID for RLS
   * @returns Page data or null if not found/not authorized
   *
   * @example
   * const page = await PagesService.getById('page-uuid', currentUserId)
   */
  static async getById(
    id: string,
    userId: string
  ): Promise<PagePublic | null> {
    try {
      if (!id || id.trim() === '') {
        throw new Error('Page ID is required')
      }

      if (!userId || userId.trim() === '') {
        throw new Error('User ID is required for authentication')
      }

      const page = await queryOneWithRLS<DbPage>(
        `
        SELECT
          id,
          slug,
          title,
          blocks,
          locale,
          status,
          "createdAt"
        FROM pages
        WHERE id = $1
        `,
        [id],
        userId
      )

      if (!page) {
        return null
      }

      return {
        id: page.id,
        slug: page.slug,
        title: page.title,
        blocks: page.blocks,
        locale: page.locale,
      }
    } catch (error) {
      console.error('PagesService.getById error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to fetch page'
      )
    }
  }
}
