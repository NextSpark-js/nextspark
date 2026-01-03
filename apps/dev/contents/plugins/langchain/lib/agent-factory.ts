import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from '@langchain/core/messages'
import { createReactAgent } from '@langchain/langgraph/prebuilt'
import { getModel } from './providers'
import { memoryStore } from './memory-store'
import { ToolDefinition, buildTools, convertToOpenAITools } from './tools-builder'
import { config } from '../plugin.config'
import { createAgentLogger } from './logger'
import { tokenTracker } from './token-tracker'
import { streamChat as streamChatFn, StreamChunk, StreamChatOptions } from './streaming'
import { guardrails, GuardrailsConfig } from './guardrails'
import { tracer } from './tracer'
import { createTracingCallbacks } from './tracer-callbacks'
import type { ModelConfig, AgentContext, SessionConfig } from '../types/langchain.types'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'

// Re-export types for convenience
export type { StreamChunk, StreamChatOptions }

interface CreateAgentOptions {
    /** Unique session identifier for conversation memory */
    sessionId: string
    /** Human-readable agent name for tracing and logging */
    agentName?: string
    /** System prompt that defines the agent's behavior */
    systemPrompt?: string
    /** Tools available to the agent */
    tools?: ToolDefinition<any>[]
    /**
     * Model configuration override.
     * If not provided, uses plugin defaults from environment variables.
     *
     * @example
     * // Use OpenAI GPT-4
     * modelConfig: { provider: 'openai', model: 'gpt-4o' }
     *
     * // Use Anthropic Claude
     * modelConfig: { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' }
     *
     * // Use local Ollama
     * modelConfig: { provider: 'ollama', model: 'llama3.2:3b' }
     *
     * // Use with temperature
     * modelConfig: { provider: 'openai', model: 'gpt-4o', temperature: 0.7 }
     */
    modelConfig?: Partial<ModelConfig>
    /**
     * Context for multi-tenant memory storage and prompt injection.
     * Required for database-persisted conversation history.
     * Can include additional data for Handlebars template rendering.
     */
    context?: AgentContext
    /**
     * Session configuration for memory customization.
     * Allows per-agent TTL and message limits.
     */
    sessionConfig?: SessionConfig
    /**
     * Guardrails configuration for security and safety
     */
    guardrails?: GuardrailsConfig
    /**
     * Parent trace ID for nested agent calls (e.g., orchestrator -> sub-agent)
     */
    parentId?: string
    /**
     * Maximum number of iterations for the ReAct loop.
     * Default is 25. Increase for complex multi-step tasks.
     * @default 50
     */
    recursionLimit?: number
}

export const createAgent = async (options: CreateAgentOptions) => {
    const {
        sessionId,
        agentName,
        systemPrompt = 'You are a helpful AI assistant.',
        tools = [],
        modelConfig,
        context,
        sessionConfig,
        parentId,
        recursionLimit = 50,  // Default higher than LangGraph's 25 for multi-step tasks
    } = options

    // Warn in development if context is not provided (memory won't be persisted)
    if (!context && config.debug) {
        console.warn('[LangChain Agent] No context provided - conversation history will not be persisted to database')
    }

    // Get model based on configuration (or defaults from env vars)
    const model = getModel(modelConfig)
    const langChainTools = buildTools(tools)

    // Determine effective model info for logging
    const effectiveProvider = modelConfig?.provider || config.defaultProvider
    const providerConfig = config.providers[effectiveProvider] as { model?: string; baseUrl?: string; temperature?: number }
    const effectiveModel = modelConfig?.model || providerConfig?.model || 'default'
    const effectiveBaseUrl = modelConfig?.options?.baseUrl || providerConfig?.baseUrl

    // Create logger for this session (will be garbage collected when agent is done)
    const logger = createAgentLogger({
        agentName: agentName || 'single-agent',
        userName: (context?.userName as string) || 'system',
    })

    // Log session initialization with model info
    await logger.info('SESSION_INIT', {
        provider: effectiveProvider,
        model: effectiveModel,
        baseUrl: effectiveBaseUrl || 'default',
        temperature: modelConfig?.temperature ?? providerConfig?.temperature,
        toolsCount: tools.length,
    })

    // For OpenAI-compatible providers (including LM Studio), bind tools with custom conversion
    // to ensure proper type: "object" in JSON Schema
    let boundModel: BaseChatModel = model
    if (effectiveProvider === 'openai' && tools.length > 0) {
        const openAITools = convertToOpenAITools(tools)
        // Bind the model with pre-converted tools
        // Use 'any' cast as LangChain's typing doesn't expose tools in BaseChatModelCallOptions
        boundModel = (model as any).bind({ tools: openAITools }) as BaseChatModel
    }

    const agent = createReactAgent({
        llm: boundModel,
        tools: langChainTools,
        messageModifier: systemPrompt,
    })

    // Log recursion limit for debugging
    if (config.debug) {
        console.log(`[LangChain Agent] ${agentName || 'Agent'} created with recursionLimit: ${recursionLimit}`)
    }

    return {
        /**
         * Send a message to the agent and get a response
         */
        chat: async (message: string) => {
            // Start trace if configured
            const traceContext = context
                ? await tracer.startTrace(
                      { userId: context.userId, teamId: context.teamId },
                      agentName || 'Agent',
                      message,
                      { sessionId, parentId }
                  )
                : null

            // Create tracing callbacks if trace was started (pass model name for providers like Ollama)
            const tracingHandler = traceContext && context
                ? createTracingCallbacks({ userId: context.userId, teamId: context.teamId }, traceContext.traceId, effectiveModel)
                : null
            const tracingCallbacks = tracingHandler ? [tracingHandler] : []

            try {
                // Add user message to history
                const userMessage = new HumanMessage(message)

                // Get current history (empty array if no context provided)
                const currentHistory = context
                    ? await memoryStore.getMessages(sessionId, context)
                    : []

                // Invoke agent with history + new message
                if (config.debug) {
                    console.log(`[Agent] Invoking with message: "${message}"`)
                }

                await logger.info('USER_MESSAGE', { message })

                const result = await agent.invoke(
                    {
                        messages: [...currentHistory, userMessage],
                    },
                    {
                        callbacks: tracingCallbacks,
                        recursionLimit,
                    }
                )

                if (config.debug) {
                    console.log('[Agent] Result messages:', JSON.stringify(result.messages.map(m => ({ type: m._getType(), content: m.content })), null, 2))
                }

                const newMessages = result.messages.slice(currentHistory.length)
                try {
                    await logger.info('AGENT_RESPONSE', {
                        messages: newMessages.map(m => ({
                            type: m._getType(),
                            content: m.content,
                            tool_calls: (m as any).tool_calls,
                            tool_call_id: (m as any).tool_call_id
                        }))
                    })
                } catch (logError) {
                    if (config.debug) {
                        console.error('[Logger] Failed to log AGENT_RESPONSE:', logError)
                    }
                }

                // Result.messages contains the full conversation including the new response
                // We need to extract the last message which is the AI response
                const lastMessage = result.messages[result.messages.length - 1]
                const responseContent = lastMessage.content as string

                // Track token usage if available and context exists
                const usage = (lastMessage as any).usage_metadata || (lastMessage as any).response_metadata?.usage
                if (usage && context) {
                    await tokenTracker.trackUsage({
                        context,
                        sessionId,
                        provider: modelConfig?.provider || effectiveProvider,
                        model: modelConfig?.model || effectiveModel,
                        usage: {
                            inputTokens: usage.input_tokens || 0,
                            outputTokens: usage.output_tokens || 0,
                            totalTokens: usage.total_tokens || 0,
                        },
                        agentName,
                    })
                }

                // Update memory with the new interaction (User + AI)
                // Note: LangGraph might return intermediate tool messages too
                // Save new messages if context is provided
                if (context) {
                    await memoryStore.addMessages(sessionId, newMessages, context, sessionConfig)
                }

                // End trace successfully if started
                if (traceContext && context) {
                    // Flush pending operations and get call counts from tracing handler
                    await tracingHandler?.flush()
                    const counts = tracingHandler?.getCounts() || { llmCalls: 0, toolCalls: 0 }

                    await tracer.endTrace(
                        { userId: context.userId, teamId: context.teamId },
                        traceContext.traceId,
                        {
                            output: responseContent,
                            tokens: usage
                                ? {
                                      input: usage.input_tokens || 0,
                                      output: usage.output_tokens || 0,
                                      total: usage.total_tokens || 0,
                                  }
                                : undefined,
                            llmCalls: counts.llmCalls,
                            toolCalls: counts.toolCalls,
                        }
                    )
                }

                return {
                    content: responseContent,
                    sessionId,
                    messages: result.messages, // Expose full messages for orchestration
                    traceId: traceContext?.traceId, // Expose trace ID for parent-child linking
                }
            } catch (error) {
                // End trace with error if started
                if (traceContext && context) {
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
                throw error
            }
        },

        /**
         * Get chat history
         */
        getHistory: async () => {
            if (!context) {
                return []
            }
            return memoryStore.getMessages(sessionId, context)
        },

        /**
         * Get the underlying agent for advanced use cases (e.g., streaming)
         */
        getAgent: () => agent,
    }
}

/**
 * Interface for agent configuration used by streamChat
 */
interface AgentConfig {
    name?: string
    modelConfig?: Partial<ModelConfig>
    guardrails?: GuardrailsConfig
}

/**
 * Stream chat with an agent
 *
 * Uses LangChain's streamEvents() for token-by-token streaming.
 * Applies guardrails if configured, handles memory persistence and token tracking.
 */
export async function* streamChat(
    input: string,
    context: AgentContext,
    config: AgentConfig,
    options: StreamChatOptions = {}
): AsyncGenerator<StreamChunk, void, unknown> {
    // Create agent for streaming (we need access to the raw agent)
    const agentInstance = await createAgent({
        sessionId: options.sessionId || `${context.userId}-${Date.now()}`,
        agentName: config.name,
        modelConfig: config.modelConfig,
        context,
        sessionConfig: options.sessionConfig,
    })

    // Get the underlying agent
    const agent = agentInstance.getAgent()

    // Apply guardrails if configured
    if (config.guardrails) {
        try {
            const { processed, warnings } = await guardrails.processInput(
                input,
                config.guardrails
            )
            input = processed
            // Could yield warnings if needed
        } catch (error) {
            yield { type: 'error', error: error instanceof Error ? error.message : 'Guardrail blocked' }
            return
        }
    }

    // Delegate to streaming function
    yield* streamChatFn(agent, input, context, config, {
        ...options,
        agentName: config.name,
    })
}
