/**
 * Unit Tests - Documentation Utility Functions (Extended)
 *
 * Additional tests for edge cases and comprehensive coverage
 * of the docs utility functions.
 *
 * Test Coverage:
 * - extractOrderFromFilename() - edge cases
 * - cleanFilename() - edge cases
 * - slugToTitle() - edge cases
 * - filterSections() - sidebar search filtering logic
 */

import { describe, it, expect } from '@jest/globals'
import {
  extractOrderFromFilename,
  cleanFilename,
  slugToTitle,
} from '@/core/lib/docs/utils'
import type { DocSectionMeta, DocPageMeta } from '@/core/types/docs'

describe('Documentation Utilities - Extended Coverage', () => {
  describe('extractOrderFromFilename - Edge Cases', () => {
    it('should handle leading zeros correctly', () => {
      expect(extractOrderFromFilename('001-file.md')).toBe(1)
      expect(extractOrderFromFilename('007-file.md')).toBe(7)
      expect(extractOrderFromFilename('099-file.md')).toBe(99)
    })

    it('should handle large order numbers', () => {
      expect(extractOrderFromFilename('999-file.md')).toBe(999)
      expect(extractOrderFromFilename('1000-file.md')).toBe(1000)
      expect(extractOrderFromFilename('9999-file.md')).toBe(9999)
    })

    it('should return 999 for files starting with non-digit', () => {
      expect(extractOrderFromFilename('a01-file.md')).toBe(999)
      expect(extractOrderFromFilename('-01-file.md')).toBe(999)
      expect(extractOrderFromFilename('_01-file.md')).toBe(999)
    })

    it('should handle empty string', () => {
      expect(extractOrderFromFilename('')).toBe(999)
    })

    it('should handle just a number with dash', () => {
      expect(extractOrderFromFilename('01-')).toBe(1)
      expect(extractOrderFromFilename('05-')).toBe(5)
    })

    it('should handle number in middle of filename', () => {
      expect(extractOrderFromFilename('file-01-test.md')).toBe(999)
    })

    it('should handle special characters after number', () => {
      expect(extractOrderFromFilename('01_file.md')).toBe(999) // underscore not dash
      expect(extractOrderFromFilename('01.file.md')).toBe(999) // dot not dash
      expect(extractOrderFromFilename('01 file.md')).toBe(999) // space not dash
    })
  })

  describe('cleanFilename - Edge Cases', () => {
    it('should handle multiple dashes', () => {
      expect(cleanFilename('01-my-long-filename.md')).toBe('my-long-filename')
    })

    it('should handle uppercase extensions', () => {
      // Current implementation only removes lowercase .md
      expect(cleanFilename('01-file.MD')).toBe('file.MD')
    })

    it('should handle no dash after number', () => {
      // Without dash, regex doesn't match
      expect(cleanFilename('01file.md')).toBe('01file')
    })

    it('should handle empty string', () => {
      expect(cleanFilename('')).toBe('')
    })

    it('should handle only number prefix', () => {
      expect(cleanFilename('01-.md')).toBe('')
    })

    it('should handle nested extensions', () => {
      expect(cleanFilename('01-file.config.md')).toBe('file.config')
    })

    it('should not remove .mdx extension', () => {
      expect(cleanFilename('01-file.mdx')).toBe('file.mdx')
    })

    it('should handle unicode characters', () => {
      expect(cleanFilename('01-configuración.md')).toBe('configuración')
      expect(cleanFilename('01-日本語.md')).toBe('日本語')
    })
  })

  describe('slugToTitle - Edge Cases', () => {
    it('should handle single character words', () => {
      expect(slugToTitle('a-b-c')).toBe('A B C')
    })

    it('should handle empty string', () => {
      expect(slugToTitle('')).toBe('')
    })

    it('should handle single word', () => {
      expect(slugToTitle('overview')).toBe('Overview')
    })

    it('should handle already capitalized words', () => {
      expect(slugToTitle('API-reference')).toBe('API Reference')
    })

    it('should handle numbers in slug', () => {
      expect(slugToTitle('version-2-guide')).toBe('Version 2 Guide')
      expect(slugToTitle('step-1-install')).toBe('Step 1 Install')
    })

    it('should handle consecutive dashes', () => {
      // Edge case: double dash might be typo
      expect(slugToTitle('getting--started')).toBe('Getting  Started')
    })

    it('should handle leading/trailing dashes', () => {
      expect(slugToTitle('-getting-started')).toBe(' Getting Started')
      expect(slugToTitle('getting-started-')).toBe('Getting Started ')
    })

    it('should handle special terms', () => {
      // Note: current implementation doesn't handle acronyms specially
      expect(slugToTitle('faq')).toBe('Faq')
      expect(slugToTitle('api')).toBe('Api')
      expect(slugToTitle('ui-ux-design')).toBe('Ui Ux Design')
    })
  })

  describe('filterSections - Search Logic', () => {
    // Helper to simulate the filterSections logic from docs-sidebar.tsx
    const filterSections = (
      sections: DocSectionMeta[],
      searchQuery: string
    ): DocSectionMeta[] => {
      if (!searchQuery.trim()) return sections

      const query = searchQuery.toLowerCase().trim()

      return sections
        .map((section) => {
          const sectionMatches = section.title.toLowerCase().includes(query)
          const matchingPages = section.pages.filter((page) =>
            page.title.toLowerCase().includes(query)
          )

          if (sectionMatches || matchingPages.length > 0) {
            return {
              ...section,
              pages: sectionMatches ? section.pages : matchingPages,
            }
          }

          return null
        })
        .filter((section): section is DocSectionMeta => section !== null)
    }

    const mockSections: DocSectionMeta[] = [
      {
        title: 'Getting Started',
        slug: 'getting-started',
        order: 1,
        source: 'public',
        pages: [
          {
            slug: 'introduction',
            title: 'Introduction',
            order: 1,
            path: '/docs/01-getting-started/01-introduction.md',
            source: 'public',
          },
          {
            slug: 'installation',
            title: 'Installation Guide',
            order: 2,
            path: '/docs/01-getting-started/02-installation.md',
            source: 'public',
          },
        ],
      },
      {
        title: 'API Reference',
        slug: 'api-reference',
        order: 2,
        source: 'public',
        pages: [
          {
            slug: 'endpoints',
            title: 'API Endpoints',
            order: 1,
            path: '/docs/02-api/01-endpoints.md',
            source: 'public',
          },
          {
            slug: 'authentication',
            title: 'Authentication',
            order: 2,
            path: '/docs/02-api/02-auth.md',
            source: 'public',
          },
        ],
      },
      {
        title: 'Advanced Topics',
        slug: 'advanced',
        order: 3,
        source: 'public',
        pages: [
          {
            slug: 'customization',
            title: 'Customization',
            order: 1,
            path: '/docs/03-advanced/01-customization.md',
            source: 'public',
          },
        ],
      },
    ]

    it('should return all sections when query is empty', () => {
      const result = filterSections(mockSections, '')
      expect(result).toEqual(mockSections)
    })

    it('should return all sections when query is whitespace', () => {
      const result = filterSections(mockSections, '   ')
      expect(result).toEqual(mockSections)
    })

    it('should filter by section title', () => {
      const result = filterSections(mockSections, 'API')
      expect(result).toHaveLength(1)
      expect(result[0].slug).toBe('api-reference')
      // When section matches, all pages should be included
      expect(result[0].pages).toHaveLength(2)
    })

    it('should filter by page title', () => {
      const result = filterSections(mockSections, 'Installation')
      expect(result).toHaveLength(1)
      expect(result[0].slug).toBe('getting-started')
      // Only matching pages should be included
      expect(result[0].pages).toHaveLength(1)
      expect(result[0].pages[0].slug).toBe('installation')
    })

    it('should be case-insensitive', () => {
      const lowerResult = filterSections(mockSections, 'api')
      const upperResult = filterSections(mockSections, 'API')
      const mixedResult = filterSections(mockSections, 'ApI')

      expect(lowerResult).toEqual(upperResult)
      expect(lowerResult).toEqual(mixedResult)
    })

    it('should match partial text', () => {
      const result = filterSections(mockSections, 'intro')
      expect(result).toHaveLength(1)
      expect(result[0].pages[0].slug).toBe('introduction')
    })

    it('should return empty array when no matches', () => {
      const result = filterSections(mockSections, 'xyz123nonexistent')
      expect(result).toHaveLength(0)
    })

    it('should match multiple sections/pages', () => {
      const result = filterSections(mockSections, 'tion') // matches Introduction, Installation, Authentication, Customization
      expect(result.length).toBeGreaterThan(1)
    })

    it('should trim search query', () => {
      const result1 = filterSections(mockSections, '  API  ')
      const result2 = filterSections(mockSections, 'API')
      expect(result1).toEqual(result2)
    })

    it('should include all pages when section title matches', () => {
      const result = filterSections(mockSections, 'Getting Started')
      expect(result).toHaveLength(1)
      expect(result[0].pages).toHaveLength(2) // All pages, not filtered
    })

    it('should filter pages when only pages match', () => {
      const result = filterSections(mockSections, 'Authentication')
      expect(result).toHaveLength(1)
      expect(result[0].slug).toBe('api-reference')
      expect(result[0].pages).toHaveLength(1)
      expect(result[0].pages[0].slug).toBe('authentication')
    })
  })
})

describe('getActiveSection Logic', () => {
  // Helper to simulate the getActiveSection logic
  const getActiveSectionPublic = (pathname: string): string | null => {
    const parts = pathname.split('/').filter(Boolean)
    // Path: /docs/[section]/[page]
    if (parts[0] === 'docs' && parts.length >= 2) {
      return parts[1]
    }
    return null
  }

  const getActiveSectionSuperadmin = (pathname: string): string | null => {
    const parts = pathname.split('/').filter(Boolean)
    // Path: /superadmin/docs/[section]/[page]
    if (parts[0] === 'superadmin' && parts[1] === 'docs' && parts.length >= 3) {
      return parts[2]
    }
    return null
  }

  describe('Public docs path parsing', () => {
    it('should extract section from /docs/section/page', () => {
      expect(getActiveSectionPublic('/docs/getting-started/intro')).toBe('getting-started')
    })

    it('should extract section from /docs/section', () => {
      expect(getActiveSectionPublic('/docs/getting-started')).toBe('getting-started')
    })

    it('should return null for /docs alone', () => {
      expect(getActiveSectionPublic('/docs')).toBe(null)
    })

    it('should return null for root path', () => {
      expect(getActiveSectionPublic('/')).toBe(null)
    })

    it('should return null for non-docs path', () => {
      expect(getActiveSectionPublic('/dashboard/settings')).toBe(null)
    })

    it('should handle trailing slash', () => {
      expect(getActiveSectionPublic('/docs/getting-started/')).toBe('getting-started')
    })
  })

  describe('Superadmin docs path parsing', () => {
    it('should extract section from /superadmin/docs/section/page', () => {
      expect(getActiveSectionSuperadmin('/superadmin/docs/setup/config')).toBe('setup')
    })

    it('should extract section from /superadmin/docs/section', () => {
      expect(getActiveSectionSuperadmin('/superadmin/docs/setup')).toBe('setup')
    })

    it('should return null for /superadmin/docs alone', () => {
      expect(getActiveSectionSuperadmin('/superadmin/docs')).toBe(null)
    })

    it('should return null for /superadmin alone', () => {
      expect(getActiveSectionSuperadmin('/superadmin')).toBe(null)
    })

    it('should return null for public docs path', () => {
      expect(getActiveSectionSuperadmin('/docs/getting-started')).toBe(null)
    })
  })
})
