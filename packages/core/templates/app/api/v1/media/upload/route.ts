import { NextRequest } from 'next/server'
import { put } from '@vercel/blob'
import { authenticateRequest, hasRequiredScope } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { createApiResponse, createApiError } from '@nextsparkjs/core/lib/api/helpers'

export async function POST(request: NextRequest) {
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

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      return createApiError('No files uploaded', 400)
    }

    const uploadedUrls: string[] = []

    for (const file of files) {
      if (!file.size) {
        continue // Skip empty files
      }

      // Validate file type (images and videos)
      const allowedTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'video/mp4',
        'video/mpeg',
        'video/quicktime',
        'video/webm'
      ]

      if (!allowedTypes.includes(file.type)) {
        return createApiError(
          `File type ${file.type} not allowed. Only images and videos are supported.`,
          400,
          { allowedTypes }
        )
      }

      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024 // 10MB
      if (file.size > maxSize) {
        return createApiError(
          `File ${file.name} is too large. Maximum size is 10MB.`,
          400,
          { maxSize: '10MB', fileSize: `${(file.size / 1024 / 1024).toFixed(2)}MB` }
        )
      }

      // Generate unique filename
      const timestamp = Date.now()
      const randomString = Math.random().toString(36).substring(2, 15)
      const extension = file.name.split('.').pop()
      const fileName = `${timestamp}_${randomString}.${extension}`

      try {
        // Upload to Vercel Blob
        const blob = await put(`uploads/temp/${fileName}`, file, {
          access: 'public',
          addRandomSuffix: false
        })

        uploadedUrls.push(blob.url)
      } catch (fileError) {
        console.error(`❌ Failed to upload ${file.name} to Vercel Blob:`)
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

    return createApiResponse({
      message: 'Files uploaded successfully',
      urls: uploadedUrls,
      count: uploadedUrls.length
    })

  } catch (error) {
    console.error('Error uploading files:', error)
    return createApiError(
      'Failed to upload files',
      500,
      { error: error instanceof Error ? error.message : String(error) }
    )
  }
}

// Optional: Add a GET endpoint to get upload info
export async function GET(request: NextRequest) {
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

    // This could be used for cleanup or management
    return createApiResponse({
      message: 'Media upload endpoint is active',
      storage: 'Vercel Blob',
      uploadPath: 'uploads/temp/',
      supportedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm'],
      maxFileSize: '10MB'
    })

  } catch (error) {
    console.error('Error in media upload GET:', error)
    return createApiError(
      'Failed to get upload info',
      500,
      { error: error instanceof Error ? error.message : String(error) }
    )
  }
}
