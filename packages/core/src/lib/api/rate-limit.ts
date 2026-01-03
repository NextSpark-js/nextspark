import { NextRequest, NextResponse } from 'next/server';
import { getRateLimitForScopes } from './keys';
import { rateLimitCache, getCacheKey } from './cache';

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
