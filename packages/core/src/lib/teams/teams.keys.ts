/**
 * Teams Query Keys Factory
 *
 * Centralized query key management for all team-related React Query hooks.
 * Enables predictable caching and smart cache invalidation.
 *
 * @module core/lib/teams/teams.keys
 *
 * @example
 * // Using keys in hooks
 * useQuery({ queryKey: teamsKeys.user() })
 * useQuery({ queryKey: teamsKeys.adminList({ search: 'acme' }) })
 *
 * // Invalidating related queries
 * queryClient.invalidateQueries({ queryKey: teamsKeys.all })
 */

import type { AdminTeamsParams } from './types'

export const teamsKeys = {
  /**
   * Base key for all team queries
   * Use to invalidate ALL team-related caches
   */
  all: ['teams'] as const,

  /**
   * User's teams (normal user scope)
   * Endpoint: GET /api/v1/teams
   */
  user: () => [...teamsKeys.all, 'user'] as const,

  /**
   * Single team by ID
   */
  detail: (teamId: string) => [...teamsKeys.all, 'detail', teamId] as const,

  /**
   * Admin teams scope (superadmin/developer)
   * Base key for all admin team queries
   */
  admin: () => [...teamsKeys.all, 'admin'] as const,

  /**
   * Admin teams list with parameters
   * Endpoint: GET /api/superadmin/teams
   * Used by superadmin management page
   */
  adminList: (params: AdminTeamsParams) =>
    [...teamsKeys.admin(), 'list', params] as const,

  /**
   * Admin teams search (optimized for dropdowns)
   * Uses simplified key for search-based caching
   */
  adminSearch: (search: string) =>
    [...teamsKeys.admin(), 'search', search] as const,
} as const

/**
 * Type helper for query key inference
 */
export type TeamsKeys = typeof teamsKeys
