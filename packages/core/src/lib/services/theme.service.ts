/**
 * Theme Service
 *
 * Service layer for theme registry operations.
 * Provides static methods for querying theme data.
 */

import {
  THEME_REGISTRY,
  THEME_METADATA,
  type ThemeRegistryEntry,
  type ThemeEntity,
  type ThemeRouteFile,
  type ThemeName
} from '@nextsparkjs/registries/theme-registry'
import type { ThemeConfig } from '../../types/theme'
import type { DevConfig } from '../config/types'

// Re-export types for convenience
export type { ThemeRegistryEntry, ThemeEntity, ThemeRouteFile, ThemeName }

/**
 * ThemeService - Static service for theme operations
 */
export class ThemeService {
  /**
   * Get all registered themes
   * @returns Array of ThemeConfig
   * @complexity O(n) where n = number of themes
   */
  static getAll(): ThemeConfig[] {
    return Object.values(THEME_REGISTRY).map(entry => entry.config)
  }

  /**
   * Get theme by name
   * @complexity O(1)
   */
  static getByName(name: string): ThemeConfig | undefined {
    return THEME_REGISTRY[name]?.config
  }

  /**
   * Get full registry entry by name
   * @complexity O(1)
   */
  static getEntry(name: string): ThemeRegistryEntry | undefined {
    return THEME_REGISTRY[name]
  }

  /**
   * Get dashboard config for a theme
   * @complexity O(1)
   */
  static getDashboardConfig(name: string): any | undefined {
    return THEME_REGISTRY[name]?.dashboardConfig
  }

  /**
   * Get app config for a theme
   * @complexity O(1)
   */
  static getAppConfig(name: string): any | undefined {
    return THEME_REGISTRY[name]?.appConfig
  }

  /**
   * Get dev config for a theme
   * Contains development-only settings like DevKeyring
   * @complexity O(1)
   */
  static getDevConfig(name: string): DevConfig | null {
    return THEME_REGISTRY[name]?.devConfig ?? null
  }

  /**
   * Get themes with entities
   * @complexity O(n)
   */
  static getWithEntities(): ThemeRegistryEntry[] {
    return Object.values(THEME_REGISTRY).filter(
      entry => entry.entities && entry.entities.length > 0
    )
  }

  /**
   * Get themes with API routes
   * @complexity O(n)
   */
  static getWithRoutes(): ThemeRegistryEntry[] {
    return Object.values(THEME_REGISTRY).filter(
      entry => entry.routeFiles && entry.routeFiles.length > 0
    )
  }

  /**
   * Get themes using a specific plugin
   * @complexity O(n)
   */
  static getUsingPlugin(pluginName: string): ThemeRegistryEntry[] {
    return Object.values(THEME_REGISTRY).filter(
      entry => entry.plugins && entry.plugins.includes(pluginName)
    )
  }

  /**
   * Get plugin usage across all themes
   * @complexity O(n)
   */
  static getPluginUsage(pluginName: string): { theme: string; entities: number; routes: number }[] {
    return Object.values(THEME_REGISTRY)
      .filter(entry => entry.plugins && entry.plugins.includes(pluginName))
      .map(entry => ({
        theme: entry.name,
        entities: entry.entities?.length || 0,
        routes: entry.routeFiles?.length || 0
      }))
  }

  /**
   * Check if theme exists
   * @complexity O(1)
   */
  static exists(name: string): boolean {
    return name in THEME_REGISTRY
  }

  /**
   * Get theme names
   * @complexity O(1) - uses pre-computed metadata
   */
  static getNames(): string[] {
    return THEME_METADATA.themes
  }

  /**
   * Get total theme count
   * @complexity O(1) - uses pre-computed metadata
   */
  static getCount(): number {
    return THEME_METADATA.totalThemes
  }

  /**
   * Get metadata
   * @complexity O(1)
   */
  static getMetadata(): typeof THEME_METADATA {
    return THEME_METADATA
  }
}

// Convenience function exports for backward compatibility
export const getRegisteredThemes = ThemeService.getAll
export const getTheme = ThemeService.getByName
export const getThemeDashboardConfig = ThemeService.getDashboardConfig
export const getThemeAppConfig = ThemeService.getAppConfig
export const getThemeDevConfig = ThemeService.getDevConfig
export const getThemesWithEntities = ThemeService.getWithEntities
export const getThemesWithRoutes = ThemeService.getWithRoutes
export const getThemesUsingPlugin = ThemeService.getUsingPlugin
export const getPluginUsage = ThemeService.getPluginUsage
