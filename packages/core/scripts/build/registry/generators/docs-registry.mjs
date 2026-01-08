/**
 * Docs Registry Generator
 *
 * Generates docs-registry.ts with stub implementations.
 * The actual docs content is generated separately by docs-registry.mjs
 * when documentation exists. This stub ensures the build doesn't fail
 * when no docs are present.
 *
 * @module core/scripts/build/registry/generators/docs-registry
 */

/**
 * Generate the docs registry stub file
 *
 * @returns {string} Generated TypeScript content
 */
export function generateDocsRegistry() {
  return `/**
 * Auto-generated Docs Registry
 *
 * Generated at: ${new Date().toISOString()}
 *
 * This file provides stub implementations for the docs registry.
 * When documentation exists, this is overwritten by the full docs-registry builder.
 *
 * DO NOT EDIT - This file is auto-generated
 */

// Type definitions
export interface DocPageMeta {
  slug: string
  title: string
  description?: string
  path: string
  order: number
}

export interface DocSectionMeta {
  slug: string
  title: string
  description?: string
  icon?: string
  order: number
  pages: DocPageMeta[]
}

export interface DocsRegistryStructure {
  public: DocSectionMeta[]
  superadmin: DocSectionMeta[]
}

// Registry Data
export const DOCS_REGISTRY: DocsRegistryStructure = {
  public: [],
  superadmin: []
}

// Registry Access Functions
export function getAllDocSections(): DocSectionMeta[] {
  return [...DOCS_REGISTRY.public, ...DOCS_REGISTRY.superadmin]
}

export function getPublicDocSections(): DocSectionMeta[] {
  return DOCS_REGISTRY.public
}

export function getSuperadminDocSections(): DocSectionMeta[] {
  return DOCS_REGISTRY.superadmin
}

export function findDocSection(slug: string): DocSectionMeta | undefined {
  return getAllDocSections().find(section => section.slug === slug)
}

export function findDocSectionInCategory(
  slug: string,
  category: 'public' | 'superadmin'
): DocSectionMeta | undefined {
  return DOCS_REGISTRY[category].find(section => section.slug === slug)
}

export function findDocPage(
  sectionSlug: string,
  pageSlug: string
): DocPageMeta | undefined {
  const section = findDocSection(sectionSlug)
  return section?.pages.find(page => page.slug === pageSlug)
}
`
}
