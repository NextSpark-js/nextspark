/**
 * Products Service
 *
 * Provides data access methods for products.
 * Products is a private entity - users only see products in their team.
 *
 * All methods require authentication (use RLS with userId filter).
 *
 * @module ProductsService
 */

import { queryOneWithRLS, queryWithRLS, mutateWithRLS } from '@nextsparkjs/core/lib/db'

// Product interface
export interface Product {
  id: string
  name: string
  sku?: string
  description?: string
  price: number
  currency?: string
  category?: string
  isActive?: boolean
  createdAt: string
  updatedAt: string
}

// List options
export interface ProductListOptions {
  limit?: number
  offset?: number
  category?: string
  isActive?: boolean
  minPrice?: number
  maxPrice?: number
  orderBy?: 'name' | 'price' | 'sku' | 'createdAt' | 'updatedAt'
  orderDir?: 'asc' | 'desc'
  teamId?: string
}

// List result
export interface ProductListResult {
  products: Product[]
  total: number
}

// Create data
export interface ProductCreateData {
  name: string
  sku?: string
  description?: string
  price: number
  currency?: string
  category?: string
  isActive?: boolean
  teamId: string
}

// Update data
export interface ProductUpdateData {
  name?: string
  sku?: string
  description?: string
  price?: number
  currency?: string
  category?: string
  isActive?: boolean
}

// Database row type
interface DbProduct {
  id: string
  name: string
  sku: string | null
  description: string | null
  price: number
  currency: string | null
  category: string | null
  isActive: boolean | null
  createdAt: string
  updatedAt: string
}

export class ProductsService {
  // ============================================
  // READ METHODS
  // ============================================

  /**
   * Get a product by ID
   */
  static async getById(id: string, userId: string): Promise<Product | null> {
    try {
      if (!id?.trim()) throw new Error('Product ID is required')
      if (!userId?.trim()) throw new Error('User ID is required')

      const product = await queryOneWithRLS<DbProduct>(
        `SELECT id, name, sku, description, price, currency, category, "isActive", "createdAt", "updatedAt"
         FROM products WHERE id = $1`,
        [id],
        userId
      )

      if (!product) return null

      return {
        id: product.id,
        name: product.name,
        sku: product.sku ?? undefined,
        description: product.description ?? undefined,
        price: product.price,
        currency: product.currency ?? undefined,
        category: product.category ?? undefined,
        isActive: product.isActive ?? undefined,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      }
    } catch (error) {
      console.error('ProductsService.getById error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch product')
    }
  }

  /**
   * Get a product by SKU
   */
  static async getBySku(sku: string, userId: string): Promise<Product | null> {
    try {
      if (!sku?.trim()) throw new Error('SKU is required')
      if (!userId?.trim()) throw new Error('User ID is required')

      const product = await queryOneWithRLS<DbProduct>(
        `SELECT id, name, sku, description, price, currency, category, "isActive", "createdAt", "updatedAt"
         FROM products WHERE sku = $1`,
        [sku],
        userId
      )

      if (!product) return null

      return {
        id: product.id,
        name: product.name,
        sku: product.sku ?? undefined,
        description: product.description ?? undefined,
        price: product.price,
        currency: product.currency ?? undefined,
        category: product.category ?? undefined,
        isActive: product.isActive ?? undefined,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      }
    } catch (error) {
      console.error('ProductsService.getBySku error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch product')
    }
  }

  /**
   * List products with pagination and filtering
   */
  static async list(userId: string, options: ProductListOptions = {}): Promise<ProductListResult> {
    try {
      if (!userId?.trim()) throw new Error('User ID is required')

      const {
        limit = 10,
        offset = 0,
        category,
        isActive,
        minPrice,
        maxPrice,
        orderBy = 'createdAt',
        orderDir = 'desc',
        teamId,
      } = options

      // Build WHERE clause
      const conditions: string[] = []
      const params: unknown[] = []
      let paramIndex = 1

      if (category) {
        conditions.push(`category = $${paramIndex++}`)
        params.push(category)
      }

      if (isActive !== undefined) {
        conditions.push(`"isActive" = $${paramIndex++}`)
        params.push(isActive)
      }

      if (minPrice !== undefined) {
        conditions.push(`price >= $${paramIndex++}`)
        params.push(minPrice)
      }

      if (maxPrice !== undefined) {
        conditions.push(`price <= $${paramIndex++}`)
        params.push(maxPrice)
      }

      if (teamId) {
        conditions.push(`"teamId" = $${paramIndex++}`)
        params.push(teamId)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      // Validate orderBy
      const validOrderBy = ['name', 'price', 'sku', 'createdAt', 'updatedAt'].includes(orderBy) ? orderBy : 'createdAt'
      const validOrderDir = orderDir === 'asc' ? 'ASC' : 'DESC'
      const orderColumnMap: Record<string, string> = {
        name: 'name',
        price: 'price',
        sku: 'sku',
        createdAt: '"createdAt"',
        updatedAt: '"updatedAt"',
      }
      const orderColumn = orderColumnMap[validOrderBy] || '"createdAt"'

      // Get total count
      const countResult = await queryWithRLS<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM products ${whereClause}`,
        params,
        userId
      )
      const total = parseInt(countResult[0]?.count || '0', 10)

      // Get products
      params.push(limit, offset)
      const products = await queryWithRLS<DbProduct>(
        `SELECT id, name, sku, description, price, currency, category, "isActive", "createdAt", "updatedAt"
         FROM products ${whereClause}
         ORDER BY ${orderColumn} ${validOrderDir}
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        params,
        userId
      )

      return {
        products: products.map((product) => ({
          id: product.id,
          name: product.name,
          sku: product.sku ?? undefined,
          description: product.description ?? undefined,
          price: product.price,
          currency: product.currency ?? undefined,
          category: product.category ?? undefined,
          isActive: product.isActive ?? undefined,
          createdAt: product.createdAt,
          updatedAt: product.updatedAt,
        })),
        total,
      }
    } catch (error) {
      console.error('ProductsService.list error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to list products')
    }
  }

  /**
   * Get active products
   */
  static async getActive(userId: string, limit = 50): Promise<Product[]> {
    const { products } = await this.list(userId, {
      isActive: true,
      limit,
      orderBy: 'name',
      orderDir: 'asc',
    })
    return products
  }

  /**
   * Get products by category
   */
  static async getByCategory(userId: string, category: string, limit = 50): Promise<Product[]> {
    const { products } = await this.list(userId, {
      category,
      limit,
      orderBy: 'name',
      orderDir: 'asc',
    })
    return products
  }

  // ============================================
  // WRITE METHODS
  // ============================================

  /**
   * Create a new product
   */
  static async create(userId: string, data: ProductCreateData): Promise<Product> {
    try {
      if (!userId?.trim()) throw new Error('User ID is required')
      if (!data.name?.trim()) throw new Error('Product name is required')
      if (data.price === undefined || data.price < 0) throw new Error('Valid price is required')
      if (!data.teamId?.trim()) throw new Error('Team ID is required')

      const id = crypto.randomUUID()
      const now = new Date().toISOString()

      const result = await mutateWithRLS<DbProduct>(
        `INSERT INTO products (id, "userId", "teamId", name, sku, description, price, currency, category, "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id, name, sku, description, price, currency, category, "isActive", "createdAt", "updatedAt"`,
        [
          id,
          userId,
          data.teamId,
          data.name,
          data.sku || null,
          data.description || null,
          data.price,
          data.currency || 'USD',
          data.category || null,
          data.isActive !== undefined ? data.isActive : true,
          now,
          now,
        ],
        userId
      )

      if (!result.rows[0]) throw new Error('Failed to create product')

      const product = result.rows[0]
      return {
        id: product.id,
        name: product.name,
        sku: product.sku ?? undefined,
        description: product.description ?? undefined,
        price: product.price,
        currency: product.currency ?? undefined,
        category: product.category ?? undefined,
        isActive: product.isActive ?? undefined,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      }
    } catch (error) {
      console.error('ProductsService.create error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to create product')
    }
  }

  /**
   * Update an existing product
   */
  static async update(userId: string, id: string, data: ProductUpdateData): Promise<Product> {
    try {
      if (!userId?.trim()) throw new Error('User ID is required')
      if (!id?.trim()) throw new Error('Product ID is required')

      const updates: string[] = []
      const values: unknown[] = []
      let paramIndex = 1

      if (data.name !== undefined) {
        updates.push(`name = $${paramIndex++}`)
        values.push(data.name)
      }
      if (data.sku !== undefined) {
        updates.push(`sku = $${paramIndex++}`)
        values.push(data.sku || null)
      }
      if (data.description !== undefined) {
        updates.push(`description = $${paramIndex++}`)
        values.push(data.description || null)
      }
      if (data.price !== undefined) {
        updates.push(`price = $${paramIndex++}`)
        values.push(data.price)
      }
      if (data.currency !== undefined) {
        updates.push(`currency = $${paramIndex++}`)
        values.push(data.currency || null)
      }
      if (data.category !== undefined) {
        updates.push(`category = $${paramIndex++}`)
        values.push(data.category || null)
      }
      if (data.isActive !== undefined) {
        updates.push(`"isActive" = $${paramIndex++}`)
        values.push(data.isActive)
      }

      if (updates.length === 0) throw new Error('No fields to update')

      updates.push(`"updatedAt" = $${paramIndex++}`)
      values.push(new Date().toISOString())
      values.push(id)

      const result = await mutateWithRLS<DbProduct>(
        `UPDATE products SET ${updates.join(', ')} WHERE id = $${paramIndex}
         RETURNING id, name, sku, description, price, currency, category, "isActive", "createdAt", "updatedAt"`,
        values,
        userId
      )

      if (!result.rows[0]) throw new Error('Product not found or update failed')

      const product = result.rows[0]
      return {
        id: product.id,
        name: product.name,
        sku: product.sku ?? undefined,
        description: product.description ?? undefined,
        price: product.price,
        currency: product.currency ?? undefined,
        category: product.category ?? undefined,
        isActive: product.isActive ?? undefined,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      }
    } catch (error) {
      console.error('ProductsService.update error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to update product')
    }
  }

  /**
   * Delete a product
   */
  static async delete(userId: string, id: string): Promise<boolean> {
    try {
      if (!userId?.trim()) throw new Error('User ID is required')
      if (!id?.trim()) throw new Error('Product ID is required')

      const result = await mutateWithRLS(`DELETE FROM products WHERE id = $1`, [id], userId)
      return result.rowCount > 0
    } catch (error) {
      console.error('ProductsService.delete error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to delete product')
    }
  }
}
