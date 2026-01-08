/**
 * Route Handlers Registry Generator
 *
 * Generates route-handlers.ts with:
 * - THEME_ROUTE_HANDLERS: Executable handlers for theme custom routes
 * - PLUGIN_ROUTE_HANDLERS: Executable handlers for plugin custom routes
 * - API_ROUTES_METADATA: Documentation metadata for all routes (core, entities, theme, plugins)
 *
 * @module core/scripts/build/registry/generators/route-handlers
 */

/**
 * Generate Route Handlers Registry
 * Auto-generates static imports for all theme and plugin route handlers
 * Ensures ZERO runtime dynamic imports - all resolved at build time
 *
 * @param {Array} plugins - Discovered plugins
 * @param {Array} themes - Discovered themes
 * @param {Array} coreRoutes - Discovered core routes from app/api/v1/
 * @param {Array} entities - Discovered entities for metadata
 * @param {object} config - Configuration object from getConfig()
 * @returns {string} Generated TypeScript content
 */
export function generateRouteHandlersRegistry(plugins, themes, coreRoutes = [], entities = [], config) {
  // Filter themes by activeTheme if set (monorepo optimization)
  let filteredThemes = themes
  let filteredPlugins = plugins
  let requiredPluginNames = []

  if (config.activeTheme) {
    // Only include the active theme
    filteredThemes = themes.filter(t => t.name === config.activeTheme)

    // Get required plugins from the active theme's plugins array
    const activeTheme = filteredThemes[0]
    if (activeTheme && activeTheme.plugins && activeTheme.plugins.length > 0) {
      // plugins can be full names like '@nextsparkjs/plugin-langchain' or just 'langchain'
      requiredPluginNames = activeTheme.plugins.map(p =>
        p.replace('@nextsparkjs/plugin-', '').replace(/['"]/g, '')
      )
    }

    // Filter plugins to only include required ones by the active theme
    if (requiredPluginNames.length > 0) {
      filteredPlugins = plugins.filter(p => requiredPluginNames.includes(p.name))
    } else {
      // If no required plugins specified, don't include any plugin routes
      filteredPlugins = []
    }
  }

  // Collect all route handlers from themes
  const themeRoutes = []
  filteredThemes.forEach(theme => {
    if (theme.routeFiles && theme.routeFiles.length > 0) {
      theme.routeFiles.forEach(route => {
        const routeKey = route.relativePath === '/' ? '' : route.relativePath
        themeRoutes.push({
          themeName: theme.name,
          routePath: routeKey,
          filePath: `@/contents/themes/${theme.name}/api${route.relativePath === '/' ? '/route' : '/' + route.relativePath + '/route'}`,
          methods: route.methods,
          importKey: `theme_${theme.name.replace(/-/g, '_')}_${routeKey.replace(/[\\/\-\[\]]/g, '_') || 'root'}`
        })
      })
    }
  })

  // Collect all route handlers from plugins
  const pluginRoutes = []
  filteredPlugins.forEach(plugin => {
    if (plugin.routeFiles && plugin.routeFiles.length > 0) {
      plugin.routeFiles.forEach(route => {
        const routeKey = route.relativePath === '/' ? '' : route.relativePath
        pluginRoutes.push({
          pluginName: plugin.name,
          routePath: routeKey,
          filePath: `@/contents/plugins/${plugin.name}/api${route.relativePath === '/' ? '/route' : '/' + route.relativePath + '/route'}`,
          methods: route.methods,
          importKey: `plugin_${plugin.name.replace(/-/g, '_')}_${routeKey.replace(/[\\/\-\[\]]/g, '_') || 'root'}`
        })
      })
    }
  })

  // Generate imports for executable handlers
  const imports = []
  const allRoutes = [...themeRoutes, ...pluginRoutes]
  allRoutes.forEach(route => {
    imports.push(`import * as ${route.importKey} from '${route.filePath}'`)
  })

  // Generate theme handlers
  const themeHandlersCode = themeRoutes.map(route => {
    const routeKey = `${route.themeName}/${route.routePath}`
    const methodsCode = route.methods.map(method => `    ${method}: ${route.importKey}.${method} as RouteHandler`).join(',\n')
    return `  '${routeKey}': {\n${methodsCode}\n  }`
  }).join(',\n')

  // Generate plugin handlers
  const pluginHandlersCode = pluginRoutes.map(route => {
    const routeKey = `${route.pluginName}/${route.routePath}`
    const methodsCode = route.methods.map(method => `    ${method}: ${route.importKey}.${method} as RouteHandler`).join(',\n')
    return `  '${routeKey}': {\n${methodsCode}\n  }`
  }).join(',\n')

  // ==================== API_ROUTES_METADATA Generation ====================

  // Generate core routes metadata
  const coreRoutesMetadata = coreRoutes.map(route => ({
    path: route.path,
    methods: route.methods,
    category: 'core',
    subcategory: route.category
  }))

  // Generate entity routes metadata (each entity gets list + detail endpoints)
  const entityRoutesMetadata = entities.flatMap(entity => {
    const entityName = entity.name
    const basePath = `/api/v1/${entityName}`

    return [
      {
        path: basePath,
        methods: ['GET', 'POST'],
        category: 'entity',
        source: entityName
      },
      {
        path: `${basePath}/[id]`,
        methods: ['GET', 'PATCH', 'DELETE'],
        category: 'entity',
        source: entityName
      }
    ]
  })

  // Generate theme routes metadata
  const themeRoutesMetadata = themeRoutes.map(route => ({
    path: `/api/v1/theme/${route.themeName}${route.routePath ? '/' + route.routePath : ''}`,
    methods: route.methods,
    category: 'theme',
    source: route.themeName
  }))

  // Generate plugin routes metadata
  const pluginRoutesMetadata = pluginRoutes.map(route => ({
    path: `/api/v1/plugin/${route.pluginName}${route.routePath ? '/' + route.routePath : ''}`,
    methods: route.methods,
    category: 'plugin',
    source: route.pluginName
  }))

  // Calculate totals
  const totalCore = coreRoutesMetadata.length
  const totalEntities = entityRoutesMetadata.length
  const totalTheme = themeRoutesMetadata.length
  const totalPlugins = pluginRoutesMetadata.length
  const totalRoutes = totalCore + totalEntities + totalTheme + totalPlugins

  // Generate API_ROUTES_METADATA code
  const coreMetadataCode = coreRoutesMetadata.length > 0
    ? coreRoutesMetadata.map(r => `    { path: '${r.path}', methods: ${JSON.stringify(r.methods)}, category: 'core', subcategory: '${r.subcategory}' }`).join(',\n')
    : '    // No core routes discovered'

  const entityMetadataCode = entityRoutesMetadata.length > 0
    ? entityRoutesMetadata.map(r => `    { path: '${r.path}', methods: ${JSON.stringify(r.methods)}, category: 'entity', source: '${r.source}' }`).join(',\n')
    : '    // No entity routes discovered'

  const themeMetadataCode = themeRoutesMetadata.length > 0
    ? themeRoutesMetadata.map(r => `    { path: '${r.path}', methods: ${JSON.stringify(r.methods)}, category: 'theme', source: '${r.source}' }`).join(',\n')
    : '    // No theme routes discovered'

  const pluginMetadataCode = pluginRoutesMetadata.length > 0
    ? pluginRoutesMetadata.map(r => `    { path: '${r.path}', methods: ${JSON.stringify(r.methods)}, category: 'plugin', source: '${r.source}' }`).join(',\n')
    : '    // No plugin routes discovered'

  return `/**
 * Auto-generated Route Handlers Registry
 *
 * Generated at: ${new Date().toISOString()}
 * Core routes: ${totalCore}
 * Entity routes: ${totalEntities}
 * Theme routes: ${totalTheme}
 * Plugin routes: ${totalPlugins}
 * Total routes: ${totalRoutes}
 *
 * DO NOT EDIT - This file is auto-generated by scripts/build-registry.mjs
 *
 * ZERO runtime dynamic imports - all route handlers resolved at build time.
 * Provides ~17,255x performance improvement over runtime I/O.
 */

import type { NextRequest, NextResponse } from 'next/server'

${imports.length > 0 ? imports.join('\n') : '// No route imports needed'}

/**
 * Route handler type definition
 */
export type RouteHandler = (
  request: NextRequest,
  context: { params: Promise<any> }
) => Promise<NextResponse>

/**
 * API Route entry for documentation
 */
export interface ApiRouteEntry {
  path: string
  methods: string[]
  category: 'core' | 'entity' | 'theme' | 'plugin'
  source?: string
  subcategory?: string
}

/**
 * Theme Route Handlers Registry
 * Access: THEME_ROUTE_HANDLERS['theme-name/route-path'][HTTP_METHOD]
 */
export const THEME_ROUTE_HANDLERS: Record<string, Record<string, RouteHandler | undefined>> = {
${themeHandlersCode || '  // No theme routes discovered'}
}

/**
 * Plugin Route Handlers Registry
 * Access: PLUGIN_ROUTE_HANDLERS['plugin-name/route-path'][HTTP_METHOD]
 */
export const PLUGIN_ROUTE_HANDLERS: Record<string, Record<string, RouteHandler | undefined>> = {
${pluginHandlersCode || '  // No plugin routes discovered'}
}

// ==================== API ROUTES METADATA ====================
// Data-only registry for documentation and devtools
// Use ApiRoutesService for queries

/**
 * API Routes Metadata
 * Complete listing of all available API endpoints grouped by category
 */
export const API_ROUTES_METADATA: {
  core: ApiRouteEntry[]
  entities: ApiRouteEntry[]
  theme: ApiRouteEntry[]
  plugins: ApiRouteEntry[]
} = {
  core: [
${coreMetadataCode}
  ],
  entities: [
${entityMetadataCode}
  ],
  theme: [
${themeMetadataCode}
  ],
  plugins: [
${pluginMetadataCode}
  ]
}

/**
 * API Routes Summary
 * Quick stats about available routes
 */
export const API_ROUTES_SUMMARY = {
  totalRoutes: ${totalRoutes},
  byCategory: {
    core: ${totalCore},
    entities: ${totalEntities},
    theme: ${totalTheme},
    plugins: ${totalPlugins}
  },
  generatedAt: '${new Date().toISOString()}'
}

// ==================== Service Layer ====================
// Query functions have been moved to: @nextsparkjs/core/lib/services/route-handler.service
// For route handler queries, import:
// import { RouteHandlerService } from '@nextsparkjs/core/lib/services/route-handler.service'
//
// For API routes metadata queries, import:
// import { ApiRoutesService } from '@nextsparkjs/core/lib/services/api-routes.service'
`
}
