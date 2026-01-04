/**
 * Files Validator
 *
 * Validates that all required files and directories exist in the generated theme.
 */

import path from 'path'
import fs from 'fs-extra'
import type { WizardConfig } from '../types.js'
import type { ValidationError, ValidationWarning } from './index.js'

/**
 * Required directories that must exist in every theme
 */
const REQUIRED_DIRECTORIES = [
  'config',
  'entities',
  'blocks',
  'messages',
  'migrations',
]

/**
 * Required config files that must exist
 */
const REQUIRED_CONFIG_FILES = [
  'config/theme.config.ts',
  'config/app.config.ts',
]

/**
 * Optional but recommended files
 */
const RECOMMENDED_FILES = [
  'config/dev.config.ts',
  'config/permissions.config.ts',
  'config/billing.config.ts',
  'README.md',
]

/**
 * Validate that all required files and directories exist in the theme
 *
 * Checks for:
 * - config/ directory with configuration files
 * - entities/ directory for entity definitions
 * - blocks/ directory for page builder blocks
 * - messages/ directory with locale files
 * - migrations/ directory for database migrations
 *
 * @param themePath - Absolute path to the theme directory
 * @param config - Wizard configuration
 * @returns Object containing errors and warnings
 */
export async function validateRequiredFiles(
  themePath: string,
  config: WizardConfig
): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []

  // Check if theme directory exists
  if (!await fs.pathExists(themePath)) {
    errors.push({
      type: 'files',
      message: `Theme directory not found: ${themePath}`,
    })
    return { errors, warnings }
  }

  // Validate required directories
  for (const dir of REQUIRED_DIRECTORIES) {
    const dirPath = path.join(themePath, dir)
    if (!await fs.pathExists(dirPath)) {
      errors.push({
        type: 'files',
        message: `Required directory missing: ${dir}/`,
        file: dir,
      })
    } else {
      const stat = await fs.stat(dirPath)
      if (!stat.isDirectory()) {
        errors.push({
          type: 'files',
          message: `Expected directory but found file: ${dir}`,
          file: dir,
        })
      }
    }
  }

  // Validate required config files
  for (const file of REQUIRED_CONFIG_FILES) {
    const filePath = path.join(themePath, file)
    if (!await fs.pathExists(filePath)) {
      errors.push({
        type: 'files',
        message: `Required config file missing: ${file}`,
        file,
      })
    }
  }

  // Check recommended files and warn if missing
  for (const file of RECOMMENDED_FILES) {
    const filePath = path.join(themePath, file)
    if (!await fs.pathExists(filePath)) {
      warnings.push({
        type: 'files',
        message: `Recommended file missing: ${file}`,
      })
    }
  }

  // Validate messages directory has locale files
  const messagesDir = path.join(themePath, 'messages')
  if (await fs.pathExists(messagesDir)) {
    const localeFiles = await fs.readdir(messagesDir)
    const localeJsonFiles = localeFiles.filter(f => f.endsWith('.json'))

    if (localeJsonFiles.length === 0) {
      errors.push({
        type: 'files',
        message: 'No locale files found in messages/ directory',
        file: 'messages/',
      })
    } else {
      // Check that default locale exists
      const defaultLocaleFile = `${config.defaultLocale}.json`
      if (!localeJsonFiles.includes(defaultLocaleFile)) {
        errors.push({
          type: 'files',
          message: `Default locale file missing: messages/${defaultLocaleFile}`,
          file: `messages/${defaultLocaleFile}`,
        })
      }

      // Check all supported locales
      for (const locale of config.supportedLocales) {
        const localeFile = `${locale}.json`
        if (!localeJsonFiles.includes(localeFile)) {
          warnings.push({
            type: 'files',
            message: `Locale file missing for supported locale: messages/${localeFile}`,
          })
        }
      }
    }
  }

  // Validate migrations directory structure
  const migrationsDir = path.join(themePath, 'migrations')
  if (await fs.pathExists(migrationsDir)) {
    const migrationFiles = await fs.readdir(migrationsDir)
    const sqlFiles = migrationFiles.filter(f => f.endsWith('.sql'))
    const tsFiles = migrationFiles.filter(f => f.endsWith('.ts'))

    if (sqlFiles.length === 0 && tsFiles.length === 0) {
      warnings.push({
        type: 'files',
        message: 'No migration files found in migrations/ directory',
      })
    }

    // Check for migration index file
    const indexFile = migrationFiles.find(f => f === 'index.ts' || f === 'index.js')
    if (!indexFile && tsFiles.length > 0) {
      warnings.push({
        type: 'files',
        message: 'migrations/index.ts file recommended for organizing migrations',
      })
    }
  }

  // Validate entities directory has subdirectories
  const entitiesDir = path.join(themePath, 'entities')
  if (await fs.pathExists(entitiesDir)) {
    const entityItems = await fs.readdir(entitiesDir)
    const entityDirs = []

    for (const item of entityItems) {
      const itemPath = path.join(entitiesDir, item)
      const stat = await fs.stat(itemPath)
      if (stat.isDirectory() && !item.startsWith('.')) {
        entityDirs.push(item)
      }
    }

    if (entityDirs.length === 0) {
      warnings.push({
        type: 'files',
        message: 'No entity directories found in entities/ directory',
      })
    }
  }

  // Validate blocks directory has subdirectories or files
  const blocksDir = path.join(themePath, 'blocks')
  if (await fs.pathExists(blocksDir)) {
    const blockItems = await fs.readdir(blocksDir)
    const validBlocks = blockItems.filter(item => !item.startsWith('.'))

    if (validBlocks.length === 0) {
      warnings.push({
        type: 'files',
        message: 'No blocks found in blocks/ directory',
      })
    }
  }

  return { errors, warnings }
}
