/**
 * Unit Tests - Block Service
 *
 * Tests the BlockService static methods that provide runtime
 * block lookup and query operations.
 *
 * Test Coverage:
 * - getAll() returns all 16 blocks
 * - get(slug) returns specific block or undefined
 * - getByCategory(category) filters blocks by category
 * - has(slug) checks block existence
 *
 * @see {@link core/lib/services/block.service.ts}
 */

import { BlockService } from '@/core/lib/services/block.service'
import type { BlockCategory } from '@/core/types/blocks'

describe('BlockService', () => {
  describe('getAll', () => {
    it('should return all blocks', () => {
      const blocks = BlockService.getAll()

      expect(Array.isArray(blocks)).toBe(true)
      expect(blocks.length).toBe(16) // Current count from BLOCK_METADATA
    })

    it('should return blocks with required properties', () => {
      const blocks = BlockService.getAll()

      blocks.forEach(block => {
        expect(block).toHaveProperty('slug')
        expect(block).toHaveProperty('name')
        expect(block).toHaveProperty('category')
        expect(block).toHaveProperty('description')
        expect(block).toHaveProperty('icon')
        expect(block).toHaveProperty('componentPath')
        expect(block).toHaveProperty('schemaPath')
        expect(block).toHaveProperty('fieldsPath')
        expect(block).toHaveProperty('fieldDefinitions')
        expect(block).toHaveProperty('scope')
        expect(block).toHaveProperty('isCore')
        expect(block).toHaveProperty('source')
        expect(block).toHaveProperty('sourceId')
      })
    })

    it('should return blocks with valid slugs', () => {
      const blocks = BlockService.getAll()

      blocks.forEach(block => {
        expect(typeof block.slug).toBe('string')
        expect(block.slug.length).toBeGreaterThan(0)
      })
    })

    it('should include known blocks', () => {
      const blocks = BlockService.getAll()
      const slugs = blocks.map(b => b.slug)

      // Verify some known blocks are present
      expect(slugs).toContain('hero')
      expect(slugs).toContain('testimonials')
      expect(slugs).toContain('features-grid')
      expect(slugs).toContain('cta-section')
    })
  })

  describe('get', () => {
    it('should return block by slug', () => {
      const block = BlockService.get('hero')

      expect(block).toBeDefined()
      expect(block?.slug).toBe('hero')
      expect(block?.name).toBe('Hero Section')
      expect(block?.category).toBe('hero')
    })

    it('should return block with all required properties', () => {
      const block = BlockService.get('testimonials')

      expect(block).toBeDefined()
      expect(block?.slug).toBe('testimonials')
      expect(block?.name).toBeDefined()
      expect(block?.description).toBeDefined()
      expect(block?.category).toBeDefined()
      expect(block?.componentPath).toBeDefined()
      expect(block?.schemaPath).toBeDefined()
      expect(block?.fieldsPath).toBeDefined()
      expect(block?.fieldDefinitions).toBeDefined()
    })

    it('should return undefined for invalid slug', () => {
      const block = BlockService.get('invalid-block-slug')

      expect(block).toBeUndefined()
    })

    it('should return undefined for empty string', () => {
      const block = BlockService.get('')

      expect(block).toBeUndefined()
    })

    it('should return undefined for non-existent block', () => {
      const block = BlockService.get('nonexistent-block-12345')

      expect(block).toBeUndefined()
    })

    it('should handle case-sensitive slugs correctly', () => {
      // Slugs should be case-sensitive
      const block = BlockService.get('Hero') // Wrong case

      expect(block).toBeUndefined()
    })

    it('should return different blocks for different slugs', () => {
      const hero = BlockService.get('hero')
      const testimonials = BlockService.get('testimonials')

      expect(hero).toBeDefined()
      expect(testimonials).toBeDefined()
      expect(hero?.slug).not.toBe(testimonials?.slug)
      expect(hero?.name).not.toBe(testimonials?.name)
    })
  })

  describe('getByCategory', () => {
    it('should return blocks filtered by category', () => {
      const heroBlocks = BlockService.getByCategory('hero')

      expect(Array.isArray(heroBlocks)).toBe(true)
      expect(heroBlocks.length).toBe(4) // hero, hero-with-form, jumbotron, video-hero
      expect(heroBlocks.every(b => b.category === 'hero')).toBe(true)
    })

    it('should return all hero category blocks', () => {
      const heroBlocks = BlockService.getByCategory('hero')
      const slugs = heroBlocks.map(b => b.slug)

      expect(slugs).toContain('hero')
      expect(slugs).toContain('hero-with-form')
      expect(slugs).toContain('jumbotron')
      expect(slugs).toContain('video-hero')
    })

    it('should return content blocks', () => {
      const contentBlocks = BlockService.getByCategory('content')

      expect(Array.isArray(contentBlocks)).toBe(true)
      expect(contentBlocks.length).toBe(6) // features-grid, logo-cloud, post-content, split-content, text-content, timeline
      expect(contentBlocks.every(b => b.category === 'content')).toBe(true)
    })

    it('should return all content category blocks', () => {
      const contentBlocks = BlockService.getByCategory('content')
      const slugs = contentBlocks.map(b => b.slug)

      expect(slugs).toContain('features-grid')
      expect(slugs).toContain('logo-cloud')
      expect(slugs).toContain('post-content')
      expect(slugs).toContain('split-content')
      expect(slugs).toContain('text-content')
      expect(slugs).toContain('timeline')
    })

    it('should return features blocks', () => {
      const featureBlocks = BlockService.getByCategory('features')

      expect(Array.isArray(featureBlocks)).toBe(true)
      expect(featureBlocks.length).toBeGreaterThan(0)
      expect(featureBlocks.every(b => b.category === 'features')).toBe(true)
    })

    it('should return testimonials blocks', () => {
      const testimonialBlocks = BlockService.getByCategory('testimonials')

      expect(Array.isArray(testimonialBlocks)).toBe(true)
      expect(testimonialBlocks.length).toBeGreaterThan(0)
      expect(testimonialBlocks.every(b => b.category === 'testimonials')).toBe(true)
    })

    it('should return cta blocks', () => {
      const ctaBlocks = BlockService.getByCategory('cta')

      expect(Array.isArray(ctaBlocks)).toBe(true)
      expect(ctaBlocks.length).toBeGreaterThan(0)
      expect(ctaBlocks.every(b => b.category === 'cta')).toBe(true)
    })

    it('should return pricing blocks', () => {
      const pricingBlocks = BlockService.getByCategory('pricing')

      expect(Array.isArray(pricingBlocks)).toBe(true)
      expect(pricingBlocks.length).toBeGreaterThan(0)
      expect(pricingBlocks.every(b => b.category === 'pricing')).toBe(true)
    })

    it('should return faq blocks', () => {
      const faqBlocks = BlockService.getByCategory('faq')

      expect(Array.isArray(faqBlocks)).toBe(true)
      expect(faqBlocks.length).toBeGreaterThan(0)
      expect(faqBlocks.every(b => b.category === 'faq')).toBe(true)
    })

    it('should return stats blocks', () => {
      const statsBlocks = BlockService.getByCategory('stats')

      expect(Array.isArray(statsBlocks)).toBe(true)
      expect(statsBlocks.length).toBeGreaterThan(0)
      expect(statsBlocks.every(b => b.category === 'stats')).toBe(true)
    })

    it('should return empty array for invalid category', () => {
      const blocks = BlockService.getByCategory('invalid' as BlockCategory)

      expect(Array.isArray(blocks)).toBe(true)
      expect(blocks).toEqual([])
      expect(blocks.length).toBe(0)
    })

    it('should return empty array for non-existent category', () => {
      const blocks = BlockService.getByCategory('nonexistent-category' as BlockCategory)

      expect(Array.isArray(blocks)).toBe(true)
      expect(blocks.length).toBe(0)
    })

    it('should not mutate the original registry', () => {
      const blocks1 = BlockService.getByCategory('hero')
      const blocks2 = BlockService.getByCategory('hero')

      // Mutate the returned array
      blocks1.push({} as any)

      // Should not affect subsequent calls
      expect(blocks2.length).toBe(4)
      expect(blocks1.length).not.toBe(blocks2.length)
    })
  })

  describe('has', () => {
    it('should return true for existing block', () => {
      expect(BlockService.has('hero')).toBe(true)
      expect(BlockService.has('testimonials')).toBe(true)
      expect(BlockService.has('features-grid')).toBe(true)
      expect(BlockService.has('cta-section')).toBe(true)
    })

    it('should return true for all blocks in registry', () => {
      const blocks = BlockService.getAll()

      blocks.forEach(block => {
        expect(BlockService.has(block.slug)).toBe(true)
      })
    })

    it('should return false for non-existing block', () => {
      expect(BlockService.has('invalid-block')).toBe(false)
      expect(BlockService.has('nonexistent-block-12345')).toBe(false)
      expect(BlockService.has('fake-block-slug')).toBe(false)
    })

    it('should return false for empty string', () => {
      expect(BlockService.has('')).toBe(false)
    })

    it('should handle case-sensitive slugs correctly', () => {
      // Slugs should be case-sensitive
      expect(BlockService.has('Hero')).toBe(false) // Wrong case
      expect(BlockService.has('hero')).toBe(true) // Correct case
    })

    it('should return false for whitespace', () => {
      expect(BlockService.has(' ')).toBe(false)
      expect(BlockService.has('  ')).toBe(false)
      expect(BlockService.has('\t')).toBe(false)
      expect(BlockService.has('\n')).toBe(false)
    })

    it('should return false for special characters', () => {
      expect(BlockService.has('@#$%')).toBe(false)
      expect(BlockService.has('block/slash')).toBe(false)
      expect(BlockService.has('block.dot')).toBe(false)
    })
  })

  describe('Integration - Cross-method consistency', () => {
    it('should have consistent data between get() and getAll()', () => {
      const allBlocks = BlockService.getAll()

      allBlocks.forEach(block => {
        const fetched = BlockService.get(block.slug)
        expect(fetched).toEqual(block)
      })
    })

    it('should have consistent data between has() and get()', () => {
      const testSlugs = ['hero', 'testimonials', 'invalid-block', '', 'nonexistent']

      testSlugs.forEach(slug => {
        const exists = BlockService.has(slug)
        const block = BlockService.get(slug)

        if (exists) {
          expect(block).toBeDefined()
        } else {
          expect(block).toBeUndefined()
        }
      })
    })

    it('should have all category blocks present in getAll()', () => {
      const categories: BlockCategory[] = ['hero', 'content', 'features', 'cta', 'faq', 'pricing', 'stats', 'testimonials']
      const allBlocks = BlockService.getAll()

      categories.forEach(category => {
        const categoryBlocks = BlockService.getByCategory(category)

        categoryBlocks.forEach(block => {
          expect(allBlocks).toContainEqual(block)
        })
      })
    })

    it('should have sum of category blocks equal to total blocks', () => {
      const categories: BlockCategory[] = ['hero', 'content', 'features', 'cta', 'faq', 'pricing', 'stats', 'testimonials']

      let totalCategoryBlocks = 0
      categories.forEach(category => {
        const blocks = BlockService.getByCategory(category)
        totalCategoryBlocks += blocks.length
      })

      const allBlocks = BlockService.getAll()
      expect(totalCategoryBlocks).toBe(allBlocks.length)
    })
  })
})
