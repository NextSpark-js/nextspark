/**
 * What a consent may grant, decided on the server (#541). The consent screen sends the permissions the user left
 * ticked; this is where they are held to what the client asked for and to what the user's role in the team can
 * hold, whatever the browser sent. Without it a request written by hand to `/oauth2/consent` could put a scope the
 * role does not have into the grant: the resource server would still refuse to act on it (it cuts a token down to
 * the role on every request), but the grant, the token and the list of connected applications would name a
 * permission the user never had.
 */
import { APIError, type BetterAuthPlugin } from 'better-auth'
import { createAuthMiddleware, getSessionFromCtx } from 'better-auth/api'
import { scopesAllowedForUser } from '../../api/auth/user-scopes'
import { queryOne } from '../../db'
import { isClientAllowed, isRequestAllowed } from './allowed-clients'
import { allowedClientHosts } from './config'
import { mcpOAuthRefusedByGate, NOT_AVAILABLE } from './production-gate'
import { entityScope } from './scope-names'
import { activeScopes, mcpOAuthRoleScopes } from './scopes'
import { isAuthorizationKey, selectedTeam } from './team-selection'

/**
 * Of `scopes`, the ones the user's role in the team holds: the rule `validateScopesForUser` applies for API keys
 * (lib/api/auth/user-scopes), with the role's scopes computed from data this module's graph may import (./scopes).
 * The MCP endpoint cuts every token down to the role again, with the scope registry itself, on each request.
 */
async function heldByRoleIn(userId: string, teamId: string, scopes: string[]): Promise<string[]> {
  return (await scopesAllowedForUser(userId, teamId, scopes, mcpOAuthRoleScopes)).allowedScopes
}

/**
 * The scopes a consent grants: of the ones the client asked for, the ones accepted (all of them when the consent
 * names none), and of those that are entity permissions only the ones the role can hold. A scope that is not an
 * entity permission (`offline_access`, the identity scopes) is not the role's to limit.
 */
export function consentedScopes(requested: readonly string[], accepted: readonly string[] | undefined, heldByRole: readonly string[]): string[] {
  return requested.filter(scope => (!accepted || accepted.includes(scope)) && (!entityScope(scope) || heldByRole.includes(scope)))
}

/**
 * Refuses an authorization for a client that is set to skip consent. The consent is where the user chooses the
 * permissions of the connection and the row every refresh token is held to (migration 049): a client that skips it
 * would be handed every scope it asked for, and its tokens could not be written. A first-party client is a client
 * like any other here.
 */
export async function refuseConsentSkippingClient(clientId: string | null | undefined): Promise<void> {
  if (!clientId) return
  const client = await queryOne<{ skipConsent: boolean | null }>('SELECT "skipConsent" FROM "oauthClient" WHERE "clientId" = $1', [clientId])
  if (client?.skipConsent) {
    throw new APIError('BAD_REQUEST', { error: 'access_denied', error_description: 'this server asks the user for consent: a client that skips it is not accepted' })
  }
}

/**
 * Refuses an authorization for an application the project does not accept (`mcp.oauth.allowedClientHosts`,
 * lib/mcp/oauth/allowed-clients). Without a list every application is accepted.
 */
export function refuseUnlistedClient(clientId: string | null | undefined): void {
  if (!isClientAllowed(clientId, allowedClientHosts())) {
    throw new APIError('BAD_REQUEST', { error: 'access_denied', error_description: 'this application is not among the ones this server accepts' })
  }
}

const scopeList = (value: unknown): string[] | undefined =>
  typeof value === 'string' ? value.split(/\s+/).filter(Boolean) : undefined

/**
 * Every endpoint the OAuth provider serves under the auth route: `/oauth2/*`, the administration ones and the
 * discovery documents. The production gate holds all of them, except the two that only take access away: a client
 * that revokes its token and a user who withdraws a consent are served whatever the deployment is missing.
 */
const AUTHORIZATION_SERVER_PATH = /^\/(?:(?:admin\/)?oauth2\/|\.well-known\/(?:oauth-authorization-server|oauth-protected-resource|openid-configuration)(?:\/|$))/
const TAKES_ACCESS_AWAY = ['/oauth2/revoke', '/oauth2/delete-consent']
export const isHeldByProductionGate = (path: string | undefined): boolean =>
  !!path && AUTHORIZATION_SERVER_PATH.test(path) && !TAKES_ACCESS_AWAY.includes(path)

/** The endpoints a client uses after it was authorized: exchanging a code, renewing a token, reading the identity. */
const AFTER_AUTHORIZATION = ['/oauth2/token', '/oauth2/userinfo']

export const consentWithinRolePlugin = (): BetterAuthPlugin => ({
  id: 'mcp-consent-within-role',
  hooks: {
    before: [
      {
        // The production gate (./production-gate): while the role of the database skips row-level security and the
        // deployment has not accepted that, no endpoint of the authorization server answers. First, so that nothing
        // below reads or writes for a request that will not be served. The discovery documents and the MCP endpoint
        // ask the same question themselves (./discovery, ./resource-server).
        matcher: ctx => isHeldByProductionGate(ctx.path),
        handler: createAuthMiddleware(async () => {
          if (await mcpOAuthRefusedByGate()) {
            throw new APIError('SERVICE_UNAVAILABLE', { error: 'temporarily_unavailable', error_description: NOT_AVAILABLE })
          }
        }),
      },
      {
        // The project's list of accepted applications, for a client that was authorized before the list changed:
        // it exchanges no code, renews no token and reads no identity. (Asking for authorization is refused in
        // lib/mcp/oauth/plugins, and the MCP endpoint in lib/mcp/oauth/resource-server.)
        matcher: ctx => AFTER_AUTHORIZATION.includes(ctx.path ?? ''),
        handler: createAuthMiddleware(async ctx => {
          const headers = (ctx.headers ?? ctx.request?.headers) as Headers | undefined
          // With a list, the request names a client that can be read and every client it names is accepted. One
          // whose client cannot be read is not let through for the endpoint to work out (an access token that is
          // not a JWT says nothing of who it was issued to), and neither is one that names an accepted client in
          // one place and another in a second: which of them the endpoint goes by is not decided here.
          if (!isRequestAllowed({ body: ctx.body, authorization: headers?.get('authorization') }, allowedClientHosts())) {
            throw new APIError('UNAUTHORIZED', { error: 'invalid_client', error_description: 'this application is not among the ones this server accepts' })
          }
        }),
      },
      {
        // The authorization server also lets the signed-in user rewrite the scopes of a consent directly. The
        // same bound holds there: what the user's role in the team of that consent can hold, and nothing else.
        matcher: ctx => ctx.path === '/oauth2/update-consent',
        handler: createAuthMiddleware(async ctx => {
          const body = (ctx.body ?? {}) as { id?: unknown; update?: { scopes?: unknown } }
          const scopes = body.update?.scopes
          if (typeof body.id !== 'string' || !Array.isArray(scopes)) return
          const session = await getSessionFromCtx(ctx)
          const consent = await queryOne<{ userId: string | null; referenceId: string | null }>(
            'SELECT "userId", "referenceId" FROM "oauthConsent" WHERE id = $1',
            [body.id]
          )
          // Not this user's consent, or not one of a team: the endpoint's to refuse or to handle
          if (!session || !consent?.referenceId || consent.userId !== session.user.id) return
          const named = scopes.filter((scope): scope is string => typeof scope === 'string')
          // Only active scopes can be held from now on: one whose tool was retired is accepted when asked for, not granted
          const entityScopes = activeScopes(named).filter(scope => entityScope(scope))
          const heldByRole = entityScopes.length ? (await heldByRoleIn(session.user.id, consent.referenceId, entityScopes)) : []
          return { context: { body: { ...body, update: { ...body.update, scopes: consentedScopes(named, undefined, heldByRole) } } } }
        }),
      },
      {
        matcher: ctx => ctx.path === '/oauth2/consent',
        handler: createAuthMiddleware(async ctx => {
          const body = (ctx.body ?? {}) as { accept?: unknown; scope?: unknown; oauth_query?: unknown }
          // A refusal grants nothing; a body without the signed query is the endpoint's to reject
          if (body.accept !== true || typeof body.oauth_query !== 'string') return
          const query = new URLSearchParams(body.oauth_query)
          const requested = scopeList(query.get('scope')) ?? []
          const authorization = query.get('code_challenge')
          const session = await getSessionFromCtx(ctx)
          // No session or no team chosen: the endpoint refuses the consent itself. Until it does, nothing the role
          // would have to vouch for is let through.
          const teamId = session && isAuthorizationKey(authorization) ? await selectedTeam(session.session.id, authorization, session.user.id) : undefined
          // Only active scopes are granted: one whose tool was retired is accepted when asked for, not granted
          const entityScopes = activeScopes(requested).filter(scope => entityScope(scope))
          const heldByRole = session && teamId && entityScopes.length ? (await heldByRoleIn(session.user.id, teamId, entityScopes)) : []
          const scope = consentedScopes(requested, scopeList(body.scope), heldByRole).join(' ')
          return { context: { body: { ...body, scope } } }
        }),
      },
    ],
  },
})
