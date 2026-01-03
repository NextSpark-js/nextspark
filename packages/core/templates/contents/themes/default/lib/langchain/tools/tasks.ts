import { z } from 'zod'
import { ToolDefinition } from '@/plugins/langchain/lib/tools-builder'
import { TasksService } from '@/themes/default/entities/tasks/tasks.service'
import { TaskStatus, TaskPriority } from '@/themes/default/entities/tasks/tasks.types'

/**
 * Tool context for task operations
 */
export interface TaskToolContext {
    userId: string
    teamId: string
}

/**
 * Create task management tools for the AI agent
 *
 * @param context - User and team context for RLS
 * @returns Array of task-related tool definitions
 *
 * @example
 * ```typescript
 * const tools = createTaskTools({ userId: 'user-123', teamId: 'team-456' })
 * const agent = await createAgent({
 *     systemPrompt: loadSystemPrompt('task-assistant'),
 *     tools,
 * })
 * ```
 */
export function createTaskTools(context: TaskToolContext): ToolDefinition<any>[] {
    const { userId, teamId } = context

    return [
        {
            name: 'list_tasks',
            description: 'List all tasks assigned to the user. Optionally filter by status and/or priority.',
            schema: z.object({
                status: z.enum(['todo', 'in-progress', 'review', 'done', 'blocked'])
                    .optional()
                    .describe('Filter tasks by status'),
                priority: z.enum(['low', 'medium', 'high', 'urgent'])
                    .optional()
                    .describe('Filter tasks by priority level'),
            }),
            func: async ({ status, priority }) => {
                try {
                    const result = await TasksService.list(userId, {
                        status: status as TaskStatus,
                        limit: 50,
                        teamId,
                    })
                    // Filter by priority if specified
                    let tasks = result.tasks
                    if (priority) {
                        tasks = tasks.filter(t => t.priority === priority)
                    }
                    return JSON.stringify(tasks.map(t => ({
                        id: t.id,
                        title: t.title,
                        status: t.status,
                        priority: t.priority,
                        dueDate: t.dueDate,
                    })), null, 2)
                } catch (error) {
                    return `Error listing tasks: ${error instanceof Error ? error.message : 'Unknown error'}`
                }
            },
        },
        {
            name: 'search_tasks',
            description: 'Search tasks by keyword in title or description.',
            schema: z.object({
                query: z.string().describe('Search keyword'),
            }),
            func: async ({ query }) => {
                try {
                    const result = await TasksService.list(userId, { limit: 100, teamId })
                    const filtered = result.tasks.filter(t =>
                        t.title.toLowerCase().includes(query.toLowerCase()) ||
                        t.description?.toLowerCase().includes(query.toLowerCase())
                    )
                    return JSON.stringify(filtered.slice(0, 10).map(t => ({
                        id: t.id,
                        title: t.title,
                        status: t.status,
                        priority: t.priority,
                    })), null, 2)
                } catch (error) {
                    return `Error searching tasks: ${error instanceof Error ? error.message : 'Unknown error'}`
                }
            },
        },
        {
            name: 'get_task_details',
            description: 'Get full details of a specific task by ID.',
            schema: z.object({
                taskId: z.string().describe('The task ID'),
            }),
            func: async ({ taskId }) => {
                try {
                    const task = await TasksService.getById(taskId, userId)
                    if (!task) {
                        return JSON.stringify({ error: 'Task not found' })
                    }
                    return JSON.stringify(task, null, 2)
                } catch (error) {
                    return `Error getting task: ${error instanceof Error ? error.message : 'Unknown error'}`
                }
            },
        },
        {
            name: 'create_task',
            description: 'Create a new task.',
            schema: z.object({
                title: z.string().describe('Task title'),
                description: z.string().optional().describe('Task description'),
                priority: z.enum(['low', 'medium', 'high'])
                    .optional()
                    .default('medium')
                    .describe('Task priority'),
                dueDate: z.string().optional().describe('Due date in ISO format (YYYY-MM-DD)'),
            }),
            func: async (data) => {
                try {
                    const task = await TasksService.create(userId, {
                        title: data.title,
                        description: data.description,
                        priority: data.priority as TaskPriority,
                        dueDate: data.dueDate,
                        status: 'todo' as TaskStatus,
                        teamId,
                    })
                    return JSON.stringify(task, null, 2)
                } catch (error) {
                    return `Error creating task: ${error instanceof Error ? error.message : 'Unknown error'}`
                }
            },
        },
        {
            name: 'update_task',
            description: 'Update an existing task.',
            schema: z.object({
                taskId: z.string().describe('The task ID to update'),
                title: z.string().optional().describe('New title'),
                description: z.string().optional().describe('New description'),
                status: z.enum(['todo', 'in-progress', 'review', 'done', 'blocked'])
                    .optional()
                    .describe('New status'),
                priority: z.enum(['low', 'medium', 'high'])
                    .optional()
                    .describe('New priority'),
                dueDate: z.string().optional().describe('New due date in ISO format'),
            }),
            func: async ({ taskId, ...updates }) => {
                try {
                    const task = await TasksService.update(userId, taskId, {
                        ...updates,
                        status: updates.status as TaskStatus,
                        priority: updates.priority as TaskPriority,
                    })
                    return JSON.stringify(task, null, 2)
                } catch (error) {
                    return `Error updating task: ${error instanceof Error ? error.message : 'Unknown error'}`
                }
            },
        },
    ]
}
