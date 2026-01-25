/**
 * Core Configuration Types
 * 
 * Base types and interfaces for application configuration system.
 * These types define the structure but not the values.
 */

// =============================================================================
// CORE CONFIGURATION INTERFACES
// =============================================================================

export interface I18nConfig {
  supportedLocales: readonly string[]
  defaultLocale: string
  detectionStrategy: readonly ('user_database' | 'cookie' | 'header' | 'default')[]
  cookie: {
    name: string
    maxAge: number
    httpOnly: boolean
    secure: 'auto' | boolean
    sameSite: 'strict' | 'lax' | 'none'
    path: string
  }
  namespaces: readonly string[]
  performance: {
    lazyLoadNamespaces: boolean
    preloadCriticalNamespaces: readonly string[]
    enableFallbackChaining: boolean
  }
}

export interface UserRolesConfig {
  defaultRole: string
  availableRoles: readonly string[]
  hierarchy: Record<string, number>
  displayNames: Record<string, string>
}

export interface FeaturesConfig {
  enableAnalytics: boolean
  enableNotifications: boolean
  enableBilling: boolean
  enableTeamFeatures: boolean
  enableAdvancedSecurity: boolean
  enableAPIAccess: boolean
}

export interface ApiConfig {
  cors: {
    allowedOrigins: {
      development: string[]
      production: string[]
    }
    allowAllOrigins: {
      development: boolean
      production: boolean
    }
    /**
     * Theme extension pattern for CORS origins
     * Use this to add theme-specific origins without duplicating core defaults
     * These are merged with core allowedOrigins at runtime
     */
    additionalOrigins?: {
      development?: readonly string[]
      production?: readonly string[]
    }
  }
}

export interface UiConfig {
  theme: {
    defaultMode: 'light' | 'dark' | 'system'
    allowUserToggle: boolean
  }
  notifications: {
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
    maxVisible: number
    autoHideDuration: number
  }
}

export interface AppMetadata {
  name: string
  version: string
  description: string
  contact: {
    email: string
    website: string
    documentation: string
  }
}

export interface EnvironmentConfig {
  enableDebugLogs: boolean
  enableTranslationDebugging: boolean
  strictTypeChecking: boolean
  enablePerformanceMonitoring: boolean
}

// =============================================================================
// MAIN APPLICATION CONFIG INTERFACE
// =============================================================================

export interface ApplicationConfig {
  i18n: I18nConfig
  app: AppMetadata
  userRoles: UserRolesConfig
  features: FeaturesConfig
  api: ApiConfig
  ui: UiConfig
  environments: {
    development: EnvironmentConfig
    production: EnvironmentConfig
  }
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export type SupportedLocaleGeneric<T extends I18nConfig> = T['supportedLocales'][number]
export type TranslationNamespaceGeneric<T extends I18nConfig> = T['namespaces'][number]
export type ThemeMode = UiConfig['theme']['defaultMode']
export type NotificationPosition = UiConfig['notifications']['position']
export type UserRoleGeneric<T extends UserRolesConfig> = T['availableRoles'][number]
