/**
 * NamespaceService - Provides runtime i18n namespace queries
 *
 * This service layer abstracts namespace-registry access, making the registry
 * a pure data structure (Data-Only pattern). All query logic lives here.
 *
 * Performance: All operations are O(1) with zero I/O.
 *
 * @example
 * ```typescript
 * import { NamespaceService } from './'
 *
 * // Get core namespaces
 * const core = NamespaceService.getCoreNamespaces()
 * // ['common', 'dashboard', 'settings', ...]
 *
 * // Detect route strategy from pathname
 * const strategy = NamespaceService.detectRouteStrategy('/dashboard/tasks')
 * // 'DASHBOARD_AUTHENTICATED'
 *
 * // Get optimized namespaces for a strategy
 * const config = NamespaceService.getOptimizedNamespaces(strategy)
 * // { core: [...], entities: [...], strategy: '...' }
 * ```
 */

import {
  NAMESPACE_CONFIG,
  type RouteNamespaceConfig,
  type NamespaceConfig,
} from '@nextsparkjs/registries/namespace-registry'

// Re-export types for convenience
export type { RouteNamespaceConfig, NamespaceConfig }

/**
 * Route strategy types
 */
export type RouteStrategy =
  | 'DASHBOARD_AUTHENTICATED'
  | 'AUTH_ONLY'
  | 'PUBLIC_INITIAL'
  | 'SUPERADMIN'
  | 'UNKNOWN_FALLBACK'

/**
 * NamespaceService
 *
 * Static service class for i18n namespace queries.
 * All methods are static - this class is not meant to be instantiated.
 */
export class NamespaceService {
  /**
   * Get core namespaces (excluding entity namespaces)
   *
   * @returns Array of core namespace names
   *
   * @example
   * ```typescript
   * const namespaces = NamespaceService.getCoreNamespaces()
   * // ['common', 'dashboard', 'settings', 'auth', 'public', 'validation', 'admin']
   * ```
   */
  static getCoreNamespaces(): string[] {
    // Return a copy to prevent mutation
    return [...NAMESPACE_CONFIG.core]
  }

  /**
   * Get entity namespaces
   *
   * @returns Array of entity namespace names
   *
   * @example
   * ```typescript
   * const namespaces = NamespaceService.getEntityNamespaces()
   * // [] (empty if no entity namespaces configured)
   * ```
   */
  static getEntityNamespaces(): string[] {
    // Return a copy to prevent mutation
    return [...NAMESPACE_CONFIG.entities]
  }

  /**
   * Get optimized namespaces based on route strategy
   *
   * Returns the namespace configuration for a specific route strategy.
   * Falls back to UNKNOWN_FALLBACK if strategy is not found.
   *
   * @param strategy - The route strategy name
   * @returns Namespace configuration for the strategy
   *
   * @example
   * ```typescript
   * const config = NamespaceService.getOptimizedNamespaces('DASHBOARD_AUTHENTICATED')
   * // { core: ['common', 'dashboard', ...], entities: [], strategy: 'DASHBOARD_AUTHENTICATED' }
   * ```
   */
  static getOptimizedNamespaces(strategy: string): RouteNamespaceConfig {
    return NAMESPACE_CONFIG.routes[strategy] || NAMESPACE_CONFIG.routes['UNKNOWN_FALLBACK']
  }

  /**
   * Detect route strategy based on pathname
   *
   * Analyzes the pathname to determine which route strategy should be used.
   * This affects which namespaces are loaded for i18n optimization.
   *
   * @param pathname - The URL pathname to analyze
   * @returns The detected route strategy
   *
   * @example
   * ```typescript
   * NamespaceService.detectRouteStrategy('/dashboard') // 'DASHBOARD_AUTHENTICATED'
   * NamespaceService.detectRouteStrategy('/login') // 'AUTH_ONLY'
   * NamespaceService.detectRouteStrategy('/pricing') // 'PUBLIC_INITIAL'
   * NamespaceService.detectRouteStrategy('/superadmin') // 'SUPERADMIN'
   * NamespaceService.detectRouteStrategy('/unknown') // 'UNKNOWN_FALLBACK'
   * ```
   */
  static detectRouteStrategy(pathname: string): RouteStrategy {
    // Dashboard pages
    if (pathname.startsWith('/dashboard')) {
      return 'DASHBOARD_AUTHENTICATED'
    }

    // Auth pages
    if (
      pathname.startsWith('/auth') ||
      pathname === '/login' ||
      pathname === '/signup' ||
      pathname === '/forgot-password' ||
      pathname === '/reset-password' ||
      pathname === '/verify-email'
    ) {
      return 'AUTH_ONLY'
    }

    // Public pages with entity paths
    const isPublicWithEntity =
      pathname === '/' ||
      pathname.startsWith('/pricing') ||
      pathname.startsWith('/docs') ||
      pathname.startsWith('/support') ||
      pathname.startsWith('/features') ||
      NAMESPACE_CONFIG.entityPaths.some((path) => pathname.startsWith(path))

    if (isPublicWithEntity) {
      return 'PUBLIC_INITIAL'
    }

    // Superadmin panel pages
    if (pathname.startsWith('/superadmin')) {
      return 'SUPERADMIN'
    }

    // Unknown route
    return 'UNKNOWN_FALLBACK'
  }

  /**
   * Get entity paths for namespace route detection
   *
   * @returns Array of entity paths used in route detection
   *
   * @example
   * ```typescript
   * const paths = NamespaceService.getEntityPaths()
   * // [] (empty if no entity paths configured)
   * ```
   */
  static getEntityPaths(): string[] {
    // Return a copy to prevent mutation
    return [...NAMESPACE_CONFIG.entityPaths]
  }

  /**
   * Get all available route strategies
   *
   * @returns Array of all route strategy names
   *
   * @example
   * ```typescript
   * const strategies = NamespaceService.getStrategies()
   * // ['DASHBOARD_AUTHENTICATED', 'AUTH_ONLY', 'PUBLIC_INITIAL', 'SUPERADMIN', 'UNKNOWN_FALLBACK']
   * ```
   */
  static getStrategies(): string[] {
    return Object.keys(NAMESPACE_CONFIG.routes)
  }

  /**
   * Check if a route strategy exists
   *
   * @param strategy - The strategy name to check
   * @returns True if the strategy exists
   *
   * @example
   * ```typescript
   * NamespaceService.hasStrategy('DASHBOARD_AUTHENTICATED') // true
   * NamespaceService.hasStrategy('INVALID') // false
   * ```
   */
  static hasStrategy(strategy: string): boolean {
    return strategy in NAMESPACE_CONFIG.routes
  }

  /**
   * Get the full namespace configuration
   *
   * @returns The complete namespace configuration object
   *
   * @example
   * ```typescript
   * const config = NamespaceService.getConfig()
   * // { core: [...], entities: [...], routes: {...}, entityPaths: [...] }
   * ```
   */
  static getConfig(): NamespaceConfig {
    return NAMESPACE_CONFIG
  }
}

// ============================================================================
// Backward Compatibility Exports
// ============================================================================
// These function exports maintain backward compatibility with existing code
// that imports functions directly from the registry.

/**
 * @deprecated Use NamespaceService.getCoreNamespaces() instead
 */
export const getCoreNamespaces = NamespaceService.getCoreNamespaces

/**
 * @deprecated Use NamespaceService.getEntityNamespaces() instead
 */
export const getEntityNamespaces = NamespaceService.getEntityNamespaces

/**
 * @deprecated Use NamespaceService.getOptimizedNamespaces() instead
 */
export const getOptimizedNamespaces = NamespaceService.getOptimizedNamespaces

/**
 * @deprecated Use NamespaceService.detectRouteStrategy() instead
 */
export const detectRouteStrategy = NamespaceService.detectRouteStrategy

/**
 * @deprecated Use NamespaceService.getEntityPaths() instead
 */
export const getEntityNamespacePaths = NamespaceService.getEntityPaths
