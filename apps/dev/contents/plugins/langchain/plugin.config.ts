import type { PluginConfig } from '@nextsparkjs/core/types/plugin'
import type { LLMProvider } from './types/langchain.types'

/**
 * LangChain Plugin Configuration
 *
 * Environment variables:
 * - LANGCHAIN_PLUGIN_ENABLED: Enable/disable the plugin
 * - LANGCHAIN_PLUGIN_DEBUG: Enable debug console logging
 *
 * File logging:
 * - LOG_ENABLED: Enable file logging (core environment variable)
 *
 * Ollama (local):
 * - LANGCHAIN_OLLAMA_BASE_URL: Ollama server URL (default: http://localhost:11434)
 * - LANGCHAIN_OLLAMA_MODEL: Ollama model (default: llama3.2:3b)
 *
 * OpenAI-compatible (LM Studio, LocalAI, etc.):
 * - LANGCHAIN_OPENAI_BASE_URL: Server URL (e.g., http://localhost:1234/v1)
 * - LANGCHAIN_OPENAI_MODEL: Model name
 * - OPENAI_API_KEY: API key (use "lm-studio" for local servers)
 */
export const config = {
    enabled: process.env.LANGCHAIN_PLUGIN_ENABLED === 'true',
    debug: process.env.LANGCHAIN_PLUGIN_DEBUG === 'true',

    /** Default provider when not specified per-agent */
    defaultProvider: (process.env.LANGCHAIN_DEFAULT_PROVIDER || 'ollama') as LLMProvider,

    /** Default temperature for all providers */
    defaultTemperature: 0.1,

    /** Provider-specific configurations */
    providers: {
        openai: {
            apiKey: process.env.OPENAI_API_KEY,
            baseUrl: process.env.LANGCHAIN_OPENAI_BASE_URL,
            model: process.env.LANGCHAIN_OPENAI_MODEL || 'gpt-4o-mini',
            temperature: 0.1,
        },
        anthropic: {
            apiKey: process.env.ANTHROPIC_API_KEY,
            model: process.env.LANGCHAIN_ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
            temperature: 0.1,
        },
        ollama: {
            baseUrl: process.env.LANGCHAIN_OLLAMA_BASE_URL || 'http://localhost:11434',
            model: process.env.LANGCHAIN_OLLAMA_MODEL || 'llama3.2:3b',
            temperature: 0.1,
        },
    },
}

/**
 * Validate that required configuration exists for a provider
 * @throws Error if required configuration is missing
 */
export function validateProviderConfig(provider: LLMProvider): void {
    switch (provider) {
        case 'openai':
            if (!config.providers.openai.apiKey) {
                throw new Error(
                    'OPENAI_API_KEY environment variable is required when using OpenAI provider. ' +
                    'Get your API key at https://platform.openai.com/api-keys'
                )
            }
            break
        case 'anthropic':
            if (!config.providers.anthropic.apiKey) {
                throw new Error(
                    'ANTHROPIC_API_KEY environment variable is required when using Anthropic provider. ' +
                    'Get your API key at https://console.anthropic.com/settings/keys'
                )
            }
            break
        case 'ollama':
            // Ollama doesn't require API key (local)
            break
        default:
            throw new Error(`Unsupported provider: ${provider}. Supported: openai, anthropic, ollama`)
    }
}

/**
 * Check if a provider is available (has required credentials)
 */
export function isProviderAvailable(provider: LLMProvider): boolean {
    switch (provider) {
        case 'openai':
            return !!config.providers.openai.apiKey
        case 'anthropic':
            return !!config.providers.anthropic.apiKey
        case 'ollama':
            return true // Ollama is always "available" (local)
        default:
            return false
    }
}

/**
 * Get list of available providers (those with valid configuration)
 */
export function getAvailableProviders(): LLMProvider[] {
    return (['openai', 'anthropic', 'ollama'] as LLMProvider[]).filter(isProviderAvailable)
}

/**
 * LangChain Plugin Config
 *
 * Provides AI agent capabilities with:
 * - Multiple LLM providers (OpenAI, Anthropic, Ollama)
 * - Tool system for extending agent capabilities
 * - Session-based memory for conversation continuity
 * - Per-agent model configuration for themes
 *
 * ## Usage in Themes
 *
 * Import directly from the lib files (NOT from plugin.config.ts to avoid circular deps):
 *
 * ```typescript
 * import { createAgent } from '@/plugins/langchain/lib/agent-factory'
 * import { buildTools, type ToolDefinition } from '@/plugins/langchain/lib/tools-builder'
 * import { memoryStore } from '@/plugins/langchain/lib/memory-store'
 * import { getModel } from '@/plugins/langchain/lib/providers'
 *
 * // Use default provider (from env or plugin config)
 * const agent = await createAgent({
 *     sessionId: 'unique-session-id',
 *     systemPrompt: 'You are a helpful assistant...',
 *     tools: myTools,
 * })
 *
 * // Use specific provider and model
 * const agent = await createAgent({
 *     sessionId: 'unique-session-id',
 *     systemPrompt: 'You are a helpful assistant...',
 *     tools: myTools,
 *     modelConfig: {
 *         provider: 'openai',
 *         model: 'gpt-4o',
 *         temperature: 0.3,
 *     },
 * })
 *
 * const response = await agent.chat('Hello!')
 * ```
 */
export const langchainPluginConfig: PluginConfig = {
    name: 'langchain',
    displayName: 'LangChain Agent Framework',
    version: '2.0.0',
    description: 'Create AI agents with tools, memory, and customizable behavior. Supports OpenAI, Anthropic, and Ollama.',
    enabled: config.enabled,
    dependencies: [],

    hooks: {
        onLoad: async () => {
            if (config.debug) {
                console.log('[LangChain Plugin] Loaded')
                console.log('[LangChain Plugin] Default Provider:', config.defaultProvider)
                console.log('[LangChain Plugin] OpenAI configured:', !!config.providers.openai.apiKey)
                console.log('[LangChain Plugin] Anthropic configured:', !!config.providers.anthropic.apiKey)
                console.log('[LangChain Plugin] Ollama URL:', config.providers.ollama.baseUrl)
                console.log('[LangChain Plugin] Ollama Model:', config.providers.ollama.model)
            }
        }
    }
}

export default langchainPluginConfig
