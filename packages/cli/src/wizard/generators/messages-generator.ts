/**
 * Messages Generator
 *
 * Manages i18n message files - removes unused languages and ensures
 * selected languages have complete message files.
 */

import fs from 'fs-extra'
import path from 'path'
import type { WizardConfig } from '../types.js'
import { AVAILABLE_LOCALES } from '../types.js'

/**
 * Get the target themes directory in the user's project
 */
function getProjectRoot(): string {
  return path.resolve(process.cwd())
}

/**
 * Remove unused language folders from messages directory
 */
export async function removeUnusedLanguages(config: WizardConfig): Promise<void> {
  const messagesDir = path.join(getProjectRoot(), 'messages')

  if (!await fs.pathExists(messagesDir)) {
    return
  }

  // Get all language folders
  const folders = await fs.readdir(messagesDir)
  // A locale is a directory (messages/es/) or a flat file (messages/es.json): the templates use both
  const languageEntries = folders.filter(f => {
    const stat = fs.statSync(path.join(messagesDir, f))
    const locale = stat.isDirectory() ? f : f.endsWith('.json') ? path.basename(f, '.json') : ''
    return Object.keys(AVAILABLE_LOCALES).includes(locale)
  })

  // Remove the locales that are not supported
  for (const entry of languageEntries) {
    if (!config.supportedLocales.includes(path.basename(entry, '.json'))) {
      await fs.remove(path.join(messagesDir, entry))
    }
  }
}

/**
 * Remove unused language files from entity messages
 */
export async function removeUnusedEntityMessages(config: WizardConfig): Promise<void> {
  const entitiesDir = path.join(getProjectRoot(), 'entities')

  if (!await fs.pathExists(entitiesDir)) {
    return
  }

  // Get all entity folders
  const entityFolders = await fs.readdir(entitiesDir)

  for (const entity of entityFolders) {
    const messagesDir = path.join(entitiesDir, entity, 'messages')

    if (!await fs.pathExists(messagesDir)) {
      continue
    }

    // Get all message files
    const files = await fs.readdir(messagesDir)

    for (const file of files) {
      // Extract locale from filename (e.g., en.json -> en)
      const locale = path.basename(file, '.json')

      // Remove if not in supported locales
      if (Object.keys(AVAILABLE_LOCALES).includes(locale) && !config.supportedLocales.includes(locale)) {
        await fs.remove(path.join(messagesDir, file))
      }
    }
  }
}

/**
 * Create missing language folders with copied translations from default locale
 */
export async function ensureLanguageFolders(config: WizardConfig): Promise<void> {
  const messagesDir = path.join(getProjectRoot(), 'messages')

  if (!await fs.pathExists(messagesDir)) {
    return
  }

  const defaultLocaleDir = path.join(messagesDir, config.defaultLocale)

  // Ensure default locale exists
  if (!await fs.pathExists(defaultLocaleDir)) {
    // If default doesn't exist, try to copy from 'en'
    const enDir = path.join(messagesDir, 'en')
    if (await fs.pathExists(enDir)) {
      await fs.copy(enDir, defaultLocaleDir)
    }
  }

  // Create missing locale folders by copying from default
  for (const locale of config.supportedLocales) {
    const localeDir = path.join(messagesDir, locale)

    if (!await fs.pathExists(localeDir) && await fs.pathExists(defaultLocaleDir)) {
      // Copy from default locale as a starting point
      await fs.copy(defaultLocaleDir, localeDir)
    }
  }
}

/**
 * The flat form: messages/<locale>.json and entities/<name>/messages/<locale>.json. Every supported locale gets a
 * file, copied from the default locale's when the template has none for it.
 */
export async function ensureFlatLocaleFiles(config: WizardConfig): Promise<void> {
  const root = getProjectRoot()
  const dirs = [path.join(root, 'messages')]
  const entitiesDir = path.join(root, 'entities')
  if (await fs.pathExists(entitiesDir)) {
    for (const entity of await fs.readdir(entitiesDir)) dirs.push(path.join(entitiesDir, entity, 'messages'))
  }

  const untranslated = new Set<string>()
  for (const dir of dirs) {
    // The default locale's file, or the English one when the template has none for it
    const sourceLocale = [config.defaultLocale, 'en'].find(l => fs.pathExistsSync(path.join(dir, `${l}.json`)))
    if (!sourceLocale) continue
    const source = path.join(dir, `${sourceLocale}.json`)
    for (const locale of config.supportedLocales) {
      const target = path.join(dir, `${locale}.json`)
      if (await fs.pathExists(target)) continue
      await fs.copy(source, target)
      if (sourceLocale !== locale) untranslated.add(locale)
    }
  }
  for (const locale of untranslated) {
    console.warn(`The template has no "${locale}" catalog: its messages are copies of the default locale's (or English), still to translate.`)
  }
}

/**
 * Update message files with project-specific values
 */
export async function updateMessageFiles(config: WizardConfig): Promise<void> {
  const messagesDir = path.join(getProjectRoot(), 'messages')

  if (!await fs.pathExists(messagesDir)) {
    return
  }

  // Update common.json in each language folder
  for (const locale of config.supportedLocales) {
    const commonPath = path.join(messagesDir, locale, 'common.json')

    if (await fs.pathExists(commonPath)) {
      try {
        const content = await fs.readJson(commonPath)

        // Update app name if it exists in the translations
        if (content.app) {
          content.app.name = config.projectName
          if (content.app.description) {
            content.app.description = config.projectDescription
          }
        }

        await fs.writeJson(commonPath, content, { spaces: 2 })
      } catch {
        // Skip if JSON parsing fails
      }
    }
  }
}

/**
 * Main function to process all i18n-related tasks
 */
export async function processI18n(config: WizardConfig): Promise<void> {
  // Ensure all selected languages have catalogs first: the default locale's own may be one that gets removed below
  await ensureLanguageFolders(config)
  await ensureFlatLocaleFiles(config)

  // Remove unused languages
  await removeUnusedLanguages(config)
  await removeUnusedEntityMessages(config)

  // Update message files with project values
  await updateMessageFiles(config)
}
