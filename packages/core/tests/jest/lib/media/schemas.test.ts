/**
 * Media Schema Validation Tests
 *
 * Tests all Zod schemas for media module to ensure proper validation
 * of API inputs and type safety.
 */

import { describe, test, expect } from '@jest/globals'
import {
  createMediaSchema,
  updateMediaSchema,
  mediaListQuerySchema,
} from '@/core/lib/media/schemas'

// ===========================================
// CREATE MEDIA SCHEMA
// ===========================================

describe('Media Schema - createMediaSchema', () => {
  test('should accept valid media data with all fields', () => {
    const validMedia = {
      url: 'https://example.com/image.jpg',
      filename: 'image.jpg',
      fileSize: 150000,
      mimeType: 'image/jpeg',
      width: 1920,
      height: 1080,
      alt: 'Sample image description',
      caption: 'A beautiful landscape photo',
    }

    const result = createMediaSchema.safeParse(validMedia)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.url).toBe('https://example.com/image.jpg')
      expect(result.data.filename).toBe('image.jpg')
      expect(result.data.fileSize).toBe(150000)
      expect(result.data.mimeType).toBe('image/jpeg')
      expect(result.data.width).toBe(1920)
      expect(result.data.height).toBe(1080)
    }
  })

  test('should accept valid media with only required fields', () => {
    const minimalMedia = {
      url: 'https://example.com/document.pdf',
      filename: 'document.pdf',
      fileSize: 50000,
      mimeType: 'application/pdf',
    }

    const result = createMediaSchema.safeParse(minimalMedia)
    expect(result.success).toBe(true)
  })

  test('should reject invalid URL format', () => {
    const invalidUrl = {
      url: 'not-a-valid-url',
      filename: 'test.jpg',
      fileSize: 100,
      mimeType: 'image/jpeg',
    }

    const result = createMediaSchema.safeParse(invalidUrl)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('Invalid URL')
    }
  })

  test('should reject empty URL', () => {
    const emptyUrl = {
      url: '',
      filename: 'test.jpg',
      fileSize: 100,
      mimeType: 'image/jpeg',
    }

    const result = createMediaSchema.safeParse(emptyUrl)
    expect(result.success).toBe(false)
  })

  test('should reject missing required fields', () => {
    const missingFields = [
      { filename: 'test.jpg', fileSize: 100, mimeType: 'image/jpeg' }, // missing url
      { url: 'https://example.com/test.jpg', fileSize: 100, mimeType: 'image/jpeg' }, // missing filename
      { url: 'https://example.com/test.jpg', filename: 'test.jpg', mimeType: 'image/jpeg' }, // missing fileSize
      { url: 'https://example.com/test.jpg', filename: 'test.jpg', fileSize: 100 }, // missing mimeType
    ]

    missingFields.forEach(data => {
      const result = createMediaSchema.safeParse(data)
      expect(result.success).toBe(false)
    })
  })

  test('should reject empty filename', () => {
    const emptyFilename = {
      url: 'https://example.com/test.jpg',
      filename: '',
      fileSize: 100,
      mimeType: 'image/jpeg',
    }

    const result = createMediaSchema.safeParse(emptyFilename)
    expect(result.success).toBe(false)
  })

  test('should reject filename exceeding max length', () => {
    const longFilename = {
      url: 'https://example.com/test.jpg',
      filename: 'a'.repeat(256), // 256 chars, max is 255
      fileSize: 100,
      mimeType: 'image/jpeg',
    }

    const result = createMediaSchema.safeParse(longFilename)
    expect(result.success).toBe(false)
  })

  test('should accept filename at max length', () => {
    const maxFilename = {
      url: 'https://example.com/test.jpg',
      filename: 'a'.repeat(255), // exactly 255 chars
      fileSize: 100,
      mimeType: 'image/jpeg',
    }

    const result = createMediaSchema.safeParse(maxFilename)
    expect(result.success).toBe(true)
  })

  test('should reject negative fileSize', () => {
    const negativeSize = {
      url: 'https://example.com/test.jpg',
      filename: 'test.jpg',
      fileSize: -100,
      mimeType: 'image/jpeg',
    }

    const result = createMediaSchema.safeParse(negativeSize)
    expect(result.success).toBe(false)
  })

  test('should reject zero fileSize', () => {
    const zeroSize = {
      url: 'https://example.com/test.jpg',
      filename: 'test.jpg',
      fileSize: 0,
      mimeType: 'image/jpeg',
    }

    const result = createMediaSchema.safeParse(zeroSize)
    expect(result.success).toBe(false)
  })

  test('should reject decimal fileSize', () => {
    const decimalSize = {
      url: 'https://example.com/test.jpg',
      filename: 'test.jpg',
      fileSize: 100.5,
      mimeType: 'image/jpeg',
    }

    const result = createMediaSchema.safeParse(decimalSize)
    expect(result.success).toBe(false)
  })

  test('should accept large fileSize', () => {
    const largeSize = {
      url: 'https://example.com/video.mp4',
      filename: 'video.mp4',
      fileSize: 5000000000, // 5GB
      mimeType: 'video/mp4',
    }

    const result = createMediaSchema.safeParse(largeSize)
    expect(result.success).toBe(true)
  })

  test('should reject empty mimeType', () => {
    const emptyMimeType = {
      url: 'https://example.com/test.jpg',
      filename: 'test.jpg',
      fileSize: 100,
      mimeType: '',
    }

    const result = createMediaSchema.safeParse(emptyMimeType)
    expect(result.success).toBe(false)
  })

  test('should accept various mimeType formats', () => {
    const mimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/webm',
      'application/pdf',
      'text/plain',
    ]

    mimeTypes.forEach(mimeType => {
      const data = {
        url: 'https://example.com/file',
        filename: 'file',
        fileSize: 100,
        mimeType,
      }
      const result = createMediaSchema.safeParse(data)
      expect(result.success).toBe(true)
    })
  })

  test('should reject negative width', () => {
    const negativeWidth = {
      url: 'https://example.com/image.jpg',
      filename: 'image.jpg',
      fileSize: 100,
      mimeType: 'image/jpeg',
      width: -1920,
      height: 1080,
    }

    const result = createMediaSchema.safeParse(negativeWidth)
    expect(result.success).toBe(false)
  })

  test('should reject zero width', () => {
    const zeroWidth = {
      url: 'https://example.com/image.jpg',
      filename: 'image.jpg',
      fileSize: 100,
      mimeType: 'image/jpeg',
      width: 0,
      height: 1080,
    }

    const result = createMediaSchema.safeParse(zeroWidth)
    expect(result.success).toBe(false)
  })

  test('should accept null width and height', () => {
    const nullDimensions = {
      url: 'https://example.com/document.pdf',
      filename: 'document.pdf',
      fileSize: 100,
      mimeType: 'application/pdf',
      width: null,
      height: null,
    }

    const result = createMediaSchema.safeParse(nullDimensions)
    expect(result.success).toBe(true)
  })

  test('should reject decimal width', () => {
    const decimalWidth = {
      url: 'https://example.com/image.jpg',
      filename: 'image.jpg',
      fileSize: 100,
      mimeType: 'image/jpeg',
      width: 1920.5,
      height: 1080,
    }

    const result = createMediaSchema.safeParse(decimalWidth)
    expect(result.success).toBe(false)
  })

  test('should accept alt text up to max length', () => {
    const maxAlt = {
      url: 'https://example.com/image.jpg',
      filename: 'image.jpg',
      fileSize: 100,
      mimeType: 'image/jpeg',
      alt: 'a'.repeat(500), // exactly 500 chars
    }

    const result = createMediaSchema.safeParse(maxAlt)
    expect(result.success).toBe(true)
  })

  test('should reject alt text exceeding max length', () => {
    const longAlt = {
      url: 'https://example.com/image.jpg',
      filename: 'image.jpg',
      fileSize: 100,
      mimeType: 'image/jpeg',
      alt: 'a'.repeat(501), // 501 chars, max is 500
    }

    const result = createMediaSchema.safeParse(longAlt)
    expect(result.success).toBe(false)
  })

  test('should accept null alt', () => {
    const nullAlt = {
      url: 'https://example.com/image.jpg',
      filename: 'image.jpg',
      fileSize: 100,
      mimeType: 'image/jpeg',
      alt: null,
    }

    const result = createMediaSchema.safeParse(nullAlt)
    expect(result.success).toBe(true)
  })

  test('should accept caption up to max length', () => {
    const maxCaption = {
      url: 'https://example.com/image.jpg',
      filename: 'image.jpg',
      fileSize: 100,
      mimeType: 'image/jpeg',
      caption: 'a'.repeat(1000), // exactly 1000 chars
    }

    const result = createMediaSchema.safeParse(maxCaption)
    expect(result.success).toBe(true)
  })

  test('should reject caption exceeding max length', () => {
    const longCaption = {
      url: 'https://example.com/image.jpg',
      filename: 'image.jpg',
      fileSize: 100,
      mimeType: 'image/jpeg',
      caption: 'a'.repeat(1001), // 1001 chars, max is 1000
    }

    const result = createMediaSchema.safeParse(longCaption)
    expect(result.success).toBe(false)
  })

  test('should accept null caption', () => {
    const nullCaption = {
      url: 'https://example.com/image.jpg',
      filename: 'image.jpg',
      fileSize: 100,
      mimeType: 'image/jpeg',
      caption: null,
    }

    const result = createMediaSchema.safeParse(nullCaption)
    expect(result.success).toBe(true)
  })
})

// ===========================================
// UPDATE MEDIA SCHEMA
// ===========================================

describe('Media Schema - updateMediaSchema', () => {
  test('should accept valid alt update', () => {
    const update = {
      alt: 'Updated alt text',
    }

    const result = updateMediaSchema.safeParse(update)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.alt).toBe('Updated alt text')
    }
  })

  test('should accept valid caption update', () => {
    const update = {
      caption: 'Updated caption text',
    }

    const result = updateMediaSchema.safeParse(update)
    expect(result.success).toBe(true)
  })

  test('should accept both fields', () => {
    const update = {
      alt: 'New alt',
      caption: 'New caption',
    }

    const result = updateMediaSchema.safeParse(update)
    expect(result.success).toBe(true)
  })

  test('should accept empty object', () => {
    const result = updateMediaSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  test('should accept null values', () => {
    const updates = [
      { alt: null },
      { caption: null },
      { alt: null, caption: null },
    ]

    updates.forEach(update => {
      const result = updateMediaSchema.safeParse(update)
      expect(result.success).toBe(true)
    })
  })

  test('should reject alt exceeding max length', () => {
    const longAlt = {
      alt: 'a'.repeat(501), // 501 chars, max is 500
    }

    const result = updateMediaSchema.safeParse(longAlt)
    expect(result.success).toBe(false)
  })

  test('should accept alt at max length', () => {
    const maxAlt = {
      alt: 'a'.repeat(500), // exactly 500 chars
    }

    const result = updateMediaSchema.safeParse(maxAlt)
    expect(result.success).toBe(true)
  })

  test('should reject caption exceeding max length', () => {
    const longCaption = {
      caption: 'a'.repeat(1001), // 1001 chars, max is 1000
    }

    const result = updateMediaSchema.safeParse(longCaption)
    expect(result.success).toBe(false)
  })

  test('should accept caption at max length', () => {
    const maxCaption = {
      caption: 'a'.repeat(1000), // exactly 1000 chars
    }

    const result = updateMediaSchema.safeParse(maxCaption)
    expect(result.success).toBe(true)
  })

  test('should ignore unknown fields', () => {
    const update = {
      alt: 'New alt',
      url: 'https://example.com/new.jpg', // Should be ignored (immutable)
      fileSize: 999, // Should be ignored (immutable)
    }

    const result = updateMediaSchema.safeParse(update)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toHaveProperty('alt')
      expect(result.data).not.toHaveProperty('url')
      expect(result.data).not.toHaveProperty('fileSize')
    }
  })
})

// ===========================================
// MEDIA LIST QUERY SCHEMA
// ===========================================

describe('Media Schema - mediaListQuerySchema', () => {
  test('should apply default values for empty object', () => {
    const result = mediaListQuerySchema.parse({})

    expect(result.limit).toBe(20)
    expect(result.offset).toBe(0)
    expect(result.orderBy).toBe('createdAt')
    expect(result.orderDir).toBe('desc')
    expect(result.type).toBe('all')
  })

  test('should accept valid pagination params', () => {
    const query = {
      limit: 50,
      offset: 100,
    }

    const result = mediaListQuerySchema.parse(query)
    expect(result.limit).toBe(50)
    expect(result.offset).toBe(100)
  })

  test('should coerce string numbers to integers', () => {
    const query = {
      limit: '30' as any,
      offset: '60' as any,
    }

    const result = mediaListQuerySchema.parse(query)
    expect(result.limit).toBe(30)
    expect(result.offset).toBe(60)
    expect(typeof result.limit).toBe('number')
    expect(typeof result.offset).toBe('number')
  })

  test('should reject limit below minimum', () => {
    expect(() => mediaListQuerySchema.parse({ limit: 0 })).toThrow()
    expect(() => mediaListQuerySchema.parse({ limit: -1 })).toThrow()
  })

  test('should reject limit above maximum', () => {
    expect(() => mediaListQuerySchema.parse({ limit: 101 })).toThrow()
    expect(() => mediaListQuerySchema.parse({ limit: 1000 })).toThrow()
  })

  test('should accept limit at boundaries', () => {
    const min = mediaListQuerySchema.parse({ limit: 1 })
    expect(min.limit).toBe(1)

    const max = mediaListQuerySchema.parse({ limit: 100 })
    expect(max.limit).toBe(100)
  })

  test('should reject negative offset', () => {
    expect(() => mediaListQuerySchema.parse({ offset: -1 })).toThrow()
    expect(() => mediaListQuerySchema.parse({ offset: -100 })).toThrow()
  })

  test('should accept zero offset', () => {
    const result = mediaListQuerySchema.parse({ offset: 0 })
    expect(result.offset).toBe(0)
  })

  test('should accept large offset', () => {
    const result = mediaListQuerySchema.parse({ offset: 10000 })
    expect(result.offset).toBe(10000)
  })

  test('should accept valid orderBy values', () => {
    const validOrderBy = ['createdAt', 'filename', 'fileSize']

    validOrderBy.forEach(orderBy => {
      const result = mediaListQuerySchema.parse({ orderBy })
      expect(result.orderBy).toBe(orderBy)
    })
  })

  test('should reject invalid orderBy values', () => {
    const invalidOrderBy = ['id', 'updatedAt', 'mimeType', 'width']

    invalidOrderBy.forEach(orderBy => {
      expect(() => mediaListQuerySchema.parse({ orderBy })).toThrow()
    })
  })

  test('should accept valid orderDir values', () => {
    const asc = mediaListQuerySchema.parse({ orderDir: 'asc' })
    expect(asc.orderDir).toBe('asc')

    const desc = mediaListQuerySchema.parse({ orderDir: 'desc' })
    expect(desc.orderDir).toBe('desc')
  })

  test('should reject invalid orderDir values', () => {
    expect(() => mediaListQuerySchema.parse({ orderDir: 'ascending' })).toThrow()
    expect(() => mediaListQuerySchema.parse({ orderDir: 'descending' })).toThrow()
    expect(() => mediaListQuerySchema.parse({ orderDir: 'ASC' })).toThrow()
  })

  test('should accept valid type values', () => {
    const validTypes = ['image', 'video', 'all']

    validTypes.forEach(type => {
      const result = mediaListQuerySchema.parse({ type })
      expect(result.type).toBe(type)
    })
  })

  test('should reject invalid type values', () => {
    const invalidTypes = ['document', 'audio', 'other']

    invalidTypes.forEach(type => {
      expect(() => mediaListQuerySchema.parse({ type })).toThrow()
    })
  })

  test('should accept search string', () => {
    const result = mediaListQuerySchema.parse({ search: 'logo' })
    expect(result.search).toBe('logo')
  })

  test('should accept empty search string', () => {
    const result = mediaListQuerySchema.parse({ search: '' })
    expect(result.search).toBe('')
  })

  test('should accept undefined search', () => {
    const result = mediaListQuerySchema.parse({})
    expect(result.search).toBeUndefined()
  })

  test('should accept all valid params together', () => {
    const query = {
      limit: 25,
      offset: 50,
      orderBy: 'filename',
      orderDir: 'asc',
      type: 'image',
      search: 'test',
    }

    const result = mediaListQuerySchema.parse(query)
    expect(result).toEqual({
      limit: 25,
      offset: 50,
      orderBy: 'filename',
      orderDir: 'asc',
      type: 'image',
      search: 'test',
    })
  })

  test('should reject decimal limit and offset', () => {
    expect(() => mediaListQuerySchema.parse({ limit: 20.5 })).toThrow()
    expect(() => mediaListQuerySchema.parse({ offset: 10.5 })).toThrow()
  })

  test('should ignore unknown fields', () => {
    const query = {
      limit: 10,
      unknownField: 'value',
      anotherField: 123,
    }

    const result = mediaListQuerySchema.parse(query)
    expect(result).not.toHaveProperty('unknownField')
    expect(result).not.toHaveProperty('anotherField')
  })
})
