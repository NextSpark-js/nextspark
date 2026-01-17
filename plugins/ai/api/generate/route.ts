/**
 * AI Generate Endpoint
 *
 * Simple AI assistant endpoint - generic and helpful
 * Accessible via: /api/plugin/ai/generate
 */

import { NextRequest, NextResponse } from 'next/server'
import { selectModel, calculateCost, validatePlugin, extractTokens, handleAIError } from '../../lib/core-utils'
import { getServerPluginConfig } from '../../lib/server-env'
import { authenticateRequest } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { generateText } from 'ai'
import { saveExampleSafely } from '../../lib/save-example'
import { z } from 'zod'

// Simple, generic system prompt
const SYSTEM_PROMPT = `You are a helpful AI assistant. Provide accurate, helpful, and well-structured responses. Be concise but thorough, and always aim to be useful to the person asking.`

// Request validation schema
const GenerateRequestSchema = z.object({
  prompt: z.string().min(1, 'Prompt cannot be empty').max(10000, 'Prompt too long'),
  model: z.string().optional(),
  maxTokens: z.number().min(1).max(10000).optional(),
  temperature: z.number().min(0).max(1).optional(),
  saveExample: z.boolean().optional().default(false)
})

const postHandler = async (request: NextRequest) => {
  try {
    // 1. Authentication
    const authResult = await authenticateRequest(request)
    if (!authResult.success) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // 2. Validate plugin
    const validation = await validatePlugin()
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 503 })
    }

    // 3. Get default configuration from environment
    const config = await getServerPluginConfig()

    // 4. Parse and validate request body
    const rawBody = await request.json()
    const validationResult = GenerateRequestSchema.safeParse(rawBody)

    if (!validationResult.success) {
      return NextResponse.json({
        error: 'Validation failed',
        details: validationResult.error.issues
      }, { status: 400 })
    }

    const {
      prompt,
      model = config.defaultModel,
      maxTokens = config.maxTokens,
      temperature = config.defaultTemperature,
      saveExample = false
    } = validationResult.data

    // 5. Select model
    const selectedModel = await selectModel(model)

    // 6. Generate AI response
    const result = await generateText({
      model: selectedModel.model,
      system: SYSTEM_PROMPT,
      prompt,
      maxOutputTokens: maxTokens,
      temperature
    })

    // 7. Calculate metrics
    const tokens = extractTokens(result)
    const cost = calculateCost(tokens, selectedModel.costConfig)

    // 8. Save example if requested (opt-in)
    if (saveExample) {
      await saveExampleSafely(
        {
          prompt,
          response: result.text,
          model: selectedModel.modelName,
          status: 'completed',
          metadata: {
            tokens: tokens.total,
            cost,
            provider: selectedModel.provider,
            isLocal: selectedModel.isLocal
          }
        },
        authResult.user!.id
      )
    }

    // 9. Return response
    return NextResponse.json({
      success: true,
      response: result.text,
      model: selectedModel.modelName,
      provider: selectedModel.provider,
      isLocal: selectedModel.isLocal,
      cost,
      tokens,
      userId: authResult.user!.id,
      exampleSaved: saveExample
    })

  } catch (error) {
    console.error('AI Generate error:', error)
    const errorInfo = handleAIError(error as Error)
    return NextResponse.json(
      { error: errorInfo.error, message: errorInfo.message },
      { status: errorInfo.status }
    )
  }
}

export const POST = withRateLimitTier(postHandler, 'write')

/**
 * Get endpoint info
 */
const getHandler = async (): Promise<NextResponse> => {
  const config = await getServerPluginConfig()

  return NextResponse.json({
    endpoint: '/api/plugin/ai/generate',
    description: 'Simple AI assistant endpoint',

    usage: {
      method: 'POST',
      body: {
        prompt: 'string (required) - Your question or request',
        model: `string (optional, default: ${config.defaultModel}) - AI model to use`,
        maxTokens: `number (optional, default: ${config.maxTokens}) - Max response length`,
        temperature: `number (optional, default: ${config.defaultTemperature}) - Response creativity (0-1)`,
        saveExample: 'boolean (optional, default: false) - Save interaction as example (opt-in, data will be sanitized)'
      }
    },

    example: {
      prompt: 'Explain quantum computing in simple terms',
      model: config.defaultModel
    },

    models: {
      local: ['llama3.2:3b', 'llama3.2', 'llama3.1', 'qwen2.5', 'mistral'],
      openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
      anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022']
    },

    setup: {
      local: `ollama serve && ollama pull ${config.ollamaDefaultModel}`,
      openai: 'Add OPENAI_API_KEY to contents/plugins/ai/.env',
      anthropic: 'Add ANTHROPIC_API_KEY to contents/plugins/ai/.env'
    }
  })
}

export const GET = withRateLimitTier(getHandler, 'read')