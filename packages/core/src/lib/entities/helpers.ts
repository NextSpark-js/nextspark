/**
 * Entity Helpers - Phase 2 Teams Integration
 *
 * This file contains helper functions for entity-level operations,
 * particularly for the two-layer security model:
 * - RLS (Database): Team isolation only (identical for ALL entities)
 * - App (Endpoints): User isolation based on access.shared config
 */

import { ENTITY_REGISTRY } from './queries'

/**
 * Determines if an entity should filter by userId at the app level
 *
 * The two-layer security model:
 * - RLS at DB level handles team isolation (IDENTICAL for all entities)
 * - App level handles user isolation based on access.shared config
 *
 * @param entityName - The name of the entity (e.g., 'tasks', 'customers')
 * @returns True if the entity requires user isolation (access.shared === false)
 *
 * @example
 * ```ts
 * // Tasks with access.shared: false -> Only owner sees their records
 * if (shouldFilterByUserId('tasks')) {
 *   query += ' AND "userId" = $userId'
 * }
 *
 * // Customers with access.shared: true -> All team members see all records
 * if (shouldFilterByUserId('customers')) { // false
 *   // No additional userId filter needed
 * }
 * ```
 */
export function shouldFilterByUserId(entityName: string): boolean {
  const entityConfig = ENTITY_REGISTRY[entityName as keyof typeof ENTITY_REGISTRY]

  // If access.shared is explicitly false, filter by userId
  // Default (undefined or true) means shared within team
  return entityConfig?.config?.access?.shared === false
}

/**
 * Gets the isolation mode for an entity
 *
 * @param entityName - The name of the entity
 * @returns 'private' (user isolation) or 'shared' (team-wide access)
 */
export function getEntityIsolationMode(entityName: string): 'private' | 'shared' {
  return shouldFilterByUserId(entityName) ? 'private' : 'shared'
}

/**
 * Applies user isolation to a query based on entity config
 *
 * This is the recommended way to build queries that respect the two-layer model.
 *
 * @param entityName - The name of the entity
 * @param baseConditions - Base WHERE conditions (should already include teamId)
 * @param userId - The current user's ID
 * @returns Modified conditions with optional userId filter
 *
 * @example
 * ```ts
 * // In an API endpoint:
 * const conditions = applyUserIsolation('tasks', { teamId }, userId)
 * // If tasks has access.shared: false
 * // -> conditions = { teamId, userId }
 * // If access.shared: true
 * // -> conditions = { teamId }
 * ```
 */
export function applyUserIsolation(
  entityName: string,
  baseConditions: { teamId: string; [key: string]: unknown },
  userId: string
): { teamId: string; userId?: string; [key: string]: unknown } {
  if (shouldFilterByUserId(entityName)) {
    return { ...baseConditions, userId }
  }
  return baseConditions
}

/**
 * Builds SQL WHERE clause for entity queries
 *
 * Generates the appropriate WHERE clause based on entity config:
 * - Always includes teamId (RLS layer)
 * - Optionally includes userId (App layer based on access.shared)
 *
 * @param entityName - The name of the entity
 * @param teamIdParam - The parameter number for teamId (e.g., 1 -> $1)
 * @param userIdParam - The parameter number for userId (e.g., 2 -> $2)
 * @returns SQL WHERE conditions string and array of used parameters
 *
 * @example
 * ```ts
 * const { clause, params } = buildEntityWhereClause('tasks', 1, 2)
 * // If tasks has access.shared: false
 * // -> clause = '"teamId" = $1 AND "userId" = $2'
 * // -> params = ['teamId', 'userId']
 *
 * // If customers has access.shared: true
 * // -> clause = '"teamId" = $1'
 * // -> params = ['teamId']
 * ```
 */
export function buildEntityWhereClause(
  entityName: string,
  teamIdParam: number = 1,
  userIdParam: number = 2
): { clause: string; params: string[] } {
  const baseClause = `"teamId" = $${teamIdParam}`

  if (shouldFilterByUserId(entityName)) {
    return {
      clause: `${baseClause} AND "userId" = $${userIdParam}`,
      params: ['teamId', 'userId']
    }
  }

  return {
    clause: baseClause,
    params: ['teamId']
  }
}

/**
 * Validates that a team context exists for entity operations
 *
 * @param teamId - The team ID from request headers
 * @throws Error if teamId is missing
 */
export function validateTeamContext(teamId: string | null): asserts teamId is string {
  if (!teamId) {
    throw new Error('No team context provided. Include x-team-id header.')
  }
}

/**
 * Gets required entity fields for creation
 *
 * Returns the fields that must be set when creating an entity:
 * - userId: Always required (creator)
 * - teamId: Always required (team context)
 *
 * @param userId - The current user's ID
 * @param teamId - The active team's ID
 * @returns Object with userId and teamId
 */
export function getEntityCreationFields(
  userId: string,
  teamId: string
): { userId: string; teamId: string } {
  return { userId, teamId }
}
