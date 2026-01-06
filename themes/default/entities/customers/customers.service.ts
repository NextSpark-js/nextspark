/**
 * Customers Service
 *
 * Provides data access methods for customers.
 * Customers is a private entity with shared: true - all authenticated
 * users can access all records (no userId filter needed).
 *
 * All methods require authentication (use RLS).
 *
 * @module CustomersService
 */

import { queryOneWithRLS, queryWithRLS, mutateWithRLS } from '@nextsparkjs/core/lib/db'
import type {
  Customer,
  CustomerListOptions,
  CustomerListResult,
  CustomerSearchOptions,
  CustomerCreateData,
  CustomerUpdateData,
  DayOfWeek,
} from './customers.types'

// Database row type for customer
interface DbCustomer {
  id: string
  name: string
  account: number
  office: string
  phone: string | null
  salesRep: string | null
  visitDays: DayOfWeek[] | null
  contactDays: DayOfWeek[] | null
  createdAt: string
  updatedAt: string
}

export class CustomersService {
  // ============================================
  // AUTHENTICATED METHODS (con RLS)
  // ============================================

  /**
   * Get a customer by ID
   *
   * Respects RLS policies. Since customers has shared: true,
   * any authenticated user can access all records.
   *
   * @param id - Customer ID
   * @param userId - Current user ID for RLS
   * @returns Customer data or null if not found
   *
   * @example
   * const customer = await CustomersService.getById('customer-uuid', currentUserId)
   */
  static async getById(
    id: string,
    userId: string
  ): Promise<Customer | null> {
    try {
      if (!id || id.trim() === '') {
        throw new Error('Customer ID is required')
      }

      if (!userId || userId.trim() === '') {
        throw new Error('User ID is required for authentication')
      }

      const customer = await queryOneWithRLS<DbCustomer>(
        `
        SELECT
          id,
          name,
          account,
          office,
          phone,
          "salesRep",
          "visitDays",
          "contactDays",
          "createdAt",
          "updatedAt"
        FROM customers
        WHERE id = $1
        `,
        [id],
        userId
      )

      if (!customer) {
        return null
      }

      return {
        id: customer.id,
        name: customer.name,
        account: customer.account,
        office: customer.office,
        phone: customer.phone ?? undefined,
        salesRep: customer.salesRep ?? undefined,
        visitDays: customer.visitDays ?? undefined,
        contactDays: customer.contactDays ?? undefined,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
      }
    } catch (error) {
      console.error('CustomersService.getById error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to fetch customer'
      )
    }
  }

  /**
   * List customers with pagination
   *
   * @param userId - Current user ID for RLS
   * @param options - List options (limit, offset, orderBy, orderDir)
   * @returns Object with customers array and total count
   *
   * @example
   * const { customers, total } = await CustomersService.list(currentUserId, { limit: 10 })
   */
  static async list(
    userId: string,
    options: CustomerListOptions = {}
  ): Promise<CustomerListResult> {
    try {
      if (!userId || userId.trim() === '') {
        throw new Error('User ID is required for authentication')
      }

      const {
        limit = 10,
        offset = 0,
        orderBy = 'name',
        orderDir = 'asc',
      } = options

      // Validate orderBy to prevent SQL injection
      const validOrderBy = ['name', 'account', 'office', 'salesRep', 'createdAt'].includes(orderBy)
        ? orderBy
        : 'name'
      const validOrderDir = orderDir === 'desc' ? 'DESC' : 'ASC'

      // Map field names to database columns
      const orderColumnMap: Record<string, string> = {
        name: 'name',
        account: 'account',
        office: 'office',
        salesRep: '"salesRep"',
        createdAt: '"createdAt"',
      }
      const orderColumn = orderColumnMap[validOrderBy] || 'name'

      // Get total count
      const countResult = await queryWithRLS<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM customers`,
        [],
        userId
      )
      const total = parseInt(countResult[0]?.count || '0', 10)

      // Get customers
      const customers = await queryWithRLS<DbCustomer>(
        `
        SELECT
          id,
          name,
          account,
          office,
          phone,
          "salesRep",
          "visitDays",
          "contactDays",
          "createdAt",
          "updatedAt"
        FROM customers
        ORDER BY ${orderColumn} ${validOrderDir}
        LIMIT $1 OFFSET $2
        `,
        [limit, offset],
        userId
      )

      return {
        customers: customers.map((customer) => ({
          id: customer.id,
          name: customer.name,
          account: customer.account,
          office: customer.office,
          phone: customer.phone ?? undefined,
          salesRep: customer.salesRep ?? undefined,
          visitDays: customer.visitDays ?? undefined,
          contactDays: customer.contactDays ?? undefined,
          createdAt: customer.createdAt,
          updatedAt: customer.updatedAt,
        })),
        total,
      }
    } catch (error) {
      console.error('CustomersService.list error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to list customers'
      )
    }
  }

  /**
   * Search customers by name, account, office, or salesRep
   *
   * @param userId - Current user ID for RLS
   * @param options - Search options (query, limit)
   * @returns Array of matching customers
   *
   * @example
   * const results = await CustomersService.search(currentUserId, { query: 'acme', limit: 5 })
   */
  static async search(
    userId: string,
    options: CustomerSearchOptions
  ): Promise<Customer[]> {
    try {
      if (!userId || userId.trim() === '') {
        throw new Error('User ID is required for authentication')
      }

      const { query, limit = 10 } = options

      if (!query || query.trim() === '') {
        return []
      }

      const searchTerm = `%${query.trim()}%`

      const customers = await queryWithRLS<DbCustomer>(
        `
        SELECT
          id,
          name,
          account,
          office,
          phone,
          "salesRep",
          "visitDays",
          "contactDays",
          "createdAt",
          "updatedAt"
        FROM customers
        WHERE
          name ILIKE $1
          OR office ILIKE $1
          OR "salesRep" ILIKE $1
          OR account::text ILIKE $1
        ORDER BY name ASC
        LIMIT $2
        `,
        [searchTerm, limit],
        userId
      )

      return customers.map((customer) => ({
        id: customer.id,
        name: customer.name,
        account: customer.account,
        office: customer.office,
        phone: customer.phone ?? undefined,
        salesRep: customer.salesRep ?? undefined,
        visitDays: customer.visitDays ?? undefined,
        contactDays: customer.contactDays ?? undefined,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
      }))
    } catch (error) {
      console.error('CustomersService.search error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to search customers'
      )
    }
  }

  // ============================================
  // WRITE METHODS (con RLS)
  // ============================================

  /**
   * Create a new customer
   *
   * @param userId - Current user ID for RLS
   * @param data - Customer data to create
   * @returns Created customer
   *
   * @example
   * const customer = await CustomersService.create(currentUserId, {
   *   name: 'Acme Corp',
   *   account: 12345,
   *   office: 'Central',
   *   teamId: 'team-123'
   * })
   */
  static async create(
    userId: string,
    data: CustomerCreateData
  ): Promise<Customer> {
    try {
      if (!userId || userId.trim() === '') {
        throw new Error('User ID is required for authentication')
      }

      if (!data.name || !data.office || data.account === undefined) {
        throw new Error('Name, account, and office are required')
      }

      const id = crypto.randomUUID()
      const now = new Date().toISOString()

      const result = await mutateWithRLS<DbCustomer>(
        `
        INSERT INTO customers (
          id, "userId", "teamId", name, account, office,
          phone, "salesRep", "visitDays", "contactDays",
          "createdAt", "updatedAt"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING
          id, name, account, office, phone, "salesRep",
          "visitDays", "contactDays", "createdAt", "updatedAt"
        `,
        [
          id,
          userId,
          data.teamId,
          data.name,
          data.account,
          data.office,
          data.phone || null,
          data.salesRep || null,
          data.visitDays ? JSON.stringify(data.visitDays) : null,
          data.contactDays ? JSON.stringify(data.contactDays) : null,
          now,
          now,
        ],
        userId
      )

      if (!result.rows[0]) {
        throw new Error('Failed to create customer')
      }

      const customer = result.rows[0]
      return {
        id: customer.id,
        name: customer.name,
        account: customer.account,
        office: customer.office,
        phone: customer.phone ?? undefined,
        salesRep: customer.salesRep ?? undefined,
        visitDays: customer.visitDays ?? undefined,
        contactDays: customer.contactDays ?? undefined,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
      }
    } catch (error) {
      console.error('CustomersService.create error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to create customer'
      )
    }
  }

  /**
   * Update an existing customer
   *
   * @param userId - Current user ID for RLS
   * @param id - Customer ID to update
   * @param data - Fields to update
   * @returns Updated customer
   *
   * @example
   * const customer = await CustomersService.update(currentUserId, 'customer-123', {
   *   phone: '555-1234',
   *   salesRep: 'John Doe'
   * })
   */
  static async update(
    userId: string,
    id: string,
    data: CustomerUpdateData
  ): Promise<Customer> {
    try {
      if (!userId || userId.trim() === '') {
        throw new Error('User ID is required for authentication')
      }

      if (!id || id.trim() === '') {
        throw new Error('Customer ID is required')
      }

      // Build dynamic update query
      const updates: string[] = []
      const values: unknown[] = []
      let paramIndex = 1

      if (data.name !== undefined) {
        updates.push(`name = $${paramIndex++}`)
        values.push(data.name)
      }
      if (data.account !== undefined) {
        updates.push(`account = $${paramIndex++}`)
        values.push(data.account)
      }
      if (data.office !== undefined) {
        updates.push(`office = $${paramIndex++}`)
        values.push(data.office)
      }
      if (data.phone !== undefined) {
        updates.push(`phone = $${paramIndex++}`)
        values.push(data.phone || null)
      }
      if (data.salesRep !== undefined) {
        updates.push(`"salesRep" = $${paramIndex++}`)
        values.push(data.salesRep || null)
      }
      if (data.visitDays !== undefined) {
        updates.push(`"visitDays" = $${paramIndex++}`)
        values.push(data.visitDays ? JSON.stringify(data.visitDays) : null)
      }
      if (data.contactDays !== undefined) {
        updates.push(`"contactDays" = $${paramIndex++}`)
        values.push(data.contactDays ? JSON.stringify(data.contactDays) : null)
      }

      if (updates.length === 0) {
        throw new Error('No fields to update')
      }

      updates.push(`"updatedAt" = $${paramIndex++}`)
      values.push(new Date().toISOString())

      values.push(id)

      const result = await mutateWithRLS<DbCustomer>(
        `
        UPDATE customers
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING
          id, name, account, office, phone, "salesRep",
          "visitDays", "contactDays", "createdAt", "updatedAt"
        `,
        values,
        userId
      )

      if (!result.rows[0]) {
        throw new Error('Customer not found or update failed')
      }

      const customer = result.rows[0]
      return {
        id: customer.id,
        name: customer.name,
        account: customer.account,
        office: customer.office,
        phone: customer.phone ?? undefined,
        salesRep: customer.salesRep ?? undefined,
        visitDays: customer.visitDays ?? undefined,
        contactDays: customer.contactDays ?? undefined,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
      }
    } catch (error) {
      console.error('CustomersService.update error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to update customer'
      )
    }
  }

  /**
   * Delete a customer
   *
   * @param userId - Current user ID for RLS
   * @param id - Customer ID to delete
   * @returns true if deleted successfully
   *
   * @example
   * const success = await CustomersService.delete(currentUserId, 'customer-123')
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
        throw new Error('Customer ID is required')
      }

      const result = await mutateWithRLS(
        `DELETE FROM customers WHERE id = $1`,
        [id],
        userId
      )

      return result.rowCount > 0
    } catch (error) {
      console.error('CustomersService.delete error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to delete customer'
      )
    }
  }
}
