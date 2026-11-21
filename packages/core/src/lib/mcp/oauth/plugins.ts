/**
 * The Better Auth plugins that make the app an OAuth 2.1 authorization server for its own MCP endpoint (#541):
 * `jwt()` signs the access tokens, `mcp()` is the OAuth provider bound to the MCP resource, and `cimd()` lets a
 * client identify itself with a Client ID Metadata Document, which is how Claude and ChatGPT register.
 *
 * Returns no plugin while `MCP_OAUTH_ENABLED` is off, so nothing is mounted and no table is touched.
 *
 * Spike scope: the team is the user's default team, written on the consent as its reference and copied into the
 * token as `team_id`. A team picker (`postLogin.page`) replaces `defaultTeamFor` without changing the token.
 */
import { jwt } from 'better-auth/plugins'
import { cimd } from '@better-auth/cimd'
import { fetchClientMetadataResource } from '@better-auth/cimd/node'
import { mcp } from '@better-auth/mcp'
import { withBasePath } from '../../base-path'
import { ScopeService } from '../../services/scope.service'
import { getUserDefaultTeamId } from '../../teams/dashboard-team'
import { isMcpOAuthEnabled, mcpResourceUrl, OIDC_SCOPES, TEAM_CLAIM } from './config'

/** Every scope a team role can hold: the vocabulary API keys already use. Wildcards are never offered. */
export function mcpOAuthResourceScopes(): string[] {
  const scopes = new Set<string>(ScopeService.getBaseScopes())
  for (const role of ScopeService.getRoles()) {
    for (const scope of ScopeService.getRoleScopes(role)) scopes.add(scope)
  }
  return [...scopes].filter(scope => !scope.includes('*')).sort()
}

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
        page: withBasePath('/oauth/consent'),
        // No picker yet: nothing to select, the reference below fixes the team.
        shouldRedirect: () => false,
        consentReferenceId: async ({ user }) => {
          const teamId = await getUserDefaultTeamId(user.id)
          if (!teamId) throw new Error('MCP sign-in needs a team and this account has none')
          return teamId
        },
      },
      customAccessTokenClaims: ({ referenceId }) => (referenceId ? { [TEAM_CLAIM]: referenceId } : {}),
    }),
    cimd({ fetchClientMetadataResource, metadataProfile: 'mcp-2026-07-28' }),
  ]
}
