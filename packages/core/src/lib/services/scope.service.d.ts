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
import { type ScopeConfig, type ApiConfig } from '@nextsparkjs/registries/scope-registry';
export type { ScopeConfig, ApiConfig };
/**
 * Restriction rule structure
 */
export interface RestrictionRule {
    remove?: string[];
    allow_only?: string[];
}
/**
 * ScopeService
 *
 * Static service class for API scope queries.
 * All methods are static - this class is not meant to be instantiated.
 */
export declare class ScopeService {
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
    static getBaseScopes(): string[];
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
    static getRoleScopes(role: string): string[];
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
    static getFlagScopes(flag: string): string[];
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
    static getAllowedFilters(): string[];
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
    static getRestrictionRules(flag: string): RestrictionRule;
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
    static getEntityApiPaths(): string[];
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
    static getRoles(): string[];
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
    static getFlags(): string[];
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
    static hasRole(role: string): boolean;
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
    static hasFlag(flag: string): boolean;
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
    static getScopeConfig(): ScopeConfig;
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
    static getApiConfig(): ApiConfig;
}
/**
 * @deprecated Use ScopeService.getBaseScopes() instead
 */
export declare const getBaseScopes: typeof ScopeService.getBaseScopes;
/**
 * @deprecated Use ScopeService.getRoleScopes() instead
 */
export declare const getRoleScopes: typeof ScopeService.getRoleScopes;
/**
 * @deprecated Use ScopeService.getFlagScopes() instead
 */
export declare const getFlagScopes: typeof ScopeService.getFlagScopes;
/**
 * @deprecated Use ScopeService.getAllowedFilters() instead
 */
export declare const getAllowedFilters: typeof ScopeService.getAllowedFilters;
/**
 * @deprecated Use ScopeService.getRestrictionRules() instead
 */
export declare const getRestrictionRules: typeof ScopeService.getRestrictionRules;
/**
 * @deprecated Use ScopeService.getEntityApiPaths() instead
 */
export declare const getEntityApiPaths: typeof ScopeService.getEntityApiPaths;
//# sourceMappingURL=scope.service.d.ts.map