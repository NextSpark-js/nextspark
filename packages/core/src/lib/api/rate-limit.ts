import { NextRequest, NextResponse } from 'next/server';
import { getRateLimitForScopes } from './keys';
import { rateLimitCache, getCacheKey } from './cache';
import {
  checkRateLimit as checkRedisRateLimit,
  maybeRedisConfigured,
  type RateLimitCheckResult as RedisRateLimitResult,
  type RateLimitTier,
} from '../rate-limit-redis';

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
  // Use Redis if configured (check env vars first for fast path)
  if (maybeRedisConfigured()) {
    const result = await checkRedisRateLimit(identifier, type);

    const defaultLimits: Record<RateLimitTier, number> = {
      auth: 5,
      api: 100,
      strict: 10,
      read: 200,
      write: 50,
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
 */
export function withRateLimit<T extends unknown[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    try {
      // Extraer información de autenticación
      const keyId = request.headers.get('x-api-key-id');
      const scopesHeader = request.headers.get('x-api-scopes');
      
      if (!keyId || !scopesHeader) {
        // Si no hay autenticación API, continuar sin rate limiting
        return handler(request, ...args);
      }
      
      let scopes: string[] = [];
      try {
        const parsed = JSON.parse(scopesHeader);
        if (Array.isArray(parsed)) {
          scopes = parsed.filter((s): s is string => typeof s === 'string');
        }
      } catch {
        console.warn('[RateLimit] Invalid scopes header format');
      }
      
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
 * Get client IP address from request headers
 * Handles various proxy scenarios (X-Forwarded-For, X-Real-IP, etc.)
 */
function getClientIp(request: NextRequest): string {
  // X-Forwarded-For can contain multiple IPs: client, proxy1, proxy2
  // The first one is the original client IP
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const ips = forwardedFor.split(',').map(ip => ip.trim());
    if (ips[0]) return ips[0];
  }

  // X-Real-IP is set by some proxies (nginx)
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;

  // CF-Connecting-IP is set by Cloudflare
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp;

  // True-Client-IP is set by some CDNs
  const trueClientIp = request.headers.get('true-client-ip');
  if (trueClientIp) return trueClientIp;

  // Fallback to a generic identifier
  return 'unknown';
}

/**
 * Extract user identifier from request headers if available.
 * Checks for API key header which indicates an authenticated API request.
 * This allows for user-based rate limiting when authenticated.
 */
function getUserIdentifier(request: NextRequest): string | null {
  // Check for API key - if present, use it as user identifier
  // This provides user-based rate limiting for API key authenticated requests
  const apiKey = request.headers.get('x-api-key');
  if (apiKey) {
    // Use a hash of the API key (first 16 chars) to avoid exposing full key in logs
    return `apikey:${apiKey.substring(0, 16)}`;
  }

  // For session-based auth, we can't easily extract user ID without async auth check
  // The handler itself will perform auth, so we fall back to IP-based limiting here
  return null;
}

/**
 * Higher-Order Component that applies rate limiting to API route handlers.
 *
 * This HOC wraps a Next.js route handler and applies rate limiting using the
 * distributed rate limiting system (Redis when configured, in-memory fallback).
 *
 * Rate limiting strategy:
 * - Uses user identifier (API key) when available for more accurate per-user limiting
 * - Falls back to IP-based limiting for unauthenticated or session-based requests
 * - Rate limits are applied per-tier across ALL endpoints (not per-endpoint)
 *
 * Rate limit tiers:
 * - 'auth': 5 requests per 15 minutes (for authentication endpoints)
 * - 'api': 100 requests per minute (default, general API endpoints)
 * - 'strict': 10 requests per hour (for sensitive operations)
 * - 'read': 200 requests per minute (for read-only operations like GET)
 * - 'write': 50 requests per minute (for write operations like POST/PUT/DELETE)
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
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    // Skip rate limiting if disabled via environment variable
    if (isRateLimitingDisabled()) {
      return handler(request, ...args);
    }

    // Get client identifier - prefer user-based (API key) over IP-based
    const userIdentifier = getUserIdentifier(request);
    const clientIp = getClientIp(request);

    // Create identifier: use user-based when available, otherwise IP-based
    // Rate limits apply per-tier across all endpoints (not per-endpoint)
    // This prevents attackers from hitting multiple endpoints to bypass limits
    const identifier = userIdentifier
      ? `${tier}:${userIdentifier}`
      : `${tier}:ip:${clientIp}`;

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
}
