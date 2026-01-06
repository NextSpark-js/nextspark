/**
 * Theme Type Definitions
 *
 * Central type definitions for the theme system.
 * Used across theme registry, loaders, and components.
 */

import type React from 'react'

/**
 * Theme configuration interface
 */
export interface ThemeConfig {
  name: string
  displayName: string
  version: string
  description?: string
  author?: string
  enabled?: boolean
  dependencies?: string[]
  plugins?: string[]
  styles?: {
    globals?: string
    components?: string
    variables?: Record<string, string>
  }
  colors?: ThemeColors
  typography?: ThemeTypography
  spacing?: ThemeSpacing
  components?: Record<string, any>
  config?: Record<string, any>
  [key: string]: any  // Allow additional properties for extensibility
}

/**
 * Theme color configuration
 */
export interface ThemeColors {
  primary?: string
  secondary?: string
  accent?: string
  background?: string
  foreground?: string
  muted?: string
  border?: string
  [key: string]: string | undefined
}

/**
 * Theme typography configuration
 */
export interface ThemeTypography {
  fontFamily?: {
    sans?: string
    serif?: string
    mono?: string
  }
  fontSize?: Record<string, string>
  fontWeight?: Record<string, number>
  lineHeight?: Record<string, string>
}

/**
 * Theme spacing configuration
 */
export interface ThemeSpacing {
  unit?: number
  scale?: Record<string, string>
  radius?: Record<string, string>
}

/**
 * Component override configuration
 */
export interface ComponentOverride {
  path: string
  component: React.ComponentType<any>
  priority?: number
  [key: string]: any
}

/**
 * Template override configuration
 * Used in auto-generated template registries
 */
export interface TemplateOverride {
  name: string
  themeName: string
  templateType: string
  fileName: string
  relativePath: string
  appPath: string
  templatePath: string
  priority: number
  metadata?: any
}

/**
 * Template registry entry
 * Used in auto-generated template registries
 */
export interface TemplateRegistryEntry {
  appPath: string
  component: any
  template: TemplateOverride
  alternatives: TemplateOverride[]
}