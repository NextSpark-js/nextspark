/**
 * Apple's signing key (APPLE_PRIVATE_KEY, the .p8 file), read the one way both
 * the client-secret signer and the readiness check use, so a key the signer
 * would refuse is never reported ready. Node only.
 */

import { createPrivateKey, type KeyObject } from 'node:crypto'

/** The P-256 private key of a PEM, or a throw; `\n` escapes (one-line .env values) are accepted. */
export function appleSigningKey(pem: string): KeyObject {
  const key = createPrivateKey(pem.replace(/\\n/g, '\n'))
  // Any other key would sign too, and Apple would refuse the secret at the first sign-in
  if (key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') throw new Error('APPLE_PRIVATE_KEY is not a P-256 EC key')
  return key
}

let last: { pem: string; usable: boolean } | null = null

/** Whether Apple can sign with this key. Remembers the last answer: the route gate asks on every request. */
export function isAppleSigningKey(pem: string): boolean {
  if (last?.pem !== pem) {
    let usable = true
    try { appleSigningKey(pem) } catch { usable = false }
    last = { pem, usable }
  }
  return last.usable
}
