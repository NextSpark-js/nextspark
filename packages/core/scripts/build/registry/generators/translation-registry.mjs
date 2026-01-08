/**
 * Translation Registry Generator
 *
 * Generates translation-registry.ts
 *
 * Dynamically discovers available locales by scanning messages/ directories
 * and filtering against supportedLocales from the active theme's app.config.ts
 *
 * @module core/scripts/build/registry/generators/translation-registry
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

/**
 * Extract supportedLocales from a theme's app.config.ts file
 * Uses regex to parse the TypeScript file without requiring transpilation
 *
 * @param {string} themesDir - Path to themes directory
 * @param {string} activeTheme - Name of the active theme
 * @returns {string[]} Array of supported locale codes, or empty array if not found
 */
function getSupportedLocales(themesDir, activeTheme) {
  if (!activeTheme) {
    return []
  }

  const appConfigPath = join(themesDir, activeTheme, 'config', 'app.config.ts')

  if (!existsSync(appConfigPath)) {
    return []
  }

  try {
    const content = readFileSync(appConfigPath, 'utf8')

    // Match supportedLocales array using regex
    // Handles formats like: supportedLocales: ['en', 'es', 'fr']
    // or: supportedLocales: ["en", "es", "fr"]
    const match = content.match(/supportedLocales\s*:\s*\[([\s\S]*?)\]/)

    if (!match) {
      return []
    }

    // Extract individual locale strings from the matched array content
    const arrayContent = match[1]
    const localeMatches = arrayContent.match(/['"]([a-zA-Z-]+)['"]/g)

    if (!localeMatches) {
      return []
    }

    // Clean up the matches (remove quotes)
    return localeMatches.map(m => m.replace(/['"]/g, ''))
  } catch (error) {
    console.warn(`Warning: Could not read app.config.ts for theme ${activeTheme}: ${error.message}`)
    return []
  }
}

/**
 * Get available locales for an entity by scanning its messages directory
 * Only returns locales that exist in the directory AND are in supportedLocales
 *
 * @param {string} entityDir - Path to the entity directory
 * @param {string[]} supportedLocales - Array of supported locale codes from app.config
 * @returns {string[]} Array of available and supported locale codes
 */
function getEntityLocales(entityDir, supportedLocales) {
  const messagesDir = join(entityDir, 'messages')

  if (!existsSync(messagesDir)) {
    return []
  }

  try {
    const files = readdirSync(messagesDir)
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''))

    // Only return locales that exist AND are supported
    // If supportedLocales is empty, return all found locales (fallback behavior)
    if (supportedLocales.length === 0) {
      return files
    }

    return files.filter(locale => supportedLocales.includes(locale))
  } catch (error) {
    return []
  }
}

/**
 * Detect locale entries from a messages directory
 * Supports both directory pattern (en/, es/ with index.ts) and flat file pattern (en.json, es.json)
 * Directory pattern takes precedence if both exist
 *
 * @param {string} messagesDir - Path to the messages directory
 * @returns {Array<{locale: string, isDirectory: boolean}>} Detected locales with their type
 */
function detectLocales(messagesDir) {
  if (!existsSync(messagesDir)) {
    return []
  }

  const entries = readdirSync(messagesDir)
  const locales = new Map() // Use Map to ensure directory takes precedence

  entries.forEach(entry => {
    const entryPath = join(messagesDir, entry)
    const stat = statSync(entryPath)

    if (stat.isDirectory()) {
      // Directory pattern: check for index.ts
      const indexPath = join(entryPath, 'index.ts')
      if (existsSync(indexPath)) {
        // Directory pattern takes precedence
        locales.set(entry, { locale: entry, isDirectory: true })
      }
    } else if (entry.endsWith('.json')) {
      // Flat file pattern (only if directory doesn't exist)
      const locale = entry.replace(/\.json$/, '')
      if (!locales.has(locale)) {
        locales.set(locale, { locale, isDirectory: false })
      }
    }
  })

  return Array.from(locales.values())
}

/**
 * Generate Translation Registry
 * Auto-generates lazy-loading functions for theme translations
 * Preserves i18n performance (only loads active locale)
 * Ensures ZERO runtime string interpolation in dynamic imports
 *
 * Dynamically discovers available locales by:
 * 1. Reading supportedLocales from active theme's app.config.ts
 * 2. Scanning each entity's messages/ directory for .json files
 * 3. Only generating loaders for locales that exist AND are supported
 *
 * @param {Array} themes - Discovered themes
 * @param {object} config - Configuration object from getConfig()
 * @returns {string} Generated TypeScript content
 */
export function generateTranslationRegistry(themes, config) {
  // Get supported locales from active theme's app.config.ts
  const supportedLocales = getSupportedLocales(config.themesDir, config.activeTheme)

  // Discover all translation files from themes
  const themeTranslations = []
  // Discover entity translations
  const entityTranslations = []

  themes.forEach(theme => {
    const messagesDir = join(config.themesDir, theme.name, 'messages')
    const entitiesDir = join(config.themesDir, theme.name, 'entities')

    // Scan theme-level translations
    const locales = detectLocales(messagesDir)
    locales.forEach(({ locale, isDirectory }) => {
      // Filter by supportedLocales if available
      if (supportedLocales.length > 0 && !supportedLocales.includes(locale)) {
        return
      }

      // For directory pattern, import from the directory (index.ts)
      // For flat file pattern, import the .json file
      const filePath = isDirectory
        ? `@/contents/themes/${theme.name}/messages/${locale}`
        : `@/contents/themes/${theme.name}/messages/${locale}.json`

      themeTranslations.push({
        themeName: theme.name,
        locale,
        filePath,
        isDirectory,
        importKey: `theme_${theme.name.replace(/-/g, '_')}_${locale.replace(/-/g, '_')}`
      })
    })

    // Scan entity-level translations dynamically
    // Instead of reading from entity configs, scan the messages/ directory
    if (existsSync(entitiesDir)) {
      const entityDirs = readdirSync(entitiesDir).filter(entry => {
        const entryPath = join(entitiesDir, entry)
        return statSync(entryPath).isDirectory()
      })

      entityDirs.forEach(entityName => {
        const entityDir = join(entitiesDir, entityName)

        // Use getEntityLocales to dynamically discover available locales
        // This filters by both existence AND supportedLocales
        const availableLocales = getEntityLocales(entityDir, supportedLocales)

        availableLocales.forEach(locale => {
          entityTranslations.push({
            themeName: theme.name,
            entityName,
            locale,
            filePath: `@/contents/themes/${theme.name}/entities/${entityName}/messages/${locale}.json`,
            importKey: `entity_${theme.name.replace(/-/g, '_')}_${entityName.replace(/-/g, '_')}_${locale.replace(/-/g, '_')}`
          })
        })
      })
    }
  })

  // Generate theme loader functions (lazy-loading for performance)
  const loaderEntries = {}

  themeTranslations.forEach(translation => {
    if (!loaderEntries[translation.themeName]) {
      loaderEntries[translation.themeName] = []
    }
    loaderEntries[translation.themeName].push(
      `    '${translation.locale}': () => import('${translation.filePath}')`
    )
  })

  const loadersCode = Object.entries(loaderEntries)
    .map(([themeName, loaders]) => {
      return `  '${themeName}': {\n${loaders.join(',\n')}\n  }`
    })
    .join(',\n')

  // Generate entity loader functions
  // Structure: { themeName: { entityName: { locale: loader } } }
  const entityLoaderEntries = {}

  entityTranslations.forEach(translation => {
    if (!entityLoaderEntries[translation.themeName]) {
      entityLoaderEntries[translation.themeName] = {}
    }
    if (!entityLoaderEntries[translation.themeName][translation.entityName]) {
      entityLoaderEntries[translation.themeName][translation.entityName] = []
    }
    entityLoaderEntries[translation.themeName][translation.entityName].push(
      `      '${translation.locale}': () => import('${translation.filePath}')`
    )
  })

  const entityLoadersCode = Object.entries(entityLoaderEntries)
    .map(([themeName, entities]) => {
      const entitiesCode = Object.entries(entities)
        .map(([entityName, loaders]) => {
          return `    '${entityName}': {\n${loaders.join(',\n')}\n    }`
        })
        .join(',\n')
      return `  '${themeName}': {\n${entitiesCode}\n  }`
    })
    .join(',\n')

  // Count unique entities
  const uniqueEntities = new Set(entityTranslations.map(t => `${t.themeName}:${t.entityName}`))

  return `/**
 * Auto-generated Translation Registry
 *
 * Generated at: ${new Date().toISOString()}
 * Active theme: ${config.activeTheme || 'none'}
 * Supported locales: ${supportedLocales.length > 0 ? supportedLocales.join(', ') : 'all (no filter)'}
 * Themes with translations: ${Object.keys(loaderEntries).length}
 * Total theme translation files: ${themeTranslations.length}
 * Total entity translation files: ${entityTranslations.length}
 * Total entities with translations: ${uniqueEntities.size}
 *
 * DO NOT EDIT - This file is auto-generated by scripts/build-registry.mjs
 *
 * Locale discovery: Dynamically scans messages/ directories and filters by supportedLocales.
 * ZERO runtime string interpolation - all translation paths resolved at build time.
 * Preserves lazy-loading performance (only loads active locale).
 * Provides build-time validation and type safety.
 */

export type TranslationLoader = () => Promise<{ default: Record<string, unknown> } | Record<string, unknown>>

/**
 * Theme Translation Loaders Registry
 * Access: THEME_TRANSLATION_LOADERS['theme-name']['locale']()
 *
 * Returns lazy-loading functions that only execute when called.
 * This preserves i18n performance - only active locale is loaded.
 */
export const THEME_TRANSLATION_LOADERS: Record<string, Record<string, TranslationLoader>> = {
${loadersCode || '  // No theme translations discovered'}
}

/**
 * Entity Translation Loaders Registry
 * Access: ENTITY_TRANSLATION_LOADERS['theme-name']['entity-name']['locale']()
 *
 * Returns lazy-loading functions for entity-specific translations.
 * Structure: theme -> entity -> locale -> loader
 */
export const ENTITY_TRANSLATION_LOADERS: Record<string, Record<string, Record<string, TranslationLoader>>> = {
${entityLoadersCode || '  // No entity translations discovered'}
}

/**
 * Translation registry metadata
 */
export const TRANSLATION_METADATA = {
  totalThemes: ${Object.keys(loaderEntries).length},
  totalThemeTranslations: ${themeTranslations.length},
  totalEntityTranslations: ${entityTranslations.length},
  totalEntitiesWithTranslations: ${uniqueEntities.size},
  generatedAt: '${new Date().toISOString()}',
  activeTheme: ${config.activeTheme ? `'${config.activeTheme}'` : 'null'},
  supportedLocales: [${supportedLocales.map(l => `'${l}'`).join(', ')}],
  themes: [${Object.keys(loaderEntries).map(t => `'${t}'`).join(', ')}],
  entities: [${Array.from(uniqueEntities).map(e => `'${e}'`).join(', ')}]
}
`
}
