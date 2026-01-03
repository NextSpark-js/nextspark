/**
 * Contents System Types
 * 
 * Shared types for the contents system
 */

import type { EntityConfig } from '../entities/types'
import type { PluginConfig, PluginHooks } from '../../types/plugin'
import type { ThemeConfig, ComponentOverride } from '../theme/types'

// Re-export from individual systems
export type { EntityConfig }
export type { PluginConfig, PluginHooks }
export type { ThemeConfig, ComponentOverride }

/**
 * Contents loading result
 */
export interface ContentsLoadingResult {
  entities: EntityConfig[]
  plugins: PluginConfig[]
  themes: ThemeConfig[]
}

/**
 * Content item base interface
 */
export interface ContentItem {
  name: string
  displayName: string
  version: string
  description?: string
  enabled?: boolean
}

/**
 * Content discovery result
 */
export interface ContentDiscoveryResult<T extends ContentItem = ContentItem> {
  items: T[]
  errors: string[]
  warnings: string[]
  discoveredAt: number
  duration: number
}

/**
 * Content loader interface
 */
export interface ContentLoader<T extends ContentItem = ContentItem> {
  discover(): Promise<T[]>
  load(name: string): Promise<T | null>
  validate(item: T): { valid: boolean; errors: string[] }
  getLoadedItems(): T[]
  clearCache(): void
}

/**
 * Contents system configuration
 */
export interface ContentsConfig {
  autoDiscovery: {
    enabled: boolean
    interval: number // Cache refresh interval in ms
    includeDevMode: boolean // Include dev-only content
  }
  caching: {
    enabled: boolean
    ttl: number // Cache TTL in ms
    maxSize: number // Max cache entries
  }
  security: {
    validateItems: boolean
    allowDynamicImports: boolean
    trustedSources: string[]
  }
  performance: {
    preloadEnabled: boolean
    batchLoading: boolean
    lazyComponents: boolean
  }
}

/**
 * Content validation result
 */
export interface ContentValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  item: string
  type: 'entity' | 'plugin' | 'theme'
}

/**
 * Contents system statistics
 */
export interface ContentsStats {
  entities: {
    total: number
    loaded: number
    active: number
    errors: number
  }
  plugins: {
    total: number
    loaded: number
    active: number
    errors: number
  }
  themes: {
    total: number
    loaded: number
    active: number
  }
  performance: {
    totalLoadTime: number
    cacheHitRate: number
    memoryUsage: number
  }
  cache: {
    size: number
    hits: number
    misses: number
  }
}

/**
 * Content event types
 */
export type ContentEvent = 
  | 'content-discovered'
  | 'content-loaded'
  | 'content-error'
  | 'content-activated'
  | 'content-deactivated'
  | 'cache-cleared'
  | 'system-ready'

/**
 * Content event data
 */
export interface ContentEventData {
  type: ContentEvent
  timestamp: number
  data: Record<string, unknown>
  source: 'entity' | 'plugin' | 'theme' | 'system'
}

/**
 * Content event handler
 */
export type ContentEventHandler = (event: ContentEventData) => void | Promise<void>