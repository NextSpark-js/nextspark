import { existsSync, cpSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import chalk from '../utils/colors.js'
import type { NextSparkPackageJson, InstallOptions, InstallResult } from '../types/nextspark-package.js'
import { updateTsConfig } from './config-updater.js'

export async function installPlugin(
  extractedPath: string,
  packageJson: NextSparkPackageJson,
  options: InstallOptions = {}
): Promise<InstallResult> {
  const pluginName = extractPluginName(packageJson.name)
  const targetDir = join(process.cwd(), 'plugins', pluginName)

  // Dry run: only show what would be done
  if (options.dryRun) {
    console.log(chalk.cyan('\n  [Dry Run] Would perform:'))
    console.log(`    - Copy to: plugins/${pluginName}/`)
    if (packageJson.dependencies && Object.keys(packageJson.dependencies).length > 0) {
      console.log(`    - Install deps: ${Object.keys(packageJson.dependencies).join(', ')}`)
    }
    console.log(`    - Update tsconfig.json paths`)
    console.log(`    - Register in nextspark.config.ts`)
    return { success: true, installedPath: targetDir, name: pluginName }
  }

  // Check if already exists
  if (existsSync(targetDir)) {
    if (!options.force) {
      throw new Error(
        `Plugin "${pluginName}" already exists at ${targetDir}.\n` +
        `Use --force to overwrite.`
      )
    }
    console.log(chalk.yellow(`  Removing existing plugin...`))
    rmSync(targetDir, { recursive: true, force: true })
  }

  const pluginsDir = join(process.cwd(), 'plugins')
  if (!existsSync(pluginsDir)) {
    mkdirSync(pluginsDir, { recursive: true })
  }

  // Copy files
  console.log(`  Copying to plugins/${pluginName}/...`)
  cpSync(extractedPath, targetDir, { recursive: true })

  // Local plugin dependencies belong to the project package in root-first mode.
  const deps = packageJson.dependencies || {}
  const depCount = Object.keys(deps).length
  if (depCount > 0) {
    console.log(`  Plugin has ${depCount} dependencies (will be installed via workspace)`)
  }

  // Update configs
  await updateTsConfig(pluginName, 'plugin')
  registerDependenciesInProject(packageJson.dependencies || {})
  registerPluginInProjectConfig(pluginName)

  return {
    success: true,
    installedPath: targetDir,
    name: pluginName
  }
}

export async function installTheme(
  extractedPath: string,
  packageJson: NextSparkPackageJson,
  options: InstallOptions = {}
): Promise<InstallResult> {
  throw new Error('Themes are install-once project templates. Select one when creating the project; add:theme is not supported in root-first projects.')
}

function extractPluginName(npmName: string): string {
  return npmName
    .replace(/^@[^/]+\//, '')           // @scope/name → name
    .replace(/^nextspark-plugin-/, '')  // nextspark-plugin-foo → foo
    .replace(/^plugin-/, '')            // plugin-foo → foo
}

function registerPluginInProjectConfig(pluginName: string): void {
  const configPath = join(process.cwd(), 'nextspark.config.ts')
  if (!existsSync(configPath)) throw new Error('nextspark.config.ts not found')

  try {
    let content = readFileSync(configPath, 'utf-8')

    // Check if plugin is already registered
    if (content.includes(`'${pluginName}'`) || content.includes(`"${pluginName}"`)) {
      console.log(chalk.gray(`  Plugin ${pluginName} already registered in nextspark.config.ts`))
      return
    }

    // Find the plugins array and add the plugin
    // Match patterns like: plugins: [] or plugins: ['existing'] (supports multiline arrays)
    const pluginsArrayMatch = content.match(/plugins:\s*\[([^\]]*)\]/s)

    if (pluginsArrayMatch) {
      const existingPlugins = pluginsArrayMatch[1].trim()
      const newPlugins = existingPlugins
        ? `${existingPlugins}, '${pluginName}'`
        : `'${pluginName}'`

      content = content.replace(
        /plugins:\s*\[([^\]]*)\]/s,
        `plugins: [${newPlugins}]`
      )

      writeFileSync(configPath, content)
      console.log('  Registered plugin in nextspark.config.ts')
    } else {
      content = content.replace(/\}\)\s*;?\s*$/, `  plugins: ['${pluginName}'],\n})\n`)
      writeFileSync(configPath, content)
      console.log('  Registered plugin in nextspark.config.ts')
    }
  } catch (error) {
    throw new Error(`Could not register plugin in nextspark.config.ts: ${error}`)
  }
}

function registerDependenciesInProject(dependencies: Record<string, string>): void {
  if (Object.keys(dependencies).length === 0) return
  const packagePath = join(process.cwd(), 'package.json')
  const manifest = JSON.parse(readFileSync(packagePath, 'utf8'))
  manifest.dependencies = { ...(manifest.dependencies || {}), ...dependencies }
  writeFileSync(packagePath, `${JSON.stringify(manifest, null, 2)}\n`)
}
