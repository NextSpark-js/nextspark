/**
 * Core Configuration Utilities
 *
 * Core utility functions for configuration validation and runtime helpers.
 * These functions work with any configuration that follows the defined interfaces.
 */
import type { ApplicationConfig, I18nConfig, EnvironmentConfig } from './config-types';
/**
 * Get current environment configuration
 */
export declare function getEnvConfig(config: ApplicationConfig): EnvironmentConfig;
/**
 * Check if we're in development mode
 */
export declare function isDevelopment(): boolean;
/**
 * Check if we're in production mode
 */
export declare function isProduction(): boolean;
/**
 * Validate I18n configuration
 */
export declare function validateI18nConfig(config: I18nConfig): {
    valid: boolean;
    errors: string[];
};
/**
 * Validate complete application configuration
 */
export declare function validateApplicationConfig(config: ApplicationConfig): {
    valid: boolean;
    errors: string[];
};
/**
 * Get allowed CORS origins for current environment
 */
export declare function getAllowedCorsOrigins(config: ApplicationConfig): string[];
/**
 * Check if all origins are allowed for CORS in current environment
 */
export declare function isCorsAllowAllOrigins(config: ApplicationConfig): boolean;
/**
 * Get user role hierarchy level
 */
export declare function getRoleHierarchy(config: ApplicationConfig, role: string): number;
/**
 * Check if a role has higher or equal permissions than another
 */
export declare function hasRolePermission(config: ApplicationConfig, userRole: string, requiredRole: string): boolean;
/**
 * Get feature flag value with environment fallback
 */
export declare function getFeatureFlag(config: ApplicationConfig, featureName: keyof ApplicationConfig['features']): boolean;
/**
 * Log configuration status (development only)
 */
export declare function debugConfig(config: ApplicationConfig): void;
//# sourceMappingURL=config-utils.d.ts.map