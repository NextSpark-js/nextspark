/**
 * Plugin Discovery
 *
 * Discovers plugins and their API routes.
 * In monorepo mode: plugins/ at repo root
 * In user project mode: contents/plugins/
 *
 * @module core/scripts/build/registry/discovery/plugins
 */

import { readdir, stat, readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

import { CONFIG as DEFAULT_CONFIG } from '../config.mjs'
import { log, verbose, extractExportName, extractHttpMethods } from '../../../utils/index.mjs'
import { discoverNestedEntities } from './entities.mjs'
import { loadNextSparkConfigSync } from '../../config-loader.mjs'

/**
 * Get plugins from nextspark.config.ts or theme config (fallback)
 * @param {object} config - Configuration object
 * @returns {Promise<string[]|null>} Array of plugin names or null if no filtering
 */
async function getActivePlugins(config) {
  // 1. Try to read from nextspark.config.ts FIRST
  const nextsparkConfig = loadNextSparkConfigSync(config.projectRoot)
  if (nextsparkConfig?.plugins) {
    verbose(`nextspark.config.ts declares plugins: [${nextsparkConfig.plugins.join(', ')}]`)
    return nextsparkConfig.plugins
  }

  // 2. Fallback: Read from theme config (backward compatibility)
  return await getActiveThemePlugins(config)
}

/**
 * Get plugins declared in the active theme config (FALLBACK)
 * @param {object} config - Configuration object
 * @returns {Promise<string[]|null>} Array of plugin names or null if no filtering
 */
async function getActiveThemePlugins(config) {
  if (!config.activeTheme) {
    verbose(`Warning: NEXT_PUBLIC_ACTIVE_THEME not set, allowing all plugins`)
    return null // null means no filtering
  }

  const themeConfigPath = join(config.themesDir, config.activeTheme, 'config', 'theme.config.ts')

  try {
    const configContent = await readFile(themeConfigPath, 'utf8')

    // Extract plugin dependencies from theme config
    const pluginsMatch = configContent.match(/plugins:\s*\[([^\]]+)\]/)
    const plugins = pluginsMatch
      ? pluginsMatch[1].split(',').map(p => p.trim().replace(/['"]/g, '')).filter(Boolean)
      : []

    verbose(`Active theme '${config.activeTheme}' declares plugins: [${plugins.join(', ')}]`)
    return plugins
  } catch (error) {
    log(`Warning: Could not read theme config for '${config.activeTheme}': ${error.message}`, 'warning')
    return null // Fall back to no filtering
  }
}

/**
 * Discover plugins
 * @param {object} config - Optional configuration object (defaults to DEFAULT_CONFIG)
 * @returns {Promise<Array>} Array of discovered plugins
 */
export async function discoverPlugins(config = DEFAULT_CONFIG) {
  // Get plugins from nextspark.config.ts or theme config
  const allowedPlugins = await getActivePlugins(config)

  const pluginsDir = config.pluginsDir
  const plugins = []

  try {
    const entries = await readdir(pluginsDir, { withFileTypes: true })
    const pluginDirs = entries.filter(entry => entry.isDirectory())

    for (const dir of pluginDirs) {
      const pluginName = dir.name

      // Skip plugins not declared in active theme
      if (allowedPlugins && !allowedPlugins.includes(pluginName)) {
        verbose(`Skipping plugin '${pluginName}' - not declared in theme '${config.activeTheme}'`)
        continue
      }

      const configPath = join(pluginsDir, pluginName, 'plugin.config.ts')

      try {
        await stat(configPath)

        // Extract export name
        const exportName = await extractExportName(configPath, [
          /export\s+const\s+([a-zA-Z]+(?:PluginConfig|Plugin))\s*[:=]/,
          /export\s+default\s+([a-zA-Z]+(?:PluginConfig|Plugin))/
        ])

        if (!exportName) {
          log(`${pluginName} (no valid PluginConfig export found)`, 'warning')
          continue
        }

        // Check for API directory and discover routes
        const apiPath = join(pluginsDir, pluginName, 'api')
        let hasAPI = false
        let routeFiles = []

        try {
          await stat(apiPath)
          hasAPI = true
          routeFiles = await discoverRouteFiles(apiPath, pluginName)
        } catch {
          // No API directory
        }

        // Check for entities within plugin
        const pluginEntitiesPath = join(pluginsDir, pluginName, 'entities')
        let pluginEntities = []

        try {
          await stat(pluginEntitiesPath)
          pluginEntities = await discoverNestedEntities(
            config,
            pluginEntitiesPath,
            '',
            0,
            null,
            { type: 'plugin', name: pluginName }
          )
          verbose(`Plugin ${pluginName} has ${pluginEntities.length} entities`)
        } catch {
          // No entities directory in plugin
        }

        // Check for messages, assets
        const messagesPath = join(pluginsDir, pluginName, 'messages')
        const assetsPath = join(pluginsDir, pluginName, 'assets')
        const hasMessages = existsSync(messagesPath)
        const hasAssets = existsSync(assetsPath)

        plugins.push({
          name: pluginName,
          exportName,
          configPath: `@/contents/plugins/${pluginName}/plugin.config`,
          hasAPI,
          apiPath: hasAPI ? `@/contents/plugins/${pluginName}/api` : null,
          routeFiles,
          entities: pluginEntities,
          hasMessages,
          hasAssets
        })

        const info = [
          hasAPI && `API [${routeFiles.length} routes]`,
          pluginEntities.length > 0 && `${pluginEntities.length} entities`,
          hasMessages && 'messages',
          hasAssets && 'assets'
        ].filter(Boolean).join(', ')

        verbose(`Plugin found: ${pluginName}${info ? ` (${info})` : ''}`)
      } catch {
        verbose(`${pluginName} (no plugin.config.ts)`)
      }
    }

  } catch (error) {
    verbose(`Error scanning plugins directory: ${error.message}`)
    return []
  }

  return plugins
}

/**
 * Discover route files within a plugin's API directory
 * @param {string} apiPath - Path to the API directory
 * @param {string} pluginName - Name of the plugin
 * @returns {Promise<Array>} Array of route file info
 */
export async function discoverRouteFiles(apiPath, pluginName) {
  const routeFiles = []

  async function scanDirectory(dir, relativePath = '') {
    try {
      const entries = await readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = join(dir, entry.name)
        const currentRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name

        if (entry.isDirectory()) {
          await scanDirectory(fullPath, currentRelativePath)
        } else if (entry.name === 'route.ts') {
          const routePath = relativePath || '/'
          const endpoint = {
            path: `/api/v1/plugin/${pluginName}${routePath === '/' ? '' : '/' + routePath}`,
            filePath: `../../../contents/plugins/${pluginName}/api${routePath === '/' ? '/route' : '/' + routePath + '/route'}`,
            relativePath: routePath,
            methods: await extractHttpMethods(fullPath),
            isRouteFile: true
          }

          routeFiles.push(endpoint)
          verbose(`Route: ${endpoint.path}`)
        }
      }
    } catch (error) {
      verbose(`Error scanning ${dir}: ${error.message}`)
    }
  }

  await scanDirectory(apiPath)
  return routeFiles
}
