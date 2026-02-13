import { NextRequest } from 'next/server'
import { authenticateRequest, hasRequiredScope } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { createApiResponse, createApiError } from '@nextsparkjs/core/lib/api/helpers'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { MediaService } from '@nextsparkjs/core/lib/services/media.service'
import { TeamMemberService } from '@nextsparkjs/core/lib/services/team-member.service'
import { updateMediaSchema } from '@nextsparkjs/core/lib/media/schemas'

/**
 * GET /api/v1/media/:id
 *
 * Get a single media item by ID.
 *
 * Authentication: Requires valid session or API key with media:read scope
 * RLS: Returns only media from teams the user is a member of
 */
export const GET = withRateLimitTier(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    // 1. Authenticate
    const authResult = await authenticateRequest(request)
    if (!authResult.success) {
      return createApiError('Unauthorized', 401)
    }

    // 2. Check permissions
    if (!hasRequiredScope(authResult, 'media:read')) {
      return createApiError('Insufficient permissions', 403)
    }

    // 3. Get team context
    const teamId = request.headers.get('x-team-id')
      || request.cookies.get('activeTeamId')?.value
      || authResult.user!.defaultTeamId
    if (!teamId) {
      return createApiError('Team context required. Include x-team-id header.', 400)
    }

    // 4. Validate team membership
    const isMember = await TeamMemberService.isMember(teamId, authResult.user!.id)
    if (!isMember) {
      return createApiError('Access denied: You are not a member of this team', 403)
    }

    // 5. Get media ID from params
    const { id } = await params

    // 6. Fetch media with team isolation
    const media = await MediaService.getById(id, authResult.user!.id, teamId)

    if (!media) {
      return createApiError('Media not found', 404)
    }

    return createApiResponse(media)
  } catch (error) {
    console.error('[Media API] Error fetching media:', error)
    return createApiError('Failed to fetch media', 500)
  }
}, 'read')

/**
 * PATCH /api/v1/media/:id
 *
 * Update media metadata (alt text and caption).
 * File properties (url, filename, size, dimensions) are immutable.
 *
 * Request Body:
 * - alt: Alt text for accessibility (max 500 characters, optional)
 * - caption: Caption or description (max 1000 characters, optional)
 *
 * Authentication: Requires valid session or API key with media:write scope
 * RLS: Can only update media from teams the user is a member of
 */
export const PATCH = withRateLimitTier(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    // 1. Authenticate
    const authResult = await authenticateRequest(request)
    if (!authResult.success) {
      return createApiError('Unauthorized', 401)
    }

    // 2. Check permissions
    if (!hasRequiredScope(authResult, 'media:write')) {
      return createApiError('Insufficient permissions', 403)
    }

    // 3. Get team context
    const teamId = request.headers.get('x-team-id')
      || request.cookies.get('activeTeamId')?.value
      || authResult.user!.defaultTeamId
    if (!teamId) {
      return createApiError('Team context required. Include x-team-id header.', 400)
    }

    // 4. Validate team membership
    const isMember = await TeamMemberService.isMember(teamId, authResult.user!.id)
    if (!isMember) {
      return createApiError('Access denied: You are not a member of this team', 403)
    }

    // 5. Get media ID from params
    const { id } = await params

    // 6. Parse and validate request body
    const body = await request.json()
    const parsed = updateMediaSchema.safeParse(body)

    if (!parsed.success) {
      return createApiError('Validation failed', 400, {
        errors: parsed.error.issues,
      })
    }

    // 6. Update media with team isolation
    const media = await MediaService.update(id, authResult.user!.id, parsed.data, teamId)

    if (!media) {
      return createApiError('Media not found', 404)
    }

    return createApiResponse(media)
  } catch (error) {
    console.error('[Media API] Error updating media:', error)
    return createApiError(
      error instanceof Error ? error.message : 'Failed to update media',
      500
    )
  }
}, 'write')

/**
 * DELETE /api/v1/media/:id
 *
 * Soft delete a media item (sets status to 'deleted').
 * The file remains in storage but is hidden from queries.
 *
 * Authentication: Requires valid session or API key with media:delete scope
 * RLS: Can only delete media from teams the user is a member of
 */
export const DELETE = withRateLimitTier(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    // 1. Authenticate
    const authResult = await authenticateRequest(request)
    if (!authResult.success) {
      return createApiError('Unauthorized', 401)
    }

    // 2. Check permissions
    if (!hasRequiredScope(authResult, 'media:delete')) {
      return createApiError('Insufficient permissions', 403)
    }

    // 3. Get team context
    const teamId = request.headers.get('x-team-id')
      || request.cookies.get('activeTeamId')?.value
      || authResult.user!.defaultTeamId
    if (!teamId) {
      return createApiError('Team context required. Include x-team-id header.', 400)
    }

    // 4. Validate team membership
    const isMember = await TeamMemberService.isMember(teamId, authResult.user!.id)
    if (!isMember) {
      return createApiError('Access denied: You are not a member of this team', 403)
    }

    // 5. Get media ID from params
    const { id } = await params

    // 6. Soft delete media with team isolation
    const deleted = await MediaService.softDelete(id, authResult.user!.id, teamId)

    if (!deleted) {
      return createApiError('Media not found', 404)
    }

    return createApiResponse({ message: 'Media deleted successfully' })
  } catch (error) {
    console.error('[Media API] Error deleting media:', error)
    return createApiError('Failed to delete media', 500)
  }
}, 'write')
