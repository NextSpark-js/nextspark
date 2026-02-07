import { NextRequest } from 'next/server'
import { authenticateRequest, hasRequiredScope } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { createApiResponse, createApiError } from '@nextsparkjs/core/lib/api/helpers'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { MediaService } from '@nextsparkjs/core/lib/services/media.service'

/**
 * GET /api/v1/media-tags
 *
 * List all available media tags (taxonomies of type 'media_tag').
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

    const tags = await MediaService.getTags(authResult.user!.id)
    return createApiResponse({ data: tags })
  } catch (error) {
    console.error('[Media Tags API] Error listing tags:', error)
    return createApiError('Failed to list media tags', 500)
  }
}, 'read')

/**
 * POST /api/v1/media-tags
 *
 * Create a new media tag.
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

    const body = await request.json()
    const { name } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return createApiError('Tag name is required', 400)
    }

    const tag = await MediaService.createTag(name, authResult.user!.id)
    return createApiResponse({ data: tag }, 201)
  } catch (error) {
    console.error('[Media Tags API] Error creating tag:', error)
    return createApiError('Failed to create media tag', 500)
  }
}, 'write')
