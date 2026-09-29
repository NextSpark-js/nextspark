/**
 * Plugin Discovery
 *
 * Discovers plugins and their API routes.
 * Reads the plugin sources resolved by project-mode.mjs.
 *
 * Each plugin carries the `capabilities` it declares (plugin-capabilities.mjs); discovery throws a
 * PluginCapabilityError when a plugin contributes to a surface it did not declare, reaches server or
 * build-only code from a web/mobile/runtime entry, or collides with another plugin.
 *
 * @module core/scripts/build/registry/discovery/plugins
 */

import { readFile, readdir, stat } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

import { CONFIG as DEFAULT_CONFIG } from '../config.mjs'
import { log, verbose, extractExportName, extractHttpMethods } from '../../../utils/index.mjs'
import { discoverNestedEntities } from './entities.mjs'
import { loadTypeScriptFor } from '../shared/typescript-compiler.mjs'
import { LEGACY_CAPABILITIES, PLUGIN_EXPORT_PATTERNS, PluginCapabilityError, checkPluginContributions, pluginCollisions, readPluginDeclaration, readPluginMetadata } from './plugin-capabilities.mjs'

/**
 * Discover plugins
 * @param {object} config - Optional configuration object (defaults to DEFAULT_CONFIG)
 * @returns {Promise<Array>} Array of discovered plugins
 */
export async function discoverPlugins(config = DEFAULT_CONFIG) {
  const plugins = []
  const diagnostics = []
  const ts = (config.pluginSources ?? []).length > 0 ? await loadTypeScriptFor(config.projectRoot ?? process.cwd()) : null

  for (const source of config.pluginSources ?? []) {
      const pluginName = source.name
      const pluginDir = source.sourceDir
      const configPath = join(pluginDir, 'plugin.config.ts')

      try {
        await stat(configPath)

        // Extract export name
        const exportName = await extractExportName(configPath, PLUGIN_EXPORT_PATTERNS)

        if (!exportName) {
          log(`${pluginName} (no valid PluginConfig export found)`, 'warning')
          continue
        }

        // Check for API directory and discover routes
        const apiPath = join(pluginDir, 'api')
        let hasAPI = false
        let routeFiles = []

        try {
          await stat(apiPath)
          hasAPI = true
          routeFiles = await discoverRouteFiles(apiPath, pluginName, source.importBase, { generatedHost: config.generatedHost })
        } catch {
          // No API directory
        }

        // Check for entities within plugin
        const pluginEntitiesPath = join(pluginDir, 'entities')
        let pluginEntities = []

        try {
          await stat(pluginEntitiesPath)
          pluginEntities = await discoverNestedEntities(
            config,
            pluginEntitiesPath,
            '',
            0,
            null,
            { type: 'plugin', name: pluginName, importBase: source.importBase }
          )
          verbose(`Plugin ${pluginName} has ${pluginEntities.length} entities`)
        } catch {
          // No entities directory in plugin
        }

        // Check for settings areas (settings/<area>/)
        const settingsPath = join(pluginDir, 'settings')
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
        const messagesPath = join(pluginDir, 'messages')
        const assetsPath = join(pluginDir, 'assets')
        const pagesServerPath = join(pluginDir, 'plugin.pages.server.ts')
        const hasMessages = existsSync(messagesPath)
        const hasAssets = existsSync(assetsPath)
        const hasPagesServer = existsSync(pagesServerPath)

        const declaration = readPluginDeclaration(ts, { plugin: pluginName, configFile: configPath, exportName })
        diagnostics.push(...declaration.diagnostics)

        // Capability-neutral facts for the catalog: literal config fields, then the package's own version.
        const metadata = readPluginMetadata(ts, { configFile: configPath, exportName })
        if (!metadata.version) {
          try {
            metadata.version = JSON.parse(await readFile(join(pluginDir, 'package.json'), 'utf8')).version
          } catch {
            // no package.json
          }
        }

        plugins.push({
          name: pluginName,
          metadata,
          capabilities: declaration.capabilities ?? [...LEGACY_CAPABILITIES],
          capabilitiesDeclared: declaration.declared && declaration.capabilities !== null,
          sourceDir: pluginDir,
          importBase: source.importBase,
          sourceKind: source.kind,
          packageName: source.packageName,
          exportName,
          configPath: source.kind === 'packaged' ? source.importBase : `${source.importBase}/plugin.config`,
          hasAPI,
          apiPath: hasAPI ? `${source.importBase}/api` : null,
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

  const invalid = new Set(diagnostics.map(d => d.plugin))
  for (const plugin of plugins) {
    if (!invalid.has(plugin.name)) diagnostics.push(...checkPluginContributions(ts, { plugin, plugins, projectRoot: config.projectRoot }))
  }
  diagnostics.push(...pluginCollisions(plugins))
  if (diagnostics.length > 0) throw new PluginCapabilityError(diagnostics)

  return plugins
}

/**
 * Discover route files within a plugin's API directory
 * @param {string} apiPath - Path to the API directory
 * @param {string} pluginName - Name of the plugin
 * @returns {Promise<Array>} Array of route file info
 */
export async function discoverRouteFiles(apiPath, pluginName, importBase = `@/plugins/${pluginName}`, { generatedHost = false } = {}) {
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
            // The generated host serves a plugin at /api/plugins/<plugin>/**; the legacy dispatcher at /api/v1/plugin/<plugin>/**.
            path: `${generatedHost ? '/api/plugins' : '/api/v1/plugin'}/${pluginName}${routePath === '/' ? '' : '/' + routePath}`,
            filePath: `${importBase}/api${routePath === '/' ? '/route' : '/' + routePath + '/route'}`,
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
