/**
 * Companies Service
 *
 * Provides data access methods for companies.
 * Companies is a private entity - users only see companies in their team.
 *
 * All methods require authentication (use RLS with userId filter).
 *
 * @module CompaniesService
 */

import { queryOneWithRLS, queryWithRLS, mutateWithRLS } from '@nextsparkjs/core/lib/db'

// Company type
export type CompanyType = 'customer' | 'prospect' | 'partner' | 'vendor' | 'competitor'

// Company size type
export type CompanySize = 'startup' | 'small' | 'medium' | 'enterprise'

// Company rating type
export type CompanyRating = 'cold' | 'warm' | 'hot'

// Company interface
export interface Company {
  id: string
  name: string
  legalName?: string
  taxId?: string
  website?: string
  email?: string
  phone?: string
  industry?: string
  type?: CompanyType
  size?: CompanySize
  annualRevenue?: number
  address?: string
  city?: string
  state?: string
  country?: string
  postalCode?: string
  logo?: string
  rating?: CompanyRating
  assignedTo?: string
  createdAt: string
  updatedAt: string
}

// List options
export interface CompanyListOptions {
  limit?: number
  offset?: number
  type?: CompanyType
  size?: CompanySize
  rating?: CompanyRating
  industry?: string
  country?: string
  assignedTo?: string
  orderBy?: 'name' | 'annualRevenue' | 'createdAt' | 'updatedAt'
  orderDir?: 'asc' | 'desc'
  teamId?: string
}

// List result
export interface CompanyListResult {
  companies: Company[]
  total: number
}

// Create data
export interface CompanyCreateData {
  name: string
  legalName?: string
  taxId?: string
  website?: string
  email?: string
  phone?: string
  industry?: string
  type?: CompanyType
  size?: CompanySize
  annualRevenue?: number
  address?: string
  city?: string
  state?: string
  country?: string
  postalCode?: string
  logo?: string
  rating?: CompanyRating
  assignedTo?: string
  teamId: string
}

// Update data
export interface CompanyUpdateData {
  name?: string
  legalName?: string
  taxId?: string
  website?: string
  email?: string
  phone?: string
  industry?: string
  type?: CompanyType
  size?: CompanySize
  annualRevenue?: number
  address?: string
  city?: string
  state?: string
  country?: string
  postalCode?: string
  logo?: string
  rating?: CompanyRating
  assignedTo?: string
}

// Database row type
interface DbCompany {
  id: string
  name: string
  legalName: string | null
  taxId: string | null
  website: string | null
  email: string | null
  phone: string | null
  industry: string | null
  type: CompanyType | null
  size: CompanySize | null
  annualRevenue: number | null
  address: string | null
  city: string | null
  state: string | null
  country: string | null
  postalCode: string | null
  logo: string | null
  rating: CompanyRating | null
  assignedTo: string | null
  createdAt: string
  updatedAt: string
}

export class CompaniesService {
  // ============================================
  // READ METHODS
  // ============================================

  /**
   * Get a company by ID
   */
  static async getById(id: string, userId: string): Promise<Company | null> {
    try {
      if (!id?.trim()) throw new Error('Company ID is required')
      if (!userId?.trim()) throw new Error('User ID is required')

      const company = await queryOneWithRLS<DbCompany>(
        `SELECT id, name, "legalName", "taxId", website, email, phone, industry, type, size, "annualRevenue", address, city, state, country, "postalCode", logo, rating, "assignedTo", "createdAt", "updatedAt"
         FROM companies WHERE id = $1`,
        [id],
        userId
      )

      if (!company) return null

      return {
        id: company.id,
        name: company.name,
        legalName: company.legalName ?? undefined,
        taxId: company.taxId ?? undefined,
        website: company.website ?? undefined,
        email: company.email ?? undefined,
        phone: company.phone ?? undefined,
        industry: company.industry ?? undefined,
        type: company.type ?? undefined,
        size: company.size ?? undefined,
        annualRevenue: company.annualRevenue ?? undefined,
        address: company.address ?? undefined,
        city: company.city ?? undefined,
        state: company.state ?? undefined,
        country: company.country ?? undefined,
        postalCode: company.postalCode ?? undefined,
        logo: company.logo ?? undefined,
        rating: company.rating ?? undefined,
        assignedTo: company.assignedTo ?? undefined,
        createdAt: company.createdAt,
        updatedAt: company.updatedAt,
      }
    } catch (error) {
      console.error('CompaniesService.getById error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch company')
    }
  }

  /**
   * List companies with pagination and filtering
   */
  static async list(userId: string, options: CompanyListOptions = {}): Promise<CompanyListResult> {
    try {
      if (!userId?.trim()) throw new Error('User ID is required')

      const {
        limit = 10,
        offset = 0,
        type,
        size,
        rating,
        industry,
        country,
        assignedTo,
        orderBy = 'createdAt',
        orderDir = 'desc',
        teamId,
      } = options

      // Build WHERE clause
      const conditions: string[] = []
      const params: unknown[] = []
      let paramIndex = 1

      if (type) {
        conditions.push(`type = $${paramIndex++}`)
        params.push(type)
      }

      if (size) {
        conditions.push(`size = $${paramIndex++}`)
        params.push(size)
      }

      if (rating) {
        conditions.push(`rating = $${paramIndex++}`)
        params.push(rating)
      }

      if (industry) {
        conditions.push(`industry = $${paramIndex++}`)
        params.push(industry)
      }

      if (country) {
        conditions.push(`country = $${paramIndex++}`)
        params.push(country)
      }

      if (assignedTo) {
        conditions.push(`"assignedTo" = $${paramIndex++}`)
        params.push(assignedTo)
      }

      if (teamId) {
        conditions.push(`"teamId" = $${paramIndex++}`)
        params.push(teamId)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      // Validate orderBy
      const validOrderBy = ['name', 'annualRevenue', 'createdAt', 'updatedAt'].includes(orderBy) ? orderBy : 'createdAt'
      const validOrderDir = orderDir === 'asc' ? 'ASC' : 'DESC'
      const orderColumnMap: Record<string, string> = {
        name: 'name',
        annualRevenue: '"annualRevenue"',
        createdAt: '"createdAt"',
        updatedAt: '"updatedAt"',
      }
      const orderColumn = orderColumnMap[validOrderBy] || '"createdAt"'

      // Get total count
      const countResult = await queryWithRLS<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM companies ${whereClause}`,
        params,
        userId
      )
      const total = parseInt(countResult[0]?.count || '0', 10)

      // Get companies
      params.push(limit, offset)
      const companies = await queryWithRLS<DbCompany>(
        `SELECT id, name, "legalName", "taxId", website, email, phone, industry, type, size, "annualRevenue", address, city, state, country, "postalCode", logo, rating, "assignedTo", "createdAt", "updatedAt"
         FROM companies ${whereClause}
         ORDER BY ${orderColumn} ${validOrderDir}
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        params,
        userId
      )

      return {
        companies: companies.map((company) => ({
          id: company.id,
          name: company.name,
          legalName: company.legalName ?? undefined,
          taxId: company.taxId ?? undefined,
          website: company.website ?? undefined,
          email: company.email ?? undefined,
          phone: company.phone ?? undefined,
          industry: company.industry ?? undefined,
          type: company.type ?? undefined,
          size: company.size ?? undefined,
          annualRevenue: company.annualRevenue ?? undefined,
          address: company.address ?? undefined,
          city: company.city ?? undefined,
          state: company.state ?? undefined,
          country: company.country ?? undefined,
          postalCode: company.postalCode ?? undefined,
          logo: company.logo ?? undefined,
          rating: company.rating ?? undefined,
          assignedTo: company.assignedTo ?? undefined,
          createdAt: company.createdAt,
          updatedAt: company.updatedAt,
        })),
        total,
      }
    } catch (error) {
      console.error('CompaniesService.list error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to list companies')
    }
  }

  /**
   * Get companies by type
   */
  static async getByType(userId: string, type: CompanyType, limit = 50): Promise<Company[]> {
    const { companies } = await this.list(userId, {
      type,
      limit,
      orderBy: 'name',
      orderDir: 'asc',
    })
    return companies
  }

  /**
   * Get hot-rated companies
   */
  static async getHotRated(userId: string, limit = 20): Promise<Company[]> {
    const { companies } = await this.list(userId, {
      rating: 'hot',
      limit,
      orderBy: 'annualRevenue',
      orderDir: 'desc',
    })
    return companies
  }

  // ============================================
  // WRITE METHODS
  // ============================================

  /**
   * Create a new company
   */
  static async create(userId: string, data: CompanyCreateData): Promise<Company> {
    try {
      if (!userId?.trim()) throw new Error('User ID is required')
      if (!data.name?.trim()) throw new Error('Company name is required')
      if (!data.teamId?.trim()) throw new Error('Team ID is required')

      const id = crypto.randomUUID()
      const now = new Date().toISOString()

      const result = await mutateWithRLS<DbCompany>(
        `INSERT INTO companies (id, "userId", "teamId", name, "legalName", "taxId", website, email, phone, industry, type, size, "annualRevenue", address, city, state, country, "postalCode", logo, rating, "assignedTo", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
         RETURNING id, name, "legalName", "taxId", website, email, phone, industry, type, size, "annualRevenue", address, city, state, country, "postalCode", logo, rating, "assignedTo", "createdAt", "updatedAt"`,
        [
          id,
          userId,
          data.teamId,
          data.name,
          data.legalName || null,
          data.taxId || null,
          data.website || null,
          data.email || null,
          data.phone || null,
          data.industry || null,
          data.type || null,
          data.size || null,
          data.annualRevenue || null,
          data.address || null,
          data.city || null,
          data.state || null,
          data.country || null,
          data.postalCode || null,
          data.logo || null,
          data.rating || null,
          data.assignedTo || null,
          now,
          now,
        ],
        userId
      )

      if (!result.rows[0]) throw new Error('Failed to create company')

      const company = result.rows[0]
      return {
        id: company.id,
        name: company.name,
        legalName: company.legalName ?? undefined,
        taxId: company.taxId ?? undefined,
        website: company.website ?? undefined,
        email: company.email ?? undefined,
        phone: company.phone ?? undefined,
        industry: company.industry ?? undefined,
        type: company.type ?? undefined,
        size: company.size ?? undefined,
        annualRevenue: company.annualRevenue ?? undefined,
        address: company.address ?? undefined,
        city: company.city ?? undefined,
        state: company.state ?? undefined,
        country: company.country ?? undefined,
        postalCode: company.postalCode ?? undefined,
        logo: company.logo ?? undefined,
        rating: company.rating ?? undefined,
        assignedTo: company.assignedTo ?? undefined,
        createdAt: company.createdAt,
        updatedAt: company.updatedAt,
      }
    } catch (error) {
      console.error('CompaniesService.create error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to create company')
    }
  }

  /**
   * Update an existing company
   */
  static async update(userId: string, id: string, data: CompanyUpdateData): Promise<Company> {
    try {
      if (!userId?.trim()) throw new Error('User ID is required')
      if (!id?.trim()) throw new Error('Company ID is required')

      const updates: string[] = []
      const values: unknown[] = []
      let paramIndex = 1

      if (data.name !== undefined) {
        updates.push(`name = $${paramIndex++}`)
        values.push(data.name)
      }
      if (data.legalName !== undefined) {
        updates.push(`"legalName" = $${paramIndex++}`)
        values.push(data.legalName || null)
      }
      if (data.taxId !== undefined) {
        updates.push(`"taxId" = $${paramIndex++}`)
        values.push(data.taxId || null)
      }
      if (data.website !== undefined) {
        updates.push(`website = $${paramIndex++}`)
        values.push(data.website || null)
      }
      if (data.email !== undefined) {
        updates.push(`email = $${paramIndex++}`)
        values.push(data.email || null)
      }
      if (data.phone !== undefined) {
        updates.push(`phone = $${paramIndex++}`)
        values.push(data.phone || null)
      }
      if (data.industry !== undefined) {
        updates.push(`industry = $${paramIndex++}`)
        values.push(data.industry || null)
      }
      if (data.type !== undefined) {
        updates.push(`type = $${paramIndex++}`)
        values.push(data.type || null)
      }
      if (data.size !== undefined) {
        updates.push(`size = $${paramIndex++}`)
        values.push(data.size || null)
      }
      if (data.annualRevenue !== undefined) {
        updates.push(`"annualRevenue" = $${paramIndex++}`)
        values.push(data.annualRevenue)
      }
      if (data.address !== undefined) {
        updates.push(`address = $${paramIndex++}`)
        values.push(data.address || null)
      }
      if (data.city !== undefined) {
        updates.push(`city = $${paramIndex++}`)
        values.push(data.city || null)
      }
      if (data.state !== undefined) {
        updates.push(`state = $${paramIndex++}`)
        values.push(data.state || null)
      }
      if (data.country !== undefined) {
        updates.push(`country = $${paramIndex++}`)
        values.push(data.country || null)
      }
      if (data.postalCode !== undefined) {
        updates.push(`"postalCode" = $${paramIndex++}`)
        values.push(data.postalCode || null)
      }
      if (data.logo !== undefined) {
        updates.push(`logo = $${paramIndex++}`)
        values.push(data.logo || null)
      }
      if (data.rating !== undefined) {
        updates.push(`rating = $${paramIndex++}`)
        values.push(data.rating || null)
      }
      if (data.assignedTo !== undefined) {
        updates.push(`"assignedTo" = $${paramIndex++}`)
        values.push(data.assignedTo || null)
      }

      if (updates.length === 0) throw new Error('No fields to update')

      updates.push(`"updatedAt" = $${paramIndex++}`)
      values.push(new Date().toISOString())
      values.push(id)

      const result = await mutateWithRLS<DbCompany>(
        `UPDATE companies SET ${updates.join(', ')} WHERE id = $${paramIndex}
         RETURNING id, name, "legalName", "taxId", website, email, phone, industry, type, size, "annualRevenue", address, city, state, country, "postalCode", logo, rating, "assignedTo", "createdAt", "updatedAt"`,
        values,
        userId
      )

      if (!result.rows[0]) throw new Error('Company not found or update failed')

      const company = result.rows[0]
      return {
        id: company.id,
        name: company.name,
        legalName: company.legalName ?? undefined,
        taxId: company.taxId ?? undefined,
        website: company.website ?? undefined,
        email: company.email ?? undefined,
        phone: company.phone ?? undefined,
        industry: company.industry ?? undefined,
        type: company.type ?? undefined,
        size: company.size ?? undefined,
        annualRevenue: company.annualRevenue ?? undefined,
        address: company.address ?? undefined,
        city: company.city ?? undefined,
        state: company.state ?? undefined,
        country: company.country ?? undefined,
        postalCode: company.postalCode ?? undefined,
        logo: company.logo ?? undefined,
        rating: company.rating ?? undefined,
        assignedTo: company.assignedTo ?? undefined,
        createdAt: company.createdAt,
        updatedAt: company.updatedAt,
      }
    } catch (error) {
      console.error('CompaniesService.update error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to update company')
    }
  }

  /**
   * Delete a company
   */
  static async delete(userId: string, id: string): Promise<boolean> {
    try {
      if (!userId?.trim()) throw new Error('User ID is required')
      if (!id?.trim()) throw new Error('Company ID is required')

      const result = await mutateWithRLS(`DELETE FROM companies WHERE id = $1`, [id], userId)
      return result.rowCount > 0
    } catch (error) {
      console.error('CompaniesService.delete error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to delete company')
    }
  }
}
