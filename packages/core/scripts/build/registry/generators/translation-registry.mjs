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
import { join, dirname } from 'path'

/**
 * Extract supportedLocales from a theme's app.config.ts file
 * Uses regex to parse the TypeScript file without requiring transpilation
 *
 * @param {string} themesDir - Path to themes directory
 * @param {string} activeTheme - Name of the active theme
 * @returns {string[]} Array of supported locale codes, or empty array if not found
 */
/**
 * Extract defaultLocale from a theme's app.config.ts file
 * @param {string} themesDir
 * @param {string} activeTheme
 * @returns {string} Default locale code, or 'en' if not found
 */
function getDefaultLocale(themesDir, activeTheme) {
  if (!activeTheme) return 'en'
  const appConfigPath = join(themesDir, activeTheme, 'config', 'app.config.ts')
  if (!existsSync(appConfigPath)) return 'en'
  try {
    const content = readFileSync(appConfigPath, 'utf8')
    const match = content.match(/defaultLocale\s*:\s*['"]([a-zA-Z-]+)['"]/)
    return match ? match[1] : 'en'
  } catch {
    return 'en'
  }
}

/**
 * Extract defaultMode from a theme's theme.config.ts file
 * @param {string} themesDir
 * @param {string} activeTheme
 * @returns {'light' | 'dark' | 'system'} Default theme mode
 */
function getDefaultThemeMode(themesDir, activeTheme) {
  if (!activeTheme) return 'system'
  const themeConfigPath = join(themesDir, activeTheme, 'config', 'theme.config.ts')
  if (!existsSync(themeConfigPath)) return 'system'
  try {
    const content = readFileSync(themeConfigPath, 'utf8')
    const match = content.match(/defaultMode\s*:\s*['"]([a-z]+)['"]/)
    return match ? match[1] : 'system'
  } catch {
    return 'system'
  }
}

/**
 * Detect if the project has PPR (Partial Prerendering) enabled
 * by checking for cacheComponents: true in next.config.{mjs,js,ts}
 *
 * When PPR is enabled, the generator produces static exports
 * (DEFAULT_LOCALE, DEFAULT_THEME_MODE, STATIC_MESSAGES) that
 * allow the root layout to render a fully static shell.
 *
 * @param {string} projectRoot - Path to the project root
 * @returns {boolean} true if cacheComponents: true is found
 */
export function detectPPREnabled(projectRoot) {
  const configPaths = ['next.config.mjs', 'next.config.js', 'next.config.ts']
  for (const name of configPaths) {
    const p = join(projectRoot, name)
    if (!existsSync(p)) continue
    try {
      const content = readFileSync(p, 'utf8')
      if (content.match(/cacheComponents\s*:\s*true/)) {
        return true
      }
    } catch {
      // ignore read errors
    }
  }
  return false
}

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
 * Supports three patterns:
 * 1. Directory with index.ts (en/, es/ with index.ts) - imports from directory
 * 2. Directory with JSON files (en/, es/ with *.json files) - imports individual files
 * 3. Flat file pattern (en.json, es.json) - imports single file
 * Directory patterns take precedence if both exist
 *
 * @param {string} messagesDir - Path to the messages directory
 * @returns {Array<{locale: string, isDirectory: boolean, hasIndexTs: boolean, jsonFiles: string[]}>} Detected locales with their type
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
      // Directory pattern: check for index.ts first
      const indexPath = join(entryPath, 'index.ts')
      if (existsSync(indexPath)) {
        // Directory with index.ts takes precedence
        locales.set(entry, { locale: entry, isDirectory: true, hasIndexTs: true, jsonFiles: [] })
      } else {
        // Check for JSON files in directory (new pattern for themes)
        const jsonFiles = readdirSync(entryPath).filter(f => f.endsWith('.json'))
        if (jsonFiles.length > 0) {
          locales.set(entry, { locale: entry, isDirectory: true, hasIndexTs: false, jsonFiles })
        }
      }
    } else if (entry.endsWith('.json')) {
      // Flat file pattern (only if directory doesn't exist)
      const locale = entry.replace(/\.json$/, '')
      if (!locales.has(locale)) {
        locales.set(locale, { locale, isDirectory: false, hasIndexTs: false, jsonFiles: [] })
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
  // Get supported locales and default locale from active theme's app.config.ts
  const supportedLocales = getSupportedLocales(config.themesDir, config.activeTheme)
  const defaultLocale = getDefaultLocale(config.themesDir, config.activeTheme)
  const defaultThemeMode = getDefaultThemeMode(config.themesDir, config.activeTheme)

  // Discover all translation files from themes
  const themeTranslations = []
  // Discover entity translations (theme-level)
  const entityTranslations = []
  // Discover entity translations from plugins (fallback)
  const pluginEntityTranslations = []

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

  // Scan plugin entity translations as fallbacks
  if (config.pluginsDir && existsSync(config.pluginsDir)) {
    const pluginDirs = readdirSync(config.pluginsDir).filter(entry => {
      const entryPath = join(config.pluginsDir, entry)
      return statSync(entryPath).isDirectory()
    })

    pluginDirs.forEach(pluginName => {
      const entitiesDir = join(config.pluginsDir, pluginName, 'entities')
      if (!existsSync(entitiesDir)) return

      const entityDirs = readdirSync(entitiesDir).filter(entry => {
        const entryPath = join(entitiesDir, entry)
        return statSync(entryPath).isDirectory()
      })

      entityDirs.forEach(entityName => {
        const entityDir = join(entitiesDir, entityName)
        const availableLocales = getEntityLocales(entityDir, supportedLocales)

        availableLocales.forEach(locale => {
          pluginEntityTranslations.push({
            pluginName,
            entityName,
            locale,
            filePath: `@/contents/plugins/${pluginName}/entities/${entityName}/messages/${locale}.json`,
          })
        })
      })
    })
  }

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

  // Generate plugin entity loader functions
  // Structure: { pluginName: { entityName: { locale: loader } } }
  const pluginEntityLoaderEntries = {}

  pluginEntityTranslations.forEach(translation => {
    if (!pluginEntityLoaderEntries[translation.pluginName]) {
      pluginEntityLoaderEntries[translation.pluginName] = {}
    }
    if (!pluginEntityLoaderEntries[translation.pluginName][translation.entityName]) {
      pluginEntityLoaderEntries[translation.pluginName][translation.entityName] = []
    }
    pluginEntityLoaderEntries[translation.pluginName][translation.entityName].push(
      `      '${translation.locale}': () => import('${translation.filePath}')`
    )
  })

  const pluginEntityLoadersCode = Object.entries(pluginEntityLoaderEntries)
    .map(([pluginName, entities]) => {
      const entitiesCode = Object.entries(entities)
        .map(([entityName, loaders]) => {
          return `    '${entityName}': {\n${loaders.join(',\n')}\n    }`
        })
        .join(',\n')
      return `  '${pluginName}': {\n${entitiesCode}\n  }`
    })
    .join(',\n')

  // Count unique entities
  const uniqueEntities = new Set(entityTranslations.map(t => `${t.themeName}:${t.entityName}`))
  const uniquePluginEntities = new Set(pluginEntityTranslations.map(t => `${t.pluginName}:${t.entityName}`))

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
 * Total plugin entity translation files: ${pluginEntityTranslations.length}
 * Total plugin entities with translations: ${uniquePluginEntities.size}
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
 * Plugin Entity Translation Loaders Registry
 * Access: PLUGIN_ENTITY_TRANSLATION_LOADERS['plugin-name']['entity-name']['locale']()
 *
 * Used as fallback when theme doesn't define translations for an entity.
 * Theme translations always take priority over plugin translations.
 * Structure: plugin -> entity -> locale -> loader
 */
export const PLUGIN_ENTITY_TRANSLATION_LOADERS: Record<string, Record<string, Record<string, TranslationLoader>>> = {
${pluginEntityLoadersCode || '  // No plugin entity translations discovered'}
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
  entities: [${Array.from(uniqueEntities).map(e => `'${e}'`).join(', ')}],
  totalPluginEntityTranslations: ${pluginEntityTranslations.length},
  totalPluginEntitiesWithTranslations: ${uniquePluginEntities.size},
  pluginEntities: [${Array.from(uniquePluginEntities).map(e => `'${e}'`).join(', ')}]
}

${(() => {
  // PPR: Generate static imports for the default locale — only when cacheComponents is enabled.
  // These are used by the root layout's StaticIntlProvider (layout.ppr.tsx) to render
  // content in the PPR static shell without accessing cookies/headers.
  //
  // Projects on Next.js 15 (without cacheComponents) skip this entirely.
  // To enable: add cacheComponents: true to next.config and use layout.ppr.tsx.
  const projectRoot = config.projectRoot || (config.themesDir ? dirname(dirname(config.themesDir)) : process.cwd())
  const pprEnabled = detectPPREnabled(projectRoot)

  if (!pprEnabled) {
    return `// PPR static exports disabled — cacheComponents: true not found in next.config.
// To enable PPR, add cacheComponents: true to your next.config and copy
// layout.ppr.tsx from @nextsparkjs/core/templates/app/ to your app/ directory.
// See docs/migration-ppr.md for the full migration guide.`
  }

  const defaultThemeTranslation = themeTranslations.find(
    t => t.themeName === config.activeTheme && t.locale === defaultLocale
  )
  if (!defaultThemeTranslation) return '// PPR: No static messages generated (no theme translation found for default locale)'

  console.log(`[TranslationRegistry] PPR enabled — generating static exports for locale '${defaultLocale}'`)

  return `/**
 * PPR: Static messages for the default locale (pre-merged at build time)
 *
 * Used by the root layout's StaticIntlProvider to render content
 * in the PPR static shell without accessing cookies/headers.
 * Core messages are deep-merged with theme messages.
 */
import { deepMergeMessages as _deepMerge } from '@nextsparkjs/core/lib/translations/registry'
import _coreMessages from '@nextsparkjs/core/messages/${defaultLocale}/index.js'
import _themeMessages from '${defaultThemeTranslation.filePath}'

export const DEFAULT_LOCALE = '${defaultLocale}' as const
export const DEFAULT_THEME_MODE = '${defaultThemeMode}' as const
export const STATIC_MESSAGES: Record<string, unknown> = _deepMerge(
  _coreMessages as unknown as Record<string, unknown>,
  (_themeMessages as { default?: Record<string, unknown> }).default ?? _themeMessages as unknown as Record<string, unknown>
)`
})()}
`
}
