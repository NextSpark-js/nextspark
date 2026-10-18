/**
 * Unit tests for the Paddle Billing Payment Gateway (#269)
 *
 * Tests the PaddleGateway class, the Paddle-Signature check and the getBillingGateway() factory.
 * `fetch` is mocked: no call reaches Paddle. The response bodies are hand-built from the shapes in Paddle's API
 * reference (developer.paddle.com/api-reference), not recorded from a real account.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { createHmac } from 'node:crypto'

jest.mock('@/core/lib/registries/billing-registry', () => ({
  BILLING_REGISTRY: {
    provider: 'paddle',
    plans: [
      { slug: 'free', name: 'Free', providerPriceIds: { monthly: null, yearly: null }, limits: {}, features: [] },
      { slug: 'pro', name: 'Pro', providerPriceIds: { monthly: 'pri_pro_m', yearly: 'pri_pro_y' }, trialDays: 14, limits: {}, features: [] },
      { slug: 'enterprise', name: 'Enterprise', providerPriceIds: { monthly: 'pri_ent_m', yearly: null }, limits: {}, features: [] },
    ],
    limits: {},
  },
}))

import { PaddleGateway, isValidPaddleSignature, paddleConfigFromEnv, paddleWebhookToleranceFromEnv } from '@/core/lib/billing/gateways/paddle'
import { isValidPaddleTeamToken, paddleTeamToken, paddleTeamTokenSecret } from '@/core/lib/billing/paddle-webhook'
import { getBillingGateway, resetBillingGateway } from '@/core/lib/billing/gateways/factory'

const SECRET = 'pdl_ntfset_mock_webhook_secret'
const ENV = { PADDLE_API_KEY: 'pdl_sdbx_apikey_mock', PADDLE_WEBHOOK_SECRET: SECRET, PADDLE_ENVIRONMENT: 'sandbox' }
const NOW = 1_760_000_000

const h1 = (ts: number | string, body: string, secret = SECRET) => createHmac('sha256', secret).update(`${ts}:${body}`).digest('hex')
const header = (body: string, ts = NOW, secret = SECRET) => `ts=${ts};h1=${h1(ts, body, secret)}`

const mockFetch = jest.fn<typeof fetch>()

/** A Paddle answer: `{ data, meta }`, or `{ error, meta }` for an error status. */
function answer(data: unknown, status = 200) {
  return new Response(JSON.stringify(status < 300 ? { data, meta: { request_id: 'req_1' } } : { error: data, meta: { request_id: 'req_1' } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function subscription(fields: Record<string, unknown> = {}) {
  return {
    id: 'sub_01',
    status: 'active',
    scheduled_change: null,
    items: [{ price: { id: 'pri_pro_m' }, quantity: 1 }],
    ...fields,
  }
}

/** The method, path, headers and JSON body of the n-th fetch call. */
function call(n = 0) {
  const [url, init] = mockFetch.mock.calls[n] as [string, RequestInit]
  return {
    method: init.method,
    url,
    path: url.replace(/^https:\/\/(sandbox-)?api\.paddle\.com/, ''),
    headers: init.headers as Record<string, string>,
    body: init.body ? JSON.parse(init.body as string) : undefined,
  }
}

describe('Paddle Gateway', () => {
  const originalEnv = process.env
  const originalFetch = global.fetch
  let gateway: PaddleGateway

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv, ...ENV }
    global.fetch = mockFetch as typeof fetch
    gateway = new PaddleGateway()
  })

  afterEach(() => {
    process.env = originalEnv
    global.fetch = originalFetch
  })

  describe('configuration', () => {
    test('reads the three variables', () => {
      expect(paddleConfigFromEnv(ENV)).toEqual({ apiKey: 'pdl_sdbx_apikey_mock', webhookSecret: SECRET, environment: 'sandbox', teamTokenSecret: SECRET, webhookToleranceSeconds: 5 })
    })

    test('PADDLE_TEAM_TOKEN_SECRET, when set, keys the team token instead of the webhook secret', () => {
      expect(paddleConfigFromEnv({ ...ENV, PADDLE_TEAM_TOKEN_SECRET: 'team_token_secret' }).teamTokenSecret).toBe('team_token_secret')
      expect(paddleTeamTokenSecret({ ...ENV, PADDLE_TEAM_TOKEN_SECRET: ' ' })).toBe(SECRET)
      expect(paddleTeamTokenSecret({})).toBeNull()
    })

    test('names every missing variable, and no value', () => {
      expect(() => paddleConfigFromEnv({})).toThrow(
        'Paddle billing is misconfigured: PADDLE_API_KEY is missing; PADDLE_WEBHOOK_SECRET is missing; PADDLE_ENVIRONMENT is missing (sandbox or production).'
      )
      let message = ''
      try {
        paddleConfigFromEnv({ ...ENV, PADDLE_ENVIRONMENT: 'live-secret-value' })
      } catch (error) {
        message = (error as Error).message
      }
      expect(message).toBe('Paddle billing is misconfigured: PADDLE_ENVIRONMENT must be sandbox or production.')
      expect(message).not.toContain('live-secret-value')
      expect(message).not.toContain('pdl_sdbx_apikey_mock')
      expect(message).not.toContain(SECRET)
    })

    test('an API key of the other environment is refused', () => {
      expect(() => paddleConfigFromEnv({ ...ENV, PADDLE_ENVIRONMENT: 'production' }))
        .toThrow('Paddle billing is misconfigured: PADDLE_API_KEY is a sandbox key but PADDLE_ENVIRONMENT is production.')
      expect(() => paddleConfigFromEnv({ ...ENV, PADDLE_API_KEY: 'pdl_live_apikey_mock' }))
        .toThrow('Paddle billing is misconfigured: PADDLE_API_KEY is a live key but PADDLE_ENVIRONMENT is sandbox.')
      // a key without the environment prefix (made before 2025) is accepted for either
      expect(paddleConfigFromEnv({ ...ENV, PADDLE_API_KEY: 'a1b2c3', PADDLE_ENVIRONMENT: 'production' }).environment).toBe('production')
    })

    test('PADDLE_WEBHOOK_TOLERANCE_SECONDS sets the signature window from 5 to 300 seconds; anything else warns and keeps 5', () => {
      expect(paddleWebhookToleranceFromEnv({})).toEqual({ seconds: 5, valid: true })
      expect(paddleWebhookToleranceFromEnv({ PADDLE_WEBHOOK_TOLERANCE_SECONDS: ' 60 ' })).toEqual({ seconds: 60, valid: true })
      expect(paddleWebhookToleranceFromEnv({ PADDLE_WEBHOOK_TOLERANCE_SECONDS: '300' })).toEqual({ seconds: 300, valid: true })
      for (const value of ['4', '301', '0', '-10', '10.5', 'ten', '1e2']) {
        expect(paddleWebhookToleranceFromEnv({ PADDLE_WEBHOOK_TOLERANCE_SECONDS: value })).toEqual({ seconds: 5, valid: false })
      }
      expect(paddleConfigFromEnv({ ...ENV, PADDLE_WEBHOOK_TOLERANCE_SECONDS: '60' }).webhookToleranceSeconds).toBe(60)

      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
      try {
        new PaddleGateway({ ...ENV, PADDLE_WEBHOOK_TOLERANCE_SECONDS: '3600' })
        expect(warn).toHaveBeenCalledWith('[paddle] PADDLE_WEBHOOK_TOLERANCE_SECONDS must be an integer from 5 to 300; using the default of 5 seconds')
        warn.mockClear()
        new PaddleGateway({ ...ENV, PADDLE_WEBHOOK_TOLERANCE_SECONDS: '60' })
        expect(warn).not.toHaveBeenCalled()
      } finally {
        warn.mockRestore()
      }
    })

    test('the gateway validates the environment when it is created (selection time)', () => {
      expect(() => new PaddleGateway({ PADDLE_API_KEY: 'k' })).toThrow(/PADDLE_WEBHOOK_SECRET is missing; PADDLE_ENVIRONMENT is missing/)
    })

    test('a sandbox environment in a production build is a warning that names the variable', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
      try {
        new PaddleGateway({ ...ENV, NODE_ENV: 'production' })
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('PADDLE_ENVIRONMENT is sandbox in a production build'))
        warn.mockClear()
        new PaddleGateway({ ...ENV, NODE_ENV: 'development' })
        expect(warn).not.toHaveBeenCalled()
      } finally {
        warn.mockRestore()
      }
    })
  })

  describe('requests', () => {
    test('go to the base URL of the environment with the key, JSON and API version 1', async () => {
      mockFetch.mockResolvedValueOnce(answer({ id: 'ctm_1', email: 'a@example.test', name: null }))
      await gateway.getCustomer('ctm_1')
      expect(call()).toMatchObject({
        method: 'GET',
        url: 'https://sandbox-api.paddle.com/customers/ctm_1',
        headers: { Authorization: 'Bearer pdl_sdbx_apikey_mock', 'Content-Type': 'application/json', 'Paddle-Version': '1' },
      })

      const live = new PaddleGateway({ ...ENV, PADDLE_API_KEY: 'pdl_live_apikey_mock', PADDLE_ENVIRONMENT: 'production' })
      mockFetch.mockResolvedValueOnce(answer({ id: 'ctm_1', email: null, name: null }))
      await live.getCustomer('ctm_1')
      expect(call(1).url).toBe('https://api.paddle.com/customers/ctm_1')
    })

    test('an API error carries its code, detail and fields, never the key', async () => {
      mockFetch.mockResolvedValueOnce(answer({
        type: 'request_error', code: 'invalid_field', detail: 'Request does not pass validation.',
        errors: [{ field: 'items[0].price_id', message: 'price not found' }],
      }, 400))
      let message = ''
      try {
        await gateway.getCustomer('ctm_1')
      } catch (error) {
        message = (error as Error).message
      }
      expect(message).toBe('Paddle API GET /customers/ctm_1 failed with status 400: invalid_field: Request does not pass validation.: items[0].price_id: price not found')
      expect(message).not.toContain('pdl_sdbx_apikey_mock')
    })
  })

  describe('createCheckoutSession', () => {
    test('creates a transaction for the plan price with the team in the custom data and returns its checkout URL', async () => {
      mockFetch.mockResolvedValueOnce(answer({ id: 'txn_1', status: 'ready', checkout: { url: 'https://app.test/pay?_ptxn=txn_1' } }, 201))

      const result = await gateway.createCheckoutSession({
        teamId: 'team-1',
        planSlug: 'pro',
        billingPeriod: 'monthly',
        successUrl: 'https://app.test/billing?success=true',
        cancelUrl: 'https://app.test/billing?canceled=true',
        customerEmail: 'owner@example.test',
        customerId: 'ctm_1',
      })

      expect(result).toEqual({ id: 'txn_1', url: 'https://app.test/pay?_ptxn=txn_1' })
      expect(call()).toMatchObject({ method: 'POST', path: '/transactions' })
      expect(call().body).toEqual({
        items: [{ price_id: 'pri_pro_m', quantity: 1 }],
        custom_data: { teamId: 'team-1', planSlug: 'pro', billingPeriod: 'monthly', teamToken: paddleTeamToken('team-1', 'pri_pro_m', SECRET) },
        customer_id: 'ctm_1',
      })
    })

    test('uses the yearly price, and passes no customer id of another provider', async () => {
      mockFetch.mockResolvedValueOnce(answer({ id: 'txn_2', checkout: { url: 'https://app.test/pay?_ptxn=txn_2' } }, 201))
      await gateway.createCheckoutSession({ teamId: 'team-1', planSlug: 'pro', billingPeriod: 'yearly', successUrl: 's', cancelUrl: 'c', customerId: 'cus_stripe' })
      expect(call().body.items).toEqual([{ price_id: 'pri_pro_y', quantity: 1 }])
      expect(call().body).not.toHaveProperty('customer_id')
    })

    test('throws for an unknown plan and for a plan with no price', async () => {
      await expect(gateway.createCheckoutSession({ teamId: 't', planSlug: 'nope', billingPeriod: 'monthly', successUrl: 's', cancelUrl: 'c' }))
        .rejects.toThrow('Plan nope not found in BILLING_REGISTRY')
      await expect(gateway.createCheckoutSession({ teamId: 't', planSlug: 'enterprise', billingPeriod: 'yearly', successUrl: 's', cancelUrl: 'c' }))
        .rejects.toThrow('No price ID configured for enterprise yearly')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    test('a transaction with no checkout URL (no default payment link) is an error that says what to set', async () => {
      mockFetch.mockResolvedValueOnce(answer({ id: 'txn_3', checkout: null }, 201))
      await expect(gateway.createCheckoutSession({ teamId: 't', planSlug: 'pro', billingPeriod: 'monthly', successUrl: 's', cancelUrl: 'c' }))
        .rejects.toThrow('Paddle returned no checkout URL for transaction txn_3: set a default payment link')
    })
  })

  describe('createOneTimeCheckout', () => {
    test('passes the quantity and the metadata, and project metadata cannot replace the team or its token', async () => {
      mockFetch.mockResolvedValueOnce(answer({ id: 'txn_4', checkout: { url: 'https://app.test/pay?_ptxn=txn_4' } }, 201))
      await gateway.createOneTimeCheckout({
        teamId: 'team-1', priceId: 'pri_credits', quantity: 3, successUrl: 's', cancelUrl: 'c',
        metadata: { type: 'credit_pack', teamId: 'team-evil', teamToken: 'f'.repeat(64) },
      })
      expect(call().body).toEqual({
        items: [{ price_id: 'pri_credits', quantity: 3 }],
        custom_data: { type: 'credit_pack', teamId: 'team-1', teamToken: paddleTeamToken('team-1', 'pri_credits', SECRET) },
      })
    })
  })

  describe('createPortalSession', () => {
    test('creates a portal session for the customer and returns the overview link', async () => {
      mockFetch.mockResolvedValueOnce(answer({ id: 'cpls_1', urls: { general: { overview: 'https://customer-portal.paddle.com/cpl_1?action=overview&token=t' }, subscriptions: [] } }, 201))
      expect(await gateway.createPortalSession({ customerId: 'ctm_1', returnUrl: 'https://app.test' })).toEqual({ url: 'https://customer-portal.paddle.com/cpl_1?action=overview&token=t' })
      expect(call()).toMatchObject({ method: 'POST', path: '/customers/ctm_1/portal-sessions', body: {} })
    })

    test('throws when the session has no overview link', async () => {
      mockFetch.mockResolvedValueOnce(answer({ id: 'cpls_2', urls: {} }, 201))
      await expect(gateway.createPortalSession({ customerId: 'ctm_1', returnUrl: 'r' })).rejects.toThrow('Paddle returned no customer portal URL for customer ctm_1')
    })
  })

  describe('customers', () => {
    test('getCustomer maps the customer entity', async () => {
      mockFetch.mockResolvedValueOnce(answer({ id: 'ctm_1', email: 'a@example.test', name: 'A' }))
      expect(await gateway.getCustomer('ctm_1')).toEqual({ id: 'ctm_1', email: 'a@example.test', name: 'A' })
    })

    test('createCustomer posts the email, name and metadata as custom data', async () => {
      mockFetch.mockResolvedValueOnce(answer({ id: 'ctm_2', email: 'b@example.test', name: 'B' }, 201))
      expect(await gateway.createCustomer({ email: 'b@example.test', name: 'B', metadata: { teamId: 'team-1' } })).toEqual({ id: 'ctm_2', email: 'b@example.test', name: 'B' })
      expect(call()).toMatchObject({ method: 'POST', path: '/customers', body: { email: 'b@example.test', name: 'B', custom_data: { teamId: 'team-1' } } })
    })
  })

  describe('subscriptions', () => {
    test('updateSubscriptionPlan swaps the plan price, keeps add-on items, prorated on the next bill by default', async () => {
      mockFetch.mockResolvedValueOnce(answer(subscription({ items: [{ price: { id: 'pri_pro_m' }, quantity: 1 }, { price: { id: 'pri_addon' }, quantity: 2 }] })))
      mockFetch.mockResolvedValueOnce(answer(subscription({ items: [{ price: { id: 'pri_ent_m' } }] })))
      expect(await gateway.updateSubscriptionPlan({ subscriptionId: 'sub_01', newPriceId: 'pri_ent_m' })).toEqual({ id: 'sub_01', status: 'active', cancelAtPeriodEnd: false })
      expect(call(0)).toMatchObject({ method: 'GET', path: '/subscriptions/sub_01' })
      expect(call(1)).toMatchObject({
        method: 'PATCH',
        path: '/subscriptions/sub_01',
        body: { items: [{ price_id: 'pri_ent_m', quantity: 1 }, { price_id: 'pri_addon', quantity: 2 }], proration_billing_mode: 'prorated_next_billing_period' },
      })
    })

    test('updateSubscriptionPlan maps the proration behaviors', async () => {
      for (const [behavior, mode] of [['always_invoice', 'prorated_immediately'], ['none', 'full_next_billing_period']] as const) {
        mockFetch.mockReset()
        mockFetch.mockResolvedValueOnce(answer(subscription()))
        mockFetch.mockResolvedValueOnce(answer(subscription()))
        await gateway.updateSubscriptionPlan({ subscriptionId: 'sub_01', newPriceId: 'pri_pro_y', prorationBehavior: behavior })
        expect(call(1).body.proration_billing_mode).toBe(mode)
      }
    })

    test('cancelSubscriptionAtPeriodEnd schedules the cancellation for the next billing period', async () => {
      mockFetch.mockResolvedValueOnce(answer(subscription({ scheduled_change: { action: 'cancel', effective_at: '2026-11-01T00:00:00Z' } })))
      expect(await gateway.cancelSubscriptionAtPeriodEnd('sub_01')).toEqual({ id: 'sub_01', status: 'active', cancelAtPeriodEnd: true })
      expect(call()).toMatchObject({ method: 'POST', path: '/subscriptions/sub_01/cancel', body: { effective_from: 'next_billing_period' } })
    })

    test('cancelSubscriptionImmediately cancels with effective_from immediately', async () => {
      mockFetch.mockResolvedValueOnce(answer(subscription({ status: 'canceled' })))
      expect(await gateway.cancelSubscriptionImmediately('sub_01')).toEqual({ id: 'sub_01', status: 'canceled', cancelAtPeriodEnd: false })
      expect(call()).toMatchObject({ method: 'POST', path: '/subscriptions/sub_01/cancel', body: { effective_from: 'immediately' } })
    })

    test('reactivateSubscription removes the scheduled change', async () => {
      mockFetch.mockResolvedValueOnce(answer(subscription()))
      expect(await gateway.reactivateSubscription('sub_01')).toEqual({ id: 'sub_01', status: 'active', cancelAtPeriodEnd: false })
      expect(call()).toMatchObject({ method: 'PATCH', path: '/subscriptions/sub_01', body: { scheduled_change: null } })
    })
  })

  describe('webhook signature', () => {
    const body = JSON.stringify({ event_id: 'evt_1', event_type: 'subscription.created', occurred_at: '2026-10-01T00:00:00.000000Z', data: { id: 'sub_01' } })
    let now: jest.SpiedFunction<typeof Date.now>

    beforeEach(() => {
      now = jest.spyOn(Date, 'now').mockReturnValue(NOW * 1000)
    })

    afterEach(() => now.mockRestore())

    test('a valid signature returns the event with Paddle\'s event_id', () => {
      expect(gateway.verifyWebhookSignature(body, header(body))).toEqual({ id: 'evt_1', type: 'subscription.created', data: JSON.parse(body) })
    })

    test('the raw body as a Buffer, and the signature from the headers', () => {
      expect(gateway.verifyWebhookSignature(Buffer.from(body), { 'paddle-signature': header(body) }).id).toBe('evt_1')
    })

    test('an invalid signature is rejected', () => {
      expect(() => gateway.verifyWebhookSignature(body, `ts=${NOW};h1=${'f'.repeat(64)}`)).toThrow('Paddle webhook verification failed')
    })

    test('a missing signature is rejected', () => {
      expect(() => gateway.verifyWebhookSignature(body, '')).toThrow('Paddle webhook verification failed')
      expect(() => gateway.verifyWebhookSignature(body, {})).toThrow('Paddle webhook verification failed')
    })

    test('a tampered body is rejected', () => {
      expect(isValidPaddleSignature(body.replace('sub_01', 'sub_02'), header(body), SECRET, NOW)).toBe(false)
      expect(isValidPaddleSignature(`${body} `, header(body), SECRET, NOW)).toBe(false)
      // the timestamp is part of what is signed
      expect(isValidPaddleSignature(body, `ts=${NOW + 1};h1=${h1(NOW, body)}`, SECRET, NOW)).toBe(false)
    })

    test('a signature made with another secret is rejected', () => {
      expect(isValidPaddleSignature(body, header(body, NOW, 'pdl_ntfset_other'), SECRET, NOW)).toBe(false)
    })

    test('a timestamp more than five seconds away from now is rejected (replay window)', () => {
      expect(isValidPaddleSignature(body, header(body, NOW - 5), SECRET, NOW)).toBe(true)
      expect(isValidPaddleSignature(body, header(body, NOW - 6), SECRET, NOW)).toBe(false)
      expect(isValidPaddleSignature(body, header(body, NOW + 6), SECRET, NOW)).toBe(false)
      expect(() => gateway.verifyWebhookSignature(body, header(body, NOW - 3600))).toThrow('Paddle webhook verification failed')
    })

    test('the gateway verifies with the configured tolerance', () => {
      const wide = new PaddleGateway({ ...ENV, PADDLE_WEBHOOK_TOLERANCE_SECONDS: '60' })
      expect(() => gateway.verifyWebhookSignature(body, header(body, NOW - 30))).toThrow('Paddle webhook verification failed')
      expect(wide.verifyWebhookSignature(body, header(body, NOW - 30)).id).toBe('evt_1')
      expect(() => wide.verifyWebhookSignature(body, header(body, NOW - 61))).toThrow('Paddle webhook verification failed')
    })

    test('a malformed header is rejected before comparing', () => {
      const sig = h1(NOW, body)
      for (const malformed of [
        sig, // no ts=
        `ts=${NOW}`, // no h1
        `h1=${sig}`, // no ts
        `ts=abc;h1=${sig}`,
        `ts=${NOW};h1=${sig.slice(2)}`,
        `ts=${NOW};h1=${sig}zz`,
        `ts=${NOW};ts=${NOW};h1=${sig}`,
        `ts=${NOW};h1=${sig}=x`,
        `ts=${NOW},h1=${sig}`,
      ]) {
        expect(isValidPaddleSignature(body, malformed, SECRET, NOW)).toBe(false)
      }
    })

    test('several h1 values (a secret rotation): any one matching is enough', () => {
      const old = h1(NOW, body, 'pdl_ntfset_old')
      expect(isValidPaddleSignature(body, `ts=${NOW};h1=${old};h1=${h1(NOW, body)}`, SECRET, NOW)).toBe(true)
      expect(isValidPaddleSignature(body, `ts=${NOW};h1=${h1(NOW, body)};h1=${old}`, SECRET, NOW)).toBe(true)
      expect(isValidPaddleSignature(body, `ts=${NOW};h1=${old};h1=${'0'.repeat(64)}`, SECRET, NOW)).toBe(false)
    })

    test('a signed body with no event_id or event_type is rejected', () => {
      const noId = JSON.stringify({ event_type: 'subscription.created', data: { id: 'sub_01' } })
      expect(() => gateway.verifyWebhookSignature(noId, header(noId))).toThrow('Paddle webhook has no event_id, event_type or data')
      const noType = JSON.stringify({ event_id: 'evt_2', data: { id: 'sub_01' } })
      expect(() => gateway.verifyWebhookSignature(noType, header(noType))).toThrow('Paddle webhook has no event_id, event_type or data')
    })
  })

  describe('team token', () => {
    test('is valid only for its team, price and secret', () => {
      const token = paddleTeamToken('team-1', 'pri_pro_m', SECRET)
      expect(isValidPaddleTeamToken('team-1', ['pri_pro_m'], token, SECRET)).toBe(true)
      expect(isValidPaddleTeamToken('team-1', ['pri_pro_y', 'pri_pro_m'], token, SECRET)).toBe(true)
      expect(isValidPaddleTeamToken('team-2', ['pri_pro_m'], token, SECRET)).toBe(false)
      expect(isValidPaddleTeamToken('team-1', ['pri_pro_y'], token, SECRET)).toBe(false)
      expect(isValidPaddleTeamToken('team-1', ['pri_pro_m'], token, 'other')).toBe(false)
      expect(isValidPaddleTeamToken('team-1', ['pri_pro_m'], token.toUpperCase(), SECRET)).toBe(false)
      expect(isValidPaddleTeamToken('team-1', ['pri_pro_m'], undefined, SECRET)).toBe(false)
      expect(isValidPaddleTeamToken('team-1', [], token, SECRET)).toBe(false)
    })
  })

  describe('metadata', () => {
    test('name, resource hints and dashboard URL', () => {
      expect(gateway.getProviderName()).toBe('Paddle')
      expect(gateway.getResourceHintDomains()).toEqual({ preconnect: [], dnsPrefetch: [] })
      expect(gateway.getSubscriptionDashboardUrl('sub_01')).toBe('https://sandbox-vendors.paddle.com')
      expect(gateway.getSubscriptionDashboardUrl(null)).toBeNull()
    })
  })

  describe('getBillingGateway() factory', () => {
    beforeEach(() => resetBillingGateway())

    test('returns a PaddleGateway when provider is paddle', async () => {
      expect(await getBillingGateway()).toBeInstanceOf(PaddleGateway)
    })

    test('a misconfigured environment fails at selection, and a fixed one is picked up on the next call', async () => {
      delete process.env.PADDLE_ENVIRONMENT
      await expect(getBillingGateway()).rejects.toThrow('Paddle billing is misconfigured: PADDLE_ENVIRONMENT is missing (sandbox or production).')
      process.env.PADDLE_ENVIRONMENT = 'sandbox'
      expect(await getBillingGateway()).toBeInstanceOf(PaddleGateway)
    })
  })
})
