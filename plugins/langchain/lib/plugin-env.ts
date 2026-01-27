/**
 * LangChain Plugin Environment Configuration (Server-Only)
 *
 * Uses centralized plugin environment loader from core
 * Provides type-safe access to LangChain configuration
 */

import { getPluginEnv } from '@nextsparkjs/core/lib/plugins/env-loader'

interface LangChainPluginEnvConfig {
  // Plugin settings
  LANGCHAIN_PLUGIN_ENABLED?: string
  LANGCHAIN_PLUGIN_DEBUG?: string
  LOG_ENABLED?: string

  // Ollama Configuration
  LANGCHAIN_OLLAMA_BASE_URL?: string
  LANGCHAIN_OLLAMA_MODEL?: string

  // OpenAI Configuration
  LANGCHAIN_OPENAI_BASE_URL?: string
  LANGCHAIN_OPENAI_MODEL?: string
  OPENAI_API_KEY?: string

  // Anthropic Configuration
  LANGCHAIN_ANTHROPIC_MODEL?: string
  ANTHROPIC_API_KEY?: string

  // Feature Flags
  LANGCHAIN_USE_GRAPH_ORCHESTRATOR?: string
  LANGCHAIN_DEBUG?: string
}

class PluginEnvironment {
  private static instance: PluginEnvironment
  private config: LangChainPluginEnvConfig = {}
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
      const env = getPluginEnv('langchain')

      this.config = {
        // Plugin settings
        LANGCHAIN_PLUGIN_ENABLED: env.LANGCHAIN_PLUGIN_ENABLED || 'true',
        LANGCHAIN_PLUGIN_DEBUG: env.LANGCHAIN_PLUGIN_DEBUG || 'false',
        LOG_ENABLED: env.LOG_ENABLED || 'false',

        // Ollama Configuration
        LANGCHAIN_OLLAMA_BASE_URL: env.LANGCHAIN_OLLAMA_BASE_URL || 'http://localhost:11434',
        LANGCHAIN_OLLAMA_MODEL: env.LANGCHAIN_OLLAMA_MODEL || 'llama3.2:3b',

        // OpenAI Configuration
        LANGCHAIN_OPENAI_BASE_URL: env.LANGCHAIN_OPENAI_BASE_URL,
        LANGCHAIN_OPENAI_MODEL: env.LANGCHAIN_OPENAI_MODEL || 'gpt-4o-mini',
        OPENAI_API_KEY: env.OPENAI_API_KEY,

        // Anthropic Configuration
        LANGCHAIN_ANTHROPIC_MODEL: env.LANGCHAIN_ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
        ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,

        // Feature Flags
        LANGCHAIN_USE_GRAPH_ORCHESTRATOR: env.LANGCHAIN_USE_GRAPH_ORCHESTRATOR || 'true',
        LANGCHAIN_DEBUG: env.LANGCHAIN_DEBUG || 'false',
      }

      this.logLoadedConfiguration()
      this.loaded = true
    } catch (error) {
      console.error('[LangChain Plugin] Failed to load environment:', error)
      this.loaded = true
    }
  }

  private logLoadedConfiguration(): void {
    if (process.env.NODE_ENV === 'development' && this.config.LANGCHAIN_PLUGIN_DEBUG === 'true') {
      console.log('[LangChain Plugin] Environment Configuration:')
      console.log('  → Plugin Settings:')
      console.log(`    - LANGCHAIN_PLUGIN_ENABLED: ${this.config.LANGCHAIN_PLUGIN_ENABLED}`)
      console.log(`    - LANGCHAIN_PLUGIN_DEBUG: ${this.config.LANGCHAIN_PLUGIN_DEBUG}`)
      console.log('  → Ollama Configuration:')
      console.log(`    - LANGCHAIN_OLLAMA_BASE_URL: ${this.config.LANGCHAIN_OLLAMA_BASE_URL}`)
      console.log(`    - LANGCHAIN_OLLAMA_MODEL: ${this.config.LANGCHAIN_OLLAMA_MODEL}`)
      console.log('  → OpenAI Configuration:')
      console.log(`    - LANGCHAIN_OPENAI_BASE_URL: ${this.config.LANGCHAIN_OPENAI_BASE_URL || 'not set'}`)
      console.log(`    - LANGCHAIN_OPENAI_MODEL: ${this.config.LANGCHAIN_OPENAI_MODEL}`)
      console.log(`    - OPENAI_API_KEY: ${this.config.OPENAI_API_KEY ? '✓ set' : '✗ not set'}`)
      console.log('  → Anthropic Configuration:')
      console.log(`    - LANGCHAIN_ANTHROPIC_MODEL: ${this.config.LANGCHAIN_ANTHROPIC_MODEL}`)
      console.log(`    - ANTHROPIC_API_KEY: ${this.config.ANTHROPIC_API_KEY ? '✓ set' : '✗ not set'}`)
      console.log()
    }
  }

  public getConfig(): LangChainPluginEnvConfig {
    if (!this.loaded) {
      this.loadEnvironment()
    }
    return this.config
  }

  // Helper methods
  public isPluginEnabled(): boolean {
    return this.getConfig().LANGCHAIN_PLUGIN_ENABLED !== 'false'
  }

  public isDebugEnabled(): boolean {
    return this.getConfig().LANGCHAIN_PLUGIN_DEBUG === 'true' || this.getConfig().LANGCHAIN_DEBUG === 'true'
  }

  public isLogEnabled(): boolean {
    return this.getConfig().LOG_ENABLED === 'true'
  }

  public getOllamaBaseUrl(): string {
    return this.getConfig().LANGCHAIN_OLLAMA_BASE_URL || 'http://localhost:11434'
  }

  public getOllamaModel(): string {
    return this.getConfig().LANGCHAIN_OLLAMA_MODEL || 'llama3.2:3b'
  }

  public getOpenAIBaseUrl(): string | undefined {
    return this.getConfig().LANGCHAIN_OPENAI_BASE_URL
  }

  public getOpenAIModel(): string {
    return this.getConfig().LANGCHAIN_OPENAI_MODEL || 'gpt-4o-mini'
  }

  public getOpenAIApiKey(): string | undefined {
    return this.getConfig().OPENAI_API_KEY
  }

  public getAnthropicModel(): string {
    return this.getConfig().LANGCHAIN_ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022'
  }

  public getAnthropicApiKey(): string | undefined {
    return this.getConfig().ANTHROPIC_API_KEY
  }

  public isGraphOrchestratorEnabled(): boolean {
    return this.getConfig().LANGCHAIN_USE_GRAPH_ORCHESTRATOR === 'true'
  }

  public reload(): void {
    this.loaded = false
    this.loadEnvironment(true)
  }
}

export const pluginEnv = PluginEnvironment.getInstance()

// Convenience exports
export const isPluginEnabled = () => pluginEnv.isPluginEnabled()
export const isDebugEnabled = () => pluginEnv.isDebugEnabled()
export const isLogEnabled = () => pluginEnv.isLogEnabled()
export const getOllamaBaseUrl = () => pluginEnv.getOllamaBaseUrl()
export const getOllamaModel = () => pluginEnv.getOllamaModel()
export const getOpenAIBaseUrl = () => pluginEnv.getOpenAIBaseUrl()
export const getOpenAIModel = () => pluginEnv.getOpenAIModel()
export const getOpenAIApiKey = () => pluginEnv.getOpenAIApiKey()
export const getAnthropicModel = () => pluginEnv.getAnthropicModel()
export const getAnthropicApiKey = () => pluginEnv.getAnthropicApiKey()
export const isGraphOrchestratorEnabled = () => pluginEnv.isGraphOrchestratorEnabled()
