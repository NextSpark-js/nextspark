import { NextRequest } from 'next/server'
import { authenticateRequest, createAuthFailureResponse, resolveTeamContext } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { createApiResponse, createApiError } from '@nextsparkjs/core/lib/api/helpers'
import { API_ERROR_CODES } from '@nextsparkjs/core/lib/api/api-error'
import { checkPermission } from '@nextsparkjs/core/lib/permissions/check'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { corsPreflight } from '@nextsparkjs/core/lib/api/cors-response'
import { MEDIA_CONFIG } from '@nextsparkjs/core/lib/config/config-sync'
import { MediaService } from '@nextsparkjs/core/lib/services/media.service'
import { extractImageDimensions, sanitizeFilename } from '@nextsparkjs/core/lib/media/utils'
import { bytesMatchMime } from '@nextsparkjs/core/lib/media/file-signature'
import { MAX_MEDIA_BATCH } from '@nextsparkjs/core/lib/media/schemas'
import { allowedMimeTypes, maxSizeMBFor } from '@nextsparkjs/core/lib/media/upload-limits'
import { developmentFallbackDriver, newObjectName, selectStorageDriver } from '@nextsparkjs/core/lib/media/storage/index'
import type { Media } from '@nextsparkjs/core/lib/media/types'

// NOTE: Vercel Blob is used even in development when its token is set, because some external APIs
// (like social media platforms) cannot access localhost URLs - they need publicly accessible URLs.
// The driver comes from STORAGE_DRIVER (lib/media/storage); production without one answers 503.
const localFallbackAllowed = () => process.env.NODE_ENV !== 'production'

/**
 * POST /api/v1/media/upload
 *
 * Upload media files (images and videos).
 * Enhanced version that creates database records for uploaded files.
 *
 * Features:
 * - Stores files with the driver STORAGE_DRIVER selects (Vercel Blob, S3-compatible, local disk);
 *   development without one falls back to public/uploads/temp, production answers 503 STORAGE_NOT_CONFIGURED
 * - Large files can skip the app server with a presigned upload (upload/presign, then upload/confirm)
 * - Creates media records in database for tracking
 * - Extracts image dimensions automatically
 * - Returns both legacy URLs array and new media records array
 *
 * Authentication: Requires valid session or API key with media:write scope
 * RLS: Media records are associated with user's active team
 */
export const POST = withRateLimitTier(async (request: NextRequest) => {
  try {
    // 1. Dual Authentication (API Key OR Session); the API-key scope is
    // declared at the entry point, which fails closed for keys that lack it (#93).
    const authResult = await authenticateRequest(request, { requiredScope: 'media:write' })

    if (!authResult.success) {
      return createAuthFailureResponse(authResult)
    }

    // 3. Resolve and validate team context
    const teamResult = await resolveTeamContext(request, authResult)
    if (teamResult instanceof Response) return teamResult
    const teamId = teamResult

    // 4. Check role-based permission
    if (!await checkPermission(authResult.user!.id, teamId, 'media.upload')) {
      return createApiError('Permission denied', 403, undefined, API_ERROR_CODES.PERMISSION_DENIED)
    }

    const selection = selectStorageDriver()
    if (!selection.driver) {
      return createApiError(selection.message, 503, selection.details, API_ERROR_CODES.STORAGE_NOT_CONFIGURED)
    }
    const driver = selection.driver

    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return createApiError('Request body must be multipart/form-data', 415, undefined, 'UNSUPPORTED_MEDIA_TYPE')
    }
    const files = Array.from(formData.getAll('files') as unknown[])
      .filter((value): value is File => value instanceof File)

    if (files.length === 0) {
      return createApiError('No files uploaded', 400, undefined, 'NO_FILES')
    }

    if (files.length > MAX_MEDIA_BATCH) {
      return createApiError(`At most ${MAX_MEDIA_BATCH} files per upload`, 400, undefined, 'TOO_MANY_FILES')
    }

    const emptyFile = files.find(file => !file.size)
    if (emptyFile) {
      return createApiError(`File ${sanitizeFilename(emptyFile.name)} is empty`, 400, undefined, 'EMPTY_FILE')
    }

    const uploadedUrls: string[] = []
    const uploadedMedia: Media[] = []
    let storage = driver.name

    console.log(`📤 [Media Upload] Storage driver: ${driver.name}`)

    for (const file of files) {
      // Validate file type using config (theme-overridable)
      const allowedTypes = allowedMimeTypes()

      if (!allowedTypes.includes(file.type)) {
        return createApiError(
          `File type ${file.type} not allowed. Only images and videos are supported.`,
          400,
          { allowedTypes }
        )
      }

      // Determine max size based on file type category (theme-overridable)
      const maxSizeMB = maxSizeMBFor(file.type)
      const maxSize = maxSizeMB * 1024 * 1024
      if (file.size > maxSize) {
        return createApiError(
          `File ${file.name} is too large. Maximum size is ${maxSizeMB}MB.`,
          400,
          { maxSize: `${maxSizeMB}MB`, fileSize: `${(file.size / 1024 / 1024).toFixed(2)}MB` }
        )
      }

      // Generated by the server; the extension follows the allow-listed type, never the client's file name
      const fileName = newObjectName(file.type)

      try {
        let uploadedUrl: string

        // Read file buffer once - needed for both Vercel Blob and local storage
        // Important: File stream can only be read once, so we buffer it first
        const fileBuffer = Buffer.from(await file.arrayBuffer())

        if (!bytesMatchMime(fileBuffer, file.type)) {
          return createApiError(
            `File ${sanitizeFilename(file.name)} does not match its declared type ${file.type}.`,
            400,
            { declaredType: file.type }
          )
        }

        try {
          uploadedUrl = await driver.put(fileName, fileBuffer, file.type)
          console.log(`✅ [Media Upload] Stored with ${driver.name}: ${uploadedUrl}`)
        } catch (storageError) {
          // A failed put in production is an error, not a file that is never served. Development
          // falls back to public/uploads/temp when Blob fails.
          if (driver.name !== 'vercel-blob' || !localFallbackAllowed()) throw storageError
          console.warn(`⚠️ [Media Upload] Vercel Blob failed, falling back to local storage:`, storageError)
          uploadedUrl = await developmentFallbackDriver().put(fileName, fileBuffer, file.type)
          storage = 'local'
          console.log(`✅ [Media Upload] Uploaded to local storage (fallback): ${uploadedUrl}`)
        }

        uploadedUrls.push(uploadedUrl)

        // NEW: Create media record in database
        try {
          // Extract image dimensions if it's an image
          const dimensions = await extractImageDimensions(fileBuffer, file.type)

          const mediaRecord = await MediaService.create(
            authResult.user!.id,
            teamId,
            {
              url: uploadedUrl,
              filename: sanitizeFilename(file.name),
              fileSize: file.size,
              mimeType: file.type,
              width: dimensions?.width ?? null,
              height: dimensions?.height ?? null,
            }
          )

          uploadedMedia.push(mediaRecord)
          console.log(`✅ [Media Upload] Created media record: ${mediaRecord.id}`)
        } catch (dbError) {
          // Graceful degradation: If DB insert fails, still return the URL
          console.warn(`⚠️ [Media Upload] Failed to create media record:`, dbError)
          // Continue - upload succeeded even if DB insert failed
        }

      } catch (fileError) {
        console.error(`❌ Failed to upload ${file.name}:`)
        console.error(`❌ Error details:`, fileError)

        const errorMessage = fileError instanceof Error ? fileError.message : String(fileError)
        console.error(`❌ Error message:`, errorMessage)

        if (fileError instanceof Error && fileError.stack) {
          console.error(`❌ Error stack:`, fileError.stack)
        }

        return createApiError(`Failed to upload file ${sanitizeFilename(file.name)}`, 500, undefined, 'INTERNAL_ERROR')
      }
    }

    // Return both legacy URLs array AND new media records array (backward compatible)
    return createApiResponse({
      message: 'Files uploaded successfully',
      urls: uploadedUrls,          // LEGACY: backward compatible
      media: uploadedMedia,        // NEW: full media records
      count: uploadedUrls.length,
      storage
    })

  } catch (error) {
    console.error('Error uploading files:', error)
    return createApiError('Failed to upload files', 500, undefined, 'INTERNAL_ERROR')
  }
}, 'write');

/**
 * GET /api/v1/media/upload
 *
 * Get upload endpoint information.
 */
export const GET = withRateLimitTier(async (request: NextRequest) => {
  try {
    // 1. Dual Authentication (API Key OR Session); the API-key scope is
    // declared at the entry point, which fails closed for keys that lack it (#93).
    const authResult = await authenticateRequest(request, { requiredScope: 'media:read' })

    if (!authResult.success) {
      return createAuthFailureResponse(authResult)
    }

    // 3. Resolve and validate team context
    const teamResult = await resolveTeamContext(request, authResult)
    if (teamResult instanceof Response) return teamResult
    const teamId = teamResult

    // 4. Check role-based permission
    if (!await checkPermission(authResult.user!.id, teamId, 'media.read')) {
      return createApiError('Permission denied', 403, undefined, API_ERROR_CODES.PERMISSION_DENIED)
    }

    const selection = selectStorageDriver()

    // This could be used for cleanup or management
    const maxSizeMB = MEDIA_CONFIG?.maxSizeMB ?? 10
    return createApiResponse({
      message: 'Media upload endpoint is active',
      storage: selection.driver ? selection.driver.name : 'Not configured (set STORAGE_DRIVER or BLOB_READ_WRITE_TOKEN)',
      directUpload: !!selection.driver?.direct,
      supportedTypes: allowedMimeTypes(),
      maxFileSize: `${maxSizeMB}MB`,
      ...(MEDIA_CONFIG?.maxSizeImageMB != null && { maxImageSize: `${MEDIA_CONFIG.maxSizeImageMB}MB` }),
      ...(MEDIA_CONFIG?.maxSizeVideoMB != null && { maxVideoSize: `${MEDIA_CONFIG.maxSizeVideoMB}MB` }),
    })

  } catch (error) {
    console.error('Error in media upload GET:', error)
    return createApiError('Failed to get upload info', 500, undefined, 'INTERNAL_ERROR')
  }
}, 'read');

export const OPTIONS = corsPreflight
