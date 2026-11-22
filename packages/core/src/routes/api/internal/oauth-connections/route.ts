/**
 * The applications connected by MCP browser sign-in (#541), for the signed-in user. GET: the user's own
 * connections and, as `managed`, other members' connections to the teams whose integrations the user manages (the
 * team permission MANAGE_CONNECTIONS). DELETE ends one, named by its client and team: the user's own, or with
 * `userId` another member's in such a team. Session only: it is the app's own settings screen. 404 while MCP_OAUTH_ENABLED is off.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createApiError, readJsonObject } from '@nextsparkjs/core/lib/api/error-response'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { corsPreflight } from '@nextsparkjs/core/lib/api/cors-response'
import { getAuthorizationSession } from '@nextsparkjs/core/lib/auth/authorization-session'
import { isMcpOAuthEnabled } from '@nextsparkjs/core/lib/mcp/oauth/config'
import { disconnect, disconnectManaged, managedConnections, userConnections } from '@nextsparkjs/core/lib/mcp/oauth/connections'

const notFound = () => createApiError('Not found', 404, undefined, 'NOT_FOUND')
const signedOut = () => createApiError('Authentication required', 401, undefined, 'AUTHENTICATION_FAILED')

export const GET = withRateLimitTier(async (request: NextRequest) => {
  if (!isMcpOAuthEnabled()) return notFound()
  const session = await getAuthorizationSession(request.headers)
  if (!session) return signedOut()
  const [data, managed] = await Promise.all([userConnections(session.user.id), managedConnections(session.user.id, session.user.role)])
  return NextResponse.json({ success: true, data, managed })
}, 'read')

export const DELETE = withRateLimitTier(async (request: NextRequest) => {
  if (!isMcpOAuthEnabled()) return notFound()
  const session = await getAuthorizationSession(request.headers)
  if (!session) return signedOut()
  const parsed = await readJsonObject(request)
  if (parsed.error) return parsed.error
  const { clientId, teamId, userId } = parsed.data
  if (typeof clientId !== 'string' || !clientId || typeof teamId !== 'string' || !teamId) {
    return createApiError('clientId and teamId are required', 400, undefined, 'VALIDATION_ERROR')
  }
  if (userId !== undefined && (typeof userId !== 'string' || !userId)) {
    return createApiError('userId must be a user id', 400, undefined, 'VALIDATION_ERROR')
  }
  const target = typeof userId === 'string' ? userId : session.user.id
  // Another member's connection: only for who manages the integrations of the team it reaches, checked where the
  // connection is ended. The answer for a team the user does not manage is the one for a connection that is not there.
  const ended = target === session.user.id
    ? await disconnect(target, clientId, teamId)
    : await disconnectManaged(session.user.id, session.user.role, target, clientId, teamId)
  if (!ended) return notFound()
  return NextResponse.json({ success: true })
}, 'write')

export const OPTIONS = corsPreflight
