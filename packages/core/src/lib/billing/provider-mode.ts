/**
 * The no-gateway mode (`provider: 'none'` in billing.config.ts).
 *
 * Core still manages plans, limits and entitlements; there is no checkout, portal, cancellation or webhook, and no
 * provider SDK or resource hint. Client-safe: it only reads the provider name from the registry.
 */

import { BILLING_REGISTRY } from '@nextsparkjs/registries/billing-registry'

export const NO_GATEWAY_PROVIDER = 'none'

const BUILT_IN_PROVIDERS = ['stripe', 'polar', 'lemonsqueezy', 'paddle']

/**
 * True when the configured provider is not one of the four built-in ones (no gateway, a custom gateway, or a
 * name nothing serves). The built-in webhook routes answer 404 then: a custom gateway has its own route, and an
 * event of it must not be claimed under a built-in namespace. A registered gateway named after a built-in keeps its route.
 */
export function builtInWebhookRoutesClosed(): boolean {
  const provider = BILLING_REGISTRY.provider
  return typeof provider === 'string' && !BUILT_IN_PROVIDERS.includes(provider)
}

export function isBillingGatewayDisabled(): boolean {
  return BILLING_REGISTRY.provider === NO_GATEWAY_PROVIDER
}
