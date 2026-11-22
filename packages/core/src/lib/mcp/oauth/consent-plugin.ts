/**
 * What a consent may grant, decided on the server (#541). The consent screen sends the permissions the user left
 * ticked; this is where they are held to what the client asked for and to what the user's role in the team can
 * hold, whatever the browser sent. Without it a request written by hand to `/oauth2/consent` could put a scope the
 * role does not have into the grant: the resource server would still refuse to act on it (it cuts a token down to
 * the role on every request), but the grant, the token and the list of connected applications would name a
 * permission the user never had.
 */
import type { BetterAuthPlugin } from 'better-auth'
import { createAuthMiddleware, getSessionFromCtx } from 'better-auth/api'
import { validateScopesForUser } from '../../api/auth'
import { entityScope } from './scope-names'
import { isAuthorizationKey, selectedTeam } from './team-selection'

/**
 * The scopes a consent grants: of the ones the client asked for, the ones accepted (all of them when the consent
 * names none), and of those that are entity permissions only the ones the role can hold. A scope that is not an
 * entity permission (`offline_access`, the identity scopes) is not the role's to limit.
 */
export function consentedScopes(requested: readonly string[], accepted: readonly string[] | undefined, heldByRole: readonly string[]): string[] {
  return requested.filter(scope => (!accepted || accepted.includes(scope)) && (!entityScope(scope) || heldByRole.includes(scope)))
}

const scopeList = (value: unknown): string[] | undefined =>
  typeof value === 'string' ? value.split(/\s+/).filter(Boolean) : undefined

export const consentWithinRolePlugin = (): BetterAuthPlugin => ({
  id: 'mcp-consent-within-role',
  hooks: {
    before: [
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
          const entityScopes = requested.filter(scope => entityScope(scope))
          const heldByRole = session && teamId && entityScopes.length ? (await validateScopesForUser(session.user.id, teamId, entityScopes)).allowedScopes : []
          const scope = consentedScopes(requested, scopeList(body.scope), heldByRole).join(' ')
          return { context: { body: { ...body, scope } } }
        }),
      },
    ],
  },
})
