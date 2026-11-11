/**
 * The tier of the superadmin and API-key routes (#434): their reads are in the `read` tier (200 requests per minute per
 * address), not in `strict` (10 per HOUR, one bucket for every strict route of the address), which a page that
 * fetches on every load or reload ran through in ten reloads. What changes data or credentials stays `strict`.
 */
const mockTiers = new Map<unknown, string>()
jest.mock('@nextsparkjs/core/lib/api/rate-limit', () => ({
  withRateLimitTier: (handler: (...args: unknown[]) => unknown, tier: string) => {
    const tagged = (...args: unknown[]) => handler(...args)
    mockTiers.set(tagged, tier)
    return tagged
  },
}))
jest.mock('@nextsparkjs/core/lib/auth/authorization-session', () => ({ getAuthorizationSession: jest.fn() }))
jest.mock('@nextsparkjs/core/lib/auth/suspension', () => ({ suspendUser: jest.fn(), unsuspendUser: jest.fn() }))
jest.mock('@nextsparkjs/core/lib/api/auth/dual-auth', () => ({ SYSTEM_ADMIN_TEAM_ID: 'team-nextspark-001', authenticateRequest: jest.fn(), createAuthFailureResponse: jest.fn(), resolveTeamContext: jest.fn() }))
jest.mock('@nextsparkjs/core/lib/billing/gateways/factory', () => ({ getBillingGatewayOrNull: jest.fn() }))
jest.mock('@nextsparkjs/core/lib/db', () => ({ queryWithRLS: jest.fn(), queryOneWithRLS: jest.fn(), mutateWithRLS: jest.fn() }))
jest.mock('@nextsparkjs/core/lib/api/helpers', () => ({
  createApiResponse: jest.fn(), createApiError: jest.fn(), withApiLogging: (handler: unknown) => handler,
  handleCorsPreflightRequest: jest.fn(), addCorsHeaders: jest.fn(), readJsonObject: jest.fn(),
}))
jest.mock('@nextsparkjs/core/lib/api/auth', () => ({ invalidateApiKeyCache: jest.fn(), validateScopesForUser: jest.fn() }))

import * as superadminUsers from '../../../src/routes/api/superadmin/users/route'
import * as superadminUser from '../../../src/routes/api/superadmin/users/[userId]/route'
import * as superadminTeams from '../../../src/routes/api/superadmin/teams/route'
import * as superadminTeam from '../../../src/routes/api/superadmin/teams/[teamId]/route'
import * as superadminSubscriptions from '../../../src/routes/api/superadmin/subscriptions/route'
import * as apiKeys from '../../../src/routes/api/v1/api-keys/route'
import * as apiKey from '../../../src/routes/api/v1/api-keys/[id]/route'

const tierOf = (module: Record<string, unknown>, method: string) => mockTiers.get(module[method])

describe('reads of the admin pages', () => {
  it.each([
    ['GET /api/superadmin/users', superadminUsers],
    ['GET /api/superadmin/users/:userId', superadminUser],
    ['GET /api/superadmin/teams', superadminTeams],
    ['GET /api/superadmin/teams/:teamId', superadminTeam],
    ['GET /api/superadmin/subscriptions', superadminSubscriptions],
    ['GET /api/v1/api-keys', apiKeys],
    ['GET /api/v1/api-keys/:id', apiKey],
  ] as const)('%s is in the read tier', (_name, module) => {
    expect(tierOf(module, 'GET')).toBe('read')
  })
})

describe('what changes users or credentials stays strict', () => {
  it.each([
    ['POST /api/superadmin/users', superadminUsers, 'POST'],
    ['PUT /api/superadmin/users', superadminUsers, 'PUT'],
    ['PATCH /api/superadmin/users/:userId', superadminUser, 'PATCH'],
    ['DELETE /api/superadmin/users/:userId', superadminUser, 'DELETE'],
    ['POST /api/v1/api-keys', apiKeys, 'POST'],
    ['PATCH /api/v1/api-keys/:id', apiKey, 'PATCH'],
    ['DELETE /api/v1/api-keys/:id', apiKey, 'DELETE'],
  ] as const)('%s', (_name, module, method) => {
    expect(tierOf(module, method)).toBe('strict')
  })
})
