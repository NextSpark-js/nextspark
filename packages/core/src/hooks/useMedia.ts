/**
 * Media Library Hooks
 *
 * TanStack Query hooks for media CRUD operations.
 * Handles fetching lists, individual items, updates, and deletions.
 */

'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './useAuth'
import type { Media, MediaListOptions, MediaListResult, UpdateMediaInput } from '../lib/media/types'

const MEDIA_QUERY_KEY = 'media'

/**
 * Fetch paginated list of media items with filtering and search
 */
export function useMediaList(options: MediaListOptions = {}) {
  const { user } = useAuth()

  return useQuery<MediaListResult>({
    queryKey: [MEDIA_QUERY_KEY, 'list', options],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (options.limit) params.set('limit', String(options.limit))
      if (options.offset) params.set('offset', String(options.offset))
      if (options.orderBy) params.set('orderBy', options.orderBy)
      if (options.orderDir) params.set('orderDir', options.orderDir)
      if (options.type && options.type !== 'all') params.set('type', options.type)
      if (options.search) params.set('search', options.search)
      if (options.status) params.set('status', options.status)

      const res = await fetch(`/api/v1/media?${params}`)
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to fetch media' }))
        throw new Error(errorData.error || 'Failed to fetch media')
      }
      const json = await res.json()
      return json.data
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

/**
 * Fetch a single media item by ID
 */
export function useMediaItem(id: string | null) {
  const { user } = useAuth()

  return useQuery<Media>({
    queryKey: [MEDIA_QUERY_KEY, 'item', id],
    queryFn: async () => {
      if (!id) throw new Error('Media ID is required')

      const res = await fetch(`/api/v1/media/${id}`)
      if (!res.ok) {
        if (res.status === 404) throw new Error('Media not found')
        const errorData = await res.json().catch(() => ({ error: 'Failed to fetch media' }))
        throw new Error(errorData.error || 'Failed to fetch media')
      }
      const json = await res.json()
      return json.data
    },
    enabled: !!user && !!id,
  })
}

/**
 * Update media metadata (alt text and caption)
 */
export function useUpdateMedia() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateMediaInput }) => {
      const res = await fetch(`/api/v1/media/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to update media' }))
        throw new Error(errorData.error || 'Failed to update media')
      }

      const json = await res.json()
      return json.data as Media
    },
    onSuccess: (updatedMedia) => {
      // Invalidate list queries
      queryClient.invalidateQueries({ queryKey: [MEDIA_QUERY_KEY, 'list'] })
      // Update the specific item cache
      queryClient.setQueryData([MEDIA_QUERY_KEY, 'item', updatedMedia.id], updatedMedia)
    },
  })
}

/**
 * Soft delete a media item
 */
export function useDeleteMedia() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/media/${id}`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to delete media' }))
        throw new Error(errorData.error || 'Failed to delete media')
      }
    },
    onSuccess: () => {
      // Invalidate all media queries to refetch data
      queryClient.invalidateQueries({ queryKey: [MEDIA_QUERY_KEY] })
    },
  })
}
