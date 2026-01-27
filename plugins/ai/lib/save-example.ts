/**
 * AI History Saving - PostgreSQL Implementation
 *
 * Uses project's PostgreSQL connection with RLS support.
 * Saves AI interactions to the ai_history table.
 */

import { mutateWithRLS, queryWithRLS } from '@nextsparkjs/core/lib/db'
import { sanitizePrompt, sanitizeResponse } from './sanitize'

export interface AIExampleData {
  prompt: string
  response: string
  model: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  operation?: 'generate' | 'refine' | 'analyze' | 'chat' | 'completion' | 'other'
  provider?: string
  metadata?: {
    tokens?: number
    tokensInput?: number
    tokensOutput?: number
    cost?: number
    duration?: number
    isLocal?: boolean
    platforms?: number
    imagesProcessed?: number
    relatedEntityType?: string
    relatedEntityId?: string
  }
}

export interface SaveExampleResult {
  success: boolean
  id?: string
  error?: string
  sanitizationApplied?: boolean
}

/**
 * Save AI interaction to ai_history table
 */
export async function saveAIExample(
  data: AIExampleData,
  userId: string,
  teamId: string
): Promise<SaveExampleResult> {
  try {
    // 1. Sanitize sensitive data
    const sanitizedPrompt = sanitizePrompt(data.prompt)
    const sanitizedResponse = sanitizeResponse(data.response)

    const sanitizationApplied =
      sanitizedPrompt !== data.prompt ||
      sanitizedResponse !== data.response

    // 2. Extract token info
    const tokensInput = data.metadata?.tokensInput || 0
    const tokensOutput = data.metadata?.tokensOutput || 0
    const tokensUsed = data.metadata?.tokens || (tokensInput + tokensOutput)

    // 3. Insert into ai_history table with RLS
    const query = `
      INSERT INTO ai_history (
        "userId", "teamId", operation, model, provider, status,
        "tokensUsed", "tokensInput", "tokensOutput", "estimatedCost",
        "relatedEntityType", "relatedEntityId",
        "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
      RETURNING id
    `

    const params = [
      userId,
      teamId,
      data.operation || 'generate',
      data.model,
      data.provider || 'ollama',
      data.status,
      tokensUsed || null,
      tokensInput || null,
      tokensOutput || null,
      data.metadata?.cost || null,
      data.metadata?.relatedEntityType || null,
      data.metadata?.relatedEntityId || null
    ]

    const result = await mutateWithRLS<{ id: string }>(query, params, userId)

    if (result.rowCount === 0 || !result.rows[0]) {
      return {
        success: false,
        error: 'Failed to insert ai_history record'
      }
    }

    console.log('[AI Plugin] History saved to database:', {
      id: result.rows[0].id,
      operation: data.operation || 'generate',
      model: data.model,
      sanitizationApplied
    })

    return {
      success: true,
      id: result.rows[0].id,
      sanitizationApplied
    }

  } catch (error) {
    console.error('[AI Plugin] Save history failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Get AI history from PostgreSQL
 */
export async function getAIExamples(params: {
  userId?: string
  teamId?: string
  limit?: number
  offset?: number
  status?: string
  operation?: string
}) {
  try {
    const { userId, teamId, limit = 50, offset = 0, status, operation } = params

    let query = `
      SELECT id, "userId", "teamId", operation, model, provider, status,
             "tokensUsed", "tokensInput", "tokensOutput", "estimatedCost",
             "relatedEntityType", "relatedEntityId",
             "createdAt", "updatedAt", "completedAt"
      FROM ai_history
      WHERE 1=1
    `
    const queryParams: (string | number)[] = []

    if (teamId) {
      queryParams.push(teamId)
      query += ` AND "teamId" = $${queryParams.length}`
    }

    if (status) {
      queryParams.push(status)
      query += ` AND status = $${queryParams.length}`
    }

    if (operation) {
      queryParams.push(operation)
      query += ` AND operation = $${queryParams.length}`
    }

    query += ` ORDER BY "createdAt" DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`
    queryParams.push(limit, offset)

    const rows = await queryWithRLS(query, queryParams, userId)

    return {
      success: true,
      data: rows
    }
  } catch (error) {
    console.error('[AI Plugin] Get history failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      data: []
    }
  }
}

/**
 * Get single AI history record by ID
 */
export async function getAIExampleById(id: string, userId?: string) {
  try {
    const query = `
      SELECT id, "userId", "teamId", operation, model, provider, status,
             "tokensUsed", "tokensInput", "tokensOutput", "estimatedCost",
             "relatedEntityType", "relatedEntityId",
             "createdAt", "updatedAt", "completedAt"
      FROM ai_history
      WHERE id = $1
    `

    const rows = await queryWithRLS(query, [id], userId)

    if (rows.length === 0) {
      return {
        success: false,
        error: 'History record not found'
      }
    }

    return {
      success: true,
      data: rows[0]
    }
  } catch (error) {
    console.error('[AI Plugin] Get history by ID failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Delete AI history record
 */
export async function deleteAIExample(id: string, userId: string) {
  try {
    const query = `DELETE FROM ai_history WHERE id = $1 RETURNING id`

    const result = await mutateWithRLS<{ id: string }>(query, [id], userId)

    if (result.rowCount === 0) {
      return {
        success: false,
        error: 'History record not found or unauthorized'
      }
    }

    return {
      success: true,
      id: result.rows[0].id
    }
  } catch (error) {
    console.error('[AI Plugin] Delete history failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Save history with automatic error handling (fire-and-forget)
 */
export async function saveExampleSafely(
  data: AIExampleData,
  userId: string,
  teamId: string
): Promise<void> {
  try {
    const result = await saveAIExample(data, userId, teamId)

    if (!result.success) {
      console.error('[AI Plugin] History save failed:', result.error)
    } else if (result.sanitizationApplied) {
      console.warn('[AI Plugin] Sanitization was applied to saved history')
    }
  } catch (error) {
    // Silent fail - don't break the main request
    console.error('[AI Plugin] History save error:', error)
  }
}
