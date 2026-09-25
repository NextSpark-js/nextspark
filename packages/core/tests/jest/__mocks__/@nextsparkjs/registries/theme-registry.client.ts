/**
 * Mock Client-Safe Theme Registry for Jest tests
 *
 * Mirrors the shape scripts/build/registry/generators/theme-registry.mjs's
 * generateThemeRegistryClient() emits: only each theme's own ThemeConfig, no
 * dashboardConfig/appConfig/devConfig/entities/routeFiles (#207).
 */

export interface ThemeConfig {
  name: string
  displayName: string
  version: string
  description?: string
  styles?: {
    globals?: string
    components?: string
    variables?: Record<string, string>
  }
  config?: Record<string, unknown>
  components?: {
    overrides?: Record<string, unknown>
    custom?: Record<string, unknown>
  }
  [key: string]: unknown
}

export const THEME_REGISTRY: Record<string, ThemeConfig> = {
  default: {
    name: 'default',
    displayName: 'Default Theme',
    version: '1.0.0',
    styles: {
      globals: 'globals.css',
    },
    config: {},
    components: {
      overrides: {},
      custom: {},
    },
  },
}
