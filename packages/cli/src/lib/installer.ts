import { existsSync, cpSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import chalk from 'chalk'
import type { NextSparkPackageJson, InstallOptions, InstallResult } from '../types/nextspark-package.js'
import { updateTsConfig, registerInPackageJson } from './config-updater.js'

export async function installPlugin(
  extractedPath: string,
  packageJson: NextSparkPackageJson,
  options: InstallOptions = {}
): Promise<InstallResult> {
  const pluginName = extractPluginName(packageJson.name)
  const targetDir = join(process.cwd(), 'contents', 'plugins', pluginName)

  // Dry run: solo mostrar qué haría
  if (options.dryRun) {
    console.log(chalk.cyan('\n  [Dry Run] Would perform:'))
    console.log(`    - Copy to: contents/plugins/${pluginName}/`)
    if (packageJson.dependencies && Object.keys(packageJson.dependencies).length > 0) {
      console.log(`    - Install deps: ${Object.keys(packageJson.dependencies).join(', ')}`)
    }
    console.log(`    - Update tsconfig.json paths`)
    console.log(`    - Register in package.json`)
    return { success: true, installedPath: targetDir, name: pluginName }
  }

  // Verificar si ya existe
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

  // Asegurar que contents/plugins existe
  const pluginsDir = join(process.cwd(), 'contents', 'plugins')
  if (!existsSync(pluginsDir)) {
    mkdirSync(pluginsDir, { recursive: true })
  }

  // Copiar archivos
  console.log(`  Copying to contents/plugins/${pluginName}/...`)
  cpSync(extractedPath, targetDir, { recursive: true })

  // Plugin dependencies are handled by pnpm workspaces
  // The pnpm-workspace.yaml includes contents/plugins/* so each plugin
  // gets its own node_modules when `pnpm install` is run at root
  const deps = packageJson.dependencies || {}
  const depCount = Object.keys(deps).length
  if (depCount > 0) {
    console.log(`  Plugin has ${depCount} dependencies (will be installed via workspace)`)
  }

  // Actualizar configs
  await updateTsConfig(pluginName, 'plugin')
  await registerInPackageJson(packageJson.name, packageJson.version || '0.0.0', 'plugin')

  // Register plugin in active theme's config
  await registerPluginInThemeConfig(pluginName)

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
  const themeName = extractThemeName(packageJson.name)
  const targetDir = join(process.cwd(), 'contents', 'themes', themeName)

  if (options.dryRun) {
    console.log(chalk.cyan('\n  [Dry Run] Would perform:'))
    console.log(`    - Copy to: contents/themes/${themeName}/`)
    if (packageJson.requiredPlugins?.length) {
      console.log(`    - Install required plugins: ${packageJson.requiredPlugins.join(', ')}`)
    }
    console.log(`    - Update tsconfig.json paths`)
    console.log(`    - Register in package.json`)
    return { success: true, installedPath: targetDir, name: themeName }
  }

  if (existsSync(targetDir)) {
    if (!options.force) {
      throw new Error(
        `Theme "${themeName}" already exists at ${targetDir}.\n` +
        `Use --force to overwrite.`
      )
    }
    console.log(chalk.yellow(`  Removing existing theme...`))
    rmSync(targetDir, { recursive: true, force: true })
  }

  // Asegurar que contents/themes existe
  const themesDir = join(process.cwd(), 'contents', 'themes')
  if (!existsSync(themesDir)) {
    mkdirSync(themesDir, { recursive: true })
  }

  // Copiar archivos
  console.log(`  Copying to contents/themes/${themeName}/...`)
  cpSync(extractedPath, targetDir, { recursive: true })

  // Actualizar configs
  await updateTsConfig(themeName, 'theme')
  await registerInPackageJson(packageJson.name, packageJson.version || '0.0.0', 'theme')

  return {
    success: true,
    installedPath: targetDir,
    name: themeName
  }
}

function extractPluginName(npmName: string): string {
  return npmName
    .replace(/^@[^/]+\//, '')           // @scope/name → name
    .replace(/^nextspark-plugin-/, '')  // nextspark-plugin-foo → foo
    .replace(/^plugin-/, '')            // plugin-foo → foo
}

function extractThemeName(npmName: string): string {
  return npmName
    .replace(/^@[^/]+\//, '')           // @scope/name → name
    .replace(/^nextspark-theme-/, '')   // nextspark-theme-foo → foo
    .replace(/^theme-/, '')             // theme-foo → foo
}

/**
 * Register a plugin in the active theme's theme.config.ts
 */
async function registerPluginInThemeConfig(pluginName: string): Promise<void> {
  // Find active theme from .env
  const envPath = join(process.cwd(), '.env')
  let activeTheme = 'starter'

  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf-8')
    const match = envContent.match(/NEXT_PUBLIC_ACTIVE_THEME=([^\s\n]+)/)
    if (match) {
      activeTheme = match[1]
    }
  }

  // Find theme.config.ts
  const themeConfigPath = join(process.cwd(), 'contents', 'themes', activeTheme, 'config', 'theme.config.ts')

  if (!existsSync(themeConfigPath)) {
    console.log(chalk.gray(`  Theme config not found, skipping plugin registration`))
    return
  }

  try {
    let content = readFileSync(themeConfigPath, 'utf-8')

    // Check if plugin is already registered
    if (content.includes(`'${pluginName}'`) || content.includes(`"${pluginName}"`)) {
      console.log(chalk.gray(`  Plugin ${pluginName} already registered in theme config`))
      return
    }

    // Find the plugins array and add the plugin
    // Match patterns like: plugins: [] or plugins: ['existing']
    const pluginsArrayMatch = content.match(/plugins:\s*\[([^\]]*)\]/)

    if (pluginsArrayMatch) {
      const existingPlugins = pluginsArrayMatch[1].trim()
      const newPlugins = existingPlugins
        ? `${existingPlugins}, '${pluginName}'`
        : `'${pluginName}'`

      content = content.replace(
        /plugins:\s*\[([^\]]*)\]/,
        `plugins: [${newPlugins}]`
      )

      writeFileSync(themeConfigPath, content)
      console.log(`  Registered plugin in theme.config.ts`)
    }
  } catch (error) {
    console.log(chalk.yellow(`  Could not register plugin in theme config: ${error}`))
  }
}
