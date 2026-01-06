import chalk from 'chalk'
import ora from 'ora'
import { fetchPackage } from '../lib/package-fetcher.js'
import { validateTheme } from '../lib/validator.js'
import { installTheme } from '../lib/installer.js'
import { runPostinstall } from '../lib/postinstall/index.js'
import { addPlugin } from './add-plugin.js'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import type { InstallOptions, PostinstallContext } from '../types/nextspark-package.js'

export async function addTheme(
  packageSpec: string,
  options: InstallOptions = {}
): Promise<void> {
  const spinner = ora(`Adding theme ${packageSpec}`).start()

  let cleanup: (() => void) | null = null

  try {
    // Pre-checks
    const contentsDir = join(process.cwd(), 'contents')
    if (!existsSync(contentsDir)) {
      spinner.fail('contents/ directory not found. Run "nextspark init" first.')
      return
    }

    // Fetch package
    spinner.text = 'Downloading package...'
    const { packageJson, extractedPath, cleanup: cleanupFn } = await fetchPackage(
      packageSpec,
      options.version
    )
    cleanup = cleanupFn

    // Validate
    spinner.text = 'Validating theme...'
    const validation = validateTheme(packageJson, extractedPath)

    if (!validation.valid) {
      spinner.fail('Invalid theme')
      validation.errors.forEach(e => console.log(chalk.red(`  ✗ ${e}`)))
      return
    }

    if (validation.warnings.length > 0) {
      validation.warnings.forEach(w => console.log(chalk.yellow(`  ⚠ ${w}`)))
    }

    // Install required plugins first (from root-level requiredPlugins)
    if (packageJson.requiredPlugins?.length && !options.skipPostinstall) {
      spinner.stop()
      console.log(chalk.blue('\n  Installing required plugins...'))

      const installingPlugins = new Set<string>()
      for (const plugin of packageJson.requiredPlugins) {
        if (!checkPluginExists(plugin)) {
          await addPlugin(plugin, { installingPlugins })
        }
      }
    }

    // Install theme
    spinner.text = 'Installing theme...'
    spinner.stop()

    const result = await installTheme(extractedPath, packageJson, options)

    // Postinstall
    if (!options.skipPostinstall) {
      const coreVersion = getCoreVersion()
      const context: PostinstallContext = {
        activeTheme: result.name, // The newly installed theme
        projectRoot: process.cwd(),
        themeName: result.name,
        coreVersion,
        timestamp: Date.now(),
        installingPlugins: new Set()
      }

      await runPostinstall(packageJson, result.installedPath, context)
    }

    console.log(chalk.green(`\n  ✓ Theme ${result.name} installed successfully!`))
    console.log(chalk.gray(`    Location: contents/themes/${result.name}/`))
    console.log(chalk.gray(`    Set NEXT_PUBLIC_ACTIVE_THEME=${result.name} to activate`))

  } catch (error) {
    spinner.fail('Failed to add theme')
    if (error instanceof Error) {
      console.log(chalk.red(`  ${error.message}`))
    }
    throw error
  } finally {
    if (cleanup) cleanup()
  }
}

function checkPluginExists(pluginName: string): boolean {
  const name = pluginName
    .replace(/^@[^/]+\//, '')
    .replace(/^nextspark-plugin-/, '')
    .replace(/^plugin-/, '')

  return existsSync(join(process.cwd(), 'contents', 'plugins', name))
}

function getCoreVersion(): string {
  const pkgPath = join(process.cwd(), 'node_modules', '@nextsparkjs', 'core', 'package.json')
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      return pkg.version || '0.0.0'
    } catch {
      return '0.0.0'
    }
  }
  return '0.0.0'
}

export function addThemeCommand(packageSpec: string, options: Record<string, unknown>): Promise<void> {
  return addTheme(packageSpec, {
    force: options.force as boolean,
    skipDeps: options.noDeps as boolean,
    dryRun: options.dryRun as boolean,
    skipPostinstall: options.skipPostinstall as boolean,
    version: options.version as string
  })
}
