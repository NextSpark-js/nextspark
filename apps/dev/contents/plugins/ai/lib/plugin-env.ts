/**
 * AI Plugin Environment Configuration (Server-Only)
 *
 * Uses centralized plugin environment loader from core
 * Provides type-safe access to AI provider credentials and configuration
 */

import { getPluginEnv } from '@nextsparkjs/core/lib/plugins/env-loader'

interface AIPluginEnvConfig {
  // AI provider credentials
  ANTHROPIC_API_KEY?: string
  OPENAI_API_KEY?: string

  // Ollama configuration
  OLLAMA_BASE_URL?: string
  OLLAMA_DEFAULT_MODEL?: string

  // AI provider selection
  USE_LOCAL_AI?: string
  DEFAULT_CLOUD_MODEL?: string

  // Plugin configuration
  AI_PLUGIN_ENABLED?: string
  AI_PLUGIN_DEBUG?: string
  AI_PLUGIN_DEFAULT_PROVIDER?: string
  AI_PLUGIN_MAX_TOKENS?: string
  AI_PLUGIN_DEFAULT_TEMPERATURE?: string

  // Cost tracking
  AI_PLUGIN_COST_TRACKING_ENABLED?: string
  AI_PLUGIN_DAILY_COST_LIMIT?: string
  AI_PLUGIN_MONTHLY_COST_LIMIT?: string

  // Rate limiting
  AI_PLUGIN_RATE_LIMIT_REQUESTS_PER_MINUTE?: string
  AI_PLUGIN_RATE_LIMIT_TOKENS_PER_MINUTE?: string
}

class PluginEnvironment {
  private static instance: PluginEnvironment
  private config: AIPluginEnvConfig = {}
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
      const env = getPluginEnv('ai')

      this.config = {
        // AI provider credentials
        ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
        OPENAI_API_KEY: env.OPENAI_API_KEY,

        // Ollama configuration
        OLLAMA_BASE_URL: env.OLLAMA_BASE_URL || 'http://localhost:11434',
        OLLAMA_DEFAULT_MODEL: env.OLLAMA_DEFAULT_MODEL || 'llama3.2:3b',

        // AI provider selection
        USE_LOCAL_AI: env.USE_LOCAL_AI || 'false',
        DEFAULT_CLOUD_MODEL: env.DEFAULT_CLOUD_MODEL || 'claude-sonnet-4-5-20250929',

        // Plugin configuration
        AI_PLUGIN_ENABLED: env.AI_PLUGIN_ENABLED || 'true',
        AI_PLUGIN_DEBUG: env.AI_PLUGIN_DEBUG || 'false',
        AI_PLUGIN_DEFAULT_PROVIDER: env.AI_PLUGIN_DEFAULT_PROVIDER || 'anthropic',
        AI_PLUGIN_MAX_TOKENS: env.AI_PLUGIN_MAX_TOKENS || '4000',
        AI_PLUGIN_DEFAULT_TEMPERATURE: env.AI_PLUGIN_DEFAULT_TEMPERATURE || '0.7',
        AI_PLUGIN_COST_TRACKING_ENABLED: env.AI_PLUGIN_COST_TRACKING_ENABLED || 'true',
        AI_PLUGIN_DAILY_COST_LIMIT: env.AI_PLUGIN_DAILY_COST_LIMIT || '10.00',
        AI_PLUGIN_MONTHLY_COST_LIMIT: env.AI_PLUGIN_MONTHLY_COST_LIMIT || '100.00',
        AI_PLUGIN_RATE_LIMIT_REQUESTS_PER_MINUTE: env.AI_PLUGIN_RATE_LIMIT_REQUESTS_PER_MINUTE || '60',
        AI_PLUGIN_RATE_LIMIT_TOKENS_PER_MINUTE: env.AI_PLUGIN_RATE_LIMIT_TOKENS_PER_MINUTE || '50000'
      }

      this.logLoadedConfiguration()
      this.loaded = true
    } catch (error) {
      console.error('[AI Plugin] Failed to load environment:', error)
      this.loaded = true
    }
  }

  private logLoadedConfiguration(): void {
    if (process.env.NODE_ENV === 'development') {
      console.log('[AI Plugin] ℹ️  Plugin Environment Configuration:')
      console.log('  → AI Provider Credentials:')
      console.log(`    - ANTHROPIC_API_KEY: ${this.config.ANTHROPIC_API_KEY ? '✓ set' : '✗ not set'}`)
      console.log(`    - OPENAI_API_KEY: ${this.config.OPENAI_API_KEY ? '✓ set' : '✗ not set'}`)
      console.log('  → AI Provider Selection:')
      console.log(`    - USE_LOCAL_AI: ${this.config.USE_LOCAL_AI}`)
      console.log(`    - DEFAULT_CLOUD_MODEL: ${this.config.DEFAULT_CLOUD_MODEL}`)
      console.log('  → Ollama Configuration:')
      console.log(`    - OLLAMA_BASE_URL: ${this.config.OLLAMA_BASE_URL}`)
      console.log(`    - OLLAMA_DEFAULT_MODEL: ${this.config.OLLAMA_DEFAULT_MODEL}`)
      console.log('  → Plugin Settings:')
      const pluginVars = [
        'AI_PLUGIN_ENABLED', 'AI_PLUGIN_DEBUG', 'AI_PLUGIN_DEFAULT_PROVIDER',
        'AI_PLUGIN_MAX_TOKENS', 'AI_PLUGIN_DEFAULT_TEMPERATURE',
        'AI_PLUGIN_COST_TRACKING_ENABLED', 'AI_PLUGIN_DAILY_COST_LIMIT',
        'AI_PLUGIN_MONTHLY_COST_LIMIT', 'AI_PLUGIN_RATE_LIMIT_REQUESTS_PER_MINUTE',
        'AI_PLUGIN_RATE_LIMIT_TOKENS_PER_MINUTE'
      ]
      for (const v of pluginVars) {
        const value = this.config[v as keyof AIPluginEnvConfig]
        console.log(`    - ${v}: ${value || 'default'}`)
      }
      console.log()
    }
  }

  public getConfig(): AIPluginEnvConfig {
    if (!this.loaded) {
      this.loadEnvironment()
    }
    return this.config
  }

  // Helper methods
  public getAnthropicApiKey(): string | undefined {
    return this.getConfig().ANTHROPIC_API_KEY
  }

  public getOpenAiApiKey(): string | undefined {
    return this.getConfig().OPENAI_API_KEY
  }

  public getOllamaBaseUrl(): string {
    return this.getConfig().OLLAMA_BASE_URL || 'http://localhost:11434'
  }

  public getOllamaDefaultModel(): string {
    return this.getConfig().OLLAMA_DEFAULT_MODEL || 'llama3.2:3b'
  }

  public isUseLocalAI(): boolean {
    return this.getConfig().USE_LOCAL_AI === 'true'
  }

  public getDefaultCloudModel(): string {
    return this.getConfig().DEFAULT_CLOUD_MODEL || 'claude-sonnet-4-5-20250929'
  }

  public getDefaultProvider(): string {
    return this.getConfig().AI_PLUGIN_DEFAULT_PROVIDER || 'anthropic'
  }

  public getDefaultModel(): string {
    const useLocal = this.isUseLocalAI()
    const ollamaModel = this.getOllamaDefaultModel()
    const cloudModel = this.getDefaultCloudModel()
    console.log(`🔍 [getDefaultModel] USE_LOCAL_AI=${useLocal}, ollamaModel=${ollamaModel}, cloudModel=${cloudModel}`)
    const selectedModel = useLocal ? ollamaModel : cloudModel
    console.log(`🔍 [getDefaultModel] Returning: ${selectedModel}`)
    return selectedModel
  }

  public getMaxTokens(): number {
    return parseInt(this.getConfig().AI_PLUGIN_MAX_TOKENS || '4000', 10)
  }

  public getDefaultTemperature(): number {
    return parseFloat(this.getConfig().AI_PLUGIN_DEFAULT_TEMPERATURE || '0.7')
  }

  public isCostTrackingEnabled(): boolean {
    return this.getConfig().AI_PLUGIN_COST_TRACKING_ENABLED === 'true'
  }

  public getDailyCostLimit(): number {
    return parseFloat(this.getConfig().AI_PLUGIN_DAILY_COST_LIMIT || '10.00')
  }

  public getMonthlyCostLimit(): number {
    return parseFloat(this.getConfig().AI_PLUGIN_MONTHLY_COST_LIMIT || '100.00')
  }

  public getRateLimitRequestsPerMinute(): number {
    return parseInt(this.getConfig().AI_PLUGIN_RATE_LIMIT_REQUESTS_PER_MINUTE || '60', 10)
  }

  public getRateLimitTokensPerMinute(): number {
    return parseInt(this.getConfig().AI_PLUGIN_RATE_LIMIT_TOKENS_PER_MINUTE || '50000', 10)
  }

  public isPluginEnabled(): boolean {
    return this.getConfig().AI_PLUGIN_ENABLED !== 'false'
  }

  public isDebugEnabled(): boolean {
    return this.getConfig().AI_PLUGIN_DEBUG === 'true'
  }

  public validateEnvironment(): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    const config = this.getConfig()

    if (!config.USE_LOCAL_AI || config.USE_LOCAL_AI === 'false') {
      if (!config.ANTHROPIC_API_KEY && !config.OPENAI_API_KEY) {
        errors.push('Cloud AI is enabled but no API keys are configured (ANTHROPIC_API_KEY or OPENAI_API_KEY required)')
      }
    }

    if (config.AI_PLUGIN_ENABLED === 'false') {
      errors.push('AI Plugin is disabled (AI_PLUGIN_ENABLED=false)')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  public reload(): void {
    this.loaded = false
    this.loadEnvironment(true)
  }
}

export const pluginEnv = PluginEnvironment.getInstance()

// Convenience exports
export const getAnthropicApiKey = () => pluginEnv.getAnthropicApiKey()
export const getOpenAiApiKey = () => pluginEnv.getOpenAiApiKey()
export const getOllamaBaseUrl = () => pluginEnv.getOllamaBaseUrl()
export const getOllamaDefaultModel = () => pluginEnv.getOllamaDefaultModel()
export const isUseLocalAI = () => pluginEnv.isUseLocalAI()
export const getDefaultCloudModel = () => pluginEnv.getDefaultCloudModel()
export const getDefaultProvider = () => pluginEnv.getDefaultProvider()
export const getDefaultModel = () => pluginEnv.getDefaultModel()
export const getMaxTokens = () => pluginEnv.getMaxTokens()
export const getDefaultTemperature = () => pluginEnv.getDefaultTemperature()
export const isCostTrackingEnabled = () => pluginEnv.isCostTrackingEnabled()
export const getDailyCostLimit = () => pluginEnv.getDailyCostLimit()
export const getMonthlyCostLimit = () => pluginEnv.getMonthlyCostLimit()
export const getRateLimitRequestsPerMinute = () => pluginEnv.getRateLimitRequestsPerMinute()
export const getRateLimitTokensPerMinute = () => pluginEnv.getRateLimitTokensPerMinute()
export const isPluginEnabled = () => pluginEnv.isPluginEnabled()
export const isDebugEnabled = () => pluginEnv.isDebugEnabled()
