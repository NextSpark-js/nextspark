/**
 * AI Plugin Core Utilities
 *
 * Simple, direct functions for building AI endpoints
 * No dynamic imports, no complex abstractions
 */

import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { AIProvider, ModelSelection, AIResult } from '../types/ai.types'
import {
  getServerPluginConfig,
  isServerPluginEnabled,
  validateServerPluginEnvironment
} from './server-env'

// Cost per 1K tokens (USD)
export const COST_CONFIG = {
  // OpenAI models
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },

  // Anthropic models
  'claude-sonnet-4-5-20250929': { input: 0.003, output: 0.015 }, // Current (Sept 2025)
  'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 }, // Deprecated Oct 28, 2025
  'claude-3-5-haiku-20241022': { input: 0.00025, output: 0.00125 },
  'claude-3-opus-20240229': { input: 0.015, output: 0.075 },

  // Ollama models (local, no cost)
  'llama3.2:3b': { input: 0, output: 0 },
  'llama3.2': { input: 0, output: 0 },
  'llama3.1': { input: 0, output: 0 },
  'qwen2.5': { input: 0, output: 0 },
  'mistral': { input: 0, output: 0 },
  'gemma2': { input: 0, output: 0 },
  'phi3.5': { input: 0, output: 0 },
  'codellama': { input: 0, output: 0 }
}

/**
 * Select AI model and provider
 */
export async function selectModel(modelName: string, provider?: AIProvider): Promise<ModelSelection> {
  // Auto-detect provider if not specified
  if (!provider) {
    if (modelName.startsWith('gpt-')) {
      provider = 'openai'
    } else if (modelName.startsWith('claude-')) {
      provider = 'anthropic'
    } else {
      provider = 'ollama'
    }
  }

  console.log(`🎯 [selectModel] Selected provider: ${provider}, model: ${modelName}`)

  const costConfig = COST_CONFIG[modelName as keyof typeof COST_CONFIG] || { input: 0, output: 0 }
  const config = await getServerPluginConfig()

  switch (provider) {
    case 'openai':
      if (!config.openaiApiKey) {
        throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY in contents/plugins/ai/.env')
      }
      const openaiProvider = createOpenAI({
        apiKey: config.openaiApiKey
      })
      return {
        provider: 'openai',
        model: openaiProvider(modelName),
        modelName,
        isLocal: false,
        costConfig
      }

    case 'anthropic':
      if (!config.anthropicApiKey) {
        throw new Error('Anthropic API key not configured. Set ANTHROPIC_API_KEY in contents/plugins/ai/.env')
      }
      const anthropicProvider = createAnthropic({
        apiKey: config.anthropicApiKey
      })
      return {
        provider: 'anthropic',
        model: anthropicProvider(modelName),
        modelName,
        isLocal: false,
        costConfig
      }

    case 'ollama':
    default:
      const ollamaBaseUrl = config.ollamaBaseUrl || 'http://localhost:11434'
      console.log(`🔥 [selectModel] Creating Ollama provider with baseURL: ${ollamaBaseUrl}, model: ${modelName}`)
      const ollamaProvider = createOpenAICompatible({
        baseURL: `${ollamaBaseUrl}/v1`,
        name: 'ollama'
      })
      return {
        provider: 'ollama',
        model: ollamaProvider(modelName),
        modelName,
        isLocal: true,
        costConfig
      }
  }
}

/**
 * Calculate AI generation cost
 */
export function calculateCost(
  tokens: { input: number; output: number },
  costConfig: { input: number; output: number }
): number {
  const inputCost = (tokens.input / 1000) * costConfig.input
  const outputCost = (tokens.output / 1000) * costConfig.output
  return Math.round((inputCost + outputCost) * 100000) / 100000
}

/**
 * Validate plugin is ready to use
 */
export async function validatePlugin(): Promise<{ valid: boolean; error?: string }> {
  try {
    if (!(await isServerPluginEnabled())) {
      return {
        valid: false,
        error: 'AI plugin disabled. Set AI_PLUGIN_ENABLED=true in contents/plugins/ai/.env'
      }
    }

    const envValidation = await validateServerPluginEnvironment()
    if (!envValidation.valid) {
      return {
        valid: false,
        error: `Plugin configuration invalid: ${envValidation.errors.join(', ')}`
      }
    }

    return { valid: true }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown validation error'
    }
  }
}

/**
 * Extract token usage from AI SDK result
 */
export function extractTokens(result: AIResult): { input: number; output: number; total: number } {
  return {
    input: result.usage?.inputTokens || 0,
    output: result.usage?.outputTokens || 0,
    total: result.usage?.totalTokens || 0
  }
}

/**
 * Common error handler for AI endpoints
 */
export function handleAIError(error: Error): { error: string; message: string; status: number } {
  const errorMessage = error.message.toLowerCase()

  // Provider-specific errors
  if (errorMessage.includes('openai') || errorMessage.includes('api key')) {
    return {
      error: 'OpenAI authentication failed',
      message: 'Check your OPENAI_API_KEY in contents/plugins/ai/.env',
      status: 401
    }
  }

  if (errorMessage.includes('anthropic') || errorMessage.includes('claude')) {
    return {
      error: 'Anthropic authentication failed',
      message: 'Check your ANTHROPIC_API_KEY in contents/plugins/ai/.env',
      status: 401
    }
  }

  if (errorMessage.includes('econnrefused') || errorMessage.includes('connect')) {
    return {
      error: 'Ollama connection failed',
      message: 'Make sure Ollama is running (ollama serve)',
      status: 503
    }
  }

  if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
    return {
      error: 'Rate limit exceeded',
      message: 'API rate limit reached. Try again later.',
      status: 429
    }
  }

  if (errorMessage.includes('model') && errorMessage.includes('not found')) {
    return {
      error: 'Model not found',
      message: 'The specified model is not available or not installed',
      status: 404
    }
  }

  // Generic error
  return {
    error: 'AI generation failed',
    message: error.message,
    status: 500
  }
}