/**
 * GET /api/superadmin/teams: each team carries the plan of its newest subscription (#521).
 */
import { NextRequest } from 'next/server'

const session = jest.fn()
jest.mock('@nextsparkjs/core/lib/auth/authorization-session', () => ({ getAuthorizationSession: () => session() }))
jest.mock('@nextsparkjs/core/lib/api/rate-limit', () => ({ withRateLimitTier: (handler: unknown) => handler }))
const queryWithRLS = jest.fn()
jest.mock('@nextsparkjs/core/lib/db', () => ({
  ...jest.requireActual('@nextsparkjs/core/lib/db'),
  queryWithRLS: (...args: unknown[]) => queryWithRLS(...args),
}))

import { GET } from '../../../src/routes/api/superadmin/teams/route'

const row = (id: string, over = {}) => ({ id, name: `Team ${id}`, ownerId: 'o1', ownerName: 'Olive Owner', ownerEmail: 'o@x', memberCount: 2, planName: null, planSlug: null, subscriptionStatus: null, createdAt: 'x', updatedAt: 'x', ...over })

beforeEach(() => {
  jest.clearAllMocks()
  session.mockResolvedValue({ session: { id: 's' }, user: { id: 'sa', role: 'superadmin' } })
  queryWithRLS.mockImplementation(async (sql: string) => (/GROUP BY t\.id/.test(sql)
    ? [row('a', { planName: 'Pro', planSlug: 'pro', subscriptionStatus: 'past_due' }), row('b')]
    : [{ total: 2, userTeams: 2, systemTeams: 0 }]))
})

it('returns the plan and status of the newest subscription, and null for a team with none', async () => {
  const body = await (await GET(new NextRequest('http://localhost/api/superadmin/teams'), undefined as never)).json()
  expect(body.teams[0].plan).toEqual({ name: 'Pro', slug: 'pro', status: 'past_due' })
  expect(body.teams[1].plan).toBeNull()
})

it('reads the newest subscription of each team, not a row per subscription', async () => {
  await GET(new NextRequest('http://localhost/api/superadmin/teams'), undefined as never)
  const [sql] = queryWithRLS.mock.calls.find(([q]) => /GROUP BY t\.id/.test(q as string)) as [string]
  expect(sql).toMatch(/LEFT JOIN LATERAL[\s\S]*ORDER BY s\."createdAt" DESC[\s\S]*LIMIT 1/)
})
