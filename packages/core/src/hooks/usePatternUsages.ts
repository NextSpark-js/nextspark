'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuth } from './useAuth'
import { useTeam } from './useTeam'

/**
 * Options for the usePatternUsages hook
 */
export interface UsePatternUsagesOptions {
  /** Filter by entity type (e.g., 'pages', 'posts') */
  entityType?: string
  /** Number of results per page (default: 50) */
  limit?: number
  /** Current page number (default: 1) */
  page?: number
  /** Whether the query is enabled (default: true) */
  enabled?: boolean
  /** Stale time in ms (default: 5 minutes) */
  staleTime?: number
}

/**
 * Single usage record with entity info
 */
export interface PatternUsage {
  id: string
  patternId: string
  entityType: string
  entityId: string
  teamId: string
  createdAt: string
  entityTitle?: string
  entityName?: string
  entityFirstName?: string
  entityLastName?: string
  entityEmail?: string
  entitySlug?: string
  entityStatus?: string
  entityUpdatedAt?: string
}

/**
 * Usage count by entity type
 */
export interface PatternUsageCount {
  entityType: string
  count: number
}

/**
 * Result of the usePatternUsages query
 */
export interface PatternUsagesResult {
  usages: PatternUsage[]
  counts: PatternUsageCount[]
  total: number
  page: number
  totalPages: number
}

/**
 * React Query hook to fetch pattern usages
 *
 * @param patternId - The ID of the pattern to get usages for
 * @param options - Query options (entityType filter, pagination, etc.)
 * @returns Query result with usages, counts, and pagination info
 *
 * @example
 * ```tsx
 * const { usages, counts, total, isLoading, error } = usePatternUsages(patternId, {
 *   entityType: 'pages',
 *   limit: 20,
 *   page: 1,
 * })
 * ```
 */
export function usePatternUsages(
  patternId: string,
  options: UsePatternUsagesOptions = {}
) {
  const {
    entityType,
    limit = 50,
    page = 1,
    enabled = true,
    staleTime = 1000 * 60 * 5, // 5 minutes
  } = options

  const { user } = useAuth()
  const { teamId } = useTeam()

  // Build query key with all params for proper cache invalidation
  const queryKey = [
    'pattern-usages',
    patternId,
    { entityType, limit, page },
  ]

  const query = useQuery<PatternUsagesResult>({
    queryKey,
    queryFn: async () => {
      const queryParams: Record<string, string> = {
        limit: String(limit),
        page: String(page),
      }

      if (entityType) {
        queryParams.entityType = entityType
      }

      const params = new URLSearchParams(queryParams)
      const url = `/api/v1/patterns/${patternId}/usages?${params.toString()}`

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }

      // Add team context header
      if (teamId) {
        headers['x-team-id'] = teamId
      }

      const response = await fetch(url, { headers })

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Pattern not found')
        }
        throw new Error('Failed to fetch pattern usages')
      }

      const data = await response.json()

      return {
        usages: data.data?.usages || [],
        counts: data.data?.counts || [],
        total: data.data?.total || data.meta?.total || 0,
        page: data.meta?.page || page,
        totalPages: data.meta?.totalPages || Math.ceil((data.data?.total || 0) / limit),
      }
    },
    enabled: enabled && !!user && !!patternId,
    staleTime,
    gcTime: 1000 * 60 * 60, // 1 hour
  })

  return {
    ...query,
    usages: query.data?.usages || [],
    counts: query.data?.counts || [],
    total: query.data?.total || 0,
    page: query.data?.page || 1,
    totalPages: query.data?.totalPages || 1,
  }
}

/**
 * Hook to get just the usage count for a pattern
 * Useful for displaying usage count in lists without full usage details
 *
 * @param patternId - The ID of the pattern
 * @param options - Query options
 * @returns Query result with total usage count
 */
export function usePatternUsageCount(
  patternId: string,
  options: { enabled?: boolean; staleTime?: number } = {}
) {
  const { enabled = true, staleTime = 1000 * 60 * 5 } = options
  const { user } = useAuth()
  const { teamId } = useTeam()

  return useQuery<number>({
    queryKey: ['pattern-usage-count', patternId],
    queryFn: async () => {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }

      if (teamId) {
        headers['x-team-id'] = teamId
      }

      const response = await fetch(`/api/v1/patterns/${patternId}/usages?limit=1`, { headers })

      if (!response.ok) {
        return 0
      }

      const data = await response.json()
      return data.data?.total || 0
    },
    enabled: enabled && !!user && !!patternId,
    staleTime,
    gcTime: 1000 * 60 * 60,
  })
}
