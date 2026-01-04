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
function getTargetThemesDir(): string {
  return path.resolve(process.cwd(), 'contents', 'themes')
}

/**
 * Remove unused language folders from messages directory
 */
export async function removeUnusedLanguages(config: WizardConfig): Promise<void> {
  const messagesDir = path.join(getTargetThemesDir(), config.projectSlug, 'messages')

  if (!await fs.pathExists(messagesDir)) {
    return
  }

  // Get all language folders
  const folders = await fs.readdir(messagesDir)
  const languageFolders = folders.filter(f => {
    const folderPath = path.join(messagesDir, f)
    return fs.statSync(folderPath).isDirectory() && Object.keys(AVAILABLE_LOCALES).includes(f)
  })

  // Remove folders that are not in supported locales
  for (const folder of languageFolders) {
    if (!config.supportedLocales.includes(folder)) {
      await fs.remove(path.join(messagesDir, folder))
    }
  }
}

/**
 * Remove unused language files from entity messages
 */
export async function removeUnusedEntityMessages(config: WizardConfig): Promise<void> {
  const entitiesDir = path.join(getTargetThemesDir(), config.projectSlug, 'entities')

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
  const messagesDir = path.join(getTargetThemesDir(), config.projectSlug, 'messages')

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
 * Update message files with project-specific values
 */
export async function updateMessageFiles(config: WizardConfig): Promise<void> {
  const messagesDir = path.join(getTargetThemesDir(), config.projectSlug, 'messages')

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
  // Remove unused languages
  await removeUnusedLanguages(config)
  await removeUnusedEntityMessages(config)

  // Ensure all selected languages have folders
  await ensureLanguageFolders(config)

  // Update message files with project values
  await updateMessageFiles(config)
}
