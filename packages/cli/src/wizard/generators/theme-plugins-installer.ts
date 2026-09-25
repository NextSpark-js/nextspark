/** Root-first project-template and local-plugin selection for the wizard. */

import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import chalk from '../../utils/colors.js'
import ora from 'ora'
import type { ThemeChoice } from '../prompts/theme-selection.js'
import type { PluginChoice } from '../prompts/plugins-selection.js'
import { addPlugin } from '../../commands/add-plugin.js'

export const PROJECT_TEMPLATE_NAMES = ['starter', 'blog', 'crm', 'productivity'] as const
// `none` is a valid CLI value too and is handled specially by selectTheme.
// Keep this alongside the validator so command help cannot advertise a different set.
export const PROJECT_TEMPLATE_OPTIONS = [...PROJECT_TEMPLATE_NAMES, 'none'] as const
const PLUGIN_PACKAGES: Record<Exclude<PluginChoice, 'starter'>, string> = {
  ai: '@nextsparkjs/plugin-ai',
  langchain: '@nextsparkjs/plugin-langchain',
  'social-media-publisher': '@nextsparkjs/plugin-social-media-publisher',
}
const PLUGIN_OPTIONS = ['starter', ...Object.keys(PLUGIN_PACKAGES)]

function choices(options: readonly string[], includeNone = false): string {
  return [...options, ...(includeNone ? ['none'] : [])].join(', ')
}

export function selectTheme(theme: string | null | undefined): ThemeChoice {
  if (theme === null || theme === 'none') return null
  if (typeof theme !== 'string' || theme.trim() === '') {
    throw new Error(`Project template is required. Valid options: ${choices(PROJECT_TEMPLATE_OPTIONS)}.`)
  }
  if (!(PROJECT_TEMPLATE_NAMES as readonly string[]).includes(theme)) {
    throw new Error(`Unknown project template "${theme}". Valid options: ${choices(PROJECT_TEMPLATE_OPTIONS)}.`)
  }
  return theme as ThemeChoice
}

export function selectPlugins(plugins: readonly string[]): PluginChoice[] {
  return plugins.map(plugin => {
    if (typeof plugin !== 'string' || plugin.trim() === '') {
      throw new Error(`Plugin name is required. Valid options: ${choices(PLUGIN_OPTIONS)}.`)
    }
    if (!PLUGIN_OPTIONS.includes(plugin)) {
      throw new Error(`Unknown plugin "${plugin}". Valid options: ${choices(PLUGIN_OPTIONS)}.`)
    }
    return plugin as PluginChoice
  })
}

function appDir(): string {
  const cwd = process.cwd()
  const webDir = join(cwd, 'web')
  return existsSync(join(webDir, 'nextspark.config.ts')) ? webDir : cwd
}

function monorepoRoot(): string | null {
  for (const candidate of [process.cwd(), join(process.cwd(), '..'), join(process.cwd(), '..', '..')]) {
    if (existsSync(join(candidate, 'pnpm-workspace.yaml'))) return resolve(candidate)
  }
  return null
}

function localPlugin(name: string): string | null {
  const root = monorepoRoot()
  if (!root) return null
  const candidate = join(root, 'plugins', name)
  return existsSync(join(candidate, 'package.json')) ? candidate : null
}

async function copyLocalPlugin(name: string, sourceDir: string): Promise<void> {
  const targetDir = join(appDir(), 'plugins', name)
  if (existsSync(targetDir)) return
  mkdirSync(join(appDir(), 'plugins'), { recursive: true })
  cpSync(sourceDir, targetDir, { recursive: true })
}

async function installPluginViaCli(packageSpec: string): Promise<boolean> {
  const originalCwd = process.cwd()
  const target = appDir()
  if (target !== originalCwd) process.chdir(target)
  try {
    await addPlugin(packageSpec, { pendingDependencies: [] })
    return true
  } catch {
    return false
  } finally {
    if (target !== originalCwd) process.chdir(originalCwd)
  }
}

/** Templates are extracted once by generateProject; there is no post-generation theme install. */
export async function installTheme(_theme: ThemeChoice): Promise<boolean> {
  return true
}

export async function installPlugins(plugins: PluginChoice[]): Promise<boolean> {
  selectPlugins(plugins)
  let allSuccess = true

  for (const plugin of plugins) {
    if (plugin === 'starter') continue
    const spinner = ora({ text: `Installing plugin: ${plugin}...`, prefixText: '  ' }).start()
    try {
      const target = join(appDir(), 'plugins', plugin)
      if (existsSync(target)) {
        spinner.info(chalk.gray(`Plugin ${plugin} already installed`))
        continue
      }
      const local = localPlugin(plugin)
      if (local) {
        await copyLocalPlugin(plugin, local)
        spinner.succeed(chalk.green(`Plugin ${plugin} installed!`))
        continue
      }
      const success = await installPluginViaCli(PLUGIN_PACKAGES[plugin as Exclude<PluginChoice, 'starter'>])
      if (success) spinner.succeed(chalk.green(`Plugin ${plugin} installed!`))
      else {
        spinner.fail(chalk.red(`Failed to install plugin: ${plugin}`))
        allSuccess = false
      }
    } catch (error) {
      spinner.fail(chalk.red(`Failed to install plugin: ${plugin}`))
      if (error instanceof Error) console.log(chalk.red(`  Error: ${error.message}`))
      allSuccess = false
    }
  }
  return allSuccess
}

export function getRequiredPlugins(_theme: ThemeChoice): PluginChoice[] {
  return []
}

export async function installThemeAndPlugins(_theme: ThemeChoice, plugins: PluginChoice[]): Promise<boolean> {
  if (plugins.length === 0) return true
  console.log('')
  console.log(chalk.cyan('  Installing Local Plugins'))
  console.log(chalk.gray('  ' + '-'.repeat(40)))
  console.log('')
  return installPlugins(plugins)
}
