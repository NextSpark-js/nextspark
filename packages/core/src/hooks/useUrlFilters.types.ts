/**
 * useUrlFilters Types
 *
 * Type definitions for URL-synchronized filter system.
 * Supports search, multiSelect, numberRange, dateRange, and singleSelect filters.
 */

// ============================================================================
// Base Types
// ============================================================================

export type FilterType = 'search' | 'multiSelect' | 'numberRange' | 'dateRange' | 'singleSelect'

export interface NumberRange {
  min: number | null
  max: number | null
}

export interface DateRange {
  start: string | null  // ISO date string (YYYY-MM-DD)
  end: string | null    // ISO date string (YYYY-MM-DD)
}

// ============================================================================
// Filter Definition Types
// ============================================================================

interface BaseFilterDefinition {
  type: FilterType
  urlParam: string
}

interface SearchFilterDefinition extends BaseFilterDefinition {
  type: 'search'
}

interface SingleSelectFilterDefinition extends BaseFilterDefinition {
  type: 'singleSelect'
}

interface MultiSelectFilterDefinition extends BaseFilterDefinition {
  type: 'multiSelect'
}

interface NumberRangeFilterDefinition extends BaseFilterDefinition {
  type: 'numberRange'
  urlParamMax: string  // e.g., 'amount_min' and 'amount_max'
}

interface DateRangeFilterDefinition extends BaseFilterDefinition {
  type: 'dateRange'
  urlParamEnd: string  // e.g., 'startDate' and 'endDate'
}

export type FilterDefinition =
  | SearchFilterDefinition
  | SingleSelectFilterDefinition
  | MultiSelectFilterDefinition
  | NumberRangeFilterDefinition
  | DateRangeFilterDefinition

// ============================================================================
// Schema and Value Types
// ============================================================================

export type FilterSchema = Record<string, FilterDefinition>

// Infer filter value type from definition
export type FilterValueType<T extends FilterDefinition> =
  T['type'] extends 'search' ? string :
  T['type'] extends 'singleSelect' ? string | null :
  T['type'] extends 'multiSelect' ? string[] :
  T['type'] extends 'numberRange' ? NumberRange :
  T['type'] extends 'dateRange' ? DateRange :
  never

// Infer full filter values from schema
export type FilterValues<S extends FilterSchema> = {
  [K in keyof S]: FilterValueType<S[K]>
}

// ============================================================================
// Hook Options and Return Types
// ============================================================================

export interface UseUrlFiltersOptions {
  /** Debounce delay in ms for URL updates (default: 300 for search, 0 for others) */
  debounceMs?: number
  /** Use shallow routing - don't trigger data refetch (default: true) */
  shallow?: boolean
  /** Scroll to top on filter change (default: false) */
  scroll?: boolean
}

export interface UseUrlFiltersReturn<S extends FilterSchema> {
  /** Current filter values */
  filters: FilterValues<S>
  /** Set a single filter value */
  setFilter: <K extends keyof S>(key: K, value: FilterValues<S>[K]) => void
  /** Set multiple filter values at once */
  setFilters: (values: Partial<FilterValues<S>>) => void
  /** Clear a single filter to its default value */
  clearFilter: (key: keyof S) => void
  /** Clear all filters to default values */
  clearAllFilters: () => void
  /** Whether any filter has a non-default value */
  hasActiveFilters: boolean
  /** Count of filters with non-default values */
  activeFilterCount: number
  /** Build URL with current filters + optional overrides */
  buildFilterUrl: (baseUrl: string, overrides?: Partial<FilterValues<S>>) => string
}

// ============================================================================
// Dynamic Entity Filter Types (for runtime-built schemas)
// ============================================================================

/**
 * Type-safe return type for entity filters built from EntityConfig at runtime.
 * Use this when the schema is dynamically constructed from ui.dashboard.filters.
 */
export interface EntityFiltersReturn {
  /** Current filter values - includes search (string) and dynamic fields (string[]) */
  filters: Record<string, string | string[] | null>
  /** Set a single filter value */
  setFilter: (key: string, value: string | string[]) => void
  /** Set multiple filter values at once */
  setFilters: (values: Record<string, string | string[] | null>) => void
  /** Clear a single filter to its default value */
  clearFilter: (key: string) => void
  /** Clear all filters to default values */
  clearAllFilters: () => void
  /** Whether any filter has a non-default value */
  hasActiveFilters: boolean
  /** Count of filters with non-default values */
  activeFilterCount: number
  /** Build URL with current filters + optional overrides */
  buildFilterUrl: (baseUrl: string, overrides?: Record<string, string | string[] | null>) => string
}
