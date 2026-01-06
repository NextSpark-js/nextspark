/**
 * AI Embeddings Endpoint
 *
 * Generate text embeddings using OpenAI's text-embedding-3-small model
 * Accessible via: /api/v1/plugin/ai/embeddings
 */

import { NextRequest, NextResponse } from 'next/server'
import { validatePlugin, handleAIError } from '../../lib/core-utils'
import { getServerPluginConfig } from '../../lib/server-env'
import { authenticateRequest } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { embed } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'

// Request validation schema
const EmbeddingRequestSchema = z.object({
  text: z.string().min(1, 'Text cannot be empty').max(50000, 'Text too long')
})

export async function POST(request: NextRequest) {
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

    // 3. Parse and validate request body
    const rawBody = await request.json()
    const validationResult = EmbeddingRequestSchema.safeParse(rawBody)

    if (!validationResult.success) {
      return NextResponse.json({
        error: 'Validation failed',
        details: validationResult.error.issues
      }, { status: 400 })
    }

    const { text } = validationResult.data

    // 4. Check OpenAI API key
    const config = await getServerPluginConfig()
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        error: 'OpenAI API key not configured',
        message: 'Add OPENAI_API_KEY to contents/plugins/ai/.env'
      }, { status: 503 })
    }

    // 5. Generate embedding using OpenAI text-embedding-3-small (same as n8n)
    const { embedding, usage } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: text
    })

    // 6. Return response
    return NextResponse.json({
      success: true,
      embedding,
      model: 'text-embedding-3-small',
      dimensions: embedding.length,
      tokens: usage?.tokens || 0,
      userId: authResult.user!.id
    })

  } catch (error) {
    console.error('AI Embeddings error:', error)
    const errorInfo = handleAIError(error as Error)
    return NextResponse.json(
      { error: errorInfo.error, message: errorInfo.message },
      { status: errorInfo.status }
    )
  }
}

/**
 * Get endpoint info
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    endpoint: '/api/v1/plugin/ai/embeddings',
    description: 'Generate text embeddings using OpenAI',

    usage: {
      method: 'POST',
      body: {
        text: 'string (required) - Text to convert to embedding vector'
      }
    },

    response: {
      embedding: 'number[] - Vector representation (1536 dimensions)',
      model: 'string - Model used (text-embedding-3-small)',
      dimensions: 'number - Embedding dimensions (1536)',
      tokens: 'number - Tokens used'
    },

    example: {
      request: {
        text: 'Premium wireless headphones with noise cancellation'
      },
      response: {
        success: true,
        embedding: '[1536 numbers...]',
        model: 'text-embedding-3-small',
        dimensions: 1536,
        tokens: 8
      }
    },

    model: {
      name: 'text-embedding-3-small',
      dimensions: 1536,
      maxTokens: 8191,
      cost: '$0.00002 per 1K tokens (5x cheaper than ada-002)'
    },

    setup: {
      required: 'Add OPENAI_API_KEY to contents/plugins/ai/.env'
    }
  })
}
