/**
 * Media Service
 *
 * Provides CRUD operations for media library entries.
 * Supports team isolation via RLS, search, filtering by type.
 *
 * @module MediaService
 */

import { queryOneWithRLS, queryWithRLS, mutateWithRLS } from '../db'
import type {
  Media,
  CreateMediaInput,
  UpdateMediaInput,
  MediaListOptions,
  MediaListResult,
} from '../media/types'

export class MediaService {
  // ============================================
  // QUERIES
  // ============================================

  /**
   * Get media item by ID
   *
   * @param id - Media ID
   * @param userId - User ID for RLS context
   * @returns Media or null if not found
   *
   * @example
   * const media = await MediaService.getById('media-123', 'user-456')
   */
  static async getById(id: string, userId: string): Promise<Media | null> {
    if (!id?.trim()) throw new Error('Media ID is required')
    if (!userId?.trim()) throw new Error('User ID is required')

    return queryOneWithRLS<Media>(
      `SELECT * FROM "media" WHERE id = $1 AND status = 'active'`,
      [id],
      userId
    )
  }

  /**
   * List media with pagination, filtering, and search
   *
   * @param userId - User ID for RLS context
   * @param options - List options (pagination, filtering, search, sort)
   * @returns Paginated media list result
   *
   * @example
   * const result = await MediaService.list('user-123', {
   *   limit: 20,
   *   offset: 0,
   *   type: 'image',
   *   search: 'logo',
   *   orderBy: 'createdAt',
   *   orderDir: 'desc'
   * })
   */
  static async list(userId: string, options: MediaListOptions = {}): Promise<MediaListResult> {
    if (!userId?.trim()) throw new Error('User ID is required')

    const {
      limit = 20,
      offset = 0,
      orderBy = 'createdAt',
      orderDir = 'desc',
      type = 'all',
      search,
      status = 'active',
    } = options

    // Build WHERE clause
    const conditions: string[] = ['status = $1']
    const params: unknown[] = [status]
    let paramIndex = 2

    if (type === 'image') {
      conditions.push(`"mimeType" LIKE 'image/%'`)
    } else if (type === 'video') {
      conditions.push(`"mimeType" LIKE 'video/%'`)
    }

    if (search) {
      conditions.push(`lower(filename) LIKE $${paramIndex}`)
      params.push(`%${search.toLowerCase()}%`)
      paramIndex++
    }

    const whereClause = conditions.join(' AND ')

    // Validate orderBy
    const validOrderBy: Record<string, string> = {
      createdAt: '"createdAt"',
      filename: 'filename',
      fileSize: '"fileSize"',
    }
    const orderColumn = validOrderBy[orderBy] || '"createdAt"'
    const validDir = orderDir === 'asc' ? 'ASC' : 'DESC'

    // Count
    const countResult = await queryWithRLS<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM "media" WHERE ${whereClause}`,
      params,
      userId
    )
    const total = parseInt(countResult[0]?.count || '0', 10)

    // Data
    params.push(limit, offset)
    const data = await queryWithRLS<Media>(
      `SELECT * FROM "media"
       WHERE ${whereClause}
       ORDER BY ${orderColumn} ${validDir}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params,
      userId
    )

    return { data, total, limit, offset }
  }

  // ============================================
  // MUTATIONS
  // ============================================

  /**
   * Create a new media record
   *
   * @param userId - User ID (uploader)
   * @param teamId - Team ID for isolation
   * @param data - Media data
   * @returns Created media record
   *
   * @example
   * const media = await MediaService.create('user-123', 'team-456', {
   *   url: 'https://example.com/image.jpg',
   *   filename: 'image.jpg',
   *   fileSize: 150000,
   *   mimeType: 'image/jpeg',
   *   width: 1920,
   *   height: 1080
   * })
   */
  static async create(
    userId: string,
    teamId: string,
    data: CreateMediaInput
  ): Promise<Media> {
    if (!userId?.trim()) throw new Error('User ID is required')
    if (!teamId?.trim()) throw new Error('Team ID is required')

    const result = await mutateWithRLS<Media>(
      `INSERT INTO "media" (
        "userId", "teamId", url, filename, "fileSize", "mimeType",
        width, height, alt, caption, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active')
      RETURNING *`,
      [
        userId, teamId, data.url, data.filename, data.fileSize,
        data.mimeType, data.width ?? null, data.height ?? null,
        data.alt ?? null, data.caption ?? null,
      ],
      userId
    )

    if (!result.rows[0]) throw new Error('Failed to create media record')
    return result.rows[0]
  }

  /**
   * Update media metadata (alt, caption only - file properties are immutable)
   *
   * @param id - Media ID
   * @param userId - User ID for RLS context
   * @param data - Update data (alt, caption)
   * @returns Updated media record
   *
   * @example
   * const media = await MediaService.update('media-123', 'user-456', {
   *   alt: 'Company logo',
   *   caption: 'Our brand logo in high resolution'
   * })
   */
  static async update(
    id: string,
    userId: string,
    data: UpdateMediaInput
  ): Promise<Media> {
    if (!id?.trim()) throw new Error('Media ID is required')
    if (!userId?.trim()) throw new Error('User ID is required')

    const setClauses: string[] = []
    const params: unknown[] = []
    let paramIndex = 1

    if (data.alt !== undefined) {
      setClauses.push(`alt = $${paramIndex++}`)
      params.push(data.alt)
    }
    if (data.caption !== undefined) {
      setClauses.push(`caption = $${paramIndex++}`)
      params.push(data.caption)
    }

    if (setClauses.length === 0) throw new Error('No fields to update')

    setClauses.push(`"updatedAt" = NOW()`)
    params.push(id)

    const result = await mutateWithRLS<Media>(
      `UPDATE "media"
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex} AND status = 'active'
       RETURNING *`,
      params,
      userId
    )

    if (!result.rows[0]) throw new Error('Media not found or not authorized')
    return result.rows[0]
  }

  /**
   * Soft delete a media record (sets status to 'deleted')
   *
   * @param id - Media ID
   * @param userId - User ID for RLS context
   * @returns True if deleted successfully
   *
   * @example
   * const deleted = await MediaService.softDelete('media-123', 'user-456')
   */
  static async softDelete(id: string, userId: string): Promise<boolean> {
    if (!id?.trim()) throw new Error('Media ID is required')
    if (!userId?.trim()) throw new Error('User ID is required')

    const result = await mutateWithRLS(
      `UPDATE "media" SET status = 'deleted', "updatedAt" = NOW()
       WHERE id = $1 AND status = 'active'`,
      [id],
      userId
    )

    return result.rowCount > 0
  }

  /**
   * Count media items
   *
   * @param userId - User ID for RLS context
   * @param options - Count options (type filter, status filter)
   * @returns Total count
   *
   * @example
   * const imageCount = await MediaService.count('user-123', { type: 'image' })
   */
  static async count(
    userId: string,
    options: { type?: 'image' | 'video' | 'all'; status?: string } = {}
  ): Promise<number> {
    if (!userId?.trim()) throw new Error('User ID is required')

    const { type = 'all', status = 'active' } = options
    const conditions: string[] = ['status = $1']
    const params: unknown[] = [status]

    if (type === 'image') conditions.push(`"mimeType" LIKE 'image/%'`)
    else if (type === 'video') conditions.push(`"mimeType" LIKE 'video/%'`)

    const result = await queryWithRLS<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM "media" WHERE ${conditions.join(' AND ')}`,
      params,
      userId
    )

    return parseInt(result[0]?.count || '0', 10)
  }
}
