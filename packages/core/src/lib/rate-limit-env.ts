/**
 * Whether the environment names a Redis for the shared rate limits. On its own, with no imports, because the proxy
 * asks it too (through the production gate of MCP browser sign-in, lib/mcp/oauth/production-risks) and must not
 * load the rate limiter for that. lib/rate-limit-redis re-exports it: there is one definition of "Redis is
 * configured".
 */
export function maybeRedisConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return !!(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN)
}
