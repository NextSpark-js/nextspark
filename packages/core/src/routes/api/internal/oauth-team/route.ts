/**
 * The team picker of an MCP authorization (#541): GET lists the teams the signed-in user can connect and the one
 * chosen for an authorization, POST records the one chosen for it. The authorization is named by its PKCE
 * challenge, which the page has in its URL. Session only: it is a step of the
 * sign-in the user makes in the browser. 404 while MCP_OAUTH_ENABLED is off.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createApiError, readJsonObject } from '@nextsparkjs/core/lib/api/error-response'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { corsPreflight } from '@nextsparkjs/core/lib/api/cors-response'
import { getAuthorizationSession } from '@nextsparkjs/core/lib/auth/authorization-session'
import { validateScopesForUser } from '@nextsparkjs/core/lib/api/auth'
import { isMcpOAuthEnabled } from '@nextsparkjs/core/lib/mcp/oauth/config'
import { grantedScopes } from '@nextsparkjs/core/lib/mcp/oauth/connection-store'
import { mcpOAuthResourceScopes } from '@nextsparkjs/core/lib/mcp/oauth/scopes'
import { isAuthorizationKey, selectableTeams, selectedTeam, selectTeam } from '@nextsparkjs/core/lib/mcp/oauth/team-selection'

const notFound = () => createApiError('Not found', 404, undefined, 'NOT_FOUND')
const signedOut = () => createApiError('Authentication required', 401, undefined, 'AUTHENTICATION_FAILED')

export const GET = withRateLimitTier(async (request: NextRequest) => {
  if (!isMcpOAuthEnabled()) return notFound()
  const session = await getAuthorizationSession(request.headers)
  if (!session) return signedOut()
  // `selected`: the team chosen for the authorization the page is part of (?authorization=<its PKCE challenge>)
  const authorization = request.nextUrl.searchParams.get('authorization') ?? undefined
  const [teams, selected] = await Promise.all([selectableTeams(session.user.id), selectedTeam(session.session.id, authorization, session.user.id)])
  // `allowed`: of the resource's scopes, the ones the user's role in that team can hold. The consent screen offers
  // only those; the server cuts a token down to them on every request whatever was granted.
  const allowed = selected ? (await validateScopesForUser(session.user.id, selected, mcpOAuthResourceScopes())).allowedScopes : []
  // `granted`: what this application already holds in that team (?client_id=), null when it is not connected to it.
  // The consent screen ticks that when the application connects again, so that accepting takes nothing away.
  const clientId = request.nextUrl.searchParams.get('client_id')
  const granted = selected && clientId ? await grantedScopes(session.user.id, clientId, selected) : null
  // `offered`: the active scopes, whatever the role. The screen shows a permission the role cannot hold as
  // disabled, and does not show at all one the application asked for that no tool needs any more.
  return NextResponse.json({ success: true, data: teams, selected: selected ?? null, allowed, offered: mcpOAuthResourceScopes(), granted })
}, 'read')

export const POST = withRateLimitTier(async (request: NextRequest) => {
  if (!isMcpOAuthEnabled()) return notFound()
  const session = await getAuthorizationSession(request.headers)
  if (!session) return signedOut()
  const parsed = await readJsonObject(request)
  if (parsed.error) return parsed.error
  const teamId = parsed.data.teamId
  if (typeof teamId !== 'string' || !teamId) return createApiError('teamId is required', 400, undefined, 'VALIDATION_ERROR')
  const authorization = parsed.data.authorization
  if (typeof authorization !== 'string' || !isAuthorizationKey(authorization)) {
    return createApiError('authorization is required', 400, undefined, 'VALIDATION_ERROR')
  }
  const choice = await selectTeam(session.session.id, authorization, session.user.id, teamId)
  if (choice === 'not-a-member') return createApiError('You are not a member of that team', 403, undefined, 'NOT_A_MEMBER')
  // the first choice stands (lib/mcp/oauth/team-selection): the connection is started again from the application
  if (choice === 'already-chosen') return createApiError('Another team was already chosen for this connection', 409, undefined, 'TEAM_ALREADY_CHOSEN')
  return NextResponse.json({ success: true })
}, 'write')

export const OPTIONS = corsPreflight
