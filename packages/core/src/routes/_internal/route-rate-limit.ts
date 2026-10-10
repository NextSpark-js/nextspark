/**
 * The default rate limit of a project's and a plugin's own API routes (#226).
 *
 * The generated host wraps every HTTP method a Route Handler under `api/` exports with one of these (`GET`/`HEAD` read,
 * `POST`/`PUT`/`PATCH`/`DELETE` write, `OPTIONS` untouched), as core's theme and plugin dispatchers did up to
 * 0.1.0-beta.191. A method that wraps itself with `withRateLimitTier` or `withRateLimit`, and a route that exports
 * `rateLimit = false`, are left alone (scripts/build/registry/host/rate-limit.mjs).
 *
 * Only the per-address limit: the route keeps its own CORS and origin handling (withAddressRateLimit).
 */

import { withAddressRateLimit } from '@nextsparkjs/core/lib/api/rate-limit'

/** 200 requests per minute per client address, shared with every other read-tier route. */
export function withReadRateLimit<A extends unknown[], R>(handler: (...args: A) => R) {
  return withAddressRateLimit(handler, 'read')
}

/** 50 requests per minute per client address, shared with every other write-tier route. */
export function withWriteRateLimit<A extends unknown[], R>(handler: (...args: A) => R) {
  return withAddressRateLimit(handler, 'write')
}
