/**
 * Generators Index
 *
 * Orchestrates all generators to create the complete project.
 * Supports both flat (web-only) and monorepo (web+mobile) structures.
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
  updateEntityPermissions,
  updateDashboardConfig,
  generateEnvExample,
  updateReadme,
  updateAuthConfig,
  updateDashboardUIConfig,
  updateDevToolsConfig,
  copyEnvExampleToEnv,
  updateGlobalsCss,
} from './config-generator.js'
import { processI18n } from './messages-generator.js'
import { copyContentFeatures } from './content-features-generator.js'
import { getTemplatesDir } from './templates-dir.js'
// Theme & Plugin installation
import { installThemeAndPlugins } from './theme-plugins-installer.js'
// DX improvement generators
import { setupEnvironment } from './env-setup.js'
import { setupGit } from './git-init.js'
// Monorepo generator
import { generateMonorepoStructure, isMonorepoProject, getWebDir } from './monorepo-generator.js'
import { addPackageEntries } from './workspace-yaml.js'
import { writeProxyFile } from './proxy-file-writer.js'
import { ensureGeneratedPathsIgnored, TEMPLATES_GITIGNORE_ENTRY } from '../../utils/templates-gitignore.js'
import { tagGeneratedFiles } from '../../utils/sync-files.js'
import { PPR_TEMPLATE_VARIANTS } from '../../utils/sync-plan.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Resolve the version to pin @nextsparkjs/* dependencies to.
 *
 * All NextSpark packages are released in lockstep, so the generated project
 * pins every @nextsparkjs/* dependency to the exact version of the CLI that
 * generated it. This avoids the "version Frankenstein" where `latest` resolves
 * to different versions at different moments (e.g. across the web/ and mobile/
 * installs of a monorepo). Falls back to 'latest' if the version can't be read.
 */
function getNextSparkVersion(): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8'))
    return pkg.version || 'latest'
  } catch {
    return 'latest'
  }
}

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
  updateEntityPermissions,
  updateDashboardConfig,
  generateEnvExample,
  updateReadme,
  processI18n,
  updateAuthConfig,
  updateDashboardUIConfig,
  updateDevToolsConfig,
  copyContentFeatures,
  copyEnvExampleToEnv,
  updateGlobalsCss,
  // Theme & Plugin installation
  installThemeAndPlugins,
  // DX generators
  setupEnvironment,
  setupGit,
  // Monorepo generators
  generateMonorepoStructure,
  isMonorepoProject,
  getWebDir,
}

// Cache the templates directory to avoid recalculating after chdir
let cachedTemplatesDir: string | null = null;

/**
 * Copy core project files (app/, public/, config files)
 * Uses cached templates directory to work correctly after chdir
 *
 * The web app of a web-mobile project gets no pnpm-workspace.yaml: the one at
 * the repository root already lists web/ and its themes and plugins, and holds
 * the build allowlist. pnpm takes the nearest pnpm-workspace.yaml as the root
 * of the workspace, so one in web/ makes every pnpm command run there install
 * web/ as a workspace of its own first, which pnpm 11 then fails over the build
 * scripts that file does not allow.
 */
async function copyProjectFiles(config: WizardConfig): Promise<void> {
  if (!cachedTemplatesDir) {
    throw new Error('Templates directory not cached. Call cacheTemplatesDir() first.')
  }
  const templatesDir = cachedTemplatesDir
  const projectDir = process.cwd()

  // Files and directories to copy
  const itemsToCopy = [
    { src: 'app', dest: 'app', force: true },
    // lib/ ships project-local modules imported by app routes (e.g.
    // @/lib/billing/{stripe,polar}-webhook-extensions). Without it `next build`
    // fails to resolve those dynamic imports.
    { src: 'lib', dest: 'lib', force: true },
    { src: 'public', dest: 'public', force: true },
    // proxy.ts is written by writeProxyFile below: Next 15 only loads it under
    // its old name, so the file name depends on the project's Next version
    { src: 'next.config.mjs', dest: 'next.config.mjs', force: true },
    { src: 'tsconfig.json', dest: 'tsconfig.json', force: true },
    { src: 'postcss.config.mjs', dest: 'postcss.config.mjs', force: true },
    { src: 'i18n.ts', dest: 'i18n.ts', force: true },
    // pnpm-workspace.yaml is merged, not copied, and only into a web-only project: see mergeWorkspaceYaml below
    // Note: .npmrc with shamefully-hoist=true is created by create-nextspark-app
    // For monorepo projects, monorepo-generator.ts creates a more specific .npmrc with expo/react-native patterns
    { src: 'tsconfig.cypress.json', dest: 'tsconfig.cypress.json', force: false },
    { src: 'cypress.d.ts', dest: 'cypress.d.ts', force: false },
    { src: 'eslint.config.mjs', dest: 'eslint.config.mjs', force: false },
    { src: 'scripts/cy-run-prod.cjs', dest: 'scripts/cy-run-prod.cjs', force: false },
  ]

  // PPR variants stay in core, where sync:app reads them when a project uses PPR
  const pprVariants = new Set(Object.values(PPR_TEMPLATE_VARIANTS).map(file => path.join(templatesDir, 'app', file)))

  for (const item of itemsToCopy) {
    const srcPath = path.join(templatesDir, item.src)
    const destPath = path.join(projectDir, item.dest)

    if (await fs.pathExists(srcPath)) {
      if (item.force || !await fs.pathExists(destPath)) {
        await fs.copy(srcPath, destPath, { filter: source => !pprVariants.has(source) })
      }
    }
  }

  await writeProxyFile(templatesDir, projectDir)

  if (!isMonorepoProject(config)) {
    await mergeWorkspaceYaml(
      path.join(templatesDir, 'pnpm-workspace.yaml'),
      path.join(projectDir, 'pnpm-workspace.yaml')
    )
  }
}

/**
 * Ensure pnpm-workspace.yaml declares the theme and plugin packages, without
 * discarding what the file already holds.
 *
 * Overwriting it wholesale used to drop the rest of the file — on pnpm 11 that
 * includes `allowBuilds`, the allowlist create-nextspark-app writes so
 * dependency install scripts run at all, and it can also hold the user's own
 * overrides or catalogs.
 */
export async function mergeWorkspaceYaml(templatePath: string, destPath: string): Promise<void> {
  if (!await fs.pathExists(templatePath)) {
    return
  }

  if (!await fs.pathExists(destPath)) {
    await fs.copy(templatePath, destPath)
    return
  }

  const existing = await fs.readFile(destPath, 'utf-8')
  const merged = addPackageEntries(existing, ['contents/themes/*', 'contents/plugins/*'])

  if (merged !== existing) {
    await fs.writeFile(destPath, merged, 'utf-8')
  }
}

/**
 * Point Turbopack's root at the monorepo root (parent of web/).
 *
 * The shared next.config.mjs template sets `turbopack.root: __dirname`, which is
 * correct for flat projects (node_modules lives alongside the config). In a
 * monorepo (web/ + mobile/), pnpm hoists dependencies to the repo root, so the
 * `next` package is symlinked from a store OUTSIDE web/. Turbopack refuses to
 * compile files outside its root, so it must be raised to the parent directory.
 *
 * Must be called from within the web directory (process.cwd() === webDir).
 */
async function patchTurbopackRootForMonorepo(): Promise<void> {
  const configPath = path.resolve(process.cwd(), 'next.config.mjs')
  if (!await fs.pathExists(configPath)) {
    return
  }
  const content = await fs.readFile(configPath, 'utf-8')
  // Only rewrite the default `root: __dirname` produced by the template.
  const patched = content.replace(
    /(turbopack:\s*\{\s*root:\s*)__dirname(\s*,?\s*\})/,
    "$1path.resolve(__dirname, '..')$2"
  )
  if (patched !== content) {
    await fs.writeFile(configPath, patched, 'utf-8')
  }
}

/**
 * True when a package.json dependency spec is an explicit local reference
 * (`file:`, `link:`, or `workspace:`) rather than something pnpm/npm resolved
 * from a registry. Used to protect a deliberately-local `@nextsparkjs/*`
 * install (e.g. from the /do:test-package validation flow) from being
 * silently repinned to a published version by the "coherent install" step
 * below (#130).
 */
function isLocalPackageRef(spec: string | undefined): boolean {
  return typeof spec === 'string' && /^(file:|link:|workspace:)/.test(spec)
}

/**
 * Update or create package.json with required scripts and dependencies
 */
export async function updatePackageJson(config: WizardConfig): Promise<void> {
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
      name: isMonorepoProject(config) ? 'web' : config.projectSlug,
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
    'lint': 'eslint .',
    'build:registries': 'nextspark registry:build',
    'db:migrate': 'nextspark db:migrate',
    'db:seed': 'nextspark db:seed',
    'update-core': 'node node_modules/@nextsparkjs/core/scripts/maintenance/update-core.mjs',
    'test': 'node node_modules/@nextsparkjs/core/scripts/test/jest-theme.mjs',
    'cy:open': 'node node_modules/@nextsparkjs/core/scripts/test/cy.mjs open',
    'cy:run': 'node node_modules/@nextsparkjs/core/scripts/test/cy.mjs run',
    'cy:tags': 'node node_modules/@nextsparkjs/core/scripts/test/cy.mjs tags',
    'cy:run:prod': 'node scripts/cy-run-prod.cjs',
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

  // Pin all @nextsparkjs/* packages to the CLI's version for a coherent install
  const nsVersion = getNextSparkVersion()

  // Core dependencies (required for Next.js + NextSpark)
  const depsToAdd: Record<string, string> = {
    // NextSpark
    '@nextsparkjs/core': nsVersion,
    '@nextsparkjs/cli': nsVersion,
    // Next.js + React
    // next/better-auth/next-intl vetted floors, kept in lockstep with this
    // monorepo's own pnpm.overrides in package.json -- see create-nextspark-app's
    // create.ts for the full rationale. better-auth is deliberately tilde-ranged
    // (not caret): 1.7.0 introduces a breaking Account table schema change
    // (accountId -> providerAccountId) this app's migrations don't account for.
    'next': '^16.3.5',
    'react': '^19.0.0',
    'react-dom': '^19.0.0',
    // Auth
    'better-auth': '~1.6.30',
    // The exact version better-auth pins, which @better-auth/core requires as a peer
    '@better-fetch/fetch': '1.3.1',
    // i18n
    'next-intl': '^4.11.0',
    // Build tools
    'jiti': '^2.0.0',
    // Database
    // drizzle-orm >= 0.45.2 fixes GHSA-gpj5-g38j-94v9 (SQL injection via mis-escaped
    // SQL identifiers, HIGH). better-auth 1.6.x already prefers ^0.45.2 as peer.
    'drizzle-orm': '^0.45.2',
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
    // Imported directly by shipped app routes (devtools docs/tests + media upload).
    // Declared as direct deps so `next build` can resolve them under pnpm
    // (they would otherwise only exist as transitive @nextsparkjs/core deps).
    'gray-matter': '^4.0.3',
    '@vercel/blob': '^2.0.0',
  }

  for (const [name, version] of Object.entries(depsToAdd)) {
    // Always (re)pin our packages to the CLI version for a coherent install;
    // pnpm may have resolved a different version during the initial install.
    // EXCEPT when the existing spec is already an explicit local reference
    // (file:/link:/workspace:) — that's never something pnpm "resolved", it's
    // someone deliberately pointing this dependency at a local tarball or
    // workspace package (the /do:test-package validation flow installs one
    // before running `nextspark init`), and clobbering it back to a published
    // npm version silently invalidates the whole point of testing local
    // changes before publishing them (#130).
    if (name.startsWith('@nextsparkjs/')) {
      if (!isLocalPackageRef(packageJson.dependencies[name])) {
        packageJson.dependencies[name] = version
      }
    } else if (!packageJson.dependencies[name]) {
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
    'eslint-config-next': '^16.3.5',
    // Database
    'drizzle-kit': '^0.31.4',
    // Jest
    'jest': '^29.7.0',
    'ts-jest': '^29.2.5',
    'ts-node': '^10.9.2',
    '@types/jest': '^29.5.14',
    // 6.10.0 requires Node >=22; the CLI declares Node >=20.9.0
    '@testing-library/jest-dom': '>=6.6.3 <6.10.0',
    '@testing-library/react': '^16.3.0',
    'jest-environment-jsdom': '^29.7.0',
    // Cypress
    'cypress': '^15.8.2',
    '@testing-library/cypress': '^10.0.2',
    '@cypress/webpack-preprocessor': '^6.0.2',
    '@cypress/grep': '^5.0.1',
    'ts-loader': '^9.5.1',
    'webpack': '^5.97.0',
    'allure-cypress': '^3.0.0',
    'allure-commandline': '^2.27.0',
    // NextSpark Testing (pinned to CLI version for a coherent install)
    '@nextsparkjs/testing': nsVersion,
  }

  for (const [name, version] of Object.entries(devDepsToAdd)) {
    // Always (re)pin our packages to the CLI version for a coherent install —
    // same local-reference exception as the dependencies loop above (#130).
    if (name.startsWith('@nextsparkjs/')) {
      if (!isLocalPackageRef(packageJson.devDependencies[name])) {
        packageJson.devDependencies[name] = version
      }
    } else if (!packageJson.devDependencies[name]) {
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
# Generated by the NextSpark registry build
${TEMPLATES_GITIGNORE_ENTRY}

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
    // A .gitignore with the NextSpark entries may still lack some of these
    ensureGeneratedPathsIgnored(path.dirname(gitignorePath), { writeFileSync: (file, data) => fs.writeFileSync(file, data) })
  } else {
    await fs.writeFile(gitignorePath, entriesToAdd.trim())
  }
}

/**
 * Generate complete project based on wizard configuration
 * Supports both flat (web-only) and monorepo (web+mobile) structures.
 */
export async function generateProject(config: WizardConfig): Promise<void> {
  const projectDir = process.cwd()

  // IMPORTANT: Cache templates directory BEFORE changing directories
  // This ensures we can find templates even after chdir for monorepo
  const templatesDir = getTemplatesDir(projectDir)
  cachedTemplatesDir = templatesDir

  // Determine the web directory based on project type
  const webDir = getWebDir(projectDir, config)

  // For monorepo projects, create the root structure first
  if (isMonorepoProject(config)) {
    await generateMonorepoStructure(projectDir, config)
  }

  // Change to web directory for web-specific generation (monorepo only)
  const originalCwd = process.cwd()
  if (isMonorepoProject(config)) {
    process.chdir(webDir)
  }

  try {
    // 1. Copy core project files
    await copyProjectFiles(config)

    // 1.05 In a monorepo, dependencies are hoisted to the repo root, so
    // Turbopack's root must point at the parent (repo root) — otherwise the
    // build fails with "couldn't find next/package.json" because the hoisted
    // node_modules live outside web/.
    if (isMonorepoProject(config)) {
      await patchTurbopackRootForMonorepo()
    }

    // 1.1 Update globals.css to use the correct theme path
    await updateGlobalsCss(config)

    // 2. Copy and rename starter theme
    await copyStarterTheme(config, templatesDir)

    // 2.1 Ensure contents/plugins/ directory exists (even without plugins selected)
    await fs.ensureDir(path.join(process.cwd(), 'contents', 'plugins'))

    // 3. Copy optional content features (pages entity, blog entity + block)
    await copyContentFeatures(config, templatesDir)

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
    await updateEntityPermissions(config)  // Uncomment entity permissions based on content features
    await updateDashboardConfig(config)

    // 8. Update Phase 3 configs (auth, dashboard UI, dev tools)
    await updateAuthConfig(config)
    await updateDashboardUIConfig(config)
    await updateDevToolsConfig(config)

    // 9. Process i18n files
    await processI18n(config)

    // 10. Update project files
    await updatePackageJson(config)
    if (!isMonorepoProject(config)) {
      // Only update root gitignore for flat projects
      // Monorepo has its own root gitignore created by generateMonorepoStructure
      await updateGitignore(config)
    }
    await generateEnvExample(config)
    if (!isMonorepoProject(config)) {
      // Only update root README for flat projects
      // Monorepo has its own root README created by generateMonorepoStructure
      await updateReadme(config)
    }

    // 11. Setup environment for immediate use
    await copyEnvExampleToEnv()
    // Note: Registries are built after pnpm install in wizard/index.ts

    // 12. Tag the files sync:app manages, now that the wizard's changes to them are done
    await tagGeneratedFiles(path.dirname(templatesDir), process.cwd())
  } finally {
    // Restore original directory
    if (isMonorepoProject(config)) {
      process.chdir(originalCwd)
    }
    // Clear cache
    cachedTemplatesDir = null
  }
}
