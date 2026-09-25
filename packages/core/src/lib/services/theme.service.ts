/**
 * Theme Service
 *
 * Service layer for theme registry operations.
 * Provides static methods for querying theme data.
 */

import {
  THEME_REGISTRY,
  type ThemeRegistryEntry,
  type ThemeEntity,
  type ThemeRouteFile,
  type ThemeName
} from '@nextsparkjs/registries/theme-registry'
import type { DevConfig } from '../config/types'

// Re-export types for convenience
export type { ThemeRegistryEntry, ThemeEntity, ThemeRouteFile, ThemeName }

/**
 * ThemeService - Static service for theme operations
 */
export class ThemeService {
  /** The root-first compiler emits exactly one project entry. */
  static getCurrentEntry(): ThemeRegistryEntry | undefined {
    return Object.values(THEME_REGISTRY)[0]
  }

  static getCurrentName(): string {
    return this.getCurrentEntry()?.name ?? 'default'
  }

  static getCurrent() {
    return this.getCurrentEntry()?.config
  }

  static getCurrentDashboardConfig(): any | undefined {
    return this.getCurrentEntry()?.dashboardConfig
  }

  static getCurrentAppConfig(): any | undefined {
    return this.getCurrentEntry()?.appConfig
  }

  static getCurrentDevConfig(): DevConfig | null {
    return this.getCurrentEntry()?.devConfig ?? null
  }

}
