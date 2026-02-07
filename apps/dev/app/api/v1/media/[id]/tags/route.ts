import { NextRequest } from 'next/server'
import { authenticateRequest, hasRequiredScope } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { createApiResponse, createApiError } from '@nextsparkjs/core/lib/api/helpers'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { MediaService } from '@nextsparkjs/core/lib/services/media.service'
import { z } from 'zod'

const addTagSchema = z.object({
  tagId: z.string().min(1),
})

const setTagsSchema = z.object({
  tagIds: z.array(z.string().min(1)),
})

/**
 * GET /api/v1/media/{id}/tags
 *
 * Get all tags assigned to a media item.
 */
export const GET = withRateLimitTier(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const authResult = await authenticateRequest(request)
    if (!authResult.success) {
      return createApiError('Unauthorized', 401)
    }

    if (!hasRequiredScope(authResult, 'media:read')) {
      return createApiError('Insufficient permissions', 403)
    }

    const { id } = await params
    const tags = await MediaService.getMediaTags(id, authResult.user!.id)
    return createApiResponse(tags)
  } catch (error) {
    console.error('[Media Tags API] Error getting tags:', error)
    return createApiError('Failed to get media tags', 500)
  }
}, 'read')

/**
 * POST /api/v1/media/{id}/tags
 *
 * Add a tag to a media item.
 * Body: { tagId: string }
 */
export const POST = withRateLimitTier(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const authResult = await authenticateRequest(request)
    if (!authResult.success) {
      return createApiError('Unauthorized', 401)
    }

    if (!hasRequiredScope(authResult, 'media:write')) {
      return createApiError('Insufficient permissions', 403)
    }

    const { id } = await params
    const body = await request.json()
    const parsed = addTagSchema.safeParse(body)

    if (!parsed.success) {
      return createApiError('Invalid request body', 400, { errors: parsed.error.issues })
    }

    await MediaService.addTag(id, parsed.data.tagId, authResult.user!.id)
    const tags = await MediaService.getMediaTags(id, authResult.user!.id)

    return createApiResponse(tags, 201)
  } catch (error) {
    console.error('[Media Tags API] Error adding tag:', error)
    return createApiError('Failed to add tag', 500)
  }
}, 'write')

/**
 * PUT /api/v1/media/{id}/tags
 *
 * Replace all tags for a media item.
 * Body: { tagIds: string[] }
 */
export const PUT = withRateLimitTier(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const authResult = await authenticateRequest(request)
    if (!authResult.success) {
      return createApiError('Unauthorized', 401)
    }

    if (!hasRequiredScope(authResult, 'media:write')) {
      return createApiError('Insufficient permissions', 403)
    }

    const { id } = await params
    const body = await request.json()
    const parsed = setTagsSchema.safeParse(body)

    if (!parsed.success) {
      return createApiError('Invalid request body', 400, { errors: parsed.error.issues })
    }

    await MediaService.setTags(id, parsed.data.tagIds, authResult.user!.id)
    const tags = await MediaService.getMediaTags(id, authResult.user!.id)

    return createApiResponse(tags)
  } catch (error) {
    console.error('[Media Tags API] Error setting tags:', error)
    return createApiError('Failed to set tags', 500)
  }
}, 'write')

/**
 * DELETE /api/v1/media/{id}/tags
 *
 * Remove a tag from a media item.
 * Query parameter: tagId
 */
export const DELETE = withRateLimitTier(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const authResult = await authenticateRequest(request)
    if (!authResult.success) {
      return createApiError('Unauthorized', 401)
    }

    if (!hasRequiredScope(authResult, 'media:delete')) {
      return createApiError('Insufficient permissions', 403)
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const tagId = searchParams.get('tagId')

    if (!tagId) {
      return createApiError('tagId query parameter is required', 400)
    }

    await MediaService.removeTag(id, tagId, authResult.user!.id)
    return createApiResponse({ success: true })
  } catch (error) {
    console.error('[Media Tags API] Error removing tag:', error)
    return createApiError('Failed to remove tag', 500)
  }
}, 'write')
