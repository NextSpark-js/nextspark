/**
 * WalkMe Plugin Environment Configuration
 *
 * Uses centralized plugin environment loader from core.
 * Provides type-safe access to WalkMe configuration.
 */

import { getPluginEnv } from '@nextsparkjs/core/lib/plugins/env-loader'

interface WalkmePluginEnvConfig {
  WALKME_ENABLED?: string
  WALKME_DEBUG?: string
  WALKME_AUTO_START?: string
  WALKME_AUTO_START_DELAY?: string
  WALKME_PERSIST_STATE?: string
  WALKME_ANALYTICS_ENABLED?: string
}

class PluginEnvironment {
  private static instance: PluginEnvironment
  private config: WalkmePluginEnvConfig = {}
  private loaded = false

  private constructor() {
    this.loadEnvironment()
  }

  public static getInstance(): PluginEnvironment {
    if (!PluginEnvironment.instance) {
      PluginEnvironment.instance = new PluginEnvironment()
    }
    return PluginEnvironment.instance
  }

  private loadEnvironment(forceReload: boolean = false): void {
    if (this.loaded && !forceReload) return

    try {
      const env = getPluginEnv('walkme')

      this.config = {
        WALKME_ENABLED: env.WALKME_ENABLED || 'true',
        WALKME_DEBUG: env.WALKME_DEBUG || 'false',
        WALKME_AUTO_START: env.WALKME_AUTO_START || 'true',
        WALKME_AUTO_START_DELAY: env.WALKME_AUTO_START_DELAY || '1000',
        WALKME_PERSIST_STATE: env.WALKME_PERSIST_STATE || 'true',
        WALKME_ANALYTICS_ENABLED: env.WALKME_ANALYTICS_ENABLED || 'false',
      }

      this.loaded = true
    } catch (error) {
      console.error('[WalkMe Plugin] Failed to load environment:', error)
      this.loaded = true
    }
  }

  public isPluginEnabled(): boolean {
    return this.config.WALKME_ENABLED !== 'false'
  }

  public isDebugEnabled(): boolean {
    return this.config.WALKME_DEBUG === 'true'
  }

  public isAutoStartEnabled(): boolean {
    return this.config.WALKME_AUTO_START === 'true'
  }

  public getAutoStartDelay(): number {
    return parseInt(this.config.WALKME_AUTO_START_DELAY || '1000', 10)
  }

  public isPersistStateEnabled(): boolean {
    return this.config.WALKME_PERSIST_STATE !== 'false'
  }

  public isAnalyticsEnabled(): boolean {
    return this.config.WALKME_ANALYTICS_ENABLED === 'true'
  }

  public reload(): void {
    this.loaded = false
    this.loadEnvironment(true)
  }
}

export const pluginEnv = PluginEnvironment.getInstance()
