/**
 * Core Configuration Loader
 *
 * This module provides async access to the merged application configuration.
 * The actual merge logic is in config-sync.ts (synchronous).
 *
 * @deprecated Most code should import directly from config-sync.ts for synchronous access.
 * This async loader is maintained for backward compatibility with code that expects async config loading.
 */

import type { ApplicationConfig } from './config-types'
import { APP_CONFIG_MERGED } from './config-sync'

// =============================================================================
// CONFIGURATION LOADING
// =============================================================================

/**
 * Load application configuration (async wrapper for compatibility)
 *
 * @deprecated Import APP_CONFIG_MERGED from config-sync.ts instead for synchronous access
 */
export async function loadApplicationConfig(): Promise<ApplicationConfig> {
  // Convert merged config to ApplicationConfig type with all required properties
  return {
    ...APP_CONFIG_MERGED,
    // Add placeholder properties to satisfy ApplicationConfig interface (unused)
    i18n: {
      ...APP_CONFIG_MERGED.i18n,
      detectionStrategy: ['user_database', 'cookie', 'header', 'default'] as const,
      performance: {
        ...APP_CONFIG_MERGED.i18n.performance,
        lazyLoadNamespaces: false,
        enableFallbackChaining: true,
      }
    },
    app: {
      ...APP_CONFIG_MERGED.app,
      description: '',
      contact: {
        email: '',
        website: '',
        documentation: '',
      },
    },
    features: {
      enableAnalytics: false,
      enableNotifications: false,
      enableBilling: false,
      enableTeamFeatures: false,
      enableAdvancedSecurity: false,
      enableAPIAccess: false,
    },
    ui: {
      theme: {
        defaultMode: 'system' as const,
        allowUserToggle: true,
      },
      notifications: {
        position: 'top-right' as const,
        maxVisible: 5,
        autoHideDuration: 5000,
      }
    },
    environments: {
      development: {
        enableDebugLogs: true,
        enableTranslationDebugging: true,
        strictTypeChecking: true,
        enablePerformanceMonitoring: false,
      },
      production: {
        enableDebugLogs: false,
        enableTranslationDebugging: false,
        strictTypeChecking: true,
        enablePerformanceMonitoring: true,
      }
    }
  }
}

/**
 * Get a minimal fallback configuration for emergency cases
 */
function getMinimalFallbackConfig(): ApplicationConfig {
  return {
    i18n: {
      supportedLocales: ['en'],
      defaultLocale: 'en',
      detectionStrategy: ['default'],
      cookie: {
        name: 'locale',
        maxAge: 365 * 24 * 60 * 60 * 1000,
        httpOnly: false,
        secure: 'auto',
        sameSite: 'lax',
        path: '/',
      },
      namespaces: ['common'],
      performance: {
        lazyLoadNamespaces: false,
        preloadCriticalNamespaces: ['common'],
        enableFallbackChaining: true,
      }
    },
    app: {
      name: 'Application',
      version: '1.0.0',
      description: 'Application',
      contact: {
        email: 'support@example.com',
        website: 'https://example.com',
        documentation: 'https://docs.example.com',
      }
    },
    userRoles: {
      defaultRole: 'member',
      availableRoles: ['member', 'admin'],
      hierarchy: {
        admin: 0,
        member: 1,
      },
      displayNames: {
        member: 'common.userRoles.member',
        admin: 'common.userRoles.admin',
      }
    },
    features: {
      enableAnalytics: false,
      enableNotifications: true,
      enableBilling: false,
      enableTeamFeatures: false,
      enableAdvancedSecurity: false,
      enableAPIAccess: true,
    },
    api: {
      cors: {
        allowedOrigins: {
          development: ['http://localhost:3000'],
          production: [],
        },
        allowAllOrigins: {
          development: true,
          production: false,
        }
      }
    },
    ui: {
      theme: {
        defaultMode: 'system',
        allowUserToggle: true,
      },
      notifications: {
        position: 'top-right',
        maxVisible: 5,
        autoHideDuration: 5000,
      }
    },
    environments: {
      development: {
        enableDebugLogs: true,
        enableTranslationDebugging: true,
        strictTypeChecking: true,
        enablePerformanceMonitoring: false,
      },
      production: {
        enableDebugLogs: false,
        enableTranslationDebugging: false,
        strictTypeChecking: true,
        enablePerformanceMonitoring: true,
      }
    }
  }
}

// =============================================================================
// SINGLETON PATTERN FOR CONFIGURATION
// =============================================================================

let cachedConfig: ApplicationConfig | null = null

/**
 * Get application configuration (cached)
 * This ensures configuration is only loaded once per application lifecycle
 */
export async function getApplicationConfig(): Promise<ApplicationConfig> {
  if (cachedConfig) {
    return cachedConfig
  }
  
  cachedConfig = await loadApplicationConfig()
  return cachedConfig
}

/**
 * Clear configuration cache (useful for testing)
 */
export function clearConfigCache(): void {
  cachedConfig = null
}
