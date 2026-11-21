/**
 * `/api/mcp` as an OAuth resource server (#541).
 *
 * Better Auth's `requireMcpAuth` verifies the access token against the authorization server's keys in process:
 * signature, issuer, audience (the MCP resource, exactly) and expiry. A request with no token, or with a token that
 * fails, gets its 401 with the RFC 9728 `WWW-Authenticate` challenge. A verified token becomes a principal here:
 * the user it names, the team the grant is bound to, and the scopes the user may hold in that team today. The token
 * itself goes no further: tools receive the principal, not a credential.
 *
 * Two checks the signature cannot make are made on every request:
 * - the connection was not ended since the token was issued (lib/mcp/oauth/revocation): an access token lives ten
 *   minutes, a revocation must not wait for that.
 * - the token was granted what the call needs. A call to a tool whose scope was never granted (an entity tool, or
 *   another tool that declares `meta.requiredScopes`) is answered
 *   403 with an RFC 6750 `insufficient_scope` challenge naming it, before anything runs, so the client can ask the
 *   user for more. A scope that was granted and the user's role no longer allows is refused by the tool instead:
 *   asking again would not help.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireMcpAuth } from '@better-auth/mcp'
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js'
import { auth } from '../../auth'
import { isSuspendedRole } from '../../auth/suspension'
import { queryOne } from '../../db'
import { validateScopesForUser } from '../../api/auth'
import { apiKeyRateLimitResponse } from '../../api/rate-limit'
import type { DualAuthResult } from '../../api/auth/dual-auth'
import { oauthRateLimitKey } from '../../api/auth/in-process-principal'
import { TeamService } from '../../services/team.service'
import { TeamMemberService } from '../../services/team-member.service'
import { RATE_LIMIT_MESSAGE } from '../errors'
import type { ToolExecutionContext } from '../types'
import { mcpOAuthIssuer, mcpResourceMetadataUrl, mcpResourceUrl, OIDC_SCOPES, REVOCATION_CLAIM, TEAM_CLAIM } from './config'
import { isRevokedSince } from './revocation'

type McpDispatch = (body: unknown, ctx: ToolExecutionContext) => Promise<JSONRPCMessage | JSONRPCMessage[] | null>

export interface OAuthMcpHandlers {
  dispatch: McpDispatch
  /** The scopes a call to a tool needs before it runs; none for a tool that declares none. */
  requiredScopesFor: (toolName: string) => string[]
}

const API_KEY_BEARER = /^Bearer\s+sk_(live|test)_/i

/** The request presents an API key: `x-api-key`, or a bearer in the key format. */
export function presentsApiKey(request: Request): boolean {
  // An empty x-api-key (a proxy that always sets the header) is not a credential
  return !!request.headers.get('x-api-key')?.trim() || API_KEY_BEARER.test(request.headers.get('authorization') ?? '')
}

/** The request presents a bearer that is not an API key. */
export function presentsOAuthBearer(request: Request): boolean {
  const header = request.headers.get('authorization') ?? ''
  return /^Bearer\s+\S/i.test(header) && !API_KEY_BEARER.test(header)
}

function jsonRpcError(status: number, code: number, message: string): NextResponse {
  return NextResponse.json({ jsonrpc: '2.0', error: { code, message }, id: null }, { status })
}

const claimString = (value: unknown): string | undefined => (typeof value === 'string' && value ? value : undefined)

/**
 * The principal of a verified access token, or the response that refuses it. Everything is read again on each
 * request, so a suspension, a removal from the team or a role change counts on the next call.
 */
async function principalFromClaims(
  claims: Record<string, unknown>
): Promise<{ principal: DualAuthResult; teamId: string; granted: string[] } | NextResponse> {
  const userId = claimString(claims.sub)
  const teamId = claimString(claims[TEAM_CLAIM])
  const clientId = claimString(claims.azp) ?? claimString(claims.client_id)
  if (!userId || !clientId) return jsonRpcError(401, -32001, 'The access token names no user or no client.')
  if (!teamId) return jsonRpcError(403, -32002, 'The access token is not bound to a team. Connect again.')

  const user = await queryOne<{ email: string; role: string; name: string }>(
    'SELECT email, role, name FROM "users" WHERE id = $1',
    [userId]
  )
  if (!user || isSuspendedRole(user.role)) return jsonRpcError(401, -32001, 'The account of this access token is not active.')

  const team = await TeamService.getById(teamId)
  if (!team || team.deletedAt || !(await TeamMemberService.isMember(teamId, userId))) {
    return jsonRpcError(403, -32002, 'The account is no longer a member of the team this connection was approved for.')
  }

  if (await isRevokedSince(userId, clientId, teamId, claims[REVOCATION_CLAIM])) {
    return jsonRpcError(401, -32001, 'This connection was revoked. Connect again.')
  }

  const granted = (claimString(claims.scope) ?? '')
    .split(/\s+/)
    .filter(scope => scope && !(OIDC_SCOPES as readonly string[]).includes(scope) && !scope.includes('*'))
  // Granted at consent, cut down to what the user's role in the team allows now
  const { allowedScopes } = await validateScopesForUser(userId, teamId, granted)

  return {
    teamId,
    granted,
    principal: {
      success: true,
      type: 'api-key',
      oauth: { clientId, tokenId: claimString(claims.jti) },
      user: { id: userId, email: user.email, role: user.role || 'user', name: user.name, defaultTeamId: teamId },
      scopes: allowedScopes,
    },
  }
}

/**
 * The scopes the calls in a JSON-RPC body need and the token was never granted. Only well-formed calls count: a
 * message that is not JSON-RPC is the engine's to refuse as an invalid request.
 */
function missingScopes(body: unknown, granted: readonly string[], requiredScopesFor: OAuthMcpHandlers['requiredScopesFor']): string[] {
  const missing = new Set<string>()
  for (const message of Array.isArray(body) ? body : [body]) {
    const call = message as { jsonrpc?: unknown; method?: unknown; params?: { name?: unknown } } | null
    if (call?.jsonrpc !== '2.0' || call.method !== 'tools/call' || typeof call.params?.name !== 'string') continue
    for (const scope of requiredScopesFor(call.params.name)) {
      if (!granted.includes(scope)) missing.add(scope)
    }
  }
  return [...missing].sort()
}

function insufficientScope(scopes: string[]): NextResponse {
  const response = jsonRpcError(403, -32003, `This connection was not granted: ${scopes.join(', ')}.`)
  // RFC 6750 section 3.1, with the RFC 9728 pointer a client needs to start the new authorization
  response.headers.set(
    'WWW-Authenticate',
    `Bearer error="insufficient_scope", scope="${scopes.join(' ')}", resource_metadata="${mcpResourceMetadataUrl()}"`
  )
  response.headers.set('Access-Control-Expose-Headers', 'WWW-Authenticate')
  return response
}

export async function handleOAuthMcpRequest(request: NextRequest, { dispatch, requiredScopesFor }: OAuthMcpHandlers): Promise<NextResponse> {
  const protectedHandler = requireMcpAuth(
    auth,
    async (_request, claims) => {
      const resolved = await principalFromClaims(claims as Record<string, unknown>)
      if (resolved instanceof NextResponse) return resolved
      const { principal, teamId, granted } = resolved

      // The per-credential limit API keys have, for this client and user: counted here for the MCP request and,
      // as for a key, once more by each API handler a tool calls (authenticateRequest)
      const limited = apiKeyRateLimitResponse(request, {
        userId: principal.user!.id,
        keyId: oauthRateLimitKey(principal),
        scopes: principal.scopes ?? [],
      })
      if (limited) {
        const response = jsonRpcError(429, -32000, RATE_LIMIT_MESSAGE)
        const retryAfter = limited.headers.get('Retry-After')
        if (retryAfter) response.headers.set('Retry-After', retryAfter)
        return response
      }

      let body: unknown
      try {
        body = await request.json()
      } catch {
        return jsonRpcError(400, -32700, 'Parse error: body must be JSON-RPC')
      }

      // Before anything runs: one missing scope refuses the whole body, a batch included, so nothing is half done
      const missing = missingScopes(body, granted, requiredScopesFor)
      if (missing.length) return insufficientScope(missing)

      const ctx: ToolExecutionContext = {
        userId: principal.user!.id,
        userRole: principal.user!.role,
        teamId,
        authHeader: '',
        apiKeyId: null,
        scopes: principal.scopes ?? [],
        principal,
      }

      try {
        const result = await dispatch(body, ctx)
        if (result === null) return new NextResponse(null, { status: 202 })
        return NextResponse.json(result, { status: 200 })
      } catch (error) {
        console.error('[mcp] request failed:', error)
        return jsonRpcError(500, -32603, 'Internal error processing MCP request')
      }
    },
    { resource: mcpResourceUrl(), issuer: mcpOAuthIssuer() }
  )

  const response = await protectedHandler(request)
  return response instanceof NextResponse ? response : new NextResponse(response.body, response)
}
