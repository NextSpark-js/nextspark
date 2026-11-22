/**
 * The applications connected to an account by MCP browser sign-in (#541): what a user sees and can end from the
 * app, and what an owner or admin of a team sees of the connections to that team.
 *
 * A connection is a client acting for a user in one team. It is alive while it has a refresh token that is neither
 * revoked nor expired; rotation replaces that token, so the newest live one says what the connection can do and when
 * it last renewed. Ending it removes its consent and its refresh tokens: the trigger of migration 048 records the
 * revocation, which is what refuses the access tokens already issued (lib/mcp/oauth/revocation), and connecting
 * again asks for consent again.
 *
 * Who may see and end the connections of a team's other members is a team permission (MANAGE_CONNECTIONS), decided
 * as every other one is: by the role's permissions, which a project can extend, and by `teams.appRoleBypass`.
 *
 * Service connection: these are the authorization server's tables, which no user role reads.
 */
import { query, queryOne, queryRows, withServiceTransaction } from '../../db'
import { hasTeamPermission } from '../../permissions/app-role-bypass'
import type { Permission } from '../../permissions/types'
import { entityScope } from './scope-names'

export interface OAuthConnection {
  clientId: string
  clientName: string | null
  /** The host the client is published at, for a client the user has to tell apart from another of the same name. */
  clientHost: string | null
  teamId: string
  teamName: string | null
  userId: string
  userName: string | null
  userEmail: string | null
  /** Entity permissions only: `offline_access` and the identity scopes are not something to show. */
  scopes: string[]
  connectedAt: string
  lastRenewedAt: string
}

interface ConnectionRow {
  clientId: string
  clientName: string | null
  clientUri: string | null
  teamId: string
  teamName: string | null
  userId: string
  userName: string | null
  userEmail: string | null
  scopes: unknown
  connectedAt: Date | string
  lastRenewedAt: Date | string
}

const iso = (value: Date | string) => (value instanceof Date ? value : new Date(value)).toISOString()

function hostOf(...candidates: Array<string | null>): string | null {
  for (const candidate of candidates) {
    try {
      if (candidate) return new URL(candidate).host
    } catch {
      // not a URL: a client registered with an opaque id
    }
  }
  return null
}

function toConnection(row: ConnectionRow): OAuthConnection {
  const scopes = Array.isArray(row.scopes) ? row.scopes.filter((scope): scope is string => typeof scope === 'string') : []
  return {
    clientId: row.clientId,
    clientName: row.clientName,
    clientHost: hostOf(row.clientUri, row.clientId),
    teamId: row.teamId,
    teamName: row.teamName,
    userId: row.userId,
    userName: row.userName,
    userEmail: row.userEmail,
    scopes: scopes.filter(scope => entityScope(scope)).sort(),
    connectedAt: iso(row.connectedAt),
    lastRenewedAt: iso(row.lastRenewedAt),
  }
}

// One row per connection: its newest live refresh token, with when it was first consented to (the tokens that came
// before the live one are purged a day after they are replaced, the consent stays)
const CONNECTIONS = `
  SELECT DISTINCT ON (rt."userId", rt."clientId", rt."referenceId")
         rt."clientId", c.name AS "clientName", c.uri AS "clientUri",
         rt."referenceId" AS "teamId", t.name AS "teamName",
         rt."userId", u.name AS "userName", u.email AS "userEmail",
         rt.scopes, rt."createdAt" AS "lastRenewedAt",
         COALESCE(
           (SELECT MIN(consent."createdAt") FROM "oauthConsent" consent
             WHERE consent."userId" = rt."userId" AND consent."clientId" = rt."clientId" AND consent."referenceId" = rt."referenceId"),
           rt."createdAt") AS "connectedAt"
    FROM "oauthRefreshToken" rt
    JOIN "oauthClient" c ON c."clientId" = rt."clientId"
    JOIN "users" u ON u.id = rt."userId"
    JOIN "teams" t ON t.id = rt."referenceId"
   WHERE rt.revoked IS NULL AND rt."expiresAt" > now()`
const NEWEST_FIRST = `ORDER BY rt."userId", rt."clientId", rt."referenceId", rt."createdAt" DESC`

/** The team permission that lets a member see and end the other members' connections to the team. */
export const MANAGE_CONNECTIONS = 'settings.integrations' as Permission

/** The user's own live connections. */
export async function userConnections(userId: string): Promise<OAuthConnection[]> {
  const rows = await queryRows<ConnectionRow>(`${CONNECTIONS} AND rt."userId" = $1 ${NEWEST_FIRST}`, [userId])
  return rows.map(toConnection)
}

/** The teams in which the user holds MANAGE_CONNECTIONS. `appRole` is the user's role in the app (users.role). */
async function managedTeams(userId: string, appRole: string | null | undefined): Promise<string[]> {
  const memberships = await queryRows<{ teamId: string; role: string }>(
    `SELECT "teamId", role FROM "team_members" WHERE "userId" = $1`,
    [userId]
  )
  return memberships.filter(membership => hasTeamPermission(appRole, membership.role, MANAGE_CONNECTIONS)).map(membership => membership.teamId)
}

/**
 * Other members' live connections to the teams in which this user holds MANAGE_CONNECTIONS. A connection acts with
 * its user's role in the team, so whoever manages the team's integrations sees which applications reach its data
 * and can end them.
 */
export async function managedConnections(userId: string, appRole: string | null | undefined): Promise<OAuthConnection[]> {
  const teams = await managedTeams(userId, appRole)
  if (!teams.length) return []
  const rows = await queryRows<ConnectionRow>(
    `${CONNECTIONS} AND rt."userId" <> $1 AND rt."referenceId" = ANY($2::text[]) ${NEWEST_FIRST}`,
    [userId, teams]
  )
  return rows.map(toConnection)
}

/** Removes the consent and the refresh tokens of a connection. Inside a service transaction (see disconnect). */
async function endConnection(userId: string, clientId: string, teamId: string): Promise<boolean> {
  const consents = await queryRows<{ id: string }>(
    `DELETE FROM "oauthConsent" WHERE "userId" = $1 AND "clientId" = $2 AND "referenceId" = $3 RETURNING id`,
    [userId, clientId, teamId]
  )
  const tokens = await queryRows<{ live: boolean }>(
    `DELETE FROM "oauthRefreshToken"
      WHERE "userId" = $1 AND "clientId" = $2 AND "referenceId" = $3
      RETURNING (revoked IS NULL AND "expiresAt" > now()) AS live`,
    [userId, clientId, teamId]
  )
  const live = tokens.some(token => token.live)
  // No live refresh token went (a client that asked for no offline access, or one whose renewal was refused at
  // this moment): no trigger ran, and an access token may still be good for minutes. Record the revocation.
  if (!live && (consents.length || tokens.length)) {
    await query(`INSERT INTO "oauthRevocation" ("userId", "clientId", "teamId") VALUES ($1, $2, $3)`, [userId, clientId, teamId])
  }
  return live || consents.length > 0
}

/**
 * Ends the connection of `clientId` for `userId` in `teamId`: its consent and its refresh tokens are removed, which
 * the database records as a revocation that refuses the access tokens already issued. False when there was nothing
 * to end.
 *
 * In one transaction, the consent first. A refresh token can only be written for a connection that has its consent
 * (migration 048, require_oauth_consent_for_refresh_token, which locks the consent row): a renewal in flight either
 * writes its new token before the consent goes, and the token is removed here with the rest, or finds no consent and
 * is refused. No renewal that races with this leaves a live token behind.
 *
 * The tokens are deleted, not marked revoked: the authorization server takes a revoked refresh token presented again
 * for a stolen one and ends every connection of that client for the user, in every team. The application that was
 * disconnected will try its token once more; with the token gone that attempt is an unknown token and touches
 * nothing else.
 */
export function disconnect(userId: string, clientId: string, teamId: string): Promise<boolean> {
  return withServiceTransaction(() => endConnection(userId, clientId, teamId))
}

/**
 * Ends another member's connection for a manager of the team: `actorId` must hold MANAGE_CONNECTIONS in `teamId`.
 * What decides it, the actor's role in the team and their role in the app (`teams.appRoleBypass`), is read and
 * locked in the transaction that ends the connection, so a role taken away or a membership removed at that moment
 * is either seen here or waits until this is done. False when the actor may not, and when there was nothing to end.
 */
export function disconnectManaged(actorId: string, userId: string, clientId: string, teamId: string): Promise<boolean> {
  return withServiceTransaction(async () => {
    const actor = await queryOne<{ teamRole: string; appRole: string | null }>(
      `SELECT tm.role AS "teamRole", u.role AS "appRole"
         FROM "team_members" tm JOIN "users" u ON u.id = tm."userId"
        WHERE tm."userId" = $1 AND tm."teamId" = $2
          FOR SHARE`,
      [actorId, teamId]
    )
    if (!hasTeamPermission(actor?.appRole, actor?.teamRole ?? null, MANAGE_CONNECTIONS)) return false
    return endConnection(userId, clientId, teamId)
  })
}
