/**
 * Template Override Resolver
 *
 * Universal system for resolving and using theme template overrides across all app/ routes
 *
 * SECURITY ARCHITECTURE:
 *
 * This system implements a layered security model where some layouts
 * are protected from theme overrides to maintain security boundaries:
 *
 * 1. CORE SECURITY LAYER (Non-overrideable):
 *    - Files that DON'T use template overrides cannot be overridden
 *    - Example: /app/dashboard/layout.tsx (contains auth logic)
 *    - These files provide essential security boundaries
 *    - Configured via PROTECTED_PATHS array
 *
 * 2. UI CUSTOMIZATION LAYER (Overrideable):
 *    - Files that USE template overrides can be themed
 *    - Example: /app/dashboard/(main)/layout.tsx (custom UI/sidebar)
 *    - Example: /app/(auth)/signup/page.tsx (custom signup experience)
 *    - These run within security boundaries of parent layouts
 *
 * UNIVERSAL USAGE PATTERNS:
 *
 * 1. HOC Pattern (Recommended for new files):
 *    export default withTemplateOverrideFor('app/my-route/page.tsx')(MyComponent)
 *
 * 2. Direct Function Pattern (Compatible with existing files):
 *    export default getTemplateOrDefault('app/my-route/page.tsx', MyComponent)
 *
 * 3. Protected Path Configuration:
 *    Add to PROTECTED_PATHS to prevent theme overrides for security
 *
 * This ensures themes can override ANY route (pages, layouts, etc.) while
 * maintaining granular security control where critical.
 */

import React from 'react'
import { TemplateService } from './services/template.service'
import type { TemplateOverride } from '../types/theme'
import {
  canOverrideComponent,
  canOverrideMetadata,
  getProtectionLevel,
  getProtectionDescription
} from '../config/protected-paths'

/**
 * Get template component with fallback - Granular Protection Support
 * Use this in your app router files to conditionally use theme templates
 *
 * Respects granular protection levels:
 * - PROTECTED_ALL: Returns default component (no override)
 * - PROTECTED_RENDER: Returns default component (component protected)
 * - PROTECTED_METADATA: Allows component override
 * - NONE: Allows component override
 */
export function getTemplateOrDefault<T = any>(
  appPath: string,
  defaultComponent: T
): T {
  // DEBUG: Always log to trace execution
  console.log(`[getTemplateOrDefault] Called for: ${appPath}`)

  // SECURITY: Check if component override is allowed at this protection level
  if (!canOverrideComponent(appPath)) {
    if (process.env.NODE_ENV === 'development') {
      const level = getProtectionLevel(appPath)
      console.log(`🛡️  Component override blocked for ${appPath} (${level})`)
    }
    return defaultComponent
  }

  if (TemplateService.hasOverride(appPath)) {
    const template = TemplateService.getComponent(appPath)
    if (template) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`🎨 Component override applied for ${appPath}`)
      }
      return template as T
    }
  }
  return defaultComponent
}

/**
 * Get template metadata with fallback - Granular Protection Support
 * Use this in your app router files to conditionally use theme metadata
 *
 * Respects granular protection levels:
 * - PROTECTED_ALL: Returns default metadata (no override)
 * - PROTECTED_RENDER: Allows metadata override (KEY FEATURE!)
 * - PROTECTED_METADATA: Returns default metadata (metadata protected)
 * - NONE: Allows metadata override
 */
export function getMetadataOrDefault(
  appPath: string,
  defaultMetadata: any
): any {
  // SECURITY: Check if metadata override is allowed at this protection level
  if (!canOverrideMetadata(appPath)) {
    if (process.env.NODE_ENV === 'development') {
      const level = getProtectionLevel(appPath)
      console.log(`🛡️  Metadata override blocked for ${appPath} (${level})`)
    }
    return defaultMetadata
  }

  if (TemplateService.hasOverride(appPath)) {
    const entry = TemplateService.getEntry(appPath)
    if (entry?.template?.metadata) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`🎨 Metadata override applied for ${appPath}`)
      }
      return entry.template.metadata
    }
  }

  if (process.env.NODE_ENV === 'development') {
    console.log(`📝 Using default metadata for ${appPath}`)
  }
  return defaultMetadata
}

/**
 * Hook to check if current route has template override
 */
export function useTemplateOverride(pathname: string) {
  const appPath = `app${pathname === '/' ? '/page.tsx' : `${pathname}/page.tsx`}`
  const layoutPath = `app${pathname === '/' ? '/layout.tsx' : `${pathname}/layout.tsx`}`

  const pageOverride = TemplateService.getEntry(appPath)
  const layoutOverride = TemplateService.getEntry(layoutPath)

  return {
    hasPageOverride: !!pageOverride,
    hasLayoutOverride: !!layoutOverride,
    pageTemplate: pageOverride?.template,
    layoutTemplate: layoutOverride?.template,
    getPageComponent: () => TemplateService.getComponent(appPath),
    getLayoutComponent: () => TemplateService.getComponent(layoutPath)
  }
}

/**
 * Utility to resolve template with metadata
 */
export function getTemplateWithInfo(appPath: string) {
  return TemplateService.resolve(appPath)
}

/**
 * Debug utility to show template override status
 */
export function debugTemplateOverrides() {
  if (process.env.NODE_ENV === 'development') {
    console.group('🎨 Template Override System')

    const overrides = Object.entries({
      'app/dashboard/layout.tsx': TemplateService.getEntry('app/dashboard/layout.tsx'),
      'app/dashboard/page.tsx': TemplateService.getEntry('app/dashboard/page.tsx'),
    })

    overrides.forEach(([path, entry]) => {
      if (entry) {
        console.log(`✅ ${path} → ${entry.template.themeName} (${entry.template.templateType})`)
      } else {
        console.log(`⚪ ${path} → Using default`)
      }
    })

    console.groupEnd()
  }
}

/**
 * Universal HOC for Template Override Resolution - Granular Protection Support
 *
 * Automatically detects component path and resolves theme overrides.
 *
 * Usage:
 *   export default withTemplateOverride(MyComponent, 'app/signup/page.tsx')
 *
 * Security:
 *   Respects granular protection levels - only blocks component override when necessary
 */
export function withTemplateOverride<T extends React.ComponentType<any>>(
  Component: T,
  appPath: string
): T {
  const WrappedComponent = (props: React.ComponentProps<T>) => {
    // Check if component override is allowed at this protection level
    if (!canOverrideComponent(appPath)) {
      if (process.env.NODE_ENV === 'development') {
        const level = getProtectionLevel(appPath)
        console.log(`🛡️  HOC component override blocked for ${appPath} (${level})`)
      }
      return React.createElement(Component, props)
    }

    // Try to resolve template override
    if (TemplateService.hasOverride(appPath)) {
      const OverrideComponent = TemplateService.getComponent(appPath)
      if (OverrideComponent) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`🎨 HOC component override applied for ${appPath}`)
        }
        return React.createElement(OverrideComponent, props)
      }
    }

    // Fallback to original component
    return React.createElement(Component, props)
  }

  // Preserve component name and properties
  WrappedComponent.displayName = `withTemplateOverride(${Component.displayName || Component.name})`

  return WrappedComponent as T
}

/**
 * Curried version for cleaner usage
 *
 * Usage:
 *   export default withTemplateOverrideFor('app/(auth)/signup/page.tsx')(SignupPage)
 */
export function withTemplateOverrideFor(appPath: string) {
  return function<T extends React.ComponentType<any>>(Component: T): T {
    return withTemplateOverride(Component, appPath)
  }
}