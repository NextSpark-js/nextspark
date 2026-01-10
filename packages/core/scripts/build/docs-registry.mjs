#!/usr/bin/env node

/**
 * Documentation Registry Builder
 *
 * Scans contents/themes/{THEME}/docs/public/ and docs/superadmin/ directories
 * Generates static registry at .nextspark/registries/docs-registry.ts
 *
 * Structure:
 * - public: User-facing documentation → /docs
 * - superadmin: Admin documentation → /superadmin/docs
 *
 * NOTE: Plugin docs are NOT included - they are for developer reference only (IDE/LLM).
 *
 * ZERO RUNTIME I/O - Build-time only
 * Part of the registry system
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { existsSync, mkdirSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Detect project root by searching for nextspark.config.ts or apps/dev
 * Excludes node_modules paths to avoid finding pnpm internal workspaces
 */
function detectProjectRoot() {
  // Check for explicit project root from CLI
  if (process.env.NEXTSPARK_PROJECT_ROOT) {
    return process.env.NEXTSPARK_PROJECT_ROOT
  }

  let dir = process.cwd()
  const maxDepth = 10
  let depth = 0

  // Search upward for nextspark.config.ts (NPM mode) or apps/dev (monorepo)
  while (dir !== '/' && depth < maxDepth) {
    // Skip if we're inside node_modules
    if (dir.includes('node_modules')) {
      dir = path.dirname(dir)
      depth++
      continue
    }

    // Primary: nextspark.config.ts (NPM mode projects)
    if (existsSync(path.join(dir, 'nextspark.config.ts'))) {
      return dir
    }
    // Secondary: monorepo with apps/dev (development mode)
    if (existsSync(path.join(dir, 'apps/dev'))) {
      return path.join(dir, 'apps/dev')
    }
    // Tertiary: pnpm-workspace.yaml at root (monorepo without apps/dev)
    if (existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
      return dir
    }
    dir = path.dirname(dir)
    depth++
  }

  // Fallback: from packages/core/scripts/build/ to project root (4 levels up)
  return path.join(__dirname, '../../../..')
}

/**
 * Check if NextSpark is installed as a package
 */
function isInstalledAsPackage(root) {
  return existsSync(path.join(root, 'node_modules/@nextsparkjs/core'))
}

// Get project root from environment or detect it
const PROJECT_ROOT = process.env.NEXTSPARK_PROJECT_ROOT || detectProjectRoot()
const IS_NPM_MODE = isInstalledAsPackage(PROJECT_ROOT)

console.log(`📚 Building docs registry...`)
console.log(`   Project root: ${PROJECT_ROOT}`)
console.log(`   Mode: ${IS_NPM_MODE ? 'NPM' : 'Monorepo'}`)

// Paths - themes directory
// In NPM mode: contents/themes
// In Monorepo mode: themes/ (directly in root)
const THEMES_DIR = IS_NPM_MODE
  ? path.join(PROJECT_ROOT, 'contents/themes')
  : path.join(PROJECT_ROOT, 'themes')

const OUTPUT_DIR = path.join(PROJECT_ROOT, '.nextspark/registries')

// For backward compatibility, ROOT_DIR is the project root
const ROOT_DIR = PROJECT_ROOT

// Path prefix for registry entries
// In monorepo mode, registry is consumed from apps/dev, so paths need ../../ prefix
// In NPM mode, registry is consumed from project root, so paths start with /
const PATH_PREFIX = IS_NPM_MODE ? '' : '../..'

/**
 * Scan a documentation directory and build registry metadata
 *
 * @param {string} docsPath - Absolute path to docs directory
 * @param {'public' | 'superadmin'} source - Source type
 * @returns {Array} Array of section metadata
 */
function scanDocsDirectory(docsPath, source) {
  if (!fs.existsSync(docsPath)) {
    console.log(`   No docs found at: ${docsPath}`)
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
      // In monorepo: apps/dev needs ../../themes/... to reach themes/
      // In NPM: project root uses /contents/themes/... directly
      const relativePath = PATH_PREFIX + filePath.replace(ROOT_DIR, '')

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
 * Build the documentation registry
 */
async function buildDocsRegistry() {
  const activeTheme = process.env.NEXT_PUBLIC_ACTIVE_THEME || 'default'
  console.log(`   Active theme: ${activeTheme}`)

  const themeDocsDir = path.join(THEMES_DIR, activeTheme, 'docs')

  // Scan public docs (user-facing → /docs)
  const publicDocs = scanDocsDirectory(
    path.join(themeDocsDir, 'public'),
    'public'
  )
  console.log(`   Public sections: ${publicDocs.length}`)

  // Scan superadmin docs (admin-facing → /superadmin/docs)
  const superadminDocs = scanDocsDirectory(
    path.join(themeDocsDir, 'superadmin'),
    'superadmin'
  )
  console.log(`   Superadmin sections: ${superadminDocs.length}`)

  // Create registry (public + superadmin, no plugins)
  const registry = {
    public: publicDocs,
    superadmin: superadminDocs,
    all: [...publicDocs, ...superadminDocs].sort((a, b) => a.order - b.order)
  }

  // Total pages count
  const publicPages = publicDocs.reduce((sum, section) => sum + section.pages.length, 0)
  const superadminPages = superadminDocs.reduce((sum, section) => sum + section.pages.length, 0)
  const totalPages = publicPages + superadminPages
  console.log(`   Public pages: ${publicPages}`)
  console.log(`   Superadmin pages: ${superadminPages}`)
  console.log(`   Total pages: ${totalPages}`)

  // Generate TypeScript registry file
  const registryContent = `/**
 * Auto-generated Documentation Registry
 *
 * Generated at: ${new Date().toISOString()}
 * Public sections: ${publicDocs.length}
 * Superadmin sections: ${superadminDocs.length}
 * Total pages: ${totalPages}
 *
 * Structure:
 * - public: User-facing documentation → /docs
 * - superadmin: Admin documentation → /superadmin/docs
 *
 * NOTE: Plugin docs are NOT included - they are for developer reference only (IDE/LLM).
 *
 * DO NOT EDIT - This file is auto-generated by scripts/build/docs-registry.mjs
 */

import type { DocPageMeta, DocSectionMeta, DocsRegistryStructure } from '@nextsparkjs/core/types/docs'

// Re-export types for external use
export type { DocPageMeta, DocSectionMeta, DocsRegistryStructure }

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

  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  // Write registry file
  const registryPath = path.join(OUTPUT_DIR, 'docs-registry.ts')
  fs.writeFileSync(registryPath, registryContent, 'utf-8')

  console.log('✅ Docs registry built successfully')
  console.log(`   Output: .nextspark/registries/docs-registry.ts`)
}

// Run build
buildDocsRegistry().catch(error => {
  console.error('❌ Error building docs registry:', error)
  process.exit(1)
})
