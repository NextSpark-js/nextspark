#!/usr/bin/env npx ts-node
/**
 * Automated Wizard Test Script
 *
 * Tests the wizard generators with different configurations
 * without requiring interactive input.
 *
 * Test Categories:
 * 1. Core Generation Tests (existing)
 * 2. Demo Theme Installation Tests
 * 3. Preview Generation Tests
 * 4. Post-Generation Validation Tests
 * 5. Environment Setup Tests
 * 6. Git Integration Tests
 * 7. Health Check (Doctor) Tests
 */

import fs from 'fs-extra'
import path from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import type { WizardConfig } from './wizard/types.js'
import { PRESETS, getPreset, applyPreset } from './wizard/presets.js'
import {
  copyStarterTheme,
  updateThemeConfig,
  updateDevConfig,
  updateAppConfig,
  updateBillingConfig,
  updateMigrations,
  updatePermissionsConfig,
  updateDashboardConfig,
  processI18n,
  updateAuthConfig,
  updateDashboardUIConfig,
  updateDevToolsConfig,
} from './wizard/generators/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// =============================================================================
// FEATURE FLAGS - Enable as features are implemented
// =============================================================================
const FEATURES = {
  DEMO_THEME: true,       // Stream 1: Demo theme installation
  PREVIEW: true,          // Stream 2: Interactive preview
  VALIDATION: true,       // Stream 3: Post-generation validation
  ENV_SETUP: true,        // Stream 4: Environment setup
  GIT_INIT: true,         // Stream 5: Git integration
  DOCTOR: true,           // Stream 6: Health check command
}

// Test configurations
const TEST_SCENARIOS: { name: string; config: WizardConfig }[] = [
  {
    name: 'saas-preset',
    config: applyPreset(
      { projectName: 'TestSaaS', projectSlug: 'test-saas', projectDescription: 'Test SaaS App' },
      'saas'
    ),
  },
  {
    name: 'blog-preset',
    config: applyPreset(
      { projectName: 'TestBlog', projectSlug: 'test-blog', projectDescription: 'Test Blog' },
      'blog'
    ),
  },
  {
    name: 'crm-preset',
    config: applyPreset(
      { projectName: 'TestCRM', projectSlug: 'test-crm', projectDescription: 'Test CRM Tool' },
      'crm'
    ),
  },
  {
    name: 'multi-language',
    config: {
      projectName: 'MultiLang App',
      projectSlug: 'multi-lang',
      projectDescription: 'App with multiple languages',
      teamMode: 'multi-tenant',
      teamRoles: ['owner', 'admin', 'member'],
      defaultLocale: 'es',
      supportedLocales: ['en', 'es', 'fr', 'de'],
      billingModel: 'subscription',
      currency: 'eur',
      features: { analytics: true, teams: true, billing: true, api: true, docs: false },
      auth: { emailPassword: true, magicLink: true, googleOAuth: true, githubOAuth: true, emailVerification: true, twoFactor: true },
      dashboard: { search: true, notifications: true, themeToggle: true, sidebarCollapsed: false },
      dev: { devKeyring: true, debugMode: true },
    },
  },
  {
    name: 'minimal-single-user',
    config: {
      projectName: 'Personal App',
      projectSlug: 'personal-app',
      projectDescription: 'Minimal personal application',
      teamMode: 'single-user',
      teamRoles: ['owner'],
      defaultLocale: 'en',
      supportedLocales: ['en'],
      billingModel: 'free',
      currency: 'usd',
      features: { analytics: false, teams: false, billing: false, api: false, docs: false },
      auth: { emailPassword: true, magicLink: false, googleOAuth: false, githubOAuth: false, emailVerification: false, twoFactor: false },
      dashboard: { search: false, notifications: false, themeToggle: true, sidebarCollapsed: true },
      dev: { devKeyring: true, debugMode: false },
    },
  },
]

// Colors for output
const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const BLUE = '\x1b[34m'
const CYAN = '\x1b[36m'
const NC = '\x1b[0m'

function log(msg: string) { console.log(`  ${msg}`) }
function logSuccess(msg: string) { console.log(`  ${GREEN}✓ ${msg}${NC}`) }
function logError(msg: string) { console.log(`  ${RED}✗ ${msg}${NC}`) }
function logInfo(msg: string) { console.log(`  ${CYAN}ℹ ${msg}${NC}`) }
function logSection(msg: string) {
  console.log('')
  console.log(`${BLUE}═══════════════════════════════════════════════════════════════${NC}`)
  console.log(`${CYAN}  ${msg}${NC}`)
  console.log(`${BLUE}═══════════════════════════════════════════════════════════════${NC}`)
}

interface TestResult {
  scenario: string
  passed: boolean
  errors: string[]
  checks: { name: string; passed: boolean }[]
}

async function validateGeneratedTheme(config: WizardConfig, testDir: string): Promise<TestResult> {
  const result: TestResult = {
    scenario: config.projectSlug,
    passed: true,
    errors: [],
    checks: [],
  }

  const themePath = path.join(testDir, 'contents', 'themes', config.projectSlug)

  // Check 1: Theme directory exists
  const themeExists = await fs.pathExists(themePath)
  result.checks.push({ name: 'Theme directory exists', passed: themeExists })
  if (!themeExists) {
    result.passed = false
    result.errors.push(`Theme directory not found: ${themePath}`)
    return result
  }

  // Check 2: Config files exist
  const configFiles = ['theme.config.ts', 'app.config.ts', 'dashboard.config.ts', 'dev.config.ts']
  for (const file of configFiles) {
    const filePath = path.join(themePath, 'config', file)
    const exists = await fs.pathExists(filePath)
    result.checks.push({ name: `config/${file} exists`, passed: exists })
    if (!exists) {
      result.passed = false
      result.errors.push(`Missing config file: ${file}`)
    }
  }

  // Check 3: theme.config.ts has correct name
  const themeConfigPath = path.join(themePath, 'config', 'theme.config.ts')
  if (await fs.pathExists(themeConfigPath)) {
    const content = await fs.readFile(themeConfigPath, 'utf-8')
    const hasCorrectName = content.includes(`name: '${config.projectSlug}'`)
    const hasCorrectDisplayName = content.includes(`displayName: '${config.projectName}'`)
    result.checks.push({ name: 'theme.config.ts has correct name', passed: hasCorrectName })
    result.checks.push({ name: 'theme.config.ts has correct displayName', passed: hasCorrectDisplayName })
    if (!hasCorrectName || !hasCorrectDisplayName) {
      result.passed = false
      result.errors.push('theme.config.ts not properly renamed')
    }
  }

  // Check 4: dev.config.ts has correct email domain
  const devConfigPath = path.join(themePath, 'config', 'dev.config.ts')
  if (await fs.pathExists(devConfigPath)) {
    const content = await fs.readFile(devConfigPath, 'utf-8')
    const hasCorrectDomain = content.includes(`@${config.projectSlug}.dev`)
    const noStarterDomain = !content.includes('@starter.dev')
    result.checks.push({ name: 'dev.config.ts has correct email domain', passed: hasCorrectDomain && noStarterDomain })
    if (!hasCorrectDomain || !noStarterDomain) {
      result.passed = false
      result.errors.push('dev.config.ts emails not properly renamed')
    }
  }

  // Check 5: Only selected languages exist in messages/
  const messagesDir = path.join(themePath, 'messages')
  if (await fs.pathExists(messagesDir)) {
    const folders = await fs.readdir(messagesDir)
    const languageFolders = folders.filter(f => fs.statSync(path.join(messagesDir, f)).isDirectory())

    for (const lang of languageFolders) {
      const shouldExist = config.supportedLocales.includes(lang)
      if (!shouldExist) {
        result.passed = false
        result.errors.push(`Unexpected language folder: ${lang}`)
      }
    }

    for (const lang of config.supportedLocales) {
      const exists = languageFolders.includes(lang)
      result.checks.push({ name: `messages/${lang}/ exists`, passed: exists })
      if (!exists) {
        result.passed = false
        result.errors.push(`Missing language folder: ${lang}`)
      }
    }
  }

  // Check 6: Entity exists
  const tasksEntityPath = path.join(themePath, 'entities', 'tasks')
  const entityExists = await fs.pathExists(tasksEntityPath)
  result.checks.push({ name: 'entities/tasks exists', passed: entityExists })

  // Check 7: Migrations exist
  const migrationsPath = path.join(themePath, 'migrations')
  const migrationsExist = await fs.pathExists(migrationsPath)
  result.checks.push({ name: 'migrations/ exists', passed: migrationsExist })

  // Check 8: Block exists
  const heroBlockPath = path.join(themePath, 'blocks', 'hero')
  const blockExists = await fs.pathExists(heroBlockPath)
  result.checks.push({ name: 'blocks/hero exists', passed: blockExists })

  // Check 9: Tests exist
  const testsPath = path.join(themePath, 'tests', 'cypress')
  const testsExist = await fs.pathExists(testsPath)
  result.checks.push({ name: 'tests/cypress exists', passed: testsExist })

  return result
}

async function runScenario(scenario: { name: string; config: WizardConfig }, testBaseDir: string): Promise<TestResult> {
  const testDir = path.join(testBaseDir, scenario.name)

  logSection(`Testing: ${scenario.name}`)
  logInfo(`Project: ${scenario.config.projectName} (${scenario.config.projectSlug})`)
  logInfo(`Team Mode: ${scenario.config.teamMode}`)
  logInfo(`Languages: ${scenario.config.supportedLocales.join(', ')}`)
  logInfo(`Billing: ${scenario.config.billingModel}`)

  try {
    // Create test directory structure
    await fs.ensureDir(path.join(testDir, 'contents', 'themes'))

    // Change to test directory
    const originalCwd = process.cwd()
    process.chdir(testDir)

    // Run generators
    log('Running generators...')

    await copyStarterTheme(scenario.config)
    logSuccess('copyStarterTheme')

    await updateThemeConfig(scenario.config)
    logSuccess('updateThemeConfig')

    await updateDevConfig(scenario.config)
    logSuccess('updateDevConfig')

    await updateAppConfig(scenario.config)
    logSuccess('updateAppConfig')

    await updateBillingConfig(scenario.config)
    logSuccess('updateBillingConfig')

    await updateMigrations(scenario.config)
    logSuccess('updateMigrations')

    await updatePermissionsConfig(scenario.config)
    logSuccess('updatePermissionsConfig')

    await updateDashboardConfig(scenario.config)
    logSuccess('updateDashboardConfig')

    await updateAuthConfig(scenario.config)
    logSuccess('updateAuthConfig')

    await updateDashboardUIConfig(scenario.config)
    logSuccess('updateDashboardUIConfig')

    await updateDevToolsConfig(scenario.config)
    logSuccess('updateDevToolsConfig')

    await processI18n(scenario.config)
    logSuccess('processI18n')

    // Restore original directory
    process.chdir(originalCwd)

    // Validate generated theme
    log('')
    log('Validating generated theme...')
    const result = await validateGeneratedTheme(scenario.config, testDir)

    // Print results
    for (const check of result.checks) {
      if (check.passed) {
        logSuccess(check.name)
      } else {
        logError(check.name)
      }
    }

    return result

  } catch (error) {
    logError(`Error: ${(error as Error).message}`)
    return {
      scenario: scenario.name,
      passed: false,
      errors: [(error as Error).message],
      checks: [],
    }
  }
}

// =============================================================================
// NEW FEATURE TESTS
// =============================================================================

/**
 * Test Demo Theme Installation
 */
async function testDemoThemeInstallation(testDir: string): Promise<TestResult> {
  const result: TestResult = {
    scenario: 'demo-theme-installation',
    passed: true,
    errors: [],
    checks: [],
  }

  if (!FEATURES.DEMO_THEME) {
    result.checks.push({ name: 'Demo theme feature (SKIPPED - not implemented)', passed: true })
    return result
  }

  try {
    // Dynamic import to avoid errors if module doesn't exist
    const { installDemoTheme } = await import('./wizard/generators/demo-installer.js')

    await fs.ensureDir(path.join(testDir, 'contents', 'themes'))
    const originalCwd = process.cwd()
    process.chdir(testDir)

    await installDemoTheme()

    // Verify default theme was copied
    const defaultThemePath = path.join(testDir, 'contents', 'themes', 'default')
    const exists = await fs.pathExists(defaultThemePath)
    result.checks.push({ name: 'Default theme directory exists', passed: exists })

    // Verify theme.config.ts has langchain enabled
    const themeConfigPath = path.join(defaultThemePath, 'config', 'theme.config.ts')
    if (await fs.pathExists(themeConfigPath)) {
      const content = await fs.readFile(themeConfigPath, 'utf-8')
      const hasLangchain = content.includes('langchain')
      result.checks.push({ name: 'LangChain plugin enabled', passed: hasLangchain })
      if (!hasLangchain) {
        result.passed = false
        result.errors.push('LangChain plugin not enabled in demo theme')
      }
    }

    process.chdir(originalCwd)
  } catch (error) {
    result.passed = false
    result.errors.push(`Demo theme test failed: ${(error as Error).message}`)
  }

  return result
}

/**
 * Test Interactive Preview
 */
async function testPreviewGeneration(config: WizardConfig): Promise<TestResult> {
  const result: TestResult = {
    scenario: 'preview-generation',
    passed: true,
    errors: [],
    checks: [],
  }

  if (!FEATURES.PREVIEW) {
    result.checks.push({ name: 'Preview feature (SKIPPED - not implemented)', passed: true })
    return result
  }

  try {
    const { getFileTree, showConfigPreview } = await import('./wizard/preview.js')

    // Test file tree generation
    const fileTree = getFileTree(config)
    result.checks.push({ name: 'File tree generated', passed: Array.isArray(fileTree) })
    result.checks.push({ name: 'File tree not empty', passed: fileTree.length > 0 })

    // Verify language folders match config
    const langFolders = fileTree.filter(f => f.includes('messages/'))
    for (const locale of config.supportedLocales) {
      const hasLocale = langFolders.some(f => f.includes(`messages/${locale}`))
      result.checks.push({ name: `Preview includes messages/${locale}`, passed: hasLocale })
      if (!hasLocale) {
        result.passed = false
        result.errors.push(`Preview missing locale: ${locale}`)
      }
    }
  } catch (error) {
    result.passed = false
    result.errors.push(`Preview test failed: ${(error as Error).message}`)
  }

  return result
}

/**
 * Test Post-Generation Validation
 */
async function testValidation(themePath: string, config: WizardConfig): Promise<TestResult> {
  const result: TestResult = {
    scenario: 'post-generation-validation',
    passed: true,
    errors: [],
    checks: [],
  }

  if (!FEATURES.VALIDATION) {
    result.checks.push({ name: 'Validation feature (SKIPPED - not implemented)', passed: true })
    return result
  }

  try {
    const { validateGeneratedTheme } = await import('./wizard/validators/index.js')

    const validationResult = await validateGeneratedTheme(themePath, config)

    result.checks.push({ name: 'Validation completed', passed: true })
    result.checks.push({ name: 'Theme is valid', passed: validationResult.valid })

    if (!validationResult.valid) {
      result.passed = false
      for (const error of validationResult.errors) {
        result.errors.push(`Validation error: ${error.message}`)
      }
    }

    // Check for warnings
    if (validationResult.warnings.length > 0) {
      result.checks.push({
        name: `Warnings: ${validationResult.warnings.length}`,
        passed: true // Warnings don't fail the test
      })
    }
  } catch (error) {
    result.passed = false
    result.errors.push(`Validation test failed: ${(error as Error).message}`)
  }

  return result
}

/**
 * Test Environment Setup
 */
async function testEnvSetup(testDir: string, config: WizardConfig): Promise<TestResult> {
  const result: TestResult = {
    scenario: 'environment-setup',
    passed: true,
    errors: [],
    checks: [],
  }

  if (!FEATURES.ENV_SETUP) {
    result.checks.push({ name: 'Env setup feature (SKIPPED - not implemented)', passed: true })
    return result
  }

  try {
    const { setupEnvironment } = await import('./wizard/generators/env-setup.js')

    // Create .env.example first
    const envExamplePath = path.join(testDir, '.env.example')
    await fs.writeFile(envExamplePath, `
DATABASE_URL=
BETTER_AUTH_SECRET=
NEXT_PUBLIC_ACTIVE_THEME=
`)

    await setupEnvironment(testDir, {
      setupEnv: true,
      generateSecrets: true,
      databaseUrl: 'postgresql://test:test@localhost:5432/test'
    }, config)

    // Verify .env was created
    const envPath = path.join(testDir, '.env')
    const envExists = await fs.pathExists(envPath)
    result.checks.push({ name: '.env file created', passed: envExists })

    if (envExists) {
      const envContent = await fs.readFile(envPath, 'utf-8')

      // Check secrets were generated
      const hasAuthSecret = envContent.includes('BETTER_AUTH_SECRET=') &&
        !envContent.includes('BETTER_AUTH_SECRET=\n')
      result.checks.push({ name: 'AUTH_SECRET generated', passed: hasAuthSecret })

      // Check theme is set
      const hasTheme = envContent.includes(`NEXT_PUBLIC_ACTIVE_THEME=${config.projectSlug}`)
      result.checks.push({ name: 'ACTIVE_THEME set correctly', passed: hasTheme })

      // Check database URL
      const hasDbUrl = envContent.includes('DATABASE_URL=postgresql')
      result.checks.push({ name: 'DATABASE_URL configured', passed: hasDbUrl })
    }
  } catch (error) {
    result.passed = false
    result.errors.push(`Env setup test failed: ${(error as Error).message}`)
  }

  return result
}

/**
 * Test Git Integration
 */
async function testGitIntegration(testDir: string, config: WizardConfig): Promise<TestResult> {
  const result: TestResult = {
    scenario: 'git-integration',
    passed: true,
    errors: [],
    checks: [],
  }

  if (!FEATURES.GIT_INIT) {
    result.checks.push({ name: 'Git integration feature (SKIPPED - not implemented)', passed: true })
    return result
  }

  try {
    const { setupGit } = await import('./wizard/generators/git-init.js')

    await setupGit(testDir, {
      initGit: true,
      createCommit: true,
      commitMessage: 'Initial commit from test'
    }, config)

    // Verify .git directory exists
    const gitDirExists = await fs.pathExists(path.join(testDir, '.git'))
    result.checks.push({ name: '.git directory created', passed: gitDirExists })

    // Verify .gitignore exists
    const gitignoreExists = await fs.pathExists(path.join(testDir, '.gitignore'))
    result.checks.push({ name: '.gitignore created', passed: gitignoreExists })

    // Verify commit was created
    if (gitDirExists) {
      try {
        const log = execSync('git log --oneline -1', { cwd: testDir, encoding: 'utf-8' })
        const hasCommit = log.includes('Initial commit')
        result.checks.push({ name: 'Initial commit created', passed: hasCommit })
      } catch {
        result.checks.push({ name: 'Initial commit created', passed: false })
        result.errors.push('Failed to verify git commit')
      }
    }
  } catch (error) {
    result.passed = false
    result.errors.push(`Git integration test failed: ${(error as Error).message}`)
  }

  return result
}

/**
 * Test Health Check (Doctor) Command
 */
async function testDoctorCommand(testDir: string): Promise<TestResult> {
  const result: TestResult = {
    scenario: 'doctor-command',
    passed: true,
    errors: [],
    checks: [],
  }

  if (!FEATURES.DOCTOR) {
    result.checks.push({ name: 'Doctor feature (SKIPPED - not implemented)', passed: true })
    return result
  }

  try {
    const { runHealthCheck } = await import('./doctor/index.js')

    const healthResults = await runHealthCheck()

    result.checks.push({ name: 'Health check completed', passed: true })
    result.checks.push({ name: 'Returns array of results', passed: Array.isArray(healthResults) })

    // Count results by status
    const passed = healthResults.filter(r => r.status === 'pass').length
    const warnings = healthResults.filter(r => r.status === 'warn').length
    const failed = healthResults.filter(r => r.status === 'fail').length

    result.checks.push({ name: `Checks passed: ${passed}`, passed: true })
    result.checks.push({ name: `Checks warned: ${warnings}`, passed: true })
    result.checks.push({ name: `Checks failed: ${failed}`, passed: failed === 0 })

    if (failed > 0) {
      result.passed = false
      for (const check of healthResults.filter(r => r.status === 'fail')) {
        result.errors.push(`Health check failed: ${check.name} - ${check.message}`)
      }
    }
  } catch (error) {
    result.passed = false
    result.errors.push(`Doctor test failed: ${(error as Error).message}`)
  }

  return result
}

/**
 * Run combined scenario with all features
 */
async function runFullFeatureScenario(
  scenario: { name: string; config: WizardConfig },
  testBaseDir: string
): Promise<TestResult[]> {
  const results: TestResult[] = []
  const testDir = path.join(testBaseDir, `${scenario.name}-full-features`)

  logSection(`Testing Full Features: ${scenario.name}`)

  // Create test directory
  await fs.ensureDir(path.join(testDir, 'contents', 'themes'))

  // 1. Test demo theme first (if enabled)
  const demoResult = await testDemoThemeInstallation(testDir)
  results.push(demoResult)

  // 2. Test preview
  const previewResult = await testPreviewGeneration(scenario.config)
  results.push(previewResult)

  // 3. Run core generation
  const originalCwd = process.cwd()
  process.chdir(testDir)
  await copyStarterTheme(scenario.config)
  await updateThemeConfig(scenario.config)
  await updateDevConfig(scenario.config)
  await updateAppConfig(scenario.config)
  await updateBillingConfig(scenario.config)
  await updateMigrations(scenario.config)
  await updatePermissionsConfig(scenario.config)
  await updateDashboardConfig(scenario.config)
  await updateAuthConfig(scenario.config)
  await updateDashboardUIConfig(scenario.config)
  await updateDevToolsConfig(scenario.config)
  await processI18n(scenario.config)
  process.chdir(originalCwd)

  const themePath = path.join(testDir, 'contents', 'themes', scenario.config.projectSlug)

  // 4. Test validation
  const validationResult = await testValidation(themePath, scenario.config)
  results.push(validationResult)

  // 5. Test env setup
  const envResult = await testEnvSetup(testDir, scenario.config)
  results.push(envResult)

  // 6. Test git integration
  const gitResult = await testGitIntegration(testDir, scenario.config)
  results.push(gitResult)

  // 7. Test doctor
  const doctorResult = await testDoctorCommand(testDir)
  results.push(doctorResult)

  return results
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

async function main() {
  console.log('')
  console.log(`${CYAN}╔═══════════════════════════════════════════════════════════════╗${NC}`)
  console.log(`${CYAN}║         NextSpark Wizard Automated Test Suite                 ║${NC}`)
  console.log(`${CYAN}║                    Extended Edition v2.0                      ║${NC}`)
  console.log(`${CYAN}╚═══════════════════════════════════════════════════════════════╝${NC}`)
  console.log('')

  // Show feature flags
  logSection('FEATURE FLAGS')
  for (const [feature, enabled] of Object.entries(FEATURES)) {
    if (enabled) {
      logSuccess(`${feature}: ENABLED`)
    } else {
      logInfo(`${feature}: disabled`)
    }
  }

  const testBaseDir = '/tmp/nextspark-wizard-tests'

  // Clean previous tests
  log('')
  log(`Cleaning previous tests at ${testBaseDir}...`)
  await fs.remove(testBaseDir)
  await fs.ensureDir(testBaseDir)
  logSuccess('Test directory prepared')

  const results: TestResult[] = []

  // ==========================================================================
  // PART 1: Core Generation Tests (existing scenarios)
  // ==========================================================================
  logSection('PART 1: CORE GENERATION TESTS')

  for (const scenario of TEST_SCENARIOS) {
    const result = await runScenario(scenario, testBaseDir)
    results.push(result)
  }

  // ==========================================================================
  // PART 2: New Feature Tests
  // ==========================================================================
  logSection('PART 2: NEW FEATURE TESTS')

  // Run full feature tests on select scenarios
  const fullFeatureScenarios = [
    TEST_SCENARIOS[0], // saas-preset
    TEST_SCENARIOS[3], // multi-language
  ]

  for (const scenario of fullFeatureScenarios) {
    const featureResults = await runFullFeatureScenario(scenario, testBaseDir)
    results.push(...featureResults)
  }

  // ==========================================================================
  // SUMMARY
  // ==========================================================================
  logSection('TEST SUMMARY')

  let allPassed = true
  let totalChecks = 0
  let passedChecks = 0

  for (const result of results) {
    const status = result.passed ? `${GREEN}PASS${NC}` : `${RED}FAIL${NC}`
    const checkCount = result.checks.filter(c => c.passed).length
    const total = result.checks.length
    totalChecks += total
    passedChecks += checkCount

    console.log(`  ${status} ${result.scenario} (${checkCount}/${total} checks)`)

    if (!result.passed) {
      allPassed = false
      for (const error of result.errors) {
        console.log(`       ${RED}└─ ${error}${NC}`)
      }
    }
  }

  console.log('')
  console.log(`  ${CYAN}Total: ${passedChecks}/${totalChecks} checks passed${NC}`)
  console.log('')

  if (allPassed) {
    console.log(`${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}`)
    console.log(`${GREEN}║                    ALL TESTS PASSED! ✓                        ║${NC}`)
    console.log(`${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}`)
  } else {
    console.log(`${RED}╔═══════════════════════════════════════════════════════════════╗${NC}`)
    console.log(`${RED}║                    SOME TESTS FAILED ✗                        ║${NC}`)
    console.log(`${RED}╚═══════════════════════════════════════════════════════════════╝${NC}`)
    process.exit(1)
  }

  console.log('')
  log(`Test artifacts available at: ${testBaseDir}`)
  console.log('')
}

main().catch(console.error)
