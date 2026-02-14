/**
 * Synchronous Configuration Access
 *
 * For cases where we need synchronous access to configuration values,
 * we directly import the project config. This is primarily for types and
 * constants that need to be available at build time.
 *
 * Configuration Merge System:
 * 1. Loads default configs from core (app.config + dashboard.config)
 * 2. Loads theme-specific config overrides (if exists)
 * 3. Validates theme config (development only)
 * 4. Merges theme config over defaults (theme overrides)
 * 5. Provides unified configuration for the application
 */

// Direct imports for synchronous access
import { DEFAULT_APP_CONFIG } from './app.config'
import { DEFAULT_DASHBOARD_CONFIG } from './dashboard.config'
import { ThemeService, type ThemeName } from '../services/theme.service'
import { mergeConfigs } from '../utils/config-merge'
import { mergeRolesConfig, mergeTeamRolesConfig } from './roles-merge'
// Import team roles from permissions-registry (single source of truth)
import {
  AVAILABLE_ROLES as REGISTRY_AVAILABLE_ROLES,
  ROLE_HIERARCHY as REGISTRY_ROLE_HIERARCHY,
  ROLE_DISPLAY_NAMES as REGISTRY_ROLE_DISPLAY_NAMES,
  ROLE_DESCRIPTIONS as REGISTRY_ROLE_DESCRIPTIONS,
} from '@nextsparkjs/registries/permissions-registry'
// import { safeValidateDashboardConfig } from './dashboard-schema' // Not used for now

// =============================================================================
// GLOBAL CACHE - Prevents re-execution on each module import
// =============================================================================

// Debug flag - only log if explicitly enabled
const DEBUG_CONFIG = process.env.NEXTSPARK_DEBUG_CONFIG === 'true'

interface NextSparkConfigCache {
  __nextspark_app_config?: ReturnType<typeof loadAppConfigInternal>
  __nextspark_dashboard_config?: ReturnType<typeof loadDashboardConfigInternal>
  __nextspark_dev_config?: ReturnType<typeof loadDevConfigInternal>
}

const globalCache = globalThis as unknown as NextSparkConfigCache

// =============================================================================
// APP CONFIG MERGE LOGIC
// =============================================================================

/**
 * Merge default app config with theme-specific config
 * Uses build-time registry for zero I/O operations
 */
function loadAppConfigInternal() {
  const activeTheme = process.env.NEXT_PUBLIC_ACTIVE_THEME

  if (DEBUG_CONFIG) {
    console.log('[config-sync] Loading app config for theme:', activeTheme)
  }

  // If no theme is active, return default config
  if (!activeTheme) {
    if (DEBUG_CONFIG) {
      console.log('[config-sync] No active theme, using default app config')
    }
    return DEFAULT_APP_CONFIG
  }

  // Load theme-specific config overrides from build-time registry
  const themeConfigOverrides = ThemeService.getAppConfig(activeTheme)

  // If theme has no app config overrides, return default
  if (!themeConfigOverrides) {
    if (DEBUG_CONFIG) {
      console.log('[config-sync] Theme has no app config overrides, using default')
    }
    return DEFAULT_APP_CONFIG
  }

  if (DEBUG_CONFIG) {
    console.log('[config-sync] Theme app config overrides loaded from registry')
  }

  // Merge theme config over default config
  const mergedConfig = mergeConfigs(DEFAULT_APP_CONFIG, themeConfigOverrides)

  // Apply special merge for userRoles (additive, not replacement)
  // This ensures core roles are protected and theme additionalRoles are appended
  if (themeConfigOverrides.userRoles) {
    mergedConfig.userRoles = mergeRolesConfig(
      DEFAULT_APP_CONFIG.userRoles,
      themeConfigOverrides.userRoles
    )
  }

  // Team roles configuration now comes from permissions-registry (single source of truth)
  // The registry reads from permissions.config.ts which defines roles, hierarchy, etc.
  // This replaces the old merge from app.config.ts teamRoles
  if (DEFAULT_APP_CONFIG.teamRoles) {
    mergedConfig.teamRoles = {
      ...DEFAULT_APP_CONFIG.teamRoles,
      // Override with values from permissions-registry
      availableTeamRoles: REGISTRY_AVAILABLE_ROLES as readonly string[],
      hierarchy: REGISTRY_ROLE_HIERARCHY,
      displayNames: REGISTRY_ROLE_DISPLAY_NAMES,
      descriptions: REGISTRY_ROLE_DESCRIPTIONS,
    }
  }

  if (DEBUG_CONFIG) {
    console.log('[config-sync] App config merged successfully')
  }

  return mergedConfig
}

/**
 * Get app config with caching - prevents re-execution on each module import
 */
function loadAppConfig() {
  if (globalCache.__nextspark_app_config) {
    return globalCache.__nextspark_app_config
  }
  globalCache.__nextspark_app_config = loadAppConfigInternal()
  return globalCache.__nextspark_app_config
}

// =============================================================================
// DASHBOARD CONFIG MERGE LOGIC
// =============================================================================

/**
 * Merge default dashboard config with theme-specific config
 */
function loadDashboardConfigInternal() {
  const activeTheme = process.env.NEXT_PUBLIC_ACTIVE_THEME

  if (DEBUG_CONFIG) {
    console.log('[config-sync] activeTheme:', activeTheme)
  }

  // If no theme is active, return default config
  if (!activeTheme) {
    if (DEBUG_CONFIG) {
      console.log('[config-sync] No active theme, using default config')
    }
    return DEFAULT_DASHBOARD_CONFIG
  }

  // Load theme-specific config
  const themeConfig = ThemeService.getDashboardConfig(activeTheme)

  // If theme has no dashboard config, return default
  if (!themeConfig) {
    if (DEBUG_CONFIG) {
      console.log('[config-sync] Theme has no dashboard config, using default')
    }
    return DEFAULT_DASHBOARD_CONFIG
  }

  // Validate theme config in development (skip validation for now due to function properties)
  if (DEBUG_CONFIG) {
    console.log('[config-sync] Theme config loaded (validation skipped)')
  }

  // Merge theme config over default config
  const mergedConfig = mergeConfigs(DEFAULT_DASHBOARD_CONFIG, themeConfig)

  if (DEBUG_CONFIG) {
    console.log('[config-sync] Config merged successfully')
    console.log('[config-sync] Merged config has helper functions:', {
      isSettingsPageEnabled: typeof mergedConfig.isSettingsPageEnabled === 'function',
      getEnabledSettingsPages: typeof mergedConfig.getEnabledSettingsPages === 'function',
      isTopbarFeatureEnabled: typeof mergedConfig.isTopbarFeatureEnabled === 'function',
    })
  }

  return mergedConfig
}

/**
 * Get dashboard config with caching
 */
function loadDashboardConfig() {
  if (globalCache.__nextspark_dashboard_config) {
    return globalCache.__nextspark_dashboard_config
  }
  globalCache.__nextspark_dashboard_config = loadDashboardConfigInternal()
  return globalCache.__nextspark_dashboard_config
}

// =============================================================================
// DEV CONFIG LOADING (Development-only settings)
// =============================================================================

/**
 * Load development-only configuration from theme's dev.config.ts
 * Contains settings like DevKeyring that should never affect production
 */
function loadDevConfigInternal() {
  const activeTheme = process.env.NEXT_PUBLIC_ACTIVE_THEME

  // If no theme is active, return null
  if (!activeTheme) {
    return null
  }

  // Load theme-specific dev config from build-time registry
  const devConfig = ThemeService.getDevConfig(activeTheme)

  if (DEBUG_CONFIG && devConfig) {
    console.log('[config-sync] Dev config loaded for theme:', activeTheme)
  }

  return devConfig
}

/**
 * Get dev config with caching
 */
function loadDevConfig() {
  // Check for explicit undefined to allow null values in cache
  if (globalCache.__nextspark_dev_config !== undefined) {
    return globalCache.__nextspark_dev_config
  }
  globalCache.__nextspark_dev_config = loadDevConfigInternal()
  return globalCache.__nextspark_dev_config
}

// Load and export merged configs
export const APP_CONFIG_MERGED = loadAppConfig()
export const DASHBOARD_CONFIG = loadDashboardConfig()
export const DEV_CONFIG = loadDevConfig()

// Re-export common configuration values for easy access (using merged config)
export const SUPPORTED_LOCALES = APP_CONFIG_MERGED.i18n.supportedLocales
export const DEFAULT_LOCALE = APP_CONFIG_MERGED.i18n.defaultLocale
export const AVAILABLE_ROLES = APP_CONFIG_MERGED.userRoles.availableRoles
export const DEFAULT_ROLE = APP_CONFIG_MERGED.userRoles.defaultRole
export const APP_NAME = APP_CONFIG_MERGED.app.name
export const APP_VERSION = APP_CONFIG_MERGED.app.version

// Re-export configuration sections (using merged config)
export const I18N_CONFIG = APP_CONFIG_MERGED.i18n
export const APP_CONFIG = APP_CONFIG_MERGED.app
export const USER_ROLES_CONFIG = APP_CONFIG_MERGED.userRoles
export const API_CONFIG = APP_CONFIG_MERGED.api
export const MOBILE_NAV_CONFIG = APP_CONFIG_MERGED.mobileNav
export const TEAMS_CONFIG = APP_CONFIG_MERGED.teams
export const MEDIA_CONFIG = APP_CONFIG_MERGED.media
export const AUTH_CONFIG = APP_CONFIG_MERGED.auth

/**
 * Public auth config safe for client-side consumption.
 * Strips allowedDomains and other sensitive data.
 */
export const PUBLIC_AUTH_CONFIG = {
  registration: {
    mode: (APP_CONFIG_MERGED.auth?.registration?.mode ?? 'open') as import('./types').RegistrationMode,
    // NOTE: allowedDomains intentionally NOT exposed to client (security: prevents domain enumeration)
  },
  providers: {
    google: {
      enabled: APP_CONFIG_MERGED.auth?.registration?.mode === 'closed'
        ? false
        : APP_CONFIG_MERGED.auth?.providers?.google?.enabled !== false,
    },
  },
} satisfies import('./types').PublicAuthConfig

// Re-export dashboard configuration sections
// These always exist thanks to the default config + merge system
export const TOPBAR_CONFIG = DASHBOARD_CONFIG.topbar
export const SIDEBAR_CONFIG = DASHBOARD_CONFIG.sidebar
export const SETTINGS_CONFIG = DASHBOARD_CONFIG.settings
export const ENTITIES_CONFIG = DASHBOARD_CONFIG.entities
export const HOMEPAGE_CONFIG = DASHBOARD_CONFIG.homepage
export const PERFORMANCE_CONFIG = DASHBOARD_CONFIG.performance
export const ACCESSIBILITY_CONFIG = DASHBOARD_CONFIG.accessibility

// Helper functions from dashboard config
// These delegate to the config object's methods for consistency
export const isSettingsPageEnabled = (pageName: string): boolean => {
  return DASHBOARD_CONFIG.isSettingsPageEnabled(pageName)
}

export interface EnabledSettingsPage {
  key: string
  order: number
  label: string
}

export const getEnabledSettingsPages = (): EnabledSettingsPage[] => {
  return DASHBOARD_CONFIG.getEnabledSettingsPages()
}

export const isTopbarFeatureEnabled = (feature: string): boolean => {
  return DASHBOARD_CONFIG.isTopbarFeatureEnabled(feature)
}

export const getTopbarFeatureConfig = <T = Record<string, unknown>>(feature: string): T | undefined => {
  const topbar = DASHBOARD_CONFIG.topbar as Record<string, unknown>
  return topbar[feature] as T | undefined
}

// Re-export types for convenience - derived from merged config
export type SupportedLocale = typeof APP_CONFIG_MERGED.i18n.supportedLocales[number]
export type TranslationNamespace = typeof APP_CONFIG_MERGED.i18n.namespaces[number]
export type UserRole = typeof APP_CONFIG_MERGED.userRoles.availableRoles[number]
