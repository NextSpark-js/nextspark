import { useQuery } from '@tanstack/react-query'
import { useTeam } from './useTeam'
import { QuotaInfo } from '../lib/billing/types'

/**
 * Hook to check quota usage for a specific limit
 *
 * @param limitSlug - The slug of the limit to check (e.g., 'projects', 'team_members')
 * @returns QuotaInfo - Current usage, max limit, and whether action is allowed
 *
 * @example
 * ```tsx
 * const projectsQuota = useQuota('projects')
 * if (!projectsQuota.allowed) {
 *   toast.error('Project limit reached. Please upgrade your plan.')
 * }
 * ```
 */
export function useQuota(limitSlug: string) {
  const { team } = useTeam()

  const {
    data: quotaInfo,
    isLoading,
    error,
    refetch
  } = useQuery<QuotaInfo>({
    queryKey: ['quota', team?.id, limitSlug],
    queryFn: async () => {
      if (!team) {
        throw new Error('No team selected')
      }

      const response = await fetch(`/api/v1/teams/${team.id}/usage/${limitSlug}`)
      if (!response.ok) {
        throw new Error('Failed to fetch quota info')
      }

      const data = await response.json()
      return data.data
    },
    enabled: !!team && !!limitSlug,
    staleTime: 1 * 60 * 1000, // 1 minute (quota checks should be relatively fresh)
    refetchOnWindowFocus: false
  })

  return {
    ...quotaInfo,
    isLoading,
    error: error as Error | null,
    refetch
  }
}
