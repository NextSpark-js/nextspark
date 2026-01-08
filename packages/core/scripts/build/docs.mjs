#!/usr/bin/env node

/**
 * Documentation Registry Builder
 *
 * Scans core/docs/, contents/themes/{THEME}/docs/, and plugin docs directories
 * Generates static registry at .nextspark/registries/docs-registry.ts (npm) or core/lib/registries/docs-registry.ts (monorepo)
 *
 * ZERO RUNTIME I/O - Build-time only
 * Part of the registry system (see .rules/dynamic-imports.md)
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { existsSync, mkdirSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Detect project root by searching for nextspark.config.ts
 */
function detectProjectRoot() {
  let dir = process.cwd()
  const maxDepth = 10
  let depth = 0

  while (dir !== '/' && depth < maxDepth) {
    if (existsSync(path.join(dir, 'nextspark.config.ts'))) {
      return dir
    }
    dir = path.dirname(dir)
    depth++
  }

  return process.cwd()
}

/**
 * Check if NextSpark is installed as a package
 */
function isInstalledAsPackage(root) {
  return existsSync(path.join(root, 'node_modules/@nextsparkjs/core'))
}

// Determine project root and mode
const PROJECT_ROOT = detectProjectRoot()
const IS_NPM_MODE = isInstalledAsPackage(PROJECT_ROOT)

// Paths based on mode
const CORE_DIR = IS_NPM_MODE
  ? path.join(PROJECT_ROOT, 'node_modules/@nextsparkjs/core')
  : path.join(PROJECT_ROOT, 'packages/core')

const CONTENTS_DIR = path.join(PROJECT_ROOT, 'contents')

const OUTPUT_DIR = IS_NPM_MODE
  ? path.join(PROJECT_ROOT, '.nextspark/registries')
  : path.join(PROJECT_ROOT, 'packages/core/src/lib/registries')

// For backward compatibility, ROOT_DIR is the project root
const ROOT_DIR = PROJECT_ROOT

/**
 * Scan a documentation directory and build registry metadata
 *
 * @param {string} docsPath - Absolute path to docs directory
 * @param {'core' | 'theme'} source - Source type
 * @returns {Array} Array of section metadata
 */
function scanDocsDirectory(docsPath, source) {
  if (!fs.existsSync(docsPath)) {
    console.log(`📄 No docs found at: ${docsPath}`)
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

      // Get relative path from project root
      const relativePath = filePath.replace(ROOT_DIR, '')

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
 * Get active plugins from theme configuration
 */
function getActiveThemePlugins(activeTheme) {
  const themeConfigPath = path.join(CONTENTS_DIR, 'themes', activeTheme, 'theme.config.ts')

  try {
    const configContent = fs.readFileSync(themeConfigPath, 'utf8')

    // Extract plugin dependencies from theme config
    const pluginsMatch = configContent.match(/plugins:\s*\[([^\]]+)\]/)
    const plugins = pluginsMatch
      ? pluginsMatch[1].split(',').map(p => p.trim().replace(/['"]/g, '')).filter(Boolean)
      : []

    return plugins
  } catch (error) {
    console.log(`   Warning: Could not read theme config: ${error.message}`)
    return []
  }
}

/**
 * Read app config to check if plugin docs should be shown in production
 */
function shouldShowPluginDocsInProd(activeTheme) {
  const appConfigPath = path.join(CONTENTS_DIR, 'themes', activeTheme, 'app.config.ts')

  try {
    const configContent = fs.readFileSync(appConfigPath, 'utf8')

    // Look for showPluginsDocsInProd setting
    const match = configContent.match(/showPluginsDocsInProd:\s*(true|false)/)
    if (match) {
      return match[1] === 'true'
    }

    // Default to false if not found
    return false
  } catch (error) {
    console.log(`   Warning: Could not read app config: ${error.message}`)
    return false
  }
}

/**
 * Scan plugin docs directories for all active plugins
 */
function scanPluginDocs(activePlugins) {
  const allPluginDocs = []

  for (const pluginName of activePlugins) {
    const pluginDocsPath = path.join(CONTENTS_DIR, 'plugins', pluginName, 'docs')

    if (!fs.existsSync(pluginDocsPath)) {
      continue
    }

    const sections = scanDocsDirectory(pluginDocsPath, 'plugin')

    // Add plugin context to each section
    for (const section of sections) {
      section.pluginName = pluginName
      allPluginDocs.push(section)
    }
  }

  return allPluginDocs
}

/**
 * Build the documentation registry
 */
async function buildDocsRegistry() {
  console.log('📚 Building documentation registry...')

  const activeTheme = process.env.NEXT_PUBLIC_ACTIVE_THEME || 'default'
  console.log(`   Active theme: ${activeTheme}`)

  // Scan core docs
  const coreDocsPath = IS_NPM_MODE
    ? path.join(CORE_DIR, 'docs')
    : path.join(ROOT_DIR, 'packages/core/docs')
  const coreDocs = scanDocsDirectory(coreDocsPath, 'core')
  console.log(`   Core sections: ${coreDocs.length}`)

  // Scan theme docs
  const themeDocs = scanDocsDirectory(
    path.join(CONTENTS_DIR, `themes/${activeTheme}/docs`),
    'theme'
  )
  console.log(`   Theme sections: ${themeDocs.length}`)

  // Scan plugin docs (conditionally based on environment and config)
  const isProd = process.env.NODE_ENV === 'production'
  const showPluginDocsInProd = shouldShowPluginDocsInProd(activeTheme)
  const shouldIncludePluginDocs = !isProd || showPluginDocsInProd

  let pluginDocs = []
  if (shouldIncludePluginDocs) {
    const activePlugins = getActiveThemePlugins(activeTheme)
    console.log(`   Active plugins: [${activePlugins.join(', ')}]`)

    pluginDocs = scanPluginDocs(activePlugins)
    console.log(`   Plugin sections: ${pluginDocs.length}`)

    if (pluginDocs.length > 0) {
      const pluginPages = pluginDocs.reduce((sum, section) => sum + section.pages.length, 0)
      console.log(`   Plugin pages: ${pluginPages}`)
    }
  } else {
    console.log(`   Plugin docs: EXCLUDED (production + showPluginsDocsInProd: false)`)
  }

  // Merge and create registry
  const registry = {
    core: coreDocs,
    theme: themeDocs,
    plugins: pluginDocs,
    all: [...coreDocs, ...themeDocs, ...pluginDocs].sort((a, b) => a.order - b.order)
  }

  // Total pages count
  const totalPages = registry.all.reduce((sum, section) => sum + section.pages.length, 0)
  console.log(`   Total pages: ${totalPages}`)

  // Generate TypeScript registry file
  const registryContent = `// AUTO-GENERATED by scripts/build-docs-registry.mjs
// DO NOT EDIT MANUALLY
// Run \`pnpm docs:build\` to regenerate

/**
 * Documentation Registry - Build-Time Generated
 *
 * Contains metadata about all documentation sections and pages
 * from core/, theme/, and active plugin directories.
 *
 * ZERO RUNTIME I/O - All data resolved at build time
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

export const DOCS_REGISTRY: DocsRegistryStructure = ${JSON.stringify(registry, null, 2)} as const

export type DocsRegistry = typeof DOCS_REGISTRY

/**
 * Get all documentation sections (core + theme)
 */
export function getAllDocSections(): DocSectionMeta[] {
  return DOCS_REGISTRY.all
}

/**
 * Get core documentation sections only
 */
export function getCoreDocSections(): DocSectionMeta[] {
  return DOCS_REGISTRY.core
}

/**
 * Get theme documentation sections only
 */
export function getThemeDocSections(): DocSectionMeta[] {
  return DOCS_REGISTRY.theme
}

/**
 * Get plugin documentation sections only
 */
export function getPluginDocSections(): DocSectionMeta[] {
  return DOCS_REGISTRY.plugins
}

/**
 * Get documentation sections for a specific plugin
 */
export function getPluginDocSectionsByName(pluginName: string): DocSectionMeta[] {
  return DOCS_REGISTRY.plugins.filter(section => section.pluginName === pluginName)
}

/**
 * Find a section by slug
 */
export function findDocSection(slug: string): DocSectionMeta | undefined {
  return DOCS_REGISTRY.all.find(section => section.slug === slug)
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
  const relativePath = IS_NPM_MODE
    ? '.nextspark/registries/docs-registry.ts'
    : 'packages/core/src/lib/registries/docs-registry.ts'
  console.log(`   Output: ${relativePath}`)
}

// Run build
buildDocsRegistry().catch(error => {
  console.error('❌ Error building docs registry:', error)
  process.exit(1)
})
