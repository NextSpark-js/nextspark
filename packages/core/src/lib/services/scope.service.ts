/**
 * ScopeService - Provides runtime API scope queries
 *
 * This service layer abstracts scope-registry access, making the registry
 * a pure data structure (Data-Only pattern). All query logic lives here.
 *
 * Performance: All operations are O(1) with zero I/O.
 *
 * @example
 * ```typescript
 * import { ScopeService } from './'
 *
 * // Get base scopes for authentication
 * const baseScopes = ScopeService.getBaseScopes()
 *
 * // Get scopes for a role
 * const adminScopes = ScopeService.getRoleScopes('admin')
 *
 * // Get restriction rules
 * const rules = ScopeService.getRestrictionRules('restricted')
 * ```
 */

import {
  SCOPE_CONFIG,
  API_CONFIG,
  type ScopeConfig,
  type ApiConfig,
} from '@nextsparkjs/registries/scope-registry'

// Re-export types for convenience
export type { ScopeConfig, ApiConfig }

/**
 * Restriction rule structure
 */
export interface RestrictionRule {
  remove?: string[]
  allow_only?: string[]
}

/**
 * ScopeService
 *
 * Static service class for API scope queries.
 * All methods are static - this class is not meant to be instantiated.
 */
export class ScopeService {
  /**
   * Get base scopes for authentication
   *
   * @returns Array of base scope strings
   *
   * @example
   * ```typescript
   * const scopes = ScopeService.getBaseScopes()
   * // ['tasks:read', 'tasks:write', ...]
   * ```
   */
  static getBaseScopes(): string[] {
    return [...SCOPE_CONFIG.base]
  }

  /**
   * Get scopes for a specific role
   *
   * @param role - Role name (e.g., 'admin', 'member')
   * @returns Array of scope strings for the role
   *
   * @example
   * ```typescript
   * const scopes = ScopeService.getRoleScopes('admin')
   * // ['admin:users', 'tasks:delete', ...]
   * ```
   */
  static getRoleScopes(role: string): string[] {
    return SCOPE_CONFIG.roles[role] ? [...SCOPE_CONFIG.roles[role]] : []
  }

  /**
   * Get scopes for a specific flag
   *
   * @param flag - Flag name (e.g., 'beta_tester', 'vip')
   * @returns Array of scope strings for the flag
   *
   * @example
   * ```typescript
   * const scopes = ScopeService.getFlagScopes('vip')
   * // ['vip:features', 'advanced:export']
   * ```
   */
  static getFlagScopes(flag: string): string[] {
    return SCOPE_CONFIG.flags[flag] ? [...SCOPE_CONFIG.flags[flag]] : []
  }

  /**
   * Get allowed API filters
   *
   * @returns Array of allowed filter names
   *
   * @example
   * ```typescript
   * const filters = ScopeService.getAllowedFilters()
   * // ['status', 'role', 'completed', 'userId']
   * ```
   */
  static getAllowedFilters(): string[] {
    return [...API_CONFIG.filters.allowed]
  }

  /**
   * Get restriction rules for a flag
   *
   * @param flag - Flag name (e.g., 'restricted', 'limited_access')
   * @returns Restriction rules object or empty object
   *
   * @example
   * ```typescript
   * const rules = ScopeService.getRestrictionRules('restricted')
   * // { remove: ['delete', 'admin'] }
   * ```
   */
  static getRestrictionRules(flag: string): RestrictionRule {
    return SCOPE_CONFIG.restrictions[flag] || {}
  }

  /**
   * Get entity API paths for route optimization
   *
   * @returns Array of entity API paths
   *
   * @example
   * ```typescript
   * const paths = ScopeService.getEntityApiPaths()
   * // ['/api/v1/tasks', '/api/v1/products', ...]
   * ```
   */
  static getEntityApiPaths(): string[] {
    return [...API_CONFIG.entityPaths]
  }

  // === Additional Helper Methods ===

  /**
   * Get all available roles
   *
   * @returns Array of role names
   *
   * @example
   * ```typescript
   * const roles = ScopeService.getRoles()
   * // ['superadmin', 'admin', 'manager', 'member']
   * ```
   */
  static getRoles(): string[] {
    return Object.keys(SCOPE_CONFIG.roles)
  }

  /**
   * Get all available flags
   *
   * @returns Array of flag names
   *
   * @example
   * ```typescript
   * const flags = ScopeService.getFlags()
   * // ['beta_tester', 'vip', 'early_adopter', 'power_user']
   * ```
   */
  static getFlags(): string[] {
    return Object.keys(SCOPE_CONFIG.flags)
  }

  /**
   * Check if a role exists
   *
   * @param role - Role name to check
   * @returns True if role exists
   *
   * @example
   * ```typescript
   * ScopeService.hasRole('admin') // true
   * ScopeService.hasRole('invalid') // false
   * ```
   */
  static hasRole(role: string): boolean {
    return role in SCOPE_CONFIG.roles
  }

  /**
   * Check if a flag exists
   *
   * @param flag - Flag name to check
   * @returns True if flag exists
   *
   * @example
   * ```typescript
   * ScopeService.hasFlag('vip') // true
   * ScopeService.hasFlag('invalid') // false
   * ```
   */
  static hasFlag(flag: string): boolean {
    return flag in SCOPE_CONFIG.flags
  }

  /**
   * Get the full scope configuration
   *
   * @returns The complete SCOPE_CONFIG object
   *
   * @example
   * ```typescript
   * const config = ScopeService.getScopeConfig()
   * // { base: [...], roles: {...}, flags: {...}, restrictions: {...} }
   * ```
   */
  static getScopeConfig(): ScopeConfig {
    return SCOPE_CONFIG
  }

  /**
   * Get the full API configuration
   *
   * @returns The complete API_CONFIG object
   *
   * @example
   * ```typescript
   * const config = ScopeService.getApiConfig()
   * // { filters: { allowed: [...] }, entityPaths: [...] }
   * ```
   */
  static getApiConfig(): ApiConfig {
    return API_CONFIG
  }
}

// ============================================================================
// Backward Compatibility Exports
// ============================================================================
// These function exports maintain backward compatibility with existing code
// that imports functions directly from the registry.

/**
 * @deprecated Use ScopeService.getBaseScopes() instead
 */
export const getBaseScopes = ScopeService.getBaseScopes

/**
 * @deprecated Use ScopeService.getRoleScopes() instead
 */
export const getRoleScopes = ScopeService.getRoleScopes

/**
 * @deprecated Use ScopeService.getFlagScopes() instead
 */
export const getFlagScopes = ScopeService.getFlagScopes

/**
 * @deprecated Use ScopeService.getAllowedFilters() instead
 */
export const getAllowedFilters = ScopeService.getAllowedFilters

/**
 * @deprecated Use ScopeService.getRestrictionRules() instead
 */
export const getRestrictionRules = ScopeService.getRestrictionRules

/**
 * @deprecated Use ScopeService.getEntityApiPaths() instead
 */
export const getEntityApiPaths = ScopeService.getEntityApiPaths
