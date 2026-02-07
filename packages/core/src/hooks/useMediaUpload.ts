/**
 * Media Upload Hook
 *
 * TanStack Query mutation for uploading files to the media library.
 * Integrates with the enhanced upload endpoint that creates DB records.
 */

'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Media } from '../lib/media/types'

interface UploadResult {
  urls: string[]
  media: Media[]
  count: number
  storage: string
}

interface UploadProgress {
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
}

/**
 * Upload files to media library
 *
 * Returns a mutation that accepts File[] and uploads to /api/v1/media/upload
 * The enhanced endpoint creates database records and returns full media objects
 */
export function useMediaUpload() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (files: File[]): Promise<UploadResult> => {
      if (!files || files.length === 0) {
        throw new Error('No files provided')
      }

      const formData = new FormData()
      files.forEach((file) => formData.append('files', file))

      const res = await fetch('/api/v1/media/upload', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({
          error: `Upload failed with status ${res.status}`
        }))
        throw new Error(errorData.error || 'Upload failed')
      }

      const json = await res.json()
      return json.data
    },
    onSuccess: () => {
      // Invalidate media list queries to show new uploads
      queryClient.invalidateQueries({ queryKey: ['media', 'list'] })
    },
  })
}

/**
 * Hook for tracking upload progress (client-side state)
 * This is a simpler version - can be enhanced with upload progress tracking
 */
export function useUploadProgress() {
  // This could be enhanced to track XMLHttpRequest progress
  // For now, it's a placeholder for future implementation
  return null
}
