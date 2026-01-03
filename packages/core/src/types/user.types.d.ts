/**
 * User-related types and constants
 * All role configuration is centralized in app.config.ts
 */
import { USER_ROLES_CONFIG } from '../lib/config';
import type { UserFlag } from '../lib/entities/types';
export type UserRole = typeof USER_ROLES_CONFIG.availableRoles[number];
export type CoreRole = typeof USER_ROLES_CONFIG.coreRoles[number];
/**
 * USER_ROLES
 * This constant is generated dynamically from the app config.
 * It is used to check user roles and permissions.
 */
export declare const USER_ROLES: Record<Uppercase<any>, any>;
export declare const ROLE_HIERARCHY: any;
/**
 * Type guard to check if a role is a core role
 *
 * Core roles are protected system roles (member, superadmin, developer) that:
 * - Cannot be removed by themes
 * - Have special behavior in guards/middleware
 * - Are defined in the core application config
 *
 * @param role - The role to check
 * @returns True if the role is a core role, false if it's a theme-specific role
 *
 * @example
 * ```typescript
 * if (isCoreRole('member')) {
 *   // This is a protected core role
 * }
 *
 * if (isCoreRole('editor')) {
 *   // False - this is a theme-specific role
 * }
 * ```
 */
export declare const isCoreRole: (role: UserRole) => role is CoreRole;
/**
 * Helper to check if a role is a theme-specific role (not a core role)
 *
 * Theme roles are custom roles added by themes via `additionalRoles`.
 * They provide flexibility for vertical-specific applications (CRM, Blog, etc.)
 *
 * @param role - The role to check
 * @returns True if the role is theme-specific, false if it's a core role
 *
 * @example
 * ```typescript
 * if (isThemeRole('editor')) {
 *   // This is a custom role added by the theme
 * }
 *
 * if (isThemeRole('member')) {
 *   // False - this is a core role
 * }
 * ```
 */
export declare const isThemeRole: (role: UserRole) => boolean;
export declare const roleHelpers: {
    /**
     * Check if a role has hierarchy level equal or higher than required role
     */
    hasRoleLevel: (userRole: UserRole, requiredRole: UserRole) => boolean;
    /**
     * Check if user is admin or higher
     */
    isAdmin: (userRole: UserRole) => boolean;
    /**
     * Check if user is superadmin
     */
    isSuperAdmin: (userRole: UserRole) => boolean;
    /**
     * Check if user is developer
     */
    isDeveloper: (userRole: UserRole) => boolean;
    /**
     * Check if user can access Admin Panel (superadmin or developer)
     */
    canAccessAdmin: (userRole: UserRole) => boolean;
    /**
     * Get role display name translation key
     * Use with i18n: t(getRoleDisplayKey(role))
     */
    getRoleDisplayKey: (role: UserRole) => string;
    /**
     * Get all roles ordered by hierarchy (highest permissions first)
     */
    getAllRolesByHierarchy: () => UserRole[];
};
export interface User {
    id: string;
    email: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    role: UserRole;
    image?: string;
    emailVerified?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
    country?: string;
    timezone?: string;
    language?: string;
}
export interface UserWithFlags extends User {
    flags: UserFlag[];
}
export interface SessionUser extends User {
    flags?: UserFlag[];
}
//# sourceMappingURL=user.types.d.ts.map