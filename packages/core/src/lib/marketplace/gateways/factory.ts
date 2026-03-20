/**
 * Marketplace Gateway Factory
 *
 * Returns the configured MarketplaceGateway implementation.
 * Similar pattern to the billing gateway factory but for marketplace/connect payments.
 *
 * Usage:
 *   import { getMarketplaceGateway } from '@nextsparkjs/core/lib/marketplace/gateways/factory'
 *   const result = await getMarketplaceGateway().createMarketplaceCheckout(params)
 */

import type { MarketplaceGateway } from '../interface'
import type { MarketplaceProvider } from '../types'
import { StripeConnectGateway } from './stripe-connect'
import { MercadoPagoSplitGateway } from './mercadopago-split'

let gatewayInstance: MarketplaceGateway | null = null
let configuredProvider: MarketplaceProvider | null = null

/**
 * Get the marketplace gateway for the configured provider.
 * Singleton - the same instance is returned on subsequent calls.
 *
 * Provider is determined by MARKETPLACE_PROVIDER env var or explicit configuration.
 */
export function getMarketplaceGateway(provider?: MarketplaceProvider): MarketplaceGateway {
  const resolvedProvider = provider
    || configuredProvider
    || (process.env.MARKETPLACE_PROVIDER as MarketplaceProvider)
    || 'stripe_connect'

  if (!gatewayInstance || (provider && provider !== configuredProvider)) {
    switch (resolvedProvider) {
      case 'stripe_connect':
        gatewayInstance = new StripeConnectGateway()
        break
      case 'mercadopago_split':
        gatewayInstance = new MercadoPagoSplitGateway()
        break
      default:
        throw new Error(
          `Unsupported marketplace provider: "${resolvedProvider}". ` +
          `Supported providers: stripe_connect, mercadopago_split.`
        )
    }
    configuredProvider = resolvedProvider
  }

  return gatewayInstance
}

/**
 * Configure the marketplace provider explicitly.
 * Call this during app initialization if not using env var.
 */
export function setMarketplaceProvider(provider: MarketplaceProvider): void {
  configuredProvider = provider
  gatewayInstance = null // Reset so next call creates the right instance
}

/**
 * Reset the cached gateway instance.
 * Useful for testing or when config changes at runtime.
 */
export function resetMarketplaceGateway(): void {
  gatewayInstance = null
  configuredProvider = null
}
