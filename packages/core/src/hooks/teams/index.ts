/**
 * Teams Hooks
 *
 * React Query hooks for team management.
 *
 * @module core/hooks/teams
 *
 * @example
 * ```tsx
 * // User's teams (team switcher, forms)
 * import { useUserTeams } from '@nextsparkjs/core/hooks/teams'
 *
 * // Admin teams management (superadmin page)
 * import { useAdminTeams } from '@nextsparkjs/core/hooks/teams'
 *
 * // Searchable dropdown (API Explorer, filters)
 * import { useTeamSearch } from '@nextsparkjs/core/hooks/teams'
 * ```
 */

// Hooks
export { useUserTeams } from './useUserTeams'
export { useAdminTeams } from './useAdminTeams'
export { useTeamSearch } from './useTeamSearch'

// Types
export type { UseUserTeamsReturn } from './useUserTeams'
export type { UseAdminTeamsOptions, UseAdminTeamsReturn } from './useAdminTeams'
export type { UseTeamSearchReturn } from './useTeamSearch'

// Re-export commonly used types from lib
export type {
  Team,
  TeamWithOwner,
  AdminTeamsParams,
  AdminTeamsResponse,
} from '../../lib/teams/types'

// Re-export query keys for advanced usage
export { teamsKeys } from '../../lib/teams/teams.keys'
