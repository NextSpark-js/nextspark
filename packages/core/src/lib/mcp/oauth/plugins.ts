/**
 * The Better Auth plugins that make the app an OAuth 2.1 authorization server for its own MCP endpoint (#541):
 * `jwt()` signs the access tokens, `mcp()` is the OAuth provider bound to the MCP resource, and `cimd()` lets a
 * client identify itself with a Client ID Metadata Document, which is how Claude and ChatGPT register.
 *
 * Returns no plugin while `MCP_OAUTH_ENABLED` is off, so nothing is mounted and no table is touched.
 *
 * The grant is bound to a team (lib/mcp/oauth/team-selection): the only team of a user in one, or the one a user in
 * several picks on /oauth/select-team after signing in. It is the consent's reference and the token's `team_id`.
 * A suspended account gets no token, new or refreshed.
 */
import { jwt } from 'better-auth/plugins'
import { cimd } from '@better-auth/cimd'
import { fetchClientMetadataResource } from '@better-auth/cimd/node'
import { mcp } from '@better-auth/mcp'
import { withBasePath } from '../../base-path'
import { queryOne } from '../../db'
import { isClientAllowed } from './allowed-clients'
import { consentWithinRolePlugin, refuseConsentSkippingClient, refuseUnlistedClient } from './consent-plugin'
import { purgeExpiredOAuthIfDue } from './purge'
import { mcpOAuthAcceptedScopes, mcpOAuthResourceScopes } from './scopes'
import { mcpToolScopesKnown } from './tool-scopes'
import { APIError } from 'better-auth'
import { isSuspendedRole } from '../../auth/suspension'
import { tryGetCurrentAuthEndpointContext } from '@better-auth/core/context'
import { isAuthorizationKey, selectableTeams, selectedTeam, selectTeam } from './team-selection'
import { allowedClientHosts, isMcpOAuthEnabled, mcpResourceUrl, OIDC_SCOPES, REVOCATION_CLAIM, TEAM_CLAIM } from './config'
import { latestRevocation } from './revocation'

/** A suspended account's browser session can still be alive in its cookie cache: it authorizes nothing. */
function refuseSuspended(user: { role?: unknown } | Record<string, unknown>, error: 'access_denied' | 'invalid_grant' = 'access_denied'): void {
  if (isSuspendedRole((user as { role?: unknown }).role)) {
    throw new APIError('BAD_REQUEST', { error, error_description: 'the account is suspended' })
  }
}

/** The same from the database: the session's copy of the user can be older than the suspension. */
async function refuseSuspendedNow(userId: string): Promise<void> {
  const row = await queryOne<{ role: string }>('SELECT role FROM "users" WHERE id = $1', [userId])
  refuseSuspended({ role: row?.role ?? 'suspended' })
}

/**
 * The authorization request the current auth endpoint is handling, as its PKCE challenge: from the request's query
 * (authorize, and the continuation after the team picker) or from the signed query the consent screen sends back.
 * Better Auth verifies that signature before it asks for the consent's reference.
 */
function currentAuthorization(): string | undefined {
  const ctx = tryGetCurrentAuthEndpointContext() as { query?: Record<string, unknown>; body?: Record<string, unknown> } | undefined
  const fromQuery = ctx?.query?.code_challenge
  if (isAuthorizationKey(fromQuery)) return fromQuery
  const signed = ctx?.body?.oauth_query
  const fromBody = typeof signed === 'string' ? new URLSearchParams(signed).get('code_challenge') : undefined
  return isAuthorizationKey(fromBody) ? fromBody : undefined
}

/** The client of the authorization request the current auth endpoint is handling, read as currentAuthorization does. */
function currentClientId(): string | undefined {
  const ctx = tryGetCurrentAuthEndpointContext() as { query?: Record<string, unknown>; body?: Record<string, unknown> } | undefined
  if (typeof ctx?.query?.client_id === 'string') return ctx.query.client_id
  const signed = ctx?.body?.oauth_query
  return typeof signed === 'string' ? new URLSearchParams(signed).get('client_id') ?? undefined : undefined
}

const noTeam = () =>
  new APIError('BAD_REQUEST', { error: 'access_denied', error_description: 'choose the team this connection is for' })

/** How long a signing key signs before a new one takes over: 30 days. */
export const SIGNING_KEY_ROTATION_SECONDS = 30 * 24 * 60 * 60

export function mcpOAuthPlugins() {
  if (!isMcpOAuthEnabled()) return []
  // Accepted is wider than active on purpose (see mcpOAuthAcceptedScopes): a scope whose tool was retired is
  // still accepted, so a client that kept an older list and a connection that holds it are not cut off.
  const acceptedScopes = [...OIDC_SCOPES, ...mcpOAuthAcceptedScopes()]
  const activeScopes = [...OIDC_SCOPES, ...mcpOAuthResourceScopes()]
  return [
    // No `set-auth-jwt` header on session responses: the key signs OAuth access tokens only.
    // The signing key is replaced every SIGNING_KEY_ROTATION_SECONDS: a key that leaked stops being of use, and
    // nothing has to be done by hand. The key it replaces stays published for Better Auth's grace period (30
    // days), far longer than the ten minutes a token it signed can live, so no token fails over a rotation.
    jwt({ disableSettingJwtHeader: true, jwks: { rotationInterval: SIGNING_KEY_ROTATION_SECONDS } }),
    mcp({
      resource: mcpResourceUrl(),
      loginPage: withBasePath('/login'),
      consentPage: withBasePath('/oauth/consent'),
      scopes: acceptedScopes,
      // What is published is the active list: `scopes_supported` of the authorization server metadata and, without
      // the identity scopes, of the protected resource metadata. It does not change what the server accepts.
      advertisedMetadata: { scopes_supported: activeScopes },
      // What is issued is the active list too: a token for the resource carries only active scopes, whatever the
      // request or the refresh token it renews holds, so a connection from before a scope was retired loses it at
      // its next renewal without being refused. The identity scopes are in the list: without `offline_access`
      // there would be no refresh token.
      resources: [{ identifier: mcpResourceUrl(), name: 'MCP', allowedScopes: activeScopes }],
      // The row of the resource is brought to this configuration each time the server starts. The provider's
      // default only inserts a missing row: a database that already has the row (every app that ran sign-in before
      // this list existed, and every later change of the tools) would keep its old policy and the cut would never
      // apply. `merge` updates the fields named here and nothing else.
      //
      // Except from a process that could not read the registries the list comes from (`nextspark worker`, see
      // mcpToolScopesKnown): its list is empty, and written over the row it would strip every token the app issues
      // of its permissions until an instance of the app started again. There the row is only inserted when it is
      // missing, as the provider does by default, and the app brings it to its own list when it starts.
      resourceSeedMode: mcpToolScopesKnown() ? 'merge' : 'insertOnly',
      // A token for /api/mcp is always a user's in a team: no client_credentials
      grantTypes: ['authorization_code', 'refresh_token'],
      accessTokenExpiresIn: 600,
      postLogin: {
        page: withBasePath('/oauth/select-team'),
        // After sign-in and before consent: a user in several teams picks the one to connect. Every authorization
        // asks, since the choice is kept for that authorization alone.
        shouldRedirect: async ({ user, session }) => {
          await refuseSuspendedNow(user.id)
          const authorization = currentAuthorization()
          if (!authorization) throw noTeam()
          const teams = await selectableTeams(user.id)
          if (teams.length === 0) throw noTeam()
          if (teams.length === 1) {
            await selectTeam(session.id, authorization, user.id, teams[0].id)
            return false
          }
          return !(await selectedTeam(session.id, authorization, user.id))
        },
        consentReferenceId: async ({ user, session }) => {
          await refuseSuspendedNow(user.id)
          // Asked for by every authorization before a code is issued, with or without a consent screen
          refuseUnlistedClient(currentClientId())
          await refuseConsentSkippingClient(currentClientId())
          const teamId = await selectedTeam(session.id, currentAuthorization(), user.id)
          if (!teamId) throw noTeam()
          return teamId
        },
      },
      customAccessTokenClaims: async ({ user, referenceId }) => {
        // Every token, refreshed ones included, is issued through here: none for a suspended account
        if (user) refuseSuspended(user, 'invalid_grant')
        if (!user || !referenceId) return {}
        // Housekeeping rides on token issuance: at most once an hour per process, and it never fails the token
        await purgeExpiredOAuthIfDue()
        return { [TEAM_CLAIM]: referenceId, [REVOCATION_CLAIM]: await latestRevocation(user.id) }
      },
    }),
    cimd({
      fetchClientMetadataResource,
      metadataProfile: 'mcp-2026-07-28',
      // The project's list of accepted applications, before the document of one that is not on it is fetched
      isMetadataDocumentUrlAllowed: clientIdUrl => isClientAllowed(clientIdUrl, allowedClientHosts()),
    }),
    // A consent grants what the client asked for, the user accepted and the role can hold: decided here, not in the page
    consentWithinRolePlugin(),
  ]
}
