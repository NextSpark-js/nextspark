/**
 * Unit Tests - Block Scope Filtering
 *
 * Tests block scope filtering logic used in /api/v1/blocks:
 * - Filter blocks by scope (pages, posts, etc.)
 * - Handle missing scope property
 * - Handle empty scope arrays
 * - Multiple scope values
 *
 * Focus on business logic WITHOUT API calls.
 */

import type { BlockConfig } from '@/core/types/blocks'

// Mock block configurations for testing
const mockBlocks: Partial<BlockConfig>[] = [
  {
    slug: 'hero',
    name: 'Hero Section',
    scope: ['pages', 'posts']
  },
  {
    slug: 'cta-section',
    name: 'CTA Section',
    scope: ['pages']
  },
  {
    slug: 'features-grid',
    name: 'Features Grid',
    scope: ['pages']
  },
  {
    slug: 'testimonials',
    name: 'Testimonials',
    scope: ['pages']
  },
  {
    slug: 'text-content',
    name: 'Text Content',
    scope: ['pages']
  },
  {
    slug: 'benefits',
    name: 'Benefits',
    scope: ['pages']
  },
  {
    slug: 'no-scope-block',
    name: 'Block Without Scope',
    // scope is undefined
  },
  {
    slug: 'empty-scope-block',
    name: 'Block With Empty Scope',
    scope: []
  },
  {
    slug: 'email-template',
    name: 'Email Template',
    scope: ['emails']
  }
]

/**
 * Filter blocks by scope
 * Mimics the logic from app/api/v1/blocks/route.ts
 */
function filterBlocksByScope(blocks: Partial<BlockConfig>[], scope?: string): Partial<BlockConfig>[] {
  if (!scope) {
    return blocks
  }

  return blocks.filter(block => block.scope?.includes(scope))
}

describe('Block Scope Filtering', () => {
  describe('filterBlocksByScope - Basic Filtering', () => {
    it('should return blocks with scope "pages"', () => {
      const result = filterBlocksByScope(mockBlocks, 'pages')

      expect(result).toHaveLength(6)
      expect(result.map(b => b.slug)).toEqual([
        'hero',
        'cta-section',
        'features-grid',
        'testimonials',
        'text-content',
        'benefits'
      ])
    })

    it('should return blocks with scope "posts"', () => {
      const result = filterBlocksByScope(mockBlocks, 'posts')

      expect(result).toHaveLength(1)
      expect(result[0].slug).toBe('hero')
    })

    it('should return blocks with scope "emails"', () => {
      const result = filterBlocksByScope(mockBlocks, 'emails')

      expect(result).toHaveLength(1)
      expect(result[0].slug).toBe('email-template')
    })

    it('should return empty array for non-existent scope', () => {
      const result = filterBlocksByScope(mockBlocks, 'products')

      expect(result).toHaveLength(0)
    })
  })

  describe('filterBlocksByScope - No Scope Filter', () => {
    it('should return all blocks when scope is undefined', () => {
      const result = filterBlocksByScope(mockBlocks, undefined)

      expect(result).toHaveLength(mockBlocks.length)
      expect(result).toEqual(mockBlocks)
    })

    it('should return all blocks when scope is empty string', () => {
      const result = filterBlocksByScope(mockBlocks, '')

      expect(result).toHaveLength(mockBlocks.length)
    })
  })

  describe('filterBlocksByScope - Edge Cases', () => {
    it('should exclude blocks with undefined scope', () => {
      const result = filterBlocksByScope(mockBlocks, 'pages')

      const slugs = result.map(b => b.slug)
      expect(slugs).not.toContain('no-scope-block')
    })

    it('should exclude blocks with empty scope array', () => {
      const result = filterBlocksByScope(mockBlocks, 'pages')

      const slugs = result.map(b => b.slug)
      expect(slugs).not.toContain('empty-scope-block')
    })

    it('should handle empty blocks array', () => {
      const result = filterBlocksByScope([], 'pages')

      expect(result).toHaveLength(0)
    })

    it('should be case-sensitive for scope matching', () => {
      const result = filterBlocksByScope(mockBlocks, 'Pages')

      expect(result).toHaveLength(0)
    })
  })

  describe('filterBlocksByScope - Multiple Scopes', () => {
    it('should match blocks with multiple scopes', () => {
      const blocksWithMultipleScopes: Partial<BlockConfig>[] = [
        { slug: 'multi-1', name: 'Multi 1', scope: ['pages', 'posts', 'emails'] },
        { slug: 'multi-2', name: 'Multi 2', scope: ['pages', 'products'] },
        { slug: 'single', name: 'Single', scope: ['pages'] },
      ]

      const pagesResult = filterBlocksByScope(blocksWithMultipleScopes, 'pages')
      expect(pagesResult).toHaveLength(3)

      const postsResult = filterBlocksByScope(blocksWithMultipleScopes, 'posts')
      expect(postsResult).toHaveLength(1)
      expect(postsResult[0].slug).toBe('multi-1')

      const emailsResult = filterBlocksByScope(blocksWithMultipleScopes, 'emails')
      expect(emailsResult).toHaveLength(1)
      expect(emailsResult[0].slug).toBe('multi-1')

      const productsResult = filterBlocksByScope(blocksWithMultipleScopes, 'products')
      expect(productsResult).toHaveLength(1)
      expect(productsResult[0].slug).toBe('multi-2')
    })
  })

  describe('Block Scope Strategy - Opt-in by Default', () => {
    it('blocks without scope property should NOT appear in any scope', () => {
      const blockWithoutScope: Partial<BlockConfig> = {
        slug: 'test-block',
        name: 'Test Block'
        // scope is undefined
      }

      const pagesResult = filterBlocksByScope([blockWithoutScope], 'pages')
      const postsResult = filterBlocksByScope([blockWithoutScope], 'posts')
      const emailsResult = filterBlocksByScope([blockWithoutScope], 'emails')

      expect(pagesResult).toHaveLength(0)
      expect(postsResult).toHaveLength(0)
      expect(emailsResult).toHaveLength(0)
    })

    it('blocks with empty scope array should NOT appear in any scope', () => {
      const blockWithEmptyScope: Partial<BlockConfig> = {
        slug: 'test-block',
        name: 'Test Block',
        scope: []
      }

      const pagesResult = filterBlocksByScope([blockWithEmptyScope], 'pages')
      const postsResult = filterBlocksByScope([blockWithEmptyScope], 'posts')

      expect(pagesResult).toHaveLength(0)
      expect(postsResult).toHaveLength(0)
    })

    it('blocks must explicitly opt-in to be available in a scope', () => {
      const explicitOptIn: Partial<BlockConfig> = {
        slug: 'opt-in-block',
        name: 'Opt In Block',
        scope: ['pages']
      }

      const pagesResult = filterBlocksByScope([explicitOptIn], 'pages')
      const postsResult = filterBlocksByScope([explicitOptIn], 'posts')

      expect(pagesResult).toHaveLength(1) // Explicitly opted in
      expect(postsResult).toHaveLength(0) // Not opted in
    })
  })

  describe('Real World Scenarios', () => {
    it('should filter blocks for post editor (only hero available)', () => {
      const postsBlocks = filterBlocksByScope(mockBlocks, 'posts')

      expect(postsBlocks).toHaveLength(1)
      expect(postsBlocks[0].slug).toBe('hero')
      expect(postsBlocks[0].name).toBe('Hero Section')
    })

    it('should filter blocks for page editor (multiple blocks available)', () => {
      const pagesBlocks = filterBlocksByScope(mockBlocks, 'pages')

      expect(pagesBlocks.length).toBeGreaterThan(1)
      expect(pagesBlocks.map(b => b.slug)).toContain('hero')
      expect(pagesBlocks.map(b => b.slug)).toContain('cta-section')
      expect(pagesBlocks.map(b => b.slug)).toContain('features-grid')
    })

    it('should return different blocks for different scopes', () => {
      const pagesBlocks = filterBlocksByScope(mockBlocks, 'pages')
      const postsBlocks = filterBlocksByScope(mockBlocks, 'posts')

      expect(pagesBlocks.length).not.toBe(postsBlocks.length)

      // Hero should be in both
      expect(pagesBlocks.map(b => b.slug)).toContain('hero')
      expect(postsBlocks.map(b => b.slug)).toContain('hero')

      // CTA should only be in pages
      expect(pagesBlocks.map(b => b.slug)).toContain('cta-section')
      expect(postsBlocks.map(b => b.slug)).not.toContain('cta-section')
    })

    it('should handle new scope values for future extensions', () => {
      const futureBlocks: Partial<BlockConfig>[] = [
        { slug: 'product-card', name: 'Product Card', scope: ['products'] },
        { slug: 'pricing-table', name: 'Pricing Table', scope: ['products', 'pages'] },
      ]

      const productsResult = filterBlocksByScope(futureBlocks, 'products')
      expect(productsResult).toHaveLength(2)

      const pagesResult = filterBlocksByScope(futureBlocks, 'pages')
      expect(pagesResult).toHaveLength(1)
      expect(pagesResult[0].slug).toBe('pricing-table')
    })
  })

  describe('Performance Considerations', () => {
    it('should efficiently filter large block arrays', () => {
      // Create a large array of blocks
      const largeBlockArray: Partial<BlockConfig>[] = Array.from({ length: 1000 }, (_, i) => ({
        slug: `block-${i}`,
        name: `Block ${i}`,
        scope: i % 2 === 0 ? ['pages'] : ['posts']
      }))

      const startTime = performance.now()
      const result = filterBlocksByScope(largeBlockArray, 'pages')
      const endTime = performance.now()

      expect(result).toHaveLength(500)
      expect(endTime - startTime).toBeLessThan(100) // Should complete in < 100ms
    })

    it('should not mutate original blocks array', () => {
      const originalBlocks = [...mockBlocks]
      const result = filterBlocksByScope(mockBlocks, 'pages')

      expect(mockBlocks).toEqual(originalBlocks)
      expect(result).not.toBe(mockBlocks)
    })
  })
})
