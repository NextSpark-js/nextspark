/**
 * Theme & Plugins Installer
 *
 * Installs themes and plugins for the wizard.
 * - In monorepo mode: copies files directly from local directories
 * - In npm mode: uses add:theme/add:plugin commands directly (same package)
 */

import { existsSync, cpSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import chalk from 'chalk'
import ora from 'ora'
import type { ThemeChoice } from '../prompts/theme-selection.js'
import type { PluginChoice } from '../prompts/plugins-selection.js'
import { addTheme } from '../../commands/add-theme.js'
import { addPlugin } from '../../commands/add-plugin.js'

/**
 * NPM package names for themes
 */
const THEME_PACKAGES: Record<string, string> = {
  'default': '@nextsparkjs/theme-default',
  'blog': '@nextsparkjs/theme-blog',
  'crm': '@nextsparkjs/theme-crm',
  'productivity': '@nextsparkjs/theme-productivity',
}

/**
 * NPM package names for plugins
 */
const PLUGIN_PACKAGES: Record<PluginChoice, string> = {
  'ai': '@nextsparkjs/plugin-ai',
  'langchain': '@nextsparkjs/plugin-langchain',
  'social-media-publisher': '@nextsparkjs/plugin-social-media-publisher',
}

/**
 * Required plugins for each theme
 */
const THEME_REQUIRED_PLUGINS: Record<string, PluginChoice[]> = {
  'default': ['langchain'],
  'blog': [],
  'crm': [],
  'productivity': [],
}

/**
 * Detect if running in monorepo development mode
 * Checks for pnpm-workspace.yaml in parent directories
 */
function isMonorepoMode(): boolean {
  const possiblePaths = [
    join(process.cwd(), 'pnpm-workspace.yaml'),
    join(process.cwd(), '..', 'pnpm-workspace.yaml'),
    join(process.cwd(), '..', '..', 'pnpm-workspace.yaml'),
  ]

  return possiblePaths.some((p) => existsSync(p))
}

/**
 * Get the monorepo root directory
 */
function getMonorepoRoot(): string | null {
  const possibleRoots = [
    process.cwd(),
    join(process.cwd(), '..'),
    join(process.cwd(), '..', '..'),
  ]

  for (const root of possibleRoots) {
    if (existsSync(join(root, 'pnpm-workspace.yaml'))) {
      return resolve(root)
    }
  }

  return null
}

/**
 * Get local package directory for development
 */
function getLocalPackageDir(type: 'theme' | 'plugin', name: string): string | null {
  const monorepoRoot = getMonorepoRoot()
  if (!monorepoRoot) return null

  const baseDir = type === 'theme' ? 'themes' : 'plugins'
  const packageDir = join(monorepoRoot, baseDir, name)

  if (existsSync(packageDir) && existsSync(join(packageDir, 'package.json'))) {
    return packageDir
  }

  return null
}

/**
 * Copy a local theme directly (monorepo mode)
 */
async function copyLocalTheme(name: string, sourceDir: string): Promise<boolean> {
  const targetDir = join(process.cwd(), 'contents', 'themes', name)

  // Ensure target parent directory exists
  const themesDir = join(process.cwd(), 'contents', 'themes')
  if (!existsSync(themesDir)) {
    mkdirSync(themesDir, { recursive: true })
  }

  // Skip if already exists
  if (existsSync(targetDir)) {
    console.log(chalk.gray(`    Theme ${name} already exists, skipping...`))
    return true
  }

  // Copy the theme
  cpSync(sourceDir, targetDir, { recursive: true })

  // Update tsconfig.json paths
  await updateTsConfigPaths(name, 'theme')

  return true
}

/**
 * Copy a local plugin directly (monorepo mode)
 */
async function copyLocalPlugin(name: string, sourceDir: string): Promise<boolean> {
  const targetDir = join(process.cwd(), 'contents', 'plugins', name)

  // Ensure target parent directory exists
  const pluginsDir = join(process.cwd(), 'contents', 'plugins')
  if (!existsSync(pluginsDir)) {
    mkdirSync(pluginsDir, { recursive: true })
  }

  // Skip if already exists
  if (existsSync(targetDir)) {
    console.log(chalk.gray(`    Plugin ${name} already exists, skipping...`))
    return true
  }

  // Copy the plugin
  cpSync(sourceDir, targetDir, { recursive: true })

  // Update tsconfig.json paths
  await updateTsConfigPaths(name, 'plugin')

  return true
}

/**
 * Update tsconfig.json with paths for the installed theme/plugin
 */
async function updateTsConfigPaths(name: string, type: 'theme' | 'plugin'): Promise<void> {
  const tsconfigPath = join(process.cwd(), 'tsconfig.json')

  if (!existsSync(tsconfigPath)) {
    return
  }

  try {
    const content = readFileSync(tsconfigPath, 'utf-8')
    const tsconfig = JSON.parse(content)

    if (!tsconfig.compilerOptions) {
      tsconfig.compilerOptions = {}
    }
    if (!tsconfig.compilerOptions.paths) {
      tsconfig.compilerOptions.paths = {}
    }

    const basePath = type === 'theme'
      ? `contents/themes/${name}`
      : `contents/plugins/${name}`

    // Add the path alias
    const aliasKey = type === 'theme'
      ? `@themes/${name}/*`
      : `@plugins/${name}/*`

    tsconfig.compilerOptions.paths[aliasKey] = [`./${basePath}/*`]

    writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2))
  } catch {
    // Ignore errors - tsconfig update is optional
  }
}

/**
 * Install a theme using direct import (same package)
 */
async function installThemeViaCli(packageSpec: string): Promise<boolean> {
  try {
    await addTheme(packageSpec, {});
    return true;
  } catch {
    return false;
  }
}

/**
 * Install a plugin using direct import (same package)
 */
async function installPluginViaCli(packageSpec: string): Promise<boolean> {
  try {
    await addPlugin(packageSpec, {});
    return true;
  } catch {
    return false;
  }
}

/**
 * Install a theme
 */
export async function installTheme(theme: ThemeChoice): Promise<boolean> {
  if (!theme) {
    return true
  }

  const spinner = ora({
    text: `Installing reference theme: ${theme}...`,
    prefixText: '  ',
  }).start()

  try {
    // Check if already installed
    const targetDir = join(process.cwd(), 'contents', 'themes', theme)
    if (existsSync(targetDir)) {
      spinner.info(chalk.gray(`Reference theme ${theme} already exists`))
      return true
    }

    // In monorepo mode, copy directly
    if (isMonorepoMode()) {
      const localDir = getLocalPackageDir('theme', theme)
      if (localDir) {
        spinner.text = `Copying reference theme from local: ${theme}...`
        const success = await copyLocalTheme(theme, localDir)

        if (success) {
          // Also install required plugins for this theme
          const requiredPlugins = THEME_REQUIRED_PLUGINS[theme] || []
          for (const plugin of requiredPlugins) {
            const pluginDir = getLocalPackageDir('plugin', plugin)
            if (pluginDir) {
              await copyLocalPlugin(plugin, pluginDir)
            }
          }

          spinner.succeed(chalk.green(`Reference theme ${theme} installed!`))
          return true
        }
      }
    }

    // NPM mode: use CLI command
    spinner.text = `Installing reference theme: ${theme}...`
    const packageSpec = THEME_PACKAGES[theme]
    const success = await installThemeViaCli(packageSpec)

    if (success) {
      spinner.succeed(chalk.green(`Reference theme ${theme} installed!`))
      return true
    } else {
      spinner.fail(chalk.red(`Failed to install theme: ${theme}`))
      console.log(chalk.gray('  Hint: Make sure @nextsparkjs/cli is installed or the theme package is published'))
      return false
    }
  } catch (error) {
    spinner.fail(chalk.red(`Failed to install theme: ${theme}`))
    if (error instanceof Error) {
      console.log(chalk.red(`  Error: ${error.message}`))
    }
    return false
  }
}

/**
 * Install plugins
 */
export async function installPlugins(plugins: PluginChoice[]): Promise<boolean> {
  if (plugins.length === 0) {
    return true
  }

  let allSuccess = true

  for (const plugin of plugins) {
    const spinner = ora({
      text: `Installing plugin: ${plugin}...`,
      prefixText: '  ',
    }).start()

    try {
      // Check if already installed
      const pluginDir = join(process.cwd(), 'contents', 'plugins', plugin)
      if (existsSync(pluginDir)) {
        spinner.info(chalk.gray(`Plugin ${plugin} already installed`))
        continue
      }

      // In monorepo mode, copy directly
      if (isMonorepoMode()) {
        const localDir = getLocalPackageDir('plugin', plugin)
        if (localDir) {
          spinner.text = `Copying plugin from local: ${plugin}...`
          const success = await copyLocalPlugin(plugin, localDir)

          if (success) {
            spinner.succeed(chalk.green(`Plugin ${plugin} installed!`))
            continue
          }
        }
      }

      // NPM mode: use CLI command
      spinner.text = `Installing plugin: ${plugin}...`
      const packageSpec = PLUGIN_PACKAGES[plugin]
      const success = await installPluginViaCli(packageSpec)

      if (success) {
        spinner.succeed(chalk.green(`Plugin ${plugin} installed!`))
      } else {
        spinner.fail(chalk.red(`Failed to install plugin: ${plugin}`))
        console.log(chalk.gray('  Hint: Make sure @nextsparkjs/cli is installed or the plugin package is published'))
        allSuccess = false
      }
    } catch (error) {
      spinner.fail(chalk.red(`Failed to install plugin: ${plugin}`))
      if (error instanceof Error) {
        console.log(chalk.red(`  Error: ${error.message}`))
      }
      allSuccess = false
    }
  }

  return allSuccess
}

/**
 * Get required plugins for a theme
 */
export function getRequiredPlugins(theme: ThemeChoice): PluginChoice[] {
  if (!theme) return []
  return THEME_REQUIRED_PLUGINS[theme] || []
}

/**
 * Install theme and plugins
 */
export async function installThemeAndPlugins(
  theme: ThemeChoice,
  plugins: PluginChoice[]
): Promise<boolean> {
  // Skip if nothing to install
  if (!theme && plugins.length === 0) {
    return true
  }

  console.log('')
  console.log(chalk.cyan('  Installing Reference Theme & Plugins'))
  console.log(chalk.gray('  ' + '-'.repeat(40)))
  console.log('')

  // Install theme first (may auto-install required plugins)
  const themeSuccess = await installTheme(theme)
  if (!themeSuccess && theme) {
    console.log(chalk.yellow('  Warning: Theme installation failed, continuing with plugins...'))
  }

  // Install additional plugins (skip those already installed by theme)
  const pluginsSuccess = await installPlugins(plugins)

  // Summary
  console.log('')
  if (themeSuccess && pluginsSuccess) {
    console.log(chalk.green('  All installations completed successfully!'))
  } else {
    console.log(chalk.yellow('  Some installations had issues. Check the messages above.'))
  }

  return themeSuccess && pluginsSuccess
}
