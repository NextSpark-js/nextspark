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
 * Get the templates directory path from @nextsparkjs/core
 */
function getTemplatesDir(): string {
  // In development (monorepo), templates are in core package
  // In production, they come from installed @nextsparkjs/core
  try {
    // Try to resolve from @nextsparkjs/core package
    const corePkgPath = require.resolve('@nextsparkjs/core/package.json');
    return path.join(path.dirname(corePkgPath), 'templates');
  } catch {
    // Fallback for monorepo development
    const possiblePaths = [
      path.resolve(__dirname, '../../../../../core/templates'),
      path.resolve(__dirname, '../../../../core/templates'),
      path.resolve(process.cwd(), 'node_modules/@nextsparkjs/core/templates'),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    throw new Error('Could not find @nextsparkjs/core templates directory');
  }
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
 * Update app.config.ts with selected team roles
 */
export async function updateRolesConfig(config: WizardConfig): Promise<void> {
  const appConfigPath = path.join(getTargetThemesDir(), config.projectSlug, 'config', 'app.config.ts')

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
      stripePriceIdMonthly: null,
      stripePriceIdYearly: null,
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
      stripePriceIdMonthly: 'price_pro_monthly',
      stripePriceIdYearly: 'price_pro_yearly',
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
      stripePriceIdMonthly: 'price_starter_monthly',
      stripePriceIdYearly: 'price_starter_yearly',
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
      stripePriceIdMonthly: 'price_pro_monthly',
      stripePriceIdYearly: 'price_pro_yearly',
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
      stripePriceIdMonthly: 'price_business_monthly',
      stripePriceIdYearly: 'price_business_yearly',
    },
  ]`
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
