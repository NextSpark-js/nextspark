/**
 * Router Node (GENERIC - Theme-Agnostic)
 *
 * Classifies user intents using structured output.
 * Single LLM call that parses intent type, action, and parameters.
 * Includes retry logic with Zod validation for local model compatibility.
 *
 * GENERIC ARCHITECTURE:
 * - Schema and prompt are generated dynamically from OrchestratorConfig
 * - No hardcoded knowledge of specific entities (task, customer, page)
 * - Theme configures available tools via config
 */

import { z } from 'zod'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import type { BaseMessage } from '@langchain/core/messages'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { getModel, getStructuredOutputMethod } from '../../providers'
import { tracer } from '../../tracer'
import { config as pluginConfig } from '../../../plugin.config'
import type { OrchestratorState, Intent, IntentType, IntentAction, OrchestratorConfig } from '../types'
import { DEFAULT_GRAPH_CONFIG } from '../types'

// ============================================
// CONFIGURATION
// ============================================

const ROUTER_CONFIG = {
    maxRetries: 3,
    retryDelayMs: 500,
}

// ============================================
// DYNAMIC SCHEMA GENERATION
// ============================================

/**
 * Create Zod schema dynamically from orchestrator config
 */
function createIntentSchema(config: OrchestratorConfig) {
    const toolNames = config.tools.map(t => t.name)
    const systemIntents = config.systemIntents || ['greeting', 'clarification']
    const allIntentTypes = [...toolNames, ...systemIntents]

    // Create description for intent types
    const toolDescriptions = config.tools
        .map(t => `${t.name} for ${t.description}`)
        .join(', ')
    const systemDescriptions = systemIntents
        .map(s => s === 'greeting' ? 'greeting for hello/hi' : 'clarification if unclear')
        .join(', ')

    const IntentSchema = z.object({
        type: z.enum(allIntentTypes as [string, ...string[]]).describe(
            `The type of intent: ${toolDescriptions}, ${systemDescriptions}`
        ),
        action: z.enum(['list', 'create', 'update', 'delete', 'search', 'get', 'unknown']).describe(
            'The action to perform on the entity'
        ),
        parameters: z.record(z.string(), z.unknown()).describe(
            'Extracted parameters like title, priority, query, name, etc.'
        ),
        originalText: z.string().describe(
            'The portion of the user message that maps to this intent'
        ),
    })

    const RouterOutputSchema = z.object({
        intents: z.array(IntentSchema).describe(
            'All intents extracted from the user message. Include multiple if user asks for multiple things.'
        ),
        needsClarification: z.boolean().describe(
            'True if the request is too vague to understand'
        ),
        clarificationQuestion: z.string().nullable().describe(
            'Question to ask user if clarification is needed, in their language. Null if not needed.'
        ),
    })

    return RouterOutputSchema
}

type RouterOutput = {
    intents: Array<{
        type: string
        action: IntentAction
        parameters: Record<string, unknown>
        originalText: string
    }>
    needsClarification: boolean
    clarificationQuestion: string | null
}

// ============================================
// RETRY HELPERS
// ============================================

/**
 * Extract JSON from a string that might contain markdown or extra text
 */
function extractJsonFromResponse(text: string): string {
    // Try to find JSON in markdown code block
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlockMatch) {
        return codeBlockMatch[1].trim()
    }

    // Try to find raw JSON object
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
        return jsonMatch[0]
    }

    return text
}

/**
 * Validate and parse router output with Zod
 * Returns null if validation fails
 */
function validateRouterOutput(data: unknown, schema: z.ZodSchema): RouterOutput | null {
    try {
        return schema.parse(data) as RouterOutput
    } catch (error) {
        if (pluginConfig.debug) {
            console.log('[Router] Zod validation failed:', error)
        }
        return null
    }
}

/**
 * Attempt to invoke the model with structured output
 * Returns the validated output or null on failure
 */
async function tryStructuredOutput(
    model: BaseChatModel,
    messages: BaseMessage[],
    method: 'functionCalling' | 'jsonMode' | 'jsonSchema',
    schema: z.ZodSchema
): Promise<RouterOutput | null> {
    try {
        const structuredModel = model.withStructuredOutput(schema, {
            name: 'extract_intents',
            method,
        })
        const result = await structuredModel.invoke(messages)
        return validateRouterOutput(result, schema)
    } catch (error) {
        if (pluginConfig.debug) {
            console.log('[Router] Structured output failed:', error)
        }
        return null
    }
}

/**
 * Fallback: invoke model without structured output and parse JSON manually
 */
async function tryManualJsonParsing(
    model: BaseChatModel,
    messages: BaseMessage[],
    schema: z.ZodSchema
): Promise<RouterOutput | null> {
    try {
        const result = await model.invoke(messages)
        const content = typeof result.content === 'string'
            ? result.content
            : JSON.stringify(result.content)

        const jsonStr = extractJsonFromResponse(content)
        const parsed = JSON.parse(jsonStr)
        return validateRouterOutput(parsed, schema)
    } catch (error) {
        if (pluginConfig.debug) {
            console.log('[Router] Manual JSON parsing failed:', error)
        }
        return null
    }
}

/**
 * Invoke router with retry logic
 * Tries structured output first, then falls back to manual parsing
 */
async function invokeRouterWithRetry(
    model: BaseChatModel,
    messages: BaseMessage[],
    structuredOutputMethod: 'functionCalling' | 'jsonMode' | 'jsonSchema',
    schema: z.ZodSchema
): Promise<RouterOutput> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= ROUTER_CONFIG.maxRetries; attempt++) {
        if (pluginConfig.debug && attempt > 1) {
            console.log(`[Router] Retry attempt ${attempt}/${ROUTER_CONFIG.maxRetries}`)
        }

        // Try structured output first
        const structuredResult = await tryStructuredOutput(model, messages, structuredOutputMethod, schema)
        if (structuredResult) {
            if (pluginConfig.debug && attempt > 1) {
                console.log('[Router] Succeeded on retry with structured output')
            }
            return structuredResult
        }

        // Fallback to manual JSON parsing
        if (pluginConfig.debug) {
            console.log('[Router] Falling back to manual JSON parsing')
        }
        const manualResult = await tryManualJsonParsing(model, messages, schema)
        if (manualResult) {
            if (pluginConfig.debug) {
                console.log('[Router] Succeeded with manual JSON parsing')
            }
            return manualResult
        }

        // Wait before retry (exponential backoff)
        if (attempt < ROUTER_CONFIG.maxRetries) {
            const delay = ROUTER_CONFIG.retryDelayMs * Math.pow(2, attempt - 1)
            await new Promise((resolve) => setTimeout(resolve, delay))
        }
    }

    // All retries failed - throw error
    throw lastError || new Error('Router failed after all retry attempts')
}

// ============================================
// DYNAMIC PROMPT GENERATION
// ============================================

/**
 * Generate router prompt dynamically from orchestrator config
 */
function createRouterPrompt(config: OrchestratorConfig): string {
    const toolNames = config.tools.map(t => t.name)
    const systemIntents = config.systemIntents || ['greeting', 'clarification']

    // Build intent types section
    const intentTypesSection = [
        ...config.tools.map(tool => `- ${tool.name}: ${tool.description}`),
        ...systemIntents.map(intent =>
            intent === 'greeting' ? '- greeting: Greeting or small talk' : '- clarification: Request is too vague to understand'
        )
    ].join('\n')

    // Build parameter examples section
    const parameterExamplesSection = config.tools
        .filter(t => t.exampleParameters)
        .map(t => `- ${t.name}: ${t.exampleParameters}`)
        .join('\n')

    // Build type union for JSON format
    const typeUnion = [...toolNames, ...systemIntents].map(t => `"${t}"`).join(' | ')

    // Build examples dynamically from first tool (if available)
    const exampleTool = config.tools[0]
    const examplePrompts = exampleTool ? `
User: "Show me my ${exampleTool.name}s"
Response: {"intents": [{"type": "${exampleTool.name}", "action": "list", "parameters": {}, "originalText": "Show me my ${exampleTool.name}s"}], "needsClarification": false}

User: "Create ${exampleTool.name} 'Example' high priority"
Response: {"intents": [{"type": "${exampleTool.name}", "action": "create", "parameters": {"title": "Example", "priority": "high"}, "originalText": "Create ${exampleTool.name} 'Example' high priority"}], "needsClarification": false}
` : ''

    const multiToolExample = config.tools.length >= 2 ? `
User: "Show my ${config.tools[0].name}s and find ${config.tools[1].name} data"
Response: {"intents": [{"type": "${config.tools[0].name}", "action": "list", "parameters": {}, "originalText": "Show my ${config.tools[0].name}s"}, {"type": "${config.tools[1].name}", "action": "search", "parameters": {"query": "data"}, "originalText": "find ${config.tools[1].name} data"}], "needsClarification": false}
` : ''

    return `You are an intent classifier for a multi-agent system. Your job is to analyze user messages and extract ALL intents.

IMPORTANT: You MUST respond with valid JSON only. No additional text or explanation.

## Intent Types
${intentTypesSection}

## Rules
1. Extract ALL intents if user asks for multiple things
2. Be specific with parameters (title, priority, query, etc.)
3. Preserve user's language for clarification questions
4. Use clarification only when truly unclear
5. Map originalText to the relevant portion of the message

## Parameter Examples
${parameterExamplesSection}

## JSON Output Format
{
  "intents": [
    {
      "type": ${typeUnion},
      "action": "list" | "create" | "update" | "delete" | "search" | "get" | "unknown",
      "parameters": {},
      "originalText": "portion of user message"
    }
  ],
  "needsClarification": false,
  "clarificationQuestion": null
}

## Examples
${examplePrompts}${multiToolExample}
User: "Hola"
Response: {"intents": [{"type": "greeting", "action": "unknown", "parameters": {}, "originalText": "Hola"}], "needsClarification": false}

${config.routerPromptExtras || ''}`
}

// ============================================
// ROUTER NODE FACTORY (GENERIC)
// ============================================

/**
 * Create router node with configuration
 *
 * Uses structured output for reliable JSON extraction.
 * Single LLM call replaces multiple ReAct iterations.
 *
 * @param config - Orchestrator configuration with tools
 * @returns Router node function
 */
export function createRouterNode(config: OrchestratorConfig) {
    // Generate schema and prompt from config (done once at graph creation)
    const RouterOutputSchema = createIntentSchema(config)
    const routerPrompt = createRouterPrompt(config)

    // Return the router node function
    return async function routerNode(
        state: OrchestratorState
    ): Promise<Partial<OrchestratorState>> {
        const { context, traceId, modelConfig } = state

        // Use model config from state (injected by theme)
        // Fallback to defaults if not provided
        const modelCfg = modelConfig || {
            provider: 'openai',
            model: undefined,
            temperature: DEFAULT_GRAPH_CONFIG.routerTemperature,
        }

        // Start span for router with provider/model info
        const spanContext = traceId
            ? await tracer.startSpan(
                  { userId: context.userId, teamId: context.teamId },
                  traceId,
                  {
                      name: 'router',
                      type: 'llm',
                      provider: modelCfg.provider,
                      model: modelCfg.model,
                      input: { message: state.input },
                  }
              )
            : null

        try {
            // Get model with orchestrator's provider and low temperature for consistent classification
            const model = getModel(modelCfg)

            // Automatically detect the best structured output method for the provider
            // (jsonSchema for LM Studio, functionCalling for OpenAI/Anthropic/Ollama)
            const structuredOutputMethod = getStructuredOutputMethod(modelCfg)

            // Build messages with recent conversation context
            const recentHistory = state.conversationHistory.slice(-DEFAULT_GRAPH_CONFIG.maxHistoryMessages)

            const messages = [
                new SystemMessage(routerPrompt),
                ...recentHistory,
                new HumanMessage(state.input),
            ]

            // Log in debug mode
            if (pluginConfig.debug) {
                console.log('[Router] Classifying intent for:', state.input)
            }

            // Invoke with retry logic and Zod validation
            const result = await invokeRouterWithRetry(model, messages, structuredOutputMethod, RouterOutputSchema)

            if (pluginConfig.debug) {
                console.log('[Router] Classified intents:', JSON.stringify(result.intents, null, 2))
            }

            // Transform to our Intent type
            const intents: Intent[] = result.intents.map((intent) => ({
                type: intent.type as IntentType,
                action: intent.action as IntentAction,
                parameters: intent.parameters as Record<string, unknown>,
                originalText: intent.originalText,
            }))

            // End span with success
            if (spanContext && traceId) {
                await tracer.endSpan(
                    { userId: context.userId, teamId: context.teamId },
                    traceId,
                    spanContext.spanId,
                    {
                        output: {
                            intentsCount: intents.length,
                            intents: intents.map((i) => ({ type: i.type, action: i.action })),
                            needsClarification: result.needsClarification,
                        },
                    }
                )
            }

            return {
                intents,
                needsClarification: result.needsClarification,
                clarificationQuestion: result.clarificationQuestion ?? undefined,
            }
        } catch (error) {
            console.error('[Router] Error classifying intent:', error)

            // End span with error
            if (spanContext && traceId) {
                await tracer.endSpan(
                    { userId: context.userId, teamId: context.teamId },
                    traceId,
                    spanContext.spanId,
                    { error: error instanceof Error ? error : new Error(String(error)) }
                )
            }

            return {
                intents: [],
                needsClarification: true,
                clarificationQuestion:
                    'I encountered an error understanding your request. Could you please rephrase it?',
                error: error instanceof Error ? error.message : 'Router classification failed',
            }
        }
    }
}
