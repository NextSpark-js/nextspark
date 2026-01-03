/**
 * Dynamic Plugin API Router with Catch-All Paths
 *
 * Handles API requests for any plugin with nested paths
 * Route: /api/v1/plugins/[...path]
 */

import { NextRequest, NextResponse } from 'next/server'
import { PluginService, type RouteFileEndpoint, type PluginRegistryEntry } from '@nextsparkjs/core/lib/services'
import { PLUGIN_REGISTRY } from '@nextsparkjs/registries/plugin-registry'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  return handlePluginRequest(request, path, 'GET')
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  return handlePluginRequest(request, path, 'POST')
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  return handlePluginRequest(request, path, 'PUT')
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  return handlePluginRequest(request, path, 'DELETE')
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  return handlePluginRequest(request, path, 'PATCH')
}

/**
 * Handle plugin API requests with nested paths
 */
async function handlePluginRequest(
  request: NextRequest,
  pathSegments: string[],
  method: string
): Promise<NextResponse> {
  console.log(`[Plugin API] Handling request: ${method} ${pathSegments.join('/')}`)

  try {
    // Extract plugin name from path segments
    if (!pathSegments || pathSegments.length === 0) {
      return NextResponse.json(
        {
          error: 'Plugin name is required',
          format: '/api/v1/plugins/{pluginName}/{endpoint}'
        },
        { status: 400 }
      )
    }

    const [pluginName, ...remainingPath] = pathSegments

    // Get registered plugins
    const plugins = PluginService.getAll()
    const plugin = plugins.find(p => p.name === pluginName)

    if (!plugin) {
      return NextResponse.json(
        {
          error: 'Plugin not found',
          requested: pluginName,
          available: plugins.map(p => p.name)
        },
        { status: 404 }
      )
    }

    if (!plugin.enabled) {
      return NextResponse.json(
        { error: 'Plugin is disabled' },
        { status: 403 }
      )
    }

    // Construct the endpoint path
    const endpointPath = remainingPath.length > 0 ? '/' + remainingPath.join('/') : '/'

    // Construct the full request path for registry lookup
    const requestPath = `/api/v1/plugin/${pathSegments.join('/')}`

    // Check if route exists in registry metadata
    if (PluginService.hasRoute(requestPath, method)) {
      console.log(`[Plugin API] Route found in registry: ${requestPath}`)
      // Note: Route exists but execution handled by fallback mechanisms below
      // This maintains zero-dynamic-imports policy
    } else {
      console.log(`[Plugin API] No route found for ${requestPath}, method: ${method}`)

      // Check if this plugin has route files but handler not found - possible configuration issue
      const pluginEntry = (PLUGIN_REGISTRY as Record<string, PluginRegistryEntry>)[pluginName]
      if (pluginEntry?.routeFiles && pluginEntry.routeFiles.length > 0) {
        console.warn(`[Plugin API] Plugin '${pluginName}' has route files but route '${requestPath}' not found in registry`)
      }
    }

    // Fallback: Try to load plugin's API handler from registry
    const pluginEntry2 = (PLUGIN_REGISTRY as Record<string, PluginRegistryEntry>)[pluginName]
    if (pluginEntry2?.hasAPI) {
      const response = await loadPluginAPIFromRegistry(pluginName, request, method, endpointPath)
      if (response) {
        return response
      }
    }


    // Fallback to plugin's built-in API handler
    if (plugin.api && typeof plugin.api.handler === 'function') {
      return plugin.api.handler(request, method, endpointPath)
    }

    // Default plugin info endpoint
    if (endpointPath === '/' && method === 'GET') {
      return NextResponse.json({
        plugin: {
          name: plugin.name,
          displayName: plugin.displayName,
          version: plugin.version,
          description: plugin.description,
          enabled: plugin.enabled,
          dependencies: plugin.dependencies,
          hasAPI: !!plugin.api || hasPluginAPIFiles(pluginName) || PluginService.getPluginRouteEndpoints().length > 0,
          components: plugin.components ? Object.keys(plugin.components) : [],
          services: plugin.services ? Object.keys(plugin.services) : []
        }
      })
    }

    // Plugin doesn't support this endpoint
    return NextResponse.json(
      {
        error: 'Endpoint not supported by plugin',
        plugin: plugin.name,
        path: endpointPath,
        method,
        availableEndpoints: getPluginEndpoints(pluginName)
      },
      { status: 404 }
    )

  } catch (error) {
    console.error('[Plugin API] Error handling nested request:', error)

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * Match route pattern with dynamic parameters
 * Example: 'orders/[orderId]/items' matches 'orders/123/items'
 */
function matchRoutePattern(pattern: string, path: string): { matches: boolean; params: Record<string, string> } {
  const params: Record<string, string> = {}

  // Split both pattern and path into segments
  const patternSegments = pattern.split('/').filter(Boolean)
  const pathSegments = path.split('/').filter(Boolean)

  // Must have same number of segments
  if (patternSegments.length !== pathSegments.length) {
    return { matches: false, params }
  }

  // Check each segment
  for (let i = 0; i < patternSegments.length; i++) {
    const patternSeg = patternSegments[i]
    const pathSeg = pathSegments[i]

    // Check if this is a dynamic parameter [paramName]
    if (patternSeg.startsWith('[') && patternSeg.endsWith(']')) {
      // Extract parameter name
      const paramName = patternSeg.slice(1, -1)
      params[paramName] = pathSeg
    } else {
      // Static segment must match exactly
      if (patternSeg !== pathSeg) {
        return { matches: false, params: {} }
      }
    }
  }

  return { matches: true, params }
}

/**
 * Load plugin API handler from registry (dynamic plugin loading)
 */
async function loadPluginAPIFromRegistry(
  pluginName: string,
  request: NextRequest,
  method: string,
  path: string
): Promise<NextResponse | null> {
  try {
    const pluginEntry = (PLUGIN_REGISTRY as Record<string, PluginRegistryEntry>)[pluginName]

    if (!pluginEntry) {
      return null
    }

    // First, check if the plugin has a config-based API handler
    const plugin = pluginEntry.config
    if (plugin.api && typeof plugin.api.handler === 'function') {
      console.log(`[Plugin API] Using ${pluginName} config handler for ${path}`)

      // Ensure endpoints are registered if the plugin has a registration function
      if (plugin.api.registerEndpoints && typeof plugin.api.registerEndpoints === 'function') {
        plugin.api.registerEndpoints()
      }

      return plugin.api.handler(request, method, path)
    }

    // Use the plugin config's API handler if available
    console.log(`[Plugin API] Checking plugin config for API handler`)

    // If no API handler in config, and the plugin has route files, show available routes
    if (pluginEntry.routeFiles && pluginEntry.routeFiles.length > 0) {
      // Find matching route with dynamic parameter support
      let matchedRoute: RouteFileEndpoint | undefined
      let extractedParams: Record<string, string> = {}

      const endpointPath = path.substring(1) // Remove leading slash

      for (const route of pluginEntry.routeFiles) {
        const { matches, params } = matchRoutePattern(route.relativePath, endpointPath)

        if (matches && route.methods.includes(method)) {
          matchedRoute = route
          extractedParams = params
          break
        }
      }

      if (matchedRoute) {
        console.log(`[Plugin API] Found route file for ${pluginName}: ${matchedRoute.relativePath}`)
        console.log(`[Plugin API] Extracted params:`, extractedParams)

        // Execute the plugin route using static imports (Next.js compatible)
        try {
          console.log(`[Plugin API] Executing ${method} for ${pluginName}:${matchedRoute.relativePath}`)

          // Use the pattern from registry for handler lookup (not the actual path)
          const routeKey = `${pluginName}/${matchedRoute.relativePath}`
          const pluginHandler = RouteHandlerService.getPluginHandler(routeKey, method)

          if (!pluginHandler) {
            console.error(`[Plugin API] Handler not found for ${routeKey}:${method}`)
            return NextResponse.json(
              {
                error: `Method ${method} not supported`,
                plugin: pluginName,
                route: matchedRoute.relativePath,
                availableMethods: matchedRoute.methods
              },
              { status: 405 }
            )
          }

          // Execute the plugin handler with extracted dynamic parameters
          return await pluginHandler(request, {
            params: Promise.resolve(extractedParams)
          })

        } catch (executionError) {
          console.error(`[Plugin API] Error executing plugin route:`, executionError)

          return NextResponse.json(
            {
              success: false,
              error: 'Plugin route execution failed',
              plugin: pluginName,
              route: matchedRoute.relativePath,
              message: executionError instanceof Error ? executionError.message : 'Unknown execution error',
              details: 'Failed to execute plugin route handler'
            },
            { status: 500 }
          )
        }
      }
    }

    return null

  } catch (error) {
    console.error(`[Plugin API] Error loading ${pluginName} API from registry:`, error)

    return NextResponse.json(
      {
        error: 'Plugin API error',
        plugin: pluginName,
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
  source: string
}

/**
 * Get available endpoints for a plugin (using registry)
 */
function getPluginEndpoints(pluginName: string): PluginEndpoint[] {
  const endpoints = []

  // Get plugin's route file endpoints from registry
  const pluginEntry = (PLUGIN_REGISTRY as Record<string, PluginRegistryEntry>)[pluginName]

  if (pluginEntry?.routeFiles) {
    endpoints.push(...pluginEntry.routeFiles.map((endpoint: RouteFileEndpoint) => ({
      path: endpoint.relativePath === '/' ? '/' : '/' + endpoint.relativePath,
      methods: endpoint.methods,
      description: `Route file endpoint`,
      source: 'route-file'
    })))
  }

  // Add default endpoint if plugin has API but no specific routes
  if (pluginEntry?.hasAPI && endpoints.length === 0) {
    endpoints.push({ path: '/', methods: ['GET'], description: 'Basic API available', source: 'default' })
  }

  return endpoints.length > 0 ? endpoints : [{ path: '/', methods: ['GET'], description: 'Basic API available', source: 'default' }]
}

// ========== ROUTE HANDLER REGISTRY (Zero Runtime I/O) ==========
// Import from auto-generated registry - NO direct imports from @/contents allowed
// All route handlers are resolved at build time by scripts/build-registry.mjs
// This provides ~17,255x performance improvement over dynamic imports

import { RouteHandlerService } from '@nextsparkjs/core/lib/services/route-handler.service'