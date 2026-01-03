/**
 * Unit Tests - Entity Builder Validation Functions
 *
 * Tests validation functions for BuilderConfig and TaxonomiesConfig:
 * - validateBuilderEntityConfig(): Required fields, sidebarFields references, basePath format
 * - validateTaxonomiesConfig(): Types array validation, property checks
 * - getBuilderEntities(): Filter entities by builder.enabled
 * - matchPathToEntity(): URL path to entity resolution by basePath
 *
 * Focus on business logic validation WITHOUT database calls.
 */

import {
  validateBuilderEntityConfig,
  validateTaxonomiesConfig,
  getBuilderEntities,
  matchPathToEntity
} from '@/core/lib/entities/schema-generator'
import type { EntityConfig } from '@/core/lib/entities/types'
import { FileText } from 'lucide-react'

describe('Entity Builder Validation Functions', () => {
  // ============================================================================
  // validateBuilderEntityConfig
  // ============================================================================

  describe('validateBuilderEntityConfig', () => {
    describe('Valid Configurations', () => {
      it('should return no errors for config without builder enabled', () => {
        const config: EntityConfig = {
          slug: 'test',
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
              importExport: false
            }
          },
          permissions: { actions: [] },
          i18n: {
            fallbackLocale: 'en',
            loaders: {
              en: async () => ({}),
              es: async () => ({})
            }
          },
          fields: []
        }

        const result = validateBuilderEntityConfig(config)

        expect(result.errors).toHaveLength(0)
        expect(result.warnings).toHaveLength(0)
        expect(result.valid).toBe(true)
      })

      it('should return no errors for valid builder config with all required fields', () => {
        const config: EntityConfig = {
          slug: 'pages',
          enabled: true,
          names: { singular: 'Page', plural: 'Pages' },
          icon: FileText,
          access: { public: true, api: true, metadata: false, shared: true },
          ui: {
            dashboard: { showInMenu: true, showInTopbar: true },
            public: { hasArchivePage: false, hasSinglePage: true },
            features: {
              searchable: true,
              sortable: true,
              filterable: false,
              bulkOperations: false,
              importExport: false
            }
          },
          permissions: { actions: [] },
          i18n: {
            fallbackLocale: 'en',
            loaders: {
              en: async () => ({}),
              es: async () => ({})
            }
          },
          builder: {
            enabled: true,
            public: { basePath: '/' },
            seo: true
          },
          fields: [
            {
              name: 'title',
              type: 'text',
              required: true,
              display: {
                label: 'Title',
                showInList: true,
                showInDetail: true,
                showInForm: true,
                order: 1
              },
              api: { searchable: true, sortable: true, readOnly: false }
            },
            {
              name: 'slug',
              type: 'text',
              required: true,
              display: {
                label: 'Slug',
                showInList: true,
                showInDetail: true,
                showInForm: true,
                order: 2
              },
              api: { searchable: true, sortable: true, readOnly: false }
            },
            {
              name: 'status',
              type: 'select',
              required: true,
              options: [
                { label: 'Draft', value: 'draft' },
                { label: 'Published', value: 'published' }
              ],
              display: {
                label: 'Status',
                showInList: true,
                showInDetail: true,
                showInForm: true,
                order: 3
              },
              api: { searchable: false, sortable: true, readOnly: false }
            }
          ]
        }

        const result = validateBuilderEntityConfig(config)

        expect(result.errors).toHaveLength(0)
        expect(result.valid).toBe(true)
      })

      it('should return no errors for config with valid sidebarFields', () => {
        const config: EntityConfig = {
          slug: 'posts',
          enabled: true,
          names: { singular: 'Post', plural: 'Posts' },
          icon: FileText,
          access: { public: true, api: true, metadata: false, shared: true, basePath: '/blog' },
          ui: {
            dashboard: { showInMenu: true, showInTopbar: true },
            public: { hasArchivePage: true, hasSinglePage: true },
            features: {
              searchable: true,
              sortable: true,
              filterable: true,
              bulkOperations: false,
              importExport: false
            }
          },
          permissions: { actions: [] },
          i18n: {
            fallbackLocale: 'en',
            loaders: {
              en: async () => ({}),
              es: async () => ({})
            }
          },
          builder: {
            enabled: true,
            sidebarFields: ['excerpt', 'featuredImage'],
            seo: true
          },
          fields: [
            { name: 'title', type: 'text', required: true, display: { label: 'Title', showInList: true, showInDetail: true, showInForm: true, order: 1 }, api: { searchable: true, sortable: true, readOnly: false } },
            { name: 'slug', type: 'text', required: true, display: { label: 'Slug', showInList: true, showInDetail: true, showInForm: true, order: 2 }, api: { searchable: true, sortable: true, readOnly: false } },
            { name: 'status', type: 'select', required: true, display: { label: 'Status', showInList: true, showInDetail: true, showInForm: true, order: 3 }, api: { searchable: false, sortable: true, readOnly: false } },
            { name: 'excerpt', type: 'textarea', required: false, display: { label: 'Excerpt', showInList: false, showInDetail: true, showInForm: true, order: 4 }, api: { searchable: true, sortable: false, readOnly: false } },
            { name: 'featuredImage', type: 'image', required: false, display: { label: 'Featured Image', showInList: false, showInDetail: true, showInForm: true, order: 5 }, api: { searchable: false, sortable: false, readOnly: false } }
          ]
        }

        const result = validateBuilderEntityConfig(config)

        expect(result.errors).toHaveLength(0)
        expect(result.warnings).toHaveLength(0)
        expect(result.valid).toBe(true)
      })

      it('should return no errors for config with basePath containing multiple segments', () => {
        const config: EntityConfig = {
          slug: 'docs',
          enabled: true,
          names: { singular: 'Doc', plural: 'Docs' },
          icon: FileText,
          access: { public: true, api: true, metadata: false, shared: true },
          ui: {
            dashboard: { showInMenu: true, showInTopbar: false },
            public: { hasArchivePage: true, hasSinglePage: true },
            features: {
              searchable: true,
              sortable: true,
              filterable: false,
              bulkOperations: false,
              importExport: false
            }
          },
          permissions: { actions: [] },
          i18n: {
            fallbackLocale: 'en',
            loaders: {
              en: async () => ({}),
              es: async () => ({})
            }
          },
          builder: {
            enabled: true,
            public: { basePath: '/docs/guides' }
          },
          fields: [
            { name: 'title', type: 'text', required: true, display: { label: 'Title', showInList: true, showInDetail: true, showInForm: true, order: 1 }, api: { searchable: true, sortable: true, readOnly: false } },
            { name: 'slug', type: 'text', required: true, display: { label: 'Slug', showInList: true, showInDetail: true, showInForm: true, order: 2 }, api: { searchable: true, sortable: true, readOnly: false } },
            { name: 'status', type: 'text', required: true, display: { label: 'Status', showInList: true, showInDetail: true, showInForm: true, order: 3 }, api: { searchable: false, sortable: true, readOnly: false } }
          ]
        }

        const result = validateBuilderEntityConfig(config)

        expect(result.errors).toHaveLength(0)
        expect(result.valid).toBe(true)
      })
    })

    describe('Missing Required Fields', () => {
      it('should return error when title field is missing', () => {
        const config: EntityConfig = {
          slug: 'test',
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
              importExport: false
            }
          },
          permissions: { actions: [] },
          i18n: {
            fallbackLocale: 'en',
            loaders: {
              en: async () => ({}),
              es: async () => ({})
            }
          },
          builder: { enabled: true },
          fields: [
            { name: 'slug', type: 'text', required: true, display: { label: 'Slug', showInList: true, showInDetail: true, showInForm: true, order: 1 }, api: { searchable: true, sortable: true, readOnly: false } },
            { name: 'status', type: 'select', required: true, display: { label: 'Status', showInList: true, showInDetail: true, showInForm: true, order: 2 }, api: { searchable: false, sortable: true, readOnly: false } }
          ]
        }

        const result = validateBuilderEntityConfig(config)

        expect(result.valid).toBe(false)
        expect(result.errors).toContainEqual(
          expect.stringMatching(/missing required field.*title/i)
        )
      })

      it('should return error when slug field is missing', () => {
        const config: EntityConfig = {
          slug: 'test',
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
              importExport: false
            }
          },
          permissions: { actions: [] },
          i18n: {
            fallbackLocale: 'en',
            loaders: {
              en: async () => ({}),
              es: async () => ({})
            }
          },
          builder: { enabled: true },
          fields: [
            { name: 'title', type: 'text', required: true, display: { label: 'Title', showInList: true, showInDetail: true, showInForm: true, order: 1 }, api: { searchable: true, sortable: true, readOnly: false } },
            { name: 'status', type: 'select', required: true, display: { label: 'Status', showInList: true, showInDetail: true, showInForm: true, order: 2 }, api: { searchable: false, sortable: true, readOnly: false } }
          ]
        }

        const result = validateBuilderEntityConfig(config)

        expect(result.valid).toBe(false)
        expect(result.errors).toContainEqual(
          expect.stringMatching(/missing required field.*slug/i)
        )
      })

      it('should return error when status field is missing', () => {
        const config: EntityConfig = {
          slug: 'test',
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
              importExport: false
            }
          },
          permissions: { actions: [] },
          i18n: {
            fallbackLocale: 'en',
            loaders: {
              en: async () => ({}),
              es: async () => ({})
            }
          },
          builder: { enabled: true },
          fields: [
            { name: 'title', type: 'text', required: true, display: { label: 'Title', showInList: true, showInDetail: true, showInForm: true, order: 1 }, api: { searchable: true, sortable: true, readOnly: false } },
            { name: 'slug', type: 'text', required: true, display: { label: 'Slug', showInList: true, showInDetail: true, showInForm: true, order: 2 }, api: { searchable: true, sortable: true, readOnly: false } }
          ]
        }

        const result = validateBuilderEntityConfig(config)

        expect(result.valid).toBe(false)
        expect(result.errors).toContainEqual(
          expect.stringMatching(/missing required field.*status/i)
        )
      })

      it('should return multiple errors when multiple fields are missing', () => {
        const config: EntityConfig = {
          slug: 'test',
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
              importExport: false
            }
          },
          permissions: { actions: [] },
          i18n: {
            fallbackLocale: 'en',
            loaders: {
              en: async () => ({}),
              es: async () => ({})
            }
          },
          builder: { enabled: true },
          fields: []
        }

        const result = validateBuilderEntityConfig(config)

        expect(result.valid).toBe(false)
        expect(result.errors.length).toBeGreaterThanOrEqual(3)
        expect(result.errors.join(' ')).toMatch(/title/)
        expect(result.errors.join(' ')).toMatch(/slug/)
        expect(result.errors.join(' ')).toMatch(/status/)
      })
    })

    describe('Sidebar Fields Validation', () => {
      it('should return warning when sidebarField references non-existent field', () => {
        const config: EntityConfig = {
          slug: 'test',
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
              importExport: false
            }
          },
          permissions: { actions: [] },
          i18n: {
            fallbackLocale: 'en',
            loaders: {
              en: async () => ({}),
              es: async () => ({})
            }
          },
          builder: {
            enabled: true,
            sidebarFields: ['nonexistent']
          },
          fields: [
            { name: 'title', type: 'text', required: true, display: { label: 'Title', showInList: true, showInDetail: true, showInForm: true, order: 1 }, api: { searchable: true, sortable: true, readOnly: false } },
            { name: 'slug', type: 'text', required: true, display: { label: 'Slug', showInList: true, showInDetail: true, showInForm: true, order: 2 }, api: { searchable: true, sortable: true, readOnly: false } },
            { name: 'status', type: 'select', required: true, display: { label: 'Status', showInList: true, showInDetail: true, showInForm: true, order: 3 }, api: { searchable: false, sortable: true, readOnly: false } }
          ]
        }

        const result = validateBuilderEntityConfig(config)

        expect(result.errors).toHaveLength(0)
        expect(result.warnings).toContainEqual(
          expect.stringMatching(/sidebarField.*nonexistent.*does not exist/i)
        )
      })

      it('should return multiple warnings for multiple non-existent sidebarFields', () => {
        const config: EntityConfig = {
          slug: 'test',
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
              importExport: false
            }
          },
          permissions: { actions: [] },
          i18n: {
            fallbackLocale: 'en',
            loaders: {
              en: async () => ({}),
              es: async () => ({})
            }
          },
          builder: {
            enabled: true,
            sidebarFields: ['field1', 'field2', 'field3']
          },
          fields: [
            { name: 'title', type: 'text', required: true, display: { label: 'Title', showInList: true, showInDetail: true, showInForm: true, order: 1 }, api: { searchable: true, sortable: true, readOnly: false } },
            { name: 'slug', type: 'text', required: true, display: { label: 'Slug', showInList: true, showInDetail: true, showInForm: true, order: 2 }, api: { searchable: true, sortable: true, readOnly: false } },
            { name: 'status', type: 'select', required: true, display: { label: 'Status', showInList: true, showInDetail: true, showInForm: true, order: 3 }, api: { searchable: false, sortable: true, readOnly: false } }
          ]
        }

        const result = validateBuilderEntityConfig(config)

        expect(result.warnings.length).toBe(3)
        expect(result.warnings.join(' ')).toMatch(/field1/)
        expect(result.warnings.join(' ')).toMatch(/field2/)
        expect(result.warnings.join(' ')).toMatch(/field3/)
      })
    })

    describe('BasePath Validation', () => {
      it('should return error when basePath does not start with /', () => {
        const config: EntityConfig = {
          slug: 'test',
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
              importExport: false
            }
          },
          permissions: { actions: [] },
          i18n: {
            fallbackLocale: 'en',
            loaders: {
              en: async () => ({}),
              es: async () => ({})
            }
          },
          builder: {
            enabled: true,
            public: { basePath: 'invalid' }
          },
          fields: [
            { name: 'title', type: 'text', required: true, display: { label: 'Title', showInList: true, showInDetail: true, showInForm: true, order: 1 }, api: { searchable: true, sortable: true, readOnly: false } },
            { name: 'slug', type: 'text', required: true, display: { label: 'Slug', showInList: true, showInDetail: true, showInForm: true, order: 2 }, api: { searchable: true, sortable: true, readOnly: false } },
            { name: 'status', type: 'select', required: true, display: { label: 'Status', showInList: true, showInDetail: true, showInForm: true, order: 3 }, api: { searchable: false, sortable: true, readOnly: false } }
          ]
        }

        const result = validateBuilderEntityConfig(config)

        expect(result.valid).toBe(false)
        expect(result.errors).toContainEqual(
          expect.stringMatching(/basePath.*must start with/i)
        )
      })

      it('should accept basePath with spaces (validation is lenient)', () => {
        // Note: Current implementation does not validate spaces in basePath
        // If strict validation is required, add a regex check to validateBuilderEntityConfig
        const config: EntityConfig = {
          slug: 'test',
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
              importExport: false
            }
          },
          permissions: { actions: [] },
          i18n: {
            fallbackLocale: 'en',
            loaders: {
              en: async () => ({}),
              es: async () => ({})
            }
          },
          builder: {
            enabled: true,
            public: { basePath: '/ blog' }
          },
          fields: [
            { name: 'title', type: 'text', required: true, display: { label: 'Title', showInList: true, showInDetail: true, showInForm: true, order: 1 }, api: { searchable: true, sortable: true, readOnly: false } },
            { name: 'slug', type: 'text', required: true, display: { label: 'Slug', showInList: true, showInDetail: true, showInForm: true, order: 2 }, api: { searchable: true, sortable: true, readOnly: false } },
            { name: 'status', type: 'select', required: true, display: { label: 'Status', showInList: true, showInDetail: true, showInForm: true, order: 3 }, api: { searchable: false, sortable: true, readOnly: false } }
          ]
        }

        const result = validateBuilderEntityConfig(config)

        // Current implementation accepts this - path starts with /
        expect(result.valid).toBe(true)
      })
    })

    describe('Status Field Type Validation', () => {
      it('should return warning when status field is not select or text type', () => {
        const config: EntityConfig = {
          slug: 'test',
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
              importExport: false
            }
          },
          permissions: { actions: [] },
          i18n: {
            fallbackLocale: 'en',
            loaders: {
              en: async () => ({}),
              es: async () => ({})
            }
          },
          builder: { enabled: true },
          fields: [
            { name: 'title', type: 'text', required: true, display: { label: 'Title', showInList: true, showInDetail: true, showInForm: true, order: 1 }, api: { searchable: true, sortable: true, readOnly: false } },
            { name: 'slug', type: 'text', required: true, display: { label: 'Slug', showInList: true, showInDetail: true, showInForm: true, order: 2 }, api: { searchable: true, sortable: true, readOnly: false } },
            { name: 'status', type: 'number', required: true, display: { label: 'Status', showInList: true, showInDetail: true, showInForm: true, order: 3 }, api: { searchable: false, sortable: true, readOnly: false } }
          ]
        }

        const result = validateBuilderEntityConfig(config)

        expect(result.errors).toHaveLength(0)
        expect(result.warnings).toContainEqual(
          expect.stringMatching(/status field.*type.*number/i)
        )
      })
    })
  })

  // ============================================================================
  // validateTaxonomiesConfig
  // ============================================================================

  describe('validateTaxonomiesConfig', () => {
    describe('Valid Configurations', () => {
      it('should return no errors when taxonomies disabled', () => {
        const config: EntityConfig = {
          slug: 'test',
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
              importExport: false
            }
          },
          permissions: { actions: [] },
          i18n: {
            fallbackLocale: 'en',
            loaders: {
              en: async () => ({}),
              es: async () => ({})
            }
          },
          taxonomies: {
            enabled: false,
            types: []
          },
          fields: []
        }

        const result = validateTaxonomiesConfig(config)

        expect(result.errors).toHaveLength(0)
        expect(result.warnings).toHaveLength(0)
        expect(result.valid).toBe(true)
      })

      it('should return no errors for valid taxonomies config', () => {
        const config: EntityConfig = {
          slug: 'posts',
          enabled: true,
          names: { singular: 'Post', plural: 'Posts' },
          icon: FileText,
          access: { public: true, api: true, metadata: false, shared: true },
          ui: {
            dashboard: { showInMenu: true, showInTopbar: true },
            public: { hasArchivePage: true, hasSinglePage: true },
            features: {
              searchable: true,
              sortable: true,
              filterable: true,
              bulkOperations: false,
              importExport: false
            }
          },
          permissions: { actions: [] },
          i18n: {
            fallbackLocale: 'en',
            loaders: {
              en: async () => ({}),
              es: async () => ({})
            }
          },
          taxonomies: {
            enabled: true,
            types: [
              {
                type: 'post_category',
                field: 'categories',
                multiple: true,
                label: 'Categories'
              }
            ]
          },
          fields: []
        }

        const result = validateTaxonomiesConfig(config)

        expect(result.errors).toHaveLength(0)
        expect(result.warnings).toHaveLength(0)
        expect(result.valid).toBe(true)
      })

      it('should return no errors for multiple taxonomy types', () => {
        const config: EntityConfig = {
          slug: 'posts',
          enabled: true,
          names: { singular: 'Post', plural: 'Posts' },
          icon: FileText,
          access: { public: true, api: true, metadata: false, shared: true },
          ui: {
            dashboard: { showInMenu: true, showInTopbar: true },
            public: { hasArchivePage: true, hasSinglePage: true },
            features: {
              searchable: true,
              sortable: true,
              filterable: true,
              bulkOperations: false,
              importExport: false
            }
          },
          permissions: { actions: [] },
          i18n: {
            fallbackLocale: 'en',
            loaders: {
              en: async () => ({}),
              es: async () => ({})
            }
          },
          taxonomies: {
            enabled: true,
            types: [
              {
                type: 'post_category',
                field: 'categories',
                multiple: true
              },
              {
                type: 'tag',
                field: 'tags',
                multiple: true
              },
              {
                type: 'author',
                field: 'author',
                multiple: false
              }
            ]
          },
          fields: []
        }

        const result = validateTaxonomiesConfig(config)

        expect(result.errors).toHaveLength(0)
        expect(result.valid).toBe(true)
      })
    })

    describe('Empty Types Array', () => {
      it('should return error when taxonomies enabled but types array is empty', () => {
        const config: EntityConfig = {
          slug: 'test',
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
              importExport: false
            }
          },
          permissions: { actions: [] },
          i18n: {
            fallbackLocale: 'en',
            loaders: {
              en: async () => ({}),
              es: async () => ({})
            }
          },
          taxonomies: {
            enabled: true,
            types: []
          },
          fields: []
        }

        const result = validateTaxonomiesConfig(config)

        expect(result.valid).toBe(false)
        expect(result.errors).toContainEqual(
          expect.stringMatching(/types is empty/i)
        )
      })

      it('should return error when types property is undefined', () => {
        const config: EntityConfig = {
          slug: 'test',
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
              importExport: false
            }
          },
          permissions: { actions: [] },
          i18n: {
            fallbackLocale: 'en',
            loaders: {
              en: async () => ({}),
              es: async () => ({})
            }
          },
          taxonomies: {
            enabled: true,
            types: undefined as unknown as []
          },
          fields: []
        }

        const result = validateTaxonomiesConfig(config)

        expect(result.valid).toBe(false)
      })
    })

    describe('Invalid Taxonomy Type Properties', () => {
      it('should return error when type property is missing', () => {
        const config: EntityConfig = {
          slug: 'test',
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
              importExport: false
            }
          },
          permissions: { actions: [] },
          i18n: {
            fallbackLocale: 'en',
            loaders: {
              en: async () => ({}),
              es: async () => ({})
            }
          },
          taxonomies: {
            enabled: true,
            types: [
              {
                type: '',
                field: 'categories',
                multiple: true
              }
            ]
          },
          fields: []
        }

        const result = validateTaxonomiesConfig(config)

        expect(result.valid).toBe(false)
        expect(result.errors).toContainEqual(
          expect.stringMatching(/missing.*type.*property/i)
        )
      })

      it('should return error when field property is missing', () => {
        const config: EntityConfig = {
          slug: 'test',
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
              importExport: false
            }
          },
          permissions: { actions: [] },
          i18n: {
            fallbackLocale: 'en',
            loaders: {
              en: async () => ({}),
              es: async () => ({})
            }
          },
          taxonomies: {
            enabled: true,
            types: [
              {
                type: 'post_category',
                field: '',
                multiple: true
              }
            ]
          },
          fields: []
        }

        const result = validateTaxonomiesConfig(config)

        expect(result.valid).toBe(false)
        expect(result.errors).toContainEqual(
          expect.stringMatching(/missing.*field.*property/i)
        )
      })

      it('should return warning when multiple property is undefined', () => {
        const config: EntityConfig = {
          slug: 'test',
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
              importExport: false
            }
          },
          permissions: { actions: [] },
          i18n: {
            fallbackLocale: 'en',
            loaders: {
              en: async () => ({}),
              es: async () => ({})
            }
          },
          taxonomies: {
            enabled: true,
            types: [
              {
                type: 'post_category',
                field: 'categories',
                multiple: undefined as unknown as boolean
              }
            ]
          },
          fields: []
        }

        const result = validateTaxonomiesConfig(config)

        expect(result.warnings).toContainEqual(
          expect.stringMatching(/no.*multiple.*property/i)
        )
      })

      it('should return multiple errors for multiple invalid types', () => {
        const config: EntityConfig = {
          slug: 'test',
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
              importExport: false
            }
          },
          permissions: { actions: [] },
          i18n: {
            fallbackLocale: 'en',
            loaders: {
              en: async () => ({}),
              es: async () => ({})
            }
          },
          taxonomies: {
            enabled: true,
            types: [
              {
                type: '',
                field: 'categories',
                multiple: true
              },
              {
                type: 'tag',
                field: '',
                multiple: true
              }
            ]
          },
          fields: []
        }

        const result = validateTaxonomiesConfig(config)

        expect(result.valid).toBe(false)
        expect(result.errors.length).toBeGreaterThanOrEqual(2)
      })
    })
  })

  // ============================================================================
  // getBuilderEntities
  // ============================================================================

  describe('getBuilderEntities', () => {
    it('should return entities with builder.enabled = true', () => {
      const registry: Record<string, EntityConfig> = {
        pages: {
          slug: 'pages',
          enabled: true,
          names: { singular: 'Page', plural: 'Pages' },
          icon: FileText,
          access: { public: true, api: true, metadata: false, shared: true },
          ui: {
            dashboard: { showInMenu: true, showInTopbar: true },
            public: { hasArchivePage: false, hasSinglePage: true },
            features: {
              searchable: true,
              sortable: true,
              filterable: false,
              bulkOperations: false,
              importExport: false
            }
          },
          permissions: { actions: [] },
          i18n: {
            fallbackLocale: 'en',
            loaders: {
              en: async () => ({}),
              es: async () => ({})
            }
          },
          builder: { enabled: true },
          fields: []
        },
        customers: {
          slug: 'customers',
          enabled: true,
          names: { singular: 'Customer', plural: 'Customers' },
          icon: FileText,
          access: { public: false, api: true, metadata: false, shared: false },
          ui: {
            dashboard: { showInMenu: true, showInTopbar: false },
            public: { hasArchivePage: false, hasSinglePage: false },
            features: {
              searchable: true,
              sortable: true,
              filterable: true,
              bulkOperations: true,
              importExport: true
            }
          },
          permissions: { actions: [] },
          i18n: {
            fallbackLocale: 'en',
            loaders: {
              en: async () => ({}),
              es: async () => ({})
            }
          },
          fields: []
        },
        posts: {
          slug: 'posts',
          enabled: true,
          names: { singular: 'Post', plural: 'Posts' },
          icon: FileText,
          access: { public: true, api: true, metadata: false, shared: true },
          ui: {
            dashboard: { showInMenu: true, showInTopbar: true },
            public: { hasArchivePage: true, hasSinglePage: true },
            features: {
              searchable: true,
              sortable: true,
              filterable: true,
              bulkOperations: false,
              importExport: false
            }
          },
          permissions: { actions: [] },
          i18n: {
            fallbackLocale: 'en',
            loaders: {
              en: async () => ({}),
              es: async () => ({})
            }
          },
          builder: { enabled: true },
          fields: []
        }
      }

      const result = getBuilderEntities(registry)

      expect(result).toHaveLength(2)
      expect(result.map(e => e.slug)).toContain('pages')
      expect(result.map(e => e.slug)).toContain('posts')
      expect(result.map(e => e.slug)).not.toContain('customers')
    })

    it('should return empty array when no entities have builder enabled', () => {
      const registry: Record<string, EntityConfig> = {
        customers: {
          slug: 'customers',
          enabled: true,
          names: { singular: 'Customer', plural: 'Customers' },
          icon: FileText,
          access: { public: false, api: true, metadata: false, shared: false },
          ui: {
            dashboard: { showInMenu: true, showInTopbar: false },
            public: { hasArchivePage: false, hasSinglePage: false },
            features: {
              searchable: true,
              sortable: true,
              filterable: true,
              bulkOperations: true,
              importExport: true
            }
          },
          permissions: { actions: [] },
          i18n: {
            fallbackLocale: 'en',
            loaders: {
              en: async () => ({}),
              es: async () => ({})
            }
          },
          fields: []
        },
        tasks: {
          slug: 'tasks',
          enabled: true,
          names: { singular: 'Task', plural: 'Tasks' },
          icon: FileText,
          access: { public: false, api: true, metadata: false, shared: false },
          ui: {
            dashboard: { showInMenu: true, showInTopbar: false },
            public: { hasArchivePage: false, hasSinglePage: false },
            features: {
              searchable: true,
              sortable: true,
              filterable: true,
              bulkOperations: false,
              importExport: false
            }
          },
          permissions: { actions: [] },
          i18n: {
            fallbackLocale: 'en',
            loaders: {
              en: async () => ({}),
              es: async () => ({})
            }
          },
          fields: []
        }
      }

      const result = getBuilderEntities(registry)

      expect(result).toHaveLength(0)
    })

    it('should return empty array for empty registry', () => {
      const registry: Record<string, EntityConfig> = {}

      const result = getBuilderEntities(registry)

      expect(result).toHaveLength(0)
    })

    it('should exclude entities with builder.enabled = false', () => {
      const registry: Record<string, EntityConfig> = {
        pages: {
          slug: 'pages',
          enabled: true,
          names: { singular: 'Page', plural: 'Pages' },
          icon: FileText,
          access: { public: true, api: true, metadata: false, shared: true },
          ui: {
            dashboard: { showInMenu: true, showInTopbar: true },
            public: { hasArchivePage: false, hasSinglePage: true },
            features: {
              searchable: true,
              sortable: true,
              filterable: false,
              bulkOperations: false,
              importExport: false
            }
          },
          permissions: { actions: [] },
          i18n: {
            fallbackLocale: 'en',
            loaders: {
              en: async () => ({}),
              es: async () => ({})
            }
          },
          builder: { enabled: true },
          fields: []
        },
        posts: {
          slug: 'posts',
          enabled: true,
          names: { singular: 'Post', plural: 'Posts' },
          icon: FileText,
          access: { public: true, api: true, metadata: false, shared: true },
          ui: {
            dashboard: { showInMenu: true, showInTopbar: true },
            public: { hasArchivePage: true, hasSinglePage: true },
            features: {
              searchable: true,
              sortable: true,
              filterable: true,
              bulkOperations: false,
              importExport: false
            }
          },
          permissions: { actions: [] },
          i18n: {
            fallbackLocale: 'en',
            loaders: {
              en: async () => ({}),
              es: async () => ({})
            }
          },
          builder: { enabled: false },
          fields: []
        }
      }

      const result = getBuilderEntities(registry)

      expect(result).toHaveLength(1)
      expect(result[0].slug).toBe('pages')
    })
  })

  // ============================================================================
  // matchPathToEntity
  // ============================================================================

  describe('matchPathToEntity', () => {
    const registry: Record<string, EntityConfig> = {
      pages: {
        slug: 'pages',
        enabled: true,
        names: { singular: 'Page', plural: 'Pages' },
        icon: FileText,
        access: { public: true, api: true, metadata: false, shared: true },
        ui: {
          dashboard: { showInMenu: true, showInTopbar: true },
          public: { hasArchivePage: false, hasSinglePage: true },
          features: {
            searchable: true,
            sortable: true,
            filterable: false,
            bulkOperations: false,
            importExport: false
          }
        },
        permissions: { actions: [] },
        i18n: {
          fallbackLocale: 'en',
          loaders: {
            en: async () => ({}),
            es: async () => ({})
          }
        },
        builder: {
          enabled: true,
          public: { basePath: '/' }
        },
        fields: []
      },
      posts: {
        slug: 'posts',
        enabled: true,
        names: { singular: 'Post', plural: 'Posts' },
        icon: FileText,
        access: { public: true, api: true, metadata: false, shared: true },
        ui: {
          dashboard: { showInMenu: true, showInTopbar: true },
          public: { hasArchivePage: true, hasSinglePage: true },
          features: {
            searchable: true,
            sortable: true,
            filterable: true,
            bulkOperations: false,
            importExport: false
          }
        },
        permissions: { actions: [] },
        i18n: {
          fallbackLocale: 'en',
          loaders: {
            en: async () => ({}),
            es: async () => ({})
          }
        },
        builder: {
          enabled: true,
          public: { basePath: '/blog' }
        },
        fields: []
      },
      docs: {
        slug: 'docs',
        enabled: true,
        names: { singular: 'Doc', plural: 'Docs' },
        icon: FileText,
        access: { public: true, api: true, metadata: false, shared: true },
        ui: {
          dashboard: { showInMenu: true, showInTopbar: false },
          public: { hasArchivePage: true, hasSinglePage: true },
          features: {
            searchable: true,
            sortable: true,
            filterable: false,
            bulkOperations: false,
            importExport: false
          }
        },
        permissions: { actions: [] },
        i18n: {
          fallbackLocale: 'en',
          loaders: {
            en: async () => ({}),
            es: async () => ({})
          }
        },
        builder: {
          enabled: true,
          public: { basePath: '/docs/guides' }
        },
        fields: []
      }
    }

    describe('Root Path Matching', () => {
      it('should match root path to pages entity', () => {
        const result = matchPathToEntity('/about', registry)

        expect(result).not.toBeNull()
        expect(result?.entity.slug).toBe('pages')
        expect(result?.slug).toBe('about')
      })

      it('should match single-segment path to pages entity', () => {
        const result = matchPathToEntity('/contact', registry)

        expect(result).not.toBeNull()
        expect(result?.entity.slug).toBe('pages')
        expect(result?.slug).toBe('contact')
      })

      it('should match slug with dashes to pages entity', () => {
        const result = matchPathToEntity('/about-us', registry)

        expect(result).not.toBeNull()
        expect(result?.entity.slug).toBe('pages')
        expect(result?.slug).toBe('about-us')
      })
    })

    describe('Blog Path Matching', () => {
      it('should match /blog path to posts entity', () => {
        const result = matchPathToEntity('/blog/my-post', registry)

        expect(result).not.toBeNull()
        expect(result?.entity.slug).toBe('posts')
        expect(result?.slug).toBe('my-post')
      })

      it('should match blog post with dashes', () => {
        const result = matchPathToEntity('/blog/hello-world-2024', registry)

        expect(result).not.toBeNull()
        expect(result?.entity.slug).toBe('posts')
        expect(result?.slug).toBe('hello-world-2024')
      })
    })

    describe('Nested Path Matching', () => {
      it('should match nested path to docs entity (longest match wins)', () => {
        const result = matchPathToEntity('/docs/guides/getting-started', registry)

        expect(result).not.toBeNull()
        expect(result?.entity.slug).toBe('docs')
        expect(result?.slug).toBe('getting-started')
      })

      it('should use longest match strategy', () => {
        // If we had both /docs and /docs/guides as basePaths,
        // /docs/guides/foo should match /docs/guides (longer)
        const result = matchPathToEntity('/docs/guides/installation', registry)

        expect(result).not.toBeNull()
        expect(result?.entity.slug).toBe('docs')
      })
    })

    describe('No Match', () => {
      it('should return null for unmatched paths', () => {
        const result = matchPathToEntity('/api/test', registry)

        expect(result).toBeNull()
      })

      it('should return null for multi-segment path when expecting single', () => {
        const result = matchPathToEntity('/about/team', registry)

        expect(result).toBeNull()
      })

      it('should return archive match for /blog without slug', () => {
        const result = matchPathToEntity('/blog', registry)

        expect(result).not.toBeNull()
        expect(result?.entity.slug).toBe('posts')
        expect(result?.slug).toBe('')
        expect(result?.isArchive).toBe(true)
      })

      it('should return null for empty path', () => {
        const result = matchPathToEntity('', registry)

        expect(result).toBeNull()
      })

      it('should return archive match for just / when pages entity has basePath /', () => {
        // When pages entity has basePath '/', the root path matches as archive
        const result = matchPathToEntity('/', registry)

        expect(result).not.toBeNull()
        expect(result?.entity.slug).toBe('pages')
        expect(result?.isArchive).toBe(true)
        expect(result?.slug).toBe('')
      })
    })

    describe('access.basePath (New Location)', () => {
      it('should match path using access.basePath', () => {
        const registryWithAccessBasePath: Record<string, EntityConfig> = {
          pages: {
            slug: 'pages',
            enabled: true,
            names: { singular: 'Page', plural: 'Pages' },
            icon: FileText,
            access: { public: true, api: true, metadata: false, shared: true, basePath: '/' },
            ui: {
              dashboard: { showInMenu: true, showInTopbar: true },
              public: { hasArchivePage: false, hasSinglePage: true },
              features: {
                searchable: true,
                sortable: true,
                filterable: false,
                bulkOperations: false,
                importExport: false
              }
            },
            permissions: { actions: [] },
            i18n: {
              fallbackLocale: 'en',
              loaders: {
                en: async () => ({}),
                es: async () => ({})
              }
            },
            builder: { enabled: true },
            fields: []
          },
          posts: {
            slug: 'posts',
            enabled: true,
            names: { singular: 'Post', plural: 'Posts' },
            icon: FileText,
            access: { public: true, api: true, metadata: false, shared: true, basePath: '/blog' },
            ui: {
              dashboard: { showInMenu: true, showInTopbar: true },
              public: { hasArchivePage: true, hasSinglePage: true },
              features: {
                searchable: true,
                sortable: true,
                filterable: true,
                bulkOperations: false,
                importExport: false
              }
            },
            permissions: { actions: [] },
            i18n: {
              fallbackLocale: 'en',
              loaders: {
                en: async () => ({}),
                es: async () => ({})
              }
            },
            builder: { enabled: true },
            fields: []
          }
        }

        const result = matchPathToEntity('/blog/my-post', registryWithAccessBasePath)

        expect(result).not.toBeNull()
        expect(result?.entity.slug).toBe('posts')
        expect(result?.slug).toBe('my-post')
      })

      it('should prefer access.basePath over builder.public.basePath', () => {
        const registryWithBoth: Record<string, EntityConfig> = {
          pages: {
            slug: 'pages',
            enabled: true,
            names: { singular: 'Page', plural: 'Pages' },
            icon: FileText,
            access: { public: true, api: true, metadata: false, shared: true, basePath: '/pages' },
            ui: {
              dashboard: { showInMenu: true, showInTopbar: true },
              public: { hasArchivePage: false, hasSinglePage: true },
              features: {
                searchable: true,
                sortable: true,
                filterable: false,
                bulkOperations: false,
                importExport: false
              }
            },
            permissions: { actions: [] },
            i18n: {
              fallbackLocale: 'en',
              loaders: {
                en: async () => ({}),
                es: async () => ({})
              }
            },
            builder: {
              enabled: true,
              public: { basePath: '/' } // Should be ignored in favor of access.basePath
            },
            fields: []
          }
        }

        // Should NOT match /about since access.basePath is /pages
        const rootResult = matchPathToEntity('/about', registryWithBoth)
        expect(rootResult).toBeNull()

        // Should match /pages/about
        const pagesResult = matchPathToEntity('/pages/about', registryWithBoth)
        expect(pagesResult).not.toBeNull()
        expect(pagesResult?.entity.slug).toBe('pages')
        expect(pagesResult?.slug).toBe('about')
      })
    })

    describe('Edge Cases', () => {
      it('should handle entity without builder.public config', () => {
        const registryWithoutPublic: Record<string, EntityConfig> = {
          pages: {
            slug: 'pages',
            enabled: true,
            names: { singular: 'Page', plural: 'Pages' },
            icon: FileText,
            access: { public: true, api: true, metadata: false, shared: true },
            ui: {
              dashboard: { showInMenu: true, showInTopbar: true },
              public: { hasArchivePage: false, hasSinglePage: true },
              features: {
                searchable: true,
                sortable: true,
                filterable: false,
                bulkOperations: false,
                importExport: false
              }
            },
            permissions: { actions: [] },
            i18n: {
              fallbackLocale: 'en',
              loaders: {
                en: async () => ({}),
                es: async () => ({})
              }
            },
            builder: { enabled: true }, // No public config
            fields: []
          }
        }

        const result = matchPathToEntity('/about', registryWithoutPublic)

        expect(result).toBeNull()
      })

      it('should handle registry with no builder entities', () => {
        const nonBuilderRegistry: Record<string, EntityConfig> = {
          customers: {
            slug: 'customers',
            enabled: true,
            names: { singular: 'Customer', plural: 'Customers' },
            icon: FileText,
            access: { public: false, api: true, metadata: false, shared: false },
            ui: {
              dashboard: { showInMenu: true, showInTopbar: false },
              public: { hasArchivePage: false, hasSinglePage: false },
              features: {
                searchable: true,
                sortable: true,
                filterable: true,
                bulkOperations: true,
                importExport: true
              }
            },
            permissions: { actions: [] },
            i18n: {
              fallbackLocale: 'en',
              loaders: {
                en: async () => ({}),
                es: async () => ({})
              }
            },
            fields: []
          }
        }

        const result = matchPathToEntity('/about', nonBuilderRegistry)

        expect(result).toBeNull()
      })

      it('should handle empty registry', () => {
        const emptyRegistry: Record<string, EntityConfig> = {}

        const result = matchPathToEntity('/about', emptyRegistry)

        expect(result).toBeNull()
      })
    })
  })
})
