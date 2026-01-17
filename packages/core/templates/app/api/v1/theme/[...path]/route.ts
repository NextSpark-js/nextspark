/**
 * Dynamic Theme API Router with Catch-All Paths
 *
 * Handles API requests for any theme with nested paths
 * Route: /api/v1/theme/[...path]
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  THEME_REGISTRY,
  type ThemeRouteFile,
  type ThemeRegistryEntry
} from '@nextsparkjs/registries/theme-registry'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'

export const GET = withRateLimitTier(async (
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) => {
  const { path } = await params
  return handleThemeRequest(request, path, 'GET')
}, 'read');

export const POST = withRateLimitTier(async (
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) => {
  const { path } = await params
  return handleThemeRequest(request, path, 'POST')
}, 'write');

export const PUT = withRateLimitTier(async (
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) => {
  const { path } = await params
  return handleThemeRequest(request, path, 'PUT')
}, 'write');

export const DELETE = withRateLimitTier(async (
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) => {
  const { path } = await params
  return handleThemeRequest(request, path, 'DELETE')
}, 'write');

export const PATCH = withRateLimitTier(async (
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) => {
  const { path } = await params
  return handleThemeRequest(request, path, 'PATCH')
}, 'write');

/**
 * Handle theme API requests with nested paths
 */
async function handleThemeRequest(
  request: NextRequest,
  pathSegments: string[],
  method: string
): Promise<NextResponse> {
  console.log(`[Theme API] Handling request: ${method} ${pathSegments.join('/')}`)

  try {
    // Extract theme name from path segments
    if (!pathSegments || pathSegments.length === 0) {
      return NextResponse.json(
        {
          error: 'Theme name is required',
          format: '/api/v1/theme/{themeName}/{endpoint}'
        },
        { status: 400 }
      )
    }

    const [themeName, ...remainingPath] = pathSegments

    // Get registered theme
    const themeEntry = THEME_REGISTRY[themeName as keyof typeof THEME_REGISTRY]

    if (!themeEntry) {
      return NextResponse.json(
        {
          error: 'Theme not found',
          requested: themeName,
          available: Object.keys(THEME_REGISTRY)
        },
        { status: 404 }
      )
    }

    // Construct the endpoint path
    const endpointPath = remainingPath.length > 0 ? remainingPath.join('/') : ''

    // Construct the full request path for registry lookup
    const requestPath = `/theme/${pathSegments.join('/')}`

    // Check if route exists in registry
    const hasRoute = checkIfRouteExists(requestPath, method, themeEntry)
    if (hasRoute) {
      console.log(`[Theme API] Route found in registry: ${requestPath}`)

      // Try to execute the theme route
      const response = await loadThemeRouteFromRegistry(themeName, request, method, endpointPath)
      if (response) {
        return response
      }
    } else {
      console.log(`[Theme API] No route found for ${requestPath}, method: ${method}`)
    }

    // Default theme info endpoint
    if (!endpointPath && method === 'GET') {
      return NextResponse.json({
        theme: {
          name: themeEntry.name,
          hasComponents: themeEntry.hasComponents,
          hasStyles: themeEntry.hasStyles,
          hasAssets: themeEntry.hasAssets,
          hasMessages: themeEntry.hasMessages,
          hasDashboardConfig: themeEntry.hasDashboardConfig,
          entities: themeEntry.entities?.length || 0,
          routeFiles: themeEntry.routeFiles?.length || 0,
          plugins: themeEntry.plugins || [],
          availableEndpoints: getThemeEndpoints(themeName)
        }
      })
    }

    // Theme doesn't support this endpoint
    return NextResponse.json(
      {
        error: 'Endpoint not supported by theme',
        theme: themeName,
        path: endpointPath,
        method,
        availableEndpoints: getThemeEndpoints(themeName)
      },
      { status: 404 }
    )

  } catch (error) {
    console.error('[Theme API] Error handling nested request:', error)

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
 * Check if route exists in theme registry
 */
function checkIfRouteExists(requestPath: string, method: string, themeEntry: ThemeRegistryEntry): boolean {
  if (!themeEntry.routeFiles || themeEntry.routeFiles.length === 0) {
    return false
  }

  // Extract path without /theme/ prefix
  const cleanPath = requestPath.replace(/^\/theme\/[^\/]+\//, '')

  return themeEntry.routeFiles.some(route => {
    const routePath = route.relativePath === '/' ? '' : route.relativePath
    const { matches } = matchRoutePattern(routePath, cleanPath)
    return matches && route.methods.includes(method)
  })
}

/**
 * Load theme route from registry (static imports for Next.js compatibility)
 */
async function loadThemeRouteFromRegistry(
  themeName: string,
  request: NextRequest,
  method: string,
  endpointPath: string
): Promise<NextResponse | null> {
  try {
    const themeEntry = THEME_REGISTRY[themeName as keyof typeof THEME_REGISTRY]

    if (!themeEntry || !themeEntry.routeFiles) {
      return null
    }

    // Find matching route with dynamic parameter support
    // IMPORTANT: Sort routes to prioritize static paths over dynamic ones
    // e.g., 'budgets/summary' should match before 'budgets/[id]'
    const sortedRoutes = [...themeEntry.routeFiles].sort((a, b) => {
      const aHasDynamic = a.relativePath.includes('[')
      const bHasDynamic = b.relativePath.includes('[')
      if (aHasDynamic && !bHasDynamic) return 1  // b (static) comes first
      if (!aHasDynamic && bHasDynamic) return -1 // a (static) comes first
      return 0
    })

    let matchedRoute: ThemeRouteFile | undefined
    let extractedParams: Record<string, string> = {}

    for (const route of sortedRoutes) {
      const routeEndpoint = route.relativePath === '/' ? '' : route.relativePath
      const { matches, params } = matchRoutePattern(routeEndpoint, endpointPath)

      if (matches && route.methods.includes(method)) {
        matchedRoute = route
        extractedParams = params
        break
      }
    }

    if (matchedRoute) {
      console.log(`[Theme API] Found route file for ${themeName}: ${matchedRoute.relativePath}`)
      console.log(`[Theme API] Extracted params:`, extractedParams)

      try {
        console.log(`[Theme API] Executing ${method} for ${themeName}:${matchedRoute.relativePath}`)

        // Use the pattern from registry for handler lookup (not the actual path)
        const routePattern = matchedRoute.relativePath === '/' ? '' : matchedRoute.relativePath
        const routeKey = `${themeName}/${routePattern}`
        const themeHandler = RouteHandlerService.getThemeHandler(routeKey, method)

        if (!themeHandler) {
          console.error(`[Theme API] Handler not found for ${routeKey}:${method}`)
          return NextResponse.json(
            {
              error: `Method ${method} not supported`,
              theme: themeName,
              route: matchedRoute.relativePath,
              availableMethods: matchedRoute.methods
            },
            { status: 405 }
          )
        }

        // Execute the theme handler with extracted dynamic parameters
        return await themeHandler(request, {
          params: Promise.resolve(extractedParams)
        })

      } catch (executionError) {
        console.error(`[Theme API] Error executing theme route:`, executionError)

        return NextResponse.json(
          {
            success: false,
            error: 'Theme route execution failed',
            theme: themeName,
            route: matchedRoute.relativePath,
            message: executionError instanceof Error ? executionError.message : 'Unknown execution error',
            details: 'Failed to execute theme route handler'
          },
          { status: 500 }
        )
      }
    }

    return null

  } catch (error) {
    console.error(`[Theme API] Error loading ${themeName} route from registry:`, error)

    return NextResponse.json(
      {
        error: 'Theme API error',
        theme: themeName,
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

interface ThemeEndpoint {
  path: string
  methods: string[]
  description: string
  source: string
}

/**
 * Get available endpoints for a theme (using registry)
 */
function getThemeEndpoints(themeName: string): ThemeEndpoint[] {
  const endpoints = []
  const themeEntry = THEME_REGISTRY[themeName as keyof typeof THEME_REGISTRY]

  if (themeEntry?.routeFiles) {
    endpoints.push(...themeEntry.routeFiles.map((endpoint: ThemeRouteFile) => ({
      path: endpoint.relativePath === '/' ? '/' : '/' + endpoint.relativePath,
      methods: endpoint.methods,
      description: `Theme route endpoint`,
      source: 'route-file'
    })))
  }

  // Add default endpoint if theme exists but no specific routes
  if (themeEntry && endpoints.length === 0) {
    endpoints.push({
      path: '/',
      methods: ['GET'],
      description: 'Basic theme info available',
      source: 'default'
    })
  }

  return endpoints.length > 0 ? endpoints : [{
    path: '/',
    methods: ['GET'],
    description: 'Basic theme info available',
    source: 'default'
  }]
}

// ========== ROUTE HANDLER REGISTRY (Zero Runtime I/O) ==========
// Import from auto-generated registry - NO direct imports from @/contents allowed
// All route handlers are resolved at build time by scripts/build-registry.mjs
// This provides ~17,255x performance improvement over dynamic imports

import { RouteHandlerService } from '@nextsparkjs/core/lib/services/route-handler.service'