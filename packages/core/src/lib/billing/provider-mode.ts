/**
 * The no-gateway mode (`provider: 'none'` in billing.config.ts).
 *
 * Core still manages plans, limits and entitlements; there is no checkout, portal, cancellation or webhook, and no
 * provider SDK or resource hint. Client-safe: it only reads the provider name from the registry.
 */

import { BILLING_REGISTRY } from '@nextsparkjs/registries/billing-registry'
import { getRegisteredBillingGateway } from './gateways/registry'

export const NO_GATEWAY_PROVIDER = 'none'

const BUILT_IN_PROVIDERS = ['stripe', 'polar', 'lemonsqueezy', 'paddle']

/**
 * True when a built-in webhook route (`stripe`, `polar`, `lemonsqueezy`, `paddle`) must answer 404: the provider is
 * not a built-in one (no gateway, a custom gateway, a name nothing serves), or it is a built-in name that a
 * registered gateway replaces and the route is not that provider's own. A custom gateway has its own route, and its
 * events must never be claimed under another provider's namespace. A built-in provider with no registered gateway
 * keeps the behavior it had: a route that does not match fails signature verification with a 400.
 */
export function builtInWebhookRouteClosed(route: string): boolean {
  const provider = BILLING_REGISTRY.provider
  if (typeof provider !== 'string') return false
  if (!BUILT_IN_PROVIDERS.includes(provider)) return true
  return provider !== route && getRegisteredBillingGateway(provider) !== undefined
}

export function isBillingGatewayDisabled(): boolean {
  return BILLING_REGISTRY.provider === NO_GATEWAY_PROVIDER
}
