/**
 * Leads Service
 *
 * Provides data access methods for leads.
 * Leads is a private entity - users only see leads in their team.
 *
 * All methods require authentication (use RLS with userId filter).
 *
 * @module LeadsService
 */

import { queryOneWithRLS, queryWithRLS, mutateWithRLS } from '@nextsparkjs/core/lib/db'

// Lead source type
export type LeadSource = 'website' | 'referral' | 'social' | 'email' | 'event' | 'cold_call' | 'other'

// Lead status type
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost'

// Company size type
export type CompanySize = 'startup' | 'small' | 'medium' | 'enterprise'

// Lead interface
export interface Lead {
  id: string
  companyName: string
  contactName: string
  email: string
  phone?: string
  website?: string
  source: LeadSource
  status: LeadStatus
  score?: number
  industry?: string
  companySize?: CompanySize
  budget?: number
  assignedTo?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

// List options
export interface LeadListOptions {
  limit?: number
  offset?: number
  source?: LeadSource
  status?: LeadStatus
  companySize?: CompanySize
  minScore?: number
  assignedTo?: string
  orderBy?: 'companyName' | 'score' | 'createdAt' | 'updatedAt'
  orderDir?: 'asc' | 'desc'
  teamId?: string
}

// List result
export interface LeadListResult {
  leads: Lead[]
  total: number
}

// Create data
export interface LeadCreateData {
  companyName: string
  contactName: string
  email: string
  phone?: string
  website?: string
  source: LeadSource
  status?: LeadStatus
  score?: number
  industry?: string
  companySize?: CompanySize
  budget?: number
  assignedTo?: string
  notes?: string
  teamId: string
}

// Update data
export interface LeadUpdateData {
  companyName?: string
  contactName?: string
  email?: string
  phone?: string
  website?: string
  source?: LeadSource
  status?: LeadStatus
  score?: number
  industry?: string
  companySize?: CompanySize
  budget?: number
  assignedTo?: string
  notes?: string
}

// Database row type
interface DbLead {
  id: string
  companyName: string
  contactName: string
  email: string
  phone: string | null
  website: string | null
  source: LeadSource
  status: LeadStatus
  score: number | null
  industry: string | null
  companySize: CompanySize | null
  budget: number | null
  assignedTo: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export class LeadsService {
  // ============================================
  // READ METHODS
  // ============================================

  /**
   * Get a lead by ID
   */
  static async getById(id: string, userId: string): Promise<Lead | null> {
    try {
      if (!id?.trim()) throw new Error('Lead ID is required')
      if (!userId?.trim()) throw new Error('User ID is required')

      const lead = await queryOneWithRLS<DbLead>(
        `SELECT id, "companyName", "contactName", email, phone, website, source, status, score, industry, "companySize", budget, "assignedTo", notes, "createdAt", "updatedAt"
         FROM leads WHERE id = $1`,
        [id],
        userId
      )

      if (!lead) return null

      return {
        id: lead.id,
        companyName: lead.companyName,
        contactName: lead.contactName,
        email: lead.email,
        phone: lead.phone ?? undefined,
        website: lead.website ?? undefined,
        source: lead.source,
        status: lead.status,
        score: lead.score ?? undefined,
        industry: lead.industry ?? undefined,
        companySize: lead.companySize ?? undefined,
        budget: lead.budget ?? undefined,
        assignedTo: lead.assignedTo ?? undefined,
        notes: lead.notes ?? undefined,
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt,
      }
    } catch (error) {
      console.error('LeadsService.getById error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch lead')
    }
  }

  /**
   * List leads with pagination and filtering
   */
  static async list(userId: string, options: LeadListOptions = {}): Promise<LeadListResult> {
    try {
      if (!userId?.trim()) throw new Error('User ID is required')

      const {
        limit = 10,
        offset = 0,
        source,
        status,
        companySize,
        minScore,
        assignedTo,
        orderBy = 'createdAt',
        orderDir = 'desc',
        teamId,
      } = options

      // Build WHERE clause
      const conditions: string[] = []
      const params: unknown[] = []
      let paramIndex = 1

      if (source) {
        conditions.push(`source = $${paramIndex++}`)
        params.push(source)
      }

      if (status) {
        conditions.push(`status = $${paramIndex++}`)
        params.push(status)
      }

      if (companySize) {
        conditions.push(`"companySize" = $${paramIndex++}`)
        params.push(companySize)
      }

      if (minScore !== undefined) {
        conditions.push(`score >= $${paramIndex++}`)
        params.push(minScore)
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
      const validOrderBy = ['companyName', 'score', 'createdAt', 'updatedAt'].includes(orderBy) ? orderBy : 'createdAt'
      const validOrderDir = orderDir === 'asc' ? 'ASC' : 'DESC'
      const orderColumnMap: Record<string, string> = {
        companyName: '"companyName"',
        score: 'score',
        createdAt: '"createdAt"',
        updatedAt: '"updatedAt"',
      }
      const orderColumn = orderColumnMap[validOrderBy] || '"createdAt"'

      // Get total count
      const countResult = await queryWithRLS<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM leads ${whereClause}`,
        params,
        userId
      )
      const total = parseInt(countResult[0]?.count || '0', 10)

      // Get leads
      params.push(limit, offset)
      const leads = await queryWithRLS<DbLead>(
        `SELECT id, "companyName", "contactName", email, phone, website, source, status, score, industry, "companySize", budget, "assignedTo", notes, "createdAt", "updatedAt"
         FROM leads ${whereClause}
         ORDER BY ${orderColumn} ${validOrderDir}
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        params,
        userId
      )

      return {
        leads: leads.map((lead) => ({
          id: lead.id,
          companyName: lead.companyName,
          contactName: lead.contactName,
          email: lead.email,
          phone: lead.phone ?? undefined,
          website: lead.website ?? undefined,
          source: lead.source,
          status: lead.status,
          score: lead.score ?? undefined,
          industry: lead.industry ?? undefined,
          companySize: lead.companySize ?? undefined,
          budget: lead.budget ?? undefined,
          assignedTo: lead.assignedTo ?? undefined,
          notes: lead.notes ?? undefined,
          createdAt: lead.createdAt,
          updatedAt: lead.updatedAt,
        })),
        total,
      }
    } catch (error) {
      console.error('LeadsService.list error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to list leads')
    }
  }

  /**
   * Get leads by status
   */
  static async getByStatus(userId: string, status: LeadStatus, limit = 50): Promise<Lead[]> {
    const { leads } = await this.list(userId, {
      status,
      limit,
      orderBy: 'score',
      orderDir: 'desc',
    })
    return leads
  }

  /**
   * Get high-score leads (score >= 80)
   */
  static async getHighScore(userId: string, limit = 20): Promise<Lead[]> {
    const { leads } = await this.list(userId, {
      minScore: 80,
      limit,
      orderBy: 'score',
      orderDir: 'desc',
    })
    return leads
  }

  // ============================================
  // WRITE METHODS
  // ============================================

  /**
   * Create a new lead
   */
  static async create(userId: string, data: LeadCreateData): Promise<Lead> {
    try {
      if (!userId?.trim()) throw new Error('User ID is required')
      if (!data.companyName?.trim()) throw new Error('Company name is required')
      if (!data.contactName?.trim()) throw new Error('Contact name is required')
      if (!data.email?.trim()) throw new Error('Email is required')
      if (!data.teamId?.trim()) throw new Error('Team ID is required')

      const id = crypto.randomUUID()
      const now = new Date().toISOString()

      const result = await mutateWithRLS<DbLead>(
        `INSERT INTO leads (id, "userId", "teamId", "companyName", "contactName", email, phone, website, source, status, score, industry, "companySize", budget, "assignedTo", notes, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
         RETURNING id, "companyName", "contactName", email, phone, website, source, status, score, industry, "companySize", budget, "assignedTo", notes, "createdAt", "updatedAt"`,
        [
          id,
          userId,
          data.teamId,
          data.companyName,
          data.contactName,
          data.email,
          data.phone || null,
          data.website || null,
          data.source,
          data.status || 'new',
          data.score || null,
          data.industry || null,
          data.companySize || null,
          data.budget || null,
          data.assignedTo || null,
          data.notes || null,
          now,
          now,
        ],
        userId
      )

      if (!result.rows[0]) throw new Error('Failed to create lead')

      const lead = result.rows[0]
      return {
        id: lead.id,
        companyName: lead.companyName,
        contactName: lead.contactName,
        email: lead.email,
        phone: lead.phone ?? undefined,
        website: lead.website ?? undefined,
        source: lead.source,
        status: lead.status,
        score: lead.score ?? undefined,
        industry: lead.industry ?? undefined,
        companySize: lead.companySize ?? undefined,
        budget: lead.budget ?? undefined,
        assignedTo: lead.assignedTo ?? undefined,
        notes: lead.notes ?? undefined,
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt,
      }
    } catch (error) {
      console.error('LeadsService.create error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to create lead')
    }
  }

  /**
   * Update an existing lead
   */
  static async update(userId: string, id: string, data: LeadUpdateData): Promise<Lead> {
    try {
      if (!userId?.trim()) throw new Error('User ID is required')
      if (!id?.trim()) throw new Error('Lead ID is required')

      const updates: string[] = []
      const values: unknown[] = []
      let paramIndex = 1

      if (data.companyName !== undefined) {
        updates.push(`"companyName" = $${paramIndex++}`)
        values.push(data.companyName)
      }
      if (data.contactName !== undefined) {
        updates.push(`"contactName" = $${paramIndex++}`)
        values.push(data.contactName)
      }
      if (data.email !== undefined) {
        updates.push(`email = $${paramIndex++}`)
        values.push(data.email)
      }
      if (data.phone !== undefined) {
        updates.push(`phone = $${paramIndex++}`)
        values.push(data.phone || null)
      }
      if (data.website !== undefined) {
        updates.push(`website = $${paramIndex++}`)
        values.push(data.website || null)
      }
      if (data.source !== undefined) {
        updates.push(`source = $${paramIndex++}`)
        values.push(data.source)
      }
      if (data.status !== undefined) {
        updates.push(`status = $${paramIndex++}`)
        values.push(data.status)
      }
      if (data.score !== undefined) {
        updates.push(`score = $${paramIndex++}`)
        values.push(data.score)
      }
      if (data.industry !== undefined) {
        updates.push(`industry = $${paramIndex++}`)
        values.push(data.industry || null)
      }
      if (data.companySize !== undefined) {
        updates.push(`"companySize" = $${paramIndex++}`)
        values.push(data.companySize || null)
      }
      if (data.budget !== undefined) {
        updates.push(`budget = $${paramIndex++}`)
        values.push(data.budget)
      }
      if (data.assignedTo !== undefined) {
        updates.push(`"assignedTo" = $${paramIndex++}`)
        values.push(data.assignedTo || null)
      }
      if (data.notes !== undefined) {
        updates.push(`notes = $${paramIndex++}`)
        values.push(data.notes || null)
      }

      if (updates.length === 0) throw new Error('No fields to update')

      updates.push(`"updatedAt" = $${paramIndex++}`)
      values.push(new Date().toISOString())
      values.push(id)

      const result = await mutateWithRLS<DbLead>(
        `UPDATE leads SET ${updates.join(', ')} WHERE id = $${paramIndex}
         RETURNING id, "companyName", "contactName", email, phone, website, source, status, score, industry, "companySize", budget, "assignedTo", notes, "createdAt", "updatedAt"`,
        values,
        userId
      )

      if (!result.rows[0]) throw new Error('Lead not found or update failed')

      const lead = result.rows[0]
      return {
        id: lead.id,
        companyName: lead.companyName,
        contactName: lead.contactName,
        email: lead.email,
        phone: lead.phone ?? undefined,
        website: lead.website ?? undefined,
        source: lead.source,
        status: lead.status,
        score: lead.score ?? undefined,
        industry: lead.industry ?? undefined,
        companySize: lead.companySize ?? undefined,
        budget: lead.budget ?? undefined,
        assignedTo: lead.assignedTo ?? undefined,
        notes: lead.notes ?? undefined,
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt,
      }
    } catch (error) {
      console.error('LeadsService.update error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to update lead')
    }
  }

  /**
   * Delete a lead
   */
  static async delete(userId: string, id: string): Promise<boolean> {
    try {
      if (!userId?.trim()) throw new Error('User ID is required')
      if (!id?.trim()) throw new Error('Lead ID is required')

      const result = await mutateWithRLS(`DELETE FROM leads WHERE id = $1`, [id], userId)
      return result.rowCount > 0
    } catch (error) {
      console.error('LeadsService.delete error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to delete lead')
    }
  }
}
