/**
 * Pages Management Service
 *
 * Provides authenticated CRUD operations for pages including block management.
 * All methods require authentication and use RLS.
 *
 * @module PagesManagementService
 */

import { queryOneWithRLS, queryWithRLS, mutateWithRLS } from '@nextsparkjs/core/lib/db'
import type {
  Block,
  PageFull,
  PageCreateData,
  PageUpdateData,
  PageManagementListOptions,
  PageManagementListResult,
} from './pages.types'

// Database row type for page
interface DbPage {
  id: string
  slug: string
  title: string
  blocks: Block[]
  locale: string
  status: string
  seoTitle: string | null
  seoDescription: string | null
  ogImage: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Convert database row to PageFull
 */
function toPageFull(row: DbPage): PageFull {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    blocks: row.blocks || [],
    locale: row.locale,
    status: row.status as 'draft' | 'published',
    seoTitle: row.seoTitle ?? undefined,
    seoDescription: row.seoDescription ?? undefined,
    ogImage: row.ogImage ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export class PagesManagementService {
  // ============================================
  // CRUD OPERATIONS
  // ============================================

  /**
   * List pages with optional filters
   */
  static async list(
    userId: string,
    options: PageManagementListOptions = {}
  ): Promise<PageManagementListResult> {
    try {
      if (!userId || userId.trim() === '') {
        throw new Error('User ID is required for authentication')
      }

      const {
        limit = 20,
        offset = 0,
        locale,
        status = 'all',
        orderBy = 'createdAt',
        orderDir = 'desc',
      } = options

      // Build WHERE clause
      const conditions: string[] = []
      const params: unknown[] = []
      let paramIndex = 1

      if (locale) {
        conditions.push(`locale = $${paramIndex++}`)
        params.push(locale)
      }

      if (status !== 'all') {
        conditions.push(`status = $${paramIndex++}`)
        params.push(status)
      }

      const whereClause = conditions.length > 0
        ? `WHERE ${conditions.join(' AND ')}`
        : ''

      // Validate orderBy
      const validOrderBy = ['createdAt', 'updatedAt', 'title'].includes(orderBy) ? orderBy : 'createdAt'
      const validOrderDir = orderDir === 'asc' ? 'ASC' : 'DESC'
      const orderColumn = validOrderBy === 'title' ? 'title' : `"${validOrderBy}"`

      // Get total count
      const countResult = await queryWithRLS<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM pages ${whereClause}`,
        params,
        userId
      )
      const total = parseInt(countResult[0]?.count || '0', 10)

      // Get pages
      params.push(limit, offset)
      const pages = await queryWithRLS<DbPage>(
        `
        SELECT
          id, slug, title, blocks, locale, status,
          "seoTitle", "seoDescription", "ogImage",
          "createdAt", "updatedAt"
        FROM pages
        ${whereClause}
        ORDER BY ${orderColumn} ${validOrderDir}
        LIMIT $${paramIndex++} OFFSET $${paramIndex}
        `,
        params,
        userId
      )

      return {
        pages: pages.map(toPageFull),
        total,
      }
    } catch (error) {
      console.error('PagesManagementService.list error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to list pages'
      )
    }
  }

  /**
   * Get a page by ID
   */
  static async getById(
    userId: string,
    id: string
  ): Promise<PageFull | null> {
    try {
      if (!userId || userId.trim() === '') {
        throw new Error('User ID is required for authentication')
      }

      if (!id || id.trim() === '') {
        throw new Error('Page ID is required')
      }

      const page = await queryOneWithRLS<DbPage>(
        `
        SELECT
          id, slug, title, blocks, locale, status,
          "seoTitle", "seoDescription", "ogImage",
          "createdAt", "updatedAt"
        FROM pages
        WHERE id = $1
        `,
        [id],
        userId
      )

      return page ? toPageFull(page) : null
    } catch (error) {
      console.error('PagesManagementService.getById error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to get page'
      )
    }
  }

  /**
   * Create a new page
   */
  static async create(
    userId: string,
    data: PageCreateData
  ): Promise<PageFull> {
    try {
      if (!userId || userId.trim() === '') {
        throw new Error('User ID is required for authentication')
      }

      if (!data.slug || !data.title) {
        throw new Error('Slug and title are required')
      }

      const id = crypto.randomUUID()
      const now = new Date().toISOString()

      const result = await mutateWithRLS<DbPage>(
        `
        INSERT INTO pages (
          id, "userId", "teamId", slug, title, blocks,
          locale, status, "seoTitle", "seoDescription", "ogImage",
          "createdAt", "updatedAt"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING
          id, slug, title, blocks, locale, status,
          "seoTitle", "seoDescription", "ogImage",
          "createdAt", "updatedAt"
        `,
        [
          id,
          userId,
          data.teamId,
          data.slug,
          data.title,
          JSON.stringify(data.blocks || []),
          data.locale || 'en',
          data.status || 'draft',
          data.seoTitle || null,
          data.seoDescription || null,
          data.ogImage || null,
          now,
          now,
        ],
        userId
      )

      if (!result.rows[0]) {
        throw new Error('Failed to create page')
      }

      return toPageFull(result.rows[0])
    } catch (error) {
      console.error('PagesManagementService.create error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to create page'
      )
    }
  }

  /**
   * Update page metadata (not blocks)
   */
  static async update(
    userId: string,
    id: string,
    data: PageUpdateData
  ): Promise<PageFull> {
    try {
      if (!userId || userId.trim() === '') {
        throw new Error('User ID is required for authentication')
      }

      if (!id || id.trim() === '') {
        throw new Error('Page ID is required')
      }

      // Build dynamic update query
      const updates: string[] = []
      const values: unknown[] = []
      let paramIndex = 1

      if (data.slug !== undefined) {
        updates.push(`slug = $${paramIndex++}`)
        values.push(data.slug)
      }
      if (data.title !== undefined) {
        updates.push(`title = $${paramIndex++}`)
        values.push(data.title)
      }
      if (data.status !== undefined) {
        updates.push(`status = $${paramIndex++}`)
        values.push(data.status)
      }
      if (data.seoTitle !== undefined) {
        updates.push(`"seoTitle" = $${paramIndex++}`)
        values.push(data.seoTitle || null)
      }
      if (data.seoDescription !== undefined) {
        updates.push(`"seoDescription" = $${paramIndex++}`)
        values.push(data.seoDescription || null)
      }
      if (data.ogImage !== undefined) {
        updates.push(`"ogImage" = $${paramIndex++}`)
        values.push(data.ogImage || null)
      }

      if (updates.length === 0) {
        throw new Error('No fields to update')
      }

      updates.push(`"updatedAt" = $${paramIndex++}`)
      values.push(new Date().toISOString())

      values.push(id)

      const result = await mutateWithRLS<DbPage>(
        `
        UPDATE pages
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING
          id, slug, title, blocks, locale, status,
          "seoTitle", "seoDescription", "ogImage",
          "createdAt", "updatedAt"
        `,
        values,
        userId
      )

      if (!result.rows[0]) {
        throw new Error('Page not found or update failed')
      }

      return toPageFull(result.rows[0])
    } catch (error) {
      console.error('PagesManagementService.update error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to update page'
      )
    }
  }

  /**
   * Delete a page
   */
  static async delete(
    userId: string,
    id: string
  ): Promise<boolean> {
    try {
      if (!userId || userId.trim() === '') {
        throw new Error('User ID is required for authentication')
      }

      if (!id || id.trim() === '') {
        throw new Error('Page ID is required')
      }

      const result = await mutateWithRLS(
        `DELETE FROM pages WHERE id = $1`,
        [id],
        userId
      )

      return result.rowCount > 0
    } catch (error) {
      console.error('PagesManagementService.delete error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to delete page'
      )
    }
  }

  // ============================================
  // BLOCK OPERATIONS
  // ============================================

  /**
   * Add a block to a page
   */
  static async addBlock(
    userId: string,
    pageId: string,
    blockSlug: string,
    props: Record<string, unknown>,
    position?: number
  ): Promise<PageFull> {
    try {
      // Get current page
      const page = await this.getById(userId, pageId)
      if (!page) {
        throw new Error('Page not found')
      }

      // Create new block
      const newBlock: Block = {
        id: crypto.randomUUID(),
        blockSlug,
        props,
      }

      // Add block at position or end
      const blocks = [...page.blocks]
      if (position !== undefined && position >= 0 && position <= blocks.length) {
        blocks.splice(position, 0, newBlock)
      } else {
        blocks.push(newBlock)
      }

      // Update page with new blocks
      const result = await mutateWithRLS<DbPage>(
        `
        UPDATE pages
        SET blocks = $1, "updatedAt" = $2
        WHERE id = $3
        RETURNING
          id, slug, title, blocks, locale, status,
          "seoTitle", "seoDescription", "ogImage",
          "createdAt", "updatedAt"
        `,
        [JSON.stringify(blocks), new Date().toISOString(), pageId],
        userId
      )

      if (!result.rows[0]) {
        throw new Error('Failed to add block')
      }

      return toPageFull(result.rows[0])
    } catch (error) {
      console.error('PagesManagementService.addBlock error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to add block'
      )
    }
  }

  /**
   * Update a block's properties
   */
  static async updateBlock(
    userId: string,
    pageId: string,
    blockId: string,
    props: Record<string, unknown>
  ): Promise<PageFull> {
    try {
      // Get current page
      const page = await this.getById(userId, pageId)
      if (!page) {
        throw new Error('Page not found')
      }

      // Find and update block
      const blockIndex = page.blocks.findIndex((b: Block) => b.id === blockId)
      if (blockIndex === -1) {
        throw new Error('Block not found')
      }

      const blocks = [...page.blocks]
      blocks[blockIndex] = {
        ...blocks[blockIndex],
        props: { ...blocks[blockIndex].props, ...props },
      }

      // Update page with modified blocks
      const result = await mutateWithRLS<DbPage>(
        `
        UPDATE pages
        SET blocks = $1, "updatedAt" = $2
        WHERE id = $3
        RETURNING
          id, slug, title, blocks, locale, status,
          "seoTitle", "seoDescription", "ogImage",
          "createdAt", "updatedAt"
        `,
        [JSON.stringify(blocks), new Date().toISOString(), pageId],
        userId
      )

      if (!result.rows[0]) {
        throw new Error('Failed to update block')
      }

      return toPageFull(result.rows[0])
    } catch (error) {
      console.error('PagesManagementService.updateBlock error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to update block'
      )
    }
  }

  /**
   * Remove a block from a page
   */
  static async removeBlock(
    userId: string,
    pageId: string,
    blockId: string
  ): Promise<PageFull> {
    try {
      // Get current page
      const page = await this.getById(userId, pageId)
      if (!page) {
        throw new Error('Page not found')
      }

      // Filter out the block
      const blocks = page.blocks.filter((b: Block) => b.id !== blockId)

      if (blocks.length === page.blocks.length) {
        throw new Error('Block not found')
      }

      // Update page with remaining blocks
      const result = await mutateWithRLS<DbPage>(
        `
        UPDATE pages
        SET blocks = $1, "updatedAt" = $2
        WHERE id = $3
        RETURNING
          id, slug, title, blocks, locale, status,
          "seoTitle", "seoDescription", "ogImage",
          "createdAt", "updatedAt"
        `,
        [JSON.stringify(blocks), new Date().toISOString(), pageId],
        userId
      )

      if (!result.rows[0]) {
        throw new Error('Failed to remove block')
      }

      return toPageFull(result.rows[0])
    } catch (error) {
      console.error('PagesManagementService.removeBlock error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to remove block'
      )
    }
  }

  /**
   * Reorder blocks in a page
   */
  static async reorderBlocks(
    userId: string,
    pageId: string,
    blockIds: string[]
  ): Promise<PageFull> {
    try {
      // Get current page
      const page = await this.getById(userId, pageId)
      if (!page) {
        throw new Error('Page not found')
      }

      // Create a map of blocks by ID
      const blockMap = new Map(page.blocks.map(b => [b.id, b]))

      // Reorder based on provided IDs
      const reorderedBlocks: Block[] = []
      for (const id of blockIds) {
        const block = blockMap.get(id)
        if (block) {
          reorderedBlocks.push(block)
          blockMap.delete(id)
        }
      }

      // Add any remaining blocks (in case some IDs were missing)
      for (const block of blockMap.values()) {
        reorderedBlocks.push(block)
      }

      // Update page with reordered blocks
      const result = await mutateWithRLS<DbPage>(
        `
        UPDATE pages
        SET blocks = $1, "updatedAt" = $2
        WHERE id = $3
        RETURNING
          id, slug, title, blocks, locale, status,
          "seoTitle", "seoDescription", "ogImage",
          "createdAt", "updatedAt"
        `,
        [JSON.stringify(reorderedBlocks), new Date().toISOString(), pageId],
        userId
      )

      if (!result.rows[0]) {
        throw new Error('Failed to reorder blocks')
      }

      return toPageFull(result.rows[0])
    } catch (error) {
      console.error('PagesManagementService.reorderBlocks error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to reorder blocks'
      )
    }
  }

  // ============================================
  // PUBLICATION
  // ============================================

  /**
   * Publish a page
   */
  static async publish(
    userId: string,
    id: string
  ): Promise<PageFull> {
    return this.update(userId, id, { status: 'published' })
  }

  /**
   * Unpublish a page (set to draft)
   */
  static async unpublish(
    userId: string,
    id: string
  ): Promise<PageFull> {
    return this.update(userId, id, { status: 'draft' })
  }
}
