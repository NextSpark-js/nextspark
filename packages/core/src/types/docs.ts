/**
 * Documentation Registry Types
 *
 * Type definitions for the documentation registry system.
 * Used by the auto-generated docs-registry.ts file.
 *
 * Structure:
 * - public: User-facing documentation → /docs
 * - superadmin: Admin documentation → /superadmin/docs
 *
 * NOTE: Plugin docs are NOT included in the registry - they are for developer
 * reference only (IDE/LLM). End users see public documentation at /docs routes.
 */

export interface DocPageMeta {
  slug: string
  title: string
  order: number
  path: string
  source: 'public' | 'superadmin'
}

export interface DocSectionMeta {
  title: string
  slug: string
  order: number
  pages: DocPageMeta[]
  source: 'public' | 'superadmin'
}

export interface DocsRegistryStructure {
  public: DocSectionMeta[]
  superadmin: DocSectionMeta[]
  all: DocSectionMeta[]
}
