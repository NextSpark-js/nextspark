/**
 * POST /api/v1/api-keys: a superadmin or a developer mints a key without a team context (validateScopesForUser
 * grants them every scope); anyone else needs the team the key is minted for.
 */
import { NextRequest, NextResponse } from 'next/server'

const authenticateRequest = jest.fn()
const resolveTeamContext = jest.fn()
jest.mock('@nextsparkjs/core/lib/api/auth/dual-auth', () => ({
  authenticateRequest: (...args: unknown[]) => authenticateRequest(...args),
  resolveTeamContext: (...args: unknown[]) => resolveTeamContext(...args),
  createAuthFailureResponse: () => NextResponse.json({}, { status: 401 }),
}))
const validateScopesForUser = jest.fn()
jest.mock('@nextsparkjs/core/lib/api/auth', () => ({ validateScopesForUser: (...args: unknown[]) => validateScopesForUser(...args) }))
jest.mock('@nextsparkjs/core/lib/api/helpers', () => ({
  createApiResponse: (data: unknown, _meta: unknown, status = 200) => NextResponse.json(data, { status }),
  createApiError: (error: string, status: number) => NextResponse.json({ error }, { status }),
  withApiLogging: (handler: unknown) => handler,
  handleCorsPreflightRequest: jest.fn(),
  addCorsHeaders: (response: unknown) => response,
}))
jest.mock('@nextsparkjs/core/lib/api/rate-limit', () => ({ withRateLimitTier: (handler: unknown) => handler }))
jest.mock('@nextsparkjs/core/lib/db', () => ({
  queryWithRLS: async () => [{ count: 0 }],
  mutateWithRLS: async () => ({ rows: [{ id: 'k-1' }] }),
}))

import { POST } from '../../../src/routes/api/v1/api-keys/route'

const create = () =>
  POST(new NextRequest('http://localhost/api/v1/api-keys', { method: 'POST', body: JSON.stringify({ name: 'k', scopes: ['users:read'] }) }), undefined as never)

beforeEach(() => {
  jest.clearAllMocks()
  validateScopesForUser.mockResolvedValue({ valid: true, allowedScopes: ['users:read'], deniedScopes: [] })
  resolveTeamContext.mockResolvedValue('team-1')
})

it.each(['superadmin', 'developer'])('a %s mints a key without a team context', async (role) => {
  authenticateRequest.mockResolvedValue({ success: true, type: 'session', user: { id: 'u-1', role } })
  expect((await create()).status).toBe(201)
  expect(resolveTeamContext).not.toHaveBeenCalled()
  expect(validateScopesForUser).toHaveBeenCalledWith('u-1', null, ['users:read'])
})

it('a member mints a key for the team in context', async () => {
  authenticateRequest.mockResolvedValue({ success: true, type: 'session', user: { id: 'u-1', role: 'member' } })
  expect((await create()).status).toBe(201)
  expect(validateScopesForUser).toHaveBeenCalledWith('u-1', 'team-1', ['users:read'])
})
