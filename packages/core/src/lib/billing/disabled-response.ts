import { createApiError } from '../api/error-response'
import { isBillingGatewayDisabled } from './provider-mode'

/** Answer of the billing endpoints that need a payment gateway when the project runs with `provider: 'none'`. */
export const BILLING_DISABLED_MESSAGE = 'Billing is not available: this project runs without a payment gateway.'

/** A 501 `BILLING_GATEWAY_DISABLED` in no-gateway mode, otherwise null. Call it after authentication, so anonymous callers still get 401. */
export function billingDisabledResponse() {
  return isBillingGatewayDisabled() ? createApiError(BILLING_DISABLED_MESSAGE, 501, undefined, 'BILLING_GATEWAY_DISABLED') : null
}
