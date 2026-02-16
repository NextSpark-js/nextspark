/**
 * Direct Project Generator
 *
 * Ports the CLI generation logic (create-nextspark-app + nextspark init)
 * into a self-contained module that generates projects directly from
 * bundled templates. Eliminates npm resolution and subprocess overhead.
 *
 * ~60% faster than spawning npx create-nextspark-app.
 */

import { existsSync } from 'fs'
import { readdir, readFile, writeFile, mkdir, cp, rm, stat } from 'fs/promises'
import path from 'path'
import type { WizardConfig } from '@nextsparkjs/studio'

// ============================================================
// Available locales (mirrors CLI's AVAILABLE_LOCALES)
// ============================================================

const AVAILABLE_LOCALES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
}

// ============================================================
// Templates Directory Resolution
// ============================================================

export function resolveTemplatesDir(): string {
  // Docker production: /app/templates/
  const dockerPath = '/app/templates'
  if (existsSync(dockerPath)) return dockerPath

  // Development: monorepo root packages/core/templates/
  const monorepoPath = path.resolve(process.cwd(), '../../packages/core/templates')
  if (existsSync(monorepoPath)) return monorepoPath

  // Fallback: node_modules
  const nmPath = path.resolve(process.cwd(), 'node_modules/@nextsparkjs/core/templates')
  if (existsSync(nmPath)) return nmPath

  throw new Error(
    'Could not find templates directory. Searched: /app/templates, ../../packages/core/templates, node_modules/@nextsparkjs/core/templates'
  )
}

// ============================================================
// Helpers
// ============================================================

function toCamelCase(str: string): string {
  return str
    .split('-')
    .map((word, index) =>
      index === 0
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
    .join('')
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true })
}

async function copyDir(src: string, dest: string): Promise<void> {
  await cp(src, dest, { recursive: true })
}

async function readJson(filePath: string): Promise<unknown> {
  const content = await readFile(filePath, 'utf-8')
  return JSON.parse(content)
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

/**
 * Replace content in a file if it exists. Silently skip if file missing.
 */
async function replaceInFile(
  filePath: string,
  replacements: Array<{ pattern: RegExp; replacement: string }>
): Promise<void> {
  if (!(await pathExists(filePath))) return
  let content = await readFile(filePath, 'utf-8')
  for (const { pattern, replacement } of replacements) {
    content = content.replace(pattern, replacement)
  }
  await writeFile(filePath, content, 'utf-8')
}

// ============================================================
// Main Generator
// ============================================================

export async function generateProjectDirect(
  slug: string,
  config: WizardConfig,
  options: {
    projectsRoot: string
    templatesDir: string
  },
  onProgress: (step: string, detail?: string) => void
): Promise<void> {
  const projectPath = path.join(options.projectsRoot, slug)
  const templatesDir = options.templatesDir

  // Ensure parent dir exists
  await ensureDir(options.projectsRoot)

  // Ensure project dir is clean
  if (await pathExists(projectPath)) {
    throw new Error(`Project directory already exists: ${projectPath}`)
  }
  await ensureDir(projectPath)

  // ── Step 1: Copy core project files ──────────────────────────
  onProgress('Copying project files...')
  await copyProjectFiles(projectPath, templatesDir)

  // ── Step 2: Update globals.css theme import ──────────────────
  onProgress('Configuring theme imports...')
  await updateGlobalsCss(projectPath, config)

  // ── Step 3: Copy and rename starter theme ────────────────────
  onProgress(`Setting up theme "${config.projectSlug}"...`)
  await copyStarterTheme(projectPath, templatesDir, config)

  // ── Step 3.1: Ensure contents/plugins/ directory exists ──────
  await ensureDir(path.join(projectPath, 'contents', 'plugins'))

  // ── Step 4: Copy content features (pages, blog) ──────────────
  if (config.contentFeatures.pages || config.contentFeatures.blog) {
    onProgress('Copying content features...')
    await copyContentFeatures(projectPath, templatesDir, config)
  }

  // ── Step 5: Configure project settings ───────────────────────
  onProgress('Configuring project settings...')
  const themePath = path.join(projectPath, 'contents', 'themes', config.projectSlug)

  await updateThemeConfig(themePath, config)
  await updateDevConfig(themePath, config)
  await updateAppConfig(themePath, config)
  await updateBillingConfig(themePath, config)
  await updateRolesConfig(themePath, config)

  // ── Step 6: Update migrations ────────────────────────────────
  onProgress('Updating migrations...')
  await updateMigrations(themePath, config)

  // ── Step 7: Update test files ────────────────────────────────
  await updateTestFiles(themePath, config)

  // ── Step 8: Update additional configs ────────────────────────
  onProgress('Applying configuration...')
  await updatePermissionsConfig(themePath, config)
  await updateEntityPermissions(themePath, config)
  await updateDashboardConfig(themePath, config)

  // ── Step 9: Phase 3 configs (auth, dashboard UI, dev tools) ──
  await updateAuthConfig(themePath, config)
  await updateDashboardUIConfig(themePath, config)
  await updateDevToolsConfig(themePath, config)

  // ── Step 10: Process i18n ────────────────────────────────────
  onProgress('Processing i18n files...')
  await processI18n(themePath, config)

  // ── Step 11: Write package.json ──────────────────────────────
  onProgress('Creating package.json...')
  await writePackageJson(projectPath, config)

  // ── Step 12: Write .gitignore ────────────────────────────────
  await writeGitignore(projectPath, config)

  // ── Step 13: Generate .env.example + .env ────────────────────
  onProgress('Generating environment files...')
  await generateEnvExample(projectPath, config)
  await copyEnvExampleToEnv(projectPath)

  // ── Step 14: Update README ───────────────────────────────────
  await updateReadme(themePath, config)

  onProgress('Project files generated!')
}

// ============================================================
// Individual Generator Functions
// ============================================================

async function copyProjectFiles(
  projectPath: string,
  templatesDir: string
): Promise<void> {
  const itemsToCopy = [
    { src: 'app', dest: 'app', force: true },
    { src: 'public', dest: 'public', force: true },
    { src: 'proxy.ts', dest: 'proxy.ts', force: true },
    { src: 'next.config.mjs', dest: 'next.config.mjs', force: true },
    { src: 'tsconfig.json', dest: 'tsconfig.json', force: true },
    { src: 'postcss.config.mjs', dest: 'postcss.config.mjs', force: true },
    { src: 'i18n.ts', dest: 'i18n.ts', force: true },
    // pnpm-workspace.yaml is NOT copied — Studio generates flat projects, not monorepos.
    // Including it causes pnpm to refuse auto-installing TypeScript deps (ERR_PNPM_ADDING_TO_ROOT).
    { src: 'tsconfig.cypress.json', dest: 'tsconfig.cypress.json', force: false },
    { src: 'cypress.d.ts', dest: 'cypress.d.ts', force: false },
    { src: 'eslint.config.mjs', dest: 'eslint.config.mjs', force: false },
    { src: 'scripts/cy-run-prod.cjs', dest: 'scripts/cy-run-prod.cjs', force: false },
    { src: 'instrumentation.ts', dest: 'instrumentation.ts', force: false },
  ]

  for (const item of itemsToCopy) {
    const srcPath = path.join(templatesDir, item.src)
    const destPath = path.join(projectPath, item.dest)

    if (await pathExists(srcPath)) {
      if (item.force || !(await pathExists(destPath))) {
        // Ensure parent directory exists
        await ensureDir(path.dirname(destPath))
        await cp(srcPath, destPath, { recursive: true })
      }
    }
  }
}

async function updateGlobalsCss(
  projectPath: string,
  config: WizardConfig
): Promise<void> {
  const globalsCssPath = path.join(projectPath, 'app', 'globals.css')
  await replaceInFile(globalsCssPath, [
    {
      pattern: /@import\s+["']\.\.\/contents\/themes\/[^/]+\/styles\/globals\.css["'];?/,
      replacement: `@import "../contents/themes/${config.projectSlug}/styles/globals.css";`,
    },
  ])
}

async function copyStarterTheme(
  projectPath: string,
  templatesDir: string,
  config: WizardConfig
): Promise<void> {
  const starterThemePath = path.join(templatesDir, 'contents', 'themes', 'starter')
  const targetThemePath = path.join(projectPath, 'contents', 'themes', config.projectSlug)

  if (!(await pathExists(starterThemePath))) {
    throw new Error(`Starter theme not found at: ${starterThemePath}`)
  }

  await ensureDir(path.join(projectPath, 'contents', 'themes'))
  await copyDir(starterThemePath, targetThemePath)
}

async function copyContentFeatures(
  projectPath: string,
  templatesDir: string,
  config: WizardConfig
): Promise<void> {
  const featuresDir = path.join(templatesDir, 'features')
  const targetThemeDir = path.join(projectPath, 'contents', 'themes', config.projectSlug)

  if (config.contentFeatures.pages) {
    // Copy pages entity
    const sourcePagesEntity = path.join(featuresDir, 'pages', 'entities', 'pages')
    if (await pathExists(sourcePagesEntity)) {
      await copyDir(sourcePagesEntity, path.join(targetThemeDir, 'entities', 'pages'))
    }
    // Copy hero block
    const sourceHeroBlock = path.join(featuresDir, 'pages', 'blocks', 'hero')
    if (await pathExists(sourceHeroBlock)) {
      await copyDir(sourceHeroBlock, path.join(targetThemeDir, 'blocks', 'hero'))
    }
  }

  if (config.contentFeatures.blog) {
    // Copy posts entity
    const sourcePostsEntity = path.join(featuresDir, 'blog', 'entities', 'posts')
    if (await pathExists(sourcePostsEntity)) {
      await copyDir(sourcePostsEntity, path.join(targetThemeDir, 'entities', 'posts'))
    }
    // Copy post-content block
    const sourcePostContentBlock = path.join(featuresDir, 'blog', 'blocks', 'post-content')
    if (await pathExists(sourcePostContentBlock)) {
      await copyDir(sourcePostContentBlock, path.join(targetThemeDir, 'blocks', 'post-content'))
    }
  }
}

async function updateThemeConfig(
  themePath: string,
  config: WizardConfig
): Promise<void> {
  const themeConfigPath = path.join(themePath, 'config', 'theme.config.ts')
  const camelSlug = toCamelCase(config.projectSlug)

  await replaceInFile(themeConfigPath, [
    { pattern: /name:\s*['"]starter['"]/g, replacement: `name: '${config.projectSlug}'` },
    { pattern: /displayName:\s*['"]Starter['"]/g, replacement: `displayName: '${config.projectName}'` },
    { pattern: /description:\s*['"]Minimal starter theme for NextSpark['"]/g, replacement: `description: '${config.projectDescription}'` },
    { pattern: /export const starterThemeConfig/g, replacement: `export const ${camelSlug}ThemeConfig` },
    { pattern: /export default starterThemeConfig/g, replacement: `export default ${camelSlug}ThemeConfig` },
  ])
}

async function updateDevConfig(
  themePath: string,
  config: WizardConfig
): Promise<void> {
  const devConfigPath = path.join(themePath, 'config', 'dev.config.ts')
  await replaceInFile(devConfigPath, [
    { pattern: /STARTER THEME/g, replacement: config.projectName.toUpperCase() },
    { pattern: /Starter Theme/g, replacement: config.projectName },
  ])
}

async function updateAppConfig(
  themePath: string,
  config: WizardConfig
): Promise<void> {
  const appConfigPath = path.join(themePath, 'config', 'app.config.ts')

  const localesArray = config.supportedLocales.map(l => `'${l}'`).join(', ')

  await replaceInFile(appConfigPath, [
    { pattern: /name:\s*['"]Starter['"]/g, replacement: `name: '${config.projectName}'` },
    { pattern: /mode:\s*['"]multi-tenant['"]\s*as\s*const/g, replacement: `mode: '${config.teamMode}' as const` },
    { pattern: /supportedLocales:\s*\[.*?\]/g, replacement: `supportedLocales: [${localesArray}]` },
    { pattern: /defaultLocale:\s*['"]en['"]\s*as\s*const/g, replacement: `defaultLocale: '${config.defaultLocale}' as const` },
    { pattern: /label:\s*['"]Starter['"]/g, replacement: `label: '${config.projectName}'` },
  ])
}

async function updateBillingConfig(
  themePath: string,
  config: WizardConfig
): Promise<void> {
  const billingConfigPath = path.join(themePath, 'config', 'billing.config.ts')
  if (!(await pathExists(billingConfigPath))) return

  const plansContent = generateBillingPlans(config.billingModel, config.currency)

  await replaceInFile(billingConfigPath, [
    { pattern: /currency:\s*['"]usd['"]/g, replacement: `currency: '${config.currency}'` },
    {
      pattern: /plans:\s*\[[\s\S]*?\],\s*\n\s*\/\/ ===+\s*\n\s*\/\/ ACTION MAPPINGS/,
      replacement: `plans: ${plansContent},

  // ===========================================
  // ACTION MAPPINGS`,
    },
  ])
}

function generateBillingPlans(billingModel: string, currency: string): string {
  if (billingModel === 'free') return '[]'

  const currencySymbol = currency === 'eur' ? '€' : currency === 'gbp' ? '£' : '$'

  if (billingModel === 'freemium') {
    return `[
    {
      slug: 'free',
      name: 'billing.plans.free.name',
      description: 'billing.plans.free.description',
      type: 'free',
      visibility: 'public',
      price: { monthly: 0, yearly: 0 },
      trialDays: 0,
      features: ['basic_analytics'],
      limits: { team_members: 3, tasks: 50, api_calls: 1000, storage_gb: 1 },
      stripePriceIdMonthly: null,
      stripePriceIdYearly: null,
    },
    {
      slug: 'pro',
      name: 'billing.plans.pro.name',
      description: 'billing.plans.pro.description',
      type: 'paid',
      visibility: 'public',
      price: { monthly: 2900, yearly: 29000 },
      trialDays: 14,
      features: ['basic_analytics', 'advanced_analytics', 'api_access', 'priority_support'],
      limits: { team_members: 15, tasks: 1000, api_calls: 100000, storage_gb: 50 },
      stripePriceIdMonthly: 'price_pro_monthly',
      stripePriceIdYearly: 'price_pro_yearly',
    },
  ]`
  }

  // paid model
  return `[
    {
      slug: 'starter',
      name: 'billing.plans.starter.name',
      description: 'billing.plans.starter.description',
      type: 'paid',
      visibility: 'public',
      price: { monthly: 1500, yearly: 14400 },
      trialDays: 7,
      features: ['basic_analytics', 'api_access'],
      limits: { team_members: 5, tasks: 200, api_calls: 10000, storage_gb: 10 },
      stripePriceIdMonthly: 'price_starter_monthly',
      stripePriceIdYearly: 'price_starter_yearly',
    },
    {
      slug: 'pro',
      name: 'billing.plans.pro.name',
      description: 'billing.plans.pro.description',
      type: 'paid',
      visibility: 'public',
      price: { monthly: 2900, yearly: 29000 },
      trialDays: 14,
      features: ['basic_analytics', 'advanced_analytics', 'api_access', 'priority_support'],
      limits: { team_members: 15, tasks: 1000, api_calls: 100000, storage_gb: 50 },
      stripePriceIdMonthly: 'price_pro_monthly',
      stripePriceIdYearly: 'price_pro_yearly',
    },
    {
      slug: 'business',
      name: 'billing.plans.business.name',
      description: 'billing.plans.business.description',
      type: 'paid',
      visibility: 'public',
      price: { monthly: 7900, yearly: 79000 },
      trialDays: 14,
      features: ['basic_analytics', 'advanced_analytics', 'api_access', 'sso', 'audit_logs', 'priority_support', 'dedicated_support'],
      limits: { team_members: 50, tasks: 5000, api_calls: 500000, storage_gb: 200 },
      stripePriceIdMonthly: 'price_business_monthly',
      stripePriceIdYearly: 'price_business_yearly',
    },
  ]`
}

async function updateRolesConfig(
  themePath: string,
  config: WizardConfig
): Promise<void> {
  const appConfigPath = path.join(themePath, 'config', 'app.config.ts')
  if (!(await pathExists(appConfigPath))) return

  const rolesArray = config.teamRoles.map(r => `'${r}'`).join(', ')
  await replaceInFile(appConfigPath, [
    { pattern: /availableTeamRoles:\s*\[.*?\]/g, replacement: `availableTeamRoles: [${rolesArray}]` },
  ])
}

async function updateMigrations(
  themePath: string,
  config: WizardConfig
): Promise<void> {
  const migrationsDir = path.join(themePath, 'migrations')
  if (!(await pathExists(migrationsDir))) return

  const files = await readdir(migrationsDir)
  const sqlFiles = files.filter(f => f.endsWith('.sql'))

  for (const file of sqlFiles) {
    await replaceInFile(path.join(migrationsDir, file), [
      { pattern: /@starter\.dev/g, replacement: `@${config.projectSlug}.dev` },
      { pattern: /Starter Theme/g, replacement: config.projectName },
      { pattern: /starter theme/g, replacement: config.projectSlug },
    ])
  }
}

async function updateTestFiles(
  themePath: string,
  config: WizardConfig
): Promise<void> {
  const testsDir = path.join(themePath, 'tests')
  if (!(await pathExists(testsDir))) return

  const processDir = async (dir: string) => {
    const items = await readdir(dir)

    for (const item of items) {
      const itemPath = path.join(dir, item)
      const itemStat = await stat(itemPath)

      if (itemStat.isDirectory()) {
        await processDir(itemPath)
      } else if (item.endsWith('.ts') || item.endsWith('.tsx')) {
        const content = await readFile(itemPath, 'utf-8')
        if (content.includes('@/contents/themes/starter/')) {
          const updated = content.replace(
            /@\/contents\/themes\/starter\//g,
            `@/contents/themes/${config.projectSlug}/`
          )
          await writeFile(itemPath, updated, 'utf-8')
        }
      }
    }
  }

  await processDir(testsDir)
}

async function updateAuthConfig(
  themePath: string,
  config: WizardConfig
): Promise<void> {
  const appConfigPath = path.join(themePath, 'config', 'app.config.ts')

  const replacements: Array<{ pattern: RegExp; replacement: string }> = [
    { pattern: /(mode:\s*)'open'(\s*as\s*const)/, replacement: `$1'${config.auth.registrationMode}'$2` },
    { pattern: /(google:\s*{\s*enabled:\s*)(?:true|false)/s, replacement: `$1${config.auth.googleOAuth}` },
  ]

  if (config.auth.registrationMode === 'domain-restricted') {
    replacements.push({
      pattern: /\/\/\s*allowedDomains:\s*\['yourcompany\.com'\],\s*\/\/\s*Only for 'domain-restricted' mode/,
      replacement: `allowedDomains: ['yourcompany.com'], // TODO: Replace with your domain(s)`,
    })
  }

  await replaceInFile(appConfigPath, replacements)
}

async function updateDashboardUIConfig(
  themePath: string,
  config: WizardConfig
): Promise<void> {
  const dashboardConfigPath = path.join(themePath, 'config', 'dashboard.config.ts')

  await replaceInFile(dashboardConfigPath, [
    { pattern: /(search:\s*{[^}]*enabled:\s*)(?:true|false)/gs, replacement: `$1${config.dashboard.search}` },
    { pattern: /(notifications:\s*{[^}]*enabled:\s*)(?:true|false)/gs, replacement: `$1${config.dashboard.notifications}` },
    { pattern: /(themeToggle:\s*{[^}]*enabled:\s*)(?:true|false)/gs, replacement: `$1${config.dashboard.themeToggle}` },
    { pattern: /(support:\s*{[^}]*enabled:\s*)(?:true|false)/gs, replacement: `$1${config.dashboard.support}` },
    { pattern: /(quickCreate:\s*{[^}]*enabled:\s*)(?:true|false)/gs, replacement: `$1${config.dashboard.quickCreate}` },
    { pattern: /(adminAccess:\s*{[^}]*enabled:\s*)(?:true|false)/gs, replacement: `$1${config.dashboard.superadminAccess}` },
    { pattern: /(devtoolsAccess:\s*{[^}]*enabled:\s*)(?:true|false)/gs, replacement: `$1${config.dashboard.devtoolsAccess}` },
    { pattern: /(defaultCollapsed:\s*)(?:true|false)/g, replacement: `$1${config.dashboard.sidebarCollapsed}` },
  ])
}

async function updateDevToolsConfig(
  themePath: string,
  config: WizardConfig
): Promise<void> {
  const devConfigPath = path.join(themePath, 'config', 'dev.config.ts')

  await replaceInFile(devConfigPath, [
    { pattern: /(devKeyring:\s*{[^}]*enabled:\s*)(?:true|false)/gs, replacement: `$1${config.dev.devKeyring}` },
    { pattern: /(debugMode:\s*)(?:true|false)/g, replacement: `$1${config.dev.debugMode}` },
  ])
}

async function updatePermissionsConfig(
  themePath: string,
  config: WizardConfig
): Promise<void> {
  const permissionsConfigPath = path.join(themePath, 'config', 'permissions.config.ts')
  if (!(await pathExists(permissionsConfigPath))) return

  let content = await readFile(permissionsConfigPath, 'utf-8')
  const availableRoles = config.teamRoles

  content = content.replace(/roles:\s*\[(.*?)\]/g, (_match, rolesStr: string) => {
    const currentRoles = rolesStr
      .split(',')
      .map(r => r.trim().replace(/['"]/g, ''))
      .filter(r => r.length > 0)

    const filteredRoles = currentRoles.filter(r => availableRoles.includes(r))
    if (filteredRoles.length === 0) filteredRoles.push('owner')

    return `roles: [${filteredRoles.map(r => `'${r}'`).join(', ')}]`
  })

  await writeFile(permissionsConfigPath, content, 'utf-8')
}

async function updateEntityPermissions(
  themePath: string,
  config: WizardConfig
): Promise<void> {
  const permissionsConfigPath = path.join(themePath, 'config', 'permissions.config.ts')
  if (!(await pathExists(permissionsConfigPath))) return

  let content = await readFile(permissionsConfigPath, 'utf-8')

  if (config.contentFeatures.pages) {
    content = uncommentPermissionBlock(content, 'PAGES')
  }
  if (config.contentFeatures.blog) {
    content = uncommentPermissionBlock(content, 'POSTS')
  }

  await writeFile(permissionsConfigPath, content, 'utf-8')
}

function uncommentPermissionBlock(content: string, markerName: string): string {
  const startMarker = `// __${markerName}_PERMISSIONS_START__`
  const endMarker = `// __${markerName}_PERMISSIONS_END__`

  const startIndex = content.indexOf(startMarker)
  const endIndex = content.indexOf(endMarker)

  if (startIndex === -1 || endIndex === -1) return content

  const beforeBlock = content.slice(0, startIndex)
  const block = content.slice(startIndex + startMarker.length, endIndex)
  const afterBlock = content.slice(endIndex + endMarker.length)

  const uncommentedBlock = block
    .split('\n')
    .map(line => (line.match(/^\s*\/\/\s+/) ? line.replace(/^(\s*)\/\/\s*/, '$1') : line))
    .join('\n')

  return beforeBlock + uncommentedBlock + afterBlock
}

async function updateDashboardConfig(
  themePath: string,
  config: WizardConfig
): Promise<void> {
  const dashboardConfigPath = path.join(themePath, 'config', 'dashboard.config.ts')
  if (!(await pathExists(dashboardConfigPath))) return

  const replacements: Array<{ pattern: RegExp; replacement: string }> = []

  if (!config.features.analytics) {
    replacements.push({
      pattern: /(id:\s*['"]analytics['"].*?enabled:\s*)true/gs,
      replacement: '$1false',
    })
  }

  if (!config.features.billing) {
    replacements.push({
      pattern: /(id:\s*['"]billing['"].*?enabled:\s*)true/gs,
      replacement: '$1false',
    })
  }

  if (config.teamMode === 'single-user') {
    replacements.push(
      { pattern: /(id:\s*['"]team['"].*?enabled:\s*)true/gs, replacement: '$1false' },
      { pattern: /(id:\s*['"]members['"].*?enabled:\s*)true/gs, replacement: '$1false' }
    )
  }

  if (replacements.length > 0) {
    await replaceInFile(dashboardConfigPath, replacements)
  }
}

async function processI18n(
  themePath: string,
  config: WizardConfig
): Promise<void> {
  // Remove unused language folders
  const messagesDir = path.join(themePath, 'messages')
  if (await pathExists(messagesDir)) {
    const folders = await readdir(messagesDir)
    for (const folder of folders) {
      const folderPath = path.join(messagesDir, folder)
      const folderStat = await stat(folderPath)
      if (
        folderStat.isDirectory() &&
        Object.keys(AVAILABLE_LOCALES).includes(folder) &&
        !config.supportedLocales.includes(folder)
      ) {
        await rm(folderPath, { recursive: true })
      }
    }

    // Ensure missing locale folders exist (copy from default)
    const defaultLocaleDir = path.join(messagesDir, config.defaultLocale)
    if (await pathExists(defaultLocaleDir)) {
      for (const locale of config.supportedLocales) {
        const localeDir = path.join(messagesDir, locale)
        if (!(await pathExists(localeDir))) {
          await copyDir(defaultLocaleDir, localeDir)
        }
      }
    }

    // Update common.json in each locale
    for (const locale of config.supportedLocales) {
      const commonPath = path.join(messagesDir, locale, 'common.json')
      if (await pathExists(commonPath)) {
        try {
          const content = (await readJson(commonPath)) as Record<string, Record<string, string>>
          if (content.app) {
            content.app.name = config.projectName
            if (content.app.description) {
              content.app.description = config.projectDescription
            }
          }
          await writeJson(commonPath, content)
        } catch {
          // Skip if JSON parsing fails
        }
      }
    }
  }

  // Remove unused entity messages
  const entitiesDir = path.join(themePath, 'entities')
  if (await pathExists(entitiesDir)) {
    const entityFolders = await readdir(entitiesDir)
    for (const entity of entityFolders) {
      const entityMessagesDir = path.join(entitiesDir, entity, 'messages')
      if (!(await pathExists(entityMessagesDir))) continue

      const files = await readdir(entityMessagesDir)
      for (const file of files) {
        const locale = path.basename(file, '.json')
        if (
          Object.keys(AVAILABLE_LOCALES).includes(locale) &&
          !config.supportedLocales.includes(locale)
        ) {
          await rm(path.join(entityMessagesDir, file))
        }
      }
    }
  }
}

async function writePackageJson(
  projectPath: string,
  config: WizardConfig
): Promise<void> {
  const packageJson = {
    name: config.projectSlug,
    version: '0.1.0',
    private: true,
    scripts: {
      dev: 'nextspark dev',
      build: 'nextspark build',
      start: 'next start',
      lint: 'next lint',
      'build:registries': 'nextspark registry:build',
      'db:migrate': 'nextspark db:migrate',
      'db:seed': 'nextspark db:seed',
      test: 'node node_modules/@nextsparkjs/core/scripts/test/jest-theme.mjs',
      'cy:open': 'node node_modules/@nextsparkjs/core/scripts/test/cy.mjs open',
      'cy:run': 'node node_modules/@nextsparkjs/core/scripts/test/cy.mjs run',
      'cy:tags': 'node node_modules/@nextsparkjs/core/scripts/test/cy.mjs tags',
      'cy:run:prod': 'node scripts/cy-run-prod.cjs',
      'allure:generate': `allure generate contents/themes/${config.projectSlug}/tests/cypress/allure-results --clean -o contents/themes/${config.projectSlug}/tests/cypress/allure-report`,
      'allure:open': `allure open contents/themes/${config.projectSlug}/tests/cypress/allure-report`,
    },
    dependencies: {
      // NextSpark
      '@nextsparkjs/core': 'latest',
      '@nextsparkjs/cli': 'latest',
      // Next.js + React
      next: '^15.1.0',
      react: '^19.0.0',
      'react-dom': '^19.0.0',
      // Auth
      'better-auth': '^1.4.0',
      // i18n
      'next-intl': '^4.0.2',
      // Database
      'drizzle-orm': '^0.41.0',
      postgres: '^3.4.5',
      // State & Data
      '@tanstack/react-query': '^5.64.2',
      // Forms & Validation
      zod: '^4.1.5',
      'react-hook-form': '^7.54.2',
      '@hookform/resolvers': '^5.0.1',
      // UI
      tailwindcss: '^4.0.0',
      'class-variance-authority': '^0.7.1',
      clsx: '^2.1.1',
      'tailwind-merge': '^2.6.0',
      'lucide-react': '^0.469.0',
      sonner: '^1.7.4',
      // Utilities
      'date-fns': '^4.1.0',
      nanoid: '^5.0.9',
      slugify: '^1.6.6',
      // Build tools (needed by @nextsparkjs/core registry scripts)
      jiti: '^2.6.1',
    },
    devDependencies: {
      // TypeScript
      typescript: '^5.7.3',
      '@types/node': '^22.10.7',
      '@types/react': '^19.0.7',
      '@types/react-dom': '^19.0.3',
      // Tailwind
      '@tailwindcss/postcss': '^4.0.0',
      // ESLint
      eslint: '^9.18.0',
      'eslint-config-next': '^15.1.0',
      '@eslint/eslintrc': '^3.2.0',
      // Database
      'drizzle-kit': '^0.31.4',
      // Jest
      jest: '^29.7.0',
      'ts-jest': '^29.2.5',
      'ts-node': '^10.9.2',
      '@types/jest': '^29.5.14',
      '@testing-library/jest-dom': '^6.6.3',
      '@testing-library/react': '^16.3.0',
      'jest-environment-jsdom': '^29.7.0',
      // Cypress
      cypress: '^15.8.2',
      '@testing-library/cypress': '^10.0.2',
      '@cypress/webpack-preprocessor': '^6.0.2',
      '@cypress/grep': '^5.0.1',
      'ts-loader': '^9.5.1',
      webpack: '^5.97.0',
      'allure-cypress': '^3.0.0',
      'allure-commandline': '^2.27.0',
      // NextSpark Testing
      '@nextsparkjs/testing': 'latest',
    },
    pnpm: {
      onlyBuiltDependencies: ['@nextsparkjs/core', '@nextsparkjs/ai-workflow'],
    },
  }

  await writeJson(path.join(projectPath, 'package.json'), packageJson)
}

async function writeGitignore(
  projectPath: string,
  _config: WizardConfig
): Promise<void> {
  const content = `# Dependencies
node_modules/

# Next.js
.next/
out/

# NextSpark
.nextspark/

# Cypress (theme-based)
contents/themes/*/tests/cypress/videos
contents/themes/*/tests/cypress/screenshots
contents/themes/*/tests/cypress/allure-results
contents/themes/*/tests/cypress/allure-report

# Jest (theme-based)
contents/themes/*/tests/jest/coverage

# Environment
.env
.env.local

# OS
.DS_Store
Thumbs.db
`

  await writeFile(path.join(projectPath, '.gitignore'), content, 'utf-8')
}

async function generateEnvExample(
  projectPath: string,
  config: WizardConfig
): Promise<void> {
  let oauthSection = ''
  if (config.auth.googleOAuth) {
    oauthSection = `# =============================================================================
# OAUTH PROVIDERS
# =============================================================================
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
`
  } else {
    oauthSection = `# =============================================================================
# OAUTH (Optional - enable in auth.config.ts)
# =============================================================================
# GOOGLE_CLIENT_ID=""
# GOOGLE_CLIENT_SECRET=""
`
  }

  const envContent = `# NextSpark Environment Configuration
# Generated for: ${config.projectName}

# =============================================================================
# DATABASE
# =============================================================================
DATABASE_URL="postgresql://user:password@localhost:5432/database"

# =============================================================================
# AUTHENTICATION (better-auth)
# =============================================================================
# Generate with: openssl rand -base64 32
BETTER_AUTH_SECRET="your-secret-key-here"

# =============================================================================
# THEME
# =============================================================================
NEXT_PUBLIC_ACTIVE_THEME="${config.projectSlug}"

# =============================================================================
# APPLICATION
# =============================================================================
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"

${
  config.features.billing
    ? `# =============================================================================
# STRIPE (Billing)
# =============================================================================
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
`
    : '# Billing is disabled - no Stripe configuration needed'
}

# =============================================================================
# EMAIL (Resend)
# =============================================================================
RESEND_API_KEY="re_..."

${oauthSection}`

  const envExamplePath = path.join(projectPath, '.env.example')
  if (!(await pathExists(envExamplePath))) {
    await writeFile(envExamplePath, envContent, 'utf-8')
  }
}

async function copyEnvExampleToEnv(projectPath: string): Promise<void> {
  const envExamplePath = path.join(projectPath, '.env.example')
  const envPath = path.join(projectPath, '.env')

  if ((await pathExists(envExamplePath)) && !(await pathExists(envPath))) {
    const content = await readFile(envExamplePath, 'utf-8')
    await writeFile(envPath, content, 'utf-8')
  }
}

async function updateReadme(
  themePath: string,
  config: WizardConfig
): Promise<void> {
  const readmePath = path.join(themePath, 'README.md')
  await replaceInFile(readmePath, [
    { pattern: /# Starter Theme/g, replacement: `# ${config.projectName}` },
    { pattern: /Minimal starter theme for NextSpark/g, replacement: config.projectDescription },
  ])
}
