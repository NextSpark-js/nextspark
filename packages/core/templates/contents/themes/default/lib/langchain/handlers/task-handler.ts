/**
 * Task Handler Node
 *
 * Executes task operations directly without additional LLM calls.
 * Uses the TasksService to perform CRUD operations.
 */

import { TasksService } from '@/themes/default/entities/tasks/tasks.service'
import { tracer } from '@/plugins/langchain/lib/tracer'
import { config as pluginConfig } from '@/plugins/langchain/plugin.config'
import { createAgentLogger } from '@/plugins/langchain/lib/logger'
import type { OrchestratorState, TaskHandlerResult, TaskData, IntentType } from '@/plugins/langchain/lib/graph/types'

/**
 * Map priority strings to valid values
 */
function normalizePriority(priority?: unknown): 'low' | 'medium' | 'high' | 'urgent' | undefined {
    if (!priority) return undefined
    const p = String(priority).toLowerCase()
    if (['low', 'medium', 'high', 'urgent'].includes(p)) {
        return p as 'low' | 'medium' | 'high' | 'urgent'
    }
    return undefined
}

/**
 * Map status strings to valid values
 */
function normalizeStatus(status?: unknown): 'todo' | 'in-progress' | 'review' | 'done' | 'blocked' | undefined {
    if (!status) return undefined
    const s = String(status).toLowerCase().replace(/[_-]/g, '-')
    if (s === 'pending' || s === 'todo') return 'todo'
    if (s === 'in-progress' || s === 'inprogress') return 'in-progress'
    if (s === 'review') return 'review'
    if (s === 'done' || s === 'completed' || s === 'complete') return 'done'
    if (s === 'blocked') return 'blocked'
    return undefined
}

/**
 * Transform Task entity to TaskData for handler result
 */
function toTaskData(task: any): TaskData {
    return {
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        description: task.description,
    }
}

/**
 * Execute task operation based on intent
 */
async function executeTaskOperation(
    action: string,
    parameters: Record<string, unknown>,
    context: { userId: string; teamId: string }
): Promise<TaskHandlerResult> {
    const { userId, teamId } = context

    try {
        switch (action) {
            case 'list': {
                const priority = normalizePriority(parameters.priority)
                const status = normalizeStatus(parameters.status)

                const { tasks, total } = await TasksService.list(userId, {
                    priority,
                    status,
                    teamId,
                    limit: 50,
                    orderBy: 'createdAt',
                    orderDir: 'desc',
                })

                return {
                    success: true,
                    operation: 'list',
                    data: tasks.map(toTaskData),
                    count: total,
                    message: `Found ${total} task(s)`,
                }
            }

            case 'get': {
                const id = parameters.id as string
                if (!id) {
                    return {
                        success: false,
                        operation: 'get',
                        data: null,
                        message: 'Task ID is required',
                        error: 'Missing task ID',
                    }
                }

                const task = await TasksService.getById(id, userId)
                if (!task) {
                    return {
                        success: false,
                        operation: 'get',
                        data: null,
                        message: 'Task not found',
                        error: 'Task not found',
                    }
                }

                return {
                    success: true,
                    operation: 'get',
                    data: toTaskData(task),
                    message: `Found task: ${task.title}`,
                }
            }

            case 'create': {
                const title = parameters.title as string
                if (!title) {
                    return {
                        success: false,
                        operation: 'create',
                        data: null,
                        message: 'Task title is required',
                        error: 'Missing title',
                    }
                }

                const task = await TasksService.create(userId, {
                    title,
                    description: parameters.description as string | undefined,
                    priority: normalizePriority(parameters.priority) || 'medium',
                    status: normalizeStatus(parameters.status) || 'todo',
                    dueDate: parameters.dueDate as string | undefined,
                    teamId,
                })

                return {
                    success: true,
                    operation: 'create',
                    data: toTaskData(task),
                    message: `Created task: ${task.title}`,
                }
            }

            case 'update': {
                const id = parameters.id as string
                if (!id) {
                    return {
                        success: false,
                        operation: 'update',
                        data: null,
                        message: 'Task ID is required',
                        error: 'Missing task ID',
                    }
                }

                const updateData: Record<string, unknown> = {}
                if (parameters.title) updateData.title = parameters.title
                if (parameters.description !== undefined) updateData.description = parameters.description
                if (parameters.priority) updateData.priority = normalizePriority(parameters.priority)
                if (parameters.status) updateData.status = normalizeStatus(parameters.status)
                if (parameters.dueDate) updateData.dueDate = parameters.dueDate

                const task = await TasksService.update(userId, id, updateData)

                return {
                    success: true,
                    operation: 'update',
                    data: toTaskData(task),
                    message: `Updated task: ${task.title}`,
                }
            }

            case 'search': {
                // For tasks, search is similar to list with filters
                const query = parameters.query as string
                const priority = normalizePriority(parameters.priority)
                const status = normalizeStatus(parameters.status)

                const { tasks, total } = await TasksService.list(userId, {
                    priority,
                    status,
                    teamId,
                    limit: 20,
                })

                // Filter by query if provided (title contains)
                let filteredTasks = tasks
                if (query) {
                    const lowerQuery = query.toLowerCase()
                    filteredTasks = tasks.filter(
                        (t) =>
                            t.title.toLowerCase().includes(lowerQuery) ||
                            t.description?.toLowerCase().includes(lowerQuery)
                    )
                }

                return {
                    success: true,
                    operation: 'search',
                    data: filteredTasks.map(toTaskData),
                    count: filteredTasks.length,
                    message: `Found ${filteredTasks.length} matching task(s)`,
                }
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
 * Task handler node
 *
 * Executes task operations without additional LLM calls.
 * Returns JSON result for combiner to format.
 */
export async function taskHandlerNode(
    state: OrchestratorState
): Promise<Partial<OrchestratorState>> {
    const { context, traceId, loggerTimestamp } = state
    const logger = createAgentLogger({
        agentName: 'graph-orchestrator',
        userName: (context.userName as string) || 'system',
        timestamp: loggerTimestamp,
    })

    // Find task intent
    const taskIntent = state.intents.find((i) => i.type === 'task')

    if (!taskIntent) {
        // No task intent, skip
        return {
            completedHandlers: [...state.completedHandlers, 'task' as IntentType],
        }
    }

    // Start span for task handler
    const spanContext = traceId
        ? await tracer.startSpan(
              { userId: context.userId, teamId: context.teamId },
              traceId,
              {
                  name: 'task-handler',
                  type: 'tool',
                  toolName: `task_${taskIntent.action}`,
                  input: taskIntent.parameters,
              }
          )
        : null

    await logger.info('TASK_HANDLER_INPUT', {
        action: taskIntent.action,
        parameters: taskIntent.parameters,
    })

    if (pluginConfig.debug) {
        console.log('[TaskHandler] Executing:', taskIntent.action, taskIntent.parameters)
    }

    const result = await executeTaskOperation(
        taskIntent.action,
        taskIntent.parameters,
        {
            userId: state.context.userId,
            teamId: state.context.teamId as string,
        }
    )

    await logger.info('TASK_HANDLER_OUTPUT', {
        success: result.success,
        operation: result.operation,
        message: result.message,
        count: result.count,
        data: result.data,
    })

    if (pluginConfig.debug) {
        console.log('[TaskHandler] Result:', result.success, result.message)
    }

    // End span
    if (spanContext && traceId) {
        await tracer.endSpan(
            { userId: context.userId, teamId: context.teamId },
            traceId,
            spanContext.spanId,
            {
                output: { success: result.success, message: result.message, count: result.count },
                toolInput: taskIntent.parameters,
                toolOutput: result,
                error: result.error ? new Error(result.error) : undefined,
            }
        )
    }

    return {
        handlerResults: {
            ...state.handlerResults,
            task: result,
        },
        completedHandlers: [...state.completedHandlers, 'task' as IntentType],
    }
}
