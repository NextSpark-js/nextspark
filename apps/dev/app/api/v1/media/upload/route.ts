import { NextRequest } from 'next/server'
import { put } from '@vercel/blob'
import { authenticateRequest, hasRequiredScope, resolveTeamContext } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { createApiResponse, createApiError } from '@nextsparkjs/core/lib/api/helpers'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { MEDIA_CONFIG } from '@nextsparkjs/core/lib/config/config-sync'
import { MediaService } from '@nextsparkjs/core/lib/services/media.service'
import { extractImageDimensions } from '@nextsparkjs/core/lib/media/utils'
import type { Media } from '@nextsparkjs/core/lib/media/types'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

// Check if Vercel Blob is configured
// NOTE: We use Vercel Blob even in development when available because some external APIs
// (like social media platforms) cannot access localhost URLs - they need publicly accessible URLs
const isVercelBlobConfigured = () => {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  return !!token && token.startsWith('vercel_blob_')
}

// Local storage fallback - accepts buffer directly
// Used when Vercel Blob is not configured or fails
async function uploadToLocalStorageBuffer(buffer: Buffer, fileName: string): Promise<string> {
  const uploadDir = join(process.cwd(), 'public', 'uploads', 'temp')

  // Create directory if it doesn't exist
  if (!existsSync(uploadDir)) {
    await mkdir(uploadDir, { recursive: true })
  }

  const filePath = join(uploadDir, fileName)
  await writeFile(filePath, buffer)

  // Return relative URL that can be served from public folder
  return `/uploads/temp/${fileName}`
}

/**
 * POST /api/v1/media/upload
 *
 * Upload media files (images and videos).
 * Enhanced version that creates database records for uploaded files.
 *
 * Features:
 * - Uploads files to Vercel Blob (production) or local storage (development)
 * - Creates media records in database for tracking
 * - Extracts image dimensions automatically
 * - Returns both legacy URLs array and new media records array
 *
 * Authentication: Requires valid session or API key with media:write scope
 * RLS: Media records are associated with user's active team
 */
export const POST = withRateLimitTier(async (request: NextRequest) => {
  try {
    // 1. Dual Authentication (API Key OR Session)
    const authResult = await authenticateRequest(request)

    if (!authResult.success) {
      return createApiError('Unauthorized', 401)
    }

    // 2. Check permissions for media upload
    const hasPermission = hasRequiredScope(authResult, 'media:write')

    if (!hasPermission) {
      return createApiError('Insufficient permissions - media:write scope required', 403)
    }

    // 3. Resolve and validate team context
    const teamResult = await resolveTeamContext(request, authResult)
    if (teamResult instanceof Response) return teamResult
    const teamId = teamResult

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      return createApiError('No files uploaded', 400)
    }

    const uploadedUrls: string[] = []
    const uploadedMedia: Media[] = []
    const useVercelBlob = isVercelBlobConfigured()

    console.log(`📤 [Media Upload] Storage mode: ${useVercelBlob ? 'Vercel Blob' : 'Local Storage'}`)
    console.log(`📤 [Media Upload] Team context: ${teamId}`)

    for (const file of files) {
      if (!file.size) {
        continue // Skip empty files
      }

      // Validate file type using config (theme-overridable)
      const allowedTypes = MEDIA_CONFIG?.allowedMimeTypes ?? [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
        'video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm',
      ]

      if (!allowedTypes.includes(file.type)) {
        return createApiError(
          `File type ${file.type} not allowed. Only images and videos are supported.`,
          400,
          { allowedTypes }
        )
      }

      // Determine max size based on file type category (theme-overridable)
      const defaultMaxSizeMB = MEDIA_CONFIG?.maxSizeMB ?? 10
      let maxSizeMB = defaultMaxSizeMB
      if (file.type.startsWith('image/') && MEDIA_CONFIG?.maxSizeImageMB != null) {
        maxSizeMB = MEDIA_CONFIG.maxSizeImageMB
      } else if (file.type.startsWith('video/') && MEDIA_CONFIG?.maxSizeVideoMB != null) {
        maxSizeMB = MEDIA_CONFIG.maxSizeVideoMB
      }
      const maxSize = maxSizeMB * 1024 * 1024
      if (file.size > maxSize) {
        return createApiError(
          `File ${file.name} is too large. Maximum size is ${maxSizeMB}MB.`,
          400,
          { maxSize: `${maxSizeMB}MB`, fileSize: `${(file.size / 1024 / 1024).toFixed(2)}MB` }
        )
      }

      // Generate unique filename
      const timestamp = Date.now()
      const randomString = Math.random().toString(36).substring(2, 15)
      const extension = file.name.split('.').pop() || 'bin'
      const fileName = `${timestamp}_${randomString}.${extension}`

      try {
        let uploadedUrl: string

        // Read file buffer once - needed for both Vercel Blob and local storage
        // Important: File stream can only be read once, so we buffer it first
        const fileBuffer = Buffer.from(await file.arrayBuffer())

        if (useVercelBlob) {
          // Try Vercel Blob first - use buffer with content type
          try {
            const blob = await put(`uploads/temp/${fileName}`, fileBuffer, {
              access: 'public',
              addRandomSuffix: false,
              contentType: file.type
            })
            uploadedUrl = blob.url
            console.log(`✅ [Media Upload] Uploaded to Vercel Blob: ${uploadedUrl}`)
          } catch (blobError) {
            // Fallback to local storage if Vercel Blob fails
            console.warn(`⚠️ [Media Upload] Vercel Blob failed, falling back to local storage:`, blobError)
            uploadedUrl = await uploadToLocalStorageBuffer(fileBuffer, fileName)
            console.log(`✅ [Media Upload] Uploaded to local storage (fallback): ${uploadedUrl}`)
          }
        } else {
          // Use local storage directly
          uploadedUrl = await uploadToLocalStorageBuffer(fileBuffer, fileName)
          console.log(`✅ [Media Upload] Uploaded to local storage: ${uploadedUrl}`)
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
              filename: file.name,
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

        return createApiError(
          `Failed to upload file ${file.name}`,
          500,
          { fileName: file.name, error: errorMessage }
        )
      }
    }

    // Return both legacy URLs array AND new media records array (backward compatible)
    return createApiResponse({
      message: 'Files uploaded successfully',
      urls: uploadedUrls,          // LEGACY: backward compatible
      media: uploadedMedia,        // NEW: full media records
      count: uploadedUrls.length,
      storage: useVercelBlob ? 'vercel-blob' : 'local'
    })

  } catch (error) {
    console.error('Error uploading files:', error)
    return createApiError(
      'Failed to upload files',
      500,
      { error: error instanceof Error ? error.message : String(error) }
    )
  }
}, 'write');

/**
 * GET /api/v1/media/upload
 *
 * Get upload endpoint information.
 */
export const GET = withRateLimitTier(async (request: NextRequest) => {
  try {
    // 1. Dual Authentication (API Key OR Session)
    const authResult = await authenticateRequest(request)

    if (!authResult.success) {
      return createApiError('Unauthorized', 401)
    }

    // 2. Check permissions for media read
    const hasPermission = hasRequiredScope(authResult, 'media:read')

    if (!hasPermission) {
      return createApiError('Insufficient permissions - media:read scope required', 403)
    }

    const useVercelBlob = isVercelBlobConfigured()

    // This could be used for cleanup or management
    const maxSizeMB = MEDIA_CONFIG?.maxSizeMB ?? 10
    return createApiResponse({
      message: 'Media upload endpoint is active',
      storage: useVercelBlob ? 'Vercel Blob' : 'Local Storage',
      uploadPath: 'uploads/temp/',
      supportedTypes: MEDIA_CONFIG?.allowedMimeTypes ?? ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm'],
      maxFileSize: `${maxSizeMB}MB`,
      ...(MEDIA_CONFIG?.maxSizeImageMB != null && { maxImageSize: `${MEDIA_CONFIG.maxSizeImageMB}MB` }),
      ...(MEDIA_CONFIG?.maxSizeVideoMB != null && { maxVideoSize: `${MEDIA_CONFIG.maxSizeVideoMB}MB` }),
    })

  } catch (error) {
    console.error('Error in media upload GET:', error)
    return createApiError(
      'Failed to get upload info',
      500,
      { error: error instanceof Error ? error.message : String(error) }
    )
  }
}, 'read');
