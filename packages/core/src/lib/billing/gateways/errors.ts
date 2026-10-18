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
