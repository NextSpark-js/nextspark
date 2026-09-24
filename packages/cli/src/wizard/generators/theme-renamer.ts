/**
 * Theme Renamer Generator
 *
 * Copies the starter theme to a new name and updates all references.
 */

import fs from 'fs-extra'
import path from 'path'
import type { WizardConfig } from '../types.js'
import { getTemplatesDir } from './templates-dir.js'

/**
 * Get the target themes directory in the user's project
 */
function getProjectRoot(): string {
  return path.resolve(process.cwd())
}

/**
 * Copy starter theme to new location with new name
 *
 * @param templatesDir - The core templates to copy from. The default looks from
 *   the current directory, which a web + mobile project has already moved into
 *   web/ by the time its theme is copied, so the generator passes the root's.
 */
export async function copyStarterTheme(
  config: WizardConfig,
  templatesDir: string = getTemplatesDir(),
  templateName = 'starter'
): Promise<void> {
  const starterThemePath = path.join(templatesDir, 'projects', templateName)
  const newThemePath = getProjectRoot()

  // Check if starter theme exists
  if (!await fs.pathExists(starterThemePath)) {
    throw new Error(`Project template not found at: ${starterThemePath}`)
  }

  if (await fs.pathExists(path.join(newThemePath, 'config', 'theme.config.ts'))) {
    throw new Error(`Project source already exists at: ${newThemePath}`)
  }

  await fs.copy(starterThemePath, newThemePath, {
    filter: source => {
      const relative = path.relative(starterThemePath, source)
      return !['package.json', '.npmignore', 'README.md'].includes(relative)
    },
  })
}

/**
 * Update theme.config.ts with new name and display name
 */
export async function updateThemeConfig(config: WizardConfig): Promise<void> {
  const themeConfigPath = path.join(getProjectRoot(), 'config', 'theme.config.ts')

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
    `export const ${toIdentifier(config.projectSlug)}ThemeConfig`
  )

  // Update default export reference (if it exists)
  content = content.replace(
    /export default starterThemeConfig/g,
    `export default ${toIdentifier(config.projectSlug)}ThemeConfig`
  )

  await fs.writeFile(themeConfigPath, content, 'utf-8')
}

/**
 * Update dev.config.ts comments only
 *
 * NOTE: The dev keyring users (superadmin, developer) are created by core migrations
 * with fixed credentials (@nextspark.dev, Pandora1234). These should NOT be modified
 * as they are the only users that exist at init time.
 */
export async function updateDevConfig(config: WizardConfig): Promise<void> {
  const devConfigPath = path.join(getProjectRoot(), 'config', 'dev.config.ts')

  if (!await fs.pathExists(devConfigPath)) {
    // dev.config.ts is optional, skip if not found
    return
  }

  let content = await fs.readFile(devConfigPath, 'utf-8')

  // Only update comments - DO NOT modify user emails/passwords
  // The initial users (superadmin, developer) come from core with fixed credentials
  content = content.replace(/STARTER THEME/g, `${config.projectName.toUpperCase()}`)
  content = content.replace(/Starter Theme/g, config.projectName)

  await fs.writeFile(devConfigPath, content, 'utf-8')
}

/**
 * Update app.config.ts with project settings
 */
export async function updateAppConfig(config: WizardConfig): Promise<void> {
  const appConfigPath = path.join(getProjectRoot(), 'config', 'app.config.ts')

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
 * Update app.config.ts with selected team roles
 */
export async function updateRolesConfig(config: WizardConfig): Promise<void> {
  const appConfigPath = path.join(getProjectRoot(), 'config', 'app.config.ts')

  if (!await fs.pathExists(appConfigPath)) {
    return
  }

  let content = await fs.readFile(appConfigPath, 'utf-8')

  // Update availableTeamRoles if it exists
  const rolesArray = config.teamRoles.map(r => `'${r}'`).join(', ')
  content = content.replace(
    /availableTeamRoles:\s*\[.*?\]/g,
    `availableTeamRoles: [${rolesArray}]`
  )

  await fs.writeFile(appConfigPath, content, 'utf-8')
}

/**
 * Update billing.config.ts with billing settings and generate plans
 */
export async function updateBillingConfig(config: WizardConfig): Promise<void> {
  const billingConfigPath = path.join(getProjectRoot(), 'config', 'billing.config.ts')

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

  // Generate plans based on billing model
  const plansContent = generateBillingPlans(config.billingModel, config.currency)

  // Replace the plans array
  content = content.replace(
    /plans:\s*\[[\s\S]*?\],\s*\n\s*\/\/ ===+\s*\n\s*\/\/ ACTION MAPPINGS/,
    `plans: ${plansContent},

  // ===========================================
  // ACTION MAPPINGS`
  )

  await fs.writeFile(billingConfigPath, content, 'utf-8')
}

/**
 * Generate billing plans based on the selected billing model
 */
function generateBillingPlans(billingModel: string, currency: string): string {
  if (billingModel === 'free') {
    return '[]'
  }

  const currencySymbol = currency === 'eur' ? '€' : currency === 'gbp' ? '£' : '$'

  if (billingModel === 'freemium') {
    // Free + Pro plans
    return `[
    // Free Plan
    {
      slug: 'free',
      name: 'billing.plans.free.name',
      description: 'billing.plans.free.description',
      type: 'free',
      visibility: 'public',
      price: { monthly: 0, yearly: 0 },
      trialDays: 0,
      features: ['basic_analytics'],
      limits: {
        team_members: 3,
        tasks: 50,
        api_calls: 1000,
        storage_gb: 1,
      },
      providerPriceIds: { monthly: null, yearly: null },
    },
    // Pro Plan - ${currencySymbol}29/month
    {
      slug: 'pro',
      name: 'billing.plans.pro.name',
      description: 'billing.plans.pro.description',
      type: 'paid',
      visibility: 'public',
      price: {
        monthly: 2900,  // ${currencySymbol}29.00
        yearly: 29000,  // ${currencySymbol}290.00 (16% savings)
      },
      trialDays: 14,
      features: [
        'basic_analytics',
        'advanced_analytics',
        'api_access',
        'priority_support',
      ],
      limits: {
        team_members: 15,
        tasks: 1000,
        api_calls: 100000,
        storage_gb: 50,
      },
      providerPriceIds: { monthly: 'price_pro_monthly', yearly: 'price_pro_yearly' },
    },
  ]`
  }

  // paid model: Starter + Pro + Business
  return `[
    // Starter Plan - ${currencySymbol}15/month
    {
      slug: 'starter',
      name: 'billing.plans.starter.name',
      description: 'billing.plans.starter.description',
      type: 'paid',
      visibility: 'public',
      price: {
        monthly: 1500,  // ${currencySymbol}15.00
        yearly: 14400,  // ${currencySymbol}144.00 (20% savings)
      },
      trialDays: 7,
      features: [
        'basic_analytics',
        'api_access',
      ],
      limits: {
        team_members: 5,
        tasks: 200,
        api_calls: 10000,
        storage_gb: 10,
      },
      providerPriceIds: { monthly: 'price_starter_monthly', yearly: 'price_starter_yearly' },
    },
    // Pro Plan - ${currencySymbol}29/month
    {
      slug: 'pro',
      name: 'billing.plans.pro.name',
      description: 'billing.plans.pro.description',
      type: 'paid',
      visibility: 'public',
      price: {
        monthly: 2900,  // ${currencySymbol}29.00
        yearly: 29000,  // ${currencySymbol}290.00 (16% savings)
      },
      trialDays: 14,
      features: [
        'basic_analytics',
        'advanced_analytics',
        'api_access',
        'priority_support',
      ],
      limits: {
        team_members: 15,
        tasks: 1000,
        api_calls: 100000,
        storage_gb: 50,
      },
      providerPriceIds: { monthly: 'price_pro_monthly', yearly: 'price_pro_yearly' },
    },
    // Business Plan - ${currencySymbol}79/month
    {
      slug: 'business',
      name: 'billing.plans.business.name',
      description: 'billing.plans.business.description',
      type: 'paid',
      visibility: 'public',
      price: {
        monthly: 7900,  // ${currencySymbol}79.00
        yearly: 79000,  // ${currencySymbol}790.00 (16% savings)
      },
      trialDays: 14,
      features: [
        'basic_analytics',
        'advanced_analytics',
        'api_access',
        'sso',
        'audit_logs',
        'priority_support',
        'dedicated_support',
      ],
      limits: {
        team_members: 50,
        tasks: 5000,
        api_calls: 500000,
        storage_gb: 200,
      },
      providerPriceIds: { monthly: 'price_business_monthly', yearly: 'price_business_yearly' },
    },
  ]`
}

/**
 * Update SQL migration files with new email domain
 */
export async function updateMigrations(config: WizardConfig): Promise<void> {
  const migrationsDir = path.join(getProjectRoot(), 'migrations')

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
 * Update test files with new theme name
 * Normalize any stale starter-template imports to project-root aliases.
 */
export async function updateTestFiles(config: WizardConfig): Promise<void> {
  const testsDir = path.join(getProjectRoot(), 'tests')

  if (!await fs.pathExists(testsDir)) {
    return
  }

  // Find all .ts and .tsx files in tests directory recursively
  const processDir = async (dir: string) => {
    const items = await fs.readdir(dir)

    for (const item of items) {
      const itemPath = path.join(dir, item)
      const stat = await fs.stat(itemPath)

      if (stat.isDirectory()) {
        await processDir(itemPath)
      } else if (item.endsWith('.ts') || item.endsWith('.tsx')) {
        let content = await fs.readFile(itemPath, 'utf-8')

        // Replace theme path references
        const updated = content.replace(/@\/contents\/themes\/starter\//g, '@/')
        if (updated !== content) await fs.writeFile(itemPath, updated, 'utf-8')
      }
    }
  }

  await processDir(testsDir)
}

/**
 * A camelCase identifier that is always valid TypeScript.
 *
 * The slug reaches this from a directory name or `--slug`, so it can start
 * with a digit or carry characters an identifier cannot: `7startups` would
 * emit `export const 7startupsThemeConfig`, and the generated theme would not
 * compile. Prefixing is enough to make it legal, and keeps the slug readable
 * in the name.
 */
function toIdentifier(str: string): string {
  const camel = toCamelCase(str).replace(/[^A-Za-z0-9_$]/g, '')

  if (camel === '') return 'themeConfig'
  if (/^[0-9]/.test(camel)) return `theme${camel.charAt(0).toUpperCase()}${camel.slice(1)}`

  return camel
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
