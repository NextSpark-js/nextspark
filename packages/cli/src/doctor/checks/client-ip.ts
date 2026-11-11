/**
 * Client address Health Check
 *
 * Reports the source rate limits and audit logs read the client address from, and where it came from, the way
 * core's lib/api/client-ip resolves it: NEXTSPARK_CLIENT_IP_SOURCE when set, vercel when VERCEL=1, otherwise the
 * default header order (rightmost X-Forwarded-For, x-real-ip, true-client-ip). The exported variable wins over .env.
 */

import type { HealthCheckResult } from '../index.js'
import { readProjectEnv } from './database.js'

const VALID = /^(vercel|cloudflare|xff|none|header:[a-z0-9!#$%&'*+.^_`|~-]+)$/

export async function checkClientIp(cwd = process.cwd(), processEnv: NodeJS.ProcessEnv = process.env): Promise<HealthCheckResult> {
  const name = 'Client address'
  const fileEnv = await readProjectEnv(cwd)
  const read = (key: string) => processEnv[key] ?? fileEnv[key]
  const raw = read('NEXTSPARK_CLIENT_IP_SOURCE')?.trim().toLowerCase()
  if (raw) {
    if (!VALID.test(raw.replace(/^header:\s*/, 'header:'))) {
      return {
        name,
        status: 'fail',
        message: `NEXTSPARK_CLIENT_IP_SOURCE=${raw} is not a source core understands`,
        fix: 'Set NEXTSPARK_CLIENT_IP_SOURCE to vercel, cloudflare, xff, none or header:<name>',
      }
    }
    return { name, status: 'pass', message: `${raw} (from NEXTSPARK_CLIENT_IP_SOURCE)` }
  }
  if (read('VERCEL') === '1') {
    return { name, status: 'pass', message: 'vercel (detected from VERCEL=1; NEXTSPARK_CLIENT_IP_SOURCE is not set)' }
  }
  return {
    name,
    status: 'warn',
    message: 'default order: rightmost X-Forwarded-For, x-real-ip, true-client-ip (NEXTSPARK_CLIENT_IP_SOURCE is not set)',
    fix: 'Set NEXTSPARK_CLIENT_IP_SOURCE for your deployment (cloudflare behind Cloudflare; Vercel sets VERCEL=1, which selects vercel): see docs/14-deployment/10-client-address.md',
  }
}
