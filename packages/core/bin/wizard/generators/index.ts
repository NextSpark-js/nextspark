/**
 * Generators Index
 *
 * Orchestrates all generators to create the complete project.
 */

import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'
import type { WizardConfig } from '../types.js'
import {
  copyStarterTheme,
  updateThemeConfig,
  updateDevConfig,
  updateAppConfig,
  updateBillingConfig,
  updateMigrations,
} from './theme-renamer.js'
import {
  updatePermissionsConfig,
  updateDashboardConfig,
  generateEnvExample,
  updateReadme,
  updateAuthConfig,
  updateDashboardUIConfig,
  updateDevToolsConfig,
} from './config-generator.js'
import { processI18n } from './messages-generator.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export {
  copyStarterTheme,
  updateThemeConfig,
  updateDevConfig,
  updateAppConfig,
  updateBillingConfig,
  updateMigrations,
  updatePermissionsConfig,
  updateDashboardConfig,
  generateEnvExample,
  updateReadme,
  processI18n,
  updateAuthConfig,
  updateDashboardUIConfig,
  updateDevToolsConfig,
}

/**
 * Get the templates directory path
 */
function getTemplatesDir(): string {
  return path.resolve(__dirname, '../../../../templates')
}

/**
 * Copy core project files (app/, public/, config files)
 */
async function copyProjectFiles(): Promise<void> {
  const templatesDir = getTemplatesDir()
  const projectDir = process.cwd()

  // Files and directories to copy
  const itemsToCopy = [
    { src: 'app', dest: 'app', force: true },
    { src: 'public', dest: 'public', force: true },
    { src: 'next.config.mjs', dest: 'next.config.mjs', force: true },
    { src: 'tsconfig.json', dest: 'tsconfig.json', force: true },
    { src: 'postcss.config.mjs', dest: 'postcss.config.mjs', force: true },
    { src: 'i18n.ts', dest: 'i18n.ts', force: true },
    { src: 'npmrc', dest: '.npmrc', force: false },
    { src: 'tsconfig.cypress.json', dest: 'tsconfig.cypress.json', force: false },
    { src: 'cypress.d.ts', dest: 'cypress.d.ts', force: false },
  ]

  for (const item of itemsToCopy) {
    const srcPath = path.join(templatesDir, item.src)
    const destPath = path.join(projectDir, item.dest)

    if (await fs.pathExists(srcPath)) {
      if (item.force || !await fs.pathExists(destPath)) {
        await fs.copy(srcPath, destPath)
      }
    }
  }
}

/**
 * Update package.json with required scripts and dependencies
 */
async function updatePackageJson(config: WizardConfig): Promise<void> {
  const packageJsonPath = path.resolve(process.cwd(), 'package.json')

  if (!await fs.pathExists(packageJsonPath)) {
    throw new Error('No package.json found. Please run this command in a Node.js project.')
  }

  const packageJson = await fs.readJson(packageJsonPath)

  // Ensure scripts object exists
  packageJson.scripts = packageJson.scripts || {}

  // Add NextSpark scripts
  const scriptsToAdd: Record<string, string> = {
    'dev': 'next dev --turbopack',
    'build': 'next build',
    'start': 'next start',
    'lint': 'next lint',
    'build:registries': 'node node_modules/@nextsparkjs/core/scripts/build/registry.mjs',
    'db:migrate': 'node node_modules/@nextsparkjs/core/scripts/db/run-migrations.mjs',
    'test:theme': `jest --config contents/themes/${config.projectSlug}/tests/jest/jest.config.ts`,
    'cy:open': `cypress open --config-file contents/themes/${config.projectSlug}/tests/cypress.config.ts`,
    'cy:run': `cypress run --config-file contents/themes/${config.projectSlug}/tests/cypress.config.ts`,
    'allure:generate': `allure generate contents/themes/${config.projectSlug}/tests/cypress/allure-results --clean -o contents/themes/${config.projectSlug}/tests/cypress/allure-report`,
    'allure:open': `allure open contents/themes/${config.projectSlug}/tests/cypress/allure-report`,
  }

  for (const [name, command] of Object.entries(scriptsToAdd)) {
    if (!packageJson.scripts[name]) {
      packageJson.scripts[name] = command
    }
  }

  // Add devDependencies
  packageJson.devDependencies = packageJson.devDependencies || {}
  const devDepsToAdd: Record<string, string> = {
    '@tailwindcss/postcss': '^4',
    'jest': '^29.7.0',
    'ts-jest': '^29.2.5',
    'ts-node': '^10.9.2',
    '@types/jest': '^29.5.14',
    '@testing-library/jest-dom': '^6.6.3',
    '@testing-library/react': '^16.3.0',
    'jest-environment-jsdom': '^29.7.0',
    'cypress': '^15.0.0',
    '@testing-library/cypress': '^10.0.2',
    '@cypress/webpack-preprocessor': '^6.0.2',
    '@cypress/grep': '^4.1.0',
    'ts-loader': '^9.5.1',
    'webpack': '^5.97.0',
    'allure-cypress': '^3.0.0',
    'allure-commandline': '^2.27.0',
  }

  for (const [name, version] of Object.entries(devDepsToAdd)) {
    if (!packageJson.devDependencies[name]) {
      packageJson.devDependencies[name] = version
    }
  }

  await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 })
}

/**
 * Update .gitignore with NextSpark entries
 */
async function updateGitignore(config: WizardConfig): Promise<void> {
  const gitignorePath = path.resolve(process.cwd(), '.gitignore')

  const entriesToAdd = `
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
`

  if (await fs.pathExists(gitignorePath)) {
    const currentContent = await fs.readFile(gitignorePath, 'utf-8')
    if (!currentContent.includes('.nextspark/')) {
      await fs.appendFile(gitignorePath, entriesToAdd)
    }
  } else {
    await fs.writeFile(gitignorePath, entriesToAdd.trim())
  }
}

/**
 * Generate complete project based on wizard configuration
 */
export async function generateProject(config: WizardConfig): Promise<void> {
  // 1. Copy core project files
  await copyProjectFiles()

  // 2. Copy and rename starter theme
  await copyStarterTheme(config)

  // 3. Update theme configuration files
  await updateThemeConfig(config)
  await updateDevConfig(config)
  await updateAppConfig(config)
  await updateBillingConfig(config)

  // 4. Update migrations
  await updateMigrations(config)

  // 5. Update additional configs
  await updatePermissionsConfig(config)
  await updateDashboardConfig(config)

  // 6. Update Phase 3 configs (auth, dashboard UI, dev tools)
  await updateAuthConfig(config)
  await updateDashboardUIConfig(config)
  await updateDevToolsConfig(config)

  // 7. Process i18n files
  await processI18n(config)

  // 8. Update project files
  await updatePackageJson(config)
  await updateGitignore(config)
  await generateEnvExample(config)
  await updateReadme(config)
}
