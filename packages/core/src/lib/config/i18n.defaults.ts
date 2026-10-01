/**
 * Default internationalization settings (DEFAULT_APP_CONFIG.i18n). A module of its own so the client modules that
 * only need i18n (./i18n-config-client) do not import the whole default application config.
 */

import type { AppConfig } from './types'

export const DEFAULT_I18N_CONFIG: AppConfig['i18n'] = {
  /**
   * Supported locales for your project
   * Add/remove locales as needed
   */
  supportedLocales: ['en', 'es', 'fr', 'de', 'it', 'pt'],

  /**
   * Default fallback locale
   */
  defaultLocale: 'en',

  /**
   * Cookie settings for locale persistence
   */
  cookie: {
    name: 'locale',
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
    httpOnly: false,
    secure: 'auto',
    sameSite: 'lax',
    path: '/',
  },

  /**
   * Translation namespaces for your project
   * Add/remove namespaces based on your app structure
   */
  namespaces: [
    'common',      // Shared UI elements, buttons, navigation
    'dashboard',   // Dashboard-specific content (includes topbar, sidebar, etc.)
    'settings',    // Settings pages (configuration managed in dashboard.config.ts)
    'tasks',       // Task management
    'teams',       // Team management (Phase 2)
    'auth',        // Authentication flows
    'public',      // Public pages (home, pricing, etc.)
    'validation'   // Form validation messages
  ],

  /**
   * Performance optimizations
   */
  performance: {
    preloadCriticalNamespaces: ['common', 'dashboard'],
  }
}
