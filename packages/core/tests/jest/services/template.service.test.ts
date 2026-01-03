/**
 * Unit Tests - Template Service
 *
 * Tests the TemplateService static methods that provide runtime
 * template lookup and resolution operations.
 *
 * Test Coverage:
 * - hasOverride(appPath) checks if template exists
 * - getComponent(appPath) returns component or null
 * - getEntry(appPath) returns full entry or null
 * - getOverriddenPaths() returns all paths with overrides
 * - getByType(type) returns templates by type
 * - getByTheme(theme) returns templates by theme
 * - resolve(appPath) returns resolution result
 * - getAll() returns all template entries
 * - getCount() returns total count
 * - getTypes() returns available types
 * - getMetadata() returns registry metadata
 *
 * @see {@link /core/lib/services/template.service.ts}
 */

// Mock the template registry to avoid importing React components
const mockComponent = () => null

jest.mock('@/core/lib/registries/template-registry', () => ({
  TEMPLATE_REGISTRY: {
    'app/(public)/page.tsx': {
      appPath: 'app/(public)/page.tsx',
      component: mockComponent,
      template: {
        name: '(public)/page',
        themeName: 'default',
        templateType: 'page',
        fileName: 'page.tsx',
        relativePath: '(public)/page.tsx',
        appPath: 'app/(public)/page.tsx',
        templatePath: '@/contents/themes/default/templates/(public)/page.tsx',
        priority: 107,
        metadata: null
      },
      alternatives: []
    },
    'app/(public)/blog/[slug]/page.tsx': {
      appPath: 'app/(public)/blog/[slug]/page.tsx',
      component: mockComponent,
      template: {
        name: '(public)/blog/[slug]/page',
        themeName: 'default',
        templateType: 'page',
        fileName: 'page.tsx',
        relativePath: '(public)/blog/[slug]/page.tsx',
        appPath: 'app/(public)/blog/[slug]/page.tsx',
        templatePath: '@/contents/themes/default/templates/(public)/blog/[slug]/page.tsx',
        priority: 111,
        metadata: null
      },
      alternatives: []
    },
    'app/(public)/layout.tsx': {
      appPath: 'app/(public)/layout.tsx',
      component: mockComponent,
      template: {
        name: '(public)/layout',
        themeName: 'default',
        templateType: 'layout',
        fileName: 'layout.tsx',
        relativePath: '(public)/layout.tsx',
        appPath: 'app/(public)/layout.tsx',
        templatePath: '@/contents/themes/default/templates/(public)/layout.tsx',
        priority: 112,
        metadata: null
      },
      alternatives: []
    },
    'app/(public)/support/page.tsx': {
      appPath: 'app/(public)/support/page.tsx',
      component: mockComponent,
      template: {
        name: '(public)/support/page',
        themeName: 'default',
        templateType: 'page',
        fileName: 'page.tsx',
        relativePath: '(public)/support/page.tsx',
        appPath: 'app/(public)/support/page.tsx',
        templatePath: '@/contents/themes/default/templates/(public)/support/page.tsx',
        priority: 109,
        metadata: null
      },
      alternatives: []
    }
  },
  TEMPLATE_METADATA: {
    totalTemplates: 4,
    uniquePaths: 4,
    templateTypes: ['page', 'layout'],
    themeDistribution: { default: 4 },
    generatedAt: '2025-12-26T22:24:26.020Z',
    paths: [
      'app/(public)/blog/[slug]/page.tsx',
      'app/(public)/layout.tsx',
      'app/(public)/page.tsx',
      'app/(public)/support/page.tsx'
    ]
  }
}))

import { TemplateService } from '@/core/lib/services/template.service'

describe('TemplateService', () => {
  // Known paths from the current registry
  const VALID_PATH = 'app/(public)/page.tsx'
  const VALID_BLOG_PATH = 'app/(public)/blog/[slug]/page.tsx'
  const VALID_LAYOUT_PATH = 'app/(public)/layout.tsx'
  const INVALID_PATH = 'app/nonexistent/page.tsx'

  describe('hasOverride', () => {
    it('should return true for existing template path', () => {
      expect(TemplateService.hasOverride(VALID_PATH)).toBe(true)
    })

    it('should return true for all known paths', () => {
      expect(TemplateService.hasOverride(VALID_PATH)).toBe(true)
      expect(TemplateService.hasOverride(VALID_BLOG_PATH)).toBe(true)
      expect(TemplateService.hasOverride(VALID_LAYOUT_PATH)).toBe(true)
    })

    it('should return false for non-existing path', () => {
      expect(TemplateService.hasOverride(INVALID_PATH)).toBe(false)
    })

    it('should return false for empty string', () => {
      expect(TemplateService.hasOverride('')).toBe(false)
    })

    it('should be case-sensitive', () => {
      expect(TemplateService.hasOverride('APP/(PUBLIC)/PAGE.TSX')).toBe(false)
    })

    it('should return false for partial path match', () => {
      expect(TemplateService.hasOverride('app/(public)')).toBe(false)
      expect(TemplateService.hasOverride('(public)/page.tsx')).toBe(false)
    })
  })

  describe('getComponent', () => {
    it('should return component for valid path', () => {
      const component = TemplateService.getComponent(VALID_PATH)
      expect(component).toBeDefined()
      expect(component).not.toBeNull()
    })

    it('should return null for invalid path', () => {
      const component = TemplateService.getComponent(INVALID_PATH)
      expect(component).toBeNull()
    })

    it('should return null for empty string', () => {
      const component = TemplateService.getComponent('')
      expect(component).toBeNull()
    })

    it('should return component for layout path', () => {
      const component = TemplateService.getComponent(VALID_LAYOUT_PATH)
      expect(component).toBeDefined()
    })
  })

  describe('getEntry', () => {
    it('should return full entry for valid path', () => {
      const entry = TemplateService.getEntry(VALID_PATH)

      expect(entry).not.toBeNull()
      expect(entry).toHaveProperty('appPath')
      expect(entry).toHaveProperty('component')
      expect(entry).toHaveProperty('template')
      expect(entry).toHaveProperty('alternatives')
    })

    it('should return entry with correct structure', () => {
      const entry = TemplateService.getEntry(VALID_PATH)

      expect(entry?.appPath).toBe(VALID_PATH)
      expect(entry?.template).toHaveProperty('themeName')
      expect(entry?.template).toHaveProperty('templateType')
      expect(entry?.template).toHaveProperty('fileName')
      expect(Array.isArray(entry?.alternatives)).toBe(true)
    })

    it('should return null for invalid path', () => {
      const entry = TemplateService.getEntry(INVALID_PATH)
      expect(entry).toBeNull()
    })

    it('should return null for empty string', () => {
      const entry = TemplateService.getEntry('')
      expect(entry).toBeNull()
    })

    it('should return entry with correct theme name', () => {
      const entry = TemplateService.getEntry(VALID_PATH)
      expect(entry?.template.themeName).toBe('default')
    })
  })

  describe('getOverriddenPaths', () => {
    it('should return array of paths', () => {
      const paths = TemplateService.getOverriddenPaths()

      expect(Array.isArray(paths)).toBe(true)
      expect(paths.length).toBeGreaterThan(0)
    })

    it('should include known paths', () => {
      const paths = TemplateService.getOverriddenPaths()

      expect(paths).toContain(VALID_PATH)
      expect(paths).toContain(VALID_BLOG_PATH)
      expect(paths).toContain(VALID_LAYOUT_PATH)
    })

    it('should return current count of 4 paths', () => {
      const paths = TemplateService.getOverriddenPaths()
      expect(paths.length).toBe(4)
    })

    it('should not include invalid paths', () => {
      const paths = TemplateService.getOverriddenPaths()
      expect(paths).not.toContain(INVALID_PATH)
    })
  })

  describe('getByType', () => {
    it('should return templates for page type', () => {
      const pages = TemplateService.getByType('page')

      expect(Array.isArray(pages)).toBe(true)
      expect(pages.length).toBeGreaterThan(0)
      pages.forEach(entry => {
        expect(entry.template.templateType).toBe('page')
      })
    })

    it('should return templates for layout type', () => {
      const layouts = TemplateService.getByType('layout')

      expect(Array.isArray(layouts)).toBe(true)
      expect(layouts.length).toBeGreaterThan(0)
      layouts.forEach(entry => {
        expect(entry.template.templateType).toBe('layout')
      })
    })

    it('should return empty array for non-existing type', () => {
      const templates = TemplateService.getByType('nonexistent-type')

      expect(Array.isArray(templates)).toBe(true)
      expect(templates.length).toBe(0)
    })

    it('should return empty array for empty string', () => {
      const templates = TemplateService.getByType('')

      expect(Array.isArray(templates)).toBe(true)
      expect(templates.length).toBe(0)
    })

    it('should be case-sensitive', () => {
      const templates = TemplateService.getByType('PAGE')

      expect(templates.length).toBe(0)
    })
  })

  describe('getByTheme', () => {
    it('should return templates for default theme', () => {
      const templates = TemplateService.getByTheme('default')

      expect(Array.isArray(templates)).toBe(true)
      expect(templates.length).toBeGreaterThan(0)
    })

    it('should return templates with correct theme', () => {
      const templates = TemplateService.getByTheme('default')

      templates.forEach(entry => {
        expect(entry.template.themeName).toBe('default')
      })
    })

    it('should return empty array for non-existing theme', () => {
      const templates = TemplateService.getByTheme('nonexistent-theme')

      expect(Array.isArray(templates)).toBe(true)
      expect(templates.length).toBe(0)
    })

    it('should return empty array for empty string', () => {
      const templates = TemplateService.getByTheme('')

      expect(Array.isArray(templates)).toBe(true)
      expect(templates.length).toBe(0)
    })

    it('should be case-sensitive', () => {
      const templates = TemplateService.getByTheme('DEFAULT')

      expect(templates.length).toBe(0)
    })

    it('should return current count of 4 templates for default theme', () => {
      const templates = TemplateService.getByTheme('default')
      expect(templates.length).toBe(4)
    })
  })

  describe('resolve', () => {
    it('should return hasOverride true for valid path', () => {
      const result = TemplateService.resolve(VALID_PATH)

      expect(result.hasOverride).toBe(true)
      expect(result.component).toBeDefined()
      expect(result.template).toBeDefined()
      expect(result.originalPath).toBe(VALID_PATH)
    })

    it('should return hasOverride false for invalid path', () => {
      const result = TemplateService.resolve(INVALID_PATH)

      expect(result.hasOverride).toBe(false)
      expect(result.component).toBeUndefined()
      expect(result.template).toBeUndefined()
      expect(result.originalPath).toBe(INVALID_PATH)
    })

    it('should include template details when override exists', () => {
      const result = TemplateService.resolve(VALID_PATH)

      expect(result.template?.themeName).toBe('default')
      expect(result.template?.templateType).toBe('page')
    })

    it('should always include originalPath', () => {
      const validResult = TemplateService.resolve(VALID_PATH)
      const invalidResult = TemplateService.resolve(INVALID_PATH)

      expect(validResult.originalPath).toBe(VALID_PATH)
      expect(invalidResult.originalPath).toBe(INVALID_PATH)
    })
  })

  describe('getAll', () => {
    it('should return array of all entries', () => {
      const entries = TemplateService.getAll()

      expect(Array.isArray(entries)).toBe(true)
      expect(entries.length).toBeGreaterThan(0)
    })

    it('should return entries with correct structure', () => {
      const entries = TemplateService.getAll()

      entries.forEach(entry => {
        expect(entry).toHaveProperty('appPath')
        expect(entry).toHaveProperty('component')
        expect(entry).toHaveProperty('template')
        expect(entry).toHaveProperty('alternatives')
      })
    })

    it('should return current count of 4 entries', () => {
      const entries = TemplateService.getAll()
      expect(entries.length).toBe(4)
    })
  })

  describe('getCount', () => {
    it('should return total template count', () => {
      const count = TemplateService.getCount()

      expect(typeof count).toBe('number')
      expect(count).toBeGreaterThan(0)
    })

    it('should match getAll length', () => {
      const count = TemplateService.getCount()
      const entries = TemplateService.getAll()

      expect(count).toBe(entries.length)
    })

    it('should return current count of 4', () => {
      expect(TemplateService.getCount()).toBe(4)
    })
  })

  describe('getTypes', () => {
    it('should return array of template types', () => {
      const types = TemplateService.getTypes()

      expect(Array.isArray(types)).toBe(true)
      expect(types.length).toBeGreaterThan(0)
    })

    it('should include page and layout types', () => {
      const types = TemplateService.getTypes()

      expect(types).toContain('page')
      expect(types).toContain('layout')
    })

    it('should return current types', () => {
      const types = TemplateService.getTypes()
      expect(types).toEqual(['page', 'layout'])
    })
  })

  describe('getMetadata', () => {
    it('should return metadata object', () => {
      const metadata = TemplateService.getMetadata()

      expect(metadata).toBeDefined()
      expect(typeof metadata).toBe('object')
    })

    it('should include required fields', () => {
      const metadata = TemplateService.getMetadata()

      expect(metadata).toHaveProperty('totalTemplates')
      expect(metadata).toHaveProperty('uniquePaths')
      expect(metadata).toHaveProperty('templateTypes')
      expect(metadata).toHaveProperty('themeDistribution')
      expect(metadata).toHaveProperty('generatedAt')
      expect(metadata).toHaveProperty('paths')
    })

    it('should have correct totalTemplates', () => {
      const metadata = TemplateService.getMetadata()
      expect(metadata.totalTemplates).toBe(4)
    })

    it('should have correct uniquePaths', () => {
      const metadata = TemplateService.getMetadata()
      expect(metadata.uniquePaths).toBe(4)
    })

    it('should have correct templateTypes', () => {
      const metadata = TemplateService.getMetadata()
      expect(metadata.templateTypes).toEqual(['page', 'layout'])
    })

    it('should have themeDistribution with default theme', () => {
      const metadata = TemplateService.getMetadata()
      expect(metadata.themeDistribution).toHaveProperty('default')
      expect(metadata.themeDistribution.default).toBe(4)
    })
  })

  describe('Integration - Cross-method consistency', () => {
    it('should have consistent data between hasOverride and getEntry', () => {
      const paths = TemplateService.getOverriddenPaths()

      paths.forEach(path => {
        expect(TemplateService.hasOverride(path)).toBe(true)
        expect(TemplateService.getEntry(path)).not.toBeNull()
      })

      expect(TemplateService.hasOverride(INVALID_PATH)).toBe(false)
      expect(TemplateService.getEntry(INVALID_PATH)).toBeNull()
    })

    it('should have consistent data between getAll and getOverriddenPaths', () => {
      const entries = TemplateService.getAll()
      const paths = TemplateService.getOverriddenPaths()

      expect(entries.length).toBe(paths.length)

      entries.forEach(entry => {
        expect(paths).toContain(entry.appPath)
      })
    })

    it('should have consistent data between getCount and getAll', () => {
      expect(TemplateService.getCount()).toBe(TemplateService.getAll().length)
    })

    it('should have consistent data between getByType and getAll', () => {
      const pages = TemplateService.getByType('page')
      const layouts = TemplateService.getByType('layout')
      const all = TemplateService.getAll()

      expect(pages.length + layouts.length).toBe(all.length)
    })

    it('should have consistent data between resolve and hasOverride', () => {
      const paths = TemplateService.getOverriddenPaths()

      paths.forEach(path => {
        const result = TemplateService.resolve(path)
        expect(result.hasOverride).toBe(true)
        expect(TemplateService.hasOverride(path)).toBe(true)
      })

      const invalidResult = TemplateService.resolve(INVALID_PATH)
      expect(invalidResult.hasOverride).toBe(false)
      expect(TemplateService.hasOverride(INVALID_PATH)).toBe(false)
    })

    it('should have metadata paths match getOverriddenPaths', () => {
      const metadata = TemplateService.getMetadata()
      const paths = TemplateService.getOverriddenPaths()

      expect(metadata.paths.sort()).toEqual(paths.sort())
    })
  })
})
