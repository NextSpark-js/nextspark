/**
 * Plugin API Base Route
 *
 * Lists all available plugins and their API status
 * Route: /api/v1/plugins
 */

import { NextResponse } from 'next/server'
import { PluginService, type PluginRegistryEntry } from '@nextsparkjs/core/lib/services'
import { PLUGIN_REGISTRY } from '@nextsparkjs/registries/plugin-registry'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'

export const GET = withRateLimitTier(async () => {
  return listPluginsWithAPI()
}, 'read');

/**
 * List all plugins with their API status
 */
async function listPluginsWithAPI(): Promise<NextResponse> {
  try {
    // Every enabled plugin, from the capability-neutral catalog; the config and the API files exist only for
    // the plugins that declare 'server'.
    const plugins = PluginService.getCatalog()

    const pluginsWithAPI = plugins.map((entry) => {
        const config = PluginService.get(entry.name)
        const hasAPIFiles = hasPluginAPIFiles(entry.name)
        const endpoints = getPluginEndpoints(entry.name)

        return {
          name: entry.name,
          displayName: config?.displayName ?? entry.displayName,
          version: config?.version ?? entry.version,
          description: config?.description ?? entry.description,
          capabilities: entry.capabilities,
          // The executable config when the plugin declares 'server', else the catalog's literal; null = unknown.
          enabled: PluginService.isEnabled(entry.name),
          hasAPI: !!config?.api || hasAPIFiles,
          apiEndpoints: endpoints,
          baseUrl: `/api/v1/plugins/${entry.name}`,
          components: config?.components ? Object.keys(config.components) : [],
          services: config?.services ? Object.keys(config.services) : []
        }
      })

    return NextResponse.json({
      success: true,
      plugins: pluginsWithAPI,
      totalPlugins: plugins.length,
      enabledPlugins: pluginsWithAPI.filter(p => p.enabled === true).length,
      pluginsWithAPI: pluginsWithAPI.filter(p => p.hasAPI).length
    })

  } catch (error) {
    console.error('[Plugin API] Error listing plugins:', error)

    return NextResponse.json(
      {
        error: 'Failed to list plugins',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * Check if plugin has API files (using registry)
 */
function hasPluginAPIFiles(pluginName: string): boolean {
  const pluginEntry = (PLUGIN_REGISTRY as Record<string, PluginRegistryEntry>)[pluginName]
  return pluginEntry?.hasAPI || false
}

interface PluginEndpoint {
  path: string
  methods: string[]
  description: string
}

/**
 * Get available endpoints for a plugin (using registry)
 */
function getPluginEndpoints(pluginName: string): PluginEndpoint[] {
  const pluginEntry = (PLUGIN_REGISTRY as Record<string, PluginRegistryEntry>)[pluginName]

  if (pluginEntry?.routeFiles) {
    return pluginEntry.routeFiles.map((endpoint) => ({
      path: endpoint.relativePath === '/' ? '/' : '/' + endpoint.relativePath,
      methods: endpoint.methods,
      description: 'Route file endpoint'
    }))
  }

  // Default endpoint if plugin has API but no specific routes
  if (pluginEntry?.hasAPI) {
    return [{ path: '/', methods: ['GET'], description: 'Basic plugin info' }]
  }

  return []
}