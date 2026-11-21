'use client'

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { withBasePath } from '../../lib/base-path'
import { teamsKeys } from '../../lib/teams/teams.keys'
import type { AdminTeamsParams, AdminTeamsResponse } from '../../lib/teams/types'

/**
 * The teams of the superadmin Teams page: search, type, sort and pagination, answered by /api/superadmin/teams. It lives
 * with the superadmin tables, not in hooks/teams or lib/teams (the dashboard imports those), so the sort and the
 * kept-while-loading table cost the dashboard nothing. Same query key as useAdminTeams, so creating a team still
 * invalidates it.
 */
export function useSuperadminTeams(params: AdminTeamsParams = {}) {
  const query = useQuery<AdminTeamsResponse>({
    queryKey: teamsKeys.adminList(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams()
      if (params.search) searchParams.set('search', params.search)
      if (params.type) searchParams.set('type', params.type)
      if (params.sort) {
        searchParams.set('sort', params.sort)
        if (params.order) searchParams.set('order', params.order)
      }
      if (params.page) searchParams.set('page', String(params.page))
      if (params.limit) searchParams.set('limit', String(params.limit))
      const queryString = searchParams.toString()
      const response = await fetch(withBasePath(`/api/superadmin/teams${queryString ? `?${queryString}` : ''}`))
      if (!response.ok) {
        if (response.status === 403) throw new Error('Not authorized to view all teams')
        if (response.status === 401) throw new Error('Authentication required')
        throw new Error('Failed to fetch teams')
      }
      return response.json()
    },
    staleTime: 30 * 1000,
    retry: 2,
    // a new page, search or sort keeps the table on screen until its answer comes
    placeholderData: keepPreviousData,
  })

  return {
    teams: query.data?.teams ?? [],
    counts: query.data?.counts,
    pagination: query.data?.pagination,
    metadata: query.data?.metadata,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}
