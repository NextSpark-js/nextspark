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
    const plugins = PluginService.getAll()

    const pluginsWithAPI = plugins.map((plugin) => {
        const hasAPIFiles = hasPluginAPIFiles(plugin.name)
        const endpoints = getPluginEndpoints(plugin.name)

        return {
          name: plugin.name,
          displayName: plugin.displayName,
          version: plugin.version,
          description: plugin.description,
          enabled: plugin.enabled,
          hasAPI: !!plugin.api || hasAPIFiles,
          apiEndpoints: endpoints,
          baseUrl: `/api/v1/plugins/${plugin.name}`,
          components: plugin.components ? Object.keys(plugin.components) : [],
          services: plugin.services ? Object.keys(plugin.services) : []
        }
      })

    return NextResponse.json({
      success: true,
      plugins: pluginsWithAPI,
      totalPlugins: plugins.length,
      enabledPlugins: plugins.filter(p => p.enabled).length,
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