import chalk from 'chalk'
import ora from 'ora'
import { fetchPackage } from '../lib/package-fetcher.js'
import { validatePlugin } from '../lib/validator.js'
import { installPlugin } from '../lib/installer.js'
import { runPostinstall } from '../lib/postinstall/index.js'
import { detectActiveTheme } from '../lib/theme-detector.js'
import { installWorkspaceDependencies, dependencyInstallNotice } from '../lib/workspace-dependencies.js'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import type { DependencyOwner, InstallOptions, PostinstallContext } from '../types/nextspark-package.js'

interface AddPluginOptions extends InstallOptions {
  installingPlugins?: Set<string>
  /**
   * Given by a caller that installs dependencies once for everything it adds;
   * this call then records its own there instead of installing them.
   */
  pendingDependencies?: DependencyOwner[]
}

export async function addPlugin(
  packageSpec: string,
  options: AddPluginOptions = {}
): Promise<void> {
  const spinner = ora(`Adding plugin ${packageSpec}`).start()

  let cleanup: (() => void) | null = null
  const pendingDependencies = options.pendingDependencies ?? []

  try {
    // Pre-checks
    const contentsDir = join(process.cwd(), 'contents')
    if (!existsSync(contentsDir)) {
      throw new Error('contents/ directory not found. Run "nextspark init" first.')
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
      throw new Error(`Invalid plugin:\n${validation.errors.map(e => `  ✗ ${e}`).join('\n')}`)
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
        installingPlugins: options.installingPlugins || new Set([packageSpec]),
        pendingDependencies
      }

      await runPostinstall(packageJson, result.installedPath, context)
    }

    if (!options.dryRun) {
      pendingDependencies.push({
        name: result.name,
        dir: result.installedPath,
        dependencies: packageJson.dependencies,
      })
      if (!options.pendingDependencies) {
        const notice = dependencyInstallNotice(
          installWorkspaceDependencies(pendingDependencies, { skipDeps: options.skipDeps })
        )
        if (notice) console.log(chalk.yellow(`\n  ⚠ ${notice}`))
      }
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

/**
 * The `add:plugin` command. addPlugin has already printed why it failed, so a failure
 * only sets the exit code: the CLI parses synchronously, and a rejection left to
 * Node exits 0 wherever unhandled rejections only warn.
 */
export async function addPluginCommand(packageSpec: string, options: Record<string, unknown>): Promise<void> {
  try {
    await addPlugin(packageSpec, {
      force: options.force as boolean,
      // commander exposes --no-deps as `deps: false`
      skipDeps: options.deps === false,
      dryRun: options.dryRun as boolean,
      skipPostinstall: options.skipPostinstall as boolean,
      version: options.version as string
    })
  } catch {
    process.exitCode = 1
  }
}
