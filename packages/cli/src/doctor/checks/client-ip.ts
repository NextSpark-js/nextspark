/**
 * Client address Health Check
 *
 * Reports the source rate limits and audit logs read the client address from, and where it came from, the way
 * core's lib/api/client-ip resolves it: NEXTSPARK_CLIENT_IP_SOURCE when set, vercel when VERCEL=1, otherwise the
 * default header order (rightmost X-Forwarded-For, x-real-ip, true-client-ip). The exported variable wins over the
 * .env files, and .env.local over .env. tests/doctor-client-ip.test.ts compares it with core's resolver.
 */

import type { HealthCheckResult } from '../index.js'
import { readProjectEnv } from './database.js'

const HEADER_NAME = /^[a-z0-9!#$%&'*+.^_`|~-]+$/
const SOURCE_FIX = 'Set NEXTSPARK_CLIENT_IP_SOURCE to vercel, cloudflare, xff, none or header:<name>'

/** The source as core names it (vercel, cloudflare, none, xff, header:<name>), or an error message. */
function parseSource(raw: string, hopsRaw: string | undefined): { source: string } | { error: string; fix: string } {
  if (raw === 'vercel' || raw === 'cloudflare' || raw === 'none') return { source: raw }
  if (raw === 'xff') {
    const hops = hopsRaw?.trim() || '1'
    if (!/^\d+$/.test(hops) || Number(hops) < 1) {
      return { error: `NEXTSPARK_TRUSTED_PROXY_HOPS=${hops} is not a whole number of 1 or more`, fix: 'Set NEXTSPARK_TRUSTED_PROXY_HOPS to the number of proxies in front of the app (1 or more)' }
    }
    return { source: 'xff' }
  }
  if (raw.startsWith('header:')) {
    const header = raw.slice('header:'.length).trim()
    if (HEADER_NAME.test(header)) return { source: `header:${header}` }
  }
  return { error: `NEXTSPARK_CLIENT_IP_SOURCE=${raw} is not a source core understands`, fix: SOURCE_FIX }
}

export async function checkClientIp(cwd = process.cwd(), processEnv: NodeJS.ProcessEnv = process.env): Promise<HealthCheckResult> {
  const name = 'Client address'
  const fileEnv = await readProjectEnv(cwd)
  const read = (key: string) => processEnv[key] ?? fileEnv[key]
  const raw = read('NEXTSPARK_CLIENT_IP_SOURCE')?.trim().toLowerCase()
  if (raw) {
    const parsed = parseSource(raw, read('NEXTSPARK_TRUSTED_PROXY_HOPS'))
    if ('error' in parsed) return { name, status: 'fail', message: parsed.error, fix: parsed.fix }
    return { name, status: 'pass', message: `${parsed.source} (from NEXTSPARK_CLIENT_IP_SOURCE)` }
  }
  if (read('VERCEL') === '1') {
    // `vercel env pull` writes VERCEL="1" to .env.local, and next start loads it off Vercel too. The CLI itself loads
    // .env into process.env at startup, so an exported value equal to the file's cannot tell them apart: the file is enough.
    if (fileEnv.VERCEL === '1') {
      return {
        name,
        status: 'warn',
        message: 'vercel (detected from VERCEL=1, which comes from a .env file; NEXTSPARK_CLIENT_IP_SOURCE is not set)',
        fix: 'Vercel sets VERCEL=1 in the runtime, not in files: remove it from .env/.env.local or set NEXTSPARK_CLIENT_IP_SOURCE',
      }
    }
    return { name, status: 'pass', message: 'vercel (detected from VERCEL=1; NEXTSPARK_CLIENT_IP_SOURCE is not set)' }
  }
  return {
    name,
    status: 'warn',
    message: 'default order: rightmost X-Forwarded-For, x-real-ip, true-client-ip (NEXTSPARK_CLIENT_IP_SOURCE is not set)',
    fix: 'Set NEXTSPARK_CLIENT_IP_SOURCE for your deployment (cloudflare behind Cloudflare; Vercel sets VERCEL=1, which selects vercel): see docs/14-deployment/10-client-address.md',
  }
}
