/**
 * Pipelines Service
 *
 * Provides data access methods for pipelines.
 * Pipelines is a private entity - users only see pipelines in their team.
 *
 * All methods require authentication (use RLS with userId filter).
 *
 * @module PipelinesService
 */

import { queryOneWithRLS, queryWithRLS, mutateWithRLS } from '@nextsparkjs/core/lib/db'

// Pipeline stage interface
export interface PipelineStage {
  id: string
  name: string
  order: number
  probability?: number
}

// Pipeline interface
export interface Pipeline {
  id: string
  name: string
  description?: string
  isDefault?: boolean
  stages?: PipelineStage[]
  createdAt: string
  updatedAt: string
}

// List options
export interface PipelineListOptions {
  limit?: number
  offset?: number
  isDefault?: boolean
  orderBy?: 'name' | 'createdAt' | 'updatedAt'
  orderDir?: 'asc' | 'desc'
  teamId?: string
}

// List result
export interface PipelineListResult {
  pipelines: Pipeline[]
  total: number
}

// Create data
export interface PipelineCreateData {
  name: string
  description?: string
  isDefault?: boolean
  stages?: PipelineStage[]
  teamId: string
}

// Update data
export interface PipelineUpdateData {
  name?: string
  description?: string
  isDefault?: boolean
  stages?: PipelineStage[]
}

// Database row type
interface DbPipeline {
  id: string
  name: string
  description: string | null
  isDefault: boolean | null
  stages: string | null // JSON string
  createdAt: string
  updatedAt: string
}

export class PipelinesService {
  // ============================================
  // READ METHODS
  // ============================================

  /**
   * Get a pipeline by ID
   */
  static async getById(id: string, userId: string): Promise<Pipeline | null> {
    try {
      if (!id?.trim()) throw new Error('Pipeline ID is required')
      if (!userId?.trim()) throw new Error('User ID is required')

      const pipeline = await queryOneWithRLS<DbPipeline>(
        `SELECT id, name, description, "isDefault", stages, "createdAt", "updatedAt"
         FROM pipelines WHERE id = $1`,
        [id],
        userId
      )

      if (!pipeline) return null

      // Parse stages JSON
      let stages: PipelineStage[] | undefined
      if (pipeline.stages) {
        try {
          stages = JSON.parse(pipeline.stages)
        } catch (error) {
          console.error('Failed to parse pipeline stages:', error)
          stages = undefined
        }
      }

      return {
        id: pipeline.id,
        name: pipeline.name,
        description: pipeline.description ?? undefined,
        isDefault: pipeline.isDefault ?? undefined,
        stages,
        createdAt: pipeline.createdAt,
        updatedAt: pipeline.updatedAt,
      }
    } catch (error) {
      console.error('PipelinesService.getById error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch pipeline')
    }
  }

  /**
   * List pipelines with pagination and filtering
   */
  static async list(userId: string, options: PipelineListOptions = {}): Promise<PipelineListResult> {
    try {
      if (!userId?.trim()) throw new Error('User ID is required')

      const {
        limit = 10,
        offset = 0,
        isDefault,
        orderBy = 'createdAt',
        orderDir = 'desc',
        teamId,
      } = options

      // Build WHERE clause
      const conditions: string[] = []
      const params: unknown[] = []
      let paramIndex = 1

      if (isDefault !== undefined) {
        conditions.push(`"isDefault" = $${paramIndex++}`)
        params.push(isDefault)
      }

      if (teamId) {
        conditions.push(`"teamId" = $${paramIndex++}`)
        params.push(teamId)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      // Validate orderBy
      const validOrderBy = ['name', 'createdAt', 'updatedAt'].includes(orderBy) ? orderBy : 'createdAt'
      const validOrderDir = orderDir === 'asc' ? 'ASC' : 'DESC'
      const orderColumnMap: Record<string, string> = {
        name: 'name',
        createdAt: '"createdAt"',
        updatedAt: '"updatedAt"',
      }
      const orderColumn = orderColumnMap[validOrderBy] || '"createdAt"'

      // Get total count
      const countResult = await queryWithRLS<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM pipelines ${whereClause}`,
        params,
        userId
      )
      const total = parseInt(countResult[0]?.count || '0', 10)

      // Get pipelines
      params.push(limit, offset)
      const pipelines = await queryWithRLS<DbPipeline>(
        `SELECT id, name, description, "isDefault", stages, "createdAt", "updatedAt"
         FROM pipelines ${whereClause}
         ORDER BY ${orderColumn} ${validOrderDir}
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        params,
        userId
      )

      return {
        pipelines: pipelines.map((pipeline) => {
          // Parse stages JSON
          let stages: PipelineStage[] | undefined
          if (pipeline.stages) {
            try {
              stages = JSON.parse(pipeline.stages)
            } catch (error) {
              console.error('Failed to parse pipeline stages:', error)
              stages = undefined
            }
          }

          return {
            id: pipeline.id,
            name: pipeline.name,
            description: pipeline.description ?? undefined,
            isDefault: pipeline.isDefault ?? undefined,
            stages,
            createdAt: pipeline.createdAt,
            updatedAt: pipeline.updatedAt,
          }
        }),
        total,
      }
    } catch (error) {
      console.error('PipelinesService.list error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to list pipelines')
    }
  }

  /**
   * Get default pipeline
   */
  static async getDefault(userId: string): Promise<Pipeline | null> {
    const { pipelines } = await this.list(userId, {
      isDefault: true,
      limit: 1,
    })
    return pipelines[0] || null
  }

  // ============================================
  // WRITE METHODS
  // ============================================

  /**
   * Create a new pipeline
   */
  static async create(userId: string, data: PipelineCreateData): Promise<Pipeline> {
    try {
      if (!userId?.trim()) throw new Error('User ID is required')
      if (!data.name?.trim()) throw new Error('Pipeline name is required')
      if (!data.teamId?.trim()) throw new Error('Team ID is required')

      const id = crypto.randomUUID()
      const now = new Date().toISOString()

      // Serialize stages to JSON
      const stagesJson = data.stages ? JSON.stringify(data.stages) : null

      const result = await mutateWithRLS<DbPipeline>(
        `INSERT INTO pipelines (id, "userId", "teamId", name, description, "isDefault", stages, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, name, description, "isDefault", stages, "createdAt", "updatedAt"`,
        [
          id,
          userId,
          data.teamId,
          data.name,
          data.description || null,
          data.isDefault || false,
          stagesJson,
          now,
          now,
        ],
        userId
      )

      if (!result.rows[0]) throw new Error('Failed to create pipeline')

      const pipeline = result.rows[0]

      // Parse stages JSON
      let stages: PipelineStage[] | undefined
      if (pipeline.stages) {
        try {
          stages = JSON.parse(pipeline.stages)
        } catch (error) {
          console.error('Failed to parse pipeline stages:', error)
          stages = undefined
        }
      }

      return {
        id: pipeline.id,
        name: pipeline.name,
        description: pipeline.description ?? undefined,
        isDefault: pipeline.isDefault ?? undefined,
        stages,
        createdAt: pipeline.createdAt,
        updatedAt: pipeline.updatedAt,
      }
    } catch (error) {
      console.error('PipelinesService.create error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to create pipeline')
    }
  }

  /**
   * Update an existing pipeline
   */
  static async update(userId: string, id: string, data: PipelineUpdateData): Promise<Pipeline> {
    try {
      if (!userId?.trim()) throw new Error('User ID is required')
      if (!id?.trim()) throw new Error('Pipeline ID is required')

      const updates: string[] = []
      const values: unknown[] = []
      let paramIndex = 1

      if (data.name !== undefined) {
        updates.push(`name = $${paramIndex++}`)
        values.push(data.name)
      }
      if (data.description !== undefined) {
        updates.push(`description = $${paramIndex++}`)
        values.push(data.description || null)
      }
      if (data.isDefault !== undefined) {
        updates.push(`"isDefault" = $${paramIndex++}`)
        values.push(data.isDefault)
      }
      if (data.stages !== undefined) {
        updates.push(`stages = $${paramIndex++}`)
        values.push(data.stages ? JSON.stringify(data.stages) : null)
      }

      if (updates.length === 0) throw new Error('No fields to update')

      updates.push(`"updatedAt" = $${paramIndex++}`)
      values.push(new Date().toISOString())
      values.push(id)

      const result = await mutateWithRLS<DbPipeline>(
        `UPDATE pipelines SET ${updates.join(', ')} WHERE id = $${paramIndex}
         RETURNING id, name, description, "isDefault", stages, "createdAt", "updatedAt"`,
        values,
        userId
      )

      if (!result.rows[0]) throw new Error('Pipeline not found or update failed')

      const pipeline = result.rows[0]

      // Parse stages JSON
      let stages: PipelineStage[] | undefined
      if (pipeline.stages) {
        try {
          stages = JSON.parse(pipeline.stages)
        } catch (error) {
          console.error('Failed to parse pipeline stages:', error)
          stages = undefined
        }
      }

      return {
        id: pipeline.id,
        name: pipeline.name,
        description: pipeline.description ?? undefined,
        isDefault: pipeline.isDefault ?? undefined,
        stages,
        createdAt: pipeline.createdAt,
        updatedAt: pipeline.updatedAt,
      }
    } catch (error) {
      console.error('PipelinesService.update error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to update pipeline')
    }
  }

  /**
   * Delete a pipeline
   */
  static async delete(userId: string, id: string): Promise<boolean> {
    try {
      if (!userId?.trim()) throw new Error('User ID is required')
      if (!id?.trim()) throw new Error('Pipeline ID is required')

      const result = await mutateWithRLS(`DELETE FROM pipelines WHERE id = $1`, [id], userId)
      return result.rowCount > 0
    } catch (error) {
      console.error('PipelinesService.delete error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to delete pipeline')
    }
  }
}
