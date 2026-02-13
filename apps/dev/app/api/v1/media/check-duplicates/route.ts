import { NextRequest } from 'next/server'
import { authenticateRequest, hasRequiredScope } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { createApiResponse, createApiError } from '@nextsparkjs/core/lib/api/helpers'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { MediaService } from '@nextsparkjs/core/lib/services/media.service'
import { TeamMemberService } from '@nextsparkjs/core/lib/services/team-member.service'

/**
 * POST /api/v1/media/check-duplicates
 *
 * Check if files with the same name+size already exist in the media library.
 * Used by the upload zone to warn users before uploading duplicates.
 *
 * Body: { files: [{ filename: string, fileSize: number }] }
 * Returns: { duplicates: [{ filename, fileSize, existing: Media[] }] }
 */
export const POST = withRateLimitTier(async (request: NextRequest) => {
  try {
    const authResult = await authenticateRequest(request)
    if (!authResult.success) {
      return createApiError('Unauthorized', 401)
    }

    if (!hasRequiredScope(authResult, 'media:read')) {
      return createApiError('Insufficient permissions - media:read scope required', 403)
    }

    const teamId = request.headers.get('x-team-id')
      || request.cookies.get('activeTeamId')?.value
      || authResult.user!.defaultTeamId
    if (!teamId) {
      return createApiError('Team context required. Include x-team-id header.', 400)
    }

    const isMember = await TeamMemberService.isMember(teamId, authResult.user!.id)
    if (!isMember) {
      return createApiError('Access denied: You are not a member of this team', 403)
    }

    const body = await request.json()
    const files = body.files as { filename: string; fileSize: number }[]

    if (!files || !Array.isArray(files) || files.length === 0) {
      return createApiError('files array is required', 400)
    }

    const duplicates: { filename: string; fileSize: number; existing: { id: string; url: string; createdAt: string }[] }[] = []

    for (const file of files) {
      const existing = await MediaService.findDuplicates(
        authResult.user!.id,
        teamId,
        file.filename,
        file.fileSize
      )
      if (existing.length > 0) {
        duplicates.push({
          filename: file.filename,
          fileSize: file.fileSize,
          existing: existing.map(m => ({ id: m.id, url: m.url, createdAt: m.createdAt })),
        })
      }
    }

    return createApiResponse({ duplicates })
  } catch (error) {
    console.error('Error checking duplicates:', error)
    return createApiError('Failed to check duplicates', 500)
  }
}, 'read')
