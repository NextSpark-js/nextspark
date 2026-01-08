/**
 * Template Discovery
 *
 * Discovers template overrides from themes
 *
 * @module core/scripts/build/registry/discovery/templates
 */

import { readdir, stat } from 'fs/promises'
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
    console.error(errorMsg)
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

        // Extract metadata from template file if it exists
        const templateMetadata = await extractTemplateMetadata(currentPath)
        if (templateMetadata) {
          verbose(`Metadata extracted from ${templatePath}`)
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
  // if (themeName === 'content-buddy') priority += 1

  return priority
}
