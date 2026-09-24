/**
 * Pattern Usages API
 *
 * GET /api/v1/patterns/[id]/usages - Get detailed usage information for a pattern
 *
 * Query Parameters:
 * - entityType: Filter by entity type (e.g., 'pages', 'posts')
 * - limit: Number of results per page (default: 50)
 * - page: Page number (default: 1)
 *
 * Response includes:
 * - usages: Array of usage records with entity info
 * - counts: Array of counts by entity type
 * - total: Total number of usages
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  createApiResponse,
  createApiError,
  createPaginationMeta,
  withApiLogging,
  handleCorsPreflightRequest,
  addCorsHeaders,
} from '@nextsparkjs/core/lib/api/helpers'
import { authenticateRequest, createAuthFailureResponse } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { PatternUsageService } from '@nextsparkjs/core/lib/services'
import { queryOneWithRLS } from '@nextsparkjs/core/lib/db'

// Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflightRequest(request)
}

// GET /api/v1/patterns/:id/usages - Get pattern usages
export const GET = withApiLogging(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> => {
    try {
      // Authenticate using dual auth; the required API-key scope is declared
      // at the entry point (fail closed, #93).
      const authResult = await authenticateRequest(req, { requiredScope: 'patterns:read' })

      if (!authResult.success) {
        return createAuthFailureResponse(authResult)
      }

      if (authResult.rateLimitResponse) {
        return authResult.rateLimitResponse as NextResponse
      }

      const { id: patternId } = await params
      const userId = authResult.user!.id

      // Validate that patternId is not empty
      if (!patternId || patternId.trim() === '') {
        const response = createApiError('Pattern ID is required', 400, null, 'MISSING_PATTERN_ID')
        return addCorsHeaders(response, req)
      }

      // Verify pattern exists and user has access
      const pattern = await queryOneWithRLS<{ id: string }>(
        'SELECT id FROM "patterns" WHERE id = $1',
        [patternId],
        userId
      )

      if (!pattern) {
        const response = createApiError('Pattern not found', 404, null, 'PATTERN_NOT_FOUND')
        return addCorsHeaders(response, req)
      }

      // Parse query parameters
      const url = new URL(req.url)
      const entityType = url.searchParams.get('entityType') || undefined
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100)
      const page = Math.max(parseInt(url.searchParams.get('page') || '1', 10), 1)
      const offset = (page - 1) * limit

      // Get usages with entity info
      const result = await PatternUsageService.getUsagesWithEntityInfo(
        patternId,
        userId,
        { entityType, limit, offset }
      )

      // Create pagination meta
      const totalPages = Math.ceil(result.total / limit)
      const paginationMeta = createPaginationMeta(page, limit, result.total)

      const response = createApiResponse({
        usages: result.usages,
        counts: result.counts,
        total: result.total,
      }, {
        ...paginationMeta,
        totalPages,
        patternId,
        entityType: entityType || 'all',
      })

      return addCorsHeaders(response, req)
    } catch (error) {
      console.error('Error fetching pattern usages:', error)
      const response = createApiError('Internal server error', 500)
      return addCorsHeaders(response, req)
    }
  }
)
