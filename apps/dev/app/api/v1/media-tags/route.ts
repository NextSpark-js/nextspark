import { NextRequest } from 'next/server'
import { authenticateRequest, hasRequiredScope, resolveTeamContext } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { createApiResponse, createApiError } from '@nextsparkjs/core/lib/api/helpers'
import { checkPermission } from '@nextsparkjs/core/lib/permissions/check'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { MediaService } from '@nextsparkjs/core/lib/services/media.service'

/**
 * GET /api/v1/media-tags
 *
 * List media tags scoped to the active team.
 *
 * Authentication: Requires valid session or API key with media:read scope
 */
export const GET = withRateLimitTier(async (request: NextRequest) => {
  try {
    const authResult = await authenticateRequest(request)
    if (!authResult.success) {
      return createApiError('Unauthorized', 401)
    }

    if (!hasRequiredScope(authResult, 'media:read')) {
      return createApiError('Insufficient permissions', 403)
    }

    const teamResult = await resolveTeamContext(request, authResult)
    if (teamResult instanceof Response) return teamResult
    const teamId = teamResult

    // Check role-based permission
    if (!await checkPermission(authResult.user!.id, teamId, 'media.read')) {
      return createApiError('Permission denied', 403)
    }

    const tags = await MediaService.getTags(authResult.user!.id, teamId)
    return createApiResponse(tags)
  } catch (error) {
    console.error('[Media Tags API] Error listing tags:', error)
    return createApiError('Failed to list media tags', 500)
  }
}, 'read')

/**
 * POST /api/v1/media-tags
 *
 * Create a new media tag scoped to the active team.
 * Body: { name: string }
 *
 * Authentication: Requires valid session or API key with media:write scope
 */
export const POST = withRateLimitTier(async (request: NextRequest) => {
  try {
    const authResult = await authenticateRequest(request)
    if (!authResult.success) {
      return createApiError('Unauthorized', 401)
    }

    if (!hasRequiredScope(authResult, 'media:write')) {
      return createApiError('Insufficient permissions', 403)
    }

    const teamResult = await resolveTeamContext(request, authResult)
    if (teamResult instanceof Response) return teamResult
    const teamId = teamResult

    // Check role-based permission
    if (!await checkPermission(authResult.user!.id, teamId, 'media.update')) {
      return createApiError('Permission denied', 403)
    }

    const body = await request.json()
    const { name } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return createApiError('Tag name is required', 400)
    }

    const tag = await MediaService.createTag(name, authResult.user!.id, teamId)
    return createApiResponse(tag, undefined, 201)
  } catch (error) {
    console.error('[Media Tags API] Error creating tag:', error)
    return createApiError('Failed to create media tag', 500)
  }
}, 'write')
