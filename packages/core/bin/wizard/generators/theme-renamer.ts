/**
 * Theme Renamer Generator
 *
 * Copies the starter theme to a new name and updates all references.
 */

import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'
import type { WizardConfig } from '../types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Get the templates directory path
 * From bin/dist/wizard/generators/theme-renamer.js, go up to reach packages/core/templates
 */
function getTemplatesDir(): string {
  // When compiled: bin/dist/wizard/generators/theme-renamer.js
  // Templates at: templates/contents/themes/starter
  return path.resolve(__dirname, '../../../../templates')
}

/**
 * Get the target themes directory in the user's project
 */
function getTargetThemesDir(): string {
  return path.resolve(process.cwd(), 'contents', 'themes')
}

/**
 * Copy starter theme to new location with new name
 */
export async function copyStarterTheme(config: WizardConfig): Promise<void> {
  const templatesDir = getTemplatesDir()
  const starterThemePath = path.join(templatesDir, 'contents', 'themes', 'starter')
  const targetThemesDir = getTargetThemesDir()
  const newThemePath = path.join(targetThemesDir, config.projectSlug)

  // Check if starter theme exists
  if (!await fs.pathExists(starterThemePath)) {
    throw new Error(`Starter theme not found at: ${starterThemePath}`)
  }

  // Check if target theme already exists
  if (await fs.pathExists(newThemePath)) {
    throw new Error(`Theme already exists at: ${newThemePath}. Please choose a different name or remove the existing theme.`)
  }

  // Ensure themes directory exists
  await fs.ensureDir(targetThemesDir)

  // Copy the entire starter theme
  await fs.copy(starterThemePath, newThemePath)
}

/**
 * Update theme.config.ts with new name and display name
 */
export async function updateThemeConfig(config: WizardConfig): Promise<void> {
  const themeConfigPath = path.join(getTargetThemesDir(), config.projectSlug, 'config', 'theme.config.ts')

  if (!await fs.pathExists(themeConfigPath)) {
    throw new Error(`theme.config.ts not found at: ${themeConfigPath}`)
  }

  let content = await fs.readFile(themeConfigPath, 'utf-8')

  // Update name
  content = content.replace(
    /name:\s*['"]starter['"]/g,
    `name: '${config.projectSlug}'`
  )

  // Update displayName
  content = content.replace(
    /displayName:\s*['"]Starter['"]/g,
    `displayName: '${config.projectName}'`
  )

  // Update description
  content = content.replace(
    /description:\s*['"]Minimal starter theme for NextSpark['"]/g,
    `description: '${config.projectDescription}'`
  )

  // Update variable name
  content = content.replace(
    /export const starterThemeConfig/g,
    `export const ${toCamelCase(config.projectSlug)}ThemeConfig`
  )

  // Update default export reference (if it exists)
  content = content.replace(
    /export default starterThemeConfig/g,
    `export default ${toCamelCase(config.projectSlug)}ThemeConfig`
  )

  await fs.writeFile(themeConfigPath, content, 'utf-8')
}

/**
 * Update dev.config.ts with new email domain
 */
export async function updateDevConfig(config: WizardConfig): Promise<void> {
  const devConfigPath = path.join(getTargetThemesDir(), config.projectSlug, 'config', 'dev.config.ts')

  if (!await fs.pathExists(devConfigPath)) {
    // dev.config.ts is optional, skip if not found
    return
  }

  let content = await fs.readFile(devConfigPath, 'utf-8')

  // Replace @starter.dev with @{slug}.dev
  content = content.replace(/@starter\.dev/g, `@${config.projectSlug}.dev`)

  // Update comments referencing "Starter"
  content = content.replace(/STARTER THEME/g, `${config.projectName.toUpperCase()}`)
  content = content.replace(/Starter Theme/g, config.projectName)
  content = content.replace(/Starter Team/g, `${config.projectName} Team`)

  await fs.writeFile(devConfigPath, content, 'utf-8')
}

/**
 * Update app.config.ts with project settings
 */
export async function updateAppConfig(config: WizardConfig): Promise<void> {
  const appConfigPath = path.join(getTargetThemesDir(), config.projectSlug, 'config', 'app.config.ts')

  if (!await fs.pathExists(appConfigPath)) {
    throw new Error(`app.config.ts not found at: ${appConfigPath}`)
  }

  let content = await fs.readFile(appConfigPath, 'utf-8')

  // Update app name
  content = content.replace(
    /name:\s*['"]Starter['"]/g,
    `name: '${config.projectName}'`
  )

  // Update team mode
  content = content.replace(
    /mode:\s*['"]multi-tenant['"]\s*as\s*const/g,
    `mode: '${config.teamMode}' as const`
  )

  // Update supported locales
  const localesArray = config.supportedLocales.map(l => `'${l}'`).join(', ')
  content = content.replace(
    /supportedLocales:\s*\[.*?\]/g,
    `supportedLocales: [${localesArray}]`
  )

  // Update default locale
  content = content.replace(
    /defaultLocale:\s*['"]en['"]\s*as\s*const/g,
    `defaultLocale: '${config.defaultLocale}' as const`
  )

  // Update docs label
  content = content.replace(
    /label:\s*['"]Starter['"]/g,
    `label: '${config.projectName}'`
  )

  await fs.writeFile(appConfigPath, content, 'utf-8')
}

/**
 * Update billing.config.ts with billing settings
 */
export async function updateBillingConfig(config: WizardConfig): Promise<void> {
  const billingConfigPath = path.join(getTargetThemesDir(), config.projectSlug, 'config', 'billing.config.ts')

  if (!await fs.pathExists(billingConfigPath)) {
    // billing.config.ts is optional, skip if not found
    return
  }

  let content = await fs.readFile(billingConfigPath, 'utf-8')

  // Update currency
  content = content.replace(
    /currency:\s*['"]usd['"]/g,
    `currency: '${config.currency}'`
  )

  await fs.writeFile(billingConfigPath, content, 'utf-8')
}

/**
 * Update SQL migration files with new email domain
 */
export async function updateMigrations(config: WizardConfig): Promise<void> {
  const migrationsDir = path.join(getTargetThemesDir(), config.projectSlug, 'migrations')

  if (!await fs.pathExists(migrationsDir)) {
    return
  }

  const files = await fs.readdir(migrationsDir)
  const sqlFiles = files.filter(f => f.endsWith('.sql'))

  for (const file of sqlFiles) {
    const filePath = path.join(migrationsDir, file)
    let content = await fs.readFile(filePath, 'utf-8')

    // Replace @starter.dev with @{slug}.dev
    content = content.replace(/@starter\.dev/g, `@${config.projectSlug}.dev`)

    // Update comments
    content = content.replace(/Starter Theme/g, config.projectName)
    content = content.replace(/starter theme/g, config.projectSlug)

    await fs.writeFile(filePath, content, 'utf-8')
  }
}

/**
 * Convert string to camelCase
 */
function toCamelCase(str: string): string {
  return str
    .split('-')
    .map((word, index) => {
      if (index === 0) {
        return word.toLowerCase()
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join('')
}
