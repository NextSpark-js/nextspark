/**
 * Documentation Registry Types
 *
 * Type definitions for the documentation registry system.
 * Used by the auto-generated docs-registry.ts file.
 */

export interface DocPageMeta {
  slug: string
  title: string
  order: number
  path: string
  source: 'core' | 'theme' | 'plugin'
}

export interface DocSectionMeta {
  title: string
  slug: string
  order: number
  pages: DocPageMeta[]
  source: 'core' | 'theme' | 'plugin'
  pluginName?: string
}

export interface DocsRegistryStructure {
  core: DocSectionMeta[]
  theme: DocSectionMeta[]
  plugins: DocSectionMeta[]
  all: DocSectionMeta[]
}
