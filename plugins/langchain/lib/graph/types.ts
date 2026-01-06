/**
 * LangGraph Orchestrator Types
 *
 * State schema and types for the explicit graph-based orchestrator.
 * Replaces ReAct loops with deterministic state machine flow.
 *
 * GENERIC ARCHITECTURE:
 * - Plugin defines generic interfaces (AgentTool, OrchestratorConfig)
 * - Theme provides tool implementations and configuration
 * - No hardcoded entity knowledge in plugin
 */

import type { BaseMessage } from '@langchain/core/messages'
import type { AgentContext, SessionConfig, LLMProvider } from '../../types/langchain.types'
import type { z } from 'zod'

// ============================================
// AGENT TOOL INTERFACE (NEW - GENERIC)
// ============================================

/**
 * Handler node function type
 * Theme must implement these and pass to graph factory
 */
export type HandlerNodeFn = (state: OrchestratorState) => Promise<Partial<OrchestratorState>>

/**
 * Agent tool definition - describes a capability the orchestrator can use
 *
 * Example:
 * {
 *   name: 'task',
 *   description: 'Task/todo management (list, create, update, delete)',
 *   handler: taskHandlerNode,
 *   exampleParameters: 'title, description, priority (low/medium/high/urgent)',
 * }
 */
export interface AgentTool {
    /** Unique identifier (e.g., 'task', 'customer', 'product') */
    name: string
    /** Description for router prompt */
    description: string
    /** Optional Zod schema for parameter extraction */
    parameterSchema?: z.ZodSchema
    /** Handler implementation (theme-provided) */
    handler: HandlerNodeFn
    /** Example parameters for router prompt (optional) */
    exampleParameters?: string
}

/**
 * Orchestrator configuration - provided by theme
 */
export interface OrchestratorConfig {
    /** Tools registered by theme */
    tools: AgentTool[]
    /** System intents like 'greeting', 'clarification' (default: both) */
    systemIntents?: ('greeting' | 'clarification')[]
    /** Additional router prompt context (optional) */
    routerPromptExtras?: string
}

// ============================================
// INTENT TYPES (NOW DYNAMIC)
// ============================================

/**
 * System intent types (built into plugin)
 */
export type SystemIntentType = 'greeting' | 'clarification'

/**
 * Intent types that the router can classify
 * Now dynamic - can be any tool name registered in OrchestratorConfig
 */
export type IntentType = string

/**
 * Actions that can be performed on entities
 */
export type IntentAction = 'list' | 'create' | 'update' | 'delete' | 'search' | 'get' | 'unknown'

/**
 * A single parsed intent from user input
 */
export interface Intent {
    /** Type of intent (which handler should process it) */
    type: IntentType
    /** Action to perform */
    action: IntentAction
    /** Extracted parameters for the action */
    parameters: Record<string, unknown>
    /** Original text that maps to this intent */
    originalText: string
    /** Confidence score from router (0-1) */
    confidence?: number
}

/**
 * Router output schema (for structured output)
 */
export interface RouterOutput {
    intents: Intent[]
    /** If true, needs clarification from user */
    needsClarification: boolean
    /** Clarification question if needed */
    clarificationQuestion?: string
}

// ============================================
// HANDLER RESULT TYPES (NOW GENERIC)
// ============================================

/**
 * Generic handler result interface
 * Replaces entity-specific types (TaskHandlerResult, CustomerHandlerResult, etc.)
 */
export interface GenericHandlerResult {
    success: boolean
    operation: IntentAction
    message: string
    data: unknown
    count?: number
    error?: string
}

/**
 * All handler results combined - now generic
 * Keys are tool names, values are results
 */
export type HandlerResults = Record<string, GenericHandlerResult>

// ============================================
// DEPRECATED TYPES (for backward compatibility during migration)
// ============================================

/**
 * @deprecated Use GenericHandlerResult instead
 */
export interface TaskHandlerResult extends GenericHandlerResult {
    data: TaskData[] | TaskData | null
}

/**
 * @deprecated Use generic data structure instead
 */
export interface TaskData {
    id: string
    title: string
    status?: string
    priority?: string
    dueDate?: string
    description?: string
    [key: string]: unknown
}

/**
 * @deprecated Use GenericHandlerResult instead
 */
export interface CustomerHandlerResult extends GenericHandlerResult {
    data: CustomerData[] | CustomerData | null
}

/**
 * @deprecated Use generic data structure instead
 */
export interface CustomerData {
    id: string
    name: string
    email?: string
    phone?: string
    accountNumber?: string
    [key: string]: unknown
}

/**
 * @deprecated Use GenericHandlerResult instead
 */
export interface PageHandlerResult extends GenericHandlerResult {
    data: PageData[] | PageData | null
}

/**
 * @deprecated Use generic data structure instead
 */
export interface PageData {
    id: string
    title: string
    slug?: string
    status?: string
    [key: string]: unknown
}

// ============================================
// ORCHESTRATOR STATE
// ============================================

/**
 * The main state that flows through the orchestrator graph
 */
export interface OrchestratorState {
    // ---- Input ----
    /** Original user input */
    input: string
    /** Session identifier for memory */
    sessionId: string
    /** Multi-tenant context (userId, teamId, etc.) */
    context: AgentContext
    /** Recent conversation history (last N messages) */
    conversationHistory: BaseMessage[]
    /** Session configuration for memory */
    sessionConfig?: SessionConfig

    // ---- Router Configuration ----
    /** Model configuration injected by theme (for router node) */
    modelConfig?: ModelConfig

    // ---- Router Output ----
    /** Parsed intents from router */
    intents: Intent[]
    /** Whether clarification is needed */
    needsClarification: boolean
    /** Clarification question if needed */
    clarificationQuestion?: string

    // ---- Handler Outputs ----
    /** Results from each handler (JSON) */
    handlerResults: HandlerResults
    /** Which handlers have been executed */
    completedHandlers: IntentType[]

    // ---- Final Output ----
    /** Final response to send to user */
    finalResponse: string | null
    /** Error message if something failed */
    error: string | null

    // ---- Tracing ----
    /** Trace ID for observability */
    traceId?: string
    /** Parent trace ID for nested calls */
    parentTraceId?: string

    // ---- Logging ----
    /** Timestamp for logger filename (ensures all handlers write to same file) */
    loggerTimestamp?: number
}

/**
 * Initial state factory
 */
export function createInitialState(
    input: string,
    sessionId: string,
    context: AgentContext,
    conversationHistory: BaseMessage[] = [],
    sessionConfig?: SessionConfig
): OrchestratorState {
    return {
        input,
        sessionId,
        context,
        conversationHistory,
        sessionConfig,
        intents: [],
        needsClarification: false,
        handlerResults: {},
        completedHandlers: [],
        finalResponse: null,
        error: null,
    }
}

// ============================================
// GRAPH ROUTING TYPES (NOW DYNAMIC)
// ============================================

/**
 * Possible routes from the router node - now dynamic based on tools
 * Examples: 'task_handler', 'customer_handler', 'greeting', 'clarification', 'error'
 */
export type RouterRoute = string

/**
 * Possible routes after a handler completes - now dynamic
 * Examples: 'customer_handler', 'page_handler', 'combiner'
 */
export type PostHandlerRoute = string

// ============================================
// NODE FUNCTION TYPES
// ============================================

/**
 * Type for graph node functions
 */
export type GraphNode = (state: OrchestratorState) => Promise<Partial<OrchestratorState>>

/**
 * Type for conditional edge functions
 */
export type ConditionalEdge = (state: OrchestratorState) => RouterRoute | PostHandlerRoute

// ============================================
// CONFIGURATION
// ============================================

/**
 * Graph configuration options
 */
export interface GraphConfig {
    /** Maximum conversation history messages to include */
    maxHistoryMessages: number
    /** Temperature for router LLM */
    routerTemperature: number
    /** Temperature for combiner LLM */
    combinerTemperature: number
    /** Whether to use parallel handler execution */
    parallelExecution: boolean
    /** Timeout for handler execution (ms) */
    handlerTimeout: number
}

/**
 * Default graph configuration
 */
export const DEFAULT_GRAPH_CONFIG: GraphConfig = {
    maxHistoryMessages: 5,
    routerTemperature: 0.1,
    combinerTemperature: 0.3,
    parallelExecution: true,
    handlerTimeout: 30000,
}

// ============================================
// HANDLER FACTORY TYPES (DEPRECATED)
// ============================================

/**
 * @deprecated Use OrchestratorConfig.tools instead
 * Handler factory configuration
 * Theme provides implementations for these handlers
 */
export interface HandlerFactories {
    /** Handler for task-related operations */
    taskHandler: HandlerNodeFn
    /** Handler for customer-related operations */
    customerHandler: HandlerNodeFn
    /** Handler for page-related operations */
    pageHandler: HandlerNodeFn
}

// ============================================
// MODEL CONFIGURATION TYPES
// ============================================

/**
 * Model configuration to inject into state
 * Avoids router needing to import from theme
 */
export interface ModelConfig {
    provider: LLMProvider
    model?: string
    temperature?: number
}
