/**
 * The no-gateway mode (`provider: 'none'` in billing.config.ts).
 *
 * Core still manages plans, limits and entitlements; there is no checkout, portal, cancellation or webhook, and no
 * provider SDK or resource hint. Client-safe: it only reads the provider name from the registry.
 */

import { BILLING_REGISTRY } from '@nextsparkjs/registries/billing-registry'
import { isDemoMode } from '../demo/mode'

export const NO_GATEWAY_PROVIDER = 'none'

export function isBillingGatewayDisabled(): boolean {
  // Demo mode is server-side: a browser still sees the configured provider, and the server answers its calls as no-gateway
  return BILLING_REGISTRY.provider === NO_GATEWAY_PROVIDER || isDemoMode()
}
