/**
 * AI History Service
 *
 * Manages audit trail for all AI operations across plugins.
 * Provides consistent logging interface with status tracking.
 *
 * Lifecycle:
 * 1. startOperation() → status='pending'
 * 2. updateToProcessing() → status='processing' (optional)
 * 3. completeOperation() → status='completed' + metrics
 * 4. failOperation() → status='failed' + error
 */

import { query, queryOne } from '@nextsparkjs/core/lib/db'
import { AIHistoryMetaService } from './ai-history-meta-service'

export type AIOperation = 'generate' | 'refine' | 'analyze' | 'chat' | 'completion' | 'other'
export type AIProvider = 'anthropic' | 'openai' | 'google' | 'azure' | 'other'
export type AIStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface StartOperationParams {
  userId: string
  operation: AIOperation
  model: string
  provider?: AIProvider
  relatedEntityType?: string
  relatedEntityId?: string
  // NOTE: Metadata should be stored in ai_history_metas table via completeOperation(metas)
  // NOT in startOperation() - ai_history table has no metadata column
}

export interface CompleteOperationParams {
  historyId: string
  tokensUsed: number
  tokensInput?: number // Input tokens (prompt) - for precise cost calculation
  tokensOutput?: number // Output tokens (completion) - for precise cost calculation
  creditsUsed: number
  estimatedCost: number
  balanceAfter: number
  userId: string // ✅ NEW: Required for metadata operations
  metas?: Record<string, unknown> // ✅ NEW: Flexible metadata (sourceOperationId, userInstruction, etc.)
}

export interface FailOperationParams {
  historyId: string
  errorMessage: string
  tokensUsed?: number
}

export interface AIHistoryRecord {
  id: string
  userId: string
  relatedEntityType: string | null
  relatedEntityId: string | null
  operation: AIOperation
  model: string
  provider: AIProvider
  status: AIStatus
  tokensUsed: number | null
  creditsUsed: number | null
  estimatedCost: number | null
  balanceAfter: number | null
  errorMessage: string | null
  createdAt: Date
  completedAt: Date | null
}

export class AIHistoryService {
  /**
   * Start tracking an AI operation
   * Creates initial record with status='pending'
   *
   * @returns History ID for subsequent updates
   */
  static async startOperation(params: StartOperationParams): Promise<string> {
    const {
      userId,
      operation,
      model,
      provider = 'anthropic',
      relatedEntityType,
      relatedEntityId,
    } = params

    try {
      const result = await queryOne<{ id: string }>(
        `INSERT INTO "ai_history" (
          "userId",
          operation,
          model,
          provider,
          "relatedEntityType",
          "relatedEntityId",
          status,
          "createdAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, now())
        RETURNING id`,
        [userId, operation, model, provider, relatedEntityType || null, relatedEntityId || null, 'pending']
      )

      if (!result) {
        throw new Error('Failed to create AI history record')
      }

      return result.id
    } catch (error) {
      console.error('Error starting AI operation tracking:', error)
      throw error
    }
  }

  /**
   * Update operation to 'processing' status (optional)
   * Useful for long-running operations
   */
  static async updateToProcessing(historyId: string): Promise<void> {
    try {
      await query(
        `UPDATE "ai_history"
         SET status = 'processing'
         WHERE id = $1`,
        [historyId]
      )
    } catch (error) {
      console.error('Error updating AI history to processing:', error)
      // Non-critical, don't throw
    }
  }

  /**
   * Complete operation successfully
   * Updates status='completed', adds metrics, and saves metadata
   */
  static async completeOperation(params: CompleteOperationParams): Promise<void> {
    const { historyId, tokensUsed, tokensInput, tokensOutput, creditsUsed, estimatedCost, balanceAfter, userId, metas } = params

    try {
      // Update main ai_history record
      await query(
        `UPDATE "ai_history"
         SET status = 'completed',
             "tokensUsed" = $2,
             "tokensInput" = $3,
             "tokensOutput" = $4,
             "creditsUsed" = $5,
             "estimatedCost" = $6,
             "balanceAfter" = $7,
             "completedAt" = now()
         WHERE id = $1`,
        [historyId, tokensUsed, tokensInput || null, tokensOutput || null, creditsUsed, estimatedCost, balanceAfter]
      )

      // Save metadata to ai_history_metas table
      if (metas && Object.keys(metas).length > 0) {
        await AIHistoryMetaService.setBulkMetas(
          historyId,
          metas,
          userId,
          { isPublic: false, isSearchable: true }
        )
      }
    } catch (error) {
      console.error('Error completing AI operation:', error)
      // Log but don't throw - operation succeeded even if history update failed
    }
  }

  /**
   * Mark operation as failed
   * Updates status='failed' and adds error message
   */
  static async failOperation(params: FailOperationParams): Promise<void> {
    const { historyId, errorMessage, tokensUsed } = params

    try {
      await query(
        `UPDATE "ai_history"
         SET status = 'failed',
             "errorMessage" = $2,
             "tokensUsed" = $3,
             "completedAt" = now()
         WHERE id = $1`,
        [historyId, errorMessage, tokensUsed || null]
      )
    } catch (error) {
      console.error('Error marking AI operation as failed:', error)
      // Log but don't throw - we're already in error handling
    }
  }

  /**
   * Update related entity information for an existing operation
   * Useful when entity is created AFTER AI operation starts (e.g., analyze-brief)
   *
   * Use case: analyze-brief runs before client exists, then client is created,
   * and we need to link the AI history record to the newly created client.
   *
   * @param historyId - AI history record ID to update
   * @param relatedEntityType - Entity type (e.g., 'clients', 'products')
   * @param relatedEntityId - Entity ID (UUID)
   */
  static async updateRelatedEntity(
    historyId: string,
    relatedEntityType: string,
    relatedEntityId: string
  ): Promise<void> {
    try {
      await query(
        `UPDATE "ai_history"
         SET "relatedEntityType" = $2,
             "relatedEntityId" = $3
         WHERE id = $1`,
        [historyId, relatedEntityType, relatedEntityId]
      )
    } catch (error) {
      console.error('Error updating AI history related entity:', error)
      // Log but don't throw - non-critical update
    }
  }

  /**
   * Get operation history for a user
   * Useful for displaying usage analytics
   */
  static async getUserHistory(
    userId: string,
    options?: {
      limit?: number
      offset?: number
      operation?: AIOperation
      status?: AIStatus
    }
  ): Promise<AIHistoryRecord[]> {
    const { limit = 50, offset = 0, operation, status } = options || {}

    try {
      let sql = `
        SELECT * FROM "ai_history"
        WHERE "userId" = $1
      `
      const params: any[] = [userId]
      let paramIndex = 2

      if (operation) {
        sql += ` AND operation = $${paramIndex}`
        params.push(operation)
        paramIndex++
      }

      if (status) {
        sql += ` AND status = $${paramIndex}`
        params.push(status)
        paramIndex++
      }

      sql += ` ORDER BY "createdAt" DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
      params.push(limit, offset)

      const result = await query<AIHistoryRecord>(sql, params)
      return result.rows
    } catch (error) {
      console.error('Error getting user AI history:', error)
      return []
    }
  }

  /**
   * Get history for a specific related entity
   * Useful for showing AI operations on a content/product/etc
   */
  static async getEntityHistory(
    entityType: string,
    entityId: string,
    options?: {
      limit?: number
      operation?: AIOperation
    }
  ): Promise<AIHistoryRecord[]> {
    const { limit = 20, operation } = options || {}

    try {
      let sql = `
        SELECT * FROM "ai_history"
        WHERE "relatedEntityType" = $1 AND "relatedEntityId" = $2
      `
      const params: any[] = [entityType, entityId]
      let paramIndex = 3

      if (operation) {
        sql += ` AND operation = $${paramIndex}`
        params.push(operation)
        paramIndex++
      }

      sql += ` ORDER BY "createdAt" DESC LIMIT $${paramIndex}`
      params.push(limit)

      const result = await query<AIHistoryRecord>(sql, params)
      return result.rows
    } catch (error) {
      console.error('Error getting entity AI history:', error)
      return []
    }
  }

  /**
   * Get operation by ID
   */
  static async getOperation(historyId: string): Promise<AIHistoryRecord | null> {
    try {
      return await queryOne<AIHistoryRecord>(
        'SELECT * FROM "ai_history" WHERE id = $1',
        [historyId]
      )
    } catch (error) {
      console.error('Error getting AI operation:', error)
      return null
    }
  }

  /**
   * Get usage statistics for a user
   * Useful for analytics dashboards
   */
  static async getUserStats(userId: string, fromDate?: Date): Promise<{
    totalOperations: number
    totalTokens: number
    totalCredits: number
    totalCost: number
    successRate: number
    operationBreakdown: Record<AIOperation, number>
  }> {
    try {
      let sql = `
        SELECT
          COUNT(*) as total_operations,
          COALESCE(SUM("tokensUsed"), 0) as total_tokens,
          COALESCE(SUM("creditsUsed"), 0) as total_credits,
          COALESCE(SUM("estimatedCost"), 0) as total_cost,
          COUNT(*) FILTER (WHERE status = 'completed') as completed,
          operation
        FROM "ai_history"
        WHERE "userId" = $1
      `
      const params: any[] = [userId]

      if (fromDate) {
        sql += ` AND "createdAt" >= $2`
        params.push(fromDate)
      }

      sql += ` GROUP BY operation`

      const result = await query<{
        total_operations: string
        total_tokens: string
        total_credits: string
        total_cost: string
        completed: string
        operation: AIOperation
      }>(sql, params)

      const totalOps = result.rows.reduce((sum, r) => sum + parseInt(r.total_operations), 0)
      const totalCompleted = result.rows.reduce((sum, r) => sum + parseInt(r.completed), 0)

      const operationBreakdown: Record<string, number> = {}
      result.rows.forEach(row => {
        operationBreakdown[row.operation] = parseInt(row.total_operations)
      })

      return {
        totalOperations: totalOps,
        totalTokens: result.rows.reduce((sum, r) => sum + parseInt(r.total_tokens || '0'), 0),
        totalCredits: result.rows.reduce((sum, r) => sum + parseInt(r.total_credits || '0'), 0),
        totalCost: result.rows.reduce((sum, r) => sum + parseFloat(r.total_cost || '0'), 0),
        successRate: totalOps > 0 ? (totalCompleted / totalOps) * 100 : 0,
        operationBreakdown: operationBreakdown as Record<AIOperation, number>,
      }
    } catch (error) {
      console.error('Error getting user AI stats:', error)
      return {
        totalOperations: 0,
        totalTokens: 0,
        totalCredits: 0,
        totalCost: 0,
        successRate: 0,
        operationBreakdown: {} as Record<AIOperation, number>,
      }
    }
  }
}
