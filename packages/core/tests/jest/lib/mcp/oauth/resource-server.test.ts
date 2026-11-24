/**
 * `/api/mcp` as an OAuth resource server (#541): what a verified access token becomes, and everything that refuses
 * it. Better Auth verifies the signature, the issuer, the audience and the expiry (`requireMcpAuth`, replaced here
 * by a stand-in that hands the claims over); every check below is the project's own and is made on each request.
 */
import { NextRequest, NextResponse } from 'next/server'

const claims: { current: Record<string, unknown> } = { current: {} }
const verifierOptions: { current?: Record<string, unknown> } = {}
const unverified: { current?: NextResponse } = {}
// Jest maps the OAuth packages of Better Auth to one mock file (jest.config), so one factory answers for all
jest.mock('@better-auth/mcp', () => ({
  requireMcpAuth: (_auth: unknown, handler: (request: Request, claims: Record<string, unknown>) => Promise<Response>, options: Record<string, unknown>) => {
    verifierOptions.current = options
    return async (request: Request) => unverified.current ?? handler(request, claims.current)
  },
}))
jest.mock('@/core/lib/auth', () => ({ auth: {} }))
jest.mock('@/core/lib/auth/suspension', () => ({ isSuspendedRole: (role: string) => role === 'suspended' }))
jest.mock('@/core/lib/base-path', () => ({ withBasePathRequest: (request: unknown) => request }))

const user = jest.fn()
const consent = jest.fn()
jest.mock('@/core/lib/db', () => ({
  queryOne: (sql: string, params: unknown[]) => (/FROM "users"/.test(sql) ? user(params) : consent(params)),
}))
const roleScopes: { current: string[] } = { current: [] }
jest.mock('@/core/lib/api/auth', () => ({
  validateScopesForUser: async (_userId: string, _teamId: string, scopes: string[]) => ({
    allowedScopes: scopes.filter(scope => roleScopes.current.includes(scope)),
  }),
}))
const limit = jest.fn()
jest.mock('@/core/lib/api/rate-limit', () => ({ credentialRateLimitResponse: (...args: unknown[]) => limit(...args) }))
const team = jest.fn()
const isMember = jest.fn()
jest.mock('@/core/lib/services/team.service', () => ({ TeamService: { getById: (id: string) => team(id) } }))
jest.mock('@/core/lib/services/team-member.service', () => ({ TeamMemberService: { isMember: (teamId: string, userId: string) => isMember(teamId, userId) } }))
const allowed = jest.fn()
jest.mock('@/core/lib/mcp/oauth/allowed-clients', () => ({ isClientAllowed: (clientId: string) => allowed(clientId) }))
const metadataUrl = { current: 'https://app.example.com/.well-known/oauth-protected-resource/api/mcp' }
jest.mock('@/core/lib/mcp/oauth/config', () => ({
  allowedClientHosts: () => undefined,
  mcpOAuthIssuer: () => 'https://app.example.com/api/auth',
  mcpResourceMetadataUrl: () => metadataUrl.current,
  mcpResourceUrl: () => 'https://app.example.com/api/mcp',
  OIDC_SCOPES: ['openid', 'profile', 'email', 'offline_access'],
  REVOCATION_CLAIM: 'rev',
  TEAM_CLAIM: 'team',
}))
const revoked = jest.fn()
jest.mock('@/core/lib/mcp/oauth/revocation', () => ({ isRevokedSince: (...args: unknown[]) => revoked(...args) }))
const gateRefuses = jest.fn<Promise<boolean>, []>()
jest.mock('@/core/lib/mcp/oauth/production-gate', () => ({
  NOT_AVAILABLE: 'MCP browser sign-in is not available on this server.',
  mcpOAuthRefusedByGate: () => gateRefuses(),
}))
jest.mock('@/core/lib/mcp/oauth/scopes', () => ({
  mcpOAuthDefaultScopes: (toolScopes?: readonly string[]) => ['offline_access', ...(toolScopes ?? ['tasks:read'])],
  mcpOAuthStepUpScopes: (granted: string[], missing: string[]) => ['offline_access', ...granted, ...missing],
}))

import { handleOAuthMcpRequest, MAX_BATCH_MESSAGES } from '@/core/lib/mcp/oauth/resource-server'
import { RATE_LIMIT_MESSAGE } from '@/core/lib/mcp/errors'
import type { ToolExecutionContext } from '@/core/lib/mcp/types'

const CLIENT = 'https://client.example/metadata.json'
const SCOPES: Record<string, string[]> = {
  app_list_tasks: ['tasks:read'],
  app_create_task: ['tasks:write'],
  app_delete_task: ['tasks:delete'],
  app_ping: [],
}
const call = (name: string, id = 1) => ({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: {} } })

const dispatch = jest.fn()
const auditRefused = jest.fn()
const handlers = {
  dispatch: (body: unknown, ctx: ToolExecutionContext) => dispatch(body, ctx),
  requiredScopesFor: (name: string) => SCOPES[name] ?? [],
  auditRefused: (...args: unknown[]) => auditRefused(...args),
}

function post(body: unknown, raw = false) {
  return handleOAuthMcpRequest(
    new NextRequest('https://app.example.com/api/mcp', {
      method: 'POST',
      headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
      body: raw ? (body as string) : JSON.stringify(body),
    }),
    handlers
  )
}
const errorOf = async (response: Response) => (await response.json()).error as { code: number; message: string }

beforeEach(() => {
  jest.clearAllMocks()
  unverified.current = undefined
  metadataUrl.current = 'https://app.example.com/.well-known/oauth-protected-resource/api/mcp'
  claims.current = {
    sub: 'user-1',
    azp: CLIENT,
    team: 'team-1',
    rev: 7,
    jti: 'jti-1',
    scope: 'openid offline_access tasks:read tasks:write tasks:delete customers:* pages:read',
  }
  allowed.mockReturnValue(true)
  user.mockResolvedValue({ email: 'ana@example.com', role: 'member', name: 'Ana' })
  team.mockResolvedValue({ id: 'team-1', deletedAt: null })
  isMember.mockResolvedValue(true)
  revoked.mockResolvedValue(false)
  gateRefuses.mockResolvedValue(false)
  // the consent no longer has tasks:delete (the user took it away) and never had pages:read
  consent.mockResolvedValue({ scopes: ['openid', 'offline_access', 'tasks:read', 'tasks:write', 'customers:*'] })
  // and the role can read tasks, no longer write them
  roleScopes.current = ['tasks:read']
  limit.mockResolvedValue(null)
  dispatch.mockResolvedValue({ jsonrpc: '2.0', id: 1, result: { ok: true } })
})

describe('the production gate (#541)', () => {
  it('refuses every OAuth request before the token is looked at, with no challenge to follow', async () => {
    gateRefuses.mockResolvedValue(true)
    const response = await post(call('app_list_tasks'))
    expect(response.status).toBe(503)
    expect((await errorOf(response)).message).toBe('MCP browser sign-in is not available on this server.')
    expect(response.headers.get('WWW-Authenticate')).toBeFalsy()
    expect(user).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalled()
  })
})

describe('a verified access token is refused (#541)', () => {
  it('when it names no user or no client', async () => {
    claims.current = { ...claims.current, sub: undefined }
    expect((await post(call('app_list_tasks'))).status).toBe(401)
    claims.current = { sub: 'user-1', team: 'team-1', scope: 'tasks:read' }
    expect((await post(call('app_list_tasks'))).status).toBe(401)
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('when it is bound to no team', async () => {
    claims.current = { ...claims.current, team: undefined }
    const response = await post(call('app_list_tasks'))
    expect(response.status).toBe(403)
    expect((await errorOf(response)).message).toMatch(/not bound to a team/)
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('when its application is no longer among the accepted ones, before anything is read', async () => {
    allowed.mockReturnValue(false)
    const response = await post(call('app_list_tasks'))
    expect(response.status).toBe(403)
    expect(allowed).toHaveBeenCalledWith(CLIENT)
    expect(user).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('when the account is gone or suspended', async () => {
    user.mockResolvedValueOnce(null)
    expect((await post(call('app_list_tasks'))).status).toBe(401)
    user.mockResolvedValueOnce({ email: 'ana@example.com', role: 'suspended', name: 'Ana' })
    expect((await post(call('app_list_tasks'))).status).toBe(401)
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('when the team is gone, deleted, or the user is no longer a member of it', async () => {
    team.mockResolvedValueOnce(null)
    expect((await post(call('app_list_tasks'))).status).toBe(403)
    team.mockResolvedValueOnce({ id: 'team-1', deletedAt: new Date() })
    expect((await post(call('app_list_tasks'))).status).toBe(403)
    isMember.mockResolvedValueOnce(false)
    const response = await post(call('app_list_tasks'))
    expect(response.status).toBe(403)
    expect((await errorOf(response)).message).toMatch(/no longer a member/)
    expect(isMember).toHaveBeenCalledWith('team-1', 'user-1')
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('when its connection was revoked after it was issued', async () => {
    revoked.mockResolvedValueOnce(true)
    const response = await post(call('app_list_tasks'))
    expect(response.status).toBe(401)
    expect(revoked).toHaveBeenCalledWith('user-1', CLIENT, 'team-1', 7)
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('when the connection has no consent left, whatever the token holds', async () => {
    consent.mockResolvedValueOnce(null)
    const response = await post(call('app_list_tasks'))
    expect(response.status).toBe(401)
    expect(consent).toHaveBeenCalledWith(['user-1', CLIENT, 'team-1'])
    expect((await errorOf(response)).message).toMatch(/was ended/)
    expect(dispatch).not.toHaveBeenCalled()
  })
})

describe('what a verified access token may do (#541)', () => {
  it('is what the token holds, the consent still has and the role allows now', async () => {
    const response = await post(call('app_list_tasks'))
    expect(response.status).toBe(200)
    const ctx = dispatch.mock.calls[0][1] as ToolExecutionContext
    // tasks:write: in the token and the consent, not in the role any more. tasks:delete: taken out of the consent.
    // pages:read: never consented. customers:*: a wildcard. openid, offline_access: not MCP permissions.
    expect(ctx.scopes).toEqual(['tasks:read'])
    expect(ctx.principal).toMatchObject({
      success: true,
      type: 'api-key',
      scopes: ['tasks:read'],
      oauth: { clientId: CLIENT, tokenId: 'jti-1', teamId: 'team-1' },
      user: { id: 'user-1', email: 'ana@example.com', role: 'member', defaultTeamId: 'team-1' },
    })
  })

  it('reaches the tools as a principal for its team, with no credential to pass on', async () => {
    await post(call('app_list_tasks'))
    const ctx = dispatch.mock.calls[0][1] as ToolExecutionContext
    expect(ctx).toMatchObject({ userId: 'user-1', userRole: 'member', teamId: 'team-1', authHeader: '', apiKeyId: null })
  })

  it('a client named only by client_id is read the same way', async () => {
    claims.current = { ...claims.current, azp: undefined, client_id: CLIENT }
    expect((await post(call('app_list_tasks'))).status).toBe(200)
    expect(consent).toHaveBeenCalledWith(['user-1', CLIENT, 'team-1'])
  })

  it('a tool that needs no scope runs', async () => {
    expect((await post(call('app_ping'))).status).toBe(200)
    expect(dispatch).toHaveBeenCalledTimes(1)
  })

  it('a notification is answered 202 and a result 200', async () => {
    dispatch.mockResolvedValueOnce(null)
    expect((await post({ jsonrpc: '2.0', method: 'notifications/initialized' })).status).toBe(202)
    expect((await post(call('app_list_tasks'))).status).toBe(200)
  })

  it('a failure of the engine is a 500, not the error it threw', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {})
    dispatch.mockRejectedValueOnce(new Error('connection string postgres://secret'))
    const response = await post(call('app_list_tasks'))
    expect(response.status).toBe(500)
    expect(JSON.stringify(await response.json())).not.toMatch(/secret/)
    error.mockRestore()
  })
})

describe('a call for a scope the connection was not granted (#541)', () => {
  it('is refused before anything runs, with what to ask for, and recorded', async () => {
    const body = call('app_delete_task')
    const response = await post(body)
    expect(response.status).toBe(403)
    expect(await errorOf(response)).toMatchObject({ code: -32003, message: 'This connection was not granted: tasks:delete.' })
    const challenge = response.headers.get('WWW-Authenticate') ?? ''
    expect(challenge).toMatch(/error="insufficient_scope"/)
    // what the connection has (granted at consent) plus what the call needs
    expect(challenge).toContain('scope="offline_access tasks:read tasks:write tasks:delete"')
    expect(challenge).toContain(`resource_metadata="${metadataUrl.current}"`)
    expect(dispatch).not.toHaveBeenCalled()
    expect(auditRefused).toHaveBeenCalledTimes(1)
    expect(auditRefused.mock.calls[0][0]).toEqual(body)
    expect(auditRefused.mock.calls[0][2]).toEqual(['tasks:read', 'tasks:write'])
  })

  it('refuses the whole batch: nothing of it is half done', async () => {
    const response = await post([call('app_list_tasks', 1), call('app_delete_task', 2)])
    expect(response.status).toBe(403)
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('a scope that was consented and the role no longer allows is not asked for again: the tool refuses it', async () => {
    // tasks:write is in the consent, so asking the user again would change nothing
    const response = await post(call('app_create_task'))
    expect(response.status).toBe(200)
    expect((dispatch.mock.calls[0][1] as ToolExecutionContext).scopes).not.toContain('tasks:write')
  })

  it('a message that is not a tool call needs nothing', async () => {
    expect((await post({ jsonrpc: '2.0', id: 1, method: 'tools/list' })).status).toBe(200)
    expect((await post({ method: 'tools/call', params: { name: 'app_delete_task' } })).status).toBe(200) // not JSON-RPC: the engine's to refuse
  })
})

describe('what bounds a request with an access token (#541)', () => {
  it(`a batch of more than ${MAX_BATCH_MESSAGES} messages is refused`, async () => {
    const response = await post(Array.from({ length: MAX_BATCH_MESSAGES + 1 }, (_, index) => call('app_list_tasks', index)))
    expect(response.status).toBe(400)
    expect((await errorOf(response)).code).toBe(-32600)
    expect(dispatch).not.toHaveBeenCalled()
    expect((await post(Array.from({ length: MAX_BATCH_MESSAGES }, (_, index) => call('app_list_tasks', index)))).status).toBe(200)
  })

  it('a body that is not JSON is a parse error', async () => {
    const response = await post('{not json', true)
    expect(response.status).toBe(400)
    expect((await errorOf(response)).code).toBe(-32700)
  })

  it('a connection over its limit gets the 429 a model can read, with the time to wait, and nothing runs', async () => {
    limit.mockResolvedValueOnce(new Response(null, { status: 429, headers: { 'Retry-After': '17' } }))
    const response = await post(call('app_list_tasks'))
    expect(response.status).toBe(429)
    expect(await errorOf(response)).toEqual({ code: -32000, message: RATE_LIMIT_MESSAGE })
    expect(response.headers.get('Retry-After')).toBe('17')
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('the limit is counted for the connection: the client, the user and the team', async () => {
    await post(call('app_list_tasks'))
    expect(limit.mock.calls[0][1]).toMatchObject({ userId: 'user-1', keyId: `oauth:${CLIENT}:user-1:team-1`, scopes: ['tasks:read'] })
  })
})

describe('what Better Auth is asked to verify, and its challenge (#541)', () => {
  it('the token must be for this resource and from this issuer; a client is told to ask for the scopes of the tools', async () => {
    await handleOAuthMcpRequest(
      new NextRequest('https://app.example.com/api/mcp', { method: 'POST', headers: { authorization: 'Bearer token' }, body: JSON.stringify(call('app_ping')) }),
      { ...handlers, toolScopes: ['tasks:read', 'tasks:write'] }
    )
    expect(verifierOptions.current).toEqual({
      resource: 'https://app.example.com/api/mcp',
      issuer: 'https://app.example.com/api/auth',
      challengeScopes: ['offline_access', 'tasks:read', 'tasks:write'],
    })
  })

  it('under a base path the 401 points at where the app serves the resource metadata', async () => {
    metadataUrl.current = 'https://app.example.com/base/.well-known/oauth-protected-resource/api/mcp'
    unverified.current = new NextResponse(null, {
      status: 401,
      headers: { 'WWW-Authenticate': 'Bearer resource_metadata="https://app.example.com/.well-known/oauth-protected-resource/api/mcp"' },
    })
    const response = await post(call('app_list_tasks'))
    expect(response.status).toBe(401)
    expect(response.headers.get('WWW-Authenticate')).toBe(`Bearer resource_metadata="${metadataUrl.current}"`)
    expect(dispatch).not.toHaveBeenCalled()
  })
})
