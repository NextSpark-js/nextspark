/**
 * Theme System Types
 * 
 * Type definitions for the WordPress-like theme system
 */

import type React from 'react'
import type { ThemeConfig, ComponentOverride } from '../../types/theme'

// Re-export types from central definitions for convenience
export type {
  ThemeConfig,
  ComponentOverride
}

/**
 * Theme loading state
 */
export interface ThemeLoadingState {
  loading: boolean
  error?: string
  theme?: string
}

/**
 * Theme context type for React context
 */
export interface ThemeContextType {
  currentTheme: ThemeConfig | null
  loading: boolean
  error?: string
  switchTheme: (themeName: string) => Promise<boolean>
  reloadTheme: () => Promise<void>
  availableThemes: ThemeConfig[]
}

/**
 * Theme override resolution result
 */
export interface OverrideResolution {
  hasOverride: boolean
  component: React.ComponentType<unknown> | null
  originalPath: string
  themeName?: string
  cached: boolean
}

/**
 * Theme application options
 */
export interface ThemeApplicationOptions {
  preloadOverrides?: boolean
  clearCache?: boolean
  validateConfig?: boolean
  hotReload?: boolean
}

/**
 * Theme validation result
 */
export interface ThemeValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  theme: string
}

/**
 * Theme performance metrics
 */
export interface ThemeMetrics {
  loadTime: number
  overrideCount: number
  cacheHitRate: number
  memoryUsage: number
  lastApplied: number
}

/**
 * Theme event types
 */
export type ThemeEvent = 
  | 'theme-loaded'
  | 'theme-applied' 
  | 'theme-error'
  | 'theme-switched'
  | 'override-resolved'
  | 'cache-cleared'

/**
 * Theme event handler
 */
export type ThemeEventHandler<T = Record<string, unknown>> = (event: ThemeEvent, data: T) => void

/**
 * Theme configuration builder
 */
export interface ThemeConfigBuilder {
  name: (name: string) => ThemeConfigBuilder
  displayName: (displayName: string) => ThemeConfigBuilder
  version: (version: string) => ThemeConfigBuilder
  parent: (parent: string) => ThemeConfigBuilder
  addOverride: (path: string, component: React.ComponentType<unknown>) => ThemeConfigBuilder
  addStyle: (key: string, value: string) => ThemeConfigBuilder
  addColor: (key: string, color: string) => ThemeConfigBuilder
  addFont: (key: string, font: string) => ThemeConfigBuilder
  build: () => ThemeConfig
}