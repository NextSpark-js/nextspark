/**
 * LangGraph Orchestrator - Main Export (GENERIC)
 *
 * Explicit state machine for multi-agent orchestration.
 * Replaces inefficient ReAct loops with deterministic graph flow.
 *
 * GENERIC ARCHITECTURE:
 * - Plugin exports generic interfaces (AgentTool, OrchestratorConfig)
 * - Theme provides tool implementations and configuration
 * - No hardcoded entity knowledge in plugin
 */

// Generic types (NEW)
export type {
    AgentTool,
    OrchestratorConfig,
    GenericHandlerResult,
} from './types'

// Core types
export type {
    OrchestratorState,
    Intent,
    IntentType,
    IntentAction,
    RouterOutput,
    HandlerResults,
    GraphConfig,
    RouterRoute,
    PostHandlerRoute,
    HandlerNodeFn,
    ModelConfig,
    SystemIntentType,
} from './types'

// Deprecated types (backward compatibility)
export type {
    TaskHandlerResult,
    CustomerHandlerResult,
    PageHandlerResult,
    TaskData,
    CustomerData,
    PageData,
    HandlerFactories,
} from './types'

export { createInitialState, DEFAULT_GRAPH_CONFIG } from './types'

// Graph
export { createOrchestratorGraph, invokeOrchestrator } from './orchestrator-graph'

// Router node factory (NEW - replaces direct routerNode export)
export { createRouterNode } from './nodes/router'

// Core nodes
export { combinerNode } from './nodes/combiner'

// Handler nodes are theme-specific - themes must provide implementations via OrchestratorConfig
