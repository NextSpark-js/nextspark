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
import { StripeGateway } from './stripe'
import { PolarGateway } from './polar'
import type { BillingGateway } from './interface'

let gatewayInstance: BillingGateway | null = null

/**
 * Get the billing gateway for the configured payment provider.
 * Singleton - the same instance is returned on subsequent calls.
 *
 * Provider is determined by BILLING_REGISTRY.config.provider (from billing.config.ts).
 */
export function getBillingGateway(): BillingGateway {
  if (!gatewayInstance) {
    const provider = BILLING_REGISTRY.provider
    switch (provider) {
      case 'stripe':
        gatewayInstance = new StripeGateway()
        break
      case 'polar':
        gatewayInstance = new PolarGateway()
        break
      // Future providers:
      // case 'paddle': { ... }
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
  return gatewayInstance
}

/**
 * Get resource hint domains for the configured billing provider.
 * Use in <head> for performance optimization.
 *
 * @example
 * // In layout.tsx:
 * const { preconnect, dnsPrefetch } = getBillingResourceHints()
 */
export function getBillingResourceHints(): { preconnect: string[]; dnsPrefetch: string[] } {
  try {
    return getBillingGateway().getResourceHintDomains()
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
}
