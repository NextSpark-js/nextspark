/**
 * Billing Gateway Factory
 *
 * Returns the configured BillingGateway implementation based on the
 * provider setting in the billing registry.
 *
 * Usage:
 *   import { getBillingGateway } from '@nextsparkjs/core/lib/billing/gateways/factory'
 *   const session = await getBillingGateway().createCheckoutSession(params)
 */

import { BILLING_REGISTRY } from '@nextsparkjs/registries/billing-registry'
import type { BillingGateway } from './interface'

let gatewayInstance: BillingGateway | null = null
let gatewayLoading: Promise<BillingGateway> | null = null

/**
 * Get the billing gateway for the configured payment provider.
 * Singleton - the same instance is returned on subsequent calls.
 *
 * Provider is determined by BILLING_REGISTRY.config.provider (from billing.config.ts).
 *
 * Gateway modules are imported dynamically inside the switch so that only the
 * configured provider's SDK ends up in the bundle (see #127). Every call site
 * that transitively imports this factory (root layout resource hints, auth
 * pages, ...) would otherwise ship every provider SDK.
 */
export async function getBillingGateway(): Promise<BillingGateway> {
  if (gatewayInstance) {
    return gatewayInstance
  }
  if (!gatewayLoading) {
    gatewayLoading = loadGateway()
      .then((gateway) => {
        gatewayInstance = gateway
        return gateway
      })
      .finally(() => {
        gatewayLoading = null
      })
  }
  return gatewayLoading
}

async function loadGateway(): Promise<BillingGateway> {
  const provider = BILLING_REGISTRY.provider
  switch (provider) {
    case 'stripe': {
      const { StripeGateway } = await import('./stripe')
      return new StripeGateway()
    }
    case 'polar': {
      const { PolarGateway } = await import('./polar')
      return new PolarGateway()
    }
    // Future providers (each one only enters the bundle when configured):
    // case 'paddle': { const { PaddleGateway } = await import('./paddle'); return new PaddleGateway() }
    // case 'lemonsqueezy': { ... }
    // case 'mercadopago': { ... }
    default:
      throw new Error(
        `Unsupported billing provider: "${provider}". ` +
        `Supported providers: stripe, polar. ` +
        `Check your billing.config.ts provider setting.`
      )
  }
}

/**
 * Get resource hint domains for the configured billing provider.
 * Use in <head> for performance optimization.
 *
 * @example
 * // In layout.tsx:
 * const { preconnect, dnsPrefetch } = getBillingResourceHints()
 */
export async function getBillingResourceHints(): Promise<{ preconnect: string[]; dnsPrefetch: string[] }> {
  try {
    const gateway = await getBillingGateway()
    return gateway.getResourceHintDomains()
  } catch {
    return { preconnect: [], dnsPrefetch: [] }
  }
}

/**
 * Reset the cached gateway instance.
 * Useful for testing or when billing config changes at runtime.
 */
export function resetBillingGateway(): void {
  gatewayInstance = null
  gatewayLoading = null
}
