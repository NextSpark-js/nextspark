/**
 * Unit tests for the Lemon Squeezy Payment Gateway (#268)
 *
 * Tests the LemonSqueezyGateway class, the webhook signature check and the getBillingGateway() factory.
 * `fetch` is mocked: no call reaches Lemon Squeezy. The response bodies are hand-built from the shapes in
 * Lemon Squeezy's API reference (docs.lemonsqueezy.com/api), not recorded from a real store.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { createHmac } from 'node:crypto'

jest.mock('@/core/lib/registries/billing-registry', () => ({
  BILLING_REGISTRY: {
    provider: 'lemonsqueezy',
    plans: [
      { slug: 'free', name: 'Free', providerPriceIds: { monthly: null, yearly: null }, limits: {}, features: [] },
      { slug: 'pro', name: 'Pro', providerPriceIds: { monthly: '1001', yearly: '1002' }, trialDays: 14, limits: {}, features: [] },
      { slug: 'enterprise', name: 'Enterprise', providerPriceIds: { monthly: '2001', yearly: null }, limits: {}, features: [] },
    ],
    limits: {},
  },
}))

import {
  LemonSqueezyGateway,
  isValidLemonSqueezySignature,
  lemonSqueezyConfigFromEnv,
  lemonSqueezyEventId,
} from '@/core/lib/billing/gateways/lemonsqueezy'
import { isValidLemonSqueezyTeamToken, lemonSqueezyTeamToken } from '@/core/lib/billing/lemonsqueezy-webhook'
import { getBillingGateway, resetBillingGateway } from '@/core/lib/billing/gateways/factory'

const SECRET = 'ls_webhook_secret_mock'
const ENV = { LEMONSQUEEZY_API_KEY: 'ls_api_key_mock', LEMONSQUEEZY_STORE_ID: '4242', LEMONSQUEEZY_WEBHOOK_SECRET: SECRET }

const sign = (body: string, secret = SECRET) => createHmac('sha256', secret).update(body).digest('hex')

const mockFetch = jest.fn<typeof fetch>()

/** A JSON:API answer. */
function answer(data: unknown, status = 200) {
  return new Response(JSON.stringify(status < 300 ? { jsonapi: { version: '1.0' }, data } : data), {
    status,
    headers: { 'Content-Type': 'application/vnd.api+json' },
  })
}

function subscription(attributes: Record<string, unknown> = {}) {
  return { type: 'subscriptions', id: '555', attributes: { store_id: 4242, status: 'active', cancelled: false, ...attributes } }
}

/** The method, path and JSON body of the n-th fetch call. */
function call(n = 0) {
  const [url, init] = mockFetch.mock.calls[n] as [string, RequestInit]
  return {
    method: init.method,
    path: url.replace('https://api.lemonsqueezy.com/v1', ''),
    headers: init.headers as Record<string, string>,
    body: init.body ? JSON.parse(init.body as string) : undefined,
  }
}

describe('Lemon Squeezy Gateway', () => {
  const originalEnv = process.env
  const originalFetch = global.fetch
  let gateway: LemonSqueezyGateway

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv, ...ENV }
    global.fetch = mockFetch as typeof fetch
    gateway = new LemonSqueezyGateway()
  })

  afterEach(() => {
    process.env = originalEnv
    global.fetch = originalFetch
  })

  describe('configuration', () => {
    test('reads the three variables', () => {
      expect(lemonSqueezyConfigFromEnv(ENV)).toEqual({ apiKey: 'ls_api_key_mock', storeId: '4242', webhookSecret: SECRET })
    })

    test('names every missing variable, and no value', () => {
      expect(() => lemonSqueezyConfigFromEnv({})).toThrow(
        'Lemon Squeezy billing is misconfigured: LEMONSQUEEZY_API_KEY is missing; LEMONSQUEEZY_STORE_ID is missing; LEMONSQUEEZY_WEBHOOK_SECRET is missing.'
      )
      let message = ''
      try {
        lemonSqueezyConfigFromEnv({ ...ENV, LEMONSQUEEZY_STORE_ID: 'my-store-secret-slug' })
      } catch (error) {
        message = (error as Error).message
      }
      expect(message).toBe('Lemon Squeezy billing is misconfigured: LEMONSQUEEZY_STORE_ID must be the numeric store id.')
      expect(message).not.toContain('my-store-secret-slug')
      expect(message).not.toContain('ls_api_key_mock')
    })

    test('the gateway validates the environment when it is created (selection time)', () => {
      expect(() => new LemonSqueezyGateway({ LEMONSQUEEZY_API_KEY: 'k' })).toThrow(/LEMONSQUEEZY_STORE_ID is missing; LEMONSQUEEZY_WEBHOOK_SECRET is missing/)
    })
  })

  describe('createCheckoutSession', () => {
    test('creates a checkout for the plan variant with the team in the custom data', async () => {
      mockFetch.mockResolvedValueOnce(answer({ type: 'checkouts', id: 'chk_1', attributes: { url: 'https://store.lemonsqueezy.com/checkout/custom/abc' } }, 201))

      const result = await gateway.createCheckoutSession({
        teamId: 'team-1',
        planSlug: 'pro',
        billingPeriod: 'monthly',
        successUrl: 'https://app.test/billing?success=true',
        cancelUrl: 'https://app.test/billing?canceled=true',
        customerEmail: 'owner@example.test',
      })

      expect(result).toEqual({ id: 'chk_1', url: 'https://store.lemonsqueezy.com/checkout/custom/abc' })
      const sent = call()
      expect(sent.method).toBe('POST')
      expect(sent.path).toBe('/checkouts')
      expect(sent.headers).toEqual({
        Accept: 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        Authorization: 'Bearer ls_api_key_mock',
      })
      expect(sent.body).toEqual({
        data: {
          type: 'checkouts',
          attributes: {
            product_options: { redirect_url: 'https://app.test/billing?success=true', enabled_variants: [1001] },
            checkout_data: {
              email: 'owner@example.test',
              custom: { teamId: 'team-1', planSlug: 'pro', billingPeriod: 'monthly', teamToken: lemonSqueezyTeamToken('team-1', SECRET) },
            },
          },
          relationships: {
            store: { data: { type: 'stores', id: '4242' } },
            variant: { data: { type: 'variants', id: '1001' } },
          },
        },
      })
    })

    test('uses the yearly variant when billingPeriod is yearly', async () => {
      mockFetch.mockResolvedValueOnce(answer({ type: 'checkouts', id: 'chk_2', attributes: { url: 'u' } }, 201))
      await gateway.createCheckoutSession({ teamId: 't', planSlug: 'pro', billingPeriod: 'yearly', successUrl: 's', cancelUrl: 'c' })
      expect(call().body.data.relationships.variant.data.id).toBe('1002')
    })

    test('throws for an unknown plan and for a plan with no variant', async () => {
      await expect(gateway.createCheckoutSession({ teamId: 't', planSlug: 'nope', billingPeriod: 'monthly', successUrl: 's', cancelUrl: 'c' }))
        .rejects.toThrow('Plan nope not found in BILLING_REGISTRY')
      await expect(gateway.createCheckoutSession({ teamId: 't', planSlug: 'enterprise', billingPeriod: 'yearly', successUrl: 's', cancelUrl: 'c' }))
        .rejects.toThrow('No variant ID configured for enterprise yearly')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    test('an API error carries its detail and status, never the key', async () => {
      mockFetch.mockResolvedValueOnce(answer({ errors: [{ status: '422', title: 'Unprocessable Entity', detail: 'The variant is not available.' }] }, 422))
      const error = await gateway.createCheckoutSession({ teamId: 't', planSlug: 'pro', billingPeriod: 'monthly', successUrl: 's', cancelUrl: 'c' })
        .catch((e: Error) => e)
      expect((error as Error).message).toBe('Lemon Squeezy API POST /checkouts failed with status 422: The variant is not available.')
      expect((error as Error).message).not.toContain('ls_api_key_mock')
    })
  })

  describe('createOneTimeCheckout', () => {
    test('passes the quantity and the metadata, and project metadata cannot replace the team', async () => {
      mockFetch.mockResolvedValueOnce(answer({ type: 'checkouts', id: 'chk_3', attributes: { url: 'u3' } }, 201))
      const result = await gateway.createOneTimeCheckout({
        teamId: 'team-1',
        priceId: '3001',
        quantity: 3,
        successUrl: 's',
        cancelUrl: 'c',
        metadata: { type: 'credit_pack', teamId: 'team-evil', teamToken: 'x' },
      })
      expect(result).toEqual({ id: 'chk_3', url: 'u3' })
      const data = call().body.data
      expect(data.relationships.variant.data.id).toBe('3001')
      expect(data.attributes.checkout_data.variant_quantities).toEqual([{ variant_id: 3001, quantity: 3 }])
      expect(data.attributes.checkout_data.custom).toEqual({
        type: 'credit_pack',
        teamId: 'team-1',
        teamToken: lemonSqueezyTeamToken('team-1', SECRET),
      })
    })

    test('quantity 1 sends no variant_quantities', async () => {
      mockFetch.mockResolvedValueOnce(answer({ type: 'checkouts', id: 'chk_4', attributes: { url: 'u4' } }, 201))
      await gateway.createOneTimeCheckout({ teamId: 't', priceId: '3001', successUrl: 's', cancelUrl: 'c' })
      expect(call().body.data.attributes.checkout_data.variant_quantities).toBeUndefined()
    })
  })

  describe('createPortalSession', () => {
    test('returns the customer portal URL of the customer', async () => {
      mockFetch.mockResolvedValueOnce(answer({ type: 'customers', id: '77', attributes: { urls: { customer_portal: 'https://store.lemonsqueezy.com/billing?expires=1&signature=s' } } }))
      expect(await gateway.createPortalSession({ customerId: '77', returnUrl: 'r' })).toEqual({ url: 'https://store.lemonsqueezy.com/billing?expires=1&signature=s' })
      expect(call()).toMatchObject({ method: 'GET', path: '/customers/77' })
    })

    test('throws when the customer has no portal URL', async () => {
      mockFetch.mockResolvedValueOnce(answer({ type: 'customers', id: '77', attributes: { urls: { customer_portal: null } } }))
      await expect(gateway.createPortalSession({ customerId: '77', returnUrl: 'r' })).rejects.toThrow(/no customer portal URL/)
    })
  })

  describe('customers', () => {
    test('getCustomer maps the customer object', async () => {
      mockFetch.mockResolvedValueOnce(answer({ type: 'customers', id: '77', attributes: { email: 'a@b.test', name: 'A B' } }))
      expect(await gateway.getCustomer('77')).toEqual({ id: '77', email: 'a@b.test', name: 'A B' })
    })

    test('createCustomer posts to the store, with the email as the name when there is none', async () => {
      mockFetch.mockResolvedValueOnce(answer({ type: 'customers', id: '78', attributes: { email: 'c@d.test', name: 'c@d.test' } }, 201))
      expect(await gateway.createCustomer({ email: 'c@d.test' })).toEqual({ id: '78', email: 'c@d.test', name: 'c@d.test' })
      expect(call()).toMatchObject({
        method: 'POST',
        path: '/customers',
        body: { data: { type: 'customers', attributes: { name: 'c@d.test', email: 'c@d.test' }, relationships: { store: { data: { type: 'stores', id: '4242' } } } } },
      })
    })
  })

  describe('subscriptions', () => {
    test('updateSubscriptionPlan patches the variant, prorated by default', async () => {
      mockFetch.mockResolvedValueOnce(answer(subscription({ variant_id: 1002 })))
      expect(await gateway.updateSubscriptionPlan({ subscriptionId: '555', newPriceId: '1002' })).toEqual({ id: '555', status: 'active', cancelAtPeriodEnd: false })
      expect(call()).toEqual(expect.objectContaining({
        method: 'PATCH',
        path: '/subscriptions/555',
        body: { data: { type: 'subscriptions', id: '555', attributes: { variant_id: 1002 } } },
      }))
    })

    test('updateSubscriptionPlan maps the proration behaviors', async () => {
      mockFetch.mockResolvedValue(answer(subscription()))
      await gateway.updateSubscriptionPlan({ subscriptionId: '555', newPriceId: '1002', prorationBehavior: 'none' })
      mockFetch.mockResolvedValue(answer(subscription()))
      await gateway.updateSubscriptionPlan({ subscriptionId: '555', newPriceId: '1002', prorationBehavior: 'always_invoice' })
      expect(call(0).body.data.attributes).toEqual({ variant_id: 1002, disable_prorations: true })
      expect(call(1).body.data.attributes).toEqual({ variant_id: 1002, invoice_immediately: true })
    })

    test('cancelSubscriptionAtPeriodEnd deletes the subscription (grace period until ends_at)', async () => {
      mockFetch.mockResolvedValueOnce(answer(subscription({ status: 'cancelled', cancelled: true })))
      expect(await gateway.cancelSubscriptionAtPeriodEnd('555')).toEqual({ id: '555', status: 'cancelled', cancelAtPeriodEnd: true })
      expect(call()).toMatchObject({ method: 'DELETE', path: '/subscriptions/555' })
    })

    test('cancelSubscriptionImmediately is refused without calling the API', async () => {
      await expect(gateway.cancelSubscriptionImmediately('555')).rejects.toThrow(/cannot cancel a subscription immediately/)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    test('reactivateSubscription resumes it with cancelled: false', async () => {
      mockFetch.mockResolvedValueOnce(answer(subscription()))
      expect(await gateway.reactivateSubscription('555')).toEqual({ id: '555', status: 'active', cancelAtPeriodEnd: false })
      expect(call().body).toEqual({ data: { type: 'subscriptions', id: '555', attributes: { cancelled: false } } })
    })
  })

  describe('webhook signature', () => {
    const body = JSON.stringify({
      meta: { event_name: 'subscription_updated', custom_data: { teamId: 'team-1' } },
      data: { type: 'subscriptions', id: '555', attributes: { updated_at: '2026-10-01T10:00:00.000000Z' } },
    })

    test('a valid signature returns the event with its derived id', () => {
      const event = gateway.verifyWebhookSignature(body, sign(body))
      expect(event.id).toBe('subscription_updated:subscriptions:555:2026-10-01T10:00:00.000000Z')
      expect(event.type).toBe('subscription_updated')
      expect(event.data).toEqual(JSON.parse(body))
    })

    test('the raw body as a Buffer, and the signature from the headers', () => {
      expect(gateway.verifyWebhookSignature(Buffer.from(body), { 'x-signature': sign(body) }).type).toBe('subscription_updated')
    })

    test('an invalid signature is rejected', () => {
      expect(() => gateway.verifyWebhookSignature(body, 'f'.repeat(64))).toThrow(/verification failed/)
    })

    test('a missing signature is rejected', () => {
      expect(() => gateway.verifyWebhookSignature(body, '')).toThrow(/verification failed/)
      expect(() => gateway.verifyWebhookSignature(body, {})).toThrow(/verification failed/)
    })

    test('a tampered body is rejected', () => {
      const signature = sign(body)
      expect(() => gateway.verifyWebhookSignature(body.replace('team-1', 'team-2'), signature)).toThrow(/verification failed/)
      expect(() => gateway.verifyWebhookSignature(body + ' ', signature)).toThrow(/verification failed/)
    })

    test('a signature made with another secret is rejected', () => {
      expect(() => gateway.verifyWebhookSignature(body, sign(body, 'another_secret'))).toThrow(/verification failed/)
    })

    test('a signature that is not 64 hex characters is rejected before comparing', () => {
      const signature = sign(body)
      expect(isValidLemonSqueezySignature(body, signature.toUpperCase(), SECRET)).toBe(true)
      expect(isValidLemonSqueezySignature(body, signature.slice(0, 62), SECRET)).toBe(false)
      expect(isValidLemonSqueezySignature(body, `${signature.slice(0, 62)}zz`, SECRET)).toBe(false)
      expect(isValidLemonSqueezySignature(body, `${signature}00`, SECRET)).toBe(false)
      expect(isValidLemonSqueezySignature(body, null, SECRET)).toBe(false)
    })

    test('a signed body with no event name is rejected', () => {
      const noName = JSON.stringify({ meta: {}, data: { type: 'orders', id: '1', attributes: {} } })
      expect(() => gateway.verifyWebhookSignature(noName, sign(noName))).toThrow(/no meta.event_name/)
    })

    test('the event id is stable for a redelivery and differs per event name and update', () => {
      const parsed = JSON.parse(body)
      expect(lemonSqueezyEventId(parsed)).toBe(lemonSqueezyEventId(JSON.parse(body)))
      expect(lemonSqueezyEventId({ ...parsed, meta: { event_name: 'subscription_cancelled' } })).not.toBe(lemonSqueezyEventId(parsed))
      expect(lemonSqueezyEventId({ ...parsed, data: { ...parsed.data, attributes: { updated_at: '2026-10-02T10:00:00.000000Z' } } }))
        .not.toBe(lemonSqueezyEventId(parsed))
    })
  })

  describe('team token', () => {
    test('is valid only for its team and secret', () => {
      const token = lemonSqueezyTeamToken('team-1', SECRET)
      expect(isValidLemonSqueezyTeamToken('team-1', token, SECRET)).toBe(true)
      expect(isValidLemonSqueezyTeamToken('team-2', token, SECRET)).toBe(false)
      expect(isValidLemonSqueezyTeamToken('team-1', token, 'other')).toBe(false)
      expect(isValidLemonSqueezyTeamToken('team-1', undefined, SECRET)).toBe(false)
      expect(isValidLemonSqueezyTeamToken('team-1', 'abc', SECRET)).toBe(false)
    })
  })

  describe('metadata', () => {
    test('name, resource hints and dashboard URL', () => {
      expect(gateway.getProviderName()).toBe('Lemon Squeezy')
      expect(gateway.getResourceHintDomains()).toEqual({ preconnect: [], dnsPrefetch: [] })
      expect(gateway.getSubscriptionDashboardUrl('555')).toBe('https://app.lemonsqueezy.com/subscriptions')
      expect(gateway.getSubscriptionDashboardUrl(null)).toBeNull()
    })
  })

  describe('getBillingGateway() factory', () => {
    beforeEach(() => resetBillingGateway())

    test('returns a LemonSqueezyGateway when provider is lemonsqueezy', async () => {
      expect(await getBillingGateway()).toBeInstanceOf(LemonSqueezyGateway)
    })

    test('a misconfigured environment fails at selection, and a fixed one is picked up on the next call', async () => {
      delete process.env.LEMONSQUEEZY_WEBHOOK_SECRET
      await expect(getBillingGateway()).rejects.toThrow('Lemon Squeezy billing is misconfigured: LEMONSQUEEZY_WEBHOOK_SECRET is missing.')
      process.env.LEMONSQUEEZY_WEBHOOK_SECRET = SECRET
      expect(await getBillingGateway()).toBeInstanceOf(LemonSqueezyGateway)
    })
  })
})
