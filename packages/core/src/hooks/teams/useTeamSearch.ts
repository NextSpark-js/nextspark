'use client'

import { useQuery } from '@tanstack/react-query'
import { TeamsAPI } from '../../lib/teams/teams.api'
import { teamsKeys } from '../../lib/teams/teams.keys'

/**
 * Hook optimized for team search dropdowns
 *
 * Fetches all user teams (excludes system admin team) with search support.
 * Returns up to 100 teams - suitable for dropdown/combobox use.
 *
 * For full pagination support, use useAdminTeams instead.
 * For current user's teams only, use useUserTeams instead.
 *
 * @param search - Search term (filters by team name or owner email)
 * @param enabled - Whether the query should run (default: true)
 *
 * @example
 * ```tsx
 * // Searchable team dropdown
 * function TeamDropdown({ onSelect }) {
 *   const [search, setSearch] = useState('')
 *   const debouncedSearch = useDebounce(search, 300)
 *
 *   const { teams, totalCount, isLoading } = useTeamSearch(debouncedSearch)
 *
 *   return (
 *     <Combobox>
 *       <Input value={search} onChange={setSearch} />
 *       {isLoading ? (
 *         <Spinner />
 *       ) : (
 *         <ComboboxList>
 *           {teams.map(team => (
 *             <ComboboxItem
 *               key={team.id}
 *               onSelect={() => onSelect(team.id)}
 *             >
 *               {team.name} ({team.owner.name})
 *             </ComboboxItem>
 *           ))}
 *         </ComboboxList>
 *       )}
 *       <p>{totalCount} teams available</p>
 *     </Combobox>
 *   )
 * }
 * ```
 */
export function useTeamSearch(search: string = '', enabled: boolean = true) {
  const query = useQuery({
    queryKey: teamsKeys.adminSearch(search),
    queryFn: () =>
      TeamsAPI.getAdminTeams({
        search: search || undefined,
        type: 'user', // Exclude system admin team
        limit: 100, // Enough for dropdown
      }),
    enabled,
    staleTime: 30 * 1000, // 30 seconds
  })

  return {
    /** List of teams matching search */
    teams: query.data?.teams ?? [],
    /** Total count of user teams */
    totalCount: query.data?.counts?.user ?? 0,
    /** Loading state */
    isLoading: query.isLoading,
    /** Fetching state (for search updates) */
    isFetching: query.isFetching,
    /** Error if any */
    error: query.error,
  }
}

export type UseTeamSearchReturn = ReturnType<typeof useTeamSearch>
