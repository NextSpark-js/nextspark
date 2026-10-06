import { NextRequest, NextResponse } from 'next/server';
import { unstable_rethrow } from 'next/navigation';
import { getRateLimitForScopes, presentedApiKey } from './keys';
import { validateApiKey } from './auth';
import { rateLimitCache, getCacheKey } from './cache';
import { getClientIp } from './client-ip';
import {
  checkRateLimit as checkRedisRateLimit,
  maybeRedisConfigured,
  type RateLimitCheckResult as RedisRateLimitResult,
  type RateLimitTier,
} from '../rate-limit-redis';
import { checkRequestOrigin } from './request-origin';
import { withCors } from './cors-response';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  limit: number;
}

/**
 * Verifica el rate limit para un identificador específico
 */
export function checkRateLimit(
  identifier: string, 
  limit: number = 1000, 
  windowMs: number = 60000
): RateLimitResult {
  const now = Date.now();
  const cacheKey = getCacheKey('rate_limit', identifier);
  
  const current = rateLimitCache.get(cacheKey);
  
  if (!current || current.resetTime < now) {
    const resetTime = now + windowMs;
    const newEntry = { count: 1, resetTime };
    
    // Cache con TTL específico para esta ventana
    rateLimitCache.set(cacheKey, newEntry, windowMs);
    
    return { 
      allowed: true, 
      remaining: limit - 1, 
      resetTime,
      limit
    };
  }
  
  if (current.count >= limit) {
    return { 
      allowed: false, 
      remaining: 0, 
      resetTime: current.resetTime,
      limit
    };
  }
  
  // Incrementar contador y actualizar cache
  current.count++;
  const ttl = current.resetTime - now;
  rateLimitCache.set(cacheKey, current, ttl);
  
  return { 
    allowed: true, 
    remaining: limit - current.count, 
    resetTime: current.resetTime,
    limit
  };
}

/**
 * Rate limit types for distributed rate limiting
 * Re-export from rate-limit-redis for convenience
 */
export type { RateLimitTier };

/**
 * Check rate limit using Redis (distributed) when configured,
 * falls back to in-memory rate limiting otherwise.
 *
 * @param identifier - Unique identifier (IP, user ID, or combination)
 * @param type - Rate limit tier: 'auth' (5/15min), 'api' (100/1min), 'strict' (10/1hr), 'read' (200/1min), 'write' (50/1min)
 * @returns Promise with rate limit result
 */
export async function checkDistributedRateLimit(
  identifier: string,
  type: RateLimitTier = 'api'
): Promise<RateLimitResult & { retryAfter?: number }> {
  // Respect DISABLE_RATE_LIMITING env var (dev/testing only)
  if (isRateLimitingDisabled()) {
    return { allowed: true, remaining: 999, resetTime: Date.now() + 60000, limit: 999 }
  }

  // Use Redis if configured (check env vars first for fast path)
  if (maybeRedisConfigured()) {
    const result = await checkRedisRateLimit(identifier, type);

    const defaultLimits: Record<RateLimitTier, number> = {
      auth: 5,
      api: 100,
      strict: 10,
      read: 200,
      write: 50,
      webhook: 500,
    };

    return {
      allowed: result.success,
      remaining: result.remaining,
      resetTime: result.reset,
      limit: result.limit ?? defaultLimits[type],
      retryAfter: result.retryAfter,
    };
  }

  // Fallback to in-memory rate limiting
  const limits: Record<RateLimitTier, { limit: number; windowMs: number }> = {
    auth: { limit: 5, windowMs: 15 * 60 * 1000 },    // 5 requests per 15 minutes
    api: { limit: 100, windowMs: 60 * 1000 },         // 100 requests per minute
    strict: { limit: 10, windowMs: 60 * 60 * 1000 },  // 10 requests per hour
    read: { limit: 200, windowMs: 60 * 1000 },        // 200 requests per minute
    write: { limit: 50, windowMs: 60 * 1000 },        // 50 requests per minute
    webhook: { limit: 500, windowMs: 60 * 60 * 1000 }, // 500 requests per hour
  };

  const config = limits[type];
  const result = checkRateLimit(`${type}:${identifier}`, config.limit, config.windowMs);

  return {
    ...result,
    retryAfter: result.allowed ? undefined : Math.ceil((result.resetTime - Date.now()) / 1000),
  };
}

/**
 * Create a 429 rate limit response
 */
export function createRateLimitErrorResponse(result: RateLimitResult & { retryAfter?: number }): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      meta: {
        limit: result.limit,
        remaining: result.remaining,
        resetTime: new Date(result.resetTime).toISOString(),
        retryAfter: result.retryAfter ?? Math.ceil((result.resetTime - Date.now()) / 1000)
      }
    },
    {
      status: 429,
      headers: {
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': result.resetTime.toString(),
        'Retry-After': (result.retryAfter ?? Math.ceil((result.resetTime - Date.now()) / 1000)).toString()
      }
    }
  );
}

/**
 * Check if Redis-based distributed rate limiting might be available
 * (based on environment variables)
 */
export function isDistributedRateLimitAvailable(): boolean {
  return maybeRedisConfigured();
}

/**
 * Aplica rate limiting a una request API
 */
export function applyRateLimit(
  request: NextRequest,
  keyId: string,
  scopes: string[]
): NextResponse | null {
  // Obtener límites basados en scopes
  const rateLimits = getRateLimitForScopes(scopes);
  
  // Usar keyId como identificador único
  const rateLimit = checkRateLimit(keyId, rateLimits.requests, rateLimits.windowMs);
  
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { 
        success: false,
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        meta: {
          limit: rateLimit.limit,
          remaining: rateLimit.remaining,
          resetTime: new Date(rateLimit.resetTime).toISOString(),
          retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000)
        }
      },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimit.limit.toString(),
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetTime.toString(),
          'Retry-After': Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString()
        }
      }
    );
  }
  
  return null; // No rate limit hit
}

/**
 * Agrega headers de rate limiting a una respuesta
 */
export function addRateLimitHeaders(
  response: NextResponse, 
  keyId: string, 
  scopes: string[]
): NextResponse {
  const rateLimits = getRateLimitForScopes(scopes);
  const rateLimit = checkRateLimit(keyId, rateLimits.requests, rateLimits.windowMs);
  
  response.headers.set('X-RateLimit-Limit', rateLimit.limit.toString());
  response.headers.set('X-RateLimit-Remaining', Math.max(0, rateLimit.remaining).toString());
  response.headers.set('X-RateLimit-Reset', rateLimit.resetTime.toString());
  
  return response;
}

/**
 * Middleware helper para aplicar rate limiting automáticamente
 *
 * Limits per API key, with the limits of the key's scopes, when the request presents a key that validates.
 * The key id and scopes come from that validation, never from request headers; any other request runs the
 * handler without this limit.
 */
export function withRateLimit<T extends unknown[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    try {
      const auth = presentedApiKey(request.headers) ? await validateApiKey(request) : null;
      if (!auth) {
        return handler(request, ...args);
      }
      const { keyId, scopes } = auth;

      // Verificar rate limit
      const rateLimitResponse = applyRateLimit(request, keyId, scopes);
      if (rateLimitResponse) {
        return rateLimitResponse;
      }
      
      // Ejecutar handler
      const response = await handler(request, ...args);
      
      // Agregar headers de rate limiting
      return addRateLimitHeaders(response, keyId, scopes);
    } catch (error) {
      // The prerender interrupting the header reads above is Next's, not a rate limiting error
      unstable_rethrow(error);
      // En caso de error, continuar sin rate limiting
      console.error('Rate limiting error:', error);
      return handler(request, ...args);
    }
  };
}

/**
 * Obtiene estadísticas de rate limiting para un keyId
 */
export function getRateLimitStats(keyId: string): {
  currentUsage: number;
  resetTime: number;
  isNearLimit: boolean;
} | null {
  const cacheKey = getCacheKey('rate_limit', keyId);
  const current = rateLimitCache.get(cacheKey);
  
  if (!current) {
    return null;
  }
  
  return {
    currentUsage: current.count,
    resetTime: current.resetTime,
    isNearLimit: current.count > 800 // 80% del límite por defecto
  };
}

/**
 * Limpia manualmente el rate limit para un keyId (útil para testing)
 */
export function clearRateLimit(keyId: string): void {
  const cacheKey = getCacheKey('rate_limit', keyId);
  rateLimitCache.delete(cacheKey);
}

/**
 * Obtiene todas las estadísticas de rate limiting (útil para monitoring)
 */
export function getAllRateLimitStats(): Array<{
  keyId: string;
  count: number;
  resetTime: number;
}> {
  // Obtener estadísticas del cache
  const cacheStats = rateLimitCache.getStats();
  
  return [{
    keyId: 'cache_summary',
    count: cacheStats.active,
    resetTime: Date.now() + 60000 // Próximo cleanup
  }];
}

/**
 * Obtiene estadísticas del cache de rate limiting
 */
export function getRateLimitCacheStats() {
  return rateLimitCache.getStats();
}

/**
 * Higher-Order Component that applies rate limiting to API route handlers.
 *
 * This HOC wraps a Next.js route handler and applies rate limiting using the
 * distributed rate limiting system (Redis when configured, in-memory fallback).
 * Before that it refuses cookie-authenticated writes from an untrusted origin
 * (checkRequestOrigin), so every route that uses it gets that check too. Every
 * response it returns (the route's, its own 429 and the origin check's 403)
 * carries core's CORS for the request (withCors), except in the 'webhook' tier:
 * webhooks are called server to server and get no CORS.
 *
 * Rate limiting strategy:
 * - Counts per client address (getClientIp), for every caller. It runs before the handler has
 *   authenticated anything, so no credential or identity header (x-api-key included) picks the
 *   bucket. Routes that authenticate with validateAndAuthenticateRequest or
 *   validateAndAuthenticateApiRequest (helpers.ts) also limit a validated API key per key; routes that use
 *   authenticateRequest have only this per-address limit.
 * - Rate limits are applied per-tier across ALL endpoints (not per-endpoint)
 *
 * Rate limit tiers:
 * - 'auth': 5 requests per 15 minutes (for authentication endpoints)
 * - 'api': 100 requests per minute (default, general API endpoints)
 * - 'strict': 10 requests per hour (for sensitive operations)
 * - 'read': 200 requests per minute (for read-only operations like GET)
 * - 'write': 50 requests per minute (for write operations like POST/PUT/DELETE)
 * - 'webhook': 500 requests per hour (for webhook endpoints - signature verification is the primary security layer)
 *
 * @param handler - The route handler to wrap
 * @param tier - The rate limit tier to apply (default: 'api')
 * @returns A wrapped handler that applies rate limiting before executing the original handler
 *
 * @example
 * // In a route.ts file:
 * export const GET = withRateLimitTier(async (req) => {
 *   // Your handler logic
 *   return NextResponse.json({ data: 'hello' });
 * }, 'read');
 *
 * export const POST = withRateLimitTier(async (req) => {
 *   // Your handler logic
 *   return NextResponse.json({ created: true });
 * }, 'write');
 */
/**
 * Check if rate limiting is disabled via environment variable.
 * Use DISABLE_RATE_LIMITING=true to disable rate limiting (development/testing only).
 * WARNING: Never disable rate limiting in production!
 */
let rateLimitDisabledWarningLogged = false;
function isRateLimitingDisabled(): boolean {
  const disabled = process.env.DISABLE_RATE_LIMITING === 'true';
  if (disabled && !rateLimitDisabledWarningLogged) {
    console.warn('[RateLimit] WARNING: Rate limiting is DISABLED via DISABLE_RATE_LIMITING=true. Do not use in production!');
    rateLimitDisabledWarningLogged = true;
  }
  return disabled;
}

export function withRateLimitTier<T extends unknown[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>,
  tier: RateLimitTier = 'api'
) {
  const limited = async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    // Cookie-authenticated writes must come from a trusted origin (see request-origin.ts)
    const checked = checkRequestOrigin(request);
    if (checked instanceof NextResponse) return checked;
    request = checked;

    // Skip rate limiting if disabled via environment variable
    if (isRateLimitingDisabled()) {
      return handler(request, ...args);
    }

    // Per client address and tier, across all endpoints (see the strategy above)
    const identifier = `${tier}:ip:${getClientIp(request.headers)}`;

    // Check rate limit using distributed system
    const rateLimitResult = await checkDistributedRateLimit(identifier, tier);

    if (!rateLimitResult.allowed) {
      return createRateLimitErrorResponse(rateLimitResult);
    }

    // Execute the original handler
    const response = await handler(request, ...args);

    // Add rate limit headers to successful responses
    response.headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString());
    response.headers.set('X-RateLimit-Remaining', Math.max(0, rateLimitResult.remaining).toString());
    response.headers.set('X-RateLimit-Reset', rateLimitResult.resetTime.toString());

    return response;
  };

  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const response = await limited(request, ...args);
    return tier === 'webhook' ? response : withCors(response, request);
  };
}
