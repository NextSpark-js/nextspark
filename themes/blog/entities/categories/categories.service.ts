/**
 * Categories Service
 *
 * Provides data access methods for blog categories.
 * Categories is a private entity - users only see categories in their team.
 *
 * All methods require authentication (use RLS with userId filter).
 *
 * @module CategoriesService
 */

import { queryOneWithRLS, queryWithRLS, mutateWithRLS } from '@nextsparkjs/core/lib/db'

// Category interface
export interface Category {
  id: string
  name: string
  slug: string
  description?: string
  createdAt: string
  updatedAt: string
}

// List options
export interface CategoryListOptions {
  limit?: number
  offset?: number
  orderBy?: 'name' | 'slug' | 'createdAt'
  orderDir?: 'asc' | 'desc'
  teamId?: string
}

// List result
export interface CategoryListResult {
  categories: Category[]
  total: number
}

// Create data
export interface CategoryCreateData {
  name: string
  slug: string
  description?: string
  teamId: string
}

// Update data
export interface CategoryUpdateData {
  name?: string
  slug?: string
  description?: string
}

// Database row type
interface DbCategory {
  id: string
  name: string
  slug: string
  description: string | null
  createdAt: string
  updatedAt: string
}

export class CategoriesService {
  // ============================================
  // READ METHODS
  // ============================================

  /**
   * Get a category by ID
   */
  static async getById(id: string, userId: string): Promise<Category | null> {
    try {
      if (!id?.trim()) throw new Error('Category ID is required')
      if (!userId?.trim()) throw new Error('User ID is required')

      const category = await queryOneWithRLS<DbCategory>(
        `SELECT id, name, slug, description, "createdAt", "updatedAt"
         FROM categories WHERE id = $1`,
        [id],
        userId
      )

      if (!category) return null

      return {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description ?? undefined,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
      }
    } catch (error) {
      console.error('CategoriesService.getById error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch category')
    }
  }

  /**
   * Get a category by slug
   */
  static async getBySlug(slug: string, userId: string): Promise<Category | null> {
    try {
      if (!slug?.trim()) throw new Error('Slug is required')
      if (!userId?.trim()) throw new Error('User ID is required')

      const category = await queryOneWithRLS<DbCategory>(
        `SELECT id, name, slug, description, "createdAt", "updatedAt"
         FROM categories WHERE slug = $1`,
        [slug],
        userId
      )

      if (!category) return null

      return {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description ?? undefined,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
      }
    } catch (error) {
      console.error('CategoriesService.getBySlug error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch category')
    }
  }

  /**
   * List categories with pagination
   */
  static async list(userId: string, options: CategoryListOptions = {}): Promise<CategoryListResult> {
    try {
      if (!userId?.trim()) throw new Error('User ID is required')

      const {
        limit = 50,
        offset = 0,
        orderBy = 'name',
        orderDir = 'asc',
        teamId,
      } = options

      // Build WHERE clause
      const conditions: string[] = []
      const params: unknown[] = []
      let paramIndex = 1

      if (teamId) {
        conditions.push(`"teamId" = $${paramIndex++}`)
        params.push(teamId)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      // Validate orderBy
      const validOrderBy = ['name', 'slug', 'createdAt'].includes(orderBy) ? orderBy : 'name'
      const validOrderDir = orderDir === 'desc' ? 'DESC' : 'ASC'
      const orderColumnMap: Record<string, string> = {
        name: 'name',
        slug: 'slug',
        createdAt: '"createdAt"',
      }
      const orderColumn = orderColumnMap[validOrderBy] || 'name'

      // Get total count
      const countResult = await queryWithRLS<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM categories ${whereClause}`,
        params,
        userId
      )
      const total = parseInt(countResult[0]?.count || '0', 10)

      // Get categories
      params.push(limit, offset)
      const categories = await queryWithRLS<DbCategory>(
        `SELECT id, name, slug, description, "createdAt", "updatedAt"
         FROM categories ${whereClause}
         ORDER BY ${orderColumn} ${validOrderDir}
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        params,
        userId
      )

      return {
        categories: categories.map((cat) => ({
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          description: cat.description ?? undefined,
          createdAt: cat.createdAt,
          updatedAt: cat.updatedAt,
        })),
        total,
      }
    } catch (error) {
      console.error('CategoriesService.list error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to list categories')
    }
  }

  /**
   * Get all categories (no pagination)
   */
  static async getAll(userId: string): Promise<Category[]> {
    const { categories } = await this.list(userId, { limit: 1000 })
    return categories
  }

  // ============================================
  // WRITE METHODS
  // ============================================

  /**
   * Create a new category
   */
  static async create(userId: string, data: CategoryCreateData): Promise<Category> {
    try {
      if (!userId?.trim()) throw new Error('User ID is required')
      if (!data.name?.trim()) throw new Error('Name is required')
      if (!data.slug?.trim()) throw new Error('Slug is required')
      if (!data.teamId?.trim()) throw new Error('Team ID is required')

      const id = crypto.randomUUID()
      const now = new Date().toISOString()

      const result = await mutateWithRLS<DbCategory>(
        `INSERT INTO categories (id, "userId", "teamId", name, slug, description, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, name, slug, description, "createdAt", "updatedAt"`,
        [
          id,
          userId,
          data.teamId,
          data.name,
          data.slug,
          data.description || null,
          now,
          now,
        ],
        userId
      )

      if (!result.rows[0]) throw new Error('Failed to create category')

      const category = result.rows[0]
      return {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description ?? undefined,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
      }
    } catch (error) {
      console.error('CategoriesService.create error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to create category')
    }
  }

  /**
   * Update an existing category
   */
  static async update(userId: string, id: string, data: CategoryUpdateData): Promise<Category> {
    try {
      if (!userId?.trim()) throw new Error('User ID is required')
      if (!id?.trim()) throw new Error('Category ID is required')

      const updates: string[] = []
      const values: unknown[] = []
      let paramIndex = 1

      if (data.name !== undefined) {
        updates.push(`name = $${paramIndex++}`)
        values.push(data.name)
      }
      if (data.slug !== undefined) {
        updates.push(`slug = $${paramIndex++}`)
        values.push(data.slug)
      }
      if (data.description !== undefined) {
        updates.push(`description = $${paramIndex++}`)
        values.push(data.description || null)
      }

      if (updates.length === 0) throw new Error('No fields to update')

      updates.push(`"updatedAt" = $${paramIndex++}`)
      values.push(new Date().toISOString())
      values.push(id)

      const result = await mutateWithRLS<DbCategory>(
        `UPDATE categories SET ${updates.join(', ')} WHERE id = $${paramIndex}
         RETURNING id, name, slug, description, "createdAt", "updatedAt"`,
        values,
        userId
      )

      if (!result.rows[0]) throw new Error('Category not found or update failed')

      const category = result.rows[0]
      return {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description ?? undefined,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
      }
    } catch (error) {
      console.error('CategoriesService.update error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to update category')
    }
  }

  /**
   * Delete a category
   */
  static async delete(userId: string, id: string): Promise<boolean> {
    try {
      if (!userId?.trim()) throw new Error('User ID is required')
      if (!id?.trim()) throw new Error('Category ID is required')

      const result = await mutateWithRLS(`DELETE FROM categories WHERE id = $1`, [id], userId)
      return result.rowCount > 0
    } catch (error) {
      console.error('CategoriesService.delete error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to delete category')
    }
  }
}
