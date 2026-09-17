import chalk from '../utils/colors.js'
import ora from 'ora'
import { fetchPackage } from '../lib/package-fetcher.js'
import { validateTheme } from '../lib/validator.js'
import { installTheme } from '../lib/installer.js'
import { runPostinstall } from '../lib/postinstall/index.js'
import { addPlugin } from './add-plugin.js'
import { installWorkspaceDependencies, dependencyInstallNotice } from '../lib/workspace-dependencies.js'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import type { DependencyOwner, InstallOptions, PostinstallContext } from '../types/nextspark-package.js'

interface AddThemeOptions extends InstallOptions {
  /**
   * Given by a caller that installs dependencies once for everything it adds;
   * this call then records its own there instead of installing them.
   */
  pendingDependencies?: DependencyOwner[]
}

export async function addTheme(
  packageSpec: string,
  options: AddThemeOptions = {}
): Promise<void> {
  const spinner = ora(`Adding theme ${packageSpec}`).start()

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
    spinner.text = 'Validating theme...'
    const validation = validateTheme(packageJson, extractedPath)

    if (!validation.valid) {
      throw new Error(`Invalid theme:\n${validation.errors.map(e => `  ✗ ${e}`).join('\n')}`)
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
          await addPlugin(plugin, { installingPlugins, pendingDependencies })
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
        installingPlugins: new Set(),
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

/**
 * The `add:theme` command. addTheme has already printed why it failed, so a failure
 * only sets the exit code: the CLI parses synchronously, and a rejection left to
 * Node exits 0 wherever unhandled rejections only warn.
 */
export async function addThemeCommand(packageSpec: string, options: Record<string, unknown>): Promise<void> {
  try {
    await addTheme(packageSpec, {
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
