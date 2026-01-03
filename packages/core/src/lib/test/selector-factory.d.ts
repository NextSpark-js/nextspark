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
/**
 * Placeholder replacements type
 */
export type Replacements = Record<string, string | number>;
/**
 * Generic selector object type
 */
export type SelectorObject = Record<string, unknown>;
/**
 * Return type for createSelectorHelpers
 */
export interface SelectorHelpers<T extends SelectorObject> {
    /** The selectors object */
    SELECTORS: T;
    /** Get selector value by path */
    sel: (path: string, replacements?: Replacements) => string;
    /** Alias for sel */
    s: (path: string, replacements?: Replacements) => string;
    /** Get selector only in dev/test environments */
    selDev: (path: string, replacements?: Replacements) => string | undefined;
    /** Get Cypress selector string [data-cy="..."] */
    cySelector: (path: string, replacements?: Replacements) => string;
    /** Create entity-specific selector helpers */
    entitySelectors: (slug: string) => EntitySelectorHelpers;
}
/**
 * Entity selector helpers return type
 */
export interface EntitySelectorHelpers {
    page: () => string;
    title: () => string;
    table: () => string;
    tableContainer: () => string;
    search: () => string;
    addButton: () => string;
    row: (id: string) => string;
    rowMenu: (id: string) => string;
    rowAction: (action: string, id: string) => string;
    cell: (field: string, id: string) => string;
    form: () => string;
    field: (name: string) => string;
    submitButton: () => string;
    header: (mode: string) => string;
    backButton: () => string;
    editButton: () => string;
    deleteButton: () => string;
    detail: () => string;
    filter: (field: string) => string;
    filterTrigger: (field: string) => string;
    filterOption: (field: string, value: string) => string;
}
/**
 * Navigate to a value in a nested object using dot notation
 *
 * @param obj - Object to navigate
 * @param path - Dot-separated path (e.g., "dashboard.navigation.main")
 * @returns The value at the path, or undefined if not found
 */
export declare function getNestedValue(obj: Record<string, unknown>, path: string): unknown;
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
export declare function replacePlaceholders(selector: string, replacements?: Replacements): string;
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
export declare function createSelectorHelpers<T extends SelectorObject>(selectors: T): SelectorHelpers<T>;
//# sourceMappingURL=selector-factory.d.ts.map