/**
 * LangGraph Orchestrator Graph (GENERIC - Theme-Agnostic)
 *
 * Explicit state machine for multi-agent orchestration.
 * Replaces inefficient ReAct loops with deterministic graph flow.
 *
 * GENERIC ARCHITECTURE:
 * - Graph structure is generated dynamically from OrchestratorConfig
 * - No hardcoded knowledge of specific entities (task, customer, page)
 * - Supports N tools registered by theme
 *
 * Flow:
 * START → Router (1 LLM) → Handlers (0 LLM, sequential) → Combiner (1 LLM if needed) → END
 *
 * Benefits:
 * - 1-2 LLM calls instead of 50+
 * - No recursion limit issues
 * - Deterministic execution
 * - Theme-agnostic - works with any registered tools
 */

import { StateGraph, END, START } from '@langchain/langgraph'
import type { BaseMessage } from '@langchain/core/messages'
import type { AgentContext, SessionConfig } from '../../types/langchain.types'
import { createAgentLogger } from '../logger'
import type {
    OrchestratorState,
    Intent,
    HandlerResults,
    IntentType,
    RouterRoute,
    GraphConfig,
    OrchestratorConfig,
    ModelConfig,
} from './types'
import { DEFAULT_GRAPH_CONFIG } from './types'
import { createRouterNode } from './nodes/router'
import { combinerNode } from './nodes/combiner'

// ============================================
// STATE CHANNELS DEFINITION
// ============================================

/**
 * Channel definitions for state management
 */
const orchestratorChannels = {
    // Input channels
    input: {
        value: (x: string, y?: string) => y ?? x,
        default: () => '',
    },
    sessionId: {
        value: (x: string, y?: string) => y ?? x,
        default: () => '',
    },
    context: {
        value: (x: AgentContext, y?: AgentContext) => y ?? x,
        default: () => ({ userId: '', teamId: '' } as AgentContext),
    },
    conversationHistory: {
        value: (x: BaseMessage[], y?: BaseMessage[]) => y ?? x,
        default: () => [] as BaseMessage[],
    },
    sessionConfig: {
        value: (x: SessionConfig | undefined, y?: SessionConfig | undefined) => y ?? x,
        default: () => undefined as SessionConfig | undefined,
    },
    modelConfig: {
        value: (x: ModelConfig | undefined, y?: ModelConfig | undefined) => y ?? x,
        default: () => undefined as ModelConfig | undefined,
    },

    // Router output channels
    intents: {
        value: (_: Intent[], y?: Intent[]) => y ?? [],
        default: () => [] as Intent[],
    },
    needsClarification: {
        value: (_: boolean, y?: boolean) => y ?? false,
        default: () => false,
    },
    clarificationQuestion: {
        value: (x: string | undefined, y?: string | undefined) => y ?? x,
        default: () => undefined as string | undefined,
    },

    // Handler output channels - merge results
    handlerResults: {
        value: (current: HandlerResults, update?: HandlerResults) =>
            update ? { ...current, ...update } : current,
        default: () => ({} as HandlerResults),
    },
    completedHandlers: {
        value: (current: IntentType[], update?: IntentType[]) =>
            update ? [...new Set([...current, ...update])] : current,
        default: () => [] as IntentType[],
    },

    // Final output channels
    finalResponse: {
        value: (_: string | null, y?: string | null) => y ?? null,
        default: () => null as string | null,
    },
    error: {
        value: (_: string | null, y?: string | null) => y ?? null,
        default: () => null as string | null,
    },

    // Tracing channels
    traceId: {
        value: (x: string | undefined, y?: string | undefined) => y ?? x,
        default: () => undefined as string | undefined,
    },
    parentTraceId: {
        value: (x: string | undefined, y?: string | undefined) => y ?? x,
        default: () => undefined as string | undefined,
    },

    // Logging channels
    loggerTimestamp: {
        value: (x: number | undefined, y?: number | undefined) => y ?? x,
        default: () => undefined as number | undefined,
    },
}

// ============================================
// GENERIC ROUTING FUNCTIONS
// ============================================

/**
 * Create generic routing function from router to first handler
 */
function createRouteByIntents(config: OrchestratorConfig) {
    const toolNames = config.tools.map(t => t.name)
    const systemIntents = config.systemIntents || ['greeting', 'clarification']

    return function routeByIntents(state: OrchestratorState): RouterRoute {
        // Handle errors
        if (state.error) {
            return 'error_handler'
        }

        // Handle clarification
        if (state.needsClarification) {
            return 'clarification'
        }

        const intentTypes = state.intents.map((i) => i.type)

        // Check for greeting-only
        if (intentTypes.length === 1 && intentTypes[0] === 'greeting') {
            return 'greeting'
        }

        // Find first tool handler that's needed
        const neededTools = toolNames.filter(t => intentTypes.includes(t))
        if (neededTools.length === 0) {
            return 'clarification'
        }

        // Route to first tool handler
        return `${neededTools[0]}_handler`
    }
}

/**
 * Create generic routing function for after a handler completes
 */
function createRouteAfterHandler(config: OrchestratorConfig, currentToolIndex: number) {
    const toolNames = config.tools.map(t => t.name)

    return function routeAfterHandler(state: OrchestratorState): string {
        const intentTypes = state.intents.map((i) => i.type)
        const completed = state.completedHandlers

        // Find next needed handler that hasn't been completed
        for (let i = currentToolIndex + 1; i < toolNames.length; i++) {
            const toolName = toolNames[i]
            if (intentTypes.includes(toolName) && !completed.includes(toolName)) {
                return `${toolName}_handler`
            }
        }

        // All handlers done, go to combiner
        return 'combiner'
    }
}

// ============================================
// SIMPLE NODE WRAPPERS
// ============================================

/**
 * Simple pass-through for greeting
 */
async function greetingNodeWrapper(state: OrchestratorState): Promise<Partial<OrchestratorState>> {
    return { completedHandlers: ['greeting' as IntentType] }
}

/**
 * Clarification node - sets response asking for more info
 */
async function clarificationNodeWrapper(state: OrchestratorState): Promise<Partial<OrchestratorState>> {
    const question = state.clarificationQuestion || 'Could you please clarify what you would like me to do?'
    return {
        finalResponse: question,
        completedHandlers: ['clarification' as IntentType],
    }
}

/**
 * Error handling node
 */
async function errorNodeWrapper(state: OrchestratorState): Promise<Partial<OrchestratorState>> {
    return {
        finalResponse: state.error || 'An unexpected error occurred. Please try again.',
    }
}

// ============================================
// GRAPH BUILDER (GENERIC)
// ============================================

/**
 * Create the orchestrator graph dynamically from configuration
 *
 * @param config - Orchestrator configuration with tools
 * @param _graphConfig - Optional graph configuration (reserved for future use)
 * @returns Compiled LangGraph
 */
export function createOrchestratorGraph(
    config: OrchestratorConfig,
    _graphConfig: Partial<GraphConfig> = {}
) {
    // Create the graph with channels
    // Using 'any' to bypass strict typing of StateGraph which expects literal node names
    const graph: any = new StateGraph<OrchestratorState>({
        channels: orchestratorChannels as any,
    })

    // Add router node (uses config for dynamic prompt/schema)
    const routerNode = createRouterNode(config)
    graph.addNode('router', routerNode)

    // Add handler nodes dynamically from config
    for (const tool of config.tools) {
        graph.addNode(`${tool.name}_handler`, tool.handler)
    }

    // Add system nodes
    graph.addNode('combiner', combinerNode)
    graph.addNode('greeting', greetingNodeWrapper)
    graph.addNode('clarification', clarificationNodeWrapper)
    graph.addNode('error_handler', errorNodeWrapper)

    // Edge from START to router
    graph.addEdge(START, 'router')

    // Build routing map for router node
    const routingMap: Record<string, string> = {
        greeting: 'greeting',
        clarification: 'clarification',
        error_handler: 'error_handler',
    }

    // Add each tool handler as a possible route
    for (const tool of config.tools) {
        routingMap[`${tool.name}_handler`] = `${tool.name}_handler`
    }

    // Conditional edges from router
    const routeByIntents = createRouteByIntents(config)
    graph.addConditionalEdges('router', routeByIntents, routingMap)

    // Add conditional edges from each handler to next handler or combiner
    for (let i = 0; i < config.tools.length; i++) {
        const tool = config.tools[i]
        const routeAfterHandler = createRouteAfterHandler(config, i)

        // Build routing map for this handler
        const handlerRoutingMap: Record<string, string> = { combiner: 'combiner' }

        // Add all handlers that could come after this one
        for (let j = i + 1; j < config.tools.length; j++) {
            const nextTool = config.tools[j]
            handlerRoutingMap[`${nextTool.name}_handler`] = `${nextTool.name}_handler`
        }

        graph.addConditionalEdges(
            `${tool.name}_handler`,
            routeAfterHandler,
            handlerRoutingMap
        )
    }

    // Greeting goes to combiner for friendly response
    graph.addEdge('greeting', 'combiner')

    // Terminal nodes
    graph.addEdge('combiner', END)
    graph.addEdge('clarification', END)
    graph.addEdge('error_handler', END)

    // Compile and return
    return graph.compile()
}

// ============================================
// INVOKE HELPER (UPDATED FOR GENERIC CONFIG)
// ============================================

/**
 * Invoke the orchestrator graph with user input
 *
 * @param input - User message
 * @param sessionId - Session identifier
 * @param context - Multi-tenant context
 * @param conversationHistory - Recent conversation history
 * @param config - Orchestrator configuration with tools (NEW)
 * @param options - Additional options
 * @returns Final state with response
 */
export async function invokeOrchestrator(
    input: string,
    sessionId: string,
    context: AgentContext,
    conversationHistory: BaseMessage[] = [],
    config: OrchestratorConfig,
    options: {
        sessionConfig?: SessionConfig
        traceId?: string
        parentTraceId?: string
        graphConfig?: Partial<GraphConfig>
        modelConfig?: ModelConfig
    } = {}
): Promise<OrchestratorState> {
    const graph = createOrchestratorGraph(config, options.graphConfig)
    const loggerTimestamp = Date.now()
    const logger = createAgentLogger({
        agentName: 'graph-orchestrator',
        userName: (context.userName as string) || 'system',
        timestamp: loggerTimestamp,
    })

    await logger.info('GRAPH_ORCHESTRATOR_START', {
        input,
        sessionId,
        userId: context.userId,
        teamId: context.teamId,
        historyLength: conversationHistory.length,
        toolsRegistered: config.tools.map(t => t.name),
    })

    const initialState: OrchestratorState = {
        input,
        sessionId,
        context,
        conversationHistory,
        sessionConfig: options.sessionConfig,
        modelConfig: options.modelConfig,
        intents: [],
        needsClarification: false,
        handlerResults: {},
        completedHandlers: [],
        finalResponse: null,
        error: null,
        traceId: options.traceId,
        parentTraceId: options.parentTraceId,
        loggerTimestamp,
    }

    const result = await graph.invoke(initialState)

    await logger.info('GRAPH_ORCHESTRATOR_END', {
        intents: (result as OrchestratorState).intents,
        completedHandlers: (result as OrchestratorState).completedHandlers,
        hasResponse: !!(result as OrchestratorState).finalResponse,
        error: (result as OrchestratorState).error,
    })

    return result as OrchestratorState
}

// Export types
export type { GraphConfig, OrchestratorConfig }
