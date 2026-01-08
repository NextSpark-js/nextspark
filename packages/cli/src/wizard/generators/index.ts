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
  updateRolesConfig,
  updateTestFiles,
} from './theme-renamer.js'
import {
  updatePermissionsConfig,
  updateDashboardConfig,
  generateEnvExample,
  updateReadme,
  updateAuthConfig,
  updateDashboardUIConfig,
  updateDevToolsConfig,
  copyEnvExampleToEnv,
} from './config-generator.js'
import { processI18n } from './messages-generator.js'
import { copyContentFeatures } from './content-features-generator.js'
// Theme & Plugin installation
import { installThemeAndPlugins } from './theme-plugins-installer.js'
// DX improvement generators
import { setupEnvironment } from './env-setup.js'
import { setupGit } from './git-init.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export {
  copyStarterTheme,
  updateThemeConfig,
  updateDevConfig,
  updateAppConfig,
  updateBillingConfig,
  updateMigrations,
  updateRolesConfig,
  updateTestFiles,
  updatePermissionsConfig,
  updateDashboardConfig,
  generateEnvExample,
  updateReadme,
  processI18n,
  updateAuthConfig,
  updateDashboardUIConfig,
  updateDevToolsConfig,
  copyContentFeatures,
  copyEnvExampleToEnv,
  // Theme & Plugin installation
  installThemeAndPlugins,
  // DX generators
  setupEnvironment,
  setupGit,
}

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
    { src: 'eslint.config.mjs', dest: 'eslint.config.mjs', force: false },
    { src: 'scripts/cy-tags.cjs', dest: 'scripts/cy-tags.cjs', force: false },
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
 * Update or create package.json with required scripts and dependencies
 */
async function updatePackageJson(config: WizardConfig): Promise<void> {
  const packageJsonPath = path.resolve(process.cwd(), 'package.json')

  // Create package.json if it doesn't exist
  let packageJson: {
    name?: string
    version?: string
    private?: boolean
    scripts?: Record<string, string>
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  if (!await fs.pathExists(packageJsonPath)) {
    packageJson = {
      name: config.projectSlug,
      version: '0.1.0',
      private: true,
      scripts: {},
      dependencies: {},
      devDependencies: {},
    }
  } else {
    packageJson = await fs.readJson(packageJsonPath)
  }

  // Ensure scripts object exists
  packageJson.scripts = packageJson.scripts || {}

  // Add NextSpark scripts (using CLI commands where possible)
  const scriptsToAdd: Record<string, string> = {
    'dev': 'nextspark dev',
    'build': 'nextspark build',
    'start': 'next start',
    'lint': 'next lint',
    'build:registries': 'nextspark registry:build',
    'db:migrate': 'nextspark db:migrate',
    'db:seed': 'nextspark db:seed',
    'test:theme': `jest --config contents/themes/${config.projectSlug}/tests/jest/jest.config.cjs`,
    'test:e2e': `cypress run --config-file contents/themes/${config.projectSlug}/tests/cypress.config.ts`,
    'cy:open': `cypress open --config-file contents/themes/${config.projectSlug}/tests/cypress.config.ts`,
    'cy:run': `cypress run --config-file contents/themes/${config.projectSlug}/tests/cypress.config.ts`,
    'cy:tags': 'node scripts/cy-tags.cjs',
    'allure:generate': `allure generate contents/themes/${config.projectSlug}/tests/cypress/allure-results --clean -o contents/themes/${config.projectSlug}/tests/cypress/allure-report`,
    'allure:open': `allure open contents/themes/${config.projectSlug}/tests/cypress/allure-report`,
  }

  for (const [name, command] of Object.entries(scriptsToAdd)) {
    if (!packageJson.scripts[name]) {
      packageJson.scripts[name] = command
    }
  }

  // Ensure dependencies object exists
  packageJson.dependencies = packageJson.dependencies || {}

  // Core dependencies (required for Next.js + NextSpark)
  const depsToAdd: Record<string, string> = {
    // NextSpark
    '@nextsparkjs/core': '^0.1.0-beta.4',
    '@nextsparkjs/cli': '^0.1.0-beta.4',
    // Next.js + React
    'next': '^15.1.0',
    'react': '^19.0.0',
    'react-dom': '^19.0.0',
    // Auth
    'better-auth': '^1.4.0',
    // i18n
    'next-intl': '^4.0.2',
    // Database
    'drizzle-orm': '^0.41.0',
    'postgres': '^3.4.5',
    // State & Data
    '@tanstack/react-query': '^5.64.2',
    // Forms & Validation
    'zod': '^4.1.5',
    'react-hook-form': '^7.54.2',
    '@hookform/resolvers': '^5.0.1',
    // UI
    'tailwindcss': '^4.0.0',
    'class-variance-authority': '^0.7.1',
    'clsx': '^2.1.1',
    'tailwind-merge': '^2.6.0',
    'lucide-react': '^0.469.0',
    'sonner': '^1.7.4',
    // Utilities
    'date-fns': '^4.1.0',
    'nanoid': '^5.0.9',
    'slugify': '^1.6.6',
  }

  for (const [name, version] of Object.entries(depsToAdd)) {
    if (!packageJson.dependencies[name]) {
      packageJson.dependencies[name] = version
    }
  }

  // Ensure devDependencies object exists
  packageJson.devDependencies = packageJson.devDependencies || {}

  // Dev dependencies
  const devDepsToAdd: Record<string, string> = {
    // TypeScript
    'typescript': '^5.7.3',
    '@types/node': '^22.10.7',
    '@types/react': '^19.0.7',
    '@types/react-dom': '^19.0.3',
    // Tailwind
    '@tailwindcss/postcss': '^4.0.0',
    // ESLint
    'eslint': '^9.18.0',
    'eslint-config-next': '^15.1.0',
    '@eslint/eslintrc': '^3.2.0',
    // Database
    'drizzle-kit': '^0.31.4',
    // Jest
    'jest': '^29.7.0',
    'ts-jest': '^29.2.5',
    'ts-node': '^10.9.2',
    '@types/jest': '^29.5.14',
    '@testing-library/jest-dom': '^6.6.3',
    '@testing-library/react': '^16.3.0',
    'jest-environment-jsdom': '^29.7.0',
    // Cypress
    'cypress': '^14.0.0',
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

  // 3. Copy optional content features (pages entity, blog entity + block)
  await copyContentFeatures(config)

  // 4. Update theme configuration files
  await updateThemeConfig(config)
  await updateDevConfig(config)
  await updateAppConfig(config)
  await updateBillingConfig(config)
  await updateRolesConfig(config)

  // 5. Update migrations
  await updateMigrations(config)

  // 6. Update test files (replace starter path with project slug)
  await updateTestFiles(config)

  // 7. Update additional configs
  await updatePermissionsConfig(config)
  await updateDashboardConfig(config)

  // 8. Update Phase 3 configs (auth, dashboard UI, dev tools)
  await updateAuthConfig(config)
  await updateDashboardUIConfig(config)
  await updateDevToolsConfig(config)

  // 9. Process i18n files
  await processI18n(config)

  // 10. Update project files
  await updatePackageJson(config)
  await updateGitignore(config)
  await generateEnvExample(config)
  await updateReadme(config)

  // 11. Setup environment for immediate use
  await copyEnvExampleToEnv()
  // Note: Registries are built after pnpm install in wizard/index.ts
}
