/**
 * AI Plugin Core Utilities
 *
 * Simple, direct functions for building AI endpoints
 * Supports both Anthropic API keys and Claude Code OAuth tokens.
 * OAuth tokens use @anthropic-ai/claude-agent-sdk for authentication.
 * No dynamic imports, no complex abstractions
 */

import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { generateText } from 'ai'
import { query } from '@anthropic-ai/claude-agent-sdk'
import type { AIProvider, ModelSelection, AIResult } from '../types/ai.types'
import {
  getServerPluginConfig,
  isServerPluginEnabled,
  validateServerPluginEnvironment
} from './server-env'
import { pluginEnv } from './plugin-env'

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
 * Select AI model and provider.
 *
 * @param modelName  - Model identifier (e.g. 'claude-sonnet-4-5-20250929', 'gpt-4o')
 * @param provider   - Optional provider override. Auto-detected from model name if omitted.
 * @param userApiKey - Optional BYOK key. When provided for the resolved provider,
 *                     this key is used instead of the global env key. The caller is
 *                     responsible for fetching it via UserApiKeysService.getDecryptedKey().
 */
export async function selectModel(
  modelName: string,
  provider?: AIProvider,
  userApiKey?: string
): Promise<ModelSelection> {
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

  console.log(`🎯 [selectModel] Selected provider: ${provider}, model: ${modelName}${userApiKey ? ' (BYOK)' : ''}`)

  const costConfig = COST_CONFIG[modelName as keyof typeof COST_CONFIG] || { input: 0, output: 0 }
  const config = await getServerPluginConfig()

  switch (provider) {
    case 'openai': {
      // Prefer BYOK key when provided, fall back to global config
      const openaiApiKey = userApiKey || config.openaiApiKey
      if (!openaiApiKey) {
        throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY in contents/plugins/ai/.env')
      }
      const openaiProvider = createOpenAI({
        apiKey: openaiApiKey,
      })
      return {
        provider: 'openai',
        model: openaiProvider(modelName),
        modelName,
        isLocal: false,
        costConfig,
      }
    }

    case 'anthropic': {
      // Prefer BYOK key when provided, fall back to global config (API key or OAuth)
      const anthropicAuth = userApiKey || (config.anthropicAuth ?? config.anthropicApiKey)
      if (!anthropicAuth) {
        throw new Error(
          'Anthropic not configured. Set ANTHROPIC_API_KEY in contents/plugins/ai/.env, or in dev set CLAUDE_CODE_OAUTH_TOKEN (e.g. from Cursor/Claude Code).'
        )
      }
      if (!userApiKey && anthropicAuth.startsWith('sk-ant-oat01-') && process.env.NODE_ENV === 'development') {
        console.log('🔐 [selectModel] Using Claude Code OAuth token (dev only)')
      }
      const anthropicProvider = createAnthropic({
        apiKey: anthropicAuth,
      })
      return {
        provider: 'anthropic',
        model: anthropicProvider(modelName),
        modelName,
        isLocal: false,
        costConfig,
      }
    }

    case 'ollama':
    default: {
      const ollamaBaseUrl = config.ollamaBaseUrl || 'http://localhost:11434'
      console.log(`🔥 [selectModel] Creating Ollama provider with baseURL: ${ollamaBaseUrl}, model: ${modelName}`)
      const ollamaProvider = createOpenAICompatible({
        baseURL: `${ollamaBaseUrl}/v1`,
        name: 'ollama',
      })
      return {
        provider: 'ollama',
        model: ollamaProvider(modelName),
        modelName,
        isLocal: true,
        costConfig,
      }
    }
  }
}

/**
 * Check if current auth is an OAuth token (requires Agent SDK)
 */
export async function isOAuthMode(): Promise<boolean> {
  const config = await getServerPluginConfig()
  const auth = config.anthropicAuth ?? config.anthropicApiKey
  return !!auth && auth.startsWith('sk-ant-oat01-')
}

/**
 * Generate text using Claude Agent SDK (for OAuth tokens)
 * This is used when CLAUDE_CODE_OAUTH_TOKEN is set instead of ANTHROPIC_API_KEY.
 * The Agent SDK handles OAuth authentication internally.
 */
export async function generateTextWithAgentSDK(options: {
  system: string
  prompt: string
  model?: string
  maxTokens?: number
}): Promise<{ text: string; usage: { inputTokens: number; outputTokens: number; totalTokens: number } }> {
  const config = await getServerPluginConfig()
  const model = options.model || config.defaultModel || 'claude-sonnet-4-5-20250929'

  console.log(`🤖 [AgentSDK] Generating text with model: ${model}`)

  const conversation = query({
    prompt: options.prompt,
    options: {
      systemPrompt: options.system,
      model,
      maxTurns: 1,
      maxBudgetUsd: 1.0,
    },
  })

  const assistantTextBlocks: string[] = []
  let resultText = ''
  let costUsd = 0
  let actualUsage: { input_tokens: number; output_tokens: number } | null = null

  for await (const msg of conversation) {
    if (msg.type === 'assistant') {
      const assistantMsg = msg as { type: string; message: { content: Array<{ type: string; text?: string }> } }
      for (const block of assistantMsg.message.content) {
        if (block.type === 'text' && block.text?.trim()) {
          assistantTextBlocks.push(block.text.trim())
        }
      }
    }
    if (msg.type === 'result') {
      const resultMsg = msg as {
        type: string
        subtype?: string
        total_cost_usd: number
        result?: string
        usage?: { input_tokens: number; output_tokens: number }
      }
      costUsd = resultMsg.total_cost_usd || 0
      if (resultMsg.usage) {
        actualUsage = resultMsg.usage
      }
      if (resultMsg.subtype === 'success' && resultMsg.result) {
        resultText = resultMsg.result.trim()
      }
    }
  }

  // Prefer result text (from SDKResultSuccess.result) as canonical output.
  // Fall back to concatenated assistant text blocks if result is empty.
  // Use individual last block as final fallback.
  let text = ''
  if (resultText) {
    text = resultText
  } else if (assistantTextBlocks.length > 0) {
    // Join all text blocks — some responses split content across multiple blocks
    text = assistantTextBlocks.join('\n')
  }

  // Use actual usage from the SDK when available, fall back to cost estimation
  let inputTokens: number
  let outputTokens: number
  if (actualUsage) {
    inputTokens = actualUsage.input_tokens
    outputTokens = actualUsage.output_tokens
  } else {
    const estimatedTokens = Math.round(costUsd / 0.000015) || 100
    inputTokens = Math.round(estimatedTokens * 0.3)
    outputTokens = Math.round(estimatedTokens * 0.7)
  }

  console.log(`✅ [AgentSDK] Generated ${text.length} chars, cost: $${costUsd.toFixed(4)}, resultText: ${resultText.length} chars, assistantBlocks: ${assistantTextBlocks.length}`)

  // Fallback: if Agent SDK returned empty text despite reporting output tokens,
  // retry with direct Anthropic API via @ai-sdk/anthropic (uses the same OAuth token).
  if (!text) {
    console.warn(`⚠️ [AgentSDK] Empty text with ${outputTokens} output tokens — falling back to direct Anthropic API`)
    try {
      const anthropicAuth = config.anthropicAuth ?? config.anthropicApiKey
      if (anthropicAuth) {
        const anthropicProvider = createAnthropic({ apiKey: anthropicAuth })
        const fallbackResult = await generateText({
          model: anthropicProvider(model),
          system: options.system,
          prompt: options.prompt,
          maxOutputTokens: options.maxTokens || 4096,
          temperature: 0.3,
        })
        text = fallbackResult.text
        inputTokens = fallbackResult.usage?.inputTokens || inputTokens
        outputTokens = fallbackResult.usage?.outputTokens || outputTokens
        console.log(`✅ [AgentSDK/fallback] Generated ${text.length} chars via direct API`)
      }
    } catch (fallbackError) {
      console.error(`❌ [AgentSDK/fallback] Direct API also failed:`, fallbackError)
      // Let the caller handle the empty text
    }
  }

  return {
    text,
    usage: {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
    },
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
 * Check whether the user/team has exceeded their configured AI cost limits.
 *
 * Queries `langchain_token_usage` for the running daily and monthly totals and
 * compares them against `AI_PLUGIN_DAILY_COST_LIMIT` / `AI_PLUGIN_MONTHLY_COST_LIMIT`.
 *
 * This is a *soft* enforcement: if the table does not exist, is unreachable, or
 * if cost tracking is disabled in the plugin config the function resolves without
 * error so that normal execution continues.
 *
 * @param userId - The authenticated user ID
 * @param teamId - The team ID for multi-tenancy context
 * @throws Error with a descriptive message when a hard limit is exceeded
 *
 * @example
 * await checkCostLimits(userId, teamId) // throws if over limit, otherwise no-op
 */
export async function checkCostLimits(userId: string, teamId: string): Promise<void> {
  // Respect the cost-tracking enabled flag — do nothing when disabled
  if (!pluginEnv.isCostTrackingEnabled()) return

  const dailyLimit = pluginEnv.getDailyCostLimit()
  const monthlyLimit = pluginEnv.getMonthlyCostLimit()

  // Both limits at 0 means "no enforcement"
  if (dailyLimit <= 0 && monthlyLimit <= 0) return

  try {
    // Lazy import to avoid pulling in DB dependencies on the client bundle.
    // The table lives in the LangChain plugin so we import from there.
    const { queryWithRLS } = await import('@nextsparkjs/core/lib/db')

    // Single query fetches both day and month totals in one round-trip
    const rows = await queryWithRLS<{
      dailyCost: string | null
      monthlyCost: string | null
    }>(
      `SELECT
         COALESCE(SUM(CASE WHEN "createdAt" >= CURRENT_DATE THEN "totalCost" ELSE 0 END), 0)::text AS "dailyCost",
         COALESCE(SUM(CASE WHEN "createdAt" >= date_trunc('month', now()) THEN "totalCost" ELSE 0 END), 0)::text AS "monthlyCost"
       FROM public."langchain_token_usage"
       WHERE "userId" = $1 AND "teamId" = $2`,
      [userId, teamId],
      userId,
    )

    if (!rows || rows.length === 0) return

    const dailyCost = parseFloat(rows[0].dailyCost ?? '0')
    const monthlyCost = parseFloat(rows[0].monthlyCost ?? '0')

    if (dailyLimit > 0 && dailyCost >= dailyLimit) {
      throw new Error(
        `Daily AI cost limit reached ($${dailyCost.toFixed(4)} of $${dailyLimit.toFixed(2)} used). ` +
        'Try again tomorrow or contact support to increase your limit.',
      )
    }

    if (monthlyLimit > 0 && monthlyCost >= monthlyLimit) {
      throw new Error(
        `Monthly AI cost limit reached ($${monthlyCost.toFixed(4)} of $${monthlyLimit.toFixed(2)} used). ` +
        'Upgrade your plan or contact support to increase your limit.',
      )
    }
  } catch (error) {
    // If the error is one we threw ourselves (limit exceeded), re-throw it
    if (error instanceof Error && (error.message.includes('limit reached') || error.message.includes('Cost limit'))) {
      throw error
    }
    // Any other error (DB down, table missing, etc.) — block the request for safety.
    // It is not safe to proceed without being able to verify cost limits.
    console.error('[checkCostLimits] Cannot verify cost limits - blocking request for safety:', error)
    throw new Error('Cost limit verification unavailable. Please try again shortly.')
  }
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
