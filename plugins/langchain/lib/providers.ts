import { ChatOllama } from '@langchain/ollama'
import { ChatOpenAI } from '@langchain/openai'
import { ChatAnthropic } from '@langchain/anthropic'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { config, validateProviderConfig, isProviderAvailable, getAvailableProviders } from '../plugin.config'
import type { ModelConfig, LLMProvider } from '../types/langchain.types'

/**
 * Create an OpenAI model instance
 *
 * @param modelConfig - Optional configuration overrides
 * @returns ChatOpenAI instance
 *
 * @example
 * // Use defaults from env
 * const model = createOpenAIModel()
 *
 * // Use specific model
 * const model = createOpenAIModel({ model: 'gpt-4o' })
 *
 * // Use with temperature
 * const model = createOpenAIModel({ model: 'gpt-4o', temperature: 0.7 })
 *
 * // Use with LM Studio (local OpenAI-compatible server)
 * const model = createOpenAIModel({
 *     model: 'local-model',
 *     options: {
 *         baseUrl: 'http://localhost:1234/v1',
 *         apiKey: 'lm-studio'  // LM Studio doesn't need real key
 *     }
 * })
 */
export function createOpenAIModel(modelConfig?: Partial<ModelConfig>): ChatOpenAI {
    // Determine baseUrl:
    // - If options.baseUrl is explicitly set to undefined, force real OpenAI API
    // - If options.baseUrl is set to a string, use that
    // - Otherwise, fall back to env var
    const explicitlyUndefined = modelConfig?.options && 'baseUrl' in modelConfig.options && modelConfig.options.baseUrl === undefined
    const baseUrl = explicitlyUndefined ? undefined : (modelConfig?.options?.baseUrl || config.providers.openai.baseUrl)

    // Skip API key validation if using custom baseUrl (e.g., LM Studio)
    const isLocalServer = !!baseUrl
    if (!isLocalServer) {
        validateProviderConfig('openai')
    }

    const chatOpenAI = new ChatOpenAI({
        openAIApiKey: modelConfig?.options?.apiKey || config.providers.openai.apiKey || 'lm-studio',
        modelName: modelConfig?.model || config.providers.openai.model,
        temperature: modelConfig?.temperature ?? config.providers.openai.temperature,
        maxTokens: modelConfig?.maxTokens,
        configuration: baseUrl ? { baseURL: baseUrl } : undefined,
        // LM Studio compatibility: disable strict tool calling which requires specific JSON Schema format
        supportsStrictToolCalling: false,
        // Enable verbose mode in debug to see what's sent to API
        verbose: config.debug,
    })

    return chatOpenAI
}

/**
 * Create an Anthropic model instance
 *
 * @param modelConfig - Optional configuration overrides
 * @returns ChatAnthropic instance
 *
 * @example
 * // Use defaults from env
 * const model = createAnthropicModel()
 *
 * // Use specific model
 * const model = createAnthropicModel({ model: 'claude-3-opus-20240229' })
 */
export function createAnthropicModel(modelConfig?: Partial<ModelConfig>): ChatAnthropic {
    validateProviderConfig('anthropic')

    return new ChatAnthropic({
        anthropicApiKey: modelConfig?.options?.apiKey || config.providers.anthropic.apiKey,
        modelName: modelConfig?.model || config.providers.anthropic.model,
        temperature: modelConfig?.temperature ?? config.providers.anthropic.temperature,
        maxTokens: modelConfig?.maxTokens,
    })
}

/**
 * Create an Ollama model instance (local)
 *
 * @param modelConfig - Optional configuration overrides
 * @returns ChatOllama instance
 *
 * @example
 * // Use defaults from env
 * const model = createOllamaModel()
 *
 * // Use specific model
 * const model = createOllamaModel({ model: 'llama3.2:3b' })
 *
 * // Use custom Ollama server
 * const model = createOllamaModel({
 *     model: 'qwen2.5:7b',
 *     options: { baseUrl: 'http://192.168.1.100:11434' }
 * })
 */
export function createOllamaModel(modelConfig?: Partial<ModelConfig>): ChatOllama {
    return new ChatOllama({
        baseUrl: modelConfig?.options?.baseUrl || config.providers.ollama.baseUrl,
        model: modelConfig?.model || config.providers.ollama.model,
        temperature: modelConfig?.temperature ?? config.providers.ollama.temperature,
    })
}

/**
 * Provider factory map
 */
const providerFactories: Record<LLMProvider, (cfg?: Partial<ModelConfig>) => BaseChatModel> = {
    openai: createOpenAIModel,
    anthropic: createAnthropicModel,
    ollama: createOllamaModel,
}

/**
 * Create a model instance based on configuration
 *
 * This is the main factory function for creating LLM instances.
 * It selects the appropriate provider and applies configuration.
 *
 * @param modelConfig - Optional model configuration. If not provided, uses plugin defaults.
 * @returns A LangChain chat model instance
 *
 * @example
 * // Use plugin defaults (from env vars)
 * const model = getModel()
 *
 * // Use specific provider with default model
 * const model = getModel({ provider: 'openai' })
 *
 * // Use specific provider and model
 * const model = getModel({ provider: 'anthropic', model: 'claude-3-opus-20240229' })
 *
 * // Use with temperature override
 * const model = getModel({ provider: 'openai', model: 'gpt-4o', temperature: 0.7 })
 *
 * // Use Ollama with custom server
 * const model = getModel({
 *     provider: 'ollama',
 *     model: 'qwen2.5:7b',
 *     options: { baseUrl: 'http://192.168.1.100:11434' }
 * })
 */
export function getModel(modelConfig?: Partial<ModelConfig>): BaseChatModel {
    const provider = modelConfig?.provider || config.defaultProvider

    const factory = providerFactories[provider]
    if (!factory) {
        throw new Error(
            `Unsupported provider: ${provider}. ` +
            `Supported providers: ${Object.keys(providerFactories).join(', ')}`
        )
    }

    if (config.debug) {
        const model = modelConfig?.model || config.providers[provider]?.model || 'default'
        console.log(`[LangChain] Creating model - Provider: ${provider}, Model: ${model}`)
    }

    return factory(modelConfig)
}

/**
 * Structured output method types supported by LangChain
 */
export type StructuredOutputMethod = 'functionCalling' | 'jsonMode' | 'jsonSchema'

/**
 * Determine the best structured output method for a given provider configuration
 *
 * Different providers/servers have different capabilities:
 * - OpenAI API: Supports all methods (functionCalling is best)
 * - Anthropic: Uses tool use (functionCalling)
 * - Ollama: Supports functionCalling for most models
 * - LM Studio (OpenAI-compatible): Only supports jsonSchema
 *
 * @param modelConfig - The model configuration being used
 * @returns The recommended structured output method
 *
 * @example
 * const method = getStructuredOutputMethod({ provider: 'openai' })
 * const structuredModel = model.withStructuredOutput(schema, { method })
 */
export function getStructuredOutputMethod(modelConfig?: Partial<ModelConfig>): StructuredOutputMethod {
    const provider = modelConfig?.provider || config.defaultProvider

    // Check if using OpenAI provider with custom baseUrl (LM Studio, LocalAI, etc.)
    if (provider === 'openai') {
        // Check if baseUrl is explicitly set to undefined (force real OpenAI API)
        const explicitlyUndefined = modelConfig?.options && 'baseUrl' in modelConfig.options && modelConfig.options.baseUrl === undefined
        const baseUrl = explicitlyUndefined ? undefined : (modelConfig?.options?.baseUrl || config.providers.openai.baseUrl)

        if (baseUrl) {
            // Local OpenAI-compatible servers (LM Studio) use jsonSchema
            if (config.debug) {
                console.log('[LangChain] Using jsonSchema method for local OpenAI-compatible server')
            }
            return 'jsonSchema'
        }
        // Real OpenAI API - use functionCalling (most reliable)
        return 'functionCalling'
    }

    // Anthropic - uses tool use which maps to functionCalling
    if (provider === 'anthropic') {
        return 'functionCalling'
    }

    // Ollama - most models support function calling
    if (provider === 'ollama') {
        return 'functionCalling'
    }

    // Default fallback
    return 'functionCalling'
}

// Re-export utility functions from plugin.config for convenience
export { isProviderAvailable, getAvailableProviders }
