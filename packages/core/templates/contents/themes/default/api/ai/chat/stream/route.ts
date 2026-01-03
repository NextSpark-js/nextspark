/**
 * ============================================================================
 * STREAMING CHAT API ENDPOINT
 * ============================================================================
 *
 * Provides token-by-token streaming for AI chat using Server-Sent Events (SSE).
 * Supports cancellation via AbortSignal and tracks token usage.
 *
 * POST /api/ai/chat/stream
 *   Body:
 *     - message: string (required) - User message
 *     - sessionId: string (optional) - Conversation session ID
 *     - agentName: string (required) - Agent to use (from langchain.config.ts)
 *
 * Returns: Server-Sent Events stream
 *   Event types:
 *     - token: { type: 'token', content: string }
 *     - done: { type: 'done', fullContent: string, tokenUsage?: {...} }
 *     - error: { type: 'error', error: string }
 *     - tool_start: { type: 'tool_start', toolName: string }
 *     - tool_end: { type: 'tool_end', toolName: string, result: unknown }
 *
 * ============================================================================
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { authenticateRequest } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { streamChat } from '@/plugins/langchain/lib/agent-factory'
import { createSSEEncoder } from '@/plugins/langchain/lib/streaming'
import { loadSystemPrompt } from '@/themes/default/lib/langchain/agents'
import {
    getAgentConfig,
    getAgentModelConfig,
    getAgentTools,
    getAgentPromptName,
} from '@/themes/default/lib/langchain/langchain.config'

// Request validation schema
const StreamChatRequestSchema = z.object({
    message: z.string().min(1).max(2000),
    sessionId: z.string().optional(),
    agentName: z.string().min(1),
})

/**
 * POST - Stream chat response
 */
export async function POST(request: NextRequest) {
    try {
        // 1. Authentication
        const authResult = await authenticateRequest(request)
        if (!authResult.success || !authResult.user) {
            return new Response(
                JSON.stringify({ success: false, error: 'Unauthorized' }),
                {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' },
                }
            ) as any
        }

        // 2. Team context
        const teamId = request.headers.get('x-team-id')
        if (!teamId) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Team context required',
                    code: 'TEAM_CONTEXT_REQUIRED',
                }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            ) as any
        }

        const userId = authResult.user.id
        const context = { userId, teamId }

        // 3. Validate request body
        const body = await request.json()
        const validation = StreamChatRequestSchema.safeParse(body)

        if (!validation.success) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Invalid request',
                    details: validation.error.issues,
                }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            ) as any
        }

        const { message, sessionId, agentName } = validation.data

        // 4. Get agent configuration
        const agentConfig = getAgentConfig(agentName)
        if (!agentConfig) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: `Agent '${agentName}' not found`,
                    code: 'AGENT_NOT_FOUND',
                }),
                {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' },
                }
            ) as any
        }

        // 5. Load system prompt
        const promptName = getAgentPromptName(agentName)
        if (!promptName) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: `No system prompt configured for agent '${agentName}'`,
                }),
                {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' },
                }
            ) as any
        }

        const systemPrompt = loadSystemPrompt(promptName as any)

        // 6. Build agent configuration for streaming
        const streamConfig = {
            name: agentName,
            systemPrompt,
            tools: getAgentTools(agentName, context),
            modelConfig: getAgentModelConfig(agentName),
            guardrails: agentConfig.guardrails,
        }

        // 7. Create SSE stream
        const encoder = createSSEEncoder()

        const stream = new ReadableStream({
            async start(controller) {
                try {
                    // Create streaming generator
                    const generator = streamChat(message, context, streamConfig, {
                        sessionId,
                        agentName,
                        signal: request.signal,
                    })

                    // Stream chunks
                    for await (const chunk of generator) {
                        controller.enqueue(encoder.encode(chunk))

                        // Stop streaming on done or error
                        if (chunk.type === 'done' || chunk.type === 'error') {
                            break
                        }
                    }

                    // Send final marker
                    controller.enqueue(encoder.encodeDone())
                    controller.close()
                } catch (error) {
                    // Stream error to client
                    controller.enqueue(
                        encoder.encode({
                            type: 'error',
                            error: error instanceof Error ? error.message : 'Streaming error',
                        })
                    )
                    controller.close()
                }
            },

            // Handle client cancellation
            cancel() {
                console.log('[Streaming Chat] Stream cancelled by client')
            },
        })

        // 8. Return SSE response
        // Note: Returning raw Response (not NextResponse) for SSE streaming compatibility
        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache, no-transform',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no', // Disable nginx buffering
            },
        }) as any // Type assertion needed - Response is compatible with NextResponse
    } catch (error) {
        console.error('[Streaming Chat] Error:', error)
        return new Response(
            JSON.stringify({
                success: false,
                error: 'Failed to start streaming',
                details: error instanceof Error ? error.message : 'Unknown error',
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        ) as any
    }
}
