/**
 * Social Media Publisher Plugin Environment Configuration (Server-Only)
 *
 * Uses centralized plugin environment loader from core
 * Provides type-safe access to OAuth and publishing configuration
 */

import { getPluginEnv } from '@nextsparkjs/core/lib/plugins/env-loader'

interface SocialMediaPublisherEnvConfig {
  // Facebook/Meta OAuth
  FACEBOOK_CLIENT_ID?: string
  FACEBOOK_CLIENT_SECRET?: string
  FACEBOOK_APP_ID?: string // Alternative name
  FACEBOOK_APP_SECRET?: string // Alternative name

  // OAuth Encryption
  OAUTH_ENCRYPTION_KEY?: string

  // Cron Job Authentication
  CRON_SECRET?: string

  // App URL
  NEXT_PUBLIC_APP_URL?: string
}

class PluginEnvironment {
  private static instance: PluginEnvironment
  private config: SocialMediaPublisherEnvConfig = {}
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
      // Use centralized plugin env loader
      const env = getPluginEnv('social-media-publisher')

      this.config = {
        // Facebook/Meta OAuth (support both naming conventions)
        FACEBOOK_CLIENT_ID: env.FACEBOOK_CLIENT_ID || env.FACEBOOK_APP_ID,
        FACEBOOK_CLIENT_SECRET: env.FACEBOOK_CLIENT_SECRET || env.FACEBOOK_APP_SECRET,
        FACEBOOK_APP_ID: env.FACEBOOK_APP_ID || env.FACEBOOK_CLIENT_ID,
        FACEBOOK_APP_SECRET: env.FACEBOOK_APP_SECRET || env.FACEBOOK_CLIENT_SECRET,

        // OAuth Encryption
        OAUTH_ENCRYPTION_KEY: env.OAUTH_ENCRYPTION_KEY,

        // Cron Job Authentication
        CRON_SECRET: env.CRON_SECRET,

        // App URL
        NEXT_PUBLIC_APP_URL: env.NEXT_PUBLIC_APP_URL,
      }

      this.logLoadedConfiguration()
      this.loaded = true
    } catch (error) {
      console.error('[Social Media Publisher] Failed to load environment:', error)
      this.loaded = true
    }
  }

  private logLoadedConfiguration(): void {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Social Media Publisher] Environment Configuration:')
      console.log('  → Facebook/Meta OAuth:')
      console.log(`    - FACEBOOK_CLIENT_ID: ${this.config.FACEBOOK_CLIENT_ID ? '✓ set' : '✗ not set'}`)
      console.log(`    - FACEBOOK_CLIENT_SECRET: ${this.config.FACEBOOK_CLIENT_SECRET ? '✓ set' : '✗ not set'}`)
      console.log('  → OAuth Encryption:')
      console.log(`    - OAUTH_ENCRYPTION_KEY: ${this.config.OAUTH_ENCRYPTION_KEY ? '✓ set' : '✗ not set'}`)
      console.log('  → Cron Authentication:')
      console.log(`    - CRON_SECRET: ${this.config.CRON_SECRET ? '✓ set' : '✗ not set'}`)
      console.log('  → App Configuration:')
      console.log(`    - NEXT_PUBLIC_APP_URL: ${this.config.NEXT_PUBLIC_APP_URL || 'not set'}`)
      console.log()
    }
  }

  public getConfig(): SocialMediaPublisherEnvConfig {
    if (!this.loaded) {
      this.loadEnvironment()
    }
    return this.config
  }

  // Helper methods
  public getFacebookClientId(): string | undefined {
    return this.getConfig().FACEBOOK_CLIENT_ID
  }

  public getFacebookClientSecret(): string | undefined {
    return this.getConfig().FACEBOOK_CLIENT_SECRET
  }

  public getOAuthEncryptionKey(): string | undefined {
    return this.getConfig().OAUTH_ENCRYPTION_KEY
  }

  public getCronSecret(): string | undefined {
    return this.getConfig().CRON_SECRET
  }

  public getAppUrl(): string | undefined {
    return this.getConfig().NEXT_PUBLIC_APP_URL
  }

  public hasFacebookCredentials(): boolean {
    const config = this.getConfig()
    return !!(config.FACEBOOK_CLIENT_ID && config.FACEBOOK_CLIENT_SECRET)
  }

  public hasOAuthEncryption(): boolean {
    return !!this.getConfig().OAUTH_ENCRYPTION_KEY
  }

  public validateEnvironment(): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    const config = this.getConfig()

    if (!config.FACEBOOK_CLIENT_ID) {
      errors.push('FACEBOOK_CLIENT_ID is required for OAuth')
    }
    if (!config.FACEBOOK_CLIENT_SECRET) {
      errors.push('FACEBOOK_CLIENT_SECRET is required for OAuth')
    }
    if (!config.OAUTH_ENCRYPTION_KEY) {
      errors.push('OAUTH_ENCRYPTION_KEY is required for token encryption')
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  public reload(): void {
    this.loaded = false
    this.loadEnvironment(true)
  }
}

export const pluginEnv = PluginEnvironment.getInstance()

// Convenience exports
export const getFacebookClientId = () => pluginEnv.getFacebookClientId()
export const getFacebookClientSecret = () => pluginEnv.getFacebookClientSecret()
export const getOAuthEncryptionKey = () => pluginEnv.getOAuthEncryptionKey()
export const getCronSecret = () => pluginEnv.getCronSecret()
export const getAppUrl = () => pluginEnv.getAppUrl()
export const hasFacebookCredentials = () => pluginEnv.hasFacebookCredentials()
export const hasOAuthEncryption = () => pluginEnv.hasOAuthEncryption()
export const validateEnvironment = () => pluginEnv.validateEnvironment()
