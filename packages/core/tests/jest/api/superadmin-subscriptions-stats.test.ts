/**
 * GET /api/superadmin/subscriptions: the MRR is the one of the superadmin dashboard (the business metrics service's
 * query, on the service connection), ARR is MRR x 12, and the plan distribution counts the same subscriptions as the
 * "Active" card (#517).
 */
import { NextRequest } from 'next/server'

jest.mock('@nextsparkjs/core/lib/auth/authorization-session', () => ({
  getAuthorizationSession: async () => ({ session: { id: 's' }, user: { id: 'sa-1', role: 'superadmin' } }),
}))
jest.mock('@nextsparkjs/core/lib/api/rate-limit', () => ({ withRateLimitTier: (handler: unknown) => handler }))
jest.mock('@nextsparkjs/core/lib/billing/gateways/factory', () => ({ getBillingGatewayOrNull: async () => null }))
const queryWithRLS = jest.fn()
jest.mock('@nextsparkjs/core/lib/db', () => ({ queryWithRLS: (...args: unknown[]) => queryWithRLS(...args) }))

import { GET } from '../../../src/routes/api/superadmin/subscriptions/route'
import { QUERIES } from '../../../src/lib/services/business-metrics.service'

beforeEach(() => {
  queryWithRLS.mockImplementation(async (sql: string) => {
    if (sql === QUERIES.mrr) return [{ currency: 'eur', cents: '3667' }, { currency: 'usd', cents: '4999' }]
    if (sql === QUERIES.paying) return [{ teams: 7, users: 5, subscriptions: 7 }]
    if (sql.includes('"totalSubscriptions"')) return [{ totalSubscriptions: '9', activeSubscriptions: '8', trialingSubscriptions: '1', canceledSubscriptions: '0', pastDueSubscriptions: '0', freeSubscriptions: '2', paidSubscriptions: '7', monthlySubscriptions: '8', yearlySubscriptions: '1' }]
    if (sql.includes('as count')) return [{ planSlug: 'pro', planName: 'Pro', count: '8' }]
    if (sql.includes('COUNT(*) as total')) return [{ total: '0' }]
    return []
  })
})

test('stats carry the dashboard MRR per currency and an ARR of twelve times it', async () => {
  const response = await GET(new NextRequest('http://localhost/api/superadmin/subscriptions'), {} as never)
  const { stats } = await response.json()
  expect(stats.mrr).toEqual([{ currency: 'eur', cents: 3667 }, { currency: 'usd', cents: 4999 }])
  expect(stats.arr).toEqual([{ currency: 'eur', cents: 44004 }, { currency: 'usd', cents: 59988 }])
  expect(stats.payingSubscriptions).toBe(7)
})

test('the plan distribution counts only active subscriptions, as the Active card does', async () => {
  await GET(new NextRequest('http://localhost/api/superadmin/subscriptions'), {} as never)
  const distribution = queryWithRLS.mock.calls.map(([sql]) => sql as string).find(sql => sql.includes('as count'))!
  expect(distribution).toContain(`WHERE s.status = 'active'`)
  expect(distribution).not.toContain('trialing')
})
