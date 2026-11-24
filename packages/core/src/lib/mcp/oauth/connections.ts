/**
 * The applications connected to an account by MCP browser sign-in (#541): what a user sees, narrows and ends from
 * the app, and what whoever manages a team's integrations sees and ends of the other members' connections to it.
 * The database work is lib/mcp/oauth/connection-store; this adds who may.
 *
 * Seeing and ending the connections of a team's other members is a team permission (MANAGE_CONNECTIONS), decided
 * as every other one is: by the role's permissions, which a project can extend, and by `teams.appRoleBypass`.
 */
import { hasTeamPermission } from '../../permissions/app-role-bypass'
import type { Permission } from '../../permissions/types'
import { disconnectAs, membershipsOf, othersConnections, type OAuthConnection } from './connection-store'
import { activeScopes } from './scopes'

export { disconnect, grantedScopes, narrowConnection, revokeScopeFromConnections, userConnections } from './connection-store'
export type { NarrowResult, OAuthConnection } from './connection-store'

/** The team permission that lets a member see and end the other members' connections to the team. */
export const MANAGE_CONNECTIONS = 'settings.integrations' as Permission

/**
 * Other members' live connections to the teams in which this user holds MANAGE_CONNECTIONS. A connection acts with
 * its user's role in the team, so whoever manages the team's integrations sees which applications reach its data
 * and can end them. `appRole` is the user's role in the app (users.role).
 */
export async function managedConnections(userId: string, appRole: string | null | undefined): Promise<OAuthConnection[]> {
  const memberships = await membershipsOf(userId)
  const teams = memberships.filter(membership => hasTeamPermission(appRole, membership.role, MANAGE_CONNECTIONS)).map(membership => membership.teamId)
  return othersConnections(userId, teams)
}

/**
 * A connection as it is shown: with the permissions that do something. One made before a tool was retired may
 * still hold its scope; that scope is accepted and inert, and listing it would show a permission that is not
 * there to use. It leaves the connection the next time its permissions are edited or its token is renewed.
 */
export function withActiveScopes(connections: OAuthConnection[]): OAuthConnection[] {
  return connections.map(connection => ({ ...connection, scopes: activeScopes(connection.scopes) }))
}

/**
 * Ends another member's connection for a manager of the team: `actorId` must hold MANAGE_CONNECTIONS in `teamId`,
 * by the roles the database has when the connection is ended. False when the actor may not, and when there was
 * nothing to end.
 */
export function disconnectManaged(actorId: string, userId: string, clientId: string, teamId: string): Promise<boolean> {
  return disconnectAs(actorId, (appRole, teamRole) => hasTeamPermission(appRole, teamRole, MANAGE_CONNECTIONS), userId, clientId, teamId)
}
