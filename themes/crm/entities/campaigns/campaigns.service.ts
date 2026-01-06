/**
 * Campaigns Service
 *
 * Provides data access methods for campaigns.
 * Campaigns is a private entity - users only see campaigns in their team.
 *
 * All methods require authentication (use RLS with userId filter).
 *
 * @module CampaignsService
 */

import { queryOneWithRLS, queryWithRLS, mutateWithRLS } from '@nextsparkjs/core/lib/db'

// Campaign type
export type CampaignType = 'email' | 'social' | 'webinar' | 'event' | 'other'

// Campaign status type
export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed'

// Campaign interface
export interface Campaign {
  id: string
  name: string
  type: CampaignType
  status: CampaignStatus
  startDate?: string
  endDate?: string
  budget?: number
  actualCost?: number
  expectedRevenue?: number
  description?: string
  createdAt: string
  updatedAt: string
}

// List options
export interface CampaignListOptions {
  limit?: number
  offset?: number
  type?: CampaignType
  status?: CampaignStatus
  orderBy?: 'name' | 'startDate' | 'budget' | 'createdAt' | 'updatedAt'
  orderDir?: 'asc' | 'desc'
  teamId?: string
}

// List result
export interface CampaignListResult {
  campaigns: Campaign[]
  total: number
}

// Create data
export interface CampaignCreateData {
  name: string
  type: CampaignType
  status?: CampaignStatus
  startDate?: string
  endDate?: string
  budget?: number
  actualCost?: number
  expectedRevenue?: number
  description?: string
  teamId: string
}

// Update data
export interface CampaignUpdateData {
  name?: string
  type?: CampaignType
  status?: CampaignStatus
  startDate?: string
  endDate?: string
  budget?: number
  actualCost?: number
  expectedRevenue?: number
  description?: string
}

// Database row type
interface DbCampaign {
  id: string
  name: string
  type: CampaignType
  status: CampaignStatus
  startDate: string | null
  endDate: string | null
  budget: number | null
  actualCost: number | null
  expectedRevenue: number | null
  description: string | null
  createdAt: string
  updatedAt: string
}

export class CampaignsService {
  // ============================================
  // READ METHODS
  // ============================================

  /**
   * Get a campaign by ID
   */
  static async getById(id: string, userId: string): Promise<Campaign | null> {
    try {
      if (!id?.trim()) throw new Error('Campaign ID is required')
      if (!userId?.trim()) throw new Error('User ID is required')

      const campaign = await queryOneWithRLS<DbCampaign>(
        `SELECT id, name, type, status, "startDate", "endDate", budget, "actualCost", "expectedRevenue", description, "createdAt", "updatedAt"
         FROM campaigns WHERE id = $1`,
        [id],
        userId
      )

      if (!campaign) return null

      return {
        id: campaign.id,
        name: campaign.name,
        type: campaign.type,
        status: campaign.status,
        startDate: campaign.startDate ?? undefined,
        endDate: campaign.endDate ?? undefined,
        budget: campaign.budget ?? undefined,
        actualCost: campaign.actualCost ?? undefined,
        expectedRevenue: campaign.expectedRevenue ?? undefined,
        description: campaign.description ?? undefined,
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt,
      }
    } catch (error) {
      console.error('CampaignsService.getById error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch campaign')
    }
  }

  /**
   * List campaigns with pagination and filtering
   */
  static async list(userId: string, options: CampaignListOptions = {}): Promise<CampaignListResult> {
    try {
      if (!userId?.trim()) throw new Error('User ID is required')

      const {
        limit = 10,
        offset = 0,
        type,
        status,
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

      if (status) {
        conditions.push(`status = $${paramIndex++}`)
        params.push(status)
      }

      if (teamId) {
        conditions.push(`"teamId" = $${paramIndex++}`)
        params.push(teamId)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      // Validate orderBy
      const validOrderBy = ['name', 'startDate', 'budget', 'createdAt', 'updatedAt'].includes(orderBy) ? orderBy : 'createdAt'
      const validOrderDir = orderDir === 'asc' ? 'ASC' : 'DESC'
      const orderColumnMap: Record<string, string> = {
        name: 'name',
        startDate: '"startDate"',
        budget: 'budget',
        createdAt: '"createdAt"',
        updatedAt: '"updatedAt"',
      }
      const orderColumn = orderColumnMap[validOrderBy] || '"createdAt"'

      // Get total count
      const countResult = await queryWithRLS<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM campaigns ${whereClause}`,
        params,
        userId
      )
      const total = parseInt(countResult[0]?.count || '0', 10)

      // Get campaigns
      params.push(limit, offset)
      const campaigns = await queryWithRLS<DbCampaign>(
        `SELECT id, name, type, status, "startDate", "endDate", budget, "actualCost", "expectedRevenue", description, "createdAt", "updatedAt"
         FROM campaigns ${whereClause}
         ORDER BY ${orderColumn} ${validOrderDir}
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        params,
        userId
      )

      return {
        campaigns: campaigns.map((campaign) => ({
          id: campaign.id,
          name: campaign.name,
          type: campaign.type,
          status: campaign.status,
          startDate: campaign.startDate ?? undefined,
          endDate: campaign.endDate ?? undefined,
          budget: campaign.budget ?? undefined,
          actualCost: campaign.actualCost ?? undefined,
          expectedRevenue: campaign.expectedRevenue ?? undefined,
          description: campaign.description ?? undefined,
          createdAt: campaign.createdAt,
          updatedAt: campaign.updatedAt,
        })),
        total,
      }
    } catch (error) {
      console.error('CampaignsService.list error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to list campaigns')
    }
  }

  /**
   * Get campaigns by status
   */
  static async getByStatus(userId: string, status: CampaignStatus, limit = 50): Promise<Campaign[]> {
    const { campaigns } = await this.list(userId, {
      status,
      limit,
      orderBy: 'startDate',
      orderDir: 'desc',
    })
    return campaigns
  }

  /**
   * Get active campaigns
   */
  static async getActive(userId: string, limit = 20): Promise<Campaign[]> {
    return this.getByStatus(userId, 'active', limit)
  }

  /**
   * Get campaigns by type
   */
  static async getByType(userId: string, type: CampaignType, limit = 50): Promise<Campaign[]> {
    const { campaigns } = await this.list(userId, {
      type,
      limit,
      orderBy: 'startDate',
      orderDir: 'desc',
    })
    return campaigns
  }

  // ============================================
  // WRITE METHODS
  // ============================================

  /**
   * Create a new campaign
   */
  static async create(userId: string, data: CampaignCreateData): Promise<Campaign> {
    try {
      if (!userId?.trim()) throw new Error('User ID is required')
      if (!data.name?.trim()) throw new Error('Campaign name is required')
      if (!data.teamId?.trim()) throw new Error('Team ID is required')

      const id = crypto.randomUUID()
      const now = new Date().toISOString()

      const result = await mutateWithRLS<DbCampaign>(
        `INSERT INTO campaigns (id, "userId", "teamId", name, type, status, "startDate", "endDate", budget, "actualCost", "expectedRevenue", description, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING id, name, type, status, "startDate", "endDate", budget, "actualCost", "expectedRevenue", description, "createdAt", "updatedAt"`,
        [
          id,
          userId,
          data.teamId,
          data.name,
          data.type,
          data.status || 'draft',
          data.startDate || null,
          data.endDate || null,
          data.budget || null,
          data.actualCost || null,
          data.expectedRevenue || null,
          data.description || null,
          now,
          now,
        ],
        userId
      )

      if (!result.rows[0]) throw new Error('Failed to create campaign')

      const campaign = result.rows[0]
      return {
        id: campaign.id,
        name: campaign.name,
        type: campaign.type,
        status: campaign.status,
        startDate: campaign.startDate ?? undefined,
        endDate: campaign.endDate ?? undefined,
        budget: campaign.budget ?? undefined,
        actualCost: campaign.actualCost ?? undefined,
        expectedRevenue: campaign.expectedRevenue ?? undefined,
        description: campaign.description ?? undefined,
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt,
      }
    } catch (error) {
      console.error('CampaignsService.create error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to create campaign')
    }
  }

  /**
   * Update an existing campaign
   */
  static async update(userId: string, id: string, data: CampaignUpdateData): Promise<Campaign> {
    try {
      if (!userId?.trim()) throw new Error('User ID is required')
      if (!id?.trim()) throw new Error('Campaign ID is required')

      const updates: string[] = []
      const values: unknown[] = []
      let paramIndex = 1

      if (data.name !== undefined) {
        updates.push(`name = $${paramIndex++}`)
        values.push(data.name)
      }
      if (data.type !== undefined) {
        updates.push(`type = $${paramIndex++}`)
        values.push(data.type)
      }
      if (data.status !== undefined) {
        updates.push(`status = $${paramIndex++}`)
        values.push(data.status)
      }
      if (data.startDate !== undefined) {
        updates.push(`"startDate" = $${paramIndex++}`)
        values.push(data.startDate || null)
      }
      if (data.endDate !== undefined) {
        updates.push(`"endDate" = $${paramIndex++}`)
        values.push(data.endDate || null)
      }
      if (data.budget !== undefined) {
        updates.push(`budget = $${paramIndex++}`)
        values.push(data.budget)
      }
      if (data.actualCost !== undefined) {
        updates.push(`"actualCost" = $${paramIndex++}`)
        values.push(data.actualCost)
      }
      if (data.expectedRevenue !== undefined) {
        updates.push(`"expectedRevenue" = $${paramIndex++}`)
        values.push(data.expectedRevenue)
      }
      if (data.description !== undefined) {
        updates.push(`description = $${paramIndex++}`)
        values.push(data.description || null)
      }

      if (updates.length === 0) throw new Error('No fields to update')

      updates.push(`"updatedAt" = $${paramIndex++}`)
      values.push(new Date().toISOString())
      values.push(id)

      const result = await mutateWithRLS<DbCampaign>(
        `UPDATE campaigns SET ${updates.join(', ')} WHERE id = $${paramIndex}
         RETURNING id, name, type, status, "startDate", "endDate", budget, "actualCost", "expectedRevenue", description, "createdAt", "updatedAt"`,
        values,
        userId
      )

      if (!result.rows[0]) throw new Error('Campaign not found or update failed')

      const campaign = result.rows[0]
      return {
        id: campaign.id,
        name: campaign.name,
        type: campaign.type,
        status: campaign.status,
        startDate: campaign.startDate ?? undefined,
        endDate: campaign.endDate ?? undefined,
        budget: campaign.budget ?? undefined,
        actualCost: campaign.actualCost ?? undefined,
        expectedRevenue: campaign.expectedRevenue ?? undefined,
        description: campaign.description ?? undefined,
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt,
      }
    } catch (error) {
      console.error('CampaignsService.update error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to update campaign')
    }
  }

  /**
   * Delete a campaign
   */
  static async delete(userId: string, id: string): Promise<boolean> {
    try {
      if (!userId?.trim()) throw new Error('User ID is required')
      if (!id?.trim()) throw new Error('Campaign ID is required')

      const result = await mutateWithRLS(`DELETE FROM campaigns WHERE id = $1`, [id], userId)
      return result.rowCount > 0
    } catch (error) {
      console.error('CampaignsService.delete error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to delete campaign')
    }
  }
}
