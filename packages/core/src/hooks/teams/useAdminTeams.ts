'use client'

import { useQuery } from '@tanstack/react-query'
import { TeamsAPI } from '../../lib/teams/teams.api'
import { teamsKeys } from '../../lib/teams/teams.keys'
import type { AdminTeamsParams } from '../../lib/teams/types'

/**
 * Options for useAdminTeams hook
 */
export interface UseAdminTeamsOptions extends AdminTeamsParams {
  /** Whether the query should run (default: true) */
  enabled?: boolean
}

/**
 * Hook for fetching all teams (admin only)
 *
 * Requires superadmin or developer role.
 * Supports search, type filtering, and pagination.
 *
 * For user's own teams, use useUserTeams instead.
 * For optimized dropdown search, use useTeamSearch instead.
 *
 * @param options - Query parameters and options
 *
 * @example
 * ```tsx
 * // Superadmin teams management page
 * function TeamsManagement() {
 *   const [search, setSearch] = useState('')
 *   const [type, setType] = useState<'user' | 'system'>('user')
 *   const [page, setPage] = useState(1)
 *
 *   const { teams, counts, pagination, isLoading } = useAdminTeams({
 *     search,
 *     type,
 *     page,
 *     limit: 20,
 *   })
 *
 *   return (
 *     <div>
 *       <SearchInput value={search} onChange={setSearch} />
 *       <Tabs value={type} onChange={setType}>
 *         <Tab value="user">User Teams ({counts?.user})</Tab>
 *         <Tab value="system">System ({counts?.system})</Tab>
 *       </Tabs>
 *       <TeamsTable teams={teams} />
 *       <Pagination {...pagination} onChange={setPage} />
 *     </div>
 *   )
 * }
 * ```
 */
export function useAdminTeams(options: UseAdminTeamsOptions = {}) {
  const { enabled = true, ...params } = options

  const query = useQuery({
    queryKey: teamsKeys.adminList(params),
    queryFn: () => TeamsAPI.getAdminTeams(params),
    enabled,
    staleTime: 30 * 1000, // 30 seconds
    retry: 2,
  })

  return {
    /** List of teams */
    teams: query.data?.teams ?? [],
    /** Team counts by type */
    counts: query.data?.counts,
    /** Pagination info */
    pagination: query.data?.pagination,
    /** Request metadata */
    metadata: query.data?.metadata,
    /** Loading state */
    isLoading: query.isLoading,
    /** Fetching state (for refetches) */
    isFetching: query.isFetching,
    /** Error if any */
    error: query.error,
    /** Refetch teams */
    refetch: query.refetch,
  }
}

export type UseAdminTeamsReturn = ReturnType<typeof useAdminTeams>
