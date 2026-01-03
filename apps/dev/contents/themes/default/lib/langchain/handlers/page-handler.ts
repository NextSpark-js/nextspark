/**
 * Page Handler Node
 *
 * Executes page operations directly without additional LLM calls.
 * Uses the PagesService to perform read operations.
 */

import { PagesService } from '@/themes/default/entities/pages/pages.service'
import { config as pluginConfig } from '@/plugins/langchain/plugin.config'
import { createAgentLogger } from '@/plugins/langchain/lib/logger'
import type { OrchestratorState, PageHandlerResult, PageData, IntentType } from '@/plugins/langchain/lib/graph/types'

/**
 * Transform Page entity to PageData for handler result
 */
function toPageData(page: any): PageData {
    return {
        id: page.id,
        title: page.title,
        slug: page.slug,
        status: page.status,
        locale: page.locale,
    }
}

/**
 * Execute page operation based on intent
 */
async function executePageOperation(
    action: string,
    parameters: Record<string, unknown>,
    context: { userId: string; teamId: string }
): Promise<PageHandlerResult> {
    const { userId } = context

    try {
        switch (action) {
            case 'list': {
                const locale = (parameters.locale as string) || 'en'
                const { pages, total } = await PagesService.listPublished({
                    locale,
                    limit: 50,
                    orderBy: 'createdAt',
                    orderDir: 'desc',
                })

                return {
                    success: true,
                    operation: 'list',
                    data: pages.map(toPageData),
                    count: total,
                    message: `Found ${total} published page(s)`,
                }
            }

            case 'get': {
                const id = parameters.id as string
                const slug = parameters.slug as string

                if (slug) {
                    const locale = (parameters.locale as string) || 'en'
                    const page = await PagesService.getPublishedBySlug(slug, locale)
                    if (!page) {
                        return {
                            success: false,
                            operation: 'get',
                            data: null,
                            message: `Page with slug "${slug}" not found`,
                            error: 'Page not found',
                        }
                    }
                    return {
                        success: true,
                        operation: 'get',
                        data: toPageData(page),
                        message: `Found page: ${page.title}`,
                    }
                }

                if (id) {
                    const page = await PagesService.getById(id, userId)
                    if (!page) {
                        return {
                            success: false,
                            operation: 'get',
                            data: null,
                            message: 'Page not found',
                            error: 'Page not found',
                        }
                    }
                    return {
                        success: true,
                        operation: 'get',
                        data: toPageData(page),
                        message: `Found page: ${page.title}`,
                    }
                }

                return {
                    success: false,
                    operation: 'get',
                    data: null,
                    message: 'Page ID or slug is required',
                    error: 'Missing page identifier',
                }
            }

            case 'search': {
                // Pages don't have a search method, so list and filter
                const query = (parameters.query as string)?.toLowerCase()
                const locale = (parameters.locale as string) || 'en'

                const { pages } = await PagesService.listPublished({
                    locale,
                    limit: 100,
                })

                let filteredPages = pages
                if (query) {
                    filteredPages = pages.filter(
                        (p) =>
                            p.title.toLowerCase().includes(query) ||
                            p.slug.toLowerCase().includes(query)
                    )
                }

                return {
                    success: true,
                    operation: 'search',
                    data: filteredPages.map(toPageData),
                    count: filteredPages.length,
                    message: `Found ${filteredPages.length} page(s) matching "${query}"`,
                }
            }

            case 'create':
            case 'update':
            case 'delete':
                // These operations are not supported through the AI agent
                return {
                    success: false,
                    operation: action as any,
                    data: null,
                    message: `Page ${action} is not supported through the AI assistant. Please use the page builder.`,
                    error: 'Operation not supported',
                }

            default:
                return {
                    success: false,
                    operation: 'unknown',
                    data: null,
                    message: `Unknown action: ${action}`,
                    error: `Unsupported action: ${action}`,
                }
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return {
            success: false,
            operation: action as any,
            data: null,
            message: `Failed to execute ${action}: ${errorMessage}`,
            error: errorMessage,
        }
    }
}

/**
 * Page handler node
 *
 * Executes page operations without additional LLM calls.
 * Returns JSON result for combiner to format.
 */
export async function pageHandlerNode(
    state: OrchestratorState
): Promise<Partial<OrchestratorState>> {
    const { context, loggerTimestamp } = state
    const logger = createAgentLogger({
        agentName: 'graph-orchestrator',
        userName: (context.userName as string) || 'system',
        timestamp: loggerTimestamp,
    })

    // Find page intent
    const pageIntent = state.intents.find((i) => i.type === 'page')

    if (!pageIntent) {
        // No page intent, skip
        return {
            completedHandlers: [...state.completedHandlers, 'page' as IntentType],
        }
    }

    await logger.info('PAGE_HANDLER_INPUT', {
        action: pageIntent.action,
        parameters: pageIntent.parameters,
    })

    if (pluginConfig.debug) {
        console.log('[PageHandler] Executing:', pageIntent.action, pageIntent.parameters)
    }

    const result = await executePageOperation(
        pageIntent.action,
        pageIntent.parameters,
        {
            userId: state.context.userId,
            teamId: state.context.teamId as string,
        }
    )

    await logger.info('PAGE_HANDLER_OUTPUT', {
        success: result.success,
        operation: result.operation,
        message: result.message,
        count: result.count,
        data: result.data,
    })

    if (pluginConfig.debug) {
        console.log('[PageHandler] Result:', result.success, result.message)
    }

    return {
        handlerResults: {
            ...state.handlerResults,
            page: result,
        },
        completedHandlers: [...state.completedHandlers, 'page' as IntentType],
    }
}
