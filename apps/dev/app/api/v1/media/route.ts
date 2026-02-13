import { NextRequest } from 'next/server'
import { authenticateRequest, hasRequiredScope, resolveTeamContext } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { createApiResponse, createApiError } from '@nextsparkjs/core/lib/api/helpers'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { MediaService } from '@nextsparkjs/core/lib/services/media.service'
import { mediaListQuerySchema } from '@nextsparkjs/core/lib/media/schemas'

/**
 * GET /api/v1/media
 *
 * List media files with pagination, filtering, and search.
 * Supports filtering by type (image/video), searching by filename, and sorting.
 *
 * Query Parameters:
 * - limit: Number of items per page (default: 20, max: 100)
 * - offset: Number of items to skip (default: 0)
 * - orderBy: Sort field (createdAt|filename|fileSize, default: createdAt)
 * - orderDir: Sort direction (asc|desc, default: desc)
 * - type: Filter by type (image|video|all, default: all)
 * - search: Search by filename (case-insensitive)
 *
 * Authentication: Requires valid session or API key with media:read scope
 * RLS: Returns only media from teams the user is a member of
 */
export const GET = withRateLimitTier(async (request: NextRequest) => {
  try {
    // 1. Authenticate
    const authResult = await authenticateRequest(request)
    if (!authResult.success) {
      return createApiError('Unauthorized', 401)
    }

    // 2. Check permissions
    if (!hasRequiredScope(authResult, 'media:read')) {
      return createApiError('Insufficient permissions - media:read scope required', 403)
    }

    // 3. Resolve and validate team context
    const teamResult = await resolveTeamContext(request, authResult)
    if (teamResult instanceof Response) return teamResult
    const teamId = teamResult

    // 4. Parse and validate query parameters
    const { searchParams } = new URL(request.url)
    const parsed = mediaListQuerySchema.safeParse(Object.fromEntries(searchParams))

    if (!parsed.success) {
      return createApiError('Invalid query parameters', 400, {
        errors: parsed.error.issues,
      })
    }

    // 5. Query media list with team isolation
    const result = await MediaService.list(authResult.user!.id, teamId, parsed.data)

    return createApiResponse(result)
  } catch (error) {
    console.error('[Media API] Error listing media:', error)
    return createApiError('Failed to list media', 500)
  }
}, 'read')
