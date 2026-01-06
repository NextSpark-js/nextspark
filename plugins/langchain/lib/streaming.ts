/**
 * Streaming Service
 *
 * Provides token-by-token streaming via AsyncGenerator.
 * Integrates with LangChain's streamEvents() method.
 */

import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages'
import type { AgentContext, SessionConfig } from '../types/langchain.types'
import { dbMemoryStore } from './db-memory-store'
import { tokenTracker } from './token-tracker'
import { tracer } from './tracer'
import { createTracingCallbacks } from './tracer-callbacks'

// Stream chunk types
export type StreamChunk =
    | { type: 'token'; content: string }
    | { type: 'done'; fullContent: string; agentUsed?: string; tokenUsage?: TokenUsage }
    | { type: 'error'; error: string }
    | { type: 'tool_start'; toolName: string }
    | { type: 'tool_end'; toolName: string; result: unknown }

interface TokenUsage {
    inputTokens: number
    outputTokens: number
    totalTokens: number
}

export interface StreamChatOptions {
    sessionId?: string
    sessionConfig?: SessionConfig
    agentName?: string
    onToken?: (token: string) => void
    onToolCall?: (name: string, input: unknown) => void
    signal?: AbortSignal  // For cancellation
}

interface AgentConfig {
    modelConfig?: {
        provider?: string
        model?: string
    }
}

/**
 * Stream chat with an agent
 *
 * Uses LangChain's streamEvents() for token-by-token streaming.
 * Handles memory persistence and token tracking.
 */
export async function* streamChat(
    agent: { streamEvents: Function; invoke: Function },
    input: string,
    context: AgentContext,
    config: AgentConfig,
    options: StreamChatOptions = {}
): AsyncGenerator<StreamChunk, void, unknown> {
    const { sessionId, sessionConfig, agentName, signal } = options

    let fullContent = ''
    let tokenUsage: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }

    // Start trace if context exists
    const traceContext = await tracer.startTrace(
        { userId: context.userId, teamId: context.teamId },
        agentName || 'StreamAgent',
        input,
        { sessionId }
    )

    // Create tracing callbacks if trace was started
    const tracingHandler = traceContext
        ? createTracingCallbacks({ userId: context.userId, teamId: context.teamId }, traceContext.traceId)
        : null
    const tracingCallbacks = tracingHandler ? [tracingHandler] : []

    try {
        // Get history if session exists
        let history: BaseMessage[] = []
        if (sessionId) {
            history = await dbMemoryStore.getMessages(sessionId, context)
        }

        // Create input with history
        const messages = [...history, new HumanMessage(input)]

        // Stream events from LangChain with tracing callbacks
        const stream = agent.streamEvents(
            { messages },
            {
                version: 'v2',
                callbacks: tracingCallbacks,
            }
        )

        for await (const event of stream) {
            // Check for cancellation
            if (signal?.aborted) {
                yield { type: 'error', error: 'Stream cancelled by user' }
                return
            }

            // Handle different event types
            if (event.event === 'on_chat_model_stream') {
                const token = event.data?.chunk?.content
                if (token && typeof token === 'string') {
                    fullContent += token
                    yield { type: 'token', content: token }
                }
            }

            if (event.event === 'on_tool_start') {
                yield {
                    type: 'tool_start',
                    toolName: event.name || 'unknown',
                }
            }

            if (event.event === 'on_tool_end') {
                yield {
                    type: 'tool_end',
                    toolName: event.name || 'unknown',
                    result: event.data?.output,
                }
            }

            // Capture token usage from LLM events
            if (event.event === 'on_llm_end') {
                const usage = event.data?.output?.usage_metadata ||
                              event.data?.output?.llmOutput?.tokenUsage
                if (usage) {
                    tokenUsage = {
                        inputTokens: usage.input_tokens || usage.promptTokens || 0,
                        outputTokens: usage.output_tokens || usage.completionTokens || 0,
                        totalTokens: usage.total_tokens || usage.totalTokens || 0,
                    }
                }
            }
        }

        // Persist to memory if session exists
        if (sessionId && fullContent) {
            await dbMemoryStore.addMessages(
                sessionId,
                [new HumanMessage(input), new AIMessage(fullContent)],
                context,
                sessionConfig
            )
        }

        // Track token usage
        if (tokenUsage.totalTokens > 0) {
            await tokenTracker.trackUsage({
                context,
                sessionId,
                provider: config.modelConfig?.provider || 'unknown',
                model: config.modelConfig?.model || 'unknown',
                usage: tokenUsage,
                agentName,
            })
        }

        // End trace successfully if started
        if (traceContext) {
            // Flush pending operations and get call counts from tracing handler
            await tracingHandler?.flush()
            const counts = tracingHandler?.getCounts() || { llmCalls: 0, toolCalls: 0 }

            await tracer.endTrace(
                { userId: context.userId, teamId: context.teamId },
                traceContext.traceId,
                {
                    output: fullContent,
                    tokens: tokenUsage.totalTokens > 0
                        ? {
                              input: tokenUsage.inputTokens,
                              output: tokenUsage.outputTokens,
                              total: tokenUsage.totalTokens,
                          }
                        : undefined,
                    llmCalls: counts.llmCalls,
                    toolCalls: counts.toolCalls,
                }
            )
        }

        yield {
            type: 'done',
            fullContent,
            agentUsed: agentName,
            tokenUsage,
        }

    } catch (error) {
        // End trace with error if started
        if (traceContext) {
            // Flush pending operations and get call counts from tracing handler (even on error)
            await tracingHandler?.flush()
            const counts = tracingHandler?.getCounts() || { llmCalls: 0, toolCalls: 0 }

            await tracer.endTrace(
                { userId: context.userId, teamId: context.teamId },
                traceContext.traceId,
                {
                    error: error instanceof Error ? error : new Error(String(error)),
                    llmCalls: counts.llmCalls,
                    toolCalls: counts.toolCalls,
                }
            )
        }

        const message = error instanceof Error ? error.message : 'Unknown streaming error'
        yield { type: 'error', error: message }
    }
}

/**
 * Create SSE encoder for streaming responses
 */
export function createSSEEncoder() {
    const encoder = new TextEncoder()

    return {
        encode(chunk: StreamChunk): Uint8Array {
            return encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`)
        },

        encodeDone(): Uint8Array {
            return encoder.encode('data: [DONE]\n\n')
        },
    }
}
