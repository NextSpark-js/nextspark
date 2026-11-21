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
import { ScopeService } from '../../services/scope.service'
import { APIError } from 'better-auth'
import { isSuspendedRole } from '../../auth/suspension'
import { clearTeamSelection, selectableTeams, selectedTeam, selectTeam } from './team-selection'
import { isMcpOAuthEnabled, mcpResourceUrl, OIDC_SCOPES, REVOCATION_CLAIM, TEAM_CLAIM } from './config'
import { latestRevocation } from './revocation'

/** Every scope a team role can hold: the vocabulary API keys already use. Wildcards are never offered. */
export function mcpOAuthResourceScopes(): string[] {
  const scopes = new Set<string>(ScopeService.getBaseScopes())
  for (const role of ScopeService.getRoles()) {
    for (const scope of ScopeService.getRoleScopes(role)) scopes.add(scope)
  }
  return [...scopes].filter(scope => !scope.includes('*')).sort()
}

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

const noTeam = () =>
  new APIError('BAD_REQUEST', { error: 'access_denied', error_description: 'choose the team this connection is for' })

export function mcpOAuthPlugins() {
  if (!isMcpOAuthEnabled()) return []
  const resourceScopes = mcpOAuthResourceScopes()
  return [
    // No `set-auth-jwt` header on session responses: the key signs OAuth access tokens only.
    jwt({ disableSettingJwtHeader: true }),
    mcp({
      resource: mcpResourceUrl(),
      loginPage: withBasePath('/login'),
      consentPage: withBasePath('/oauth/consent'),
      scopes: [...OIDC_SCOPES, ...resourceScopes],
      // A token for /api/mcp is always a user's in a team: no client_credentials
      grantTypes: ['authorization_code', 'refresh_token'],
      accessTokenExpiresIn: 600,
      postLogin: {
        page: withBasePath('/oauth/select-team'),
        // After sign-in and before consent: a user in several teams picks the one to connect. A new authorization
        // always asks again; the continuation of the picker goes on once a team is chosen.
        shouldRedirect: async ({ user, session, isContinuation }) => {
          await refuseSuspendedNow(user.id)
          const teams = await selectableTeams(user.id)
          if (teams.length === 0) throw noTeam()
          if (teams.length === 1) {
            await selectTeam(session.id, user.id, teams[0].id)
            return false
          }
          if (isContinuation && (await selectedTeam(session.id, user.id))) return false
          await clearTeamSelection(session.id)
          return true
        },
        consentReferenceId: async ({ user, session }) => {
          await refuseSuspendedNow(user.id)
          const teamId = await selectedTeam(session.id, user.id)
          if (!teamId) throw noTeam()
          return teamId
        },
      },
      customAccessTokenClaims: async ({ user, referenceId }) => {
        // Every token, refreshed ones included, is issued through here: none for a suspended account
        if (user) refuseSuspended(user, 'invalid_grant')
        if (!user || !referenceId) return {}
        return { [TEAM_CLAIM]: referenceId, [REVOCATION_CLAIM]: await latestRevocation(user.id, referenceId) }
      },
    }),
    cimd({ fetchClientMetadataResource, metadataProfile: 'mcp-2026-07-28' }),
  ]
}
