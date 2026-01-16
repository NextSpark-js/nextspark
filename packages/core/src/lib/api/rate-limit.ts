import { NextRequest, NextResponse } from 'next/server';
import { getRateLimitForScopes } from './keys';
import { rateLimitCache, getCacheKey } from './cache';
import {
  apiRateLimiter,
  authRateLimiter,
  strictRateLimiter,
  checkRateLimit as checkRedisRateLimit,
  isRedisConfigured,
  type RateLimitCheckResult as RedisRateLimitResult,
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
 */
export type RateLimitType = 'auth' | 'api' | 'strict';

/**
 * Check rate limit using Redis (distributed) when configured,
 * falls back to in-memory rate limiting otherwise.
 *
 * @param identifier - Unique identifier (IP, user ID, or combination)
 * @param type - Rate limit tier: 'auth' (5/15min), 'api' (100/1min), 'strict' (10/1hr)
 * @returns Promise with rate limit result
 */
export async function checkDistributedRateLimit(
  identifier: string,
  type: RateLimitType = 'api'
): Promise<RateLimitResult & { retryAfter?: number }> {
  // Use Redis if configured
  if (isRedisConfigured()) {
    const limiter = type === 'auth'
      ? authRateLimiter
      : type === 'strict'
        ? strictRateLimiter
        : apiRateLimiter;

    const result = await checkRedisRateLimit(identifier, limiter);

    return {
      allowed: result.success,
      remaining: result.remaining,
      resetTime: result.reset,
      limit: result.limit ?? (type === 'auth' ? 5 : type === 'strict' ? 10 : 100),
      retryAfter: result.retryAfter,
    };
  }

  // Fallback to in-memory rate limiting
  const limits = {
    auth: { limit: 5, windowMs: 15 * 60 * 1000 },    // 5 requests per 15 minutes
    api: { limit: 100, windowMs: 60 * 1000 },         // 100 requests per minute
    strict: { limit: 10, windowMs: 60 * 60 * 1000 },  // 10 requests per hour
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
 * Check if Redis-based distributed rate limiting is available
 */
export function isDistributedRateLimitAvailable(): boolean {
  return isRedisConfigured();
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
      
      const scopes = JSON.parse(scopesHeader);
      
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
