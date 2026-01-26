/**
 * Teams API Service
 *
 * Team management operations.
 */

import { apiClient } from '../client'
import type { TeamsResponse } from './types'

export const teamsApi = {
  /**
   * Get user's teams
   */
  async getTeams(): Promise<TeamsResponse> {
    return apiClient.get<TeamsResponse>('/api/v1/teams')
  },

  /**
   * Switch to a different team
   */
  async switchTeam(teamId: string): Promise<void> {
    await apiClient.setTeamId(teamId)
  },
}
