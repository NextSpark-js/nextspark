/**
 * Permission Service
 *
 * Provides runtime permission checks and role-based access control logic.
 * Uses pre-computed data from permissions-registry for O(1) operations.
 *
 * Query functions moved here from permissions-registry to follow data-only pattern.
 *
 * @module PermissionService
 */
import type { Permission, ResolvedPermission } from '../permissions/types';
export declare class PermissionService {
    /**
     * Check if a role has a specific permission - O(1)
     *
     * @param role - Team role to check
     * @param permission - Permission to verify
     * @returns True if role has permission
     *
     * @example
     * const canCreate = PermissionService.hasPermission('admin', 'customers.create')
     */
    static hasPermission(role: string, permission: Permission): boolean;
    /**
     * Unified permission check - works for teams, entities, and features - O(1)
     *
     * This is the recommended method for checking any type of permission.
     * It checks across all permission sources:
     * - Team permissions (team.view, team.edit, team.members.invite, etc.)
     * - Entity permissions (customers.create, tasks.update, etc.)
     * - Feature permissions (page-builder.access, media.upload, etc.)
     *
     * @param role - Team role to check
     * @param action - Action to verify (e.g., 'team.edit', 'customers.create', 'page-builder.access')
     * @returns True if role can perform action
     *
     * @example
     * // Team permission
     * PermissionService.canDoAction('admin', 'team.edit')
     *
     * // Entity permission
     * PermissionService.canDoAction('admin', 'customers.create')
     *
     * // Feature permission
     * PermissionService.canDoAction('editor', 'page-builder.access')
     */
    static canDoAction(role: string, action: string): boolean;
    /**
     * Get all permissions for a role - O(1)
     *
     * @param role - Team role
     * @returns Array of permissions for the role
     *
     * @example
     * const permissions = PermissionService.getRolePermissions('admin')
     */
    static getRolePermissions(role: string): Permission[];
    /**
     * Get permissions by category - O(1)
     *
     * @param category - Permission category
     * @returns Array of resolved permissions in category
     *
     * @example
     * const customerPerms = PermissionService.getByCategory('customers')
     */
    static getByCategory(category: string): ResolvedPermission[];
    /**
     * Get all permission categories
     *
     * @returns Array of category names
     *
     * @example
     * const categories = PermissionService.getCategories()
     */
    static getCategories(): string[];
    /**
     * Get full permission matrix for UI - O(1)
     *
     * Returns copies to prevent mutation of internal data.
     *
     * @returns Object with permissions, matrix, sections, and roles
     *
     * @example
     * const matrix = PermissionService.getMatrix()
     * // Use in Admin Panel permissions UI
     */
    static getMatrix(): {
        permissions: any[];
        matrix: any;
        sections: any[];
        roles: any[];
    };
    /**
     * Check if a permission ID is valid - O(1)
     *
     * @param permission - Permission to validate
     * @returns True if permission exists
     *
     * @example
     * if (PermissionService.isValid('customers.create')) {
     *   // Valid permission
     * }
     */
    static isValid(permission: Permission): boolean;
    /**
     * Get permission configuration - O(n)
     *
     * @param permission - Permission to get config for
     * @returns Permission config or undefined
     *
     * @example
     * const config = PermissionService.getConfig('customers.delete')
     * if (config?.dangerous) {
     *   // Show warning
     * }
     */
    static getConfig(permission: Permission): ResolvedPermission | undefined;
    /**
     * Get all permissions
     *
     * @returns Array of all permission IDs
     *
     * @example
     * const allPerms = PermissionService.getAll()
     */
    static getAll(): Permission[];
    /**
     * Check if a role has ANY of the specified permissions
     *
     * @param role - Team role to check
     * @param permissions - Array of permissions to check
     * @returns True if role has at least one permission
     *
     * @example
     * const canManage = PermissionService.hasAnyPermission('member', [
     *   'customers.create',
     *   'customers.update'
     * ])
     */
    static hasAnyPermission(role: string, permissions: Permission[]): boolean;
    /**
     * Check if a role has ALL of the specified permissions
     *
     * @param role - Team role to check
     * @param permissions - Array of permissions to check
     * @returns True if role has all permissions
     *
     * @example
     * const canFullyManage = PermissionService.hasAllPermissions('admin', [
     *   'customers.create',
     *   'customers.update',
     *   'customers.delete'
     * ])
     */
    static hasAllPermissions(role: string, permissions: Permission[]): boolean;
}
/**
 * Check if role has permission
 * @deprecated Use PermissionService.hasPermission() instead
 */
export declare const hasPermission: typeof PermissionService.hasPermission;
/**
 * Unified permission check - works for teams, entities, and features
 * This is the recommended function for checking any type of permission.
 */
export declare const canDoAction: typeof PermissionService.canDoAction;
/**
 * Get all permissions for a role
 * @deprecated Use PermissionService.getRolePermissions() instead
 */
export declare const getRolePermissions: typeof PermissionService.getRolePermissions;
/**
 * Get permissions by category
 * @deprecated Use PermissionService.getByCategory() instead
 */
export declare const getPermissionsByCategory: typeof PermissionService.getByCategory;
/**
 * Get all categories
 * @deprecated Use PermissionService.getCategories() instead
 */
export declare const getCategories: typeof PermissionService.getCategories;
/**
 * Get full matrix for UI
 * @deprecated Use PermissionService.getMatrix() instead
 */
export declare const getFullMatrix: typeof PermissionService.getMatrix;
/**
 * Check if permission exists
 * @deprecated Use PermissionService.isValid() instead
 */
export declare const isValidPermission: typeof PermissionService.isValid;
/**
 * Get permission config
 * @deprecated Use PermissionService.getConfig() instead
 */
export declare const getPermissionConfig: typeof PermissionService.getConfig;
/**
 * Legacy permission registry interface
 * @deprecated Use PermissionService class methods instead
 */
export declare const permissionRegistry: {
    hasPermission: typeof PermissionService.hasPermission;
    canDoAction: typeof PermissionService.canDoAction;
    getRolePermissions: typeof PermissionService.getRolePermissions;
    getPermissionsByCategory: typeof PermissionService.getByCategory;
    getFullMatrix: typeof PermissionService.getMatrix;
    getPermissionConfig: typeof PermissionService.getConfig;
    isValidPermission: typeof PermissionService.isValid;
    isInitialized: () => boolean;
};
//# sourceMappingURL=permission.service.d.ts.map