/**
 * Combiner Node
 *
 * Converts JSON handler results into natural language response.
 * Single LLM call that synthesizes all results for the user.
 *
 * Optimization: For single-intent operations, can generate response
 * without LLM by using template-based formatting.
 */

import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { getModel } from '../../providers'
import { tracer } from '../../tracer'
import { config as pluginConfig } from '../../../plugin.config'
import type { OrchestratorState, HandlerResults } from '../types'
import { DEFAULT_GRAPH_CONFIG } from '../types'

// ============================================
// COMBINER PROMPT
// ============================================

const COMBINER_SYSTEM_PROMPT = `You are a response synthesizer that converts JSON operation results into natural language responses for users.

## Your Task

Given the original user request and the results from various operations, generate a clear, natural response that:
1. Summarizes ALL results
2. Uses the same language as the user (Spanish if they wrote in Spanish)
3. Is concise but complete
4. Includes relevant data (names, counts, specific values)

## Input Format

You receive JSON with:
- originalRequest: The user's original message
- results: Object containing handler results (task, customer, page)

Each result contains:
- success: Whether the operation succeeded
- operation: What was done (list, create, update, search, etc.)
- data: The actual data (array or single object)
- count: Number of items (for list/search)
- message: Technical description
- error: Error message if failed

## Output Format

Return ONLY the response text. No JSON, no markdown code blocks, just natural text.

## Rules

1. Match the user's language - If they wrote in Spanish, respond in Spanish
2. Be concise - Don't repeat unnecessary information
3. Format lists nicely - Use bullet points for multiple items (max 5-7 items, summarize if more)
4. Include key data - Account numbers, task titles, counts, specific fields requested
5. Handle errors gracefully - Explain what went wrong and offer alternatives
6. Don't expose technical details - No JSON, no error codes, no internal messages
7. For greetings, be friendly and mention what you can help with`

// ============================================
// TEMPLATE-BASED FORMATTERS (No LLM needed)
// ============================================

/**
 * Check if we can use template-based response (single, simple result)
 */
function canUseTemplateResponse(results: HandlerResults): boolean {
    const resultCount = Object.keys(results).filter((k) => results[k as keyof HandlerResults]).length

    // Only use templates for single results
    if (resultCount !== 1) return false

    // Check if it's a simple operation
    const result = results.task || results.customer || results.page
    if (!result) return false

    // Only list/search with small data sets can use templates
    if (result.operation === 'list' || result.operation === 'search') {
        const data = Array.isArray(result.data) ? result.data : []
        return data.length <= 5
    }

    // Single item operations (get, create, update) can use templates
    return ['get', 'create', 'update', 'delete'].includes(result.operation)
}

/**
 * Generate template-based response for tasks
 */
function formatTaskResponse(result: HandlerResults['task'], isSpanish: boolean): string {
    if (!result) return ''

    if (!result.success) {
        return isSpanish
            ? `No pude completar la operación: ${result.message}`
            : `I couldn't complete the operation: ${result.message}`
    }

    const { operation, data, count } = result

    if (operation === 'list' || operation === 'search') {
        const tasks = Array.isArray(data) ? data : []
        if (tasks.length === 0) {
            return isSpanish ? 'No se encontraron tareas.' : 'No tasks found.'
        }

        const header = isSpanish
            ? `Encontré ${count || tasks.length} tarea(s):`
            : `Found ${count || tasks.length} task(s):`

        const items = tasks
            .slice(0, 5)
            .map((t) => {
                const priority = t.priority ? ` (${t.priority})` : ''
                const status = t.status ? ` - ${t.status}` : ''
                return `• ${t.title}${priority}${status}`
            })
            .join('\n')

        const more = tasks.length > 5
            ? (isSpanish ? `\n... y ${tasks.length - 5} más` : `\n... and ${tasks.length - 5} more`)
            : ''

        return `${header}\n${items}${more}`
    }

    if (operation === 'create') {
        const task = Array.isArray(data) ? data[0] : data
        return isSpanish
            ? `Tarea creada: "${task?.title}"`
            : `Task created: "${task?.title}"`
    }

    if (operation === 'update') {
        const task = Array.isArray(data) ? data[0] : data
        return isSpanish
            ? `Tarea actualizada: "${task?.title}"`
            : `Task updated: "${task?.title}"`
    }

    if (operation === 'get') {
        const task = Array.isArray(data) ? data[0] : data
        if (!task) {
            return isSpanish ? 'Tarea no encontrada.' : 'Task not found.'
        }
        return isSpanish
            ? `Tarea: "${task.title}" - ${task.status || 'sin estado'}, prioridad ${task.priority || 'media'}`
            : `Task: "${task.title}" - ${task.status || 'no status'}, ${task.priority || 'medium'} priority`
    }

    return result.message
}

/**
 * Generate template-based response for customers
 */
function formatCustomerResponse(result: HandlerResults['customer'], isSpanish: boolean): string {
    if (!result) return ''

    if (!result.success) {
        return isSpanish
            ? `No pude completar la operación: ${result.message}`
            : `I couldn't complete the operation: ${result.message}`
    }

    const { operation, data, count } = result

    if (operation === 'search') {
        const customers = Array.isArray(data) ? data : []
        if (customers.length === 0) {
            return isSpanish
                ? 'No se encontraron clientes con ese criterio.'
                : 'No customers found matching that criteria.'
        }

        // For search, often looking for specific info
        if (customers.length === 1) {
            const c = customers[0]
            const info = []
            if (c.accountNumber) info.push(isSpanish ? `Cuenta: ${c.accountNumber}` : `Account: ${c.accountNumber}`)
            if (c.phone) info.push(isSpanish ? `Tel: ${c.phone}` : `Phone: ${c.phone}`)
            if (c.office) info.push(isSpanish ? `Oficina: ${c.office}` : `Office: ${c.office}`)

            return `${c.name}${info.length ? ' - ' + info.join(', ') : ''}`
        }

        const header = isSpanish
            ? `Encontré ${count || customers.length} cliente(s):`
            : `Found ${count || customers.length} customer(s):`

        const items = customers
            .slice(0, 5)
            .map((c) => `• ${c.name}${c.accountNumber ? ` (${c.accountNumber})` : ''}`)
            .join('\n')

        return `${header}\n${items}`
    }

    if (operation === 'list') {
        const customers = Array.isArray(data) ? data : []
        if (customers.length === 0) {
            return isSpanish ? 'No hay clientes registrados.' : 'No customers registered.'
        }

        const header = isSpanish
            ? `Hay ${count || customers.length} cliente(s):`
            : `There are ${count || customers.length} customer(s):`

        const items = customers
            .slice(0, 5)
            .map((c) => `• ${c.name}`)
            .join('\n')

        const more = customers.length > 5
            ? (isSpanish ? `\n... y ${customers.length - 5} más` : `\n... and ${customers.length - 5} more`)
            : ''

        return `${header}\n${items}${more}`
    }

    if (operation === 'create') {
        const customer = Array.isArray(data) ? data[0] : data
        return isSpanish
            ? `Cliente creado: "${customer?.name}"`
            : `Customer created: "${customer?.name}"`
    }

    return result.message
}

/**
 * Detect if input is in Spanish
 */
function isSpanishInput(input: string): boolean {
    const spanishIndicators = [
        'hola', 'muéstrame', 'muestrame', 'mis', 'tareas', 'clientes',
        'crear', 'buscar', 'encontrar', 'cuál', 'cual', 'qué', 'que',
        'número', 'numero', 'cuenta', 'por favor', 'gracias', 'dame'
    ]
    const lower = input.toLowerCase()
    return spanishIndicators.some((word) => lower.includes(word))
}

// ============================================
// COMBINER NODE
// ============================================

/**
 * Combiner node that synthesizes handler results into user response
 *
 * Optimization: Uses template-based responses for simple single operations,
 * falls back to LLM for complex multi-result scenarios.
 */
export async function combinerNode(
    state: OrchestratorState
): Promise<Partial<OrchestratorState>> {
    const { context, traceId, input, handlerResults, intents, needsClarification, clarificationQuestion } = state

    // Handle clarification (already has response)
    if (needsClarification && clarificationQuestion) {
        return { finalResponse: clarificationQuestion }
    }

    // Handle greeting
    if (intents.length === 1 && intents[0].type === 'greeting') {
        const isSpanish = isSpanishInput(input)
        const greeting = isSpanish
            ? '¡Hola! ¿En qué puedo ayudarte? Puedo gestionar tareas, buscar clientes o consultar páginas.'
            : 'Hello! How can I help you? I can manage tasks, search customers, or look up pages.'
        return { finalResponse: greeting }
    }

    // Check if empty results
    const hasResults = Object.values(handlerResults).some((r) => r !== undefined)
    if (!hasResults) {
        const isSpanish = isSpanishInput(input)
        return {
            finalResponse: isSpanish
                ? 'No pude procesar tu solicitud. ¿Podrías ser más específico?'
                : "I couldn't process your request. Could you be more specific?",
        }
    }

    const isSpanish = isSpanishInput(input)

    // Try template-based response for simple cases
    if (canUseTemplateResponse(handlerResults)) {
        if (pluginConfig.debug) {
            console.log('[Combiner] Using template-based response')
        }

        let response = ''

        if (handlerResults.task) {
            response = formatTaskResponse(handlerResults.task, isSpanish)
        } else if (handlerResults.customer) {
            response = formatCustomerResponse(handlerResults.customer, isSpanish)
        } else if (handlerResults.page) {
            // Simple page response
            const pageResult = handlerResults.page
            if (pageResult.success) {
                const pages = Array.isArray(pageResult.data) ? pageResult.data : [pageResult.data].filter(Boolean)
                response = isSpanish
                    ? `Encontré ${pages.length} página(s): ${pages.map((p) => p?.title).join(', ')}`
                    : `Found ${pages.length} page(s): ${pages.map((p) => p?.title).join(', ')}`
            } else {
                response = pageResult.message
            }
        }

        return { finalResponse: response }
    }

    // Use LLM for complex multi-result scenarios
    if (pluginConfig.debug) {
        console.log('[Combiner] Using LLM for multi-result response')
    }

    // Combiner uses OpenAI GPT-4o-mini (fast and cost-effective)
    // Uses real OpenAI API when LANGCHAIN_OPENAI_BASE_URL is not set,
    // or LM Studio when it is set
    const combinerModelConfig = {
        provider: 'openai' as const,
        model: 'gpt-4o-mini',
        temperature: DEFAULT_GRAPH_CONFIG.combinerTemperature,
    }

    // Start span for combiner LLM call with provider/model info
    const spanContext = traceId
        ? await tracer.startSpan(
              { userId: context.userId, teamId: context.teamId },
              traceId,
              {
                  name: 'combiner',
                  type: 'llm',
                  provider: combinerModelConfig.provider,
                  model: combinerModelConfig.model,
                  input: { resultsCount: Object.keys(handlerResults).length },
              }
          )
        : null

    try {
        // Use OpenAI GPT-4o-mini for combining results (fast and cost-effective)
        const model = getModel(combinerModelConfig)

        const combinerInput = JSON.stringify({
            originalRequest: input,
            results: handlerResults,
        }, null, 2)

        const result = await model.invoke([
            new SystemMessage(COMBINER_SYSTEM_PROMPT),
            new HumanMessage(combinerInput),
        ])

        const response = typeof result.content === 'string'
            ? result.content
            : JSON.stringify(result.content)

        if (pluginConfig.debug) {
            console.log('[Combiner] Generated response:', response.substring(0, 100) + '...')
        }

        // End span with success
        if (spanContext && traceId) {
            await tracer.endSpan(
                { userId: context.userId, teamId: context.teamId },
                traceId,
                spanContext.spanId,
                {
                    output: { responseLength: response.length },
                }
            )
        }

        return { finalResponse: response }
    } catch (error) {
        console.error('[Combiner] Error generating response:', error)

        // End span with error
        if (spanContext && traceId) {
            await tracer.endSpan(
                { userId: context.userId, teamId: context.teamId },
                traceId,
                spanContext.spanId,
                { error: error instanceof Error ? error : new Error(String(error)) }
            )
        }

        const isSpanish = isSpanishInput(state.input)
        return {
            finalResponse: isSpanish
                ? 'Ocurrió un error al procesar la respuesta. Por favor, intenta de nuevo.'
                : 'An error occurred while processing the response. Please try again.',
            error: error instanceof Error ? error.message : 'Combiner error',
        }
    }
}
