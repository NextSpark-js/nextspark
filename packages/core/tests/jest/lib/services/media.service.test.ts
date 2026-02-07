/**
 * Unit Tests - MediaService
 *
 * Tests all MediaService methods for media management,
 * including CRUD operations, filtering, and search.
 */

import { MediaService } from '@/core/lib/services/media.service'
import { queryOneWithRLS, queryWithRLS, mutateWithRLS } from '@/core/lib/db'
import type { Media } from '@/core/lib/media/types'

// Mock database functions
jest.mock('@/core/lib/db', () => ({
  queryOneWithRLS: jest.fn(),
  queryWithRLS: jest.fn(),
  mutateWithRLS: jest.fn(),
}))

const mockQueryOneWithRLS = queryOneWithRLS as jest.MockedFunction<typeof queryOneWithRLS>
const mockQueryWithRLS = queryWithRLS as jest.MockedFunction<typeof queryWithRLS>
const mockMutateWithRLS = mutateWithRLS as jest.MockedFunction<typeof mutateWithRLS>

// Sample media data
const mockMedia: Media = {
  id: 'media-123',
  userId: 'user-456',
  teamId: 'team-789',
  url: 'https://example.com/image.jpg',
  filename: 'image.jpg',
  fileSize: 150000,
  mimeType: 'image/jpeg',
  width: 1920,
  height: 1080,
  alt: 'Sample image',
  caption: 'A beautiful landscape',
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

describe('MediaService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ===========================================
  // QUERIES
  // ===========================================

  describe('getById', () => {
    it('returns media when found', async () => {
      mockQueryOneWithRLS.mockResolvedValue(mockMedia)

      const result = await MediaService.getById('media-123', 'user-456')

      expect(result).toEqual(mockMedia)
      expect(mockQueryOneWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM "media"'),
        ['media-123'],
        'user-456'
      )
      expect(mockQueryOneWithRLS).toHaveBeenCalledWith(
        expect.stringContaining("status = 'active'"),
        ['media-123'],
        'user-456'
      )
    })

    it('returns null when not found', async () => {
      mockQueryOneWithRLS.mockResolvedValue(null)

      const result = await MediaService.getById('non-existent', 'user-456')

      expect(result).toBeNull()
    })

    it('throws error for empty mediaId', async () => {
      await expect(MediaService.getById('', 'user-456')).rejects.toThrow('Media ID is required')
      await expect(MediaService.getById('  ', 'user-456')).rejects.toThrow('Media ID is required')
    })

    it('throws error for empty userId', async () => {
      await expect(MediaService.getById('media-123', '')).rejects.toThrow('User ID is required')
      await expect(MediaService.getById('media-123', '  ')).rejects.toThrow('User ID is required')
    })
  })

  describe('list', () => {
    const mockMediaList: Media[] = [
      mockMedia,
      { ...mockMedia, id: 'media-456', filename: 'image2.jpg' },
    ]

    it('returns paginated media with defaults', async () => {
      mockQueryWithRLS
        .mockResolvedValueOnce([{ count: '25' }]) // count query
        .mockResolvedValueOnce(mockMediaList) // data query

      const result = await MediaService.list('user-456')

      expect(result.data).toEqual(mockMediaList)
      expect(result.total).toBe(25)
      expect(result.limit).toBe(20)
      expect(result.offset).toBe(0)

      // Verify count query
      expect(mockQueryWithRLS).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('COUNT(*)'),
        expect.arrayContaining(['active']),
        'user-456'
      )

      // Verify data query with pagination
      expect(mockQueryWithRLS).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('LIMIT'),
        expect.arrayContaining(['active', 20, 0]),
        'user-456'
      )
    })

    it('applies custom pagination', async () => {
      mockQueryWithRLS
        .mockResolvedValueOnce([{ count: '100' }])
        .mockResolvedValueOnce(mockMediaList)

      const result = await MediaService.list('user-456', {
        limit: 50,
        offset: 100,
      })

      expect(result.limit).toBe(50)
      expect(result.offset).toBe(100)

      // Verify pagination params in query
      expect(mockQueryWithRLS).toHaveBeenNthCalledWith(
        2,
        expect.anything(),
        expect.arrayContaining([50, 100]),
        'user-456'
      )
    })

    it('filters by image type', async () => {
      mockQueryWithRLS
        .mockResolvedValueOnce([{ count: '10' }])
        .mockResolvedValueOnce(mockMediaList)

      await MediaService.list('user-456', { type: 'image' })

      // Verify both queries contain image filter
      expect(mockQueryWithRLS).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("\"mimeType\" LIKE 'image/%'"),
        expect.anything(),
        'user-456'
      )

      expect(mockQueryWithRLS).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("\"mimeType\" LIKE 'image/%'"),
        expect.anything(),
        'user-456'
      )
    })

    it('filters by video type', async () => {
      mockQueryWithRLS
        .mockResolvedValueOnce([{ count: '5' }])
        .mockResolvedValueOnce([])

      await MediaService.list('user-456', { type: 'video' })

      expect(mockQueryWithRLS).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("\"mimeType\" LIKE 'video/%'"),
        expect.anything(),
        'user-456'
      )
    })

    it('does not filter when type is "all"', async () => {
      mockQueryWithRLS
        .mockResolvedValueOnce([{ count: '20' }])
        .mockResolvedValueOnce(mockMediaList)

      await MediaService.list('user-456', { type: 'all' })

      // Verify no mimeType filter is applied
      expect(mockQueryWithRLS).toHaveBeenNthCalledWith(
        1,
        expect.not.stringContaining('mimeType'),
        expect.anything(),
        'user-456'
      )
    })

    it('applies search filter', async () => {
      mockQueryWithRLS
        .mockResolvedValueOnce([{ count: '3' }])
        .mockResolvedValueOnce(mockMediaList)

      await MediaService.list('user-456', { search: 'logo' })

      // Verify search is applied with LIKE fallback for robustness
      expect(mockQueryWithRLS).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('lower(m.filename) LIKE'),
        expect.arrayContaining(['active', '%logo%']),
        'user-456'
      )

      expect(mockQueryWithRLS).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('lower(m.filename) LIKE'),
        expect.arrayContaining(['active', '%logo%']),
        'user-456'
      )
    })

    it('applies sort by createdAt descending (default)', async () => {
      mockQueryWithRLS
        .mockResolvedValueOnce([{ count: '10' }])
        .mockResolvedValueOnce(mockMediaList)

      await MediaService.list('user-456')

      expect(mockQueryWithRLS).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('ORDER BY m."createdAt" DESC'),
        expect.anything(),
        'user-456'
      )
    })

    it('applies custom sort', async () => {
      mockQueryWithRLS
        .mockResolvedValueOnce([{ count: '10' }])
        .mockResolvedValueOnce(mockMediaList)

      await MediaService.list('user-456', {
        orderBy: 'filename',
        orderDir: 'asc',
      })

      expect(mockQueryWithRLS).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('ORDER BY m.filename ASC'),
        expect.anything(),
        'user-456'
      )
    })

    it('applies sort by fileSize', async () => {
      mockQueryWithRLS
        .mockResolvedValueOnce([{ count: '10' }])
        .mockResolvedValueOnce(mockMediaList)

      await MediaService.list('user-456', {
        orderBy: 'fileSize',
        orderDir: 'desc',
      })

      expect(mockQueryWithRLS).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('ORDER BY m."fileSize" DESC'),
        expect.anything(),
        'user-456'
      )
    })

    it('combines multiple filters', async () => {
      mockQueryWithRLS
        .mockResolvedValueOnce([{ count: '2' }])
        .mockResolvedValueOnce(mockMediaList)

      await MediaService.list('user-456', {
        type: 'image',
        search: 'logo',
        limit: 10,
        offset: 20,
        orderBy: 'filename',
        orderDir: 'asc',
      })

      // Verify all filters are present
      const countQuery = mockQueryWithRLS.mock.calls[0][0] as string
      expect(countQuery).toContain("status = $1")
      expect(countQuery).toContain("\"mimeType\" LIKE 'image/%'")
      expect(countQuery).toContain('lower(m.filename) LIKE')

      const dataQuery = mockQueryWithRLS.mock.calls[1][0] as string
      expect(dataQuery).toContain('ORDER BY m.filename ASC')
      expect(dataQuery).toContain('LIMIT')
      expect(dataQuery).toContain('OFFSET')
    })

    it('returns empty list when no results', async () => {
      mockQueryWithRLS
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([])

      const result = await MediaService.list('user-456')

      expect(result.data).toEqual([])
      expect(result.total).toBe(0)
    })

    it('throws error for empty userId', async () => {
      await expect(MediaService.list('')).rejects.toThrow('User ID is required')
      await expect(MediaService.list('  ')).rejects.toThrow('User ID is required')
    })

    it('handles count result with no rows', async () => {
      mockQueryWithRLS
        .mockResolvedValueOnce([]) // No count result
        .mockResolvedValueOnce([])

      const result = await MediaService.list('user-456')

      expect(result.total).toBe(0)
    })
  })

  // ===========================================
  // MUTATIONS
  // ===========================================

  describe('create', () => {
    it('creates media record successfully', async () => {
      mockMutateWithRLS.mockResolvedValue({
        rows: [mockMedia],
        rowCount: 1,
      } as any)

      const createData = {
        url: 'https://example.com/image.jpg',
        filename: 'image.jpg',
        fileSize: 150000,
        mimeType: 'image/jpeg',
        width: 1920,
        height: 1080,
        alt: 'Sample image',
        caption: 'A beautiful landscape',
      }

      const result = await MediaService.create('user-456', 'team-789', createData)

      expect(result).toEqual(mockMedia)
      expect(mockMutateWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO "media"'),
        expect.arrayContaining([
          'user-456',
          'team-789',
          'https://example.com/image.jpg',
          'image.jpg',
          150000,
          'image/jpeg',
          1920,
          1080,
          'Sample image',
          'A beautiful landscape',
        ]),
        'user-456'
      )
    })

    it('creates media without optional fields', async () => {
      const minimalMedia = {
        ...mockMedia,
        width: null,
        height: null,
        alt: null,
        caption: null,
      }

      mockMutateWithRLS.mockResolvedValue({
        rows: [minimalMedia],
        rowCount: 1,
      } as any)

      const createData = {
        url: 'https://example.com/document.pdf',
        filename: 'document.pdf',
        fileSize: 50000,
        mimeType: 'application/pdf',
      }

      const result = await MediaService.create('user-456', 'team-789', createData)

      expect(result).toEqual(minimalMedia)
      expect(mockMutateWithRLS).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining([
          'user-456',
          'team-789',
          'https://example.com/document.pdf',
          'document.pdf',
          50000,
          'application/pdf',
          null, // width
          null, // height
          null, // alt
          null, // caption
        ]),
        'user-456'
      )
    })

    it('throws error for empty userId', async () => {
      const createData = {
        url: 'https://example.com/image.jpg',
        filename: 'image.jpg',
        fileSize: 100,
        mimeType: 'image/jpeg',
      }

      await expect(
        MediaService.create('', 'team-789', createData)
      ).rejects.toThrow('User ID is required')

      await expect(
        MediaService.create('  ', 'team-789', createData)
      ).rejects.toThrow('User ID is required')
    })

    it('throws error for empty teamId', async () => {
      const createData = {
        url: 'https://example.com/image.jpg',
        filename: 'image.jpg',
        fileSize: 100,
        mimeType: 'image/jpeg',
      }

      await expect(
        MediaService.create('user-456', '', createData)
      ).rejects.toThrow('Team ID is required')

      await expect(
        MediaService.create('user-456', '  ', createData)
      ).rejects.toThrow('Team ID is required')
    })

    it('throws error when insert fails', async () => {
      mockMutateWithRLS.mockResolvedValue({
        rows: [],
        rowCount: 0,
      } as any)

      const createData = {
        url: 'https://example.com/image.jpg',
        filename: 'image.jpg',
        fileSize: 100,
        mimeType: 'image/jpeg',
      }

      await expect(
        MediaService.create('user-456', 'team-789', createData)
      ).rejects.toThrow('Failed to create media record')
    })

    it('sets status to active by default', async () => {
      mockMutateWithRLS.mockResolvedValue({
        rows: [mockMedia],
        rowCount: 1,
      } as any)

      const createData = {
        url: 'https://example.com/image.jpg',
        filename: 'image.jpg',
        fileSize: 100,
        mimeType: 'image/jpeg',
      }

      await MediaService.create('user-456', 'team-789', createData)

      expect(mockMutateWithRLS).toHaveBeenCalledWith(
        expect.stringContaining("status\n      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active')"),
        expect.anything(),
        'user-456'
      )
    })
  })

  describe('update', () => {
    it('updates alt text', async () => {
      const updatedMedia = { ...mockMedia, alt: 'Updated alt text' }
      mockMutateWithRLS.mockResolvedValue({
        rows: [updatedMedia],
        rowCount: 1,
      } as any)

      const result = await MediaService.update('media-123', 'user-456', {
        alt: 'Updated alt text',
      })

      expect(result.alt).toBe('Updated alt text')
      expect(mockMutateWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE "media"'),
        expect.arrayContaining(['Updated alt text', 'media-123']),
        'user-456'
      )
      expect(mockMutateWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('alt = $1'),
        expect.anything(),
        'user-456'
      )
    })

    it('updates caption', async () => {
      const updatedMedia = { ...mockMedia, caption: 'Updated caption' }
      mockMutateWithRLS.mockResolvedValue({
        rows: [updatedMedia],
        rowCount: 1,
      } as any)

      const result = await MediaService.update('media-123', 'user-456', {
        caption: 'Updated caption',
      })

      expect(result.caption).toBe('Updated caption')
      expect(mockMutateWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('caption = $1'),
        expect.arrayContaining(['Updated caption', 'media-123']),
        'user-456'
      )
    })

    it('updates both alt and caption', async () => {
      const updatedMedia = {
        ...mockMedia,
        alt: 'New alt',
        caption: 'New caption',
      }
      mockMutateWithRLS.mockResolvedValue({
        rows: [updatedMedia],
        rowCount: 1,
      } as any)

      const result = await MediaService.update('media-123', 'user-456', {
        alt: 'New alt',
        caption: 'New caption',
      })

      expect(result.alt).toBe('New alt')
      expect(result.caption).toBe('New caption')

      const query = mockMutateWithRLS.mock.calls[0][0] as string
      expect(query).toContain('alt = $1')
      expect(query).toContain('caption = $2')
    })

    it('sets updatedAt timestamp', async () => {
      mockMutateWithRLS.mockResolvedValue({
        rows: [mockMedia],
        rowCount: 1,
      } as any)

      await MediaService.update('media-123', 'user-456', {
        alt: 'New alt',
      })

      expect(mockMutateWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('"updatedAt" = NOW()'),
        expect.anything(),
        'user-456'
      )
    })

    it('only updates active media', async () => {
      mockMutateWithRLS.mockResolvedValue({
        rows: [mockMedia],
        rowCount: 1,
      } as any)

      await MediaService.update('media-123', 'user-456', {
        alt: 'New alt',
      })

      expect(mockMutateWithRLS).toHaveBeenCalledWith(
        expect.stringContaining("status = 'active'"),
        expect.anything(),
        'user-456'
      )
    })

    it('throws error when no fields to update', async () => {
      await expect(
        MediaService.update('media-123', 'user-456', {})
      ).rejects.toThrow('No fields to update')
    })

    it('throws error for empty mediaId', async () => {
      await expect(
        MediaService.update('', 'user-456', { alt: 'Test' })
      ).rejects.toThrow('Media ID is required')
    })

    it('throws error for empty userId', async () => {
      await expect(
        MediaService.update('media-123', '', { alt: 'Test' })
      ).rejects.toThrow('User ID is required')
    })

    it('throws error when media not found', async () => {
      mockMutateWithRLS.mockResolvedValue({
        rows: [],
        rowCount: 0,
      } as any)

      await expect(
        MediaService.update('non-existent', 'user-456', { alt: 'Test' })
      ).rejects.toThrow('Media not found or not authorized')
    })

    it('accepts null values to clear fields', async () => {
      const clearedMedia = { ...mockMedia, alt: null, caption: null }
      mockMutateWithRLS.mockResolvedValue({
        rows: [clearedMedia],
        rowCount: 1,
      } as any)

      await MediaService.update('media-123', 'user-456', {
        alt: null,
        caption: null,
      })

      expect(mockMutateWithRLS).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining([null, null, 'media-123']),
        'user-456'
      )
    })
  })

  describe('softDelete', () => {
    it('soft deletes media successfully', async () => {
      mockMutateWithRLS.mockResolvedValue({
        rowCount: 1,
      } as any)

      const result = await MediaService.softDelete('media-123', 'user-456')

      expect(result).toBe(true)
      expect(mockMutateWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE "media"'),
        ['media-123'],
        'user-456'
      )
      expect(mockMutateWithRLS).toHaveBeenCalledWith(
        expect.stringContaining("status = 'deleted'"),
        expect.anything(),
        'user-456'
      )
    })

    it('sets updatedAt timestamp', async () => {
      mockMutateWithRLS.mockResolvedValue({
        rowCount: 1,
      } as any)

      await MediaService.softDelete('media-123', 'user-456')

      expect(mockMutateWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('"updatedAt" = NOW()'),
        expect.anything(),
        'user-456'
      )
    })

    it('only deletes active media', async () => {
      mockMutateWithRLS.mockResolvedValue({
        rowCount: 1,
      } as any)

      await MediaService.softDelete('media-123', 'user-456')

      expect(mockMutateWithRLS).toHaveBeenCalledWith(
        expect.stringContaining("status = 'active'"),
        expect.anything(),
        'user-456'
      )
    })

    it('returns false when media not found', async () => {
      mockMutateWithRLS.mockResolvedValue({
        rowCount: 0,
      } as any)

      const result = await MediaService.softDelete('non-existent', 'user-456')

      expect(result).toBe(false)
    })

    it('throws error for empty mediaId', async () => {
      await expect(
        MediaService.softDelete('', 'user-456')
      ).rejects.toThrow('Media ID is required')
    })

    it('throws error for empty userId', async () => {
      await expect(
        MediaService.softDelete('media-123', '')
      ).rejects.toThrow('User ID is required')
    })
  })

  describe('count', () => {
    it('counts all media by default', async () => {
      mockQueryWithRLS.mockResolvedValue([{ count: '25' }])

      const result = await MediaService.count('user-456')

      expect(result).toBe(25)
      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*)'),
        ['active'],
        'user-456'
      )
    })

    it('counts only images', async () => {
      mockQueryWithRLS.mockResolvedValue([{ count: '15' }])

      const result = await MediaService.count('user-456', { type: 'image' })

      expect(result).toBe(15)
      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining("\"mimeType\" LIKE 'image/%'"),
        expect.anything(),
        'user-456'
      )
    })

    it('counts only videos', async () => {
      mockQueryWithRLS.mockResolvedValue([{ count: '8' }])

      const result = await MediaService.count('user-456', { type: 'video' })

      expect(result).toBe(8)
      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining("\"mimeType\" LIKE 'video/%'"),
        expect.anything(),
        'user-456'
      )
    })

    it('counts all types when type is "all"', async () => {
      mockQueryWithRLS.mockResolvedValue([{ count: '30' }])

      const result = await MediaService.count('user-456', { type: 'all' })

      expect(result).toBe(30)
      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.not.stringContaining('mimeType'),
        expect.anything(),
        'user-456'
      )
    })

    it('filters by status', async () => {
      mockQueryWithRLS.mockResolvedValue([{ count: '5' }])

      const result = await MediaService.count('user-456', { status: 'deleted' })

      expect(result).toBe(5)
      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.anything(),
        ['deleted'],
        'user-456'
      )
    })

    it('returns 0 when no results', async () => {
      mockQueryWithRLS.mockResolvedValue([{ count: '0' }])

      const result = await MediaService.count('user-456')

      expect(result).toBe(0)
    })

    it('returns 0 when count result is empty', async () => {
      mockQueryWithRLS.mockResolvedValue([])

      const result = await MediaService.count('user-456')

      expect(result).toBe(0)
    })

    it('throws error for empty userId', async () => {
      await expect(MediaService.count('')).rejects.toThrow('User ID is required')
      await expect(MediaService.count('  ')).rejects.toThrow('User ID is required')
    })

    it('handles large counts', async () => {
      mockQueryWithRLS.mockResolvedValue([{ count: '999999' }])

      const result = await MediaService.count('user-456')

      expect(result).toBe(999999)
    })
  })
})
