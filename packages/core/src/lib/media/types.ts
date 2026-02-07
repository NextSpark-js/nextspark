/**
 * Media Types
 * Core types for the media library entity.
 */

export type MediaStatus = 'active' | 'deleted'

export interface Media {
  id: string
  userId: string
  teamId: string
  url: string
  filename: string
  fileSize: number
  mimeType: string
  width: number | null
  height: number | null
  title: string | null
  alt: string | null
  caption: string | null
  status: MediaStatus
  createdAt: string
  updatedAt: string
}

export interface CreateMediaInput {
  url: string
  filename: string
  fileSize: number
  mimeType: string
  width?: number | null
  height?: number | null
  title?: string | null
  alt?: string | null
  caption?: string | null
}

export interface UpdateMediaInput {
  title?: string | null
  alt?: string | null
  caption?: string | null
}

export interface MediaListOptions {
  limit?: number
  offset?: number
  orderBy?: 'createdAt' | 'filename' | 'fileSize'
  orderDir?: 'asc' | 'desc'
  type?: 'image' | 'video' | 'all'
  search?: string
  status?: MediaStatus
  tagIds?: string[]
  tagSlugs?: string[]
}

export interface MediaListResult {
  data: Media[]
  total: number
  limit: number
  offset: number
}

export interface MediaTag {
  id: string
  type: string
  slug: string
  name: string
  description: string | null
  icon: string | null
  color: string | null
  order: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}
