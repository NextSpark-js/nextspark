/**
 * ApiRoutesService
 *
 * Service layer for API routes metadata queries.
 * Provides O(1) lookups and filtering for all registered API endpoints.
 *
 * @example
 * import { ApiRoutesService } from './api-routes.service'
 *
 * // Get all routes
 * const routes = ApiRoutesService.getAllRoutes()
 *
 * // Get routes by category
 * const coreRoutes = ApiRoutesService.getCoreRoutes()
 * const entityRoutes = ApiRoutesService.getEntityRoutes()
 *
 * // Get summary stats
 * const summary = ApiRoutesService.getSummary()
 */

import {
  API_ROUTES_METADATA,
  API_ROUTES_SUMMARY,
  type ApiRouteEntry
} from '@nextsparkjs/registries/route-handlers'
import { ENTITY_REGISTRY } from '@nextsparkjs/registries/entity-registry'
import { enabledRouteMethods } from '../entities/api-access'
import type { EntityConfig } from '../entities/types'

/**
 * The entity routes the API explorer lists. The registry metadata lists the full collection and item routes of
 * every entity; an `access.api` object (#376) turns operations off, so each route keeps only its enabled methods
 * and a route with none left is dropped.
 */
function entityRoutes(): ApiRouteEntry[] {
  const configs = Object.values(ENTITY_REGISTRY).map(entry => entry.config as unknown as Partial<EntityConfig>)
  return API_ROUTES_METADATA.entities.flatMap(route => {
    const config = configs.find(candidate => candidate?.slug === route.source)
    if (!config) return [route]
    const methods = enabledRouteMethods(config, route.path.endsWith('/[id]') ? 'item' : 'collection', route.methods)
    return methods.length ? [{ ...route, methods }] : []
  })
}

// Re-export type for convenience
export type { ApiRouteEntry } from '@nextsparkjs/registries/route-handlers'

/**
 * Route category types
 */
export type RouteCategory = 'core' | 'entity' | 'theme' | 'plugin'

/**
 * ApiRoutesService
 *
 * Service layer for API routes metadata queries.
 * All methods are static for consistency with other services.
 */
export class ApiRoutesService {
  // ==================== Query Methods ====================

  /**
   * Get all registered API routes across all categories
   *
   * @returns Array of all API route entries
   *
   * @example
   * const allRoutes = ApiRoutesService.getAllRoutes()
   * console.log(`Total: ${allRoutes.length} routes`)
   */
  static getAllRoutes(): ApiRouteEntry[] {
    return [
      ...API_ROUTES_METADATA.core,
      ...entityRoutes(),
      ...API_ROUTES_METADATA.theme,
      ...API_ROUTES_METADATA.plugins
    ]
  }

  /**
   * Get routes filtered by category
   *
   * @param category - The category to filter by
   * @returns Array of routes in that category
   *
   * @example
   * const entityRoutes = ApiRoutesService.getRoutesByCategory('entity')
   */
  static getRoutesByCategory(category: RouteCategory): ApiRouteEntry[] {
    switch (category) {
      case 'core':
        return API_ROUTES_METADATA.core
      case 'entity':
        return entityRoutes()
      case 'theme':
        return API_ROUTES_METADATA.theme
      case 'plugin':
        return API_ROUTES_METADATA.plugins
      default:
        return []
    }
  }

  /**
   * Get all core API routes
   *
   * @returns Array of core route entries
   */
  static getCoreRoutes(): ApiRouteEntry[] {
    return API_ROUTES_METADATA.core
  }

  /**
   * Get all entity-based API routes
   *
   * @returns Array of entity route entries
   */
  static getEntityRoutes(): ApiRouteEntry[] {
    return entityRoutes()
  }

  /**
   * Get all theme custom API routes
   *
   * @returns Array of theme route entries
   */
  static getThemeRoutes(): ApiRouteEntry[] {
    return API_ROUTES_METADATA.theme
  }

  /**
   * Get all plugin API routes
   *
   * @returns Array of plugin route entries
   */
  static getPluginRoutes(): ApiRouteEntry[] {
    return API_ROUTES_METADATA.plugins
  }

  // ==================== Filter Methods ====================

  /**
   * Get routes that support a specific HTTP method
   *
   * @param method - HTTP method to filter by (GET, POST, PATCH, DELETE, etc.)
   * @returns Array of routes supporting that method
   *
   * @example
   * const postRoutes = ApiRoutesService.getRoutesByMethod('POST')
   */
  static getRoutesByMethod(method: string): ApiRouteEntry[] {
    return this.getAllRoutes().filter(route => route.methods.includes(method))
  }

  /**
   * Get routes by source (entity name, theme name, or plugin name)
   *
   * @param source - The source to filter by
   * @returns Array of routes from that source
   *
   * @example
   * const customerRoutes = ApiRoutesService.getRoutesBySource('customers')
   * const aiRoutes = ApiRoutesService.getRoutesBySource('ai')
   */
  static getRoutesBySource(source: string): ApiRouteEntry[] {
    return this.getAllRoutes().filter(route => route.source === source)
  }

  /**
   * Search routes by path pattern
   *
   * @param pattern - String to search for in route paths
   * @returns Array of matching routes
   *
   * @example
   * const teamRoutes = ApiRoutesService.searchRoutes('team')
   */
  static searchRoutes(pattern: string): ApiRouteEntry[] {
    const lowerPattern = pattern.toLowerCase()
    return this.getAllRoutes().filter(route =>
      route.path.toLowerCase().includes(lowerPattern)
    )
  }

  // ==================== Metadata Methods ====================

  /**
   * Get summary statistics about all API routes
   *
   * @returns Summary object with counts and generation timestamp
   *
   * @example
   * const summary = ApiRoutesService.getSummary()
   * console.log(`Total routes: ${summary.totalRoutes}`)
   */
  static getSummary(): typeof API_ROUTES_SUMMARY {
    return API_ROUTES_SUMMARY
  }

  /**
   * Get total count of all registered routes
   *
   * @returns Number of total routes
   */
  static getTotalCount(): number {
    return API_ROUTES_SUMMARY.totalRoutes
  }

  /**
   * Get count of routes by category
   *
   * @returns Object with counts per category
   */
  static getCountByCategory(): typeof API_ROUTES_SUMMARY.byCategory {
    return API_ROUTES_SUMMARY.byCategory
  }

  /**
   * Get the timestamp when the registry was generated
   *
   * @returns ISO 8601 timestamp string
   */
  static getGeneratedAt(): string {
    return API_ROUTES_SUMMARY.generatedAt
  }

  // ==================== Utility Methods ====================

  /**
   * Check if a specific path exists in the registry
   *
   * @param path - The API path to check
   * @returns true if the path is registered
   *
   * @example
   * if (ApiRoutesService.hasRoute('/api/v1/users')) {
   *   // Route exists
   * }
   */
  static hasRoute(path: string): boolean {
    return this.getAllRoutes().some(route => route.path === path)
  }

  /**
   * Get a specific route by its path
   *
   * @param path - The API path to look up
   * @returns The route entry or undefined if not found
   *
   * @example
   * const route = ApiRoutesService.getRoute('/api/v1/users')
   * if (route) {
   *   console.log(route.methods)
   * }
   */
  static getRoute(path: string): ApiRouteEntry | undefined {
    return this.getAllRoutes().find(route => route.path === path)
  }

  /**
   * Get all unique sources (entity names, plugin names, etc.)
   *
   * @returns Array of unique source names
   */
  static getAllSources(): string[] {
    const sources = new Set<string>()
    this.getAllRoutes().forEach(route => {
      if (route.source) {
        sources.add(route.source)
      }
    })
    return Array.from(sources)
  }

  /**
   * Group routes by their category
   *
   * @returns Object with routes grouped by category
   */
  static getRoutesGroupedByCategory(): Record<RouteCategory, ApiRouteEntry[]> {
    return {
      core: API_ROUTES_METADATA.core,
      entity: entityRoutes(),
      theme: API_ROUTES_METADATA.theme,
      plugin: API_ROUTES_METADATA.plugins
    }
  }
}
