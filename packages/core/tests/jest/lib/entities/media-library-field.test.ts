/**
 * Unit Tests - media-library field type for entities
 *
 * Tests that 'media-library' is a valid EntityFieldType and that
 * schema generation correctly handles it (nullable string for media ID).
 */

jest.mock('server-only', () => ({}))

import { generateEntitySchemas } from '@/core/lib/entities/schema-generator'
import type { EntityConfig, EntityFieldType } from '@/core/lib/entities/types'
import { FileText } from 'lucide-react'

// Shared minimal entity config factory
function makeConfig(fields: EntityConfig['fields']): EntityConfig {
  return {
    slug: 'test-media',
    enabled: true,
    names: { singular: 'Test', plural: 'Tests' },
    icon: FileText,
    access: { public: false, api: false, metadata: false, shared: false },
    ui: {
      dashboard: { showInMenu: false, showInTopbar: false },
      public: { hasArchivePage: false, hasSinglePage: false },
      features: {
        searchable: false,
        sortable: false,
        filterable: false,
        bulkOperations: false,
        importExport: false,
      },
    },
    i18n: {
      fallbackLocale: 'en',
      loaders: {
        en: async () => ({}),
        es: async () => ({}),
      },
    },
    fields,
  }
}

describe('media-library EntityFieldType', () => {
  describe('Type definition', () => {
    it('should accept media-library as a valid EntityFieldType', () => {
      // TypeScript compile-time check: if EntityFieldType did not include
      // 'media-library' this assignment would produce a TS error.
      const fieldType: EntityFieldType = 'media-library'
      expect(fieldType).toBe('media-library')
    })
  })

  describe('Schema generation', () => {
    const config = makeConfig([
      {
        name: 'featuredImage',
        type: 'media-library',
        required: false,
        display: {
          label: 'Featured Image',
          showInList: true,
          showInDetail: true,
          showInForm: true,
          order: 1,
        },
        api: { searchable: false, sortable: false, readOnly: false },
      },
    ])

    it('should generate schemas without throwing for a media-library field', () => {
      expect(() => generateEntitySchemas(config)).not.toThrow()
    })

    it('should accept a valid media ID string', () => {
      const { create } = generateEntitySchemas(config)
      const result = create.safeParse({ featuredImage: 'abc-123-uuid' })
      expect(result.success).toBe(true)
    })

    it('should accept null value', () => {
      const { create } = generateEntitySchemas(config)
      const result = create.safeParse({ featuredImage: null })
      expect(result.success).toBe(true)
    })

    it('should accept undefined (optional field)', () => {
      const { create } = generateEntitySchemas(config)
      const result = create.safeParse({})
      expect(result.success).toBe(true)
    })

    it('should accept empty string', () => {
      const { create } = generateEntitySchemas(config)
      const result = create.safeParse({ featuredImage: '' })
      expect(result.success).toBe(true)
    })

    it('should include field in update schema as optional', () => {
      const { update } = generateEntitySchemas(config)
      const result = update.safeParse({})
      expect(result.success).toBe(true)
    })
  })

  describe('Required media-library field', () => {
    const config = makeConfig([
      {
        name: 'coverImage',
        type: 'media-library',
        required: true,
        display: {
          label: 'Cover Image',
          showInList: true,
          showInDetail: true,
          showInForm: true,
          order: 1,
        },
        api: { searchable: false, sortable: false, readOnly: false },
      },
    ])

    it('should generate schemas without throwing for a required media-library field', () => {
      expect(() => generateEntitySchemas(config)).not.toThrow()
    })

    it('should accept a valid media ID string for required field', () => {
      const { create } = generateEntitySchemas(config)
      const result = create.safeParse({ coverImage: 'some-media-uuid' })
      expect(result.success).toBe(true)
    })
  })
})
