import { NextRequest } from 'next/server'
import { authenticateRequest, createAuthFailureResponse, resolveTeamContext } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { createApiResponse, createApiError, readJsonObject } from '@nextsparkjs/core/lib/api/helpers'
import { API_ERROR_CODES } from '@nextsparkjs/core/lib/api/api-error'
import { checkPermission } from '@nextsparkjs/core/lib/permissions/check'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { corsPreflight } from '@nextsparkjs/core/lib/api/cors-response'
import { signUrlsSchema, MAX_SIGN_URLS } from '@nextsparkjs/core/lib/media/schemas'
import { signTeamUrls } from '@nextsparkjs/core/lib/media/storage/display'

/**
 * POST /api/v1/media/sign
 *
 * Signed read URLs for stored media URLs that live outside a media row (an entity image or video field, a
 * block editor preview), when the bucket is private (STORAGE_S3_PRIVATE=true).
 *
 * Body: { urls: string[] }  (1 to 50)
 * Returns: { signed: { [storedUrl]: signedUrl } }
 *
 * Not an open signer: it needs a session or an API key with media:read, the media.read permission in the
 * current team, and answers a URL only when it is an object of this bucket and environment that is an active
 * file of that same team. Anything else is left out of `signed` (no error, no hint of why). With the mode off
 * the answer is always empty. A signed URL is never stored or logged.
 */
export const POST = withRateLimitTier(async (request: NextRequest) => {
  try {
    const authResult = await authenticateRequest(request, { requiredScope: 'media:read' })
    if (!authResult.success) {
      return createAuthFailureResponse(authResult)
    }

    const teamResult = await resolveTeamContext(request, authResult)
    if (teamResult instanceof Response) return teamResult
    const teamId = teamResult

    if (!await checkPermission(authResult.user!.id, teamId, 'media.read')) {
      return createApiError('Permission denied', 403, undefined, API_ERROR_CODES.PERMISSION_DENIED)
    }

    const parsedBody = await readJsonObject(request)
    if (parsedBody.error) return parsedBody.error
    const parsed = signUrlsSchema.safeParse(parsedBody.data)
    if (!parsed.success) {
      return createApiError(`urls must be a list of 1 to ${MAX_SIGN_URLS} strings`, 400, { errors: parsed.error.issues }, 'VALIDATION_ERROR')
    }

    const signed = await signTeamUrls(parsed.data.urls, teamId, authResult.user!.id)
    return createApiResponse({ signed })
  } catch (error) {
    // The message only: nothing here carries a URL
    console.error('[Media API] Error signing urls:', error instanceof Error ? error.message : 'unknown')
    return createApiError('Failed to sign urls', 500, undefined, 'INTERNAL_ERROR')
  }
}, 'read')

export const OPTIONS = corsPreflight
