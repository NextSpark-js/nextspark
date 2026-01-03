/**
 * Sistema de cache optimizado para rate limiting y datos frecuentes
 * Implementación in-memory con TTL y LRU eviction
 */
declare class MemoryCache<T> {
    private cache;
    private maxSize;
    private defaultTTL;
    private cleanupInterval;
    constructor(maxSize?: number, defaultTTL?: number);
    set(key: string, value: T, ttl?: number): void;
    get(key: string): T | null;
    delete(key: string): boolean;
    has(key: string): boolean;
    clear(): void;
    size(): number;
    destroy(): void;
    private evictLRU;
    private cleanup;
    getStats(): {
        total: number;
        active: number;
        expired: number;
        maxSize: number;
    };
}
export declare const rateLimitCache: MemoryCache<{
    count: number;
    resetTime: number;
}>;
export declare const apiKeyCache: MemoryCache<{
    id: string;
    userId: string;
    scopes: string[];
    status: 'active' | 'inactive' | 'expired';
    expiresAt: string | null;
    failedAttempts: number | null;
    lockedUntil: string | null;
}>;
export declare const userCache: MemoryCache<{
    id: string;
    role: string;
    email: string;
}>;
export declare function getCacheKey(prefix: string, ...parts: string[]): string;
export declare function invalidatePattern(cache: MemoryCache<unknown>, pattern: string): void;
export {};
//# sourceMappingURL=cache.d.ts.map