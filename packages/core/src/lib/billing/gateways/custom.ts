/**
 * Public entry for a project's own billing gateway (`@nextsparkjs/core/lib/billing/gateways/custom`).
 *
 * Register the gateway at server startup, set its name as `provider` in billing.config.ts, and start the
 * project's webhook route with verifyBillingWebhook. See docs/19-billing/11-custom-gateway.md.
 */

export { registerBillingGateway } from './registry'
export type { BillingGatewayFactory } from './registry'
export { verifyBillingWebhook } from './webhook'
export type { VerifiedBillingWebhook } from './webhook'
export { BillingOperationNotSupportedError } from './errors'
export type { BillingGateway } from './interface'
export type * from './types'
