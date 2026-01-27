/**
 * Docs Registry Generator
 *
 * Generates docs-registry.ts with actual documentation content.
 * Scans themes/{THEME}/docs/public/ and docs/superadmin/ directories.
 *
 * @module core/scripts/build/registry/generators/docs-registry
 */

import fs from 'fs'
import path from 'path'
import { existsSync } from 'fs'
import { CONFIG } from '../config.mjs'

// Get config values - use themesDir which correctly handles monorepo mode
const projectRoot = CONFIG.projectRoot
const monorepoRoot = CONFIG.monorepoRoot
const isNpmMode = CONFIG.isNpmMode
const isMonorepoMode = CONFIG.isMonorepoMode

// Themes directory - use CONFIG.themesDir for correct monorepo/npm mode handling
const THEMES_DIR = CONFIG.themesDir

/**
 * Extract order number from filename (01-example -> 1)
 */
function extractOrder(name) {
  const match = name.match(/^(\d+)-/)
  return match ? parseInt(match[1], 10) : 999
}

/**
 * Clean filename (01-example.md -> example)
 */
function cleanName(name) {
  return name.replace(/^\d+-/, '').replace(/\.md$/, '')
}

/**
 * Convert slug to title (getting-started -> Getting Started)
 */
function slugToTitle(slug) {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Scan a documentation directory and build registry metadata
 *
 * @param {string} docsPath - Absolute path to docs directory
 * @param {'public' | 'superadmin'} source - Source type
 * @returns {Array} Array of section metadata
 */
function scanDocsDirectory(docsPath, source) {
  if (!existsSync(docsPath)) {
    return []
  }

  const sections = []
  const items = fs.readdirSync(docsPath, { withFileTypes: true })

  for (const item of items) {
    if (!item.isDirectory()) continue

    const sectionPath = path.join(docsPath, item.name)
    const order = extractOrder(item.name)
    const slug = cleanName(item.name)
    const title = slugToTitle(slug)

    const pages = []
    const files = fs.readdirSync(sectionPath)

    for (const file of files) {
      if (!file.endsWith('.md')) continue

      const filePath = path.join(sectionPath, file)
      const fileOrder = extractOrder(file)
      const pageSlug = cleanName(file)
      const pageTitle = slugToTitle(pageSlug)

      // Get relative path from consuming app directory
      // In monorepo mode: calculate relative from projectRoot (apps/dev) to file in themes/
      // In npm mode: calculate relative from projectRoot to file in contents/themes/
      let relativePath
      if (isMonorepoMode && monorepoRoot) {
        // In monorepo, themes are at monorepoRoot/themes/
        // projectRoot is apps/dev, so we need ../../themes/...
        const themeRelativePath = filePath.replace(monorepoRoot, '')
        relativePath = '../..' + themeRelativePath
      } else {
        // In npm mode, themes are at projectRoot/contents/themes/
        relativePath = filePath.replace(projectRoot, '')
      }

      pages.push({
        slug: pageSlug,
        title: pageTitle,
        order: fileOrder,
        path: relativePath,
        source
      })
    }

    // Sort pages by order
    pages.sort((a, b) => a.order - b.order)

    sections.push({
      title,
      slug,
      order,
      pages,
      source
    })
  }

  // Sort sections by order
  return sections.sort((a, b) => a.order - b.order)
}

/**
 * Generate the docs registry file with actual content
 *
 * @returns {string} Generated TypeScript content
 */
export function generateDocsRegistry() {
  const theme = CONFIG.activeTheme || 'default'
  const themeDocsDir = path.join(THEMES_DIR, theme, 'docs')

  // Scan public docs (user-facing → /docs)
  const publicDocs = scanDocsDirectory(
    path.join(themeDocsDir, 'public'),
    'public'
  )

  // Scan superadmin docs (admin-facing → /superadmin/docs)
  const superadminDocs = scanDocsDirectory(
    path.join(themeDocsDir, 'superadmin'),
    'superadmin'
  )

  // Create registry
  const registry = {
    public: publicDocs,
    superadmin: superadminDocs,
    all: [...publicDocs, ...superadminDocs].sort((a, b) => a.order - b.order)
  }

  // Total pages count
  const publicPages = publicDocs.reduce((sum, section) => sum + section.pages.length, 0)
  const superadminPages = superadminDocs.reduce((sum, section) => sum + section.pages.length, 0)
  const totalPages = publicPages + superadminPages

  return `/**
 * Auto-generated Documentation Registry
 *
 * Generated at: ${new Date().toISOString()}
 * Theme: ${theme}
 * Public sections: ${publicDocs.length}
 * Superadmin sections: ${superadminDocs.length}
 * Total pages: ${totalPages}
 *
 * Structure:
 * - public: User-facing documentation → /docs
 * - superadmin: Admin documentation → /superadmin/docs
 *
 * DO NOT EDIT - This file is auto-generated
 */

// Inline type definitions for npm mode (avoids import issues since DTS is disabled)
export interface DocPageMeta {
  slug: string
  title: string
  order: number
  path: string
  source: 'public' | 'superadmin'
}

export interface DocSectionMeta {
  slug: string
  title: string
  order: number
  pages: DocPageMeta[]
  source: 'public' | 'superadmin'
}

export interface DocsRegistryStructure {
  public: DocSectionMeta[]
  superadmin: DocSectionMeta[]
  all: DocSectionMeta[]
}

export const DOCS_REGISTRY: DocsRegistryStructure = ${JSON.stringify(registry, null, 2)} as const

export type DocsRegistry = typeof DOCS_REGISTRY

/**
 * Get all documentation sections (public + superadmin)
 */
export function getAllDocSections(): DocSectionMeta[] {
  return DOCS_REGISTRY.all
}

/**
 * Get public documentation sections only (for /docs)
 */
export function getPublicDocSections(): DocSectionMeta[] {
  return DOCS_REGISTRY.public
}

/**
 * Get superadmin documentation sections only (for /superadmin/docs)
 */
export function getSuperadminDocSections(): DocSectionMeta[] {
  return DOCS_REGISTRY.superadmin
}

/**
 * Find a section by slug
 */
export function findDocSection(slug: string): DocSectionMeta | undefined {
  return DOCS_REGISTRY.all.find(section => section.slug === slug)
}

/**
 * Find a section by slug in a specific category
 */
export function findDocSectionInCategory(slug: string, category: 'public' | 'superadmin'): DocSectionMeta | undefined {
  return DOCS_REGISTRY[category].find(section => section.slug === slug)
}

/**
 * Find a page within a section
 */
export function findDocPage(sectionSlug: string, pageSlug: string): DocPageMeta | undefined {
  const section = findDocSection(sectionSlug)
  return section?.pages.find(page => page.slug === pageSlug)
}
`
}
