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
import type { WizardConfig, EntityDefinition, EntityFieldDefinition } from '@nextsparkjs/studio'

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
  onProgress: (step: string, detail?: string) => void,
  entities?: EntityDefinition[]
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

  // ── Step 1.1: Write not-found page ─────────────────────────
  await writeNotFoundPage(projectPath, config)

  // ── Step 1.2: Write mock preview pages ─────────────────────
  onProgress('Generating mock preview pages...')
  await writeMockBanner(projectPath)
  await writeMockAuthPages(projectPath, config)
  await writeMockDashboard(projectPath, config, entities)

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

async function writeNotFoundPage(
  projectPath: string,
  config: WizardConfig
): Promise<void> {
  const notFoundPath = path.join(projectPath, 'app', 'not-found.tsx')
  if (await pathExists(notFoundPath)) return

  const appName = config.projectName || 'App'
  const content = `import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <div className="mx-auto max-w-md">
        <h1 className="text-6xl font-bold tracking-tight text-foreground">404</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          This page is part of the full ${appName} application and is not available in preview mode.
        </p>
        <p className="mt-2 text-sm text-muted-foreground/60">
          Try the mock <a href="/auth/sign-up" className="text-primary hover:underline">sign up</a> or <a href="/dashboard" className="text-primary hover:underline">dashboard</a> to see a preview of the app experience.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </div>
  )
}
`
  await ensureDir(path.dirname(notFoundPath))
  await writeFile(notFoundPath, content, 'utf-8')
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

    // Update common.json and home.json in each locale
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

      // Replace "Starter" in home page messages (all locales: en="Welcome to Starter", es="Bienvenido a Starter", etc.)
      const homePath = path.join(messagesDir, locale, 'home.json')
      if (await pathExists(homePath)) {
        try {
          const homeContent = (await readJson(homePath)) as Record<string, Record<string, string>>
          if (homeContent.hero) {
            // Replace "Starter" with project name in the hero title (works for all languages)
            if (homeContent.hero.title) {
              homeContent.hero.title = homeContent.hero.title.replace(/Starter/g, config.projectName)
            }
            if (homeContent.hero.subtitle) {
              homeContent.hero.subtitle = config.projectDescription || homeContent.hero.subtitle
            }
          }
          await writeJson(homePath, homeContent)
        } catch {
          // Skip if JSON parsing fails
        }
      }
    }
  }

  // Remove unused entity messages AND their loader references in entity configs
  const entitiesDir = path.join(themePath, 'entities')
  if (await pathExists(entitiesDir)) {
    const entityFolders = await readdir(entitiesDir)
    for (const entity of entityFolders) {
      const entityMessagesDir = path.join(entitiesDir, entity, 'messages')
      if (!(await pathExists(entityMessagesDir))) continue

      // Collect locales to remove
      const localesToRemove: string[] = []
      const files = await readdir(entityMessagesDir)
      for (const file of files) {
        const locale = path.basename(file, '.json')
        if (
          Object.keys(AVAILABLE_LOCALES).includes(locale) &&
          !config.supportedLocales.includes(locale)
        ) {
          await rm(path.join(entityMessagesDir, file))
          localesToRemove.push(locale)
        }
      }

      // Remove the loader entries from entity config files
      if (localesToRemove.length > 0) {
        const configFile = path.join(entitiesDir, entity, `${entity}.config.ts`)
        if (await pathExists(configFile)) {
          let configContent = await readFile(configFile, 'utf-8')
          for (const locale of localesToRemove) {
            // Remove lines like: es: () => import('./messages/es.json'),
            configContent = configContent.replace(
              new RegExp(`\\s*${locale}:\\s*\\(\\)\\s*=>\\s*import\\([^)]+\\),?\\n?`, 'g'),
              '\n'
            )
          }
          await writeFile(configFile, configContent, 'utf-8')
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

// ============================================================
// Mock Preview Pages (Auth + Dashboard)
// ============================================================

const FAKE_NAMES = [
  'Acme Corp', 'Globex Inc', 'Initech LLC', 'Umbrella Co', 'Wayne Enterprises',
  'Stark Industries', 'Oscorp', 'Cyberdyne Systems',
]
const FAKE_FIRST_NAMES = ['Alice', 'Bob', 'Carol', 'David', 'Eva', 'Frank', 'Grace', 'Henry']
const FAKE_LAST_NAMES = ['Johnson', 'Smith', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis']
const FAKE_DOMAINS = ['acme.com', 'globex.io', 'initech.co', 'umbrella.org', 'wayne.dev', 'stark.ai', 'oscorp.net', 'cyberdyne.tech']

function generateMockValue(field: EntityFieldDefinition, rowIndex: number): string {
  const first = FAKE_FIRST_NAMES[rowIndex % FAKE_FIRST_NAMES.length]
  const last = FAKE_LAST_NAMES[rowIndex % FAKE_LAST_NAMES.length]
  switch (field.type) {
    case 'text':
    case 'textarea':
    case 'richtext':
    case 'markdown':
      if (field.name.toLowerCase().includes('name')) return `${first} ${last}`
      if (field.name.toLowerCase().includes('title')) return `${FAKE_NAMES[rowIndex % FAKE_NAMES.length]} Project`
      if (field.name.toLowerCase().includes('company')) return FAKE_NAMES[rowIndex % FAKE_NAMES.length]
      return `Sample ${field.name} ${rowIndex + 1}`
    case 'email':
      return `${first.toLowerCase()}.${last.toLowerCase()}@${FAKE_DOMAINS[rowIndex % FAKE_DOMAINS.length]}`
    case 'number':
      return String((rowIndex + 1) * 42)
    case 'currency':
      return `$${((rowIndex + 1) * 199.99).toFixed(2)}`
    case 'date':
    case 'datetime':
      return `2025-${String((rowIndex % 12) + 1).padStart(2, '0')}-${String((rowIndex % 28) + 1).padStart(2, '0')}`
    case 'boolean':
      return rowIndex % 2 === 0 ? 'Yes' : 'No'
    case 'select':
      return field.options?.[rowIndex % (field.options?.length || 1)]?.label || 'Active'
    case 'multiselect':
    case 'tags':
      return field.options?.slice(0, 2).map(o => o.label).join(', ') || 'Tag A, Tag B'
    case 'relation':
      return `${field.relation?.entity || 'Item'} #${rowIndex + 1}`
    case 'url':
      return `https://example.com/${rowIndex + 1}`
    case 'phone':
      return `+1 555-${String(1000 + rowIndex).slice(-4)}`
    case 'rating':
      return String((rowIndex % 5) + 1)
    case 'image':
    case 'file':
      return `file-${rowIndex + 1}.png`
    case 'country':
      return ['US', 'UK', 'DE', 'FR', 'JP', 'BR', 'AU', 'CA'][rowIndex % 8]
    case 'address':
      return `${100 + rowIndex} Main St`
    case 'json':
      return '{...}'
    default:
      return `Sample ${rowIndex + 1}`
  }
}

function generateMockEntityData(
  entities: EntityDefinition[]
): string {
  const entries: string[] = []

  for (const entity of entities) {
    const visibleFields = entity.fields.filter(f => f.type !== 'json')
    const fieldNames = visibleFields.map(f => `'${f.name}'`).join(', ')
    const fieldTypes: string[] = []
    for (const f of visibleFields) {
      fieldTypes.push(`${f.name}: '${f.type}'`)
    }

    const rows: string[] = []
    const rowCount = Math.min(6, Math.max(4, entity.fields.length + 2))
    for (let i = 0; i < rowCount; i++) {
      const rowFields: string[] = [`id: ${i + 1}`]
      for (const f of visibleFields) {
        const val = generateMockValue(f, i)
        rowFields.push(`${f.name}: '${val.replace(/'/g, "\\'")}'`)
      }
      rows.push(`      { ${rowFields.join(', ')} }`)
    }

    entries.push(`  '${entity.slug}': {
    name: '${entity.names.plural}',
    singular: '${entity.names.singular}',
    description: '${entity.description.replace(/'/g, "\\'")}',
    fields: [${fieldNames}],
    fieldTypes: { ${fieldTypes.join(', ')} },
    count: ${Math.floor(Math.random() * 150) + 10},
    data: [
${rows.join(',\n')}
    ]
  }`)
  }

  return `{\n${entries.join(',\n')}\n}`
}

async function writeMockBanner(projectPath: string): Promise<void> {
  const bannerPath = path.join(projectPath, 'components', 'mock-banner.tsx')
  await ensureDir(path.dirname(bannerPath))

  const content = `'use client'

import { useState, useEffect } from 'react'

export function MockBanner() {
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    setDismissed(sessionStorage.getItem('ns-banner-dismissed') === 'true')
  }, [])

  if (dismissed) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-2 bg-amber-500/95 backdrop-blur-sm px-4 py-1.5 text-xs font-medium text-amber-950 shadow-sm">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <span>Preview Mode — Data shown is simulated</span>
      <button
        onClick={() => {
          sessionStorage.setItem('ns-banner-dismissed', 'true')
          setDismissed(true)
        }}
        className="ml-1 rounded px-1 py-0.5 hover:bg-amber-600/20 transition-colors"
        aria-label="Dismiss banner"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  )
}
`
  await writeFile(bannerPath, content, 'utf-8')
}

async function writeMockAuthPages(
  projectPath: string,
  config: WizardConfig
): Promise<void> {
  const appName = config.projectName || 'App'

  // ── Sign Up ──
  const signUpPath = path.join(projectPath, 'app', 'auth', 'sign-up', 'page.tsx')
  await ensureDir(path.dirname(signUpPath))
  const signUpContent = `'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MockBanner } from '@/components/mock-banner'

function navTo(e: React.MouseEvent<HTMLAnchorElement>) {
  e.preventDefault()
  window.location.href = e.currentTarget.href
}

export default function SignUp() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    localStorage.setItem('ns-mock-user', JSON.stringify({ name: name || 'Demo User', email: email || 'demo@example.com', loggedIn: true }))
    setTimeout(() => {
      const bp = window.location.pathname.split('/auth')[0] || ''
      window.location.href = bp + '/dashboard'
    }, 400)
  }

  return (
    <>
      <MockBanner />
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg shadow-md">
              ${appName.charAt(0)}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">${appName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Create your account to get started</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1.5">Full name</label>
                <input
                  id="name" type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">Email address</label>
                <input
                  id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1.5">Password</label>
                <input
                  id="password" type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-60 transition-all"
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
          </div>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/auth/sign-in" onClick={navTo} className="font-medium text-primary hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </>
  )
}
`
  await writeFile(signUpPath, signUpContent, 'utf-8')

  // ── Sign In ──
  const signInPath = path.join(projectPath, 'app', 'auth', 'sign-in', 'page.tsx')
  await ensureDir(path.dirname(signInPath))
  const signInContent = `'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MockBanner } from '@/components/mock-banner'

function navTo(e: React.MouseEvent<HTMLAnchorElement>) {
  e.preventDefault()
  window.location.href = e.currentTarget.href
}

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    localStorage.setItem('ns-mock-user', JSON.stringify({ name: 'Demo User', email: email || 'demo@example.com', loggedIn: true }))
    setTimeout(() => {
      const bp = window.location.pathname.split('/auth')[0] || ''
      window.location.href = bp + '/dashboard'
    }, 400)
  }

  return (
    <>
      <MockBanner />
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg shadow-md">
              ${appName.charAt(0)}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">${appName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Welcome back</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">Email address</label>
                <input
                  id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1.5">Password</label>
                <input
                  id="password" type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-60 transition-all"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          </div>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/auth/sign-up" onClick={navTo} className="font-medium text-primary hover:underline">Sign up</Link>
          </p>
        </div>
      </div>
    </>
  )
}
`
  await writeFile(signInPath, signInContent, 'utf-8')
}

async function writeMockDashboard(
  projectPath: string,
  config: WizardConfig,
  entities?: EntityDefinition[]
): Promise<void> {
  const appName = config.projectName || 'App'
  const entityList = entities || []
  const mockEntitiesConst = entityList.length > 0
    ? generateMockEntityData(entityList)
    : '{}'

  // SVG icons for sidebar (inline since we can't guarantee lucide-react in preview)
  const iconHome = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`
  const iconEntity = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`
  const iconLogout = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1-2 2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`

  // Generate sidebar links from entities
  const sidebarLinks = entityList.map(e =>
    `            <Link href="/dashboard/${e.slug}" onClick={navTo} className={\`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all \${entitySlug === '${e.slug}' ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}\`}>
              <span className="flex-shrink-0 opacity-70" dangerouslySetInnerHTML={{ __html: '${iconEntity}' }} />
              <span className="truncate">${e.names.plural}</span>
              <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium tabular-nums">{MOCK_ENTITIES['${e.slug}']?.count ?? 0}</span>
            </Link>`
  ).join('\n')

  // ── Dashboard Layout ──
  const layoutPath = path.join(projectPath, 'app', 'dashboard', 'layout.tsx')
  await ensureDir(path.dirname(layoutPath))
  const layoutContent = `'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { MockBanner } from '@/components/mock-banner'

/* eslint-disable @typescript-eslint/no-explicit-any */
const MOCK_ENTITIES: Record<string, any> = ${mockEntitiesConst}

/** Force full-page navigation — works reliably with basePath proxy */
function navTo(e: React.MouseEvent<HTMLAnchorElement>) {
  e.preventDefault()
  window.location.href = e.currentTarget.href
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [user, setUser] = useState<{ name: string; email: string } | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('ns-mock-user')
    if (stored) {
      try { setUser(JSON.parse(stored)) } catch { /* ignore */ }
    }
    setReady(true)
  }, [])

  useEffect(() => {
    if (ready && !user) {
      const bp = window.location.pathname.split('/dashboard')[0] || ''
      window.location.href = bp + '/auth/sign-in'
    }
  }, [ready, user])

  if (!ready || !user) return null

  const entitySlug = pathname.split('/dashboard/')?.[1]?.split('/')?.[0] || ''
  const initials = user.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'

  function handleLogout() {
    localStorage.removeItem('ns-mock-user')
    const bp = window.location.pathname.split('/dashboard')[0] || ''
    window.location.href = bp + '/'
  }

  return (
    <>
      <MockBanner />
      <div className="flex min-h-screen bg-muted/30">
        {/* Sidebar */}
        <aside className="sticky top-0 flex h-screen w-[240px] flex-col border-r border-border bg-card">
          {/* Logo */}
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold shadow-sm">
              ${appName.charAt(0)}
            </div>
            <span className="text-sm font-semibold text-foreground truncate">${appName}</span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
            <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Menu</div>
            <Link href="/dashboard" onClick={navTo} className={\`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all \${!entitySlug ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}\`}>
              <span className="flex-shrink-0 opacity-70" dangerouslySetInnerHTML={{ __html: '${iconHome}' }} />
              <span>Overview</span>
            </Link>
            {Object.keys(MOCK_ENTITIES).length > 0 && (
              <div className="mt-4 mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Entities</div>
            )}
${sidebarLinks}
          </nav>

          {/* User */}
          <div className="border-t border-border p-3">
            <div className="flex items-center gap-3 rounded-lg px-2 py-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{user.name}</div>
                <div className="text-[11px] text-muted-foreground truncate">{user.email}</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <span className="flex-shrink-0 opacity-70" dangerouslySetInnerHTML={{ __html: '${iconLogout}' }} />
              <span>Log out</span>
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl p-8">
            {children}
          </div>
        </main>
      </div>
    </>
  )
}
`
  await writeFile(layoutPath, layoutContent, 'utf-8')

  // ── Mock (main) layout — overrides the theme's real (main)/layout to remove double sidebar ──
  const mainGroupLayoutPath = path.join(projectPath, 'app', 'dashboard', '(main)', 'layout.tsx')
  await ensureDir(path.dirname(mainGroupLayoutPath))
  const mainGroupLayoutContent = `export default function MockMainLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
`
  await writeFile(mainGroupLayoutPath, mainGroupLayoutContent, 'utf-8')

  // ── Dashboard Overview ──
  const overviewPath = path.join(projectPath, 'app', 'dashboard', 'page.tsx')
  const cardColors = ['bg-blue-500/10 text-blue-600', 'bg-emerald-500/10 text-emerald-600', 'bg-violet-500/10 text-violet-600', 'bg-amber-500/10 text-amber-600', 'bg-rose-500/10 text-rose-600', 'bg-cyan-500/10 text-cyan-600']
  const entityCards = entityList.map((e, idx) =>
    `        <Link href="/dashboard/${e.slug}" onClick={navTo} key="${e.slug}" className="group rounded-xl border border-border bg-card p-5 hover:shadow-md hover:border-border/80 transition-all">
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg ${cardColors[idx % cardColors.length]}">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            </div>
            <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors">View all →</span>
          </div>
          <div className="mt-3 text-2xl font-bold text-foreground tabular-nums">{MOCK_ENTITIES['${e.slug}']?.count ?? 0}</div>
          <div className="mt-0.5 text-sm text-muted-foreground">${e.names.plural}</div>
        </Link>`
  ).join('\n')

  const activityActions = ['created', 'updated', 'reviewed', 'archived']
  const recentActivity = entityList.slice(0, 5).map((e, i) =>
    `        <div className="flex items-center gap-3 py-3 ${i < Math.min(4, entityList.length - 1) ? 'border-b border-border' : ''}">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
            ${FAKE_FIRST_NAMES[i % FAKE_FIRST_NAMES.length].charAt(0)}${FAKE_LAST_NAMES[i % FAKE_LAST_NAMES.length].charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm text-foreground"><span className="font-medium">${FAKE_FIRST_NAMES[i % FAKE_FIRST_NAMES.length]} ${FAKE_LAST_NAMES[i % FAKE_LAST_NAMES.length]}</span> ${activityActions[i % activityActions.length]} ${'aeiou'.includes(e.names.singular.toLowerCase().charAt(0)) ? 'an' : 'a'} ${e.names.singular.toLowerCase()}</span>
          </div>
          <span className="text-xs text-muted-foreground flex-shrink-0">${i + 1}h ago</span>
        </div>`
  ).join('\n')

  const overviewContent = `'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

/* eslint-disable @typescript-eslint/no-explicit-any */
const MOCK_ENTITIES: Record<string, any> = ${mockEntitiesConst}

function navTo(e: React.MouseEvent<HTMLAnchorElement>) {
  e.preventDefault()
  window.location.href = e.currentTarget.href
}

export default function DashboardOverview() {
  const [userName, setUserName] = useState('User')

  useEffect(() => {
    try {
      const stored = localStorage.getItem('ns-mock-user')
      if (stored) {
        const user = JSON.parse(stored)
        setUserName(user.name || 'User')
      }
    } catch { /* ignore */ }
  }, [])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Welcome back, {userName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Here&apos;s an overview of your ${appName} workspace.</p>
      </div>

      ${entityList.length > 0 ? `{/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-${Math.min(entityList.length, 3)}">
${entityCards}
      </div>` : `<div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center">
        <p className="text-muted-foreground">No entities configured yet</p>
        <p className="mt-1 text-sm text-muted-foreground/60">Define entities in the Studio to see them here.</p>
      </div>`}

      ${entityList.length > 0 ? `{/* Recent Activity */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">Recent Activity</h2>
          <span className="text-xs text-muted-foreground">Last 24 hours</span>
        </div>
${recentActivity}
      </div>` : ''}
    </div>
  )
}
`
  await writeFile(overviewPath, overviewContent, 'utf-8')

  // ── Dynamic Entity Page (inside (main) route group to avoid conflict) ──
  const entityPagePath = path.join(projectPath, 'app', 'dashboard', '(main)', '[entity]', 'page.tsx')
  await ensureDir(path.dirname(entityPagePath))
  const entityPageContent = `'use client'

import { use } from 'react'
import Link from 'next/link'

/* eslint-disable @typescript-eslint/no-explicit-any */
const MOCK_ENTITIES: Record<string, any> = ${mockEntitiesConst}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
  open: 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
  placed: 'bg-blue-500/10 text-blue-700 border-blue-200',
  filled: 'bg-blue-500/10 text-blue-700 border-blue-200',
  completed: 'bg-blue-500/10 text-blue-700 border-blue-200',
  passive: 'bg-amber-500/10 text-amber-700 border-amber-200',
  'on hold': 'bg-amber-500/10 text-amber-700 border-amber-200',
  pending: 'bg-amber-500/10 text-amber-700 border-amber-200',
  scheduled: 'bg-violet-500/10 text-violet-700 border-violet-200',
  unavailable: 'bg-gray-500/10 text-gray-600 border-gray-200',
  cancelled: 'bg-red-500/10 text-red-700 border-red-200',
  rejected: 'bg-red-500/10 text-red-700 border-red-200',
}

function StatusBadge({ value }: { value: string }) {
  const key = value.toLowerCase()
  const cls = STATUS_COLORS[key] || 'bg-muted text-muted-foreground border-border'
  return <span className={\`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium \${cls}\`}>{value}</span>
}

function CellValue({ value, type }: { value: string; type: string }) {
  if (type === 'select') return <StatusBadge value={value} />
  if (type === 'email') return <span className="text-primary">{value}</span>
  if (type === 'url') return <span className="text-primary truncate max-w-[120px] inline-block">{value}</span>
  if (type === 'currency') return <span className="tabular-nums">{value}</span>
  if (type === 'boolean') return <span>{value === 'Yes' ? '✓' : '—'}</span>
  if (type === 'rating') return <span className="tabular-nums">{'★'.repeat(Number(value) || 0)}{'☆'.repeat(5 - (Number(value) || 0))}</span>
  return <span>{value}</span>
}

function navTo(e: React.MouseEvent<HTMLAnchorElement>) {
  e.preventDefault()
  window.location.href = e.currentTarget.href
}

export default function EntityPage({ params }: { params: Promise<{ entity: string }> }) {
  const { entity: slug } = use(params)
  const entityDef = MOCK_ENTITIES[slug]

  if (!entityDef) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-bold text-foreground">Entity not found</h1>
        <p className="mt-2 text-muted-foreground">The entity &quot;{slug}&quot; is not defined.</p>
        <Link href="/dashboard" onClick={navTo} className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          ← Back to Dashboard
        </Link>
      </div>
    )
  }

  // Show at most 6 columns to prevent overflow
  const maxCols = 6
  const visibleFields = entityDef.fields.slice(0, maxCols)
  const hiddenCount = Math.max(0, entityDef.fields.length - maxCols)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{entityDef.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{entityDef.description}</p>
        </div>
        <button className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-all">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New {entityDef.singular}
        </button>
      </div>

      {/* Search bar placeholder */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            type="text"
            placeholder={\`Search \${entityDef.name.toLowerCase()}...\`}
            className="w-full rounded-lg border border-border bg-card pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
            disabled
          />
        </div>
        <button className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors" disabled>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
        </button>
      </div>

      {visibleFields.length > 0 ? (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground w-12">#</th>
                  {visibleFields.map((field: string) => (
                    <th key={field} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground capitalize whitespace-nowrap">
                      {field.replace(/([A-Z])/g, ' $1').trim()}
                    </th>
                  ))}
                  {hiddenCount > 0 && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground/50">+{hiddenCount} more</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entityDef.data.map((row: any) => (
                  <tr key={row.id} className="hover:bg-muted/20 transition-colors cursor-pointer">
                    <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">{row.id}</td>
                    {visibleFields.map((field: string, i: number) => (
                      <td key={field} className={\`px-4 py-3 \${i === 0 ? 'font-medium text-foreground' : 'text-muted-foreground'} max-w-[200px] truncate\`}>
                        <CellValue value={String(row[field] ?? '-')} type={entityDef.fieldTypes?.[field] || 'text'} />
                      </td>
                    ))}
                    {hiddenCount > 0 && <td className="px-4 py-3" />}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination mock */}
          <div className="flex items-center justify-between border-t border-border px-4 py-3 bg-muted/10">
            <span className="text-xs text-muted-foreground">
              Showing {entityDef.data.length} of {entityDef.count} {entityDef.name.toLowerCase()}
            </span>
            <div className="flex items-center gap-1">
              <button className="rounded-md border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground" disabled>Previous</button>
              <button className="rounded-md bg-primary px-2.5 py-1 text-xs text-primary-foreground font-medium">1</button>
              <button className="rounded-md border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground">2</button>
              <button className="rounded-md border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground">3</button>
              <button className="rounded-md border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground" disabled>Next</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center">
          <p className="text-muted-foreground">No fields defined for this entity.</p>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground/40 text-center">All data shown is simulated for preview purposes</p>
    </div>
  )
}
`
  await writeFile(entityPagePath, entityPageContent, 'utf-8')
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
