'use client'

import { useAreaUrlState } from '../../hooks/useAreaUrlState'

const URL_STATE = {
  q: { default: '' },
  category: { default: 'all' },
  coverage: { default: 'all', allowed: ['all', 'covered', 'uncovered'] },
} as const

export type CoverageFilter = 'all' | 'covered' | 'uncovered'

/**
 * The search, category and coverage filters of the Blocks, Features and Flows viewers, kept in the URL (#519).
 * A category that is not one of `categories` (a stale link) is the default.
 */
export function useViewerFilters<C extends string>(categories: readonly C[]) {
  const [url, setUrl] = useAreaUrlState(URL_STATE)
  return {
    searchQuery: url.q,
    categoryFilter: (categories.includes(url.category as C) ? url.category : 'all') as C | 'all',
    coverageFilter: url.coverage as CoverageFilter,
    setSearchQuery: (q: string) => setUrl({ q }),
    setCategoryFilter: (category: C | 'all') => setUrl({ category }),
    setCoverageFilter: (coverage: CoverageFilter) => setUrl({ coverage }),
  }
}
