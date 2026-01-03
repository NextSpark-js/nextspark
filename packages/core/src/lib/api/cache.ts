/**
 * Sistema de cache optimizado para rate limiting y datos frecuentes
 * Implementación in-memory con TTL y LRU eviction
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  lastAccessed: number;
}

class MemoryCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;
  private defaultTTL: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(maxSize: number = 10000, defaultTTL: number = 300000) { // 5 min default
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
    
    // Cleanup cada 5 minutos solo en production
    if (process.env.NODE_ENV !== 'test') {
      this.cleanupInterval = setInterval(() => this.cleanup(), 300000);
    }
  }

  set(key: string, value: T, ttl?: number): void {
    const now = Date.now();
    const expiresAt = now + (ttl || this.defaultTTL);
    
    // Evict LRU si está lleno
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }
    
    this.cache.set(key, {
      value,
      expiresAt,
      lastAccessed: now
    });
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    const now = Date.now();
    
    // Verificar expiración
    if (entry.expiresAt < now) {
      this.cache.delete(key);
      return null;
    }
    
    // Actualizar último acceso
    entry.lastAccessed = now;
    
    return entry.value;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }
    
    // Verificar expiración
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        toDelete.push(key);
      }
    }
    
    toDelete.forEach(key => this.cache.delete(key));
  }

  // Método para obtener estadísticas
  getStats() {
    const now = Date.now();
    let expired = 0;
    let active = 0;
    
    for (const entry of this.cache.values()) {
      if (entry.expiresAt < now) {
        expired++;
      } else {
        active++;
      }
    }
    
    return {
      total: this.cache.size,
      active,
      expired,
      maxSize: this.maxSize
    };
  }
}

// Instancias globales de cache
export const rateLimitCache = new MemoryCache<{
  count: number;
  resetTime: number;
}>(5000, 60000); // 1 minuto TTL para rate limiting

export const apiKeyCache = new MemoryCache<{
  id: string;
  userId: string;
  scopes: string[];
  status: 'active' | 'inactive' | 'expired';
  expiresAt: string | null;
  failedAttempts: number | null;
  lockedUntil: string | null;
}>(1000, 300000); // 5 minutos TTL para API keys

export const userCache = new MemoryCache<{
  id: string;
  role: string;
  email: string;
}>(2000, 600000); // 10 minutos TTL para datos de usuario

// Helper functions
export function getCacheKey(prefix: string, ...parts: string[]): string {
  return `${prefix}:${parts.join(':')}`;
}

export function invalidatePattern(cache: MemoryCache<unknown>, pattern: string): void {
  const keys = Array.from((cache as unknown as { cache: Map<string, unknown> }).cache.keys());
  const regex = new RegExp(pattern.replace('*', '.*'));
  
  keys.forEach(key => {
    if (regex.test(key)) {
      cache.delete(key);
    }
  });
}
