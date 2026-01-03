/**
 * Template Service
 *
 * Provides template query and resolution operations.
 * Uses pre-computed data from template-registry for O(1) operations.
 *
 * @module TemplateService
 */

import {
  TEMPLATE_REGISTRY,
  TEMPLATE_METADATA,
  TemplateRegistryEntry,
  TemplateOverride,
  TemplatePath
} from '@nextsparkjs/registries/template-registry'

/**
 * Template Service - Provides runtime template queries
 *
 * This service layer abstracts template registry access, making the registry
 * a pure data structure (Data-Only pattern). All query logic lives here.
 *
 * Performance: All operations are O(1) or O(n) with zero I/O.
 */
export class TemplateService {
  /**
   * Check if an app path has a template override
   *
   * @param appPath - App path to check (e.g., 'app/(public)/page.tsx')
   * @returns True if template override exists
   *
   * @example
   * ```typescript
   * if (TemplateService.hasOverride('app/(public)/page.tsx')) {
   *   // Template exists, use override
   * }
   * ```
   */
  static hasOverride(appPath: string): boolean {
    return appPath in TEMPLATE_REGISTRY
  }

  /**
   * Get template component for app path
   * Returns the highest priority template component
   *
   * @param appPath - App path to get component for
   * @returns Template component or null if not found
   *
   * @example
   * ```typescript
   * const Component = TemplateService.getComponent('app/(public)/page.tsx')
   * if (Component) {
   *   return <Component {...props} />
   * }
   * ```
   */
  static getComponent(appPath: string): any | null {
    const entry = TEMPLATE_REGISTRY[appPath as TemplatePath]
    return entry?.component || null
  }

  /**
   * Get full template entry for app path
   *
   * @param appPath - App path to get entry for
   * @returns Template registry entry or null if not found
   *
   * @example
   * ```typescript
   * const entry = TemplateService.getEntry('app/(public)/page.tsx')
   * if (entry) {
   *   console.log(entry.template.themeName) // 'default'
   * }
   * ```
   */
  static getEntry(appPath: string): TemplateRegistryEntry | null {
    return TEMPLATE_REGISTRY[appPath as TemplatePath] || null
  }

  /**
   * Get all app paths that have template overrides
   *
   * @returns Array of app paths with overrides
   *
   * @example
   * ```typescript
   * const paths = TemplateService.getOverriddenPaths()
   * // ['app/(public)/page.tsx', 'app/(public)/layout.tsx', ...]
   * ```
   */
  static getOverriddenPaths(): string[] {
    return Object.keys(TEMPLATE_REGISTRY)
  }

  /**
   * Get templates by template type
   *
   * @param templateType - Template type (e.g., 'page', 'layout', 'error')
   * @returns Array of template entries matching the type
   *
   * @example
   * ```typescript
   * const pages = TemplateService.getByType('page')
   * const layouts = TemplateService.getByType('layout')
   * ```
   */
  static getByType(templateType: string): TemplateRegistryEntry[] {
    return Object.values(TEMPLATE_REGISTRY)
      .filter((entry: TemplateRegistryEntry) => entry.template.templateType === templateType)
  }

  /**
   * Get templates by theme name
   *
   * @param themeName - Theme name (e.g., 'default')
   * @returns Array of template entries for the theme
   *
   * @example
   * ```typescript
   * const defaultTemplates = TemplateService.getByTheme('default')
   * ```
   */
  static getByTheme(themeName: string): TemplateRegistryEntry[] {
    const results: TemplateRegistryEntry[] = []

    Object.values(TEMPLATE_REGISTRY).forEach((entry: TemplateRegistryEntry) => {
      if (entry.template.themeName === themeName) {
        results.push(entry)
      }
      // Also check alternatives
      entry.alternatives.forEach((alt: TemplateOverride) => {
        if (alt.themeName === themeName) {
          results.push({
            appPath: entry.appPath,
            component: null, // Would need dynamic import
            template: alt,
            alternatives: []
          })
        }
      })
    })

    return results
  }

  /**
   * Resolve template for a given app path
   * Returns theme template if available, null if should use original app file
   *
   * @param appPath - App path to resolve
   * @returns Resolution result with hasOverride flag and template details
   *
   * @example
   * ```typescript
   * const result = TemplateService.resolve('app/(public)/page.tsx')
   * if (result.hasOverride) {
   *   return result.component
   * }
   * // Use original app file
   * ```
   */
  static resolve(appPath: string): {
    hasOverride: boolean
    component?: any
    template?: TemplateOverride
    originalPath: string
  } {
    const entry = this.getEntry(appPath)

    if (entry) {
      return {
        hasOverride: true,
        component: entry.component,
        template: entry.template,
        originalPath: appPath
      }
    }

    return {
      hasOverride: false,
      originalPath: appPath
    }
  }

  /**
   * Get all template entries
   *
   * @returns Array of all template entries
   */
  static getAll(): TemplateRegistryEntry[] {
    return Object.values(TEMPLATE_REGISTRY)
  }

  /**
   * Get template count
   *
   * @returns Total number of templates
   */
  static getCount(): number {
    return TEMPLATE_METADATA.totalTemplates
  }

  /**
   * Get available template types
   *
   * @returns Array of template types (e.g., ['page', 'layout'])
   */
  static getTypes(): string[] {
    return TEMPLATE_METADATA.templateTypes
  }

  /**
   * Get registry metadata
   *
   * @returns Template registry metadata
   */
  static getMetadata(): typeof TEMPLATE_METADATA {
    return TEMPLATE_METADATA
  }
}
