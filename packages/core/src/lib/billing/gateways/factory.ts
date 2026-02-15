/**
 * Billing Gateway Factory
 *
 * Returns the configured BillingGateway implementation based on the
 * provider setting in the billing registry. Uses lazy loading so that
 * provider SDKs (Stripe, Polar, etc.) are only imported when needed.
 *
 * Usage:
 *   import { getBillingGateway } from '@nextsparkjs/core/lib/billing/gateways/factory'
 *   const session = await getBillingGateway().createCheckoutSession(params)
 */

import { BILLING_REGISTRY } from '@nextsparkjs/registries/billing-registry'
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
      case 'stripe': {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { StripeGateway } = require('./stripe') as typeof import('./stripe')
        gatewayInstance = new StripeGateway()
        break
      }
      case 'polar': {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { PolarGateway } = require('./polar') as typeof import('./polar')
        gatewayInstance = new PolarGateway()
        break
      }
      // Future providers:
      // case 'paddle': { ... }
      // case 'lemonsqueezy': { ... }
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
 * Reset the cached gateway instance.
 * Useful for testing or when billing config changes at runtime.
 */
export function resetBillingGateway(): void {
  gatewayInstance = null
}
