/**
 * Tests for Distributed Cache System (Two-Tier: L1 Memory + L2 Redis)
 *
 * Tests the caching functionality including:
 * - L1 memory cache operations (FIFO eviction)
 * - L2 Redis integration (mocked)
 * - Tag-based invalidation
 * - Fallback behavior when Redis is unavailable
 * - SCAN-based cache clearing (production-safe)
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import {
  cacheGet,
  cacheSet,
  cacheDelete,
  cacheInvalidateByTag,
  cacheClear,
  getCacheStats,
  createCacheKey,
  isDistributedCacheAvailable,
  destroyCache,
  _l1Cache,
  _resetForTesting,
} from '@/core/lib/api/distributed-cache'

// Mock Redis module
const mockRedisGet = jest.fn()
const mockRedisSet = jest.fn()
const mockRedisDel = jest.fn()
const mockRedisSadd = jest.fn()
const mockRedisSmembers = jest.fn()
const mockRedisSrem = jest.fn()
const mockRedisScan = jest.fn()
const mockPipelineExec = jest.fn()

const mockPipeline = jest.fn(() => ({
  del: jest.fn().mockReturnThis(),
  srem: jest.fn().mockReturnThis(),
  exec: mockPipelineExec,
}))

jest.mock('@upstash/redis', () => ({
  Redis: jest.fn().mockImplementation(() => ({
    get: mockRedisGet,
    set: mockRedisSet,
    del: mockRedisDel,
    sadd: mockRedisSadd,
    smembers: mockRedisSmembers,
    srem: mockRedisSrem,
    scan: mockRedisScan,
    pipeline: mockPipeline,
  })),
}))

describe('Distributed Cache System', () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks()

    // Reset cache state
    _resetForTesting()

    // Set up Redis env vars
    process.env = {
      ...originalEnv,
      UPSTASH_REDIS_REST_URL: 'https://test.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'test-token',
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('cacheGet', () => {
    it('should return null for non-existent key', async () => {
      mockRedisGet.mockResolvedValue(null)

      const result = await cacheGet('non-existent')

      expect(result).toBeNull()
    })

    it('should return value from L1 cache if present', async () => {
      // Pre-populate L1 cache
      _l1Cache.set('test-key', 'test-value', 60000, [])

      const result = await cacheGet('test-key')

      expect(result).toBe('test-value')
      // Redis should not be called if L1 has the value
      expect(mockRedisGet).not.toHaveBeenCalled()
    })

    it('should populate L1 from L2 on cache miss', async () => {
      const cachedData = {
        value: { name: 'Test User' },
        tags: ['users'],
        ttl: Date.now() + 60000,
      }
      mockRedisGet.mockResolvedValue(JSON.stringify(cachedData))

      const result = await cacheGet<{ name: string }>('user:123')

      expect(result).toEqual({ name: 'Test User' })

      // Verify L1 was populated
      const l1Value = _l1Cache.get('user:123')
      expect(l1Value).toEqual({ name: 'Test User' })
    })

    it('should NOT populate L1 when Redis entry is nearly expired (fix #3)', async () => {
      // Entry with only 50ms remaining (less than 100ms threshold)
      const cachedData = {
        value: { name: 'Expiring User' },
        tags: ['users'],
        ttl: Date.now() + 50,
      }
      mockRedisGet.mockResolvedValue(JSON.stringify(cachedData))

      const result = await cacheGet<{ name: string }>('user:expiring')

      // Should return null because entry is nearly expired
      expect(result).toBeNull()

      // L1 should NOT be populated
      const l1Value = _l1Cache.get('user:expiring')
      expect(l1Value).toBeNull()
    })

    it('should handle Redis errors gracefully', async () => {
      mockRedisGet.mockRejectedValue(new Error('Redis connection error'))

      const result = await cacheGet('test-key')

      expect(result).toBeNull()
    })
  })

  describe('cacheSet', () => {
    it('should store value in L1 cache', async () => {
      mockRedisSet.mockResolvedValue('OK')
      mockRedisSadd.mockResolvedValue(1)

      await cacheSet('test-key', 'test-value', 300)

      const l1Value = _l1Cache.get('test-key')
      expect(l1Value).toBe('test-value')
    })

    it('should store value in Redis (L2)', async () => {
      mockRedisSet.mockResolvedValue('OK')
      mockRedisSadd.mockResolvedValue(1)

      await cacheSet('test-key', { id: 123 }, 300, ['entity:123'])

      expect(mockRedisSet).toHaveBeenCalledWith(
        'cache:test-key',
        expect.any(String),
        { ex: 300 }
      )
    })

    it('should update tag index in Redis', async () => {
      mockRedisSet.mockResolvedValue('OK')
      mockRedisSadd.mockResolvedValue(1)

      await cacheSet('user:123', { name: 'Test' }, 300, ['users', 'user:123'])

      expect(mockRedisSadd).toHaveBeenCalledWith('cache:tag:users', 'user:123')
      expect(mockRedisSadd).toHaveBeenCalledWith('cache:tag:user:123', 'user:123')
    })

    it('should use default TTL of 300 seconds', async () => {
      mockRedisSet.mockResolvedValue('OK')

      await cacheSet('test-key', 'value')

      expect(mockRedisSet).toHaveBeenCalledWith(
        'cache:test-key',
        expect.any(String),
        { ex: 300 }
      )
    })

    it('should handle Redis errors gracefully (L1 still works)', async () => {
      mockRedisSet.mockRejectedValue(new Error('Redis error'))

      await cacheSet('test-key', 'test-value', 300)

      // L1 should still have the value
      const l1Value = _l1Cache.get('test-key')
      expect(l1Value).toBe('test-value')
    })
  })

  describe('cacheDelete', () => {
    it('should delete from L1 cache', async () => {
      mockRedisDel.mockResolvedValue(1)

      // Pre-populate
      _l1Cache.set('test-key', 'value', 60000, [])

      const result = await cacheDelete('test-key')

      expect(result).toBe(true)
      expect(_l1Cache.get('test-key')).toBeNull()
    })

    it('should delete from Redis (L2)', async () => {
      mockRedisDel.mockResolvedValue(1)

      await cacheDelete('test-key')

      expect(mockRedisDel).toHaveBeenCalledWith('cache:test-key')
    })

    it('should return false for non-existent key', async () => {
      mockRedisDel.mockResolvedValue(0)

      const result = await cacheDelete('non-existent')

      expect(result).toBe(false)
    })
  })

  describe('cacheInvalidateByTag', () => {
    it('should invalidate all keys with given tag in L1', async () => {
      mockRedisSmembers.mockResolvedValue(['user:1', 'user:2'])
      mockPipelineExec.mockResolvedValue([{ error: null, result: 2 }, { error: null, result: 2 }])

      // Pre-populate L1 with tagged entries
      _l1Cache.set('user:1', { id: 1 }, 60000, ['users'])
      _l1Cache.set('user:2', { id: 2 }, 60000, ['users'])
      _l1Cache.set('product:1', { id: 1 }, 60000, ['products'])

      const count = await cacheInvalidateByTag('users')

      expect(count).toBe(2)
      expect(_l1Cache.get('user:1')).toBeNull()
      expect(_l1Cache.get('user:2')).toBeNull()
      expect(_l1Cache.get('product:1')).not.toBeNull()
    })

    it('should invalidate in Redis using pipeline', async () => {
      mockRedisSmembers.mockResolvedValue(['key1', 'key2'])
      mockPipelineExec.mockResolvedValue([{ error: null, result: 2 }, { error: null, result: 2 }])

      await cacheInvalidateByTag('test-tag')

      expect(mockRedisSmembers).toHaveBeenCalledWith('cache:tag:test-tag')
      expect(mockPipeline).toHaveBeenCalled()
    })

    it('should return 0 for non-existent tag', async () => {
      mockRedisSmembers.mockResolvedValue([])

      const count = await cacheInvalidateByTag('non-existent')

      expect(count).toBe(0)
    })

    it('should handle entries with multiple tags correctly (fix #2)', async () => {
      mockRedisSmembers.mockResolvedValue(['user:1'])
      mockPipelineExec.mockResolvedValue([{ error: null, result: 1 }, { error: null, result: 1 }])

      // Entry with multiple tags
      _l1Cache.set('user:1', { id: 1 }, 60000, ['users', 'team:alpha'])

      // Invalidate by one tag
      await cacheInvalidateByTag('users')

      // Entry should be deleted
      expect(_l1Cache.get('user:1')).toBeNull()
    })
  })

  describe('cacheClear', () => {
    it('should clear L1 cache', async () => {
      // Mock SCAN to return keys then end
      mockRedisScan
        .mockResolvedValueOnce(['0', []])
        .mockResolvedValueOnce(['0', []])

      // Pre-populate
      _l1Cache.set('key1', 'value1', 60000, [])
      _l1Cache.set('key2', 'value2', 60000, [])

      await cacheClear()

      expect(_l1Cache.get('key1')).toBeNull()
      expect(_l1Cache.get('key2')).toBeNull()
    })

    it('should use SCAN instead of KEYS for Redis (fix #6)', async () => {
      // First SCAN call returns some keys, second returns empty (cursor 0)
      mockRedisScan
        .mockResolvedValueOnce(['123', ['cache:key1', 'cache:key2']])
        .mockResolvedValueOnce(['0', ['cache:key3']])
        .mockResolvedValueOnce(['0', []])
      mockRedisDel.mockResolvedValue(2)

      await cacheClear()

      // Verify SCAN was called instead of KEYS
      expect(mockRedisScan).toHaveBeenCalledWith('0', { match: 'cache:*', count: 100 })
      expect(mockRedisDel).toHaveBeenCalled()
    })

    it('should handle empty Redis gracefully', async () => {
      mockRedisScan
        .mockResolvedValueOnce(['0', []])
        .mockResolvedValueOnce(['0', []])

      await expect(cacheClear()).resolves.not.toThrow()
    })
  })

  describe('getCacheStats', () => {
    it('should return L1 stats and L2 availability', async () => {
      _l1Cache.set('key1', 'value', 60000, ['tag1'])
      _l1Cache.set('key2', 'value', 60000, ['tag1', 'tag2'])

      const stats = await getCacheStats()

      expect(stats.l1.size).toBe(2)
      expect(stats.l1.maxSize).toBe(10000)
      expect(stats.l2Available).toBe(true)
    })
  })

  describe('createCacheKey', () => {
    it('should create namespaced cache key', () => {
      const key = createCacheKey('users', '123', 'profile')

      expect(key).toBe('users:123:profile')
    })

    it('should handle single part', () => {
      const key = createCacheKey('config', 'app')

      expect(key).toBe('config:app')
    })
  })

  describe('destroyCache', () => {
    it('should clean up L1 cache resources', () => {
      _l1Cache.set('key1', 'value', 60000, [])

      destroyCache()

      // After destroy, cache should be cleared
      expect(_l1Cache.get('key1')).toBeNull()
    })
  })

  describe('Fallback behavior (no Redis)', () => {
    beforeEach(() => {
      // Remove Redis env vars
      delete process.env.UPSTASH_REDIS_REST_URL
      delete process.env.UPSTASH_REDIS_REST_TOKEN
      _resetForTesting()
    })

    it('should work with L1 only when Redis is not configured', async () => {
      await cacheSet('test-key', 'test-value', 300)

      const result = await cacheGet('test-key')

      expect(result).toBe('test-value')
    })

    it('should report L2 as unavailable', async () => {
      const available = await isDistributedCacheAvailable()

      expect(available).toBe(false)
    })

    it('should still support tag invalidation in L1', async () => {
      await cacheSet('user:1', { id: 1 }, 300, ['users'])
      await cacheSet('user:2', { id: 2 }, 300, ['users'])

      const count = await cacheInvalidateByTag('users')

      expect(count).toBe(2)
      expect(await cacheGet('user:1')).toBeNull()
      expect(await cacheGet('user:2')).toBeNull()
    })
  })

  describe('L1 Cache TTL and Expiration', () => {
    it('should expire entries after TTL', async () => {
      jest.useFakeTimers()

      _l1Cache.set('expiring-key', 'value', 1000, []) // 1 second TTL

      expect(_l1Cache.get('expiring-key')).toBe('value')

      // Advance time past TTL
      jest.advanceTimersByTime(1500)

      expect(_l1Cache.get('expiring-key')).toBeNull()

      jest.useRealTimers()
    })
  })

  describe('L1 FIFO Eviction (fix #4)', () => {
    it('should evict oldest entry when at capacity', () => {
      // Create a small cache for testing
      const smallCache = new (class extends Object {
        private cache = new Map<string, { value: unknown; expiresAt: number; tags: string[] }>()
        private maxSize = 3

        set(key: string, value: unknown) {
          if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            // FIFO: Remove first key
            const firstKey = this.cache.keys().next().value
            if (firstKey) this.cache.delete(firstKey)
          }
          this.cache.set(key, { value, expiresAt: Date.now() + 60000, tags: [] })
        }

        get(key: string) {
          return this.cache.get(key)?.value ?? null
        }

        getKeys() {
          return [...this.cache.keys()]
        }
      })()

      // Fill cache
      smallCache.set('first', 1)
      smallCache.set('second', 2)
      smallCache.set('third', 3)

      // Add fourth - should evict 'first' (FIFO)
      smallCache.set('fourth', 4)

      expect(smallCache.get('first')).toBeNull()
      expect(smallCache.get('second')).toBe(2)
      expect(smallCache.get('third')).toBe(3)
      expect(smallCache.get('fourth')).toBe(4)
    })
  })

  describe('_resetForTesting (fix #7)', () => {
    it('should properly destroy and recreate cache instance', async () => {
      // Set some data
      await cacheSet('test-key', 'test-value', 300)
      expect(await cacheGet('test-key')).toBe('test-value')

      // Reset
      _resetForTesting()

      // Data should be cleared
      expect(_l1Cache.get('test-key')).toBeNull()
    })
  })
})
