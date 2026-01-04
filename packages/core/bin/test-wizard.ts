#!/usr/bin/env npx ts-node
/**
 * Automated Wizard Test Script
 *
 * Tests the wizard generators with different configurations
 * without requiring interactive input.
 */

import fs from 'fs-extra'
import path from 'path'
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

async function main() {
  console.log('')
  console.log(`${CYAN}╔═══════════════════════════════════════════════════════════════╗${NC}`)
  console.log(`${CYAN}║         NextSpark Wizard Automated Test Suite                 ║${NC}`)
  console.log(`${CYAN}╚═══════════════════════════════════════════════════════════════╝${NC}`)
  console.log('')

  const testBaseDir = '/tmp/nextspark-wizard-tests'

  // Clean previous tests
  log(`Cleaning previous tests at ${testBaseDir}...`)
  await fs.remove(testBaseDir)
  await fs.ensureDir(testBaseDir)
  logSuccess('Test directory prepared')

  const results: TestResult[] = []

  // Run all scenarios
  for (const scenario of TEST_SCENARIOS) {
    const result = await runScenario(scenario, testBaseDir)
    results.push(result)
  }

  // Print summary
  logSection('TEST SUMMARY')

  let allPassed = true
  for (const result of results) {
    const status = result.passed ? `${GREEN}PASS${NC}` : `${RED}FAIL${NC}`
    const checkCount = result.checks.filter(c => c.passed).length
    const totalChecks = result.checks.length
    console.log(`  ${status} ${result.scenario} (${checkCount}/${totalChecks} checks)`)

    if (!result.passed) {
      allPassed = false
      for (const error of result.errors) {
        console.log(`       ${RED}└─ ${error}${NC}`)
      }
    }
  }

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
