/**
 * Global Search Selectors
 *
 * Selectors for the global search modal (Cmd+K).
 */

export const GLOBAL_SEARCH_SELECTORS = {
  modal: 'search-modal',
  trigger: 'search-trigger',
  input: 'search-input',
  results: 'search-results',
  result: 'search-result',
} as const

export type GlobalSearchSelectorsType = typeof GLOBAL_SEARCH_SELECTORS
