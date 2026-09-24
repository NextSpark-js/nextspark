/**
 * Plugin Discovery
 *
 * Discovers plugins and their API routes.
 * Reads enabled local plugins from <projectRoot>/plugins/.
 *
 * @module core/scripts/build/registry/discovery/plugins
 */

import { readdir, stat, readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

import { CONFIG as DEFAULT_CONFIG } from '../config.mjs'
import { log, verbose, extractExportName, extractHttpMethods } from '../../../utils/index.mjs'
import { discoverNestedEntities } from './entities.mjs'

/** Enabled local plugin directory names come only from nextspark.config.ts. */
function getActivePlugins(config) {
  return config.plugins
}

/**
 * Discover plugins
 * @param {object} config - Optional configuration object (defaults to DEFAULT_CONFIG)
 * @returns {Promise<Array>} Array of discovered plugins
 */
export async function discoverPlugins(config = DEFAULT_CONFIG) {
  // Get enabled local plugins from nextspark.config.ts.
  const allowedPlugins = getActivePlugins(config)

  const pluginsDir = config.pluginsDir
  const plugins = []

  try {
    const entries = await readdir(pluginsDir, { withFileTypes: true })
    const pluginDirs = entries.filter(entry => entry.isDirectory())

    for (const dir of pluginDirs) {
      const pluginName = dir.name

      // Skip plugins not declared by the project.
      if (allowedPlugins && !allowedPlugins.includes(pluginName)) {
        verbose(`Skipping plugin '${pluginName}' - not declared in nextspark.config.ts`)
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

        // Check for settings areas (settings/<area>/)
        const settingsPath = join(pluginsDir, pluginName, 'settings')
        let pluginSettings = []

        try {
          const settingsDirs = await readdir(settingsPath, { withFileTypes: true })
          for (const dir of settingsDirs.filter(e => e.isDirectory())) {
            const area = dir.name
            const areaPath = join(settingsPath, area)
            const migrationsPath = join(areaPath, 'migrations')
            const hasMigrations = existsSync(migrationsPath)
            pluginSettings.push({ area, hasMigrations })
            verbose(`Plugin ${pluginName} settings/${area}${hasMigrations ? ' (migrations)' : ''}`)
          }
        } catch {
          // No settings directory
        }

        // Check for messages, assets, pages server
        const messagesPath = join(pluginsDir, pluginName, 'messages')
        const assetsPath = join(pluginsDir, pluginName, 'assets')
        const pagesServerPath = join(pluginsDir, pluginName, 'plugin.pages.server.ts')
        const hasMessages = existsSync(messagesPath)
        const hasAssets = existsSync(assetsPath)
        const hasPagesServer = existsSync(pagesServerPath)

        plugins.push({
          name: pluginName,
          exportName,
          configPath: `@/plugins/${pluginName}/plugin.config`,
          hasAPI,
          apiPath: hasAPI ? `@/plugins/${pluginName}/api` : null,
          routeFiles,
          entities: pluginEntities,
          settings: pluginSettings,
          hasMessages,
          hasAssets,
          hasPagesServer
        })

        const info = [
          hasAPI && `API [${routeFiles.length} routes]`,
          pluginEntities.length > 0 && `${pluginEntities.length} entities`,
          pluginSettings.length > 0 && `settings [${pluginSettings.map(s => s.area).join(', ')}]`,
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
            filePath: `@/plugins/${pluginName}/api${routePath === '/' ? '/route' : '/' + routePath + '/route'}`,
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
