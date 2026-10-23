import { NextRequest } from 'next/server'
import { authenticateRequest, createAuthFailureResponse, resolveTeamContext } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { createApiResponse, createApiError, readJsonObject } from '@nextsparkjs/core/lib/api/helpers'
import { API_ERROR_CODES } from '@nextsparkjs/core/lib/api/api-error'
import { checkPermission } from '@nextsparkjs/core/lib/permissions/check'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { corsPreflight } from '@nextsparkjs/core/lib/api/cors-response'
import { MediaService } from '@nextsparkjs/core/lib/services/media.service'
import { withDisplayUrls } from '@nextsparkjs/core/lib/media/storage/display'
import { checkDuplicatesSchema, MAX_MEDIA_BATCH } from '@nextsparkjs/core/lib/media/schemas'

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
    // Authenticate; the API-key scope is declared at the entry point, which
    // fails closed for keys that lack it (#93).
    const authResult = await authenticateRequest(request, { requiredScope: 'media:read' })
    if (!authResult.success) {
      return createAuthFailureResponse(authResult)
    }

    const teamResult = await resolveTeamContext(request, authResult)
    if (teamResult instanceof Response) return teamResult
    const teamId = teamResult

    // Check role-based permission
    if (!await checkPermission(authResult.user!.id, teamId, 'media.read')) {
      return createApiError('Permission denied', 403, undefined, API_ERROR_CODES.PERMISSION_DENIED)
    }

    const parsedBody = await readJsonObject(request)
    if (parsedBody.error) return parsedBody.error
    const body = parsedBody.data
    const parsed = checkDuplicatesSchema.safeParse(body)

    if (!parsed.success) {
      return createApiError(`files must be a list of 1 to ${MAX_MEDIA_BATCH} entries with a filename and a fileSize`, 400, { errors: parsed.error.issues }, 'VALIDATION_ERROR')
    }
    const { files } = parsed.data

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
          existing: (await withDisplayUrls(existing)).map(m => ({ id: m.id, url: m.url, displayUrl: m.displayUrl, createdAt: m.createdAt })),
        })
      }
    }

    return createApiResponse({ duplicates })
  } catch (error) {
    console.error('Error checking duplicates:', error)
    return createApiError('Failed to check duplicates', 500, undefined, 'INTERNAL_ERROR')
  }
}, 'read')

export const OPTIONS = corsPreflight
