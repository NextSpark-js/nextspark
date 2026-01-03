/**
 * useUrlFilters Utilities
 *
 * URL parsing and serialization utilities for filter system.
 */

import type { ReadonlyURLSearchParams } from 'next/navigation'
import type {
  FilterSchema,
  FilterDefinition,
  FilterValues,
  NumberRange,
  DateRange,
} from './useUrlFilters.types'

// ============================================================================
// URL Parsing
// ============================================================================

/**
 * Sanitize a filter value from URL to prevent XSS and invalid data
 * - Removes HTML tags
 * - Removes control characters
 * - Trims whitespace
 */
function sanitizeFilterValue(value: string): string {
  if (!value) return ''
  // Remove HTML tags
  const withoutHtml = value.replace(/<[^>]*>/g, '')
  // Remove control characters (except newline, tab)
  const cleaned = withoutHtml.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  return cleaned.trim()
}

/**
 * Parse a multi-select filter value from URL
 * "value1,value2,value3" -> ['value1', 'value2', 'value3']
 */
function parseMultiSelect(value: string | null): string[] {
  if (!value || value.trim() === '') return []
  return value
    .split(',')
    .map(v => sanitizeFilterValue(v))
    .filter(Boolean)
}

/**
 * Parse and validate a number from string
 * Returns null for invalid numbers (NaN, Infinity)
 */
function parseNumber(value: string | null): number | null {
  if (!value || value.trim() === '') return null
  const sanitized = sanitizeFilterValue(value)
  const parsed = parseFloat(sanitized)
  // Return null for NaN or Infinity
  if (!Number.isFinite(parsed)) return null
  return parsed
}

/**
 * Parse a number range filter from URL
 * amount_min=1000&amount_max=5000 -> { min: 1000, max: 5000 }
 */
function parseNumberRange(
  minValue: string | null,
  maxValue: string | null
): NumberRange {
  return {
    min: parseNumber(minValue),
    max: parseNumber(maxValue),
  }
}

/**
 * Parse a date range filter from URL
 * startDate=2025-01-01&endDate=2025-03-31 -> { start: '2025-01-01', end: '2025-03-31' }
 */
function parseDateRange(
  startValue: string | null,
  endValue: string | null
): DateRange {
  const parseDate = (val: string | null): string | null => {
    if (!val || val.trim() === '') return null
    const sanitized = sanitizeFilterValue(val)
    // Basic ISO date validation (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sanitized)) return null
    return sanitized
  }

  return {
    start: parseDate(startValue),
    end: parseDate(endValue),
  }
}

/**
 * Parse all filters from URL search params based on schema
 */
export function parseFiltersFromUrl<S extends FilterSchema>(
  schema: S,
  searchParams: ReadonlyURLSearchParams
): FilterValues<S> {
  const result: Record<string, unknown> = {}

  for (const [key, definition] of Object.entries(schema)) {
    switch (definition.type) {
      case 'search':
        result[key] = searchParams.get(definition.urlParam) || ''
        break

      case 'singleSelect':
        result[key] = searchParams.get(definition.urlParam) || null
        break

      case 'multiSelect':
        result[key] = parseMultiSelect(searchParams.get(definition.urlParam))
        break

      case 'numberRange': {
        const def = definition as { urlParam: string; urlParamMax: string }
        result[key] = parseNumberRange(
          searchParams.get(def.urlParam),
          searchParams.get(def.urlParamMax)
        )
        break
      }

      case 'dateRange': {
        const def = definition as { urlParam: string; urlParamEnd: string }
        result[key] = parseDateRange(
          searchParams.get(def.urlParam),
          searchParams.get(def.urlParamEnd)
        )
        break
      }
    }
  }

  return result as FilterValues<S>
}

// ============================================================================
// URL Serialization
// ============================================================================

/**
 * Serialize a multi-select filter value to URL
 * ['value1', 'value2', 'value3'] -> "value1,value2,value3"
 */
function serializeMultiSelect(values: string[]): string | null {
  if (!values || values.length === 0) return null
  return values.join(',')
}

/**
 * Serialize all filters to URL search params string
 */
export function serializeFiltersToUrl<S extends FilterSchema>(
  schema: S,
  filters: FilterValues<S>
): string {
  const params = new URLSearchParams()

  for (const [key, definition] of Object.entries(schema)) {
    const value = filters[key as keyof typeof filters]

    switch (definition.type) {
      case 'search':
        if (value && (value as string).trim() !== '') {
          params.set(definition.urlParam, value as string)
        }
        break

      case 'singleSelect':
        if (value && value !== null) {
          params.set(definition.urlParam, value as string)
        }
        break

      case 'multiSelect': {
        const serialized = serializeMultiSelect(value as string[])
        if (serialized) {
          params.set(definition.urlParam, serialized)
        }
        break
      }

      case 'numberRange': {
        const def = definition as { urlParam: string; urlParamMax: string }
        const range = value as NumberRange
        if (range.min !== null) {
          params.set(def.urlParam, range.min.toString())
        }
        if (range.max !== null) {
          params.set(def.urlParamMax, range.max.toString())
        }
        break
      }

      case 'dateRange': {
        const def = definition as { urlParam: string; urlParamEnd: string }
        const range = value as DateRange
        if (range.start) {
          params.set(def.urlParam, range.start)
        }
        if (range.end) {
          params.set(def.urlParamEnd, range.end)
        }
        break
      }
    }
  }

  return params.toString()
}

// ============================================================================
// Default Values
// ============================================================================

/**
 * Get default value for a filter definition
 */
function getDefaultValue(definition: FilterDefinition): unknown {
  switch (definition.type) {
    case 'search':
      return ''
    case 'singleSelect':
      return null
    case 'multiSelect':
      return []
    case 'numberRange':
      return { min: null, max: null }
    case 'dateRange':
      return { start: null, end: null }
  }
}

/**
 * Get all default filter values for a schema
 */
export function getDefaultFilterValues<S extends FilterSchema>(
  schema: S
): FilterValues<S> {
  const result: Record<string, unknown> = {}

  for (const [key, definition] of Object.entries(schema)) {
    result[key] = getDefaultValue(definition)
  }

  return result as FilterValues<S>
}

// ============================================================================
// Filter Counting
// ============================================================================

/**
 * Check if a filter value is active (not default)
 */
function isFilterActive(definition: FilterDefinition, value: unknown): boolean {
  switch (definition.type) {
    case 'search':
      return typeof value === 'string' && value.trim() !== ''

    case 'singleSelect':
      return value !== null && value !== ''

    case 'multiSelect':
      return Array.isArray(value) && value.length > 0

    case 'numberRange': {
      const range = value as NumberRange
      return range.min !== null || range.max !== null
    }

    case 'dateRange': {
      const range = value as DateRange
      return range.start !== null || range.end !== null
    }
  }
}

/**
 * Count active filters
 */
export function countActiveFilters<S extends FilterSchema>(
  schema: S,
  filters: FilterValues<S>
): number {
  let count = 0

  for (const [key, definition] of Object.entries(schema)) {
    if (isFilterActive(definition, filters[key as keyof typeof filters])) {
      count++
    }
  }

  return count
}

/**
 * Check if any filter is active
 */
export function hasActiveFilters<S extends FilterSchema>(
  schema: S,
  filters: FilterValues<S>
): boolean {
  return countActiveFilters(schema, filters) > 0
}

// ============================================================================
// URL Building
// ============================================================================

/**
 * Build a full URL with filters applied
 */
export function buildFilterUrl<S extends FilterSchema>(
  baseUrl: string,
  schema: S,
  filters: FilterValues<S>,
  overrides?: Partial<FilterValues<S>>
): string {
  const mergedFilters = overrides ? { ...filters, ...overrides } : filters
  const params = serializeFiltersToUrl(schema, mergedFilters)
  return params ? `${baseUrl}?${params}` : baseUrl
}
