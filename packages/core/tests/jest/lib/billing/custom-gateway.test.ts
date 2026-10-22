/**
 * Custom billing gateways and the no-gateway mode (#322): registration and override, contract validation,
 * built-in resolution unchanged, resource hints, and the webhook helper.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'

const mockRegistry: { provider: string } = { provider: 'acme' }
jest.mock('@/core/lib/registries/billing-registry', () => ({ BILLING_REGISTRY: mockRegistry }))

// The built-in gateway modules: loading one records its name, so "no SDK in no-gateway mode" is observable
const mockLoaded: string[] = []
jest.mock('@/core/lib/billing/gateways/stripe', () => {
  mockLoaded.push('stripe')
  return { StripeGateway: class StripeGateway {} }
})
jest.mock('@/core/lib/billing/gateways/polar', () => {
  mockLoaded.push('polar')
  return { PolarGateway: class PolarGateway {} }
})

import { getBillingGateway, getBillingGatewayOrNull, getBillingResourceHints, resetBillingGateway } from '@/core/lib/billing/gateways/factory'
import {
  BILLING_GATEWAY_METHODS,
  clearRegisteredBillingGateways,
  registerBillingGateway,
} from '@/core/lib/billing/gateways/registry'
import { BillingGatewayDisabledError } from '@/core/lib/billing/gateways/errors'
import { verifyBillingWebhook } from '@/core/lib/billing/gateways/webhook'
import { StripeGateway } from '@/core/lib/billing/gateways/stripe'
import type { BillingGateway } from '@/core/lib/billing/gateways/interface'

const SECRET = 'whsec_super_secret_value'

function makeGateway(overrides: Record<string, unknown> = {}): BillingGateway {
  const gateway: Record<string, unknown> = {}
  for (const method of BILLING_GATEWAY_METHODS) gateway[method] = jest.fn()
  gateway.getProviderName = () => 'Acme'
  gateway.getResourceHintDomains = () => ({ preconnect: ['https://pay.acme.test'], dnsPrefetch: [] })
  return Object.assign(gateway, overrides) as unknown as BillingGateway
}

beforeEach(() => {
  mockRegistry.provider = 'acme'
  mockLoaded.length = 0
  clearRegisteredBillingGateways()
  resetBillingGateway()
})

afterEach(() => jest.restoreAllMocks())

describe('registerBillingGateway', () => {
  test('a registered gateway is resolved for its provider name, once', async () => {
    const gateway = makeGateway()
    const factory = jest.fn(async () => gateway)
    registerBillingGateway('acme', factory)

    expect(await getBillingGateway()).toBe(gateway)
    expect(await getBillingGateway()).toBe(gateway)
    expect(factory).toHaveBeenCalledTimes(1)
    expect(await getBillingResourceHints()).toEqual({ preconnect: ['https://pay.acme.test'], dnsPrefetch: [] })
  })

  test('registering again replaces the gateway even after one was cached', async () => {
    const first = makeGateway()
    const second = makeGateway()
    registerBillingGateway('acme', () => first)
    expect(await getBillingGateway()).toBe(first)

    registerBillingGateway('acme', () => second)
    expect(await getBillingGateway()).toBe(second)
  })

  test('a registered name wins over a built-in one', async () => {
    mockRegistry.provider = 'stripe'
    const gateway = makeGateway()
    registerBillingGateway('stripe', () => gateway)

    expect(await getBillingGateway()).toBe(gateway)
    expect(mockLoaded).toEqual([])
  })

  test.each(['None', 'none', 'a', 'Acme Pay', '1acme', '', 'x'.repeat(33)])('rejects the name %p', (name) => {
    expect(() => registerBillingGateway(name, () => makeGateway())).toThrow(/Invalid billing gateway name/)
  })

  test('rejects a factory that is not a function', () => {
    expect(() => registerBillingGateway('acme', {} as never)).toThrow('Billing gateway "acme" must be registered with a factory function.')
  })
})

describe('contract validation when the gateway loads', () => {
  test('a gateway missing methods fails with their names, before any call', async () => {
    const partial = makeGateway({ createPortalSession: undefined, cancelSubscriptionImmediately: 'nope' })
    registerBillingGateway('acme', () => partial)

    await expect(getBillingGateway()).rejects.toThrow(
      'Billing gateway "acme" does not satisfy the BillingGateway contract; missing: createPortalSession, cancelSubscriptionImmediately.'
    )
  })

  test('a gateway that does not verify webhook signatures is refused, with the reason', async () => {
    registerBillingGateway('acme', () => makeGateway({ verifyWebhookSignature: undefined }))

    await expect(getBillingGateway()).rejects.toThrow(/missing: verifyWebhookSignature\. A gateway must verify webhook signatures/)
  })

  test.each([null, undefined, 'gateway', 42])('a factory that returns %p is refused', async (value) => {
    registerBillingGateway('acme', () => value as never)

    await expect(getBillingGateway()).rejects.toThrow(/does not satisfy the BillingGateway contract/)
  })

  test('a refused gateway is not cached: fixing the registration is picked up', async () => {
    registerBillingGateway('acme', () => ({}) as never)
    await expect(getBillingGateway()).rejects.toThrow()

    const gateway = makeGateway()
    registerBillingGateway('acme', () => gateway)
    expect(await getBillingGateway()).toBe(gateway)
  })

  test('the message never carries a value the gateway holds', async () => {
    registerBillingGateway('acme', () => ({ apiKey: SECRET }) as never)

    const error = await getBillingGateway().catch((e: Error) => e)
    expect((error as Error).message).not.toContain(SECRET)
  })
})

describe('built-in providers are unchanged', () => {
  test('stripe and polar resolve to their gateways with a custom one registered', async () => {
    registerBillingGateway('acme', () => makeGateway())

    mockRegistry.provider = 'stripe'
    expect(await getBillingGateway()).toBeInstanceOf(StripeGateway)

    resetBillingGateway() // the provider is fixed per process; a test switches it
    mockRegistry.provider = 'polar'
    const polar = await getBillingGateway()
    expect(polar.constructor.name).toBe('PolarGateway')
  })

  test('an unknown name still fails with the same message', async () => {
    mockRegistry.provider = 'paypal'

    await expect(getBillingGateway()).rejects.toThrow(
      'Unsupported billing provider: "paypal". Supported providers: stripe, polar, lemonsqueezy, paddle. Check your billing.config.ts provider setting.'
    )
  })

  test('with a custom gateway registered, the same message also lists it', async () => {
    registerBillingGateway('acme', () => makeGateway())
    mockRegistry.provider = 'paypal'

    await expect(getBillingGateway()).rejects.toThrow('Supported providers: stripe, polar, lemonsqueezy, paddle, acme.')
  })
})

describe('no-gateway mode (provider: none)', () => {
  beforeEach(() => {
    mockRegistry.provider = 'none'
  })

  test('the factory answers with BillingGatewayDisabledError and loads no gateway module', async () => {
    registerBillingGateway('acme', () => makeGateway())

    await expect(getBillingGateway()).rejects.toBeInstanceOf(BillingGatewayDisabledError)
    expect(await getBillingGatewayOrNull()).toBeNull()
    expect(mockLoaded).toEqual([])
  })

  test('no provider hints are rendered', async () => {
    expect(await getBillingResourceHints()).toEqual({ preconnect: [], dnsPrefetch: [] })
    expect(mockLoaded).toEqual([])
  })

  test('the webhook helper answers 404 and never reads a gateway', async () => {
    const verified = await verifyBillingWebhook(new Request('http://localhost/hook', { method: 'POST', body: '{}' }))

    expect(verified.ok).toBe(false)
    if (!verified.ok) expect(verified.response.status).toBe(404)
  })
})

describe('verifyBillingWebhook', () => {
  const post = (body: string, headers: Record<string, string> = {}) =>
    new Request('http://localhost/hook', { method: 'POST', body, headers })

  test('passes the raw body and every header to the gateway, and returns its verified event', async () => {
    const verify = jest.fn(() => ({ id: 'evt_1', type: 'sub.updated', data: { ok: true } }))
    registerBillingGateway('acme', () => makeGateway({ verifyWebhookSignature: verify }))

    const verified = await verifyBillingWebhook(post('{"a":1}', { 'x-acme-signature': 'sig' }))

    expect(verified).toEqual({ ok: true, event: { id: 'evt_1', type: 'sub.updated', data: { ok: true } } })
    expect(verify).toHaveBeenCalledWith('{"a":1}', expect.objectContaining({ 'x-acme-signature': 'sig' }))
  })

  test('an invalid signature is a 400 and the event is not returned; the log carries no secret', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    registerBillingGateway('acme', () =>
      makeGateway({
        verifyWebhookSignature: () => {
          throw new Error(`signature mismatch for secret ${SECRET}`)
        },
      })
    )

    const verified = await verifyBillingWebhook(post('{}', { 'x-acme-signature': 'forged' }))

    expect(verified.ok).toBe(false)
    if (!verified.ok) {
      expect(verified.response.status).toBe(400)
      expect(await verified.response.json()).toEqual({ error: 'Invalid signature' })
    }
    expect(JSON.stringify(log.mock.calls)).not.toContain(SECRET)
  })

  test('a gateway that returns something that is not an event is a 400', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    registerBillingGateway('acme', () => makeGateway({ verifyWebhookSignature: () => ({ data: {} }) }))

    const verified = await verifyBillingWebhook(post('{}'))

    expect(verified.ok).toBe(false)
    if (!verified.ok) expect(verified.response.status).toBe(400)
  })
})
