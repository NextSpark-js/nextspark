/**
 * Compares a value a request brings with a shared secret (a cron secret, a
 * bearer value). Both sides are hashed with SHA-256 first, so the comparison
 * always runs over two 32-byte digests: the time it takes does not depend on
 * where the values differ or on their lengths.
 */

import { createHash, timingSafeEqual } from 'node:crypto'

const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest()

/** True when `given` is exactly `expected`. A missing `given` is false. */
export function secretsMatch(given: string | null | undefined, expected: string): boolean {
  if (typeof given !== 'string') return false
  return timingSafeEqual(digest(given), digest(expected))
}
