/**
 * Custom billing gateways.
 *
 * A project registers its own `BillingGateway` under a name and sets that name as `provider` in billing.config.ts.
 * Call it from server startup code (the project's `instrumentation.ts` `register()`), never from client code:
 *
 *   registerBillingGateway('acme', async () => (await import('./lib/acme-gateway')).createAcmeGateway())
 *
 * A registered name wins over a built-in one, so a project can also replace a built-in gateway.
 * The store lives on globalThis because the startup code and each route bundle may hold their own copy of this module.
 */

import type { BillingGateway } from './interface'
import { InvalidBillingGatewayError } from './errors'

export type BillingGatewayFactory = () => BillingGateway | Promise<BillingGateway>

const STORE = Symbol.for('nextspark.billing.customGateways')
const NAME_PATTERN = /^[a-z][a-z0-9_-]{1,31}$/

const BUILT_IN_NAMES = ['stripe', 'polar', 'lemonsqueezy', 'paddle']

/** `none` is the no-gateway mode, so it cannot name a gateway. */
const RESERVED_NAMES = ['none']

/** Every method of the BillingGateway contract. `verifyWebhookSignature` is part of it: no gateway handles webhooks unverified. */
export const BILLING_GATEWAY_METHODS = [
  'createCheckoutSession',
  'createOneTimeCheckout',
  'createPortalSession',
  'getCustomer',
  'createCustomer',
  'updateSubscriptionPlan',
  'cancelSubscriptionAtPeriodEnd',
  'cancelSubscriptionImmediately',
  'reactivateSubscription',
  'getProviderName',
  'getResourceHintDomains',
  'getSubscriptionDashboardUrl',
  'verifyWebhookSignature',
] as const

function store(): Map<string, BillingGatewayFactory> {
  const holder = globalThis as unknown as Record<symbol, Map<string, BillingGatewayFactory> | undefined>
  return (holder[STORE] ??= new Map())
}

export function isValidBillingProviderName(name: unknown): name is string {
  return typeof name === 'string' && NAME_PATTERN.test(name) && !RESERVED_NAMES.includes(name)
}

export function registerBillingGateway(name: string, factory: BillingGatewayFactory): void {
  if (!isValidBillingProviderName(name)) {
    throw new InvalidBillingGatewayError(
      `Invalid billing gateway name ${JSON.stringify(name)}: use 2-32 lowercase letters, digits, "-" or "_", starting with a letter ("none" is reserved for the no-gateway mode).`
    )
  }
  if (typeof factory !== 'function') {
    throw new InvalidBillingGatewayError(`Billing gateway "${name}" must be registered with a factory function.`)
  }
  if (BUILT_IN_NAMES.includes(name) && !store().has(name)) {
    console.warn(`[billing] A registered gateway replaces the built-in "${name}" gateway.`)
  }
  store().set(name, factory)
}

export function getRegisteredBillingGateway(name: string): BillingGatewayFactory | undefined {
  return store().get(name)
}

export function getRegisteredBillingGatewayNames(): string[] {
  return [...store().keys()]
}

/** Test and hot-reload helper: forget every registered gateway. */
export function clearRegisteredBillingGateways(): void {
  store().clear()
}

/** Throws InvalidBillingGatewayError, naming the gateway and the missing members (never values), unless `gateway` satisfies the contract. */
export function assertValidBillingGateway(name: string, gateway: unknown): asserts gateway is BillingGateway {
  const candidate = (typeof gateway === 'object' && gateway !== null ? gateway : {}) as Record<string, unknown>
  const missing = BILLING_GATEWAY_METHODS.filter((method) => typeof candidate[method] !== 'function')
  if (missing.length > 0) {
    throw new InvalidBillingGatewayError(
      `Billing gateway "${name}" does not satisfy the BillingGateway contract; missing: ${missing.join(', ')}.` +
      (missing.includes('verifyWebhookSignature') ? ' A gateway must verify webhook signatures (verifyWebhookSignature).' : '')
    )
  }
}
