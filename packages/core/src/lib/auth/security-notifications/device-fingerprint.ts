/**
 * Device fingerprinting for new-device login detection.
 *
 * The fingerprint is deliberately COARSE:
 *   fingerprint = sha256( normalizedUA + "|" + ip/24 )
 *
 * - UA is normalized so browser auto-updates (patch/build version churn) do NOT
 *   look like a brand-new device every week. We keep major.minor of each version
 *   token and drop the rest (`Chrome/120.0.6099.109` → `Chrome/120.0`).
 * - IP is truncated to its /24 network so a phone hopping between addresses in
 *   the same carrier/NAT block is still "the same place".
 *
 * This is an anti-annoyance heuristic for security emails, NOT an
 * authentication signal — a coarse fingerprint means fewer false "new device"
 * alerts, at the cost of not distinguishing devices that share a /24 and a
 * near-identical UA. That trade-off is intentional.
 */

import { createHash } from 'crypto'

/**
 * Normalize a User-Agent string:
 *   - lower-cased and whitespace-collapsed
 *   - every version token with 3+ dotted numeric components is reduced to its
 *     first two (major.minor), stripping patch/build churn
 *
 * A missing UA normalizes to the empty string (all UA-less clients from the
 * same /24 then share a fingerprint, which is the desired conservative bucket).
 */
export function normalizeUserAgent(ua: string | null | undefined): string {
  if (!ua) return ''
  return ua
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    // 3+ component version → major.minor  (537.36 stays; 120.0.6099.109 → 120.0)
    .replace(/(\d+)\.(\d+)(?:\.\d+)+/g, '$1.$2')
}

/**
 * Reduce an IP address to its /24 network key.
 *   - IPv4 `a.b.c.d`     → `a.b.c.0/24`
 *   - IPv6 `x:y:z:...`   → first three hextets + `::/48` (coarse, best-effort)
 *   - anything else      → returned unchanged (e.g. the literal 'unknown')
 */
export function ipToNetworkKey(ip: string | null | undefined): string {
  if (!ip) return ''
  const trimmed = ip.trim()

  // IPv4 (optionally an IPv4-mapped IPv6 like ::ffff:203.0.113.42)
  const v4 = trimmed.match(/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (v4) {
    return `${v4[1]}.${v4[2]}.${v4[3]}.0/24`
  }

  // IPv6 — take the first three hextets as a coarse /48-ish bucket.
  if (trimmed.includes(':')) {
    const hextets = trimmed.split(':').filter(Boolean).slice(0, 3)
    if (hextets.length > 0) return `${hextets.join(':')}::/48`
  }

  return trimmed
}

/**
 * Compute the stable device fingerprint for a login.
 *
 * @param ua - raw User-Agent header (or null)
 * @param ip - client IP (or null); truncated to /24 before hashing
 * @returns hex sha256 of `normalizedUA|ipNetworkKey`
 */
export function computeDeviceFingerprint(
  ua: string | null,
  ip: string | null,
): string {
  const material = `${normalizeUserAgent(ua)}|${ipToNetworkKey(ip)}`
  return createHash('sha256').update(material).digest('hex')
}

/**
 * Extract the best-effort client IP from request headers.
 *
 * Strategy mirrors the rate-limiter (see lib/api/rate-limit.ts):
 *   Cloudflare > rightmost x-forwarded-for > x-real-ip > true-client-ip > 'unknown'
 * The rightmost x-forwarded-for entry is the one appended by the last (trusted)
 * proxy, so it is the hardest for a client to spoof.
 */
export function extractClientIp(headers: Headers): string {
  const cfIp = headers.get('cf-connecting-ip')
  if (cfIp) return cfIp

  const forwardedFor = headers.get('x-forwarded-for')
  if (forwardedFor) {
    const ips = forwardedFor
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
    if (ips.length > 0) return ips[ips.length - 1]
  }

  const realIp = headers.get('x-real-ip')
  if (realIp) return realIp

  const trueClientIp = headers.get('true-client-ip')
  if (trueClientIp) return trueClientIp

  return 'unknown'
}
