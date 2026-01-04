/**
 * i18n Validator
 *
 * Validates internationalization completeness for the generated theme.
 */

import path from 'path'
import fs from 'fs-extra'
import type { WizardConfig } from '../types.js'
import type { ValidationError, ValidationWarning } from './index.js'

/**
 * Get all translation keys from a JSON object recursively
 */
function getTranslationKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = []

  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    const value = obj[key]

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...getTranslationKeys(value as Record<string, unknown>, fullKey))
    } else {
      keys.push(fullKey)
    }
  }

  return keys
}

/**
 * Compare two sets of keys and find missing ones
 */
function findMissingKeys(referenceKeys: string[], targetKeys: string[]): string[] {
  const targetSet = new Set(targetKeys)
  return referenceKeys.filter(key => !targetSet.has(key))
}

/**
 * Find extra keys that exist in target but not in reference
 */
function findExtraKeys(referenceKeys: string[], targetKeys: string[]): string[] {
  const referenceSet = new Set(referenceKeys)
  return targetKeys.filter(key => !referenceSet.has(key))
}

/**
 * Validate i18n translations for completeness
 *
 * Checks that:
 * - All supported locales have translation files
 * - All namespaces exist in each locale
 * - Translation keys are consistent across locales
 *
 * @param themePath - Absolute path to the theme directory
 * @param config - Wizard configuration
 * @returns Object containing errors and warnings
 */
export async function validateI18n(
  themePath: string,
  config: WizardConfig
): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []

  const messagesDir = path.join(themePath, 'messages')

  // Check if messages directory exists
  if (!await fs.pathExists(messagesDir)) {
    errors.push({
      type: 'i18n',
      message: 'messages/ directory not found',
    })
    return { errors, warnings }
  }

  // Get all locale files
  const items = await fs.readdir(messagesDir)
  const localeFiles: string[] = []
  const localeDirs: string[] = []

  for (const item of items) {
    const itemPath = path.join(messagesDir, item)
    const stat = await fs.stat(itemPath)

    if (stat.isDirectory() && !item.startsWith('.')) {
      localeDirs.push(item)
    } else if (item.endsWith('.json')) {
      localeFiles.push(item.replace('.json', ''))
    }
  }

  // Determine if using flat files or namespace directories
  const usingNamespaceDirs = localeDirs.length > 0 && localeDirs.some(d => config.supportedLocales.includes(d))
  const availableLocales = usingNamespaceDirs ? localeDirs : localeFiles

  // Check that all supported locales exist
  for (const locale of config.supportedLocales) {
    if (!availableLocales.includes(locale)) {
      errors.push({
        type: 'i18n',
        message: `Missing translations for locale: ${locale}`,
        file: `messages/${locale}${usingNamespaceDirs ? '/' : '.json'}`,
      })
    }
  }

  // Validate translation completeness using default locale as reference
  const defaultLocale = config.defaultLocale

  if (usingNamespaceDirs) {
    // Namespace directory structure: messages/en/common.json, messages/es/common.json
    await validateNamespaceDirectories(
      messagesDir,
      defaultLocale,
      config.supportedLocales,
      errors,
      warnings
    )
  } else {
    // Flat file structure: messages/en.json, messages/es.json
    await validateFlatFiles(
      messagesDir,
      defaultLocale,
      config.supportedLocales,
      errors,
      warnings
    )
  }

  // Validate entity messages if they exist
  const entitiesDir = path.join(themePath, 'entities')
  if (await fs.pathExists(entitiesDir)) {
    await validateEntityMessages(
      entitiesDir,
      config,
      errors,
      warnings
    )
  }

  return { errors, warnings }
}

/**
 * Validate namespace directory structure
 */
async function validateNamespaceDirectories(
  messagesDir: string,
  defaultLocale: string,
  supportedLocales: string[],
  errors: ValidationError[],
  warnings: ValidationWarning[]
): Promise<void> {
  const defaultLocaleDir = path.join(messagesDir, defaultLocale)

  if (!await fs.pathExists(defaultLocaleDir)) {
    errors.push({
      type: 'i18n',
      message: `Default locale directory not found: messages/${defaultLocale}/`,
      file: `messages/${defaultLocale}/`,
    })
    return
  }

  // Get namespaces from default locale
  const namespaceFiles = await fs.readdir(defaultLocaleDir)
  const namespaces = namespaceFiles
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''))

  if (namespaces.length === 0) {
    warnings.push({
      type: 'i18n',
      message: `No namespace files found in messages/${defaultLocale}/`,
    })
    return
  }

  // Check each locale has all namespaces and keys
  for (const locale of supportedLocales) {
    if (locale === defaultLocale) continue

    const localeDir = path.join(messagesDir, locale)
    if (!await fs.pathExists(localeDir)) continue

    for (const namespace of namespaces) {
      const defaultFile = path.join(defaultLocaleDir, `${namespace}.json`)
      const localeFile = path.join(localeDir, `${namespace}.json`)

      if (!await fs.pathExists(localeFile)) {
        errors.push({
          type: 'i18n',
          message: `Missing namespace file: messages/${locale}/${namespace}.json`,
          file: `messages/${locale}/${namespace}.json`,
        })
        continue
      }

      // Compare keys
      try {
        const defaultContent = await fs.readJson(defaultFile)
        const localeContent = await fs.readJson(localeFile)

        const defaultKeys = getTranslationKeys(defaultContent)
        const localeKeys = getTranslationKeys(localeContent)

        const missingKeys = findMissingKeys(defaultKeys, localeKeys)
        const extraKeys = findExtraKeys(defaultKeys, localeKeys)

        if (missingKeys.length > 0) {
          warnings.push({
            type: 'i18n',
            message: `Locale ${locale}/${namespace}.json missing ${missingKeys.length} keys: ${missingKeys.slice(0, 3).join(', ')}${missingKeys.length > 3 ? '...' : ''}`,
          })
        }

        if (extraKeys.length > 0) {
          warnings.push({
            type: 'i18n',
            message: `Locale ${locale}/${namespace}.json has ${extraKeys.length} extra keys not in default locale`,
          })
        }
      } catch (error) {
        errors.push({
          type: 'i18n',
          message: `Invalid JSON in messages/${locale}/${namespace}.json`,
          file: `messages/${locale}/${namespace}.json`,
        })
      }
    }
  }
}

/**
 * Validate flat file structure
 */
async function validateFlatFiles(
  messagesDir: string,
  defaultLocale: string,
  supportedLocales: string[],
  errors: ValidationError[],
  warnings: ValidationWarning[]
): Promise<void> {
  const defaultFile = path.join(messagesDir, `${defaultLocale}.json`)

  if (!await fs.pathExists(defaultFile)) {
    errors.push({
      type: 'i18n',
      message: `Default locale file not found: messages/${defaultLocale}.json`,
      file: `messages/${defaultLocale}.json`,
    })
    return
  }

  let defaultContent: Record<string, unknown>
  let defaultKeys: string[]

  try {
    defaultContent = await fs.readJson(defaultFile)
    defaultKeys = getTranslationKeys(defaultContent)
  } catch (error) {
    errors.push({
      type: 'i18n',
      message: `Invalid JSON in messages/${defaultLocale}.json`,
      file: `messages/${defaultLocale}.json`,
    })
    return
  }

  // Check each locale file
  for (const locale of supportedLocales) {
    if (locale === defaultLocale) continue

    const localeFile = path.join(messagesDir, `${locale}.json`)
    if (!await fs.pathExists(localeFile)) continue

    try {
      const localeContent = await fs.readJson(localeFile)
      const localeKeys = getTranslationKeys(localeContent)

      const missingKeys = findMissingKeys(defaultKeys, localeKeys)
      const extraKeys = findExtraKeys(defaultKeys, localeKeys)

      if (missingKeys.length > 0) {
        warnings.push({
          type: 'i18n',
          message: `Locale ${locale}.json missing ${missingKeys.length} keys: ${missingKeys.slice(0, 3).join(', ')}${missingKeys.length > 3 ? '...' : ''}`,
        })
      }

      if (extraKeys.length > 0) {
        warnings.push({
          type: 'i18n',
          message: `Locale ${locale}.json has ${extraKeys.length} extra keys not in default locale`,
        })
      }
    } catch (error) {
      errors.push({
        type: 'i18n',
        message: `Invalid JSON in messages/${locale}.json`,
        file: `messages/${locale}.json`,
      })
    }
  }
}

/**
 * Validate entity-level message files
 */
async function validateEntityMessages(
  entitiesDir: string,
  config: WizardConfig,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): Promise<void> {
  const entityItems = await fs.readdir(entitiesDir)

  for (const entity of entityItems) {
    const entityPath = path.join(entitiesDir, entity)
    const stat = await fs.stat(entityPath)

    if (!stat.isDirectory() || entity.startsWith('.')) continue

    const entityMessagesDir = path.join(entityPath, 'messages')
    if (!await fs.pathExists(entityMessagesDir)) continue

    const messageFiles = await fs.readdir(entityMessagesDir)
    const localeFiles = messageFiles
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''))

    // Check that default locale exists
    if (!localeFiles.includes(config.defaultLocale)) {
      warnings.push({
        type: 'i18n',
        message: `Entity ${entity} missing default locale: entities/${entity}/messages/${config.defaultLocale}.json`,
      })
      continue
    }

    // Check that all supported locales exist
    for (const locale of config.supportedLocales) {
      if (!localeFiles.includes(locale)) {
        warnings.push({
          type: 'i18n',
          message: `Entity ${entity} missing locale: entities/${entity}/messages/${locale}.json`,
        })
      }
    }

    // Validate key consistency for entity messages
    const defaultFile = path.join(entityMessagesDir, `${config.defaultLocale}.json`)
    if (!await fs.pathExists(defaultFile)) continue

    try {
      const defaultContent = await fs.readJson(defaultFile)
      const defaultKeys = getTranslationKeys(defaultContent)

      for (const locale of config.supportedLocales) {
        if (locale === config.defaultLocale) continue

        const localeFile = path.join(entityMessagesDir, `${locale}.json`)
        if (!await fs.pathExists(localeFile)) continue

        try {
          const localeContent = await fs.readJson(localeFile)
          const localeKeys = getTranslationKeys(localeContent)
          const missingKeys = findMissingKeys(defaultKeys, localeKeys)

          if (missingKeys.length > 0) {
            warnings.push({
              type: 'i18n',
              message: `Entity ${entity}/${locale}.json missing ${missingKeys.length} keys`,
            })
          }
        } catch {
          errors.push({
            type: 'i18n',
            message: `Invalid JSON in entities/${entity}/messages/${locale}.json`,
            file: `entities/${entity}/messages/${locale}.json`,
          })
        }
      }
    } catch {
      errors.push({
        type: 'i18n',
        message: `Invalid JSON in entities/${entity}/messages/${config.defaultLocale}.json`,
        file: `entities/${entity}/messages/${config.defaultLocale}.json`,
      })
    }
  }
}
