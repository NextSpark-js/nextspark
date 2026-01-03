/**
 * ============================================================================
 * ORCHESTRATOR HANDLER
 * ============================================================================
 *
 * Routes user requests to specialized agents based on intent analysis.
 *
 * TWO MODES:
 * 1. Graph-based (new, efficient) - Uses LangGraph explicit state machine
 *    - 1-2 LLM calls instead of 50+
 *    - No recursion limit issues
 *    - Deterministic execution
 *
 * 2. ReAct-based (legacy) - Uses ReAct loops with sub-agents
 *    - More flexible but slower
 *    - Can hit recursion limits on complex queries
 *
 * Set LANGCHAIN_USE_GRAPH_ORCHESTRATOR=true to enable graph mode.
 *
 * Configuration is centralized in: langchain.config.ts
 *
 * ============================================================================
 */

import { createAgent } from '@/plugins/langchain/lib/agent-factory'
import { invokeOrchestrator as invokeGraphOrchestrator } from '@/plugins/langchain/lib/graph'
import { memoryStore, createHumanMessage, createAIMessage } from '@/plugins/langchain/lib/memory-store'
import { compilePrompt, hasTemplateVariables } from '@/plugins/langchain/lib/prompt-renderer'
import { tracer } from '@/plugins/langchain/lib/tracer'
import type { AgentContext } from '@/plugins/langchain/types/langchain.types'
import type { ModelConfig } from '@/plugins/langchain/lib/graph/types'
import { loadSystemPrompt } from './agents'
import {
    getAgentConfig,
    getAgentModelConfig,
    getAgentTools,
    getAgentSessionConfig,
    getAgentEnrichContext,
    AGENTS,
    observabilityConfig,
} from './langchain.config'
import type { RoutingResult, ClarificationResult } from './tools/orchestrator'
import { orchestratorConfig } from './config'

// ============================================================================
// INITIALIZATION
// ============================================================================

// Initialize tracer with theme's observability config
tracer.init(observabilityConfig.observability)

// Cache for compiled Handlebars templates (performance optimization)
const compiledTemplateCache = new Map<string, (context: AgentContext) => string>()

// Sub-agent types that can be routed to
type AgentType = 'task' | 'customer' | 'page'

// Mapping from routing type to agent name in config
const AGENT_NAME_MAP: Record<AgentType, string> = {
    task: 'task-assistant',
    customer: 'customer-assistant',
    page: 'page-assistant',
}

// Message type from LangChain (simplified for orchestration)
interface AgentMessage {
    _getType(): string
    content: string | unknown
}

/**
 * Context for orchestrator operations
 */
export interface OrchestratorContext {
    userId: string
    teamId: string
    sessionId: string
    /** User display name for logging (e.g., "Carlos García") */
    userName?: string
}

/**
 * Response from the orchestrator
 */
export interface OrchestratorResponse {
    content: string
    sessionId: string
    agentUsed?: 'orchestrator' | AgentType
}

/**
 * Format a clarification question for the user
 */
function formatClarificationQuestion(result: ClarificationResult): string {
    let response = result.question + '\n\n'
    result.options.forEach((opt, i) => {
        response += `${i + 1}. **${opt.label}**: ${opt.description}\n`
    })
    return response
}

/**
 * Parse JSON content to determine routing
 */
function parseRoutingDecision(content: string): RoutingResult | ClarificationResult | null {
    try {
        const parsed = JSON.parse(content)

        // Check if it's a clarification request
        if (parsed.action === 'clarify') {
            return parsed as ClarificationResult
        }

        // Check if it's a routing decision
        if (parsed.agent && ['task', 'customer', 'page'].includes(parsed.agent)) {
            return parsed as RoutingResult
        }

        return null
    } catch {
        // Not a JSON response
        return null
    }
}

/**
 * Extract routing decision from the LATEST turn only
 *
 * IMPORTANT: We only look at messages from the current turn (after the last human message)
 * to avoid picking up stale routing decisions from conversation history.
 *
 * @param messages - Full message array from agent
 * @returns Routing decision if found in current turn, null otherwise
 */
function extractRoutingFromMessages(messages: AgentMessage[]): RoutingResult | ClarificationResult | null {
    // Find the index of the last human message (start of current turn)
    let lastHumanIndex = -1
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i]._getType() === 'human') {
            lastHumanIndex = i
            break
        }
    }

    // Only search for tool results AFTER the last human message (current turn)
    for (let i = messages.length - 1; i > lastHumanIndex; i--) {
        const msg = messages[i]
        if (msg._getType() === 'tool') {
            const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
            const decision = parseRoutingDecision(content)
            if (decision) {
                return decision
            }
        }
    }
    return null
}

/**
 * Parse routing from AI text output (fallback for models that don't call tools properly)
 */
function parseRoutingFromAIText(content: string): RoutingResult | null {
    const routeMatch = content.match(/route_to_(task|customer|page)\s*\(\s*\{[^}]*"message"\s*:\s*"([^"]+)"/)
    if (routeMatch) {
        return {
            agent: routeMatch[1] as AgentType,
            message: routeMatch[2],
        }
    }
    return null
}

/**
 * Get system prompt for an agent
 * Handles both inline prompts and file-based prompts
 * Renders Handlebars templates with context data
 * Uses compiled template cache for performance
 */
function getSystemPromptForAgent(agentName: string, context?: AgentContext): string {
    const agentConfig = getAgentConfig(agentName)
    if (!agentConfig?.systemPrompt) {
        throw new Error(`No system prompt configured for agent: ${agentName}`)
    }

    // Check cache first for compiled template
    let compiledFn = compiledTemplateCache.get(agentName)

    if (!compiledFn) {
        let template: string

        // If it's an inline prompt (contains newlines), use directly
        if (agentConfig.systemPrompt.includes('\n')) {
            template = agentConfig.systemPrompt
        } else {
            // Otherwise load from .md file
            template = loadSystemPrompt(agentConfig.systemPrompt as any)
        }

        // Only compile if template has Handlebars syntax
        if (hasTemplateVariables(template)) {
            compiledFn = compilePrompt(template)
            compiledTemplateCache.set(agentName, compiledFn)
        } else {
            // No template variables, return as-is
            return template
        }
    }

    // Render template with context if provided
    if (context && compiledFn) {
        return compiledFn(context)
    }

    // Fallback: return raw template if no context
    const rawTemplate = agentConfig.systemPrompt.includes('\n')
        ? agentConfig.systemPrompt
        : loadSystemPrompt(agentConfig.systemPrompt as any)
    return rawTemplate
}

/**
 * Invoke a specialized sub-agent
 *
 * CONTEXT INHERITANCE: If parentContext is provided (from orchestrator),
 * it will be merged with sub-agent's enriched data to avoid duplicate queries.
 *
 * @param agentType - The type of agent to invoke
 * @param message - The message to process
 * @param context - Base orchestrator context
 * @param parentContext - Optional pre-enriched context from parent (orchestrator)
 * @param parentId - Optional parent trace ID for observability linking
 */
async function invokeSubAgent(
    agentType: AgentType,
    message: string,
    context: OrchestratorContext,
    parentContext?: AgentContext,
    parentId?: string
): Promise<OrchestratorResponse> {
    const { userId, teamId, sessionId } = context
    const agentName = AGENT_NAME_MAP[agentType]

    // Start with parent context if available, otherwise build base
    let agentContext: AgentContext = parentContext
        ? { ...parentContext }
        : { userId, teamId }

    // Only enrich if not already enriched by parent OR if agent has specific enrichment
    const enrichContext = getAgentEnrichContext(agentName)
    if (enrichContext) {
        // Check if already enriched by parent
        const isAlreadyEnriched = parentContext?.__enriched === true

        if (!isAlreadyEnriched) {
            // First-time enrichment
            agentContext = await enrichContext(agentContext)
            agentContext.__enriched = true
        } else {
            // Parent already enriched - only add agent-specific data
            // Merge parent context with any agent-specific additions
            const agentSpecificContext = await enrichContext({ userId, teamId })
            agentContext = {
                ...agentContext,
                ...agentSpecificContext,
                // Keep the enriched flag and core fields
                userId,
                teamId,
                __enriched: true,
            }
        }
    }

    // Get session config for memory customization
    const sessionConfig = getAgentSessionConfig(agentName)

    const agent = await createAgent({
        sessionId: `${sessionId}-${agentType}`,
        agentName,
        systemPrompt: getSystemPromptForAgent(agentName, agentContext),
        tools: getAgentTools(agentName, agentContext),
        modelConfig: getAgentModelConfig(agentName),
        context: agentContext,
        sessionConfig,
        parentId, // Link to orchestrator's trace for observability
    })

    const response = await agent.chat(message)

    return {
        content: response.content,
        sessionId,
        agentUsed: agentType,
    }
}

/**
 * Process a message through the orchestrator
 *
 * The orchestrator:
 * 1. Analyzes the user's request
 * 2. Determines which agent should handle it (or asks for clarification)
 * 3. Routes to the appropriate specialized agent
 * 4. Returns the response
 *
 * @param message - The user's message
 * @param context - User and session context
 * @returns The response from the appropriate agent
 */
export async function processWithOrchestrator(
    message: string,
    context: OrchestratorContext
): Promise<OrchestratorResponse> {
    const { userId, teamId, sessionId } = context

    try {
        // Build base context for orchestrator
        let orchestratorContext: AgentContext = { userId, teamId }

        // Enrich context with runtime data if enrichContext is defined
        const enrichContext = getAgentEnrichContext('orchestrator')
        if (enrichContext) {
            orchestratorContext = await enrichContext(orchestratorContext)
            // Mark as enriched to avoid duplicate enrichment in sub-agents
            orchestratorContext.__enriched = true
        }

        // Get session config for memory customization
        const sessionConfig = getAgentSessionConfig('orchestrator')

        // Step 1: Create orchestrator agent to determine routing
        const orchestratorAgent = await createAgent({
            sessionId: `${sessionId}-orchestrator`,
            agentName: 'orchestrator',
            systemPrompt: getSystemPromptForAgent('orchestrator', orchestratorContext),
            tools: getAgentTools('orchestrator', orchestratorContext),
            modelConfig: getAgentModelConfig('orchestrator'),
            context: orchestratorContext,
            sessionConfig,
        })

        // Step 2: Get routing decision from orchestrator
        const routingResponse = await orchestratorAgent.chat(message)
        const orchestratorTraceId = routingResponse.traceId // Capture for parent-child linking

        // Step 3: Extract routing decision from tool results in messages
        let decision = extractRoutingFromMessages(routingResponse.messages || [])

        // Fallback: If no tool was called, try to parse the AI's text output
        if (!decision && typeof routingResponse.content === 'string') {
            decision = parseRoutingFromAIText(routingResponse.content)
        }

        if (!decision) {
            // Orchestrator responded directly (e.g., greeting, meta-question)
            return {
                content: routingResponse.content,
                sessionId,
                agentUsed: 'orchestrator',
            }
        }

        // Step 4: Handle clarification requests
        if ('action' in decision && decision.action === 'clarify') {
            return {
                content: formatClarificationQuestion(decision),
                sessionId,
                agentUsed: 'orchestrator',
            }
        }

        // Step 5: Route to specialized agent with inherited context
        if ('agent' in decision) {
            return await invokeSubAgent(
                decision.agent,
                decision.message || message,
                context,
                orchestratorContext, // Pass enriched context to avoid duplicate queries
                orchestratorTraceId  // Pass trace ID for parent-child linking
            )
        }

        // Fallback: return orchestrator's response
        return {
            content: routingResponse.content,
            sessionId,
            agentUsed: 'orchestrator',
        }
    } catch (error) {
        throw new Error(
            error instanceof Error ? error.message : 'Failed to process message'
        )
    }
}

// ============================================================================
// GRAPH-BASED ORCHESTRATOR (NEW - EFFICIENT)
// ============================================================================

/**
 * Check if graph-based orchestrator is enabled
 */
function isGraphOrchestratorEnabled(): boolean {
    return process.env.LANGCHAIN_USE_GRAPH_ORCHESTRATOR === 'true'
}

/**
 * Process a message using the graph-based orchestrator
 *
 * BENEFITS:
 * - 1-2 LLM calls instead of 50+
 * - No recursion limit issues
 * - Deterministic execution
 * - Parallel handler execution for multi-intent queries
 *
 * @param message - The user's message
 * @param context - User and session context
 * @returns The response
 */
async function processWithGraphOrchestratorInternal(
    message: string,
    context: OrchestratorContext
): Promise<OrchestratorResponse> {
    const { userId, teamId, sessionId, userName } = context
    const agentContext: AgentContext = { userId, teamId, userName }

    // Start trace for observability
    const traceContext = await tracer.startTrace(
        { userId, teamId },
        'graph-orchestrator',
        message,
        {
            sessionId,
            agentType: 'graph-orchestrator',
            metadata: {
                orchestratorType: 'langgraph',
                version: '1.0',
            },
            tags: ['graph', 'orchestrator'],
        }
    )

    const startTime = Date.now()
    let llmCalls = 0
    let toolCalls = 0

    try {
        // Get conversation history from memory store
        const conversationHistory = await memoryStore.getMessages(
            `${sessionId}-orchestrator`,
            agentContext
        )

        // Get model config for router
        const orchestratorModelConfig = getAgentModelConfig('orchestrator')
        const modelConfig: ModelConfig = {
            provider: orchestratorModelConfig?.provider || 'openai',
            model: orchestratorModelConfig?.model,
            temperature: 0.1, // Low temperature for consistent routing
        }

        // Invoke the graph with orchestrator configuration (tools registered by theme)
        const result = await invokeGraphOrchestrator(
            message,
            sessionId,
            agentContext,
            conversationHistory.slice(-5), // Last 5 messages for context
            orchestratorConfig, // Pass config instead of individual handlers
            {
                traceId: traceContext?.traceId,
                modelConfig,
            }
        )

        // Count LLM calls based on what was executed
        // Router always uses 1 LLM call
        llmCalls = 1
        // Combiner uses 1 LLM call if there were multiple intents or handlers
        const handlersExecuted = result.completedHandlers?.length || 0
        if (handlersExecuted > 1 || (handlersExecuted === 1 && result.intents?.length > 1)) {
            llmCalls = 2
        }
        // Tool calls = number of handlers executed (task, customer, page operations)
        toolCalls = handlersExecuted

        // Save the interaction to memory
        await memoryStore.addMessages(
            `${sessionId}-orchestrator`,
            [
                createHumanMessage(message),
                createAIMessage(result.finalResponse || 'No response generated'),
            ],
            agentContext
        )

        // End trace with success
        if (traceContext) {
            await tracer.endTrace(
                { userId, teamId },
                traceContext.traceId,
                {
                    output: result.finalResponse || '',
                    llmCalls,
                    toolCalls,
                    metadata: {
                        durationMs: Date.now() - startTime,
                        intentsDetected: result.intents?.length || 0,
                        handlersExecuted: result.completedHandlers || [],
                        hadClarification: result.needsClarification || false,
                    },
                }
            )
        }

        return {
            content: result.finalResponse || 'I was unable to process your request.',
            sessionId,
            agentUsed: 'orchestrator',
        }
    } catch (error) {
        console.error('[GraphOrchestrator] Error:', error)

        // End trace with error
        if (traceContext) {
            await tracer.endTrace(
                { userId, teamId },
                traceContext.traceId,
                {
                    error: error instanceof Error ? error : new Error(String(error)),
                    llmCalls,
                    toolCalls,
                    metadata: {
                        durationMs: Date.now() - startTime,
                    },
                }
            )
        }

        throw new Error(
            error instanceof Error ? error.message : 'Failed to process message with graph orchestrator'
        )
    }
}

/**
 * Unified entry point - uses graph or ReAct based on feature flag
 *
 * @param message - The user's message
 * @param context - User and session context
 * @returns The response from the appropriate agent
 */
export async function processMessage(
    message: string,
    context: OrchestratorContext
): Promise<OrchestratorResponse> {
    if (isGraphOrchestratorEnabled()) {
        console.log('[Orchestrator] Using graph-based orchestrator')
        return processWithGraphOrchestratorInternal(message, context)
    }

    // Fallback to legacy ReAct-based orchestrator
    return processWithOrchestrator(message, context)
}
