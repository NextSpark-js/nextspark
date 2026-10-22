/**
 * With `provider: 'none'` the billing endpoints that need a payment gateway answer 501 BILLING_GATEWAY_DISABLED (#322):
 * after authentication (anonymous callers still get 401), without touching the services or the gateway, and the
 * webhook routes answer 404. Plans, limits and entitlements keep working (they never go through the gateway).
 */

import { registerBillingGateway, clearRegisteredBillingGateways } from '@/core/lib/billing/gateways/registry'
import { routeHarness, makeReq, asJson, sessionAs, MEMBER } from './input-validation/__helpers__/route-harness'

const mockRegistry = { provider: 'none', plans: [], features: {}, limits: {} }
jest.mock('@nextsparkjs/registries/billing-registry', () => ({ BILLING_REGISTRY: mockRegistry }))

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
  mockRegistry.provider = 'none'
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

const webhooks = [
  ['stripe', stripeWebhook],
  ['polar', createPolarWebhookRoute()],
  ['lemonsqueezy', createLemonSqueezyWebhookRoute()],
  ['paddle', paddleWebhook],
] as Array<[string, (req: ReturnType<typeof makeReq>, ctx: never) => Promise<Response>]>

describe('webhook routes', () => {
  // 'none' has no webhook; a custom gateway has its own route, so an event of it is never claimed under a built-in namespace
  describe.each(['none', 'acme'])('provider %s', (provider) => {
    beforeEach(() => {
      mockRegistry.provider = provider
    })

    test.each(webhooks)('%s answers 404 and verifies nothing', async (name, handler) => {
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
})

describe('a registered gateway that replaces a built-in name', () => {
  beforeEach(() => {
    mockRegistry.provider = 'stripe'
  })
  afterEach(() => clearRegisteredBillingGateways())

  const hit = (name: string, handler: (req: ReturnType<typeof makeReq>, ctx: never) => Promise<Response>) => {
    const request = makeReq('POST', `/api/v1/billing/webhooks/${name}`, undefined, {
      'stripe-signature': 'sig', 'paddle-signature': 'ts=1;h1=aa', 'x-signature': 'sig',
      'webhook-id': 'w', 'webhook-signature': 's', 'webhook-timestamp': '1',
    })
    // the jsdom environment has no body readers on a request
    Object.assign(request, { text: async () => '{}', arrayBuffer: async () => new ArrayBuffer(2) })
    return handler(request, undefined as never)
  }

  test.each(['stripe', 'polar', 'lemonsqueezy', 'paddle'])('%s registered keeps only its own route: the other three answer 404 and never verify', async (provider) => {
    mockRegistry.provider = provider
    registerBillingGateway(provider, () => ({}) as never)

    for (const [name, handler] of webhooks.filter(([name]) => name !== provider)) {
      expect((await hit(name, handler)).status).toBe(404)
    }
    expect(mockGetBillingGateway).not.toHaveBeenCalled()

    mockGetBillingGateway.mockRejectedValue(new Error('verify'))
    const own = await hit(provider, webhooks.find(([name]) => name === provider)![1])
    expect(own.status).not.toBe(404)
    expect(mockGetBillingGateway).toHaveBeenCalled()
  })

  test('without a registered gateway nothing changes: every route reaches signature verification', async () => {
    mockGetBillingGateway.mockRejectedValue(new Error('verify'))

    for (const [name, handler] of webhooks) {
      expect((await hit(name, handler)).status).toBe(400)
    }
    expect(mockGetBillingGateway).toHaveBeenCalledTimes(4)
  })
})
