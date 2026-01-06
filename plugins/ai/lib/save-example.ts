/**
 * AI Example Saving - PostgreSQL Implementation
 *
 * Uses project's PostgreSQL connection with RLS support.
 * Self-contained plugin with direct DB access.
 */

import { mutateWithRLS, queryWithRLS } from '@nextsparkjs/core/lib/db'
import { sanitizePrompt, sanitizeResponse } from './sanitize'

export interface AIExampleData {
  title?: string
  prompt: string
  response: string
  model: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  userId?: string
  metadata?: {
    tokens?: number
    cost?: number
    duration?: number
    provider?: string
    isLocal?: boolean
    platforms?: number
    imagesProcessed?: number
  }
}

export interface SaveExampleResult {
  success: boolean
  id?: string
  error?: string
  sanitizationApplied?: boolean
}

/**
 * Save AI example to PostgreSQL database
 */
export async function saveAIExample(
  data: AIExampleData,
  userId: string
): Promise<SaveExampleResult> {
  try {
    // 1. Sanitize sensitive data
    const sanitizedPrompt = sanitizePrompt(data.prompt)
    const sanitizedResponse = sanitizeResponse(data.response)

    const sanitizationApplied =
      sanitizedPrompt !== data.prompt ||
      sanitizedResponse !== data.response

    // 2. Generate title if not provided
    const title = data.title || generateTitle(sanitizedPrompt)

    // 3. Insert into database with RLS
    const query = `
      INSERT INTO ai_example (
        title, prompt, response, model, status, "userId", metadata, "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING id
    `

    const params = [
      title,
      sanitizedPrompt,
      sanitizedResponse,
      data.model,
      data.status,
      userId,
      JSON.stringify(data.metadata || {})
    ]

    const result = await mutateWithRLS<{ id: string }>(query, params, userId)

    if (result.rowCount === 0 || !result.rows[0]) {
      return {
        success: false,
        error: 'Failed to insert example'
      }
    }

    console.log('[AI Plugin] Example saved to database:', {
      id: result.rows[0].id,
      title,
      sanitizationApplied
    })

    return {
      success: true,
      id: result.rows[0].id,
      sanitizationApplied
    }

  } catch (error) {
    console.error('[AI Plugin] Save example failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Get AI examples from PostgreSQL
 */
export async function getAIExamples(params: {
  userId?: string
  limit?: number
  offset?: number
  status?: string
}) {
  try {
    const { userId, limit = 50, offset = 0, status } = params

    let query = `
      SELECT id, title, prompt, response, model, status, "userId", metadata, "createdAt", "updatedAt"
      FROM ai_example
      WHERE 1=1
    `
    const queryParams: (string | number)[] = []

    if (status) {
      queryParams.push(status)
      query += ` AND status = $${queryParams.length}`
    }

    query += ` ORDER BY "createdAt" DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`
    queryParams.push(limit, offset)

    const rows = await queryWithRLS(query, queryParams, userId)

    return {
      success: true,
      data: rows
    }
  } catch (error) {
    console.error('[AI Plugin] Get examples failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      data: []
    }
  }
}

/**
 * Get single AI example by ID from PostgreSQL
 */
export async function getAIExampleById(id: string, userId?: string) {
  try {
    const query = `
      SELECT id, title, prompt, response, model, status, "userId", metadata, "createdAt", "updatedAt"
      FROM ai_example
      WHERE id = $1
    `

    const rows = await queryWithRLS(query, [id], userId)

    if (rows.length === 0) {
      return {
        success: false,
        error: 'Example not found'
      }
    }

    return {
      success: true,
      data: rows[0]
    }
  } catch (error) {
    console.error('[AI Plugin] Get example by ID failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Delete AI example from PostgreSQL
 */
export async function deleteAIExample(id: string, userId: string) {
  try {
    const query = `DELETE FROM ai_example WHERE id = $1 RETURNING id`

    const result = await mutateWithRLS<{ id: string }>(query, [id], userId)

    if (result.rowCount === 0) {
      return {
        success: false,
        error: 'Example not found or unauthorized'
      }
    }

    return {
      success: true,
      id: result.rows[0].id
    }
  } catch (error) {
    console.error('[AI Plugin] Delete example failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Generate title from prompt (helper)
 */
function generateTitle(prompt: string): string {
  const cleaned = prompt.replace(/\n/g, ' ').trim()
  return cleaned.length > 50
    ? cleaned.substring(0, 50) + '...'
    : cleaned
}

/**
 * Save example with automatic error handling (fire-and-forget)
 */
export async function saveExampleSafely(
  data: AIExampleData,
  userId: string
): Promise<void> {
  try {
    const result = await saveAIExample(data, userId)

    if (!result.success) {
      console.error('[AI Plugin] Example save failed:', result.error)
    } else if (result.sanitizationApplied) {
      console.warn('[AI Plugin] Sanitization was applied to saved example')
    }
  } catch (error) {
    // Silent fail - don't break the main request
    console.error('[AI Plugin] Example save error:', error)
  }
}