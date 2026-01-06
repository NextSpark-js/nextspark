interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
  hits: number;
  lastAccessed: number;
}

export class LRUCache<K, V> {
  private cache: Map<K, CacheEntry<V>> = new Map();
  private maxSize: number;
  private defaultTtl: number;
  private hitCount = 0;
  private missCount = 0;

  constructor(maxSize: number = 1000, defaultTtl: number = 300000) { // 5 minutes default TTL
    this.maxSize = maxSize;
    this.defaultTtl = defaultTtl;
  }

  public get(key: K): V | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.missCount++;
      return undefined;
    }

    // Check if expired
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      this.missCount++;
      return undefined;
    }

    // Update access stats
    entry.hits++;
    entry.lastAccessed = Date.now();
    this.hitCount++;

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  public set(key: K, value: V, ttl?: number): void {
    const now = Date.now();
    const entryTtl = ttl || this.defaultTtl;

    // Remove existing entry if it exists
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used item
      this.evictLRU();
    }

    // Add new entry
    this.cache.set(key, {
      value,
      timestamp: now,
      ttl: entryTtl,
      hits: 0,
      lastAccessed: now,
    });
  }

  public delete(key: K): boolean {
    return this.cache.delete(key);
  }

  public has(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check if expired
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  public clear(): void {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  public size(): number {
    this.cleanupExpired();
    return this.cache.size;
  }

  public getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    missRate: number;
    totalHits: number;
    totalMisses: number;
  } {
    this.cleanupExpired();
    const total = this.hitCount + this.missCount;
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: total > 0 ? this.hitCount / total : 0,
      missRate: total > 0 ? this.missCount / total : 0,
      totalHits: this.hitCount,
      totalMisses: this.missCount,
    };
  }

  public getEntryStats(key: K): {
    hits: number;
    age: number;
    ttl: number;
    lastAccessed: number;
  } | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    return {
      hits: entry.hits,
      age: Date.now() - entry.timestamp,
      ttl: entry.ttl,
      lastAccessed: entry.lastAccessed,
    };
  }

  private evictLRU(): void {
    // Find the least recently used entry
    let lruKey: K | null = null;
    let oldestAccess = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestAccess) {
        oldestAccess = entry.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey !== null) {
      this.cache.delete(lruKey);
    }
  }

  private cleanupExpired(): void {
    const now = Date.now();
    const expiredKeys: K[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.timestamp + entry.ttl) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.cache.delete(key));
  }

  public keys(): K[] {
    this.cleanupExpired();
    return Array.from(this.cache.keys());
  }

  public values(): V[] {
    this.cleanupExpired();
    return Array.from(this.cache.values()).map(entry => entry.value);
  }

  public entries(): [K, V][] {
    this.cleanupExpired();
    return Array.from(this.cache.entries()).map(([key, entry]) => [key, entry.value]);
  }
}

