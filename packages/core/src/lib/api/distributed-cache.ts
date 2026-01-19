/**
 * Distributed Cache System (Two-Tier: L1 Memory + L2 Redis)
 *
 * Provides distributed caching for multi-instance deployments using:
 * - L1: In-memory cache for fastest access (per-instance)
 * - L2: Redis (Upstash) for shared cache across instances
 *
 * Falls back gracefully when Redis is not configured.
 *
 * @example
 * ```typescript
 * // Basic usage
 * await cacheSet('user:123', userData, 300)
 * const user = await cacheGet<UserData>('user:123')
 *
 * // With tags for invalidation
 * await cacheSet('user:123', userData, 300, ['users', 'user:123'])
 * await cacheInvalidateByTag('users') // Invalidates all user caches
 * ```
 */

// L1 Memory Cache (local to each instance)
// Note: Uses FIFO eviction (first-in-first-out) when max capacity is reached.
// JavaScript Maps maintain insertion order, making FIFO simple and efficient.
interface L1CacheEntry<T> {
  value: T
  expiresAt: number
  tags: string[]
}

class L1MemoryCache {
  private cache = new Map<string, L1CacheEntry<unknown>>()
  private tagIndex = new Map<string, Set<string>>() // tag -> keys
  private maxSize: number
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor(maxSize: number = 10000) {
    this.maxSize = maxSize

    // Cleanup expired entries every 5 minutes (not in test)
    if (process.env.NODE_ENV !== 'test') {
      this.cleanupInterval = setInterval(() => this.cleanup(), 300000)
      // Ensure interval doesn't prevent process exit
      if (this.cleanupInterval.unref) {
        this.cleanupInterval.unref()
      }
    }
  }

  set<T>(key: string, value: T, ttlMs: number, tags: string[] = []): void {
    // Evict oldest (FIFO) if full
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictOldest()
    }

    // Remove old tag associations
    const existing = this.cache.get(key)
    if (existing) {
      for (const tag of existing.tags) {
        this.tagIndex.get(tag)?.delete(key)
      }
    }

    // Store entry
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
      tags,
    })

    // Update tag index
    for (const tag of tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set())
      }
      this.tagIndex.get(tag)!.add(key)
    }
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    if (entry.expiresAt < Date.now()) {
      this.delete(key)
      return null
    }

    return entry.value as T
  }

  delete(key: string): boolean {
    const entry = this.cache.get(key)
    if (entry) {
      // Clean up tag index
      for (const tag of entry.tags) {
        this.tagIndex.get(tag)?.delete(key)
      }
    }
    return this.cache.delete(key)
  }

  invalidateByTag(tag: string): number {
    const keys = this.tagIndex.get(tag)
    if (!keys) return 0

    // Copy keys to array to avoid mutation during iteration (fix #2 race condition)
    const keysToDelete = [...keys]

    // Remove tag index first to prevent re-adding during delete
    this.tagIndex.delete(tag)

    let count = 0
    for (const key of keysToDelete) {
      // Directly delete from cache without going through delete() to avoid
      // re-accessing the tag index we just deleted
      const entry = this.cache.get(key)
      if (entry) {
        // Clean up other tag associations (not the one being invalidated)
        for (const otherTag of entry.tags) {
          if (otherTag !== tag) {
            this.tagIndex.get(otherTag)?.delete(key)
          }
        }
        this.cache.delete(key)
        count++
      }
    }
    return count
  }

  clear(): void {
    this.cache.clear()
    this.tagIndex.clear()
  }

  /**
   * Evicts the oldest entry (FIFO - First In, First Out).
   * JavaScript Maps maintain insertion order, so the first key is the oldest.
   */
  private evictOldest(): void {
    const firstKey = this.cache.keys().next().value
    if (firstKey) {
      this.delete(firstKey)
    }
  }

  private cleanup(): void {
    const now = Date.now()
    const toDelete: string[] = []

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        toDelete.push(key)
      }
    }

    for (const key of toDelete) {
      this.delete(key)
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.clear()
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      tagCount: this.tagIndex.size,
    }
  }
}

// L1 instance (mutable for testing reset)
let l1Cache = new L1MemoryCache()

// L2 Redis types and lazy loading
type RedisScanResult = [cursor: string, keys: string[]]

type RedisClient = {
  get: (key: string) => Promise<string | null>
  set: (key: string, value: string, options?: { ex?: number }) => Promise<unknown>
  del: (...keys: string[]) => Promise<number>
  sadd: (key: string, ...members: string[]) => Promise<number>
  smembers: (key: string) => Promise<string[]>
  srem: (key: string, ...members: string[]) => Promise<number>
  scan: (cursor: number | string, options?: { match?: string; count?: number }) => Promise<RedisScanResult>
  pipeline: () => {
    del: (...keys: string[]) => unknown
    srem: (key: string, ...members: string[]) => unknown
    exec: () => Promise<Array<{ error: Error | null; result: unknown }> | null>
  }
}

let redisClient: RedisClient | null = null
let redisInitialized = false
let redisError: Error | null = null

const CACHE_PREFIX = 'cache:'
const TAG_PREFIX = 'cache:tag:'

/**
 * Initialize Redis client lazily
 */
async function getRedisClient(): Promise<RedisClient | null> {
  if (redisInitialized) {
    return redisError ? null : redisClient
  }

  // Check if credentials are configured
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    redisInitialized = true
    return null
  }

  try {
    const { Redis } = await import('@upstash/redis')
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    }) as unknown as RedisClient

    redisInitialized = true
    return redisClient
  } catch (error) {
    redisError = error as Error
    redisInitialized = true

    if (process.env.NODE_ENV === 'development') {
      console.warn('[DistributedCache] Redis not available, using L1 only:', (error as Error).message)
    }
    return null
  }
}

/**
 * Serialize value for Redis storage
 */
function serialize<T>(value: T): string {
  return JSON.stringify(value)
}

/**
 * Deserialize value from Redis storage
 */
function deserialize<T>(value: string): T {
  try {
    return JSON.parse(value) as T
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[DistributedCache] JSON parse error, returning raw value:', error)
    }
    return value as unknown as T
  }
}

/**
 * Get a value from the distributed cache
 *
 * Checks L1 (memory) first, then L2 (Redis) if not found.
 * When found in L2, populates L1 for subsequent accesses.
 *
 * @param key - Cache key
 * @returns Cached value or null if not found/expired
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  // L1: Check memory first (fastest)
  const l1Value = l1Cache.get<T>(key)
  if (l1Value !== null) {
    return l1Value
  }

  // L2: Check Redis
  const redis = await getRedisClient()
  if (redis) {
    try {
      const redisKey = `${CACHE_PREFIX}${key}`
      const redisValue = await redis.get(redisKey)

      if (redisValue) {
        const parsed = deserialize<{ value: T; tags: string[]; ttl: number }>(redisValue)

        // Calculate remaining TTL (fix #3: don't extend expired entries)
        const remainingTtl = parsed.ttl - Date.now()

        // If entry has expired or has less than 100ms remaining, treat as miss
        if (remainingTtl <= 100) {
          return null
        }

        // Populate L1 with actual remaining TTL (no minimum extension)
        l1Cache.set(key, parsed.value, remainingTtl, parsed.tags)

        return parsed.value
      }
    } catch (error) {
      console.error('[DistributedCache] Redis get error:', error)
      // Fall through to return null
    }
  }

  return null
}

/**
 * Set a value in the distributed cache
 *
 * Stores in both L1 (memory) and L2 (Redis).
 * Uses tags for efficient bulk invalidation.
 *
 * @param key - Cache key
 * @param value - Value to cache
 * @param ttlSeconds - Time to live in seconds (default: 300 = 5 minutes)
 * @param tags - Optional tags for bulk invalidation
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number = 300,
  tags: string[] = []
): Promise<void> {
  const ttlMs = ttlSeconds * 1000
  const expiresAt = Date.now() + ttlMs

  // L1: Store in memory
  l1Cache.set(key, value, ttlMs, tags)

  // L2: Store in Redis
  const redis = await getRedisClient()
  if (redis) {
    try {
      const redisKey = `${CACHE_PREFIX}${key}`
      const redisValue = serialize({ value, tags, ttl: expiresAt })

      await redis.set(redisKey, redisValue, { ex: ttlSeconds })

      // Update tag index in Redis
      if (tags.length > 0) {
        await Promise.all(tags.map((tag) => redis.sadd(`${TAG_PREFIX}${tag}`, key)))
      }
    } catch (error) {
      console.error('[DistributedCache] Redis set error:', error)
      // L1 already set, so cache still works locally
    }
  }
}

/**
 * Delete a specific key from the cache
 *
 * Removes from both L1 and L2.
 *
 * @param key - Cache key to delete
 */
export async function cacheDelete(key: string): Promise<boolean> {
  // L1: Delete from memory
  const l1Deleted = l1Cache.delete(key)

  // L2: Delete from Redis
  const redis = await getRedisClient()
  if (redis) {
    try {
      const redisKey = `${CACHE_PREFIX}${key}`
      await redis.del(redisKey)
    } catch (error) {
      console.error('[DistributedCache] Redis delete error:', error)
    }
  }

  return l1Deleted
}

/**
 * Invalidate all cache entries with a specific tag
 *
 * Useful for invalidating related caches, e.g., all user-related caches
 * when user data changes.
 *
 * @param tag - Tag to invalidate
 * @returns Number of entries invalidated (from L1)
 */
export async function cacheInvalidateByTag(tag: string): Promise<number> {
  // L1: Invalidate locally
  const l1Count = l1Cache.invalidateByTag(tag)

  // L2: Invalidate in Redis
  const redis = await getRedisClient()
  if (redis) {
    try {
      const tagKey = `${TAG_PREFIX}${tag}`
      const keys = await redis.smembers(tagKey)

      if (keys.length > 0) {
        const redisKeys = keys.map((k) => `${CACHE_PREFIX}${k}`)
        const pipeline = redis.pipeline()
        pipeline.del(...redisKeys)
        pipeline.srem(tagKey, ...keys)

        // Fix #5: Verify pipeline execution result
        const result = await pipeline.exec()
        if (!result) {
          console.error('[DistributedCache] Pipeline execution returned null for tag:', tag)
        }
      }
    } catch (error) {
      console.error('[DistributedCache] Redis invalidate error:', error)
    }
  }

  return l1Count
}

/**
 * Delete keys matching a pattern using SCAN (non-blocking)
 * Fix #6: Use SCAN instead of KEYS to avoid blocking Redis
 */
async function scanAndDelete(redis: RedisClient, pattern: string): Promise<number> {
  let cursor = '0'
  let totalDeleted = 0

  do {
    const [nextCursor, keys] = await redis.scan(cursor, { match: pattern, count: 100 })
    cursor = nextCursor

    if (keys.length > 0) {
      const deleted = await redis.del(...keys)
      totalDeleted += deleted
    }
  } while (cursor !== '0')

  return totalDeleted
}

/**
 * Clear all cache entries
 *
 * Use with caution - clears entire cache.
 * Uses SCAN for Redis to avoid blocking (safe for production).
 */
export async function cacheClear(): Promise<void> {
  // L1: Clear memory
  l1Cache.clear()

  // L2: Clear Redis cache keys using SCAN (fix #6: non-blocking)
  const redis = await getRedisClient()
  if (redis) {
    try {
      // Delete cache entries
      await scanAndDelete(redis, `${CACHE_PREFIX}*`)

      // Delete tag indexes
      await scanAndDelete(redis, `${TAG_PREFIX}*`)
    } catch (error) {
      console.error('[DistributedCache] Redis clear error:', error)
    }
  }
}

/**
 * Check if Redis is available for distributed caching
 */
export async function isDistributedCacheAvailable(): Promise<boolean> {
  const redis = await getRedisClient()
  return redis !== null
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  l1: { size: number; maxSize: number; tagCount: number }
  l2Available: boolean
}> {
  const redis = await getRedisClient()
  return {
    l1: l1Cache.getStats(),
    l2Available: redis !== null,
  }
}

/**
 * Helper to create cache keys with consistent naming
 */
export function createCacheKey(namespace: string, ...parts: string[]): string {
  return `${namespace}:${parts.join(':')}`
}

// Export L1 cache for testing purposes
export { l1Cache as _l1Cache }

/**
 * Reset function for testing (fix #7: properly destroy and recreate)
 */
export function _resetForTesting(): void {
  // Destroy existing instance to clear intervals
  l1Cache.destroy()

  // Create fresh instance
  l1Cache = new L1MemoryCache()

  // Reset Redis state
  redisClient = null
  redisInitialized = false
  redisError = null
}

/**
 * Cleanup function for graceful shutdown (fix #1: lifecycle management)
 * Call this when your application is shutting down.
 */
export function destroyCache(): void {
  l1Cache.destroy()
}
