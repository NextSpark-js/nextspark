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
  MediaTag,
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
      tagIds,
      tagSlugs,
    } = options

    // Build WHERE clause
    const conditions: string[] = ['m.status = $1']
    const params: unknown[] = [status]
    let paramIndex = 2

    if (type === 'image') {
      conditions.push(`m."mimeType" LIKE 'image/%'`)
    } else if (type === 'video') {
      conditions.push(`m."mimeType" LIKE 'video/%'`)
    }

    // Search: full-text + LIKE fallback (filenames with hyphens may not tokenize well in tsvector)
    if (search) {
      conditions.push(`(
        (m."searchVector" IS NOT NULL AND m."searchVector" @@ plainto_tsquery('english', $${paramIndex}))
        OR lower(coalesce(m.title, '')) LIKE $${paramIndex + 1}
        OR lower(m.filename) LIKE $${paramIndex + 1}
        OR lower(coalesce(m.alt, '')) LIKE $${paramIndex + 1}
        OR lower(coalesce(m.caption, '')) LIKE $${paramIndex + 1}
      )`)
      params.push(search)
      params.push(`%${search.toLowerCase()}%`)
      paramIndex += 2
    }

    // Tag filtering by IDs
    if (tagIds && tagIds.length > 0) {
      conditions.push(`m.id IN (
        SELECT etr."entityId" FROM "entity_taxonomy_relations" etr
        WHERE etr."entityType" = 'media' AND etr."taxonomyId" = ANY($${paramIndex})
      )`)
      params.push(tagIds)
      paramIndex++
    }

    // Tag filtering by slugs
    if (tagSlugs && tagSlugs.length > 0) {
      conditions.push(`m.id IN (
        SELECT etr."entityId" FROM "entity_taxonomy_relations" etr
        JOIN "taxonomies" t ON t.id = etr."taxonomyId"
        WHERE etr."entityType" = 'media' AND t.type = 'media_tag' AND t.slug = ANY($${paramIndex})
      )`)
      params.push(tagSlugs)
      paramIndex++
    }

    const whereClause = conditions.join(' AND ')

    // Validate orderBy
    const validOrderBy: Record<string, string> = {
      createdAt: 'm."createdAt"',
      filename: 'm.filename',
      fileSize: 'm."fileSize"',
    }
    const orderColumn = validOrderBy[orderBy] || 'm."createdAt"'
    const validDir = orderDir === 'asc' ? 'ASC' : 'DESC'

    // Count
    const countResult = await queryWithRLS<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM "media" m WHERE ${whereClause}`,
      params,
      userId
    )
    const total = parseInt(countResult[0]?.count || '0', 10)

    // Data
    params.push(limit, offset)
    const data = await queryWithRLS<Media>(
      `SELECT m.* FROM "media" m
       WHERE ${whereClause}
       ORDER BY ${orderColumn} ${validDir}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params,
      userId
    )

    return { data, total, limit, offset }
  }

  /**
   * Find existing media by filename and fileSize (duplicate detection)
   *
   * @param userId - User ID for RLS context
   * @param filename - Original filename
   * @param fileSize - File size in bytes
   * @returns Matching media items (same name+size = likely duplicate)
   */
  static async findDuplicates(
    userId: string,
    filename: string,
    fileSize: number
  ): Promise<Media[]> {
    if (!userId?.trim()) throw new Error('User ID is required')

    return queryWithRLS<Media>(
      `SELECT * FROM "media"
       WHERE filename = $1 AND "fileSize" = $2 AND status = 'active'
       ORDER BY "createdAt" DESC
       LIMIT 5`,
      [filename, fileSize],
      userId
    )
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
        width, height, title, alt, caption, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active')
      RETURNING *`,
      [
        userId, teamId, data.url, data.filename, data.fileSize,
        data.mimeType, data.width ?? null, data.height ?? null,
        data.title ?? null, data.alt ?? null, data.caption ?? null,
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

    if (data.title !== undefined) {
      setClauses.push(`title = $${paramIndex++}`)
      params.push(data.title)
    }
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

  // ============================================
  // TAG OPERATIONS
  // ============================================

  /**
   * Get all media tags
   *
   * @param userId - User ID for RLS context
   * @returns Array of media tags
   */
  static async getTags(userId: string): Promise<MediaTag[]> {
    if (!userId?.trim()) throw new Error('User ID is required')

    return queryWithRLS<MediaTag>(
      `SELECT id, type, slug, name, description, icon, color, "order", "isActive", "createdAt", "updatedAt"
       FROM "taxonomies"
       WHERE type = 'media_tag' AND "isActive" = true AND "deletedAt" IS NULL
       ORDER BY "order" ASC, name ASC`,
      [],
      userId
    )
  }

  /**
   * Get tags for a specific media item
   *
   * @param mediaId - Media item ID
   * @param userId - User ID for RLS context
   * @returns Array of tags assigned to the media
   */
  static async getMediaTags(mediaId: string, userId: string): Promise<MediaTag[]> {
    if (!mediaId?.trim()) throw new Error('Media ID is required')
    if (!userId?.trim()) throw new Error('User ID is required')

    return queryWithRLS<MediaTag>(
      `SELECT t.id, t.type, t.slug, t.name, t.description, t.icon, t.color, t."order", t."isActive", t."createdAt", t."updatedAt"
       FROM "taxonomies" t
       JOIN "entity_taxonomy_relations" etr ON etr."taxonomyId" = t.id
       WHERE etr."entityType" = 'media' AND etr."entityId" = $1
         AND t."isActive" = true AND t."deletedAt" IS NULL
       ORDER BY t."order" ASC, t.name ASC`,
      [mediaId],
      userId
    )
  }

  /**
   * Add a tag to a media item
   *
   * @param mediaId - Media item ID
   * @param tagId - Tag taxonomy ID
   * @param userId - User ID for RLS context
   * @returns True if tag was added
   */
  static async addTag(mediaId: string, tagId: string, userId: string): Promise<boolean> {
    if (!mediaId?.trim()) throw new Error('Media ID is required')
    if (!tagId?.trim()) throw new Error('Tag ID is required')
    if (!userId?.trim()) throw new Error('User ID is required')

    const result = await mutateWithRLS(
      `INSERT INTO "entity_taxonomy_relations" ("entityType", "entityId", "taxonomyId")
       VALUES ('media', $1, $2)
       ON CONFLICT ("entityType", "entityId", "taxonomyId") DO NOTHING`,
      [mediaId, tagId],
      userId
    )

    return result.rowCount > 0
  }

  /**
   * Remove a tag from a media item
   *
   * @param mediaId - Media item ID
   * @param tagId - Tag taxonomy ID
   * @param userId - User ID for RLS context
   * @returns True if tag was removed
   */
  static async removeTag(mediaId: string, tagId: string, userId: string): Promise<boolean> {
    if (!mediaId?.trim()) throw new Error('Media ID is required')
    if (!tagId?.trim()) throw new Error('Tag ID is required')
    if (!userId?.trim()) throw new Error('User ID is required')

    const result = await mutateWithRLS(
      `DELETE FROM "entity_taxonomy_relations"
       WHERE "entityType" = 'media' AND "entityId" = $1 AND "taxonomyId" = $2`,
      [mediaId, tagId],
      userId
    )

    return result.rowCount > 0
  }

  /**
   * Set tags for a media item (replace all existing tags)
   *
   * @param mediaId - Media item ID
   * @param tagIds - Array of tag taxonomy IDs
   * @param userId - User ID for RLS context
   */
  static async setTags(mediaId: string, tagIds: string[], userId: string): Promise<void> {
    if (!mediaId?.trim()) throw new Error('Media ID is required')
    if (!userId?.trim()) throw new Error('User ID is required')

    // Remove existing tags
    await mutateWithRLS(
      `DELETE FROM "entity_taxonomy_relations"
       WHERE "entityType" = 'media' AND "entityId" = $1`,
      [mediaId],
      userId
    )

    // Add new tags
    if (tagIds.length > 0) {
      const values = tagIds.map((_, i) => `('media', $1, $${i + 2})`).join(', ')
      await mutateWithRLS(
        `INSERT INTO "entity_taxonomy_relations" ("entityType", "entityId", "taxonomyId")
         VALUES ${values}
         ON CONFLICT DO NOTHING`,
        [mediaId, ...tagIds],
        userId
      )
    }
  }

  /**
   * Create a new media tag (taxonomy of type 'media_tag')
   *
   * @param name - Tag display name
   * @param userId - User ID for RLS context
   * @returns The created tag
   */
  static async createTag(name: string, userId: string): Promise<MediaTag> {
    if (!name?.trim()) throw new Error('Tag name is required')
    if (!userId?.trim()) throw new Error('User ID is required')

    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

    const result = await mutateWithRLS(
      `INSERT INTO "taxonomies" (type, slug, name, "isActive")
       VALUES ('media_tag', $1, $2, true)
       ON CONFLICT (type, slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, slug, name, color, icon, "order", "isActive"`,
      [slug, name.trim()],
      userId
    )

    return result.rows[0]
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
