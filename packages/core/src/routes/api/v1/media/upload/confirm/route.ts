import { NextRequest } from 'next/server'
import { authenticateRequest, createAuthFailureResponse, resolveTeamContext } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { createApiResponse, createApiError, readJsonObject } from '@nextsparkjs/core/lib/api/helpers'
import { API_ERROR_CODES } from '@nextsparkjs/core/lib/api/api-error'
import { checkPermission } from '@nextsparkjs/core/lib/permissions/check'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { corsPreflight } from '@nextsparkjs/core/lib/api/cors-response'
import { MediaService } from '@nextsparkjs/core/lib/services/media.service'
import { extractImageDimensions } from '@nextsparkjs/core/lib/media/utils'
import { bytesMatchMime } from '@nextsparkjs/core/lib/media/file-signature'
import { confirmUploadSchema } from '@nextsparkjs/core/lib/media/schemas'
import { allowedMimeTypes, maxSizeMBFor } from '@nextsparkjs/core/lib/media/upload-limits'
import { selectStorageDriver } from '@nextsparkjs/core/lib/media/storage'
import { readUploadClaim } from '@nextsparkjs/core/lib/media/upload-token'

/** Leading bytes read back for the signature check (and image dimensions when they are in it). */
const HEAD_BYTES = 64 * 1024

class UploadRejected extends Error {
  constructor(readonly status: number, message: string, readonly code: string, readonly discard: boolean) {
    super(message)
  }
}

/**
 * POST /api/v1/media/upload/confirm
 *
 * Step 2 of a direct upload. Body: `{ token }` from /upload/presign. The token must be
 * authentic, unexpired, and issued to this user and team. The stored object must exist,
 * have the declared type and size within the limit, and start with that type's signature;
 * then it is moved out of the pending prefix and the media record is created. A rejected
 * object is deleted. A confirm for a token that already has a record answers 409 and
 * changes nothing.
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
    const userId = authResult.user!.id

    if (!await checkPermission(userId, teamId, 'media.upload')) {
      return createApiError('Permission denied', 403, undefined, API_ERROR_CODES.PERMISSION_DENIED)
    }

    const selection = selectStorageDriver()
    if (!selection.driver) {
      return createApiError(selection.message, 503, selection.details, API_ERROR_CODES.STORAGE_NOT_CONFIGURED)
    }
    const direct = selection.driver.direct
    if (!direct) {
      return createApiError(
        `The ${selection.driver.name} storage driver does not take direct uploads.`,
        400, undefined, 'DIRECT_UPLOAD_UNSUPPORTED'
      )
    }

    const parsedBody = await readJsonObject(request)
    if (parsedBody.error) return parsedBody.error
    const parsed = confirmUploadSchema.safeParse(parsedBody.data)
    if (!parsed.success) {
      return createApiError('Validation failed', 400, { errors: parsed.error.issues })
    }

    const claim = readUploadClaim(parsed.data.token)
    if (!claim) {
      return createApiError('Unknown upload', 400, undefined, 'INVALID_UPLOAD_TOKEN')
    }
    // Not this caller's upload: refuse, and leave the object to its owner
    if (claim.userId !== userId || claim.teamId !== teamId) {
      return createApiError('This upload belongs to another user or team', 403, undefined, 'UPLOAD_NOT_YOURS')
    }
    if (claim.expiresAt < Date.now()) {
      await direct.discard(claim.name).catch(() => {})
      return createApiError('The upload expired; start again', 410, undefined, 'UPLOAD_EXPIRED')
    }

    const url = direct.getPublicUrl(claim.name)
    let promoted = false
    try {
      const media = await MediaService.createOnce(userId, teamId, url, async () => {
        const stored = await direct.stat(claim.name)
        if (!stored) throw new UploadRejected(404, 'Nothing was uploaded for this token', 'UPLOAD_NOT_FOUND', false)

        const maxSizeMB = maxSizeMBFor(claim.mimeType)
        if (!allowedMimeTypes().includes(claim.mimeType)) {
          throw new UploadRejected(400, `File type ${claim.mimeType} not allowed.`, 'FILE_TYPE_NOT_ALLOWED', true)
        }
        if (!(stored.size <= maxSizeMB * 1024 * 1024)) {
          throw new UploadRejected(400, `File is too large. Maximum size is ${maxSizeMB}MB.`, 'FILE_TOO_LARGE', true)
        }
        if (stored.size !== claim.size) {
          throw new UploadRejected(400, 'The uploaded file is not the declared size', 'FILE_SIZE_MISMATCH', true)
        }
        if (stored.contentType?.split(';')[0].trim().toLowerCase() !== claim.mimeType) {
          throw new UploadRejected(400, `The uploaded file is not stored as ${claim.mimeType}`, 'FILE_TYPE_MISMATCH', true)
        }
        const head = Buffer.from(await direct.readStart(claim.name, HEAD_BYTES))
        if (!bytesMatchMime(head, claim.mimeType)) {
          throw new UploadRejected(400, `The uploaded file does not match its declared type ${claim.mimeType}.`, 'FILE_TYPE_MISMATCH', true)
        }

        const dimensions = await extractImageDimensions(head, claim.mimeType)
        await direct.promote(claim.name)
        promoted = true
        return {
          filename: claim.filename,
          fileSize: stored.size,
          mimeType: claim.mimeType,
          width: dimensions?.width ?? null,
          height: dimensions?.height ?? null,
        }
      })

      if (!media) {
        return createApiError('This upload was already confirmed', 409, undefined, 'UPLOAD_ALREADY_CONFIRMED')
      }
      return createApiResponse({ media, url: media.url })
    } catch (error) {
      if (error instanceof UploadRejected) {
        if (error.discard) await direct.discard(claim.name).catch(() => {})
        return createApiError(error.message, error.status, undefined, error.code)
      }
      // The record was not created: do not keep a file nothing points to
      if (promoted) await selection.driver.delete(url).catch(() => {})
      throw error
    }
  } catch (error) {
    console.error('[Media Confirm] Error:', error)
    return createApiError('Failed to confirm the upload', 500, undefined, 'INTERNAL_ERROR')
  }
}, 'write')

export const OPTIONS = corsPreflight
