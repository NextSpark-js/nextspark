/**
 * What MCP browser sign-in (#541) does not start with in production, and how a deployment accepts it anyway.
 *
 * Two conditions the framework tolerates for sessions and API keys are not tolerated here by default, because a
 * connection is an agent that makes many calls on its own and any user can create one without an administrator:
 *
 * - `no-shared-rate-limit`: Redis is not configured, so every instance counts its own limits and the real limit
 *   of a connection is the nominal one times the number of instances.
 * - `rls-not-enforced`: the role `DATABASE_URL` connects as skips row-level security (it owns the tables, is a
 *   superuser or has BYPASSRLS), so a check missed in the code is not contained by the database.
 *
 * In production the authorization server does not serve while either holds. A deployment that knows and accepts
 * one names it: `MCP_OAUTH_ACCEPT_RISKS=no-shared-rate-limit,rls-not-enforced`. Naming them one by one is the point:
 * the variable says what was accepted, and a condition added later is not accepted by an old value.
 *
 * This module reads the environment and nothing else: the proxy imports it through ./config, so it loads neither
 * the database nor the rate limiter. The database part is in ./production-gate.
 */
import { maybeRedisConfigured } from '../../rate-limit-env'

export const ACCEPT_RISKS_VARIABLE = 'MCP_OAUTH_ACCEPT_RISKS'

export const MCP_OAUTH_RISKS = ['no-shared-rate-limit', 'rls-not-enforced'] as const
export type McpOAuthRisk = (typeof MCP_OAUTH_RISKS)[number]

// On globalThis: Next bundles this module more than once (proxy, instrumentation, routes), and each line is said once
const SAID = Symbol.for('nextspark.mcpOAuthProductionGateSaid')

/** Logs `message` at error level the first time `key` is seen in this process. */
export function sayOnce(key: string, message: string): void {
  const state = globalThis as Record<symbol, Set<string> | undefined>
  const said = (state[SAID] ??= new Set<string>())
  if (said.has(key)) return
  said.add(key)
  console.error(message)
}

/** Whether the gate applies: a production server, not the build of one (`next build` evaluates the routes too). */
export function isProductionRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === 'production'
}

const isBuild = (env: NodeJS.ProcessEnv) => env.NEXT_PHASE === 'phase-production-build'

/** The risks `MCP_OAUTH_ACCEPT_RISKS` names. A name that is not a risk accepts nothing, and is said once. */
export function acceptedRisks(env: NodeJS.ProcessEnv = process.env): Set<McpOAuthRisk> {
  const named = (env[ACCEPT_RISKS_VARIABLE] ?? '').split(/[\s,]+/).filter(Boolean)
  const unknown = named.filter(name => !(MCP_OAUTH_RISKS as readonly string[]).includes(name))
  if (unknown.length && !isBuild(env)) {
    sayOnce(
      `unknown:${unknown.join(',')}`,
      `[mcp:oauth] ${ACCEPT_RISKS_VARIABLE} names ${unknown.join(', ')}, which is not a risk it can accept and is ignored. The names are: ${MCP_OAUTH_RISKS.join(', ')}.`
    )
  }
  return new Set(named.filter((name): name is McpOAuthRisk => (MCP_OAUTH_RISKS as readonly string[]).includes(name)))
}

/**
 * Whether the production gate lets MCP browser sign-in start, as far as the environment says: outside production
 * always; in production with Redis configured, or with `no-shared-rate-limit` accepted. Says why not, once.
 *
 * It is the synchronous half of the gate, read where the feature is switched (./config `isMcpOAuthEnabled`), so a
 * deployment it stops behaves as one with `MCP_OAUTH_ENABLED=false`: no authorization server, and `/api/mcp` takes
 * API keys only.
 */
export function sharedRateLimitGate(env: NodeJS.ProcessEnv = process.env): boolean {
  if (!isProductionRuntime(env) || maybeRedisConfigured(env)) return true
  const accepted = acceptedRisks(env).has('no-shared-rate-limit')
  if (!isBuild(env)) {
    if (accepted) {
      sayOnce(
        'accepted:no-shared-rate-limit',
        `[mcp:oauth] MCP browser sign-in is running WITHOUT a shared rate limit: Redis is not configured (UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN), so each instance counts the limit of a connection on its own. Accepted by ${ACCEPT_RISKS_VARIABLE}=no-shared-rate-limit.`
      )
    } else {
      sayOnce(
        'refused:no-shared-rate-limit',
        `[mcp:oauth] MCP browser sign-in is built (features.mcpOAuth) and NOT started: in production it needs Redis (UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN), without which each instance counts the limit of a connection on its own. /api/mcp takes API keys only until then. Configure Redis, or accept this with ${ACCEPT_RISKS_VARIABLE}=no-shared-rate-limit.`
      )
    }
  }
  return accepted
}
