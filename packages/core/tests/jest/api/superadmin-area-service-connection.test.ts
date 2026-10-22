/**
 * The /api/superadmin routes answer a developer as they answer a superadmin. Under the nextspark_app role the RLS
 * policies show a developer outside the System Admin Team only their own users and teams (and team_members has no
 * bypass at all), so every query runs on the service connection after the route's role check.
 */
import { NextRequest } from 'next/server'

const session = jest.fn()
jest.mock('@nextsparkjs/core/lib/auth/authorization-session', () => ({ getAuthorizationSession: () => session() }))
jest.mock('@nextsparkjs/core/lib/api/rate-limit', () => ({ withRateLimitTier: (handler: unknown) => handler }))
jest.mock('@nextsparkjs/core/lib/api/auth/dual-auth', () => ({ SYSTEM_ADMIN_TEAM_ID: 'team-nextspark-001' }))
jest.mock('@nextsparkjs/core/lib/billing/gateways/factory', () => ({ getBillingGatewayOrNull: async () => ({ getSubscriptionDashboardUrl: () => null, getCustomerDashboardUrl: () => null, getProviderName: () => 'stripe' }) }))
const queryWithRLS = jest.fn()
jest.mock('@nextsparkjs/core/lib/db', () => ({ queryWithRLS: (...args: unknown[]) => queryWithRLS(...args) }))

import { GET as users } from '../../../src/routes/api/superadmin/users/route'
import { GET as teams } from '../../../src/routes/api/superadmin/teams/route'
import { GET as team } from '../../../src/routes/api/superadmin/teams/[teamId]/route'
import { GET as subscriptions } from '../../../src/routes/api/superadmin/subscriptions/route'

const ROUTES = [
  ['GET /api/superadmin/users', () => users(new NextRequest('http://localhost/api/superadmin/users'), undefined as never)],
  ['GET /api/superadmin/teams', () => teams(new NextRequest('http://localhost/api/superadmin/teams'), undefined as never)],
  ['GET /api/superadmin/teams/:id', () => team(new NextRequest('http://localhost/api/superadmin/teams/t-1'), { params: Promise.resolve({ teamId: 't-1' }) } as never)],
  ['GET /api/superadmin/subscriptions', () => subscriptions(new NextRequest('http://localhost/api/superadmin/subscriptions'), undefined as never)],
] as const

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
  queryWithRLS.mockResolvedValue([{ id: 't-1', name: 'T', ownerId: 'u-1', ownerEmail: 'u@x', total: 0 }])
})

describe.each(ROUTES)('%s', (_name, call) => {
  it.each(['developer', 'superadmin'])('answers a %s with every query on the service connection', async (role) => {
    session.mockResolvedValue({ session: { id: 's' }, user: { id: 'actor', role } })
    expect((await call()).status).toBe(200)
    expect(queryWithRLS).toHaveBeenCalled()
    for (const args of queryWithRLS.mock.calls) expect(args[3]).toEqual({ service: true })
  })

  it('refuses a member before any query', async () => {
    session.mockResolvedValue({ session: { id: 's' }, user: { id: 'actor', role: 'member' } })
    expect((await call()).status).toBe(403)
    expect(queryWithRLS).not.toHaveBeenCalled()
  })
})
