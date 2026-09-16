/**
 * Template Discovery
 *
 * Discovers template overrides from themes
 *
 * @module core/scripts/build/registry/discovery/templates
 */

import { readdir, stat, readFile, access } from 'fs/promises'
import { join } from 'path'

import { CONFIG as DEFAULT_CONFIG } from '../config.mjs'
import { log, verbose, extractTemplateMetadata } from '../../../utils/index.mjs'
import {
  getProtectionLevel,
  ProtectionLevel
} from '../../../../dist/config/protected-paths.js'

/**
 * Discover all templates across themes
 * @param {object} config - Optional configuration object (defaults to DEFAULT_CONFIG)
 * @returns {Promise<Array>} Array of discovered templates
 */
export async function discoverTemplates(config = DEFAULT_CONFIG) {
  log('Discovering template overrides...', 'info')
  const themesDir = config.themesDir
  const templates = []

  // REQUIRED: Active theme must be specified
  if (!config.activeTheme) {
    const errorMsg = `
╔══════════════════════════════════════════════════════════════════════════════╗
║  ERROR: NEXT_PUBLIC_ACTIVE_THEME is not set                                  ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  The template registry requires an active theme to be specified.             ║
║  Without this, templates from ALL themes would be registered, which          ║
║  causes incorrect behavior (e.g., CRM layout used for default theme).        ║
║                                                                              ║
║  To fix this, run the registry build with the theme specified:               ║
║                                                                              ║
║    NEXT_PUBLIC_ACTIVE_THEME=default node core/scripts/build/registry.mjs    ║
║                                                                              ║
║  Or ensure your .env file has NEXT_PUBLIC_ACTIVE_THEME set correctly.        ║
╚══════════════════════════════════════════════════════════════════════════════╝
`
    for (const line of errorMsg.split('\n')) console.error(line)
    throw new Error('NEXT_PUBLIC_ACTIVE_THEME environment variable is required for template discovery')
  }

  // Process only the active theme templates
  verbose(`Processing templates only for active theme: ${config.activeTheme}`)

  const themeName = config.activeTheme
  const templatesPath = join(themesDir, themeName, 'templates')

  // Check if active theme has templates directory
  try {
    await stat(templatesPath)
    verbose(`Scanning templates in theme: ${themeName}`)

    const themeTemplates = await discoverThemeTemplates(templatesPath, themeName)
    templates.push(...themeTemplates)

    if (themeTemplates.length > 0) {
      verbose(`Found ${themeTemplates.length} templates in active theme ${themeName}`)
    }
  } catch {
    // No templates directory in active theme
    verbose(`No templates directory in active theme: ${themeName}`)
  }

  return templates
}

/**
 * Recursively discover template files within a theme's templates directory
 * @param {string} templatesPath - Path to the templates directory
 * @param {string} themeName - Name of the theme
 * @param {string} relativePath - Relative path from templates root
 * @returns {Promise<Array>} Array of discovered templates
 */
export async function discoverThemeTemplates(templatesPath, themeName, relativePath = '') {
  const templates = []

  try {
    const entries = await readdir(templatesPath, { withFileTypes: true })

    for (const entry of entries) {
      const currentPath = join(templatesPath, entry.name)
      const currentRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name

      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        const nestedTemplates = await discoverThemeTemplates(currentPath, themeName, currentRelativePath)
        templates.push(...nestedTemplates)
      } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
        // Skip barrel/index files - these are re-export files, not templates
        if (entry.name === 'index.ts' || entry.name === 'index.tsx') {
          verbose(`Skipping barrel file: ${currentRelativePath}`)
          continue
        }

        // Handle .meta.ts files: skip if companion .tsx exists (handled there),
        // otherwise register as standalone metadata-only template
        if (entry.name.endsWith('.meta.ts')) {
          const companionTsx = entry.name.replace('.meta.ts', '.tsx')
          const companionTs = entry.name.replace('.meta.ts', '.ts')
          const hasTsxCompanion = entries.some(e => e.name === companionTsx)
          const hasTsCompanion = entries.some(e => e.name === companionTs && !e.name.endsWith('.meta.ts'))

          if (hasTsxCompanion || hasTsCompanion) {
            verbose(`Skipping meta file (companion exists): ${currentRelativePath}`)
            continue
          }

          // Standalone .meta.ts — register as metadata-only template
          const baseFileName = entry.name.replace('.meta.ts', '.tsx')
          const appPath = relativePath ? `app/${relativePath}/${baseFileName}` : `app/${baseFileName}`
          const templatePath = `@/contents/themes/${themeName}/templates/${currentRelativePath}`
          const templateMetadata = await extractTemplateMetadata(currentPath)

          if (templateMetadata) {
            verbose(`Standalone metadata template: ${appPath} (from ${currentRelativePath})`)
            templates.push({
              name: `${relativePath || 'root'}/${entry.name.replace('.meta.ts', '')}`.replace(/^\//, ''),
              themeName,
              templateType: entry.name.replace('.meta.ts', ''),
              fileName: entry.name,
              relativePath: currentRelativePath,
              appPath,
              templatePath,
              priority: calculateTemplatePriority(themeName, relativePath, entry.name.replace('.meta.ts', '')),
              metadata: templateMetadata
            })
          }
          continue
        }

        // Found a template file
        const templateType = entry.name.replace(/\.(tsx|ts)$/, '')
        const appPath = relativePath ? `app/${relativePath}/${entry.name}` : `app/${entry.name}`
        const templatePath = `@/contents/themes/${themeName}/templates/${currentRelativePath}`

        // Check if this path is protected
        if (getProtectionLevel(appPath) === ProtectionLevel.PROTECTED_ALL) {
          const errorMsg = `SECURITY WARNING: Theme "${themeName}" attempted to override protected path: ${appPath}`
          console.error(`\n${errorMsg}`)
          console.error(`   Protected paths cannot be overridden for security reasons.`)
          console.error(`   Template location: ${templatePath}`)
          console.error(`   This template will be ignored.\n`)

          // Skip adding this template to prevent override
          verbose(`PROTECTED: Skipping ${appPath} - marked as protected`)
          continue
        }

        // Validate: theme templates must NOT use getTemplateOrDefault(Client)
        // These wrappers are for app/ files that delegate to themes — a theme template
        // IS the override, so wrapping it causes webpack chunk splitting issues (TDZ errors).
        try {
          const fileContent = await readFile(currentPath, 'utf-8')
          if (fileContent.includes('getTemplateOrDefaultClient') || fileContent.includes('getTemplateOrDefault(')) {
            const errorMsg = `ANTI-PATTERN: Theme "${themeName}" template uses getTemplateOrDefault in: ${currentRelativePath}`
            console.error(`\n╔══════════════════════════════════════════════════════════════╗`)
            console.error(`║  TEMPLATE ANTI-PATTERN DETECTED                              ║`)
            console.error(`╚══════════════════════════════════════════════════════════════╝\n`)
            console.error(`  ${errorMsg}`)
            console.error(`  Theme templates ARE the override — they must not wrap themselves`)
            console.error(`  with getTemplateOrDefault or getTemplateOrDefaultClient.`)
            console.error(`  Use a plain \`export default\` instead.\n`)
            console.error(`  Fix: Replace the last line with:`)
            console.error(`    export default YourComponent\n`)
            throw new Error(errorMsg)
          }
        } catch (err) {
          if (err.message?.startsWith('ANTI-PATTERN:')) throw err
          // Ignore read errors for non-critical validation
        }

        // Extract metadata: check for companion .meta.ts file first, then inline export
        let templateMetadata = null

        // Check for companion .meta.ts file (e.g., layout.meta.ts for layout.tsx)
        const metaFileName = entry.name.replace(/\.(tsx|ts)$/, '.meta.ts')
        const metaFilePath = join(templatesPath, metaFileName)
        try {
          await access(metaFilePath)
          templateMetadata = await extractTemplateMetadata(metaFilePath)
          if (templateMetadata) {
            verbose(`Metadata extracted from companion .meta.ts: ${metaFileName}`)
          }
        } catch {
          // No companion .meta.ts file - fall through to inline extraction
        }

        // Fall back to inline metadata export from the template file itself
        if (!templateMetadata) {
          templateMetadata = await extractTemplateMetadata(currentPath)
          if (templateMetadata) {
            verbose(`Metadata extracted from ${templatePath}`)
          }
        }

        templates.push({
          name: `${relativePath || 'root'}/${templateType}`.replace(/^\//, ''),
          themeName,
          templateType, // 'page', 'layout', 'error', etc.
          fileName: entry.name,
          relativePath: currentRelativePath,
          appPath, // Path in app directory that this template overrides
          templatePath, // Import path for the template
          priority: calculateTemplatePriority(themeName, relativePath, templateType),
          metadata: templateMetadata // Include extracted metadata
        })

        verbose(`Template: ${appPath} → ${templatePath}`)
      }
    }

  } catch (error) {
    verbose(`Error scanning templates in ${templatesPath}: ${error.message}`)
  }

  return templates
}

/**
 * Calculate template priority for override resolution
 * Higher priority templates override lower priority ones
 * @param {string} themeName - Name of the theme
 * @param {string} relativePath - Relative path of the template
 * @param {string} templateType - Type of template (page, layout, error, etc.)
 * @returns {number} Priority value
 */
export function calculateTemplatePriority(themeName, relativePath, templateType) {
  let priority = 100 // Base priority

  // Specific template types have higher priority
  if (templateType === 'layout') priority += 10
  if (templateType === 'page') priority += 5
  if (templateType === 'error') priority += 3

  // Deeper paths have higher priority (more specific)
  const pathDepth = (relativePath || '').split('/').filter(Boolean).length
  priority += pathDepth * 2

  // Could add theme-specific priority logic here

  return priority
}
