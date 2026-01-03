/**
 * RouteHandlerService
 *
 * Service layer for route handler queries.
 * Provides O(1) lookups for theme and plugin route handlers.
 *
 * @example
 * import { RouteHandlerService } from './route-handler.service'
 *
 * // Get a theme route handler
 * const handler = RouteHandlerService.getThemeHandler('default/custom', 'GET')
 *
 * // Get a plugin route handler
 * const handler = RouteHandlerService.getPluginHandler('ai/generate', 'POST')
 *
 * // Check if route exists
 * if (RouteHandlerService.hasPluginRoute('ai/generate', 'POST')) {
 *   // Route exists
 * }
 */

import {
  THEME_ROUTE_HANDLERS,
  PLUGIN_ROUTE_HANDLERS,
  type RouteHandler
} from '@nextsparkjs/registries/route-handlers'

// Re-export type for convenience
export type { RouteHandler } from '@nextsparkjs/registries/route-handlers'

/**
 * RouteHandlerService
 *
 * Service layer for route handler queries.
 * All methods are static for consistency with other services.
 */
export class RouteHandlerService {
  // ==================== Theme Route Methods ====================

  /**
   * Get theme route handler by route key and HTTP method
   *
   * @param routeKey - Route key in format 'theme-name/route-path'
   * @param method - HTTP method (GET, POST, PUT, DELETE, PATCH)
   * @returns RouteHandler function or null if not found
   *
   * @example
   * const handler = RouteHandlerService.getThemeHandler('default/custom', 'GET')
   * if (handler) {
   *   const response = await handler(request, { params: Promise.resolve({}) })
   * }
   */
  static getThemeHandler(routeKey: string, method: string): RouteHandler | null {
    const handlers = THEME_ROUTE_HANDLERS[routeKey]
    if (!handlers) return null
    return handlers[method] || null
  }

  /**
   * Get all registered theme route keys
   *
   * @returns Array of route keys
   *
   * @example
   * const keys = RouteHandlerService.getThemeKeys()
   * // ['default/custom', 'default/webhook', ...]
   */
  static getThemeKeys(): string[] {
    return Object.keys(THEME_ROUTE_HANDLERS)
  }

  /**
   * Check if a theme route exists
   *
   * @param routeKey - Route key in format 'theme-name/route-path'
   * @param method - Optional HTTP method to check
   * @returns true if route (and optionally method) exists
   *
   * @example
   * // Check if route exists (any method)
   * RouteHandlerService.hasThemeRoute('default/custom') // true
   *
   * // Check if route exists with specific method
   * RouteHandlerService.hasThemeRoute('default/custom', 'POST') // false
   */
  static hasThemeRoute(routeKey: string, method?: string): boolean {
    const handlers = THEME_ROUTE_HANDLERS[routeKey]
    if (!handlers) return false
    if (method) return handlers[method] !== undefined
    return true
  }

  /**
   * Get count of registered theme routes
   *
   * @returns Number of theme route keys
   */
  static getThemeCount(): number {
    return Object.keys(THEME_ROUTE_HANDLERS).length
  }

  /**
   * Get all theme handlers (full registry)
   *
   * @returns The complete THEME_ROUTE_HANDLERS registry
   */
  static getAllThemeHandlers(): typeof THEME_ROUTE_HANDLERS {
    return THEME_ROUTE_HANDLERS
  }

  // ==================== Plugin Route Methods ====================

  /**
   * Get plugin route handler by route key and HTTP method
   *
   * @param routeKey - Route key in format 'plugin-name/route-path'
   * @param method - HTTP method (GET, POST, PUT, DELETE, PATCH)
   * @returns RouteHandler function or null if not found
   *
   * @example
   * const handler = RouteHandlerService.getPluginHandler('ai/generate', 'POST')
   * if (handler) {
   *   const response = await handler(request, { params: Promise.resolve({}) })
   * }
   */
  static getPluginHandler(routeKey: string, method: string): RouteHandler | null {
    const handlers = PLUGIN_ROUTE_HANDLERS[routeKey]
    if (!handlers) return null
    return handlers[method] || null
  }

  /**
   * Get all registered plugin route keys
   *
   * @returns Array of route keys
   *
   * @example
   * const keys = RouteHandlerService.getPluginKeys()
   * // ['ai/generate', 'ai/embeddings', ...]
   */
  static getPluginKeys(): string[] {
    return Object.keys(PLUGIN_ROUTE_HANDLERS)
  }

  /**
   * Check if a plugin route exists
   *
   * @param routeKey - Route key in format 'plugin-name/route-path'
   * @param method - Optional HTTP method to check
   * @returns true if route (and optionally method) exists
   *
   * @example
   * // Check if route exists (any method)
   * RouteHandlerService.hasPluginRoute('ai/generate') // true
   *
   * // Check if route exists with specific method
   * RouteHandlerService.hasPluginRoute('ai/generate', 'POST') // true
   */
  static hasPluginRoute(routeKey: string, method?: string): boolean {
    const handlers = PLUGIN_ROUTE_HANDLERS[routeKey]
    if (!handlers) return false
    if (method) return handlers[method] !== undefined
    return true
  }

  /**
   * Get count of registered plugin routes
   *
   * @returns Number of plugin route keys
   */
  static getPluginCount(): number {
    return Object.keys(PLUGIN_ROUTE_HANDLERS).length
  }

  /**
   * Get all plugin handlers (full registry)
   *
   * @returns The complete PLUGIN_ROUTE_HANDLERS registry
   */
  static getAllPluginHandlers(): typeof PLUGIN_ROUTE_HANDLERS {
    return PLUGIN_ROUTE_HANDLERS
  }

  // ==================== Combined Methods ====================

  /**
   * Get total count of all registered routes (theme + plugin)
   *
   * @returns Total number of route keys
   */
  static getTotalCount(): number {
    return this.getThemeCount() + this.getPluginCount()
  }
}

// ==================== Backward Compatibility ====================
// These exports maintain compatibility with code that imports directly from registry

/**
 * @deprecated Use RouteHandlerService.getThemeHandler instead
 */
export const getThemeRouteHandler = RouteHandlerService.getThemeHandler

/**
 * @deprecated Use RouteHandlerService.getPluginHandler instead
 */
export const getPluginRouteHandler = RouteHandlerService.getPluginHandler

/**
 * @deprecated Use RouteHandlerService.getThemeKeys instead
 */
export const getThemeRouteKeys = RouteHandlerService.getThemeKeys

/**
 * @deprecated Use RouteHandlerService.getPluginKeys instead
 */
export const getPluginRouteKeys = RouteHandlerService.getPluginKeys
