/**
 * Teams Client API
 *
 * Client-side API functions for team operations.
 * These functions are pure (no React) and can be used in hooks or directly.
 *
 * @module core/lib/teams/teams.api
 *
 * @example
 * // Direct usage
 * const teams = await TeamsAPI.getUserTeams()
 *
 * // In React Query
 * useQuery({ queryFn: TeamsAPI.getUserTeams })
 */

import type {
  Team,
  AdminTeamsResponse,
  AdminTeamsParams,
  CreateTeamRequest,
} from './types'

/**
 * API response format from /api/v1/teams
 */
interface UserTeamsApiResponse {
  success: boolean
  data?: Team[]
  teams?: Team[]
  error?: string
}

/**
 * Teams Client API
 *
 * Provides methods for fetching teams from the API.
 * Server-side operations use TeamService directly.
 */
export class TeamsAPI {
  // =============================================================================
  // USER TEAMS (Normal user scope)
  // =============================================================================

  /**
   * Fetch current user's teams
   *
   * @returns Array of teams the user belongs to
   * @throws Error if request fails
   *
   * @example
   * const teams = await TeamsAPI.getUserTeams()
   */
  static async getUserTeams(): Promise<Team[]> {
    const response = await fetch('/api/v1/teams')

    if (!response.ok) {
      throw new Error('Failed to fetch teams')
    }

    const result: UserTeamsApiResponse = await response.json()

    // API returns { success, data: [...teams] } or { teams: [...] }
    return result.data || result.teams || []
  }

  /**
   * Create a new team
   *
   * @param data - Team creation data
   * @returns Created team
   * @throws Error if request fails
   */
  static async createTeam(data: CreateTeamRequest): Promise<Team> {
    const response = await fetch('/api/v1/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create team')
    }

    const result = await response.json()
    return result.data || result.team
  }

  // =============================================================================
  // ADMIN TEAMS (Superadmin/Developer scope)
  // =============================================================================

  /**
   * Fetch all teams (admin only)
   *
   * Requires superadmin or developer role.
   * Supports search, filtering by type, and pagination.
   *
   * @param params - Query parameters
   * @returns Teams response with counts and pagination
   * @throws Error if request fails or user is not authorized
   *
   * @example
   * // Get all user teams
   * const response = await TeamsAPI.getAdminTeams({ type: 'user' })
   *
   * // Search teams
   * const response = await TeamsAPI.getAdminTeams({ search: 'acme' })
   *
   * // Paginate
   * const response = await TeamsAPI.getAdminTeams({ page: 2, limit: 20 })
   */
  static async getAdminTeams(
    params: AdminTeamsParams = {}
  ): Promise<AdminTeamsResponse> {
    const searchParams = new URLSearchParams()

    if (params.search) {
      searchParams.set('search', params.search)
    }
    if (params.type) {
      searchParams.set('type', params.type)
    }
    if (params.page) {
      searchParams.set('page', String(params.page))
    }
    if (params.limit) {
      searchParams.set('limit', String(params.limit))
    }

    const queryString = searchParams.toString()
    const url = `/api/superadmin/teams${queryString ? `?${queryString}` : ''}`

    const response = await fetch(url)

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('Not authorized to view all teams')
      }
      if (response.status === 401) {
        throw new Error('Authentication required')
      }
      throw new Error('Failed to fetch teams')
    }

    return response.json()
  }
}
