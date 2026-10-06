/**
 * The client address of a request: the one place that decides it, for rate limits, audit logs,
 * security notifications and every other reader in core.
 *
 * Which header can be trusted depends on what sits in front of the app, so the deployment names it:
 *
 *   NEXTSPARK_CLIENT_IP_SOURCE=vercel         x-vercel-forwarded-for, then x-real-ip (set by Vercel)
 *   NEXTSPARK_CLIENT_IP_SOURCE=cloudflare     cf-connecting-ip (set by Cloudflare)
 *   NEXTSPARK_CLIENT_IP_SOURCE=header:<name>  one header that your proxy sets, e.g. header:x-real-ip
 *   NEXTSPARK_CLIENT_IP_SOURCE=xff            X-Forwarded-For, counting NEXTSPARK_TRUSTED_PROXY_HOPS
 *                                             (default 1) trusted proxies from the right
 *   NEXTSPARK_CLIENT_IP_SOURCE=none           no client address: every request shares one bucket
 *
 * Unset keeps the order core always used (cf-connecting-ip, rightmost X-Forwarded-For, x-real-ip,
 * true-client-ip), and production logs one warning saying what to set. Next.js gives route handlers
 * no socket address, so 'none' cannot fall back to one.
 * See docs/14-deployment/10-client-address.md.
 */

export const UNKNOWN_CLIENT_IP = 'unknown'

export type ClientIpSource =
  | { kind: 'default' }
  | { kind: 'vercel' }
  | { kind: 'cloudflare' }
  | { kind: 'header'; header: string }
  | { kind: 'xff'; hops: number }
  | { kind: 'none' }

type Env = Record<string, string | undefined>

const HEADER_NAME = /^[a-z0-9!#$%&'*+.^_`|~-]+$/

/** Reads the setting. Throws on a value it does not understand: a typo must not silently trust a header. */
export function getClientIpSource(env: Env = process.env): ClientIpSource {
  const raw = env.NEXTSPARK_CLIENT_IP_SOURCE?.trim().toLowerCase()
  if (!raw) return { kind: 'default' }
  if (raw === 'vercel' || raw === 'cloudflare' || raw === 'none') return { kind: raw }
  if (raw === 'xff') {
    const hopsRaw = env.NEXTSPARK_TRUSTED_PROXY_HOPS?.trim() || '1'
    const hops = Number(hopsRaw)
    if (!/^\d+$/.test(hopsRaw) || hops < 1) {
      throw new Error('[client-ip] NEXTSPARK_TRUSTED_PROXY_HOPS must be a whole number of 1 or more')
    }
    return { kind: 'xff', hops }
  }
  if (raw.startsWith('header:')) {
    const header = raw.slice('header:'.length).trim()
    if (HEADER_NAME.test(header)) return { kind: 'header', header }
  }
  throw new Error('[client-ip] NEXTSPARK_CLIENT_IP_SOURCE must be vercel, cloudflare, xff, none or header:<name>')
}

function entries(value: string | null): string[] {
  return value ? value.split(',').map((ip) => ip.trim()).filter(Boolean) : []
}

/** The rightmost entry: the one the nearest proxy wrote, when a header carries a list. */
function lastEntry(value: string | null): string | null {
  return entries(value).at(-1) ?? null
}

/** The client address of a request, from the source the deployment configured (getClientIpSource). */
export function getClientIp(headers: Headers, env: Env = process.env): string {
  warnClientIpSourceAtStartup(env)
  const source = getClientIpSource(env)
  switch (source.kind) {
    case 'vercel':
      return lastEntry(headers.get('x-vercel-forwarded-for')) ?? lastEntry(headers.get('x-real-ip')) ?? UNKNOWN_CLIENT_IP
    case 'cloudflare':
      return lastEntry(headers.get('cf-connecting-ip')) ?? UNKNOWN_CLIENT_IP
    case 'header':
      return lastEntry(headers.get(source.header)) ?? UNKNOWN_CLIENT_IP
    case 'xff': {
      // Each trusted proxy appends the address it received from, so the client is `hops` entries from the right.
      // A shorter list did not pass through every trusted proxy, so none of its entries can be trusted.
      const ips = entries(headers.get('x-forwarded-for'))
      return ips.length >= source.hops ? ips[ips.length - source.hops] : UNKNOWN_CLIENT_IP
    }
    case 'none':
      return UNKNOWN_CLIENT_IP
    default:
      return (
        headers.get('cf-connecting-ip') ||
        lastEntry(headers.get('x-forwarded-for')) ||
        headers.get('x-real-ip') ||
        headers.get('true-client-ip') ||
        UNKNOWN_CLIENT_IP
      )
  }
}

/**
 * getClientIp for readers that only record the address (audit rows, the new-device fingerprint): an invalid
 * setting records UNKNOWN_CLIENT_IP instead of throwing, so the row is still written. Rate limits use getClientIp,
 * which throws.
 */
export function getRecordedClientIp(headers: Headers, env: Env = process.env): string {
  try {
    return getClientIp(headers, env)
  } catch {
    return UNKNOWN_CLIENT_IP
  }
}

/**
 * The headers Better Auth's own rate limiter should read (advanced.ipAddress.ipAddressHeaders), or undefined
 * to keep its default. Better Auth trusts only a single-valued header, so 'xff' keeps its default; 'none' names no
 * header, so Better Auth counts every request to a path in one shared bucket.
 */
export function getBetterAuthIpHeaders(env: Env = process.env): string[] | undefined {
  try {
    const source = getClientIpSource(env)
    if (source.kind === 'vercel') return ['x-vercel-forwarded-for', 'x-real-ip']
    if (source.kind === 'cloudflare') return ['cf-connecting-ip']
    if (source.kind === 'header') return [source.header]
    if (source.kind === 'none') return []
  } catch {
    // An invalid setting is reported by warnClientIpSourceAtStartup and fails every request that reads it.
  }
  return undefined
}

const WARNED = Symbol.for('nextspark.clientIpSourceWarned')

/**
 * Logs once per process when the client address source is invalid (in every environment) or, in production
 * only, not set. Called at server start (logAuthReadinessAtStartup) and again on first use, for projects whose
 * instrumentation does not run it; the flag lives on globalThis so both bundles share it.
 */
export function warnClientIpSourceAtStartup(env: Env = process.env): void {
  const state = globalThis as Record<symbol, unknown>
  if (state[WARNED]) return
  let source: ClientIpSource
  try {
    source = getClientIpSource(env)
  } catch (error) {
    state[WARNED] = true
    console.error((error as Error).message)
    return
  }
  if (source.kind !== 'default' || env.NODE_ENV !== 'production') return
  state[WARNED] = true
  console.warn(
    '[client-ip] NEXTSPARK_CLIENT_IP_SOURCE is not set, so rate limits and audit logs read the client address ' +
      'from request headers in a fixed order. Set it for your deployment: vercel, cloudflare, xff ' +
      '(with NEXTSPARK_TRUSTED_PROXY_HOPS) or header:<name>; none if nothing in front sets a client address.'
  )
}
