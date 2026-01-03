/**
 * Unit Tests - Posts Validation Schemas
 *
 * Tests Zod validation schemas for posts API:
 * - createPostSchema: Required fields, slug format, URL validation, block structure
 * - Edge cases: Empty strings, max lengths, invalid formats
 *
 * Focus on business logic validation WITHOUT database calls.
 */

import { z } from 'zod'

// Copy schemas from API route to test in isolation
const createPostSchema = z.object({
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes'),
  title: z.string().min(1).max(255),
  excerpt: z.string().max(500).optional(),
  featuredImage: z.string().url().max(500).optional().or(z.literal('')),
  blocks: z.array(z.object({
    id: z.string(),
    blockSlug: z.string(),
    props: z.record(z.string(), z.unknown())
  })).default([]),
  locale: z.string().default('en'),
  seoTitle: z.string().max(255).optional(),
  seoDescription: z.string().optional(),
  seoKeywords: z.string().optional(),
  ogImage: z.string().url().max(500).optional().or(z.literal('')),
  noindex: z.boolean().default(false),
  nofollow: z.boolean().default(false),
  published: z.boolean().default(false),
  categoryIds: z.array(z.string()).optional()
})

describe('Posts Validation Schemas', () => {
  describe('createPostSchema - Valid Data', () => {
    it('should accept minimal valid post data', () => {
      const validData = {
        slug: 'test-post',
        title: 'Test Post'
      }

      const result = createPostSchema.safeParse(validData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.slug).toBe('test-post')
        expect(result.data.title).toBe('Test Post')
        expect(result.data.blocks).toEqual([]) // Default value
        expect(result.data.locale).toBe('en') // Default value
        expect(result.data.published).toBe(false) // Default value
      }
    })

    it('should accept complete post data with all fields', () => {
      const completeData = {
        slug: 'complete-post',
        title: 'Complete Post',
        excerpt: 'This is an excerpt',
        featuredImage: 'https://example.com/image.jpg',
        blocks: [
          {
            id: 'block-1',
            blockSlug: 'hero',
            props: { title: 'Hero Title' }
          }
        ],
        locale: 'es',
        seoTitle: 'SEO Title',
        seoDescription: 'SEO Description',
        seoKeywords: 'keyword1, keyword2',
        ogImage: 'https://example.com/og-image.jpg',
        noindex: true,
        nofollow: true,
        published: true,
        categoryIds: ['cat-1', 'cat-2']
      }

      const result = createPostSchema.safeParse(completeData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.slug).toBe('complete-post')
        expect(result.data.title).toBe('Complete Post')
        expect(result.data.excerpt).toBe('This is an excerpt')
        expect(result.data.featuredImage).toBe('https://example.com/image.jpg')
        expect(result.data.blocks).toHaveLength(1)
        expect(result.data.locale).toBe('es')
        expect(result.data.published).toBe(true)
        expect(result.data.categoryIds).toEqual(['cat-1', 'cat-2'])
      }
    })

    it('should accept empty blocks array', () => {
      const data = {
        slug: 'no-blocks',
        title: 'Post Without Blocks',
        blocks: []
      }

      const result = createPostSchema.safeParse(data)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.blocks).toEqual([])
      }
    })

    it('should accept empty string for featuredImage', () => {
      const data = {
        slug: 'test-post',
        title: 'Test',
        featuredImage: ''
      }

      const result = createPostSchema.safeParse(data)

      expect(result.success).toBe(true)
    })

    it('should accept empty string for ogImage', () => {
      const data = {
        slug: 'test-post',
        title: 'Test',
        ogImage: ''
      }

      const result = createPostSchema.safeParse(data)

      expect(result.success).toBe(true)
    })
  })

  describe('createPostSchema - Slug Validation', () => {
    it('should reject empty slug', () => {
      const data = {
        slug: '',
        title: 'Test'
      }

      const result = createPostSchema.safeParse(data)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('slug')
      }
    })

    it('should reject slug shorter than 2 characters', () => {
      const data = {
        slug: 'a',
        title: 'Test'
      }

      const result = createPostSchema.safeParse(data)

      expect(result.success).toBe(false)
    })

    it('should reject slug longer than 100 characters', () => {
      const data = {
        slug: 'a'.repeat(101),
        title: 'Test'
      }

      const result = createPostSchema.safeParse(data)

      expect(result.success).toBe(false)
    })

    it('should reject slug with uppercase letters', () => {
      const data = {
        slug: 'Test-Post',
        title: 'Test'
      }

      const result = createPostSchema.safeParse(data)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('lowercase')
      }
    })

    it('should reject slug with spaces', () => {
      const data = {
        slug: 'test post',
        title: 'Test'
      }

      const result = createPostSchema.safeParse(data)

      expect(result.success).toBe(false)
    })

    it('should reject slug with special characters', () => {
      const invalidSlugs = [
        'test_post', // underscore
        'test.post', // period
        'test@post', // at symbol
        'test!post', // exclamation
        'test#post', // hash
      ]

      invalidSlugs.forEach(slug => {
        const result = createPostSchema.safeParse({ slug, title: 'Test' })
        expect(result.success).toBe(false)
      })
    })

    it('should accept slug with numbers and dashes', () => {
      const validSlugs = [
        'test-post-123',
        '2024-01-01',
        'post-1',
        'hello-world-123-test',
      ]

      validSlugs.forEach(slug => {
        const result = createPostSchema.safeParse({ slug, title: 'Test' })
        expect(result.success).toBe(true)
      })
    })
  })

  describe('createPostSchema - Title Validation', () => {
    it('should reject empty title', () => {
      const data = {
        slug: 'test',
        title: ''
      }

      const result = createPostSchema.safeParse(data)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('title')
      }
    })

    it('should reject title longer than 255 characters', () => {
      const data = {
        slug: 'test',
        title: 'a'.repeat(256)
      }

      const result = createPostSchema.safeParse(data)

      expect(result.success).toBe(false)
    })

    it('should accept title with exactly 255 characters', () => {
      const data = {
        slug: 'test',
        title: 'a'.repeat(255)
      }

      const result = createPostSchema.safeParse(data)

      expect(result.success).toBe(true)
    })
  })

  describe('createPostSchema - Excerpt Validation', () => {
    it('should accept excerpt with 500 characters', () => {
      const data = {
        slug: 'test',
        title: 'Test',
        excerpt: 'a'.repeat(500)
      }

      const result = createPostSchema.safeParse(data)

      expect(result.success).toBe(true)
    })

    it('should reject excerpt longer than 500 characters', () => {
      const data = {
        slug: 'test',
        title: 'Test',
        excerpt: 'a'.repeat(501)
      }

      const result = createPostSchema.safeParse(data)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('excerpt')
      }
    })

    it('should accept missing excerpt (optional)', () => {
      const data = {
        slug: 'test',
        title: 'Test'
      }

      const result = createPostSchema.safeParse(data)

      expect(result.success).toBe(true)
    })
  })

  describe('createPostSchema - URL Validation', () => {
    it('should reject invalid featuredImage URL', () => {
      const invalidUrls = [
        'not-a-url',
        'example.com/image.jpg', // missing protocol
      ]

      invalidUrls.forEach(url => {
        const result = createPostSchema.safeParse({
          slug: 'test',
          title: 'Test',
          featuredImage: url
        })
        expect(result.success).toBe(false)
      })
    })

    it('should accept ftp URL (Zod url() accepts any valid URL scheme)', () => {
      // Note: Zod z.string().url() accepts any valid URL including ftp://
      // If http/https only is required, use .regex() instead
      const result = createPostSchema.safeParse({
        slug: 'test',
        title: 'Test',
        featuredImage: 'ftp://example.com/image.jpg'
      })
      expect(result.success).toBe(true)
    })

    it('should accept valid featuredImage URLs', () => {
      const validUrls = [
        'https://example.com/image.jpg',
        'http://example.com/image.png',
        'https://cdn.example.com/path/to/image.webp',
      ]

      validUrls.forEach(url => {
        const result = createPostSchema.safeParse({
          slug: 'test',
          title: 'Test',
          featuredImage: url
        })
        expect(result.success).toBe(true)
      })
    })

    it('should reject invalid ogImage URL', () => {
      const result = createPostSchema.safeParse({
        slug: 'test',
        title: 'Test',
        ogImage: 'not-a-url'
      })

      expect(result.success).toBe(false)
    })
  })

  describe('createPostSchema - Blocks Validation', () => {
    it('should require id, blockSlug, and props in each block', () => {
      const data = {
        slug: 'test',
        title: 'Test',
        blocks: [
          { id: 'b1', blockSlug: 'hero', props: {} }
        ]
      }

      const result = createPostSchema.safeParse(data)

      expect(result.success).toBe(true)
    })

    it('should reject blocks missing required fields', () => {
      const invalidBlocks = [
        [{ blockSlug: 'hero', props: {} }], // missing id
        [{ id: 'b1', props: {} }], // missing blockSlug
        [{ id: 'b1', blockSlug: 'hero' }], // missing props
      ]

      invalidBlocks.forEach(blocks => {
        const result = createPostSchema.safeParse({
          slug: 'test',
          title: 'Test',
          blocks
        })
        expect(result.success).toBe(false)
      })
    })

    it('should accept blocks with complex props', () => {
      const data = {
        slug: 'test',
        title: 'Test',
        blocks: [
          {
            id: 'block-1',
            blockSlug: 'hero',
            props: {
              title: 'Hero Title',
              subtitle: 'Subtitle',
              nested: { value: 123 },
              array: [1, 2, 3]
            }
          }
        ]
      }

      const result = createPostSchema.safeParse(data)

      expect(result.success).toBe(true)
    })
  })

  describe('createPostSchema - SEO Validation', () => {
    it('should accept valid SEO fields', () => {
      const data = {
        slug: 'test',
        title: 'Test',
        seoTitle: 'SEO Title',
        seoDescription: 'SEO Description',
        seoKeywords: 'keyword1, keyword2, keyword3'
      }

      const result = createPostSchema.safeParse(data)

      expect(result.success).toBe(true)
    })

    it('should reject seoTitle longer than 255 characters', () => {
      const data = {
        slug: 'test',
        title: 'Test',
        seoTitle: 'a'.repeat(256)
      }

      const result = createPostSchema.safeParse(data)

      expect(result.success).toBe(false)
    })

    it('should accept missing SEO fields (optional)', () => {
      const data = {
        slug: 'test',
        title: 'Test'
      }

      const result = createPostSchema.safeParse(data)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.seoTitle).toBeUndefined()
        expect(result.data.seoDescription).toBeUndefined()
      }
    })
  })

  describe('createPostSchema - Boolean Flags', () => {
    it('should default noindex to false', () => {
      const data = {
        slug: 'test',
        title: 'Test'
      }

      const result = createPostSchema.safeParse(data)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.noindex).toBe(false)
      }
    })

    it('should accept noindex as true', () => {
      const data = {
        slug: 'test',
        title: 'Test',
        noindex: true
      }

      const result = createPostSchema.safeParse(data)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.noindex).toBe(true)
      }
    })

    it('should default published to false', () => {
      const data = {
        slug: 'test',
        title: 'Test'
      }

      const result = createPostSchema.safeParse(data)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.published).toBe(false)
      }
    })
  })

  describe('createPostSchema - Category IDs', () => {
    it('should accept array of category IDs', () => {
      const data = {
        slug: 'test',
        title: 'Test',
        categoryIds: ['cat-1', 'cat-2', 'cat-3']
      }

      const result = createPostSchema.safeParse(data)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.categoryIds).toHaveLength(3)
      }
    })

    it('should accept empty category IDs array', () => {
      const data = {
        slug: 'test',
        title: 'Test',
        categoryIds: []
      }

      const result = createPostSchema.safeParse(data)

      expect(result.success).toBe(true)
    })

    it('should accept missing categoryIds (optional)', () => {
      const data = {
        slug: 'test',
        title: 'Test'
      }

      const result = createPostSchema.safeParse(data)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.categoryIds).toBeUndefined()
      }
    })
  })
})
