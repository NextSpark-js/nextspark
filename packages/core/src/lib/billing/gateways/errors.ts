/**
 * Errors a billing gateway throws for a request its provider cannot serve.
 *
 * Routes answer them with 400 `NOT_SUPPORTED` and the message, not a 500: the request is valid, this provider cannot do it
 * (for example an immediate cancellation with Lemon Squeezy, which always keeps a grace period).
 */

export class BillingOperationNotSupportedError extends Error {
  readonly code = 'NOT_SUPPORTED'

  constructor(message: string) {
    super(message)
    this.name = 'BillingOperationNotSupportedError'
  }
}

/** By name and code, not instanceof: the gateway is a separate chunk that may hold its own copy of this module. */
export function isBillingOperationNotSupported(error: unknown): error is BillingOperationNotSupportedError {
  return error instanceof Error && error.name === 'BillingOperationNotSupportedError' && (error as { code?: unknown }).code === 'NOT_SUPPORTED'
}

/**
 * Thrown by the factory when the project runs without a payment gateway (`provider: 'none'`).
 * Routes answer it with 501 `BILLING_GATEWAY_DISABLED` (see ../disabled-response.ts) instead of a 500.
 */
export class BillingGatewayDisabledError extends Error {
  readonly code = 'BILLING_GATEWAY_DISABLED'

  constructor(message = 'Billing runs without a payment gateway (provider: "none").') {
    super(message)
    this.name = 'BillingGatewayDisabledError'
  }
}

/** A custom gateway that is registered under a bad name or does not satisfy the BillingGateway contract. */
export class InvalidBillingGatewayError extends Error {
  readonly code = 'INVALID_BILLING_GATEWAY'

  constructor(message: string) {
    super(message)
    this.name = 'InvalidBillingGatewayError'
  }
}
