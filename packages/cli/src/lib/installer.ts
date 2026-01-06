import { existsSync, cpSync, rmSync, mkdirSync } from 'fs'
import { join } from 'path'
import chalk from 'chalk'
import type { NextSparkPackageJson, InstallOptions, InstallResult } from '../types/nextspark-package.js'
import { detectPackageManager, runInstall } from './package-manager.js'
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

  // Instalar dependencies
  if (!options.skipDeps) {
    const deps = packageJson.dependencies || {}
    const depNames = Object.keys(deps)

    if (depNames.length > 0) {
      console.log(`  Installing ${depNames.length} dependencies...`)
      const pm = detectPackageManager()
      const depsWithVersions = Object.entries(deps)
        .map(([name, version]) => `${name}@${version}`)
      await runInstall(pm, depsWithVersions)
    }
  }

  // Actualizar configs
  await updateTsConfig(pluginName, 'plugin')
  await registerInPackageJson(packageJson.name, packageJson.version || '0.0.0', 'plugin')

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
