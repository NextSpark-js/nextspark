/**
 * User-related types and constants
 * All role configuration is centralized in app.config.ts
 */

import { USER_ROLES_CONFIG } from '../lib/config';
import type { UserFlag } from '../lib/entities/types';

// Derive user role type from app configuration (includes core + theme roles)
export type UserRole = typeof USER_ROLES_CONFIG.availableRoles[number];

// Derive core role type from app configuration (only protected core roles)
export type CoreRole = typeof USER_ROLES_CONFIG.coreRoles[number];

// Helper function to create USER_ROLES constants dynamically
function createUserRolesConstants<T extends readonly string[]>(availableRoles: T) {
  const roles = {} as Record<string, T[number]>;
  
  availableRoles.forEach(role => {
    const key = role.toUpperCase();
    roles[key] = role;
  });
  
  return roles as Record<Uppercase<T[number]>, T[number]>;
}

/**
 * USER_ROLES
 * This constant is generated dynamically from the app config.
 * It is used to check user roles and permissions.
 */
// Generate USER_ROLES dynamically from app config (zero duplication)
export const USER_ROLES = createUserRolesConstants(USER_ROLES_CONFIG.availableRoles);

// Role hierarchy - sourced from app config
export const ROLE_HIERARCHY = USER_ROLES_CONFIG.hierarchy;

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
export const isCoreRole = (role: UserRole): role is CoreRole => {
  return (USER_ROLES_CONFIG.coreRoles as readonly string[]).includes(role);
};

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
export const isThemeRole = (role: UserRole): boolean => {
  return !isCoreRole(role);
};

// Helper functions for role checking
export const roleHelpers = {
  /**
   * Check if a role has hierarchy level equal or higher than required role
   */
  hasRoleLevel: (userRole: UserRole, requiredRole: UserRole): boolean => {
    return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
  },

  /**
   * Check if user is admin or higher
   */
  isAdmin: (userRole: UserRole): boolean => {
    return roleHelpers.hasRoleLevel(userRole, USER_ROLES.ADMIN);
  },

  /**
   * Check if user is superadmin
   */
  isSuperAdmin: (userRole: UserRole): boolean => {
    return userRole === USER_ROLES.SUPERADMIN;
  },

  /**
   * Check if user is developer
   */
  isDeveloper: (userRole: UserRole): boolean => {
    return userRole === USER_ROLES.DEVELOPER;
  },

  /**
   * Check if user can access Admin Panel (superadmin or developer)
   */
  canAccessAdmin: (userRole: UserRole): boolean => {
    return userRole === USER_ROLES.SUPERADMIN || userRole === USER_ROLES.DEVELOPER;
  },

  /**
   * Get role display name translation key
   * Use with i18n: t(getRoleDisplayKey(role))
   */
  getRoleDisplayKey: (role: UserRole): string => {
    return USER_ROLES_CONFIG.displayNames[role];
  },

  /**
   * Get all roles ordered by hierarchy (highest permissions first)
   */
  getAllRolesByHierarchy: (): UserRole[] => {
    return USER_ROLES_CONFIG.availableRoles.slice().sort(
      (a: UserRole, b: UserRole) => ROLE_HIERARCHY[b] - ROLE_HIERARCHY[a]
    );
  }
};

// Main User interface for the application
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

// User interface with flags included
export interface UserWithFlags extends User {
  flags: UserFlag[];
}

// Session user type for auth contexts
export interface SessionUser extends User {
  flags?: UserFlag[];
}
