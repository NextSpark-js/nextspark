import { NextRequest } from 'next/server'
import { authenticateRequest, createAuthFailureResponse, resolveTeamContext } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { createApiResponse, createApiError, readJsonObject } from '@nextsparkjs/core/lib/api/helpers'
import { API_ERROR_CODES } from '@nextsparkjs/core/lib/api/api-error'
import { checkPermission } from '@nextsparkjs/core/lib/permissions/check'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { corsPreflight } from '@nextsparkjs/core/lib/api/cors-response'
import { sanitizeFilename } from '@nextsparkjs/core/lib/media/utils'
import { presignUploadSchema } from '@nextsparkjs/core/lib/media/schemas'
import { allowedMimeTypes, maxSizeMBFor } from '@nextsparkjs/core/lib/media/upload-limits'
import { newObjectName, selectStorageDriver } from '@nextsparkjs/core/lib/media/storage/index'
import { CONFIRM_WINDOW_SECONDS, signUploadClaim } from '@nextsparkjs/core/lib/media/upload-token'

/**
 * POST /api/v1/media/upload/presign
 *
 * Step 1 of a direct upload (drivers that support it: s3). Body: `{ filename, mimeType, size }`.
 * Answers a presigned PUT URL for a server-named pending object, valid 5 minutes, whose
 * signature fixes the Content-Type and the size; and a token for /upload/confirm, which
 * creates the media record after checking the stored object.
 *
 * Authentication and permission: the same as POST /api/v1/media/upload (media:write, media.upload).
 */
export const POST = withRateLimitTier(async (request: NextRequest) => {
  try {
    const authResult = await authenticateRequest(request, { requiredScope: 'media:write' })
    if (!authResult.success) {
      return createAuthFailureResponse(authResult)
    }

    const teamResult = await resolveTeamContext(request, authResult)
    if (teamResult instanceof Response) return teamResult
    const teamId = teamResult

    if (!await checkPermission(authResult.user!.id, teamId, 'media.upload')) {
      return createApiError('Permission denied', 403, undefined, API_ERROR_CODES.PERMISSION_DENIED)
    }

    const selection = selectStorageDriver()
    if (!selection.driver) {
      return createApiError(selection.message, 503, selection.details, API_ERROR_CODES.STORAGE_NOT_CONFIGURED)
    }
    const direct = selection.driver.direct
    if (!direct) {
      return createApiError(
        `The ${selection.driver.name} storage driver does not take direct uploads; use POST /api/v1/media/upload.`,
        400, undefined, 'DIRECT_UPLOAD_UNSUPPORTED'
      )
    }

    const parsedBody = await readJsonObject(request)
    if (parsedBody.error) return parsedBody.error
    const parsed = presignUploadSchema.safeParse(parsedBody.data)
    if (!parsed.success) {
      return createApiError('Validation failed', 400, { errors: parsed.error.issues })
    }
    const { filename, mimeType, size } = parsed.data

    const allowedTypes = allowedMimeTypes()
    if (!allowedTypes.includes(mimeType)) {
      return createApiError(`File type ${mimeType} not allowed.`, 400, { allowedTypes }, 'FILE_TYPE_NOT_ALLOWED')
    }
    const maxSizeMB = maxSizeMBFor(mimeType)
    if (size > maxSizeMB * 1024 * 1024) {
      return createApiError(`File is too large. Maximum size is ${maxSizeMB}MB.`, 400, { maxSize: `${maxSizeMB}MB` }, 'FILE_TOO_LARGE')
    }

    const name = newObjectName(mimeType)
    const upload = await direct.presignUpload(name, mimeType, size)
    const token = signUploadClaim({
      name,
      userId: authResult.user!.id,
      teamId,
      mimeType,
      size,
      filename: sanitizeFilename(filename),
      expiresAt: Date.now() + CONFIRM_WINDOW_SECONDS * 1000,
    })

    return createApiResponse({
      upload: { url: upload.url, method: upload.method, headers: upload.headers, expiresAt: upload.expiresAt.toISOString() },
      token,
    })
  } catch (error) {
    console.error('[Media Presign] Error:', error)
    return createApiError('Failed to prepare the upload', 500, undefined, 'INTERNAL_ERROR')
  }
}, 'write')

export const OPTIONS = corsPreflight
