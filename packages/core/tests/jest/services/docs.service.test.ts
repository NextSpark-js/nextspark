/**
 * Unit Tests - DocsService
 *
 * Tests the DocsService static methods for documentation operations.
 *
 * Test Coverage:
 * - Registry Access: getRegistry(), getAll(), getPublic(), getSuperadmin()
 * - Section Operations: findSection(), sectionExists(), getSectionSlugs(), getSectionCount()
 * - Page Operations: findPage(), pageExists(), getPages(), getPageCount(), getAllPages()
 * - Path Resolution: buildPageUrl(), buildSectionUrl(), parsePath()
 * - Search: search()
 * - Navigation: getFirstPage(), getNavigation()
 * - Metadata: getMetadata()
 * - Backward Compatibility Exports
 */

import { describe, it, expect } from '@jest/globals'
import { DocsService } from '@/core/lib/services/docs.service'
import {
  getDocsRegistry,
  getAllDocs,
  getPublicDocs,
  getSuperadminDocs,
  findDocsSection,
  findDocsPage,
  searchDocs,
} from '@/core/lib/services/docs.service'

describe('DocsService', () => {
  describe('Registry Access', () => {
    describe('getRegistry()', () => {
      it('should return the full registry structure', () => {
        const registry = DocsService.getRegistry()
        expect(registry).toHaveProperty('public')
        expect(registry).toHaveProperty('superadmin')
        expect(registry).toHaveProperty('all')
      })

      it('should return arrays for each category', () => {
        const registry = DocsService.getRegistry()
        expect(Array.isArray(registry.public)).toBe(true)
        expect(Array.isArray(registry.superadmin)).toBe(true)
        expect(Array.isArray(registry.all)).toBe(true)
      })
    })

    describe('getAll()', () => {
      it('should return all sections', () => {
        const all = DocsService.getAll()
        expect(Array.isArray(all)).toBe(true)
        expect(all.length).toBeGreaterThan(0)
      })

      it('should include both public and superadmin sections', () => {
        const all = DocsService.getAll()
        const hasPublic = all.some((s) => s.source === 'public')
        const hasSuperadmin = all.some((s) => s.source === 'superadmin')
        expect(hasPublic).toBe(true)
        expect(hasSuperadmin).toBe(true)
      })
    })

    describe('getPublic()', () => {
      it('should return only public sections', () => {
        const publicSections = DocsService.getPublic()
        expect(Array.isArray(publicSections)).toBe(true)
        publicSections.forEach((section) => {
          expect(section.source).toBe('public')
        })
      })
    })

    describe('getSuperadmin()', () => {
      it('should return only superadmin sections', () => {
        const superadminSections = DocsService.getSuperadmin()
        expect(Array.isArray(superadminSections)).toBe(true)
        superadminSections.forEach((section) => {
          expect(section.source).toBe('superadmin')
        })
      })
    })
  })

  describe('Section Operations', () => {
    describe('findSection()', () => {
      it('should find existing section by slug', () => {
        const sections = DocsService.getAll()
        const firstSection = sections[0]
        if (firstSection) {
          const found = DocsService.findSection(firstSection.slug)
          expect(found).toBeDefined()
          expect(found?.slug).toBe(firstSection.slug)
        }
      })

      it('should return undefined for non-existent section', () => {
        const found = DocsService.findSection('non-existent-section-xyz')
        expect(found).toBeUndefined()
      })
    })

    describe('findSectionInCategory()', () => {
      it('should find section in correct category', () => {
        const publicSection = DocsService.getPublic()[0]
        if (publicSection) {
          const found = DocsService.findSectionInCategory(publicSection.slug, 'public')
          expect(found).toBeDefined()
          expect(found?.source).toBe('public')
        }
      })

      it('should return undefined when looking in wrong category', () => {
        const publicSection = DocsService.getPublic()[0]
        if (publicSection) {
          // Looking for public section in superadmin
          const found = DocsService.findSectionInCategory(publicSection.slug, 'superadmin')
          // Should be undefined unless same slug exists in both
          if (found) {
            expect(found.source).toBe('superadmin')
          } else {
            expect(found).toBeUndefined()
          }
        }
      })
    })

    describe('sectionExists()', () => {
      it('should return true for existing section', () => {
        const sections = DocsService.getAll()
        const firstSection = sections[0]
        if (firstSection) {
          expect(DocsService.sectionExists(firstSection.slug)).toBe(true)
        }
      })

      it('should return false for non-existent section', () => {
        expect(DocsService.sectionExists('non-existent-xyz')).toBe(false)
      })
    })

    describe('getSectionSlugs()', () => {
      it('should return array of slugs', () => {
        const slugs = DocsService.getSectionSlugs()
        expect(Array.isArray(slugs)).toBe(true)
        slugs.forEach((slug) => {
          expect(typeof slug).toBe('string')
        })
      })

      it('should match section count', () => {
        const slugs = DocsService.getSectionSlugs()
        expect(slugs.length).toBe(DocsService.getSectionCount())
      })
    })

    describe('getSectionCount()', () => {
      it('should return correct count', () => {
        const count = DocsService.getSectionCount()
        expect(typeof count).toBe('number')
        expect(count).toBeGreaterThan(0)
        expect(count).toBe(DocsService.getAll().length)
      })
    })
  })

  describe('Page Operations', () => {
    describe('findPage()', () => {
      it('should find existing page', () => {
        const section = DocsService.getAll()[0]
        const page = section?.pages[0]
        if (section && page) {
          const found = DocsService.findPage(section.slug, page.slug)
          expect(found).toBeDefined()
          expect(found?.slug).toBe(page.slug)
        }
      })

      it('should return undefined for non-existent page', () => {
        const section = DocsService.getAll()[0]
        if (section) {
          const found = DocsService.findPage(section.slug, 'non-existent-page')
          expect(found).toBeUndefined()
        }
      })

      it('should return undefined for non-existent section', () => {
        const found = DocsService.findPage('non-existent-section', 'any-page')
        expect(found).toBeUndefined()
      })
    })

    describe('pageExists()', () => {
      it('should return true for existing page', () => {
        const section = DocsService.getAll()[0]
        const page = section?.pages[0]
        if (section && page) {
          expect(DocsService.pageExists(section.slug, page.slug)).toBe(true)
        }
      })

      it('should return false for non-existent page', () => {
        const section = DocsService.getAll()[0]
        if (section) {
          expect(DocsService.pageExists(section.slug, 'non-existent')).toBe(false)
        }
      })
    })

    describe('getPages()', () => {
      it('should return pages for existing section', () => {
        const section = DocsService.getAll()[0]
        if (section) {
          const pages = DocsService.getPages(section.slug)
          expect(Array.isArray(pages)).toBe(true)
          expect(pages).toEqual(section.pages)
        }
      })

      it('should return empty array for non-existent section', () => {
        const pages = DocsService.getPages('non-existent-section')
        expect(pages).toEqual([])
      })
    })

    describe('getPageCount()', () => {
      it('should return total page count', () => {
        const count = DocsService.getPageCount()
        expect(typeof count).toBe('number')
        expect(count).toBeGreaterThan(0)
      })

      it('should match sum of all section pages', () => {
        const count = DocsService.getPageCount()
        const summed = DocsService.getAll().reduce(
          (sum, section) => sum + section.pages.length,
          0
        )
        expect(count).toBe(summed)
      })
    })

    describe('getAllPages()', () => {
      it('should return flat array of all pages', () => {
        const pages = DocsService.getAllPages()
        expect(Array.isArray(pages)).toBe(true)
        expect(pages.length).toBe(DocsService.getPageCount())
      })

      it('each page should have required properties', () => {
        const pages = DocsService.getAllPages()
        pages.forEach((page) => {
          expect(page).toHaveProperty('slug')
          expect(page).toHaveProperty('title')
          expect(page).toHaveProperty('path')
        })
      })
    })
  })

  describe('Path Resolution', () => {
    describe('buildPageUrl()', () => {
      it('should build public page URL', () => {
        const url = DocsService.buildPageUrl('public', 'getting-started', 'intro')
        expect(url).toBe('/docs/getting-started/intro')
      })

      it('should build superadmin page URL', () => {
        const url = DocsService.buildPageUrl('superadmin', 'setup', 'config')
        expect(url).toBe('/superadmin/docs/setup/config')
      })
    })

    describe('buildSectionUrl()', () => {
      it('should build public section URL', () => {
        const url = DocsService.buildSectionUrl('public', 'getting-started')
        expect(url).toBe('/docs/getting-started')
      })

      it('should build superadmin section URL', () => {
        const url = DocsService.buildSectionUrl('superadmin', 'setup')
        expect(url).toBe('/superadmin/docs/setup')
      })
    })

    describe('parsePath()', () => {
      it('should parse public docs path', () => {
        const result = DocsService.parsePath('/docs/getting-started/intro')
        expect(result).toEqual({
          category: 'public',
          sectionSlug: 'getting-started',
          pageSlug: 'intro',
        })
      })

      it('should parse public docs path without page', () => {
        const result = DocsService.parsePath('/docs/getting-started')
        expect(result).toEqual({
          category: 'public',
          sectionSlug: 'getting-started',
          pageSlug: null,
        })
      })

      it('should parse superadmin docs path', () => {
        const result = DocsService.parsePath('/superadmin/docs/setup/config')
        expect(result).toEqual({
          category: 'superadmin',
          sectionSlug: 'setup',
          pageSlug: 'config',
        })
      })

      it('should parse superadmin docs path without page', () => {
        const result = DocsService.parsePath('/superadmin/docs/setup')
        expect(result).toEqual({
          category: 'superadmin',
          sectionSlug: 'setup',
          pageSlug: null,
        })
      })

      it('should return null for non-docs path', () => {
        expect(DocsService.parsePath('/dashboard/settings')).toBeNull()
        expect(DocsService.parsePath('/superadmin/users')).toBeNull()
        expect(DocsService.parsePath('/')).toBeNull()
      })

      it('should handle /docs alone', () => {
        const result = DocsService.parsePath('/docs')
        expect(result).toEqual({
          category: 'public',
          sectionSlug: null,
          pageSlug: null,
        })
      })

      it('should handle /superadmin/docs alone', () => {
        const result = DocsService.parsePath('/superadmin/docs')
        expect(result).toEqual({
          category: 'superadmin',
          sectionSlug: null,
          pageSlug: null,
        })
      })

      it('should handle /superadmin/docs/section without page', () => {
        const result = DocsService.parsePath('/superadmin/docs/setup')
        expect(result).toEqual({
          category: 'superadmin',
          sectionSlug: 'setup',
          pageSlug: null,
        })
      })
    })
  })

  describe('Search', () => {
    describe('search()', () => {
      it('should return all sections for empty query', () => {
        const result = DocsService.search('')
        expect(result).toEqual(DocsService.getAll())
      })

      it('should return all sections for whitespace query', () => {
        const result = DocsService.search('   ')
        expect(result).toEqual(DocsService.getAll())
      })

      it('should filter by section title', () => {
        // Using mock data: 'Getting Started' should match
        const result = DocsService.search('Getting')
        expect(result.length).toBeGreaterThanOrEqual(1)
        result.forEach((section) => {
          const matches =
            section.title.toLowerCase().includes('getting') ||
            section.pages.some((p) => p.title.toLowerCase().includes('getting'))
          expect(matches).toBe(true)
        })
      })

      it('should filter by page title', () => {
        // Using mock data: 'Introduction' should match
        const result = DocsService.search('Introduction')
        expect(result.length).toBeGreaterThanOrEqual(1)
      })

      it('should be case-insensitive', () => {
        const lower = DocsService.search('getting')
        const upper = DocsService.search('GETTING')
        expect(lower).toEqual(upper)
      })

      it('should filter by category with empty query', () => {
        const publicResult = DocsService.search('', 'public')
        const superadminResult = DocsService.search('', 'superadmin')

        publicResult.forEach((s) => expect(s.source).toBe('public'))
        superadminResult.forEach((s) => expect(s.source).toBe('superadmin'))
      })

      it('should filter by category with non-empty query', () => {
        // Search with both query and category to cover line 244
        const publicResult = DocsService.search('Getting', 'public')
        const superadminResult = DocsService.search('Setup', 'superadmin')

        // All results should be from the specified category
        publicResult.forEach((s) => expect(s.source).toBe('public'))
        superadminResult.forEach((s) => expect(s.source).toBe('superadmin'))
      })

      it('should search within specific category only', () => {
        // Search for a term that exists in superadmin but search in public
        const result = DocsService.search('Configuration', 'public')
        // Should not find superadmin-only content when searching public
        result.forEach((s) => expect(s.source).toBe('public'))
      })

      it('should return empty array for no matches', () => {
        const result = DocsService.search('xyznonexistent123')
        expect(result).toEqual([])
      })
    })
  })

  describe('Navigation', () => {
    describe('getFirstPage()', () => {
      it('should return first page for public category', () => {
        const page = DocsService.getFirstPage('public')
        expect(page).toBeDefined()
        expect(page?.source).toBe('public')
      })

      it('should return first page for superadmin category', () => {
        const page = DocsService.getFirstPage('superadmin')
        expect(page).toBeDefined()
        expect(page?.source).toBe('superadmin')
      })
    })

    describe('getNavigation()', () => {
      it('should return prev and next for middle page', () => {
        const sections = DocsService.getPublic()
        // Find a section with multiple pages
        const sectionWithPages = sections.find((s) => s.pages.length >= 2)
        if (sectionWithPages && sectionWithPages.pages.length >= 2) {
          const nav = DocsService.getNavigation(
            'public',
            sectionWithPages.slug,
            sectionWithPages.pages[1].slug
          )
          // Should have prev (first page)
          expect(nav.prev).not.toBeNull()
        }
      })

      it('should return null prev for first page', () => {
        const sections = DocsService.getPublic()
        const firstSection = sections[0]
        const firstPage = firstSection?.pages[0]
        if (firstSection && firstPage) {
          const nav = DocsService.getNavigation('public', firstSection.slug, firstPage.slug)
          expect(nav.prev).toBeNull()
        }
      })

      it('should return null next for last page', () => {
        const sections = DocsService.getPublic()
        const lastSection = sections[sections.length - 1]
        const lastPage = lastSection?.pages[lastSection.pages.length - 1]
        if (lastSection && lastPage) {
          const nav = DocsService.getNavigation('public', lastSection.slug, lastPage.slug)
          expect(nav.next).toBeNull()
        }
      })

      it('should return nulls for non-existent page', () => {
        const nav = DocsService.getNavigation('public', 'non-existent', 'page')
        expect(nav.prev).toBeNull()
        expect(nav.next).toBeNull()
      })
    })
  })

  describe('Metadata', () => {
    describe('getMetadata()', () => {
      it('should return metadata object', () => {
        const metadata = DocsService.getMetadata()
        expect(metadata).toHaveProperty('publicSections')
        expect(metadata).toHaveProperty('superadminSections')
        expect(metadata).toHaveProperty('totalSections')
        expect(metadata).toHaveProperty('publicPages')
        expect(metadata).toHaveProperty('superadminPages')
        expect(metadata).toHaveProperty('totalPages')
        expect(metadata).toHaveProperty('sectionSlugs')
      })

      it('should have correct totals', () => {
        const metadata = DocsService.getMetadata()
        expect(metadata.totalSections).toBe(
          metadata.publicSections + metadata.superadminSections
        )
        expect(metadata.totalPages).toBe(
          metadata.publicPages + metadata.superadminPages
        )
      })

      it('should have correct section slugs', () => {
        const metadata = DocsService.getMetadata()
        expect(metadata.sectionSlugs.length).toBe(metadata.totalSections)
      })
    })
  })

  describe('Backward Compatibility Exports', () => {
    it('getDocsRegistry should match DocsService.getRegistry()', () => {
      expect(getDocsRegistry()).toEqual(DocsService.getRegistry())
    })

    it('getAllDocs should match DocsService.getAll()', () => {
      expect(getAllDocs()).toEqual(DocsService.getAll())
    })

    it('getPublicDocs should match DocsService.getPublic()', () => {
      expect(getPublicDocs()).toEqual(DocsService.getPublic())
    })

    it('getSuperadminDocs should match DocsService.getSuperadmin()', () => {
      expect(getSuperadminDocs()).toEqual(DocsService.getSuperadmin())
    })

    it('findDocsSection should match DocsService.findSection()', () => {
      const slug = DocsService.getSectionSlugs()[0]
      if (slug) {
        expect(findDocsSection(slug)).toEqual(DocsService.findSection(slug))
      }
    })

    it('findDocsPage should match DocsService.findPage()', () => {
      const section = DocsService.getAll()[0]
      const page = section?.pages[0]
      if (section && page) {
        expect(findDocsPage(section.slug, page.slug)).toEqual(
          DocsService.findPage(section.slug, page.slug)
        )
      }
    })

    it('searchDocs should match DocsService.search()', () => {
      expect(searchDocs('')).toEqual(DocsService.search(''))
      expect(searchDocs('test')).toEqual(DocsService.search('test'))
      expect(searchDocs('', 'public')).toEqual(DocsService.search('', 'public'))
    })
  })
})
