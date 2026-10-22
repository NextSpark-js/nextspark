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
import { BillingGatewayDisabledError } from './errors'
import { assertValidBillingGateway, getRegisteredBillingGateway, getRegisteredBillingGatewayNames, type BillingGatewayFactory } from './registry'
import { isBillingGatewayDisabled } from '../provider-mode'

let gatewayInstance: BillingGateway | null = null
let gatewayLoading: Promise<BillingGateway> | null = null
/** The registered factory the cached instance came from (undefined for a built-in): registering another one invalidates the cache. */
let gatewayFactory: BillingGatewayFactory | undefined

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
  if (isBillingGatewayDisabled()) {
    throw new BillingGatewayDisabledError()
  }
  const registered = getRegisteredBillingGateway(BILLING_REGISTRY.provider)
  if (gatewayInstance && gatewayFactory === registered) {
    return gatewayInstance
  }
  if (!gatewayLoading) {
    gatewayLoading = loadGateway(registered)
      .then((gateway) => {
        gatewayInstance = gateway
        gatewayFactory = registered
        return gateway
      })
      .finally(() => {
        gatewayLoading = null
      })
  }
  return gatewayLoading
}

async function loadGateway(registered: BillingGatewayFactory | undefined): Promise<BillingGateway> {
  const provider = BILLING_REGISTRY.provider
  // A project's registered gateway is resolved before the built-in list, and checked against the contract before any call.
  if (registered) {
    const gateway = await registered()
    assertValidBillingGateway(provider, gateway)
    return gateway
  }
  switch (provider) {
    case 'stripe': {
      const { StripeGateway } = await import('./stripe')
      return new StripeGateway()
    }
    case 'polar': {
      const { PolarGateway } = await import('./polar')
      return new PolarGateway()
    }
    case 'lemonsqueezy': {
      const { LemonSqueezyGateway } = await import('./lemonsqueezy')
      return new LemonSqueezyGateway()
    }
    case 'paddle': {
      const { PaddleGateway } = await import('./paddle')
      return new PaddleGateway()
    }
    // Future providers (each one only enters the bundle when configured):
    // case 'mercadopago': { ... }
    default:
      throw new Error(
        `Unsupported billing provider: "${provider}". ` +
        `Supported providers: ${['stripe', 'polar', 'lemonsqueezy', 'paddle', ...getRegisteredBillingGatewayNames()].join(', ')}. ` +
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
 * const { preconnect, dnsPrefetch } = await getBillingResourceHints()
 */
export async function getBillingResourceHints(): Promise<{ preconnect: string[]; dnsPrefetch: string[] }> {
  // No gateway, no provider origin to warm up: nothing is built, so no SDK is loaded either
  if (isBillingGatewayDisabled()) {
    return { preconnect: [], dnsPrefetch: [] }
  }
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
  gatewayFactory = undefined
}

/** The gateway, or null in no-gateway mode. Any other failure (a misconfigured or malformed gateway) still throws. */
export async function getBillingGatewayOrNull(): Promise<BillingGateway | null> {
  return isBillingGatewayDisabled() ? null : getBillingGateway()
}
