'use client'

/**
 * useUrlFilters Hook
 *
 * Bidirectional synchronization between filter state and URL query parameters.
 * Supports search (debounced), multiSelect, numberRange, dateRange, and singleSelect filters.
 *
 * @example
 * const { filters, setFilter, clearAllFilters } = useUrlFilters({
 *   search: { type: 'search', urlParam: 'search' },
 *   status: { type: 'multiSelect', urlParam: 'status' },
 *   amount: { type: 'numberRange', urlParam: 'amount_min', urlParamMax: 'amount_max' },
 * })
 *
 * // Use in components
 * <SearchInput value={filters.search} onChange={(e) => setFilter('search', e.target.value)} />
 * <MultiSelectFilter values={filters.status} onChange={(v) => setFilter('status', v)} />
 */

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useDebounce } from './useDebounce'
import type {
  FilterSchema,
  FilterValues,
  UseUrlFiltersOptions,
  UseUrlFiltersReturn,
} from './useUrlFilters.types'
import {
  parseFiltersFromUrl,
  serializeFiltersToUrl,
  getDefaultFilterValues,
  countActiveFilters,
  buildFilterUrl as buildUrl,
} from './useUrlFilters.utils'

// ============================================================================
// Hook Implementation
// ============================================================================

export function useUrlFilters<S extends FilterSchema>(
  schema: S,
  options: UseUrlFiltersOptions = {}
): UseUrlFiltersReturn<S> {
  const {
    debounceMs = 300,
    scroll = false,
  } = options

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Track if we're updating from URL (to avoid circular updates)
  const isUpdatingFromUrl = useRef(false)

  // Track schema keys to detect changes and manage URL update eligibility
  const schemaKeys = useMemo(() => Object.keys(schema).sort().join(','), [schema])
  const prevSchemaKeysRef = useRef<string>(schemaKeys)

  // Track if user has interacted with filters (only then should we update URL)
  const hasUserInteracted = useRef(false)

  // Initialize state from URL
  const [filters, setFiltersState] = useState<FilterValues<S>>(() =>
    parseFiltersFromUrl(schema, searchParams)
  )

  // Debounce filters for URL update
  const debouncedFilters = useDebounce(filters, debounceMs)

  // Re-parse from URL when schema changes (new fields added)
  // This handles the case where entityConfig loads async and adds new filter fields
  useEffect(() => {
    if (prevSchemaKeysRef.current !== schemaKeys) {
      // Schema changed - re-parse from URL to pick up new fields
      const urlFilters = parseFiltersFromUrl(schema, searchParams)
      isUpdatingFromUrl.current = true
      setFiltersState(urlFilters)
      prevSchemaKeysRef.current = schemaKeys
    }
  }, [schemaKeys, schema, searchParams])

  // Update URL when debounced filters change (only after user interaction)
  useEffect(() => {
    // Skip if we're updating from URL (avoid circular update)
    // Always reset the flag to prevent blocking future updates
    if (isUpdatingFromUrl.current) {
      isUpdatingFromUrl.current = false
      return
    }

    // Skip if user hasn't interacted with filters yet
    // This prevents clearing URL params on initial load
    if (!hasUserInteracted.current) {
      return
    }

    const newParams = serializeFiltersToUrl(schema, debouncedFilters)
    const newUrl = `${pathname}${newParams ? `?${newParams}` : ''}`
    const currentUrl = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`

    // Only update if URL actually changed
    if (newUrl !== currentUrl) {
      router.replace(newUrl, { scroll })
    }
  }, [debouncedFilters, pathname, router, schema, scroll, searchParams])

  // Sync state from URL when searchParams change (browser back/forward)
  // NOTE: This effect should ONLY run when searchParams changes, not when filters change
  // Otherwise it would reset user-set filters before URL is updated
  const prevSearchParamsRef = useRef(searchParams.toString())
  useEffect(() => {
    const currentSearchParams = searchParams.toString()

    // Only sync from URL when searchParams actually changed (browser back/forward)
    if (prevSearchParamsRef.current !== currentSearchParams) {
      prevSearchParamsRef.current = currentSearchParams
      const urlFilters = parseFiltersFromUrl(schema, searchParams)
      isUpdatingFromUrl.current = true
      setFiltersState(urlFilters)
    }
  }, [searchParams, schema])

  // Set a single filter value
  const setFilter = useCallback(<K extends keyof S>(
    key: K,
    value: FilterValues<S>[K]
  ) => {
    hasUserInteracted.current = true
    setFiltersState(prev => ({ ...prev, [key]: value }))
  }, [])

  // Set multiple filter values at once
  const setFilters = useCallback((values: Partial<FilterValues<S>>) => {
    hasUserInteracted.current = true
    setFiltersState(prev => ({ ...prev, ...values }))
  }, [])

  // Clear a single filter to default value
  const clearFilter = useCallback((key: keyof S) => {
    hasUserInteracted.current = true
    const defaults = getDefaultFilterValues(schema)
    setFiltersState(prev => ({
      ...prev,
      [key]: defaults[key as string] as FilterValues<S>[typeof key],
    }))
  }, [schema])

  // Clear all filters to default values
  const clearAllFilters = useCallback(() => {
    hasUserInteracted.current = true
    setFiltersState(getDefaultFilterValues(schema) as FilterValues<S>)
  }, [schema])

  // Check if any filter is active
  const hasActiveFilters = useMemo(
    () => countActiveFilters(schema, filters) > 0,
    [schema, filters]
  )

  // Count active filters
  const activeFilterCount = useMemo(
    () => countActiveFilters(schema, filters),
    [schema, filters]
  )

  // Build URL with current filters + optional overrides
  const buildFilterUrl = useCallback(
    (baseUrl: string, overrides?: Partial<FilterValues<S>>) =>
      buildUrl(baseUrl, schema, filters, overrides),
    [filters, schema]
  )

  // Cleanup refs on unmount to prevent stale state if component remounts
  useEffect(() => {
    return () => {
      isUpdatingFromUrl.current = false
      hasUserInteracted.current = false
    }
  }, [])

  return {
    filters,
    setFilter,
    setFilters,
    clearFilter,
    clearAllFilters,
    hasActiveFilters,
    activeFilterCount,
    buildFilterUrl,
  }
}

// Re-export types for convenience (named exports required in client boundary)
export type {
  FilterType,
  NumberRange,
  DateRange,
  FilterDefinition,
  FilterSchema,
  FilterValueType,
  FilterValues,
  UseUrlFiltersOptions,
  UseUrlFiltersReturn,
  EntityFiltersReturn,
} from './useUrlFilters.types'
export {
  parseFiltersFromUrl,
  serializeFiltersToUrl,
  getDefaultFilterValues,
  countActiveFilters,
  hasActiveFilters,
  buildFilterUrl,
} from './useUrlFilters.utils'
