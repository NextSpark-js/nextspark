/**
 * Selector Factory
 *
 * Factory function and utilities for creating selector helpers.
 * This file contains only the logic - no selector definitions.
 *
 * Usage:
 * ```typescript
 * import { createSelectorHelpers } from './selector-factory'
 * import { CORE_SELECTORS } from './core-selectors'
 *
 * // Create helpers bound to your selectors
 * const { sel, cySelector, selDev, SELECTORS } = createSelectorHelpers(CORE_SELECTORS)
 * ```
 *
 * Themes can extend core selectors:
 * ```typescript
 * const THEME_SELECTORS = {
 *   ...CORE_SELECTORS,
 *   customFeature: { ... }
 * }
 * export const { sel, cySelector } = createSelectorHelpers(THEME_SELECTORS)
 * ```
 */

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Placeholder replacements type
 */
export type Replacements = Record<string, string | number>

/**
 * Generic selector object type
 */
export type SelectorObject = Record<string, unknown>

/**
 * Return type for createSelectorHelpers
 */
export interface SelectorHelpers<T extends SelectorObject> {
  /** The selectors object */
  SELECTORS: T
  /** Get selector value by path */
  sel: (path: string, replacements?: Replacements) => string
  /** Alias for sel */
  s: (path: string, replacements?: Replacements) => string
  /** Get selector only in dev/test environments */
  selDev: (path: string, replacements?: Replacements) => string | undefined
  /** Get Cypress selector string [data-cy="..."] */
  cySelector: (path: string, replacements?: Replacements) => string
  /** Create entity-specific selector helpers */
  entitySelectors: (slug: string) => EntitySelectorHelpers
}

/**
 * Entity selector helpers return type
 */
export interface EntitySelectorHelpers {
  page: () => string
  title: () => string
  table: () => string
  tableContainer: () => string
  search: () => string
  addButton: () => string
  row: (id: string) => string
  rowMenu: (id: string) => string
  rowAction: (action: string, id: string) => string
  cell: (field: string, id: string) => string
  form: () => string
  field: (name: string) => string
  submitButton: () => string
  header: (mode: string) => string
  backButton: () => string
  editButton: () => string
  deleteButton: () => string
  detail: () => string
  filter: (field: string) => string
  filterTrigger: (field: string) => string
  filterOption: (field: string, value: string) => string
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Navigate to a value in a nested object using dot notation
 *
 * @param obj - Object to navigate
 * @param path - Dot-separated path (e.g., "dashboard.navigation.main")
 * @returns The value at the path, or undefined if not found
 */
export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((current, key) => {
    if (current && typeof current === 'object' && key in current) {
      return (current as Record<string, unknown>)[key]
    }
    return undefined
  }, obj as unknown)
}

/**
 * Replace placeholders in a selector string
 *
 * @param selector - Selector pattern with {placeholder} syntax
 * @param replacements - Object with replacement values
 * @returns Selector with placeholders replaced
 *
 * @example
 * replacePlaceholders('{slug}-row-{id}', { slug: 'customers', id: '123' })
 * // Returns: 'customers-row-123'
 */
export function replacePlaceholders(
  selector: string,
  replacements?: Replacements
): string {
  if (!replacements) return selector

  return Object.entries(replacements).reduce(
    (result, [key, value]) => result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value)),
    selector
  )
}

// =============================================================================
// ENVIRONMENT DETECTION
// =============================================================================

const isDevelopment = process.env.NODE_ENV === 'development'
const isTest = process.env.NODE_ENV === 'test'
const enableTestingAttributes = isDevelopment || isTest

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create selector helper functions bound to a specific selectors object.
 *
 * This factory allows themes to extend core selectors while using
 * the same helper functions.
 *
 * @param selectors - The selectors object to bind helpers to
 * @returns Object with sel, cySelector, selDev, and entitySelectors functions
 *
 * @example Core usage:
 * ```typescript
 * import { CORE_SELECTORS } from './core-selectors'
 * const { sel, cySelector } = createSelectorHelpers(CORE_SELECTORS)
 * ```
 *
 * @example Theme extension:
 * ```typescript
 * const THEME_SELECTORS = {
 *   ...CORE_SELECTORS,
 *   myCustomFeature: { button: 'custom-btn' }
 * }
 * const { sel, cySelector } = createSelectorHelpers(THEME_SELECTORS)
 * sel('myCustomFeature.button') // 'custom-btn'
 * ```
 */
export function createSelectorHelpers<T extends SelectorObject>(
  selectors: T
): SelectorHelpers<T> {
  /**
   * Get a selector value by path with optional placeholder replacements.
   */
  function sel(path: string, replacements?: Replacements): string {
    const value = getNestedValue(selectors as Record<string, unknown>, path)

    if (value === undefined) {
      if (process.env.NODE_ENV === 'development') {
        console.error(`[sel] Invalid selector path: "${path}"`)
      }
      return `INVALID_SELECTOR_${path.replace(/\./g, '_')}`
    }

    if (typeof value !== 'string') {
      if (process.env.NODE_ENV === 'development') {
        console.error(
          `[sel] Path "${path}" points to an object, not a string. Did you forget a property?`
        )
      }
      return `INVALID_SELECTOR_${path.replace(/\./g, '_')}`
    }

    return replacePlaceholders(value, replacements)
  }

  /**
   * Get a Cypress selector string (wrapped with [data-cy="..."])
   */
  function cySelector(path: string, replacements?: Replacements): string {
    return `[data-cy="${sel(path, replacements)}"]`
  }

  /**
   * Get selector only in development/test environments.
   */
  function selDev(path: string, replacements?: Replacements): string | undefined {
    if (!enableTestingAttributes) return undefined
    return sel(path, replacements)
  }

  /**
   * Create a set of entity selectors for a specific slug.
   */
  function entitySelectors(slug: string): EntitySelectorHelpers {
    return {
      // Page
      page: () => sel('entities.page.container', { slug }),
      title: () => sel('entities.page.title', { slug }),

      // Table
      table: () => sel('entities.table.element', { slug }),
      tableContainer: () => sel('entities.table.container', { slug }),
      search: () => sel('entities.table.search', { slug }),
      addButton: () => sel('entities.table.addButton', { slug }),
      row: (id: string) => sel('entities.table.row', { slug, id }),
      rowMenu: (id: string) => sel('entities.table.rowMenu', { slug, id }),
      rowAction: (action: string, id: string) =>
        sel('entities.table.rowAction', { slug, action, id }),
      cell: (field: string, id: string) =>
        sel('entities.table.cell', { slug, field, id }),

      // Form
      form: () => sel('entities.form.container', { slug }),
      field: (name: string) => sel('entities.form.field', { slug, name }),
      submitButton: () => sel('entities.form.submitButton', { slug }),

      // Header
      header: (mode: string) => sel('entities.header.container', { slug, mode }),
      backButton: () => sel('entities.header.backButton', { slug }),
      editButton: () => sel('entities.header.editButton', { slug }),
      deleteButton: () => sel('entities.header.deleteButton', { slug }),

      // Detail
      detail: () => sel('entities.detail.container', { slug }),

      // Filter
      filter: (field: string) => sel('entities.filter.container', { slug, field }),
      filterTrigger: (field: string) =>
        sel('entities.filter.trigger', { slug, field }),
      filterOption: (field: string, value: string) =>
        sel('entities.filter.option', { slug, field, value }),
    }
  }

  return {
    SELECTORS: selectors,
    sel,
    s: sel,
    selDev,
    cySelector,
    entitySelectors,
  }
}
