/**
 * GET /api/superadmin/teams/:id: each usage counter carries the limit of the team's plan and its unit (#534).
 */
import { NextRequest } from 'next/server'

jest.mock('@nextsparkjs/core/lib/auth/authorization-session', () => ({
  getAuthorizationSession: async () => ({ session: { id: 's' }, user: { id: 'sa-1', role: 'superadmin' } }),
}))
jest.mock('@nextsparkjs/core/lib/api/rate-limit', () => ({ withRateLimitTier: (handler: unknown) => handler }))
jest.mock('@nextsparkjs/core/lib/billing/gateways/factory', () => ({ getBillingGatewayOrNull: async () => null }))
jest.mock('@nextsparkjs/core/lib/billing/queries', () => ({
  getFullBillingMatrix: () => ({
    limits: { storage_gb: { unit: 'bytes' }, tasks: { unit: 'count' } },
    matrix: { limits: { storage_gb: { pro: 50, free: 1 }, tasks: { pro: -1, free: 20 } } },
  }),
}))
const queryWithRLS = jest.fn()
jest.mock('@nextsparkjs/core/lib/db', () => ({ queryWithRLS: (...args: unknown[]) => queryWithRLS(...args) }))

import { GET } from '../../../src/routes/api/superadmin/teams/[teamId]/route'

beforeEach(() => {
  queryWithRLS.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM "teams" t')) return [{ id: 't1', name: 'Acme', ownerId: 'u1', ownerName: 'Ann', ownerEmail: 'ann@example.com', createdAt: 'x', updatedAt: 'y' }]
    if (sql.includes('FROM "subscriptions" s') && sql.includes('LIMIT 1')) return [{ id: 's1', planId: 'p', planSlug: 'pro', planName: 'Pro', planType: 'paid', priceMonthly: 1000, status: 'active' }]
    if (sql.includes('FROM "usage" u')) {
      return [
        { limitSlug: 'storage_gb', currentValue: 25, periodKey: 'all_time' },
        { limitSlug: 'tasks', currentValue: 7, periodKey: '2026-11' },
        { limitSlug: 'custom', currentValue: 1, periodKey: '2026' },
      ]
    }
    return []
  })
})

it('adds the plan limit and the unit to each usage counter, null when the plan or the registry does not define them', async () => {
  const response = await GET(new NextRequest('http://localhost/api/superadmin/teams/t1'), { params: Promise.resolve({ teamId: 't1' }) } as never)
  const { usage } = await response.json()
  expect(usage.storage_gb).toEqual({ current: 25, periodKey: 'all_time', limit: 50, unit: 'bytes' })
  expect(usage.tasks).toEqual({ current: 7, periodKey: '2026-11', limit: -1, unit: 'count' })
  expect(usage.custom).toEqual({ current: 1, periodKey: '2026', limit: null, unit: null })
})
