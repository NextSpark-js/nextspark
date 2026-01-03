import { z } from 'zod'
import { BaseMessage } from '@langchain/core/messages'
import type { GuardrailsConfig } from '../lib/guardrails'
import type { ObservabilityConfig } from './observability.types'

/**
 * Configuration for creating an agent
 */
export interface AgentConfig {
    sessionId: string
    systemPrompt?: string
    tools?: ToolDefinition<z.ZodObject<z.ZodRawShape>>[]
}

/**
 * Response from an agent chat invocation
 */
export interface AgentResponse {
    content: string
    sessionId: string
}

/**
 * Chat message structure for UI
 */
export interface ChatMessage {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: number
}

/**
 * Tool definition for creating LangChain tools
 */
export interface ToolDefinition<T extends z.ZodObject<z.ZodRawShape>> {
    name: string
    description: string
    schema: T
    func: (input: z.infer<T>) => Promise<string>
}

/**
 * Tool call result
 */
export interface ToolCall {
    toolName: string
    input: Record<string, unknown>
    output: unknown
}

/**
 * Supported LLM providers
 */
export type LLMProvider = 'openai' | 'anthropic' | 'ollama'

/**
 * Model configuration for creating LLM instances
 * Can be used to override default provider settings
 */
export interface ModelConfig {
    /** LLM provider to use */
    provider: LLMProvider
    /** Model name (e.g., 'gpt-4o-mini', 'claude-3-5-sonnet-20241022', 'llama3.2:3b') */
    model: string
    /** Temperature for response generation (0-1) */
    temperature?: number
    /** Maximum tokens in response */
    maxTokens?: number
    /** Provider-specific options */
    options?: {
        /** API key override (uses env var if not provided) */
        apiKey?: string
        /** Base URL override (for Ollama or custom endpoints) */
        baseUrl?: string
    }
}

/**
 * Session configuration options for memory customization
 */
export interface SessionConfig {
    /** Maximum number of messages to keep in conversation (sliding window) */
    maxMessages?: number
    /** TTL in hours. null = no expiration (default) */
    ttlHours?: number | null
}

/**
 * Context passed to agents, tools, and memory operations
 * Required: userId + teamId for multi-tenancy
 * Flexible: Themes can add any additional properties for prompt injection
 */
export interface AgentContext {
    /** User identifier (required for RLS) */
    userId: string
    /** Team identifier (required for RLS) */
    teamId: string
    /** Flexible: Theme defines any additional context */
    [key: string]: unknown
}

/**
 * Complete agent configuration
 * Centralizes all settings for an agent in one place
 */
export interface AgentDefinition {
    /** LLM provider */
    provider: LLMProvider
    /** Model name */
    model?: string
    /** Temperature (0-1) */
    temperature?: number
    /** Factory function to create tools with runtime context */
    createTools?: (context: AgentContext) => ToolDefinition<z.ZodObject<z.ZodRawShape>>[]
    /** System prompt - either filename (e.g., 'task-assistant') or inline string */
    systemPrompt?: string
    /** Description of what this agent does (for documentation) */
    description?: string
    /** Memory customization per agent (TTL, maxMessages) */
    sessionConfig?: SessionConfig
    /** Guardrails configuration for security and safety */
    guardrails?: GuardrailsConfig
    /**
     * Enrich base context with runtime data for prompt templates
     * Called before creating agent to inject business data into prompts
     * @param baseContext - Base context with userId + teamId
     * @returns Enhanced context with additional data for Handlebars templates
     */
    enrichContext?: (baseContext: AgentContext) => Promise<AgentContext>
}

/**
 * Theme-level LangChain configuration
 * Allows themes to specify different models for different agents
 */
export interface ThemeLangChainConfig {
    /** Default provider when not specified per-agent */
    defaultProvider: LLMProvider
    /** Default model when not specified per-agent */
    defaultModel?: string
    /** Default temperature when not specified per-agent */
    defaultTemperature?: number
    /** Per-agent complete configuration */
    agents?: Record<string, AgentDefinition>
    /** Model pricing per 1M tokens (USD) */
    pricing?: Record<string, { input: number; output: number }>
    /** Default guardrails for all agents */
    defaultGuardrails?: GuardrailsConfig
    /** Observability configuration */
    observability?: ObservabilityConfig
}

/**
 * Provider configuration (legacy, kept for backwards compatibility)
 * @deprecated Use ModelConfig instead
 */
export interface ProviderConfig {
    type: LLMProvider
    baseUrl?: string
    model: string
}

/**
 * Session data stored in memory
 */
export interface SessionData {
    messages: BaseMessage[]
    lastUpdated: number
}

// ============================================
// CONVERSATION / SESSION TYPES
// ============================================

/**
 * Conversation limits
 */
export const CONVERSATION_LIMITS = {
    MAX_CONVERSATIONS: 50,
    MAX_MESSAGES_PER_CONVERSATION: 50,
} as const

/**
 * Conversation/Session information for API responses
 */
export interface ConversationInfo {
    /** Unique session identifier: {userId}-{timestamp} */
    sessionId: string
    /** User-defined name or auto-generated from first message */
    name: string | null
    /** Number of messages in conversation */
    messageCount: number
    /** First user message (truncated to 100 chars) for display */
    firstMessage: string | null
    /** Whether conversation is pinned */
    isPinned: boolean
    /** ISO timestamp of creation */
    createdAt: string
    /** ISO timestamp of last update */
    updatedAt: string
}

/**
 * Request to create a new conversation
 */
export interface CreateConversationRequest {
    /** Optional name for the conversation */
    name?: string
}

/**
 * Request to update an existing conversation
 */
export interface UpdateConversationRequest {
    /** Session ID to update */
    sessionId: string
    /** New name (optional) */
    name?: string
    /** New pin status (optional) */
    isPinned?: boolean
}

/**
 * Response for listing conversations
 */
export interface ListConversationsResponse {
    success: true
    data: {
        sessions: ConversationInfo[]
        count: number
        maxAllowed: number
    }
}

/**
 * Response for creating a conversation
 */
export interface CreateConversationResponse {
    success: true
    data: {
        sessionId: string
        name: string | null
        createdAt: string
    }
}

/**
 * Response for getting conversation with messages
 */
export interface GetConversationResponse {
    success: true
    data: ConversationInfo & {
        messages: ChatMessage[]
    }
}

/**
 * Error response when limit is reached
 */
export interface ConversationLimitError {
    success: false
    error: 'CONVERSATION_LIMIT_REACHED'
    message: string
    data: {
        currentCount: number
        maxAllowed: number
        oldestSession: {
            sessionId: string
            name: string | null
            updatedAt: string
        } | null
    }
}
