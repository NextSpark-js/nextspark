import chalk from 'chalk'
import ora from 'ora'
import { fetchPackage } from '../lib/package-fetcher.js'
import { validatePlugin } from '../lib/validator.js'
import { installPlugin } from '../lib/installer.js'
import { runPostinstall } from '../lib/postinstall/index.js'
import { detectActiveTheme } from '../lib/theme-detector.js'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import type { InstallOptions, PostinstallContext } from '../types/nextspark-package.js'

interface AddPluginOptions extends InstallOptions {
  installingPlugins?: Set<string>
}

export async function addPlugin(
  packageSpec: string,
  options: AddPluginOptions = {}
): Promise<void> {
  const spinner = ora(`Adding plugin ${packageSpec}`).start()

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
    spinner.text = 'Validating plugin...'
    const validation = validatePlugin(packageJson, extractedPath)

    if (!validation.valid) {
      spinner.fail('Invalid plugin')
      validation.errors.forEach(e => console.log(chalk.red(`  ✗ ${e}`)))
      return
    }

    if (validation.warnings.length > 0) {
      validation.warnings.forEach(w => console.log(chalk.yellow(`  ⚠ ${w}`)))
    }

    // Install
    spinner.text = 'Installing plugin...'
    spinner.stop()

    const result = await installPlugin(extractedPath, packageJson, options)

    // Postinstall
    if (!options.skipPostinstall) {
      const coreVersion = getCoreVersion()
      const context: PostinstallContext = {
        activeTheme: detectActiveTheme(),
        projectRoot: process.cwd(),
        pluginName: result.name,
        coreVersion,
        timestamp: Date.now(),
        installingPlugins: options.installingPlugins || new Set([packageSpec])
      }

      await runPostinstall(packageJson, result.installedPath, context)
    }

    console.log(chalk.green(`\n  ✓ Plugin ${result.name} installed successfully!`))
    console.log(chalk.gray(`    Location: contents/plugins/${result.name}/`))

  } catch (error) {
    spinner.fail('Failed to add plugin')
    if (error instanceof Error) {
      console.log(chalk.red(`  ${error.message}`))
    }
    throw error
  } finally {
    if (cleanup) cleanup()
  }
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

export function addPluginCommand(packageSpec: string, options: Record<string, unknown>): Promise<void> {
  return addPlugin(packageSpec, {
    force: options.force as boolean,
    skipDeps: options.noDeps as boolean,
    dryRun: options.dryRun as boolean,
    skipPostinstall: options.skipPostinstall as boolean,
    version: options.version as string
  })
}
