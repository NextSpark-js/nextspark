/**
 * The connections of MCP browser sign-in in the database (#541): reading them, ending one and taking permissions
 * away from one. lib/mcp/oauth/connections adds who may do it to another member's.
 *
 * A connection is a client acting for a user in one team. It is alive while it has a refresh token that is neither
 * revoked nor expired; rotation replaces that token, so the newest live one says what the connection can do and when
 * it last renewed. Its consent row says what it may do; the rules of migration 048 hold every refresh token to it.
 *
 * Service connection: these are the authorization server's tables, which no user role reads. Nothing here imports
 * the project's configuration, so it runs against a database with nothing else around it (tests/node).
 */
import { query, queryOne, queryRows, withServiceTransaction } from '../../db'
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

const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []

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
  return {
    clientId: row.clientId,
    clientName: row.clientName,
    clientHost: hostOf(row.clientUri, row.clientId),
    teamId: row.teamId,
    teamName: row.teamName,
    userId: row.userId,
    userName: row.userName,
    userEmail: row.userEmail,
    scopes: stringList(row.scopes).filter(scope => entityScope(scope)).sort(),
    connectedAt: iso(row.connectedAt),
    lastRenewedAt: iso(row.lastRenewedAt),
  }
}

// One row per connection: its newest live refresh token, with when it was first consented to (the tokens that came
// before the live one are purged once they expire, the consent stays)
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

/** The user's memberships: every team with the role held in it. */
export function membershipsOf(userId: string): Promise<Array<{ teamId: string; role: string }>> {
  return queryRows<{ teamId: string; role: string }>(`SELECT "teamId", role FROM "team_members" WHERE "userId" = $1`, [userId])
}

/** The live connections to these teams of everybody but `userId`. */
export async function othersConnections(userId: string, teamIds: readonly string[]): Promise<OAuthConnection[]> {
  if (!teamIds.length) return []
  const rows = await queryRows<ConnectionRow>(
    `${CONNECTIONS} AND rt."userId" <> $1 AND rt."referenceId" = ANY($2::text[]) ${NEWEST_FIRST}`,
    [userId, [...teamIds]]
  )
  return rows.map(toConnection)
}

/**
 * The entity permissions the connection is consented to, or null when it has no consent: what the consent screen
 * ticks when the application connects again.
 */
export async function grantedScopes(userId: string, clientId: string, teamId: string): Promise<string[] | null> {
  const consent = await queryOne<{ scopes: unknown }>(
    `SELECT scopes FROM "oauthConsent" WHERE "userId" = $1 AND "clientId" = $2 AND "referenceId" = $3`,
    [userId, clientId, teamId]
  )
  return consent ? stringList(consent.scopes).filter(scope => entityScope(scope)) : null
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
 * Ends another member's connection for `actorId` when `mayEnd` says so of the actor's role in the app and in the
 * team. Both roles are read and locked in the transaction that ends the connection, so a role taken away or a
 * membership removed at that moment is either seen here or waits until this is done. False when the actor may not
 * (not a member of the team, or `mayEnd` answers no), and when there was nothing to end.
 */
export function disconnectAs(
  actorId: string,
  mayEnd: (appRole: string | null, teamRole: string) => boolean,
  userId: string,
  clientId: string,
  teamId: string
): Promise<boolean> {
  return withServiceTransaction(async () => {
    const actor = await queryOne<{ teamRole: string; appRole: string | null }>(
      `SELECT tm.role AS "teamRole", u.role AS "appRole"
         FROM "team_members" tm JOIN "users" u ON u.id = tm."userId"
        WHERE tm."userId" = $1 AND tm."teamId" = $2
          FOR SHARE`,
      [actorId, teamId]
    )
    if (!actor || !mayEnd(actor.appRole, actor.teamRole)) return false
    return endConnection(userId, clientId, teamId)
  })
}

export type NarrowResult = 'narrowed' | 'unchanged' | 'nothing-left' | 'not-found'

/**
 * Takes permissions away from a connection and leaves it connected: of its entity permissions only the ones in
 * `keep` stay. Nothing is ever added here; more is asked for by the application and consented to on the consent
 * screen. `nothing-left` when `keep` would leave no entity permission (that is ending the connection, which
 * disconnect does), `not-found` when there is no such connection.
 *
 * The consent is what is written, with its row locked. The database does the rest in the same statement (migration
 * 048, narrow_oauth_tokens_to_consent): the live refresh tokens of the connection are cut down to the new consent
 * and a revocation is recorded, so the access tokens already issued are refused at once and the application renews
 * with the token it has, which now holds less. A renewal in flight is ordered by the same row: the token it writes
 * holds no more than the consent it finds, whichever of the two got there first.
 */
export function narrowConnection(userId: string, clientId: string, teamId: string, keep: readonly string[]): Promise<NarrowResult> {
  return withServiceTransaction(async () => {
    const consent = await queryOne<{ id: string; scopes: unknown }>(
      `SELECT id, scopes FROM "oauthConsent" WHERE "userId" = $1 AND "clientId" = $2 AND "referenceId" = $3 FOR UPDATE`,
      [userId, clientId, teamId]
    )
    if (!consent) return 'not-found'
    const current = stringList(consent.scopes)
    const next = current.filter(scope => !entityScope(scope) || keep.includes(scope))
    if (!next.some(scope => entityScope(scope))) return 'nothing-left'
    if (next.length === current.length) return 'unchanged'
    await query(`UPDATE "oauthConsent" SET scopes = $2::jsonb, "updatedAt" = now() WHERE id = $1`, [consent.id, JSON.stringify(next)])
    return 'narrowed'
  })
}
