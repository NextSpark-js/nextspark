/**
 * POST /api/v1/billing/cancel answers 400 NOT_SUPPORTED, with the gateway's message, when the configured provider cannot
 * serve the request (Lemon Squeezy: immediate cancellation, #268), and still 500 for any other gateway failure.
 */

import { routeHarness, makeReq, asJson, sessionAs, MEMBER } from './input-validation/__helpers__/route-harness'
import { BillingOperationNotSupportedError } from '@/core/lib/billing/gateways/errors'

const mockMembership = { role: 'owner', canPerformAction: jest.fn(() => ({ allowed: true })) }
const mockGetActive = jest.fn()
jest.mock('@/core/lib/services', () => ({
  MembershipService: { get: async () => mockMembership },
  SubscriptionService: { getActive: (...args: unknown[]) => mockGetActive(...args) },
}))
const mockCancelImmediately = jest.fn()
jest.mock('@/core/lib/billing/gateways/factory', () => ({
  getBillingGateway: async () => ({ cancelSubscriptionImmediately: (...args: unknown[]) => mockCancelImmediately(...args) }),
}))

import { POST as cancelBilling } from '@/app/api/v1/billing/cancel/route'

const invoke = (body: unknown) =>
  cancelBilling(makeReq('POST', '/api/v1/billing/cancel', asJson(body), { 'x-team-id': 'team-1' }), undefined as never)

beforeEach(() => {
  routeHarness.reset()
  routeHarness.mocks.authenticateRequest.mockResolvedValue(sessionAs({ ...MEMBER, defaultTeamId: 'team-1' } as typeof MEMBER))
  mockGetActive.mockResolvedValue({ id: 'sub-1', externalSubscriptionId: 'ls_555', currentPeriodEnd: new Date() })
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

test('an operation the provider does not support is a 400 NOT_SUPPORTED with its message, and nothing is written', async () => {
  mockCancelImmediately.mockRejectedValue(new BillingOperationNotSupportedError('Lemon Squeezy cannot cancel a subscription immediately.'))
  const response = await invoke({ immediate: true })
  expect(response.status).toBe(400)
  expect(await response.json()).toMatchObject({ success: false, error: 'Lemon Squeezy cannot cancel a subscription immediately.', code: 'NOT_SUPPORTED' })
  expect(routeHarness.mocks.queryWithRLS).not.toHaveBeenCalled()
})

test('any other gateway failure is still a 500', async () => {
  mockCancelImmediately.mockRejectedValue(new Error('network down'))
  const response = await invoke({ immediate: true })
  expect(response.status).toBe(500)
  expect(await response.json()).toMatchObject({ code: 'INTERNAL_ERROR' })
})
