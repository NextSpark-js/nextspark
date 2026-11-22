/**
 * The applications connected to an account by MCP browser sign-in (#541): what a user sees and can end from the
 * app, and what an owner or admin of a team sees of the connections to that team.
 *
 * A connection is a client acting for a user in one team. It is alive while it has a refresh token that is neither
 * revoked nor expired; rotation replaces that token, so the newest live one says what the connection can do and when
 * it last renewed. Ending it deletes its refresh tokens: the trigger of migration 048 records the revocation, which
 * is what refuses the access tokens already issued (lib/mcp/oauth/revocation), and the consent is removed so that
 * connecting again asks again.
 *
 * Service connection: these are the authorization server's tables, which no user role reads.
 */
import { query, queryOne, queryRows } from '../../db'
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

/** The user's own live connections. */
export async function userConnections(userId: string): Promise<OAuthConnection[]> {
  const rows = await queryRows<ConnectionRow>(`${CONNECTIONS} AND rt."userId" = $1 ${NEWEST_FIRST}`, [userId])
  return rows.map(toConnection)
}

/**
 * Other members' live connections to the teams this user owns or administers. A connection acts with its user's
 * role in the team, so whoever runs the team sees which applications reach its data and can end them.
 */
export async function managedConnections(userId: string): Promise<OAuthConnection[]> {
  const rows = await queryRows<ConnectionRow>(
    `${CONNECTIONS} AND rt."userId" <> $1
       AND rt."referenceId" IN (SELECT "teamId" FROM "team_members" WHERE "userId" = $1 AND role IN ('owner', 'admin'))
     ${NEWEST_FIRST}`,
    [userId]
  )
  return rows.map(toConnection)
}

/** Whether the user owns or administers the team. */
export async function managesTeam(userId: string, teamId: string): Promise<boolean> {
  const row = await queryOne<{ role: string }>(
    `SELECT role FROM "team_members" WHERE "userId" = $1 AND "teamId" = $2 AND role IN ('owner', 'admin')`,
    [userId, teamId]
  )
  return Boolean(row)
}

/**
 * Ends the connection of `clientId` for `userId` in `teamId`: its refresh tokens are deleted, which the database
 * records as a revocation that refuses the access tokens already issued, and its consent is removed. False when
 * there was nothing to end.
 *
 * Deleted, not marked revoked: the authorization server takes a revoked refresh token presented again for a stolen
 * one and ends every connection of that client for the user, in every team. The application that was disconnected
 * will try its token once more; with the token gone that attempt is an unknown token and touches nothing else.
 */
export async function disconnect(userId: string, clientId: string, teamId: string): Promise<boolean> {
  const tokens = await queryRows<{ live: boolean }>(
    `DELETE FROM "oauthRefreshToken"
      WHERE "userId" = $1 AND "clientId" = $2 AND "referenceId" = $3
      RETURNING (revoked IS NULL AND "expiresAt" > now()) AS live`,
    [userId, clientId, teamId]
  )
  const consents = await queryRows<{ id: string }>(
    `DELETE FROM "oauthConsent" WHERE "userId" = $1 AND "clientId" = $2 AND "referenceId" = $3 RETURNING id`,
    [userId, clientId, teamId]
  )
  const live = tokens.some(token => token.live)
  // A consent with no live refresh token (a client that asked for no offline access): no trigger ran, and its
  // access token is still good for minutes. Record the revocation that refuses it.
  if (!live && consents.length) {
    await query(`INSERT INTO "oauthRevocation" ("userId", "clientId", "teamId") VALUES ($1, $2, $3)`, [userId, clientId, teamId])
  }
  return live || consents.length > 0
}
