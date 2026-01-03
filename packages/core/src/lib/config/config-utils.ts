/**
 * Core Configuration Utilities
 * 
 * Core utility functions for configuration validation and runtime helpers.
 * These functions work with any configuration that follows the defined interfaces.
 */

import type { ApplicationConfig, I18nConfig, EnvironmentConfig } from './config-types'

// =============================================================================
// ENVIRONMENT UTILITIES
// =============================================================================

/**
 * Get current environment configuration
 */
export function getEnvConfig(config: ApplicationConfig): EnvironmentConfig {
  const env = process.env.NODE_ENV || 'development'
  return config.environments[env as keyof typeof config.environments] || config.environments.development
}

/**
 * Check if we're in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development'
}

/**
 * Check if we're in production mode
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

// =============================================================================
// CONFIGURATION VALIDATION
// =============================================================================

/**
 * Validate I18n configuration
 */
export function validateI18nConfig(config: I18nConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Validate supported locales
  if (!config.supportedLocales.length) {
    errors.push('At least one supported locale must be configured')
  }
  
  // Validate default locale is in supported locales
  if (!config.supportedLocales.includes(config.defaultLocale)) {
    errors.push('Default locale must be included in supported locales')
  }
  
  // Validate namespaces
  if (!config.namespaces.length) {
    errors.push('At least one translation namespace must be configured')
  }

  // Validate detection strategy
  if (!config.detectionStrategy.length) {
    errors.push('At least one detection strategy must be configured')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Validate complete application configuration
 */
export function validateApplicationConfig(config: ApplicationConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Validate I18n
  const i18nValidation = validateI18nConfig(config.i18n)
  if (!i18nValidation.valid) {
    errors.push(...i18nValidation.errors.map(error => `I18n: ${error}`))
  }

  // Validate app metadata
  if (!config.app.name?.trim()) {
    errors.push('App: name is required')
  }
  
  if (!config.app.version?.trim()) {
    errors.push('App: version is required')
  }
  
  if (!config.app.contact?.email?.trim()) {
    errors.push('App: contact email is required')
  }

  // Validate user roles
  if (!config.userRoles.availableRoles.length) {
    errors.push('UserRoles: at least one role must be available')
  }
  
  if (!config.userRoles.availableRoles.includes(config.userRoles.defaultRole)) {
    errors.push('UserRoles: defaultRole must be included in availableRoles')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

// =============================================================================
// RUNTIME HELPERS
// =============================================================================

/**
 * Get allowed CORS origins for current environment
 */
export function getAllowedCorsOrigins(config: ApplicationConfig): string[] {
  const env = process.env.NODE_ENV || 'development'
  return config.api.cors.allowedOrigins[env as keyof typeof config.api.cors.allowedOrigins] || []
}

/**
 * Check if all origins are allowed for CORS in current environment
 */
export function isCorsAllowAllOrigins(config: ApplicationConfig): boolean {
  const env = process.env.NODE_ENV || 'development'
  return config.api.cors.allowAllOrigins[env as keyof typeof config.api.cors.allowAllOrigins] || false
}

/**
 * Get user role hierarchy level
 */
export function getRoleHierarchy(config: ApplicationConfig, role: string): number {
  return config.userRoles.hierarchy[role] ?? 999 // Default to lowest priority
}

/**
 * Check if a role has higher or equal permissions than another
 */
export function hasRolePermission(config: ApplicationConfig, userRole: string, requiredRole: string): boolean {
  const userLevel = getRoleHierarchy(config, userRole)
  const requiredLevel = getRoleHierarchy(config, requiredRole)
  return userLevel <= requiredLevel // Lower number = higher permissions
}

/**
 * Get feature flag value with environment fallback
 */
export function getFeatureFlag(config: ApplicationConfig, featureName: keyof ApplicationConfig['features']): boolean {
  return config.features[featureName] ?? false
}

// =============================================================================
// DEBUGGING HELPERS
// =============================================================================

/**
 * Log configuration status (development only)
 */
export function debugConfig(config: ApplicationConfig): void {
  if (!isDevelopment()) return

  const validation = validateApplicationConfig(config)
  
  console.group('🔧 Application Configuration Debug')
  console.log('Valid:', validation.valid)
  
  if (!validation.valid) {
    console.error('Validation Errors:', validation.errors)
  }
  
  console.log('Environment:', process.env.NODE_ENV)
  console.log('App Name:', config.app.name)
  console.log('Supported Locales:', config.i18n.supportedLocales)
  console.log('Available Roles:', config.userRoles.availableRoles)
  console.log('Feature Flags:', config.features)
  console.groupEnd()
}
