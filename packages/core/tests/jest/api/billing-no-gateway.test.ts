/**
 * With `provider: 'none'` the billing endpoints that need a payment gateway answer 501 BILLING_GATEWAY_DISABLED (#322):
 * after authentication (anonymous callers still get 401), without touching the services or the gateway, and the
 * webhook routes answer 404. Plans, limits and entitlements keep working (they never go through the gateway).
 */

import { routeHarness, makeReq, asJson, sessionAs, MEMBER } from './input-validation/__helpers__/route-harness'

jest.mock('@nextsparkjs/registries/billing-registry', () => ({ BILLING_REGISTRY: { provider: 'none', plans: [], features: {}, limits: {} } }))

const mockGetActive = jest.fn()
const mockChangePlan = jest.fn()
const mockMembershipGet = jest.fn()
jest.mock('@/core/lib/services', () => ({
  MembershipService: { get: (...args: unknown[]) => mockMembershipGet(...args) },
  SubscriptionService: { getActive: (...args: unknown[]) => mockGetActive(...args), changePlan: (...args: unknown[]) => mockChangePlan(...args) },
}))
const mockGetBillingGateway = jest.fn()
jest.mock('@/core/lib/billing/gateways/factory', () => ({ getBillingGateway: (...args: unknown[]) => mockGetBillingGateway(...args) }))

import { POST as checkout } from '@/app/api/v1/billing/checkout/route'
import { POST as portal } from '@/app/api/v1/billing/portal/route'
import { POST as cancel } from '@/app/api/v1/billing/cancel/route'
import { POST as changePlan } from '@/app/api/v1/billing/change-plan/route'
import { POST as stripeWebhook } from '@/app/api/v1/billing/webhooks/stripe/route'
import { createPolarWebhookRoute, createLemonSqueezyWebhookRoute } from '@/core/routes/_internal/billing-webhooks'
import { POST as paddleWebhook } from '@/app/api/v1/billing/webhooks/paddle/route'

const endpoints: Array<[string, (req: ReturnType<typeof makeReq>) => Promise<Response>, unknown]> = [
  ['checkout', (r) => checkout(r, undefined as never), { planSlug: 'pro' }],
  ['portal', (r) => portal(r, undefined as never), {}],
  ['cancel', (r) => cancel(r, undefined as never), { immediate: false }],
  ['change-plan', (r) => changePlan(r, undefined as never), { planSlug: 'pro' }],
]

beforeEach(() => {
  routeHarness.reset()
  routeHarness.mocks.authenticateRequest.mockResolvedValue(sessionAs({ ...MEMBER, defaultTeamId: 'team-1' } as typeof MEMBER))
  mockMembershipGet.mockResolvedValue({ role: 'owner', canPerformAction: () => ({ allowed: true }) })
})

describe.each(endpoints)('POST /api/v1/billing/%s', (name, invoke, body) => {
  const request = () => makeReq('POST', `/api/v1/billing/${name}`, asJson(body), { 'x-team-id': 'team-1' })

  test('answers 501 BILLING_GATEWAY_DISABLED with a clear message, touching neither services nor gateway', async () => {
    const response = await invoke(request())

    expect(response.status).toBe(501)
    expect(await response.json()).toMatchObject({
      success: false,
      code: 'BILLING_GATEWAY_DISABLED',
      error: 'Billing is not available: this project runs without a payment gateway.',
    })
    expect(mockGetActive).not.toHaveBeenCalled()
    expect(mockChangePlan).not.toHaveBeenCalled()
    expect(mockGetBillingGateway).not.toHaveBeenCalled()
  })

  test('an anonymous caller still gets 401, not the disabled answer', async () => {
    routeHarness.mocks.authenticateRequest.mockResolvedValue({ success: false, error: { code: 'AUTHENTICATION_FAILED', status: 401, message: 'Authentication required' } })

    const response = await invoke(request())

    expect(response.status).toBe(401)
  })
})

describe('webhook routes', () => {
  test.each([
    ['stripe', stripeWebhook],
    ['polar', createPolarWebhookRoute()],
    ['lemonsqueezy', createLemonSqueezyWebhookRoute()],
    ['paddle', paddleWebhook],
  ] as Array<[string, (req: ReturnType<typeof makeReq>, ctx: never) => Promise<Response>]>)('%s answers 404 and verifies nothing', async (name, handler) => {
    const request = makeReq('POST', `/api/v1/billing/webhooks/${name}`, undefined, {
      'stripe-signature': 'sig',
      'paddle-signature': 'ts=1;h1=aa',
      'x-signature': 'sig',
      'webhook-id': 'w',
      'webhook-signature': 's',
      'webhook-timestamp': '1',
    })

    const response = await handler(request, undefined as never)

    expect(response.status).toBe(404)
    expect(mockGetBillingGateway).not.toHaveBeenCalled()
  })
})
