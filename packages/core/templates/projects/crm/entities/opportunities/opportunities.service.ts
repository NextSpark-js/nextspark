/**
 * Opportunities Service
 *
 * Provides data access methods for opportunities.
 * Opportunities is a private entity - users only see opportunities in their team.
 *
 * All methods require authentication (use RLS with userId filter).
 *
 * @module OpportunitiesService
 */

import { queryOneWithRLS, queryWithRLS, mutateWithRLS } from '@nextsparkjs/core/lib/db'

// Opportunity status type
export type OpportunityStatus = 'open' | 'won' | 'lost'

// Opportunity interface
export interface Opportunity {
  id: string
  name: string
  contactId?: string
  companyId?: string
  pipelineId?: string
  stageId?: string
  amount?: number
  probability?: number
  expectedCloseDate?: string
  status: OpportunityStatus
  assignedTo?: string
  description?: string
  createdAt: string
  updatedAt: string
}

// List options
export interface OpportunityListOptions {
  limit?: number
  offset?: number
  contactId?: string
  companyId?: string
  pipelineId?: string
  stageId?: string
  status?: OpportunityStatus
  minAmount?: number
  maxAmount?: number
  assignedTo?: string
  orderBy?: 'name' | 'amount' | 'expectedCloseDate' | 'createdAt' | 'updatedAt'
  orderDir?: 'asc' | 'desc'
  teamId?: string
}

// List result
export interface OpportunityListResult {
  opportunities: Opportunity[]
  total: number
}

// Create data
export interface OpportunityCreateData {
  name: string
  contactId?: string
  companyId?: string
  pipelineId?: string
  stageId?: string
  amount?: number
  probability?: number
  expectedCloseDate?: string
  status?: OpportunityStatus
  assignedTo?: string
  description?: string
  teamId: string
}

// Update data
export interface OpportunityUpdateData {
  name?: string
  contactId?: string
  companyId?: string
  pipelineId?: string
  stageId?: string
  amount?: number
  probability?: number
  expectedCloseDate?: string
  status?: OpportunityStatus
  assignedTo?: string
  description?: string
}

// Database row type
interface DbOpportunity {
  id: string
  name: string
  contactId: string | null
  companyId: string | null
  pipelineId: string | null
  stageId: string | null
  amount: number | null
  probability: number | null
  expectedCloseDate: string | null
  status: OpportunityStatus
  assignedTo: string | null
  description: string | null
  createdAt: string
  updatedAt: string
}

export class OpportunitiesService {
  // ============================================
  // READ METHODS
  // ============================================

  /**
   * Get an opportunity by ID
   */
  static async getById(id: string, userId: string): Promise<Opportunity | null> {
    try {
      if (!id?.trim()) throw new Error('Opportunity ID is required')
      if (!userId?.trim()) throw new Error('User ID is required')

      const opportunity = await queryOneWithRLS<DbOpportunity>(
        `SELECT id, name, "contactId", "companyId", "pipelineId", "stageId", amount, probability, "expectedCloseDate", status, "assignedTo", description, "createdAt", "updatedAt"
         FROM opportunities WHERE id = $1`,
        [id],
        userId
      )

      if (!opportunity) return null

      return {
        id: opportunity.id,
        name: opportunity.name,
        contactId: opportunity.contactId ?? undefined,
        companyId: opportunity.companyId ?? undefined,
        pipelineId: opportunity.pipelineId ?? undefined,
        stageId: opportunity.stageId ?? undefined,
        amount: opportunity.amount ?? undefined,
        probability: opportunity.probability ?? undefined,
        expectedCloseDate: opportunity.expectedCloseDate ?? undefined,
        status: opportunity.status,
        assignedTo: opportunity.assignedTo ?? undefined,
        description: opportunity.description ?? undefined,
        createdAt: opportunity.createdAt,
        updatedAt: opportunity.updatedAt,
      }
    } catch (error) {
      console.error('OpportunitiesService.getById error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch opportunity')
    }
  }

  /**
   * List opportunities with pagination and filtering
   */
  static async list(userId: string, options: OpportunityListOptions = {}): Promise<OpportunityListResult> {
    try {
      if (!userId?.trim()) throw new Error('User ID is required')

      const {
        limit = 10,
        offset = 0,
        contactId,
        companyId,
        pipelineId,
        stageId,
        status,
        minAmount,
        maxAmount,
        assignedTo,
        orderBy = 'createdAt',
        orderDir = 'desc',
        teamId,
      } = options

      // Build WHERE clause
      const conditions: string[] = []
      const params: unknown[] = []
      let paramIndex = 1

      if (contactId) {
        conditions.push(`"contactId" = $${paramIndex++}`)
        params.push(contactId)
      }

      if (companyId) {
        conditions.push(`"companyId" = $${paramIndex++}`)
        params.push(companyId)
      }

      if (pipelineId) {
        conditions.push(`"pipelineId" = $${paramIndex++}`)
        params.push(pipelineId)
      }

      if (stageId) {
        conditions.push(`"stageId" = $${paramIndex++}`)
        params.push(stageId)
      }

      if (status) {
        conditions.push(`status = $${paramIndex++}`)
        params.push(status)
      }

      if (minAmount !== undefined) {
        conditions.push(`amount >= $${paramIndex++}`)
        params.push(minAmount)
      }

      if (maxAmount !== undefined) {
        conditions.push(`amount <= $${paramIndex++}`)
        params.push(maxAmount)
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
      const validOrderBy = ['name', 'amount', 'expectedCloseDate', 'createdAt', 'updatedAt'].includes(orderBy) ? orderBy : 'createdAt'
      const validOrderDir = orderDir === 'asc' ? 'ASC' : 'DESC'
      const orderColumnMap: Record<string, string> = {
        name: 'name',
        amount: 'amount',
        expectedCloseDate: '"expectedCloseDate"',
        createdAt: '"createdAt"',
        updatedAt: '"updatedAt"',
      }
      const orderColumn = orderColumnMap[validOrderBy] || '"createdAt"'

      // Get total count
      const countResult = await queryWithRLS<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM opportunities ${whereClause}`,
        params,
        userId
      )
      const total = parseInt(countResult[0]?.count || '0', 10)

      // Get opportunities
      params.push(limit, offset)
      const opportunities = await queryWithRLS<DbOpportunity>(
        `SELECT id, name, "contactId", "companyId", "pipelineId", "stageId", amount, probability, "expectedCloseDate", status, "assignedTo", description, "createdAt", "updatedAt"
         FROM opportunities ${whereClause}
         ORDER BY ${orderColumn} ${validOrderDir}
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        params,
        userId
      )

      return {
        opportunities: opportunities.map((opportunity) => ({
          id: opportunity.id,
          name: opportunity.name,
          contactId: opportunity.contactId ?? undefined,
          companyId: opportunity.companyId ?? undefined,
          pipelineId: opportunity.pipelineId ?? undefined,
          stageId: opportunity.stageId ?? undefined,
          amount: opportunity.amount ?? undefined,
          probability: opportunity.probability ?? undefined,
          expectedCloseDate: opportunity.expectedCloseDate ?? undefined,
          status: opportunity.status,
          assignedTo: opportunity.assignedTo ?? undefined,
          description: opportunity.description ?? undefined,
          createdAt: opportunity.createdAt,
          updatedAt: opportunity.updatedAt,
        })),
        total,
      }
    } catch (error) {
      console.error('OpportunitiesService.list error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to list opportunities')
    }
  }

  /**
   * Get opportunities by status
   */
  static async getByStatus(userId: string, status: OpportunityStatus, limit = 50): Promise<Opportunity[]> {
    const { opportunities } = await this.list(userId, {
      status,
      limit,
      orderBy: 'amount',
      orderDir: 'desc',
    })
    return opportunities
  }

  /**
   * Get opportunities by company
   */
  static async getByCompany(userId: string, companyId: string, limit = 50): Promise<Opportunity[]> {
    const { opportunities } = await this.list(userId, {
      companyId,
      limit,
      orderBy: 'expectedCloseDate',
      orderDir: 'asc',
    })
    return opportunities
  }

  /**
   * Get opportunities closing soon (within 30 days)
   */
  static async getClosingSoon(userId: string, limit = 20): Promise<Opportunity[]> {
    try {
      if (!userId?.trim()) throw new Error('User ID is required')

      const opportunities = await queryWithRLS<DbOpportunity>(
        `SELECT id, name, "contactId", "companyId", "pipelineId", "stageId", amount, probability, "expectedCloseDate", status, "assignedTo", description, "createdAt", "updatedAt"
         FROM opportunities
         WHERE status = 'open'
           AND "expectedCloseDate" IS NOT NULL
           AND "expectedCloseDate" <= CURRENT_DATE + INTERVAL '30 days'
         ORDER BY "expectedCloseDate" ASC
         LIMIT $1`,
        [limit],
        userId
      )

      return opportunities.map((opportunity) => ({
        id: opportunity.id,
        name: opportunity.name,
        contactId: opportunity.contactId ?? undefined,
        companyId: opportunity.companyId ?? undefined,
        pipelineId: opportunity.pipelineId ?? undefined,
        stageId: opportunity.stageId ?? undefined,
        amount: opportunity.amount ?? undefined,
        probability: opportunity.probability ?? undefined,
        expectedCloseDate: opportunity.expectedCloseDate ?? undefined,
        status: opportunity.status,
        assignedTo: opportunity.assignedTo ?? undefined,
        description: opportunity.description ?? undefined,
        createdAt: opportunity.createdAt,
        updatedAt: opportunity.updatedAt,
      }))
    } catch (error) {
      console.error('OpportunitiesService.getClosingSoon error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch closing soon opportunities')
    }
  }

  // ============================================
  // WRITE METHODS
  // ============================================

  /**
   * Create a new opportunity
   */
  static async create(userId: string, data: OpportunityCreateData): Promise<Opportunity> {
    try {
      if (!userId?.trim()) throw new Error('User ID is required')
      if (!data.name?.trim()) throw new Error('Opportunity name is required')
      if (!data.teamId?.trim()) throw new Error('Team ID is required')

      const id = crypto.randomUUID()
      const now = new Date().toISOString()

      const result = await mutateWithRLS<DbOpportunity>(
        `INSERT INTO opportunities (id, "userId", "teamId", name, "contactId", "companyId", "pipelineId", "stageId", amount, probability, "expectedCloseDate", status, "assignedTo", description, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         RETURNING id, name, "contactId", "companyId", "pipelineId", "stageId", amount, probability, "expectedCloseDate", status, "assignedTo", description, "createdAt", "updatedAt"`,
        [
          id,
          userId,
          data.teamId,
          data.name,
          data.contactId || null,
          data.companyId || null,
          data.pipelineId || null,
          data.stageId || null,
          data.amount || null,
          data.probability || null,
          data.expectedCloseDate || null,
          data.status || 'open',
          data.assignedTo || null,
          data.description || null,
          now,
          now,
        ],
        userId
      )

      if (!result.rows[0]) throw new Error('Failed to create opportunity')

      const opportunity = result.rows[0]
      return {
        id: opportunity.id,
        name: opportunity.name,
        contactId: opportunity.contactId ?? undefined,
        companyId: opportunity.companyId ?? undefined,
        pipelineId: opportunity.pipelineId ?? undefined,
        stageId: opportunity.stageId ?? undefined,
        amount: opportunity.amount ?? undefined,
        probability: opportunity.probability ?? undefined,
        expectedCloseDate: opportunity.expectedCloseDate ?? undefined,
        status: opportunity.status,
        assignedTo: opportunity.assignedTo ?? undefined,
        description: opportunity.description ?? undefined,
        createdAt: opportunity.createdAt,
        updatedAt: opportunity.updatedAt,
      }
    } catch (error) {
      console.error('OpportunitiesService.create error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to create opportunity')
    }
  }

  /**
   * Update an existing opportunity
   */
  static async update(userId: string, id: string, data: OpportunityUpdateData): Promise<Opportunity> {
    try {
      if (!userId?.trim()) throw new Error('User ID is required')
      if (!id?.trim()) throw new Error('Opportunity ID is required')

      const updates: string[] = []
      const values: unknown[] = []
      let paramIndex = 1

      if (data.name !== undefined) {
        updates.push(`name = $${paramIndex++}`)
        values.push(data.name)
      }
      if (data.contactId !== undefined) {
        updates.push(`"contactId" = $${paramIndex++}`)
        values.push(data.contactId || null)
      }
      if (data.companyId !== undefined) {
        updates.push(`"companyId" = $${paramIndex++}`)
        values.push(data.companyId || null)
      }
      if (data.pipelineId !== undefined) {
        updates.push(`"pipelineId" = $${paramIndex++}`)
        values.push(data.pipelineId || null)
      }
      if (data.stageId !== undefined) {
        updates.push(`"stageId" = $${paramIndex++}`)
        values.push(data.stageId || null)
      }
      if (data.amount !== undefined) {
        updates.push(`amount = $${paramIndex++}`)
        values.push(data.amount)
      }
      if (data.probability !== undefined) {
        updates.push(`probability = $${paramIndex++}`)
        values.push(data.probability)
      }
      if (data.expectedCloseDate !== undefined) {
        updates.push(`"expectedCloseDate" = $${paramIndex++}`)
        values.push(data.expectedCloseDate || null)
      }
      if (data.status !== undefined) {
        updates.push(`status = $${paramIndex++}`)
        values.push(data.status)
      }
      if (data.assignedTo !== undefined) {
        updates.push(`"assignedTo" = $${paramIndex++}`)
        values.push(data.assignedTo || null)
      }
      if (data.description !== undefined) {
        updates.push(`description = $${paramIndex++}`)
        values.push(data.description || null)
      }

      if (updates.length === 0) throw new Error('No fields to update')

      updates.push(`"updatedAt" = $${paramIndex++}`)
      values.push(new Date().toISOString())
      values.push(id)

      const result = await mutateWithRLS<DbOpportunity>(
        `UPDATE opportunities SET ${updates.join(', ')} WHERE id = $${paramIndex}
         RETURNING id, name, "contactId", "companyId", "pipelineId", "stageId", amount, probability, "expectedCloseDate", status, "assignedTo", description, "createdAt", "updatedAt"`,
        values,
        userId
      )

      if (!result.rows[0]) throw new Error('Opportunity not found or update failed')

      const opportunity = result.rows[0]
      return {
        id: opportunity.id,
        name: opportunity.name,
        contactId: opportunity.contactId ?? undefined,
        companyId: opportunity.companyId ?? undefined,
        pipelineId: opportunity.pipelineId ?? undefined,
        stageId: opportunity.stageId ?? undefined,
        amount: opportunity.amount ?? undefined,
        probability: opportunity.probability ?? undefined,
        expectedCloseDate: opportunity.expectedCloseDate ?? undefined,
        status: opportunity.status,
        assignedTo: opportunity.assignedTo ?? undefined,
        description: opportunity.description ?? undefined,
        createdAt: opportunity.createdAt,
        updatedAt: opportunity.updatedAt,
      }
    } catch (error) {
      console.error('OpportunitiesService.update error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to update opportunity')
    }
  }

  /**
   * Delete an opportunity
   */
  static async delete(userId: string, id: string): Promise<boolean> {
    try {
      if (!userId?.trim()) throw new Error('User ID is required')
      if (!id?.trim()) throw new Error('Opportunity ID is required')

      const result = await mutateWithRLS(`DELETE FROM opportunities WHERE id = $1`, [id], userId)
      return result.rowCount > 0
    } catch (error) {
      console.error('OpportunitiesService.delete error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to delete opportunity')
    }
  }
}
