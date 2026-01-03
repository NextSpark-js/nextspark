/**
 * Test Utilities Index
 *
 * Centralized exports for all testing-related utilities.
 *
 * @example Component usage:
 * ```typescript
 * import { sel, cySelector, createTestId } from './'
 * ```
 *
 * @example Theme extension:
 * ```typescript
 * import { createSelectorHelpers, CORE_SELECTORS } from './'
 *
 * const THEME_SELECTORS = { ...CORE_SELECTORS, myFeature: { ... } }
 * export const { sel, cySelector } = createSelectorHelpers(THEME_SELECTORS)
 * ```
 */
export { createSelectorHelpers, getNestedValue, replacePlaceholders, type Replacements, type SelectorObject, type SelectorHelpers, type EntitySelectorHelpers, } from './selector-factory';
export { CORE_SELECTORS, type CoreSelectorsType, } from './core-selectors';
export { SELECTORS, sel, s, // alias for sel
selDev, cySelector, entitySelectors, type SelectorsType, type SelectorPath, } from './selectors';
export { createTestId, createCyId, createStateAttr, createPriorityAttr, createTestingProps, createAriaLabel, createEntityCyId, createEntityTestingHelper, type EntityTestingHelper, testingPatterns, keyboardHelpers, } from './utils';
//# sourceMappingURL=index.d.ts.map