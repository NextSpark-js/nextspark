/**
 * Unit Tests - Post Categories Validation Schemas
 *
 * Tests Zod validation for post categories API:
 * - createCategorySchema: Name, slug, parentId, icon, color
 * - Slug auto-generation logic
 * - Edge cases: Special characters, empty strings, hierarchical validation
 *
 * Focus on validation logic WITHOUT database calls.
 */

import { z } from 'zod'

// Copy schemas from API route to test in isolation
const createCategorySchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes').optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  parentId: z.string().optional(),
  order: z.number().int().default(0),
  isDefault: z.boolean().default(false)
})

// Copy helper function from API route
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-')          // Replace spaces with dashes
    .replace(/-+/g, '-')           // Replace multiple dashes with single
    .replace(/^-|-$/g, '')         // Remove leading/trailing dashes
}

describe('Post Categories Validation', () => {
  describe('createCategorySchema - Valid Data', () => {
    it('should accept minimal valid category data', () => {
      const validData = {
        name: 'Technology'
      }

      const result = createCategorySchema.safeParse(validData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('Technology')
        expect(result.data.order).toBe(0) // Default value
        expect(result.data.isDefault).toBe(false) // Default value
      }
    })

    it('should accept complete category data with all fields', () => {
      const completeData = {
        name: 'Web Development',
        slug: 'web-development',
        description: 'Posts about web development',
        icon: 'code',
        color: '#3B82F6',
        parentId: 'parent-cat-id',
        order: 5,
        isDefault: true
      }

      const result = createCategorySchema.safeParse(completeData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('Web Development')
        expect(result.data.slug).toBe('web-development')
        expect(result.data.description).toBe('Posts about web development')
        expect(result.data.icon).toBe('code')
        expect(result.data.color).toBe('#3B82F6')
        expect(result.data.parentId).toBe('parent-cat-id')
        expect(result.data.order).toBe(5)
        expect(result.data.isDefault).toBe(true)
      }
    })

    it('should accept category without slug (for auto-generation)', () => {
      const data = {
        name: 'Test Category'
      }

      const result = createCategorySchema.safeParse(data)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.slug).toBeUndefined()
      }
    })
  })

  describe('createCategorySchema - Name Validation', () => {
    it('should reject empty name', () => {
      const data = {
        name: ''
      }

      const result = createCategorySchema.safeParse(data)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('name')
      }
    })

    it('should reject name longer than 255 characters', () => {
      const data = {
        name: 'a'.repeat(256)
      }

      const result = createCategorySchema.safeParse(data)

      expect(result.success).toBe(false)
    })

    it('should accept name with exactly 255 characters', () => {
      const data = {
        name: 'a'.repeat(255)
      }

      const result = createCategorySchema.safeParse(data)

      expect(result.success).toBe(true)
    })

    it('should accept name with special characters', () => {
      const validNames = [
        'Technology & Science',
        'Front-end Development',
        'Tips/Tricks',
        'Best Practices (2024)',
      ]

      validNames.forEach(name => {
        const result = createCategorySchema.safeParse({ name })
        expect(result.success).toBe(true)
      })
    })
  })

  describe('createCategorySchema - Slug Validation', () => {
    it('should reject slug with uppercase letters', () => {
      const data = {
        name: 'Test',
        slug: 'Test-Category'
      }

      const result = createCategorySchema.safeParse(data)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('lowercase')
      }
    })

    it('should reject slug with special characters', () => {
      const invalidSlugs = [
        'test_category',
        'test.category',
        'test category',
        'test@category',
      ]

      invalidSlugs.forEach(slug => {
        const result = createCategorySchema.safeParse({ name: 'Test', slug })
        expect(result.success).toBe(false)
      })
    })

    it('should reject slug shorter than 2 characters', () => {
      const data = {
        name: 'Test',
        slug: 'a'
      }

      const result = createCategorySchema.safeParse(data)

      expect(result.success).toBe(false)
    })

    it('should reject slug longer than 100 characters', () => {
      const data = {
        name: 'Test',
        slug: 'a'.repeat(101)
      }

      const result = createCategorySchema.safeParse(data)

      expect(result.success).toBe(false)
    })

    it('should accept valid slugs', () => {
      const validSlugs = [
        'technology',
        'web-development',
        'tips-tricks-2024',
        'category-123',
      ]

      validSlugs.forEach(slug => {
        const result = createCategorySchema.safeParse({ name: 'Test', slug })
        expect(result.success).toBe(true)
      })
    })
  })

  describe('createCategorySchema - Optional Fields', () => {
    it('should accept missing description', () => {
      const data = {
        name: 'Test'
      }

      const result = createCategorySchema.safeParse(data)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.description).toBeUndefined()
      }
    })

    it('should accept missing icon', () => {
      const data = {
        name: 'Test'
      }

      const result = createCategorySchema.safeParse(data)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.icon).toBeUndefined()
      }
    })

    it('should accept missing color', () => {
      const data = {
        name: 'Test'
      }

      const result = createCategorySchema.safeParse(data)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.color).toBeUndefined()
      }
    })

    it('should accept missing parentId', () => {
      const data = {
        name: 'Test'
      }

      const result = createCategorySchema.safeParse(data)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.parentId).toBeUndefined()
      }
    })
  })

  describe('createCategorySchema - Order Validation', () => {
    it('should default order to 0', () => {
      const data = {
        name: 'Test'
      }

      const result = createCategorySchema.safeParse(data)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.order).toBe(0)
      }
    })

    it('should accept positive order values', () => {
      const data = {
        name: 'Test',
        order: 5
      }

      const result = createCategorySchema.safeParse(data)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.order).toBe(5)
      }
    })

    it('should accept negative order values', () => {
      const data = {
        name: 'Test',
        order: -1
      }

      const result = createCategorySchema.safeParse(data)

      expect(result.success).toBe(true)
    })

    it('should reject non-integer order values', () => {
      const data = {
        name: 'Test',
        order: 5.5
      }

      const result = createCategorySchema.safeParse(data)

      expect(result.success).toBe(false)
    })
  })
})

describe('Slug Generation Logic', () => {
  describe('generateSlug - Basic Functionality', () => {
    it('should convert name to lowercase', () => {
      expect(generateSlug('Technology')).toBe('technology')
      expect(generateSlug('WEB DEVELOPMENT')).toBe('web-development')
      expect(generateSlug('MixedCase')).toBe('mixedcase')
    })

    it('should replace spaces with dashes', () => {
      expect(generateSlug('Web Development')).toBe('web-development')
      expect(generateSlug('Tips and Tricks')).toBe('tips-and-tricks')
      expect(generateSlug('Multiple   Spaces')).toBe('multiple-spaces')
    })

    it('should trim leading and trailing whitespace', () => {
      expect(generateSlug('  Technology  ')).toBe('technology')
      expect(generateSlug('\tWeb Development\n')).toBe('web-development')
    })

    it('should remove leading and trailing dashes', () => {
      expect(generateSlug('-Technology-')).toBe('technology')
      expect(generateSlug('--Web Development--')).toBe('web-development')
    })
  })

  describe('generateSlug - Special Characters', () => {
    it('should remove special characters', () => {
      expect(generateSlug('Technology & Science')).toBe('technology-science')
      expect(generateSlug('Front-end Development')).toBe('front-end-development')
      expect(generateSlug('Tips/Tricks')).toBe('tipstricks')
      expect(generateSlug('Category @ 2024')).toBe('category-2024')
      expect(generateSlug('Test!@#$%Category')).toBe('testcategory')
    })

    it('should preserve numbers', () => {
      expect(generateSlug('2024 Trends')).toBe('2024-trends')
      expect(generateSlug('Top 10 Tips')).toBe('top-10-tips')
      expect(generateSlug('Web 3.0')).toBe('web-30')
    })

    it('should handle parentheses', () => {
      expect(generateSlug('Best Practices (2024)')).toBe('best-practices-2024')
      expect(generateSlug('(Old) Category')).toBe('old-category')
    })
  })

  describe('generateSlug - Multiple Dashes', () => {
    it('should replace multiple dashes with single dash', () => {
      expect(generateSlug('Web--Development')).toBe('web-development')
      expect(generateSlug('Test---Category')).toBe('test-category')
      expect(generateSlug('Multiple    Spaces')).toBe('multiple-spaces')
    })

    it('should handle combination of special chars and spaces', () => {
      expect(generateSlug('Web & Mobile  Development')).toBe('web-mobile-development')
      expect(generateSlug('Tips / Tricks   2024')).toBe('tips-tricks-2024')
    })
  })

  describe('generateSlug - Edge Cases', () => {
    it('should handle empty string', () => {
      expect(generateSlug('')).toBe('')
    })

    it('should handle only special characters', () => {
      expect(generateSlug('!@#$%')).toBe('')
      expect(generateSlug('---')).toBe('')
    })

    it('should handle only spaces', () => {
      expect(generateSlug('    ')).toBe('')
    })

    it('should handle unicode characters', () => {
      // Non-ASCII characters should be removed
      expect(generateSlug('Café')).toBe('caf')
      expect(generateSlug('Niño Category')).toBe('nio-category')
    })

    it('should handle very long names', () => {
      const longName = 'This is a very long category name that should be converted to a slug properly'
      const slug = generateSlug(longName)

      expect(slug).toBe('this-is-a-very-long-category-name-that-should-be-converted-to-a-slug-properly')
      expect(slug.startsWith('-')).toBe(false)
      expect(slug.endsWith('-')).toBe(false)
    })

    it('should handle already valid slugs', () => {
      expect(generateSlug('web-development')).toBe('web-development')
      expect(generateSlug('technology')).toBe('technology')
      expect(generateSlug('tips-123')).toBe('tips-123')
    })
  })

  describe('generateSlug - Real World Examples', () => {
    it('should generate correct slugs for common category names', () => {
      const examples = [
        { name: 'Technology', expected: 'technology' },
        { name: 'Web Development', expected: 'web-development' },
        { name: 'Tips & Tricks', expected: 'tips-tricks' },
        { name: 'News (2024)', expected: 'news-2024' },
        { name: 'Front-end Development', expected: 'front-end-development' },
        { name: 'AI / Machine Learning', expected: 'ai-machine-learning' },
        { name: 'Product Reviews', expected: 'product-reviews' },
        { name: 'How-to Guides', expected: 'how-to-guides' },
      ]

      examples.forEach(({ name, expected }) => {
        expect(generateSlug(name)).toBe(expected)
      })
    })
  })
})
