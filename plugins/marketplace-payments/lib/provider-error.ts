/**
 * A provider's API answered with an error. It carries the status and the provider's error code only: a response body
 * or a request can hold a token, so neither ever reaches a message or a log.
 */
export class ProviderApiError extends Error {
  constructor(
    readonly provider: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(`${provider} API error ${status}${code ? ` (${code})` : ''}`)
    this.name = 'ProviderApiError'
  }
}

/** Every provider call gives up after this long, so a request never hangs on a provider. */
export const PROVIDER_TIMEOUT_MS = 20_000
