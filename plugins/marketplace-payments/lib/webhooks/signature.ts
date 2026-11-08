/**
 * Webhook signature checks. Each one throws WebhookSignatureError unless the request carries a valid signature,
 * including when no secret is configured, so a missing configuration fails closed. Several secrets are accepted so an
 * endpoint's secret can be rotated, and every candidate is compared, in constant time, whether or not an earlier one
 * matched. An error says what kind of check failed and never holds a secret or a signature.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

export class WebhookSignatureError extends Error {
  constructor(reason: string) {
    super(`Invalid webhook signature: ${reason}`)
    this.name = 'WebhookSignatureError'
  }
}

/** Stripe's default: an event older than this is a replay. */
export const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 300

const HEX_SHA256 = /^[0-9a-f]{64}$/

/** True when `candidate` (hex) equals the HMAC of `payloads`; any secret, any candidate, every pair compared. */
function anyMatches(secrets: string[], payloads: (string | Buffer)[], candidates: string[]): boolean {
  const given = candidates.filter(candidate => HEX_SHA256.test(candidate)).map(candidate => Buffer.from(candidate, 'hex'))
  let matched = false
  for (const secret of secrets) {
    const hmac = createHmac('sha256', secret)
    for (const payload of payloads) hmac.update(payload)
    const expected = hmac.digest()
    for (const candidate of given) {
      if (timingSafeEqual(expected, candidate)) matched = true
    }
  }
  return matched
}

/** `t=1,v1=a,v1=b` as a list of pairs: a key may repeat. */
function parseHeader(header: string): [string, string][] {
  return header.split(',').map(part => {
    const index = part.indexOf('=')
    return index < 0 ? ['', ''] : [part.slice(0, index).trim(), part.slice(index + 1).trim()]
  })
}

export function verifyStripeSignature(
  rawBody: Buffer,
  header: string | undefined,
  secrets: string[],
  { nowSeconds = Math.floor(Date.now() / 1000), toleranceSeconds = STRIPE_SIGNATURE_TOLERANCE_SECONDS } = {}
): void {
  if (secrets.length === 0) throw new WebhookSignatureError('no secret configured')
  if (!header) throw new WebhookSignatureError('missing header')
  const pairs = parseHeader(header)
  const timestamps = pairs.filter(([key]) => key === 't').map(([, value]) => value)
  if (timestamps.length !== 1 || !/^\d+$/.test(timestamps[0])) throw new WebhookSignatureError('malformed timestamp')
  if (Math.abs(nowSeconds - Number(timestamps[0])) > toleranceSeconds) throw new WebhookSignatureError('timestamp out of tolerance')
  const signatures = pairs.filter(([key]) => key === 'v1').map(([, value]) => value)
  if (!anyMatches(secrets, [`${timestamps[0]}.`, rawBody], signatures)) throw new WebhookSignatureError('no signature matches')
}

/** A data id goes into the signed manifest and an API path: nothing but an id passes. */
const MERCADOPAGO_DATA_ID = /^[A-Za-z0-9_-]{1,128}$/

/**
 * MercadoPago signs `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`, with the data id from the query string in lower
 * case. The signature does NOT cover the body or any other query parameter: everything else in the request is unsigned
 * and the handler must not trust it. There is no timestamp window: whether a retry keeps its original `ts` is not
 * documented, and a replay only makes the handler re-read the payment from the API.
 *
 * Returns the verified data id.
 */
export function verifyMercadoPagoSignature(
  input: { signature: string | undefined; requestId: string | undefined; dataId: string | null },
  secrets: string[]
): string {
  if (secrets.length === 0) throw new WebhookSignatureError('no secret configured')
  const { signature, requestId, dataId } = input
  if (!signature || !requestId) throw new WebhookSignatureError('missing header')
  if (!dataId || !MERCADOPAGO_DATA_ID.test(dataId)) throw new WebhookSignatureError('malformed data id')
  const pairs = parseHeader(signature)
  const timestamps = pairs.filter(([key]) => key === 'ts').map(([, value]) => value)
  if (timestamps.length !== 1 || !/^\d+$/.test(timestamps[0])) throw new WebhookSignatureError('malformed timestamp')
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${timestamps[0]};`
  const signatures = pairs.filter(([key]) => key === 'v1').map(([, value]) => value)
  if (!anyMatches(secrets, [manifest], signatures)) throw new WebhookSignatureError('no signature matches')
  return dataId
}
