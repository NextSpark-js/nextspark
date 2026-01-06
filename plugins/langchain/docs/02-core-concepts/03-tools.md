# Tools

Tools are how agents interact with your data. This guide covers creating, configuring, and best practices for building agent tools.

## What is a Tool?

A tool is a function that an agent can call to perform actions or retrieve data. Tools have:

1. **Name**: Unique identifier for the tool
2. **Description**: Explains when to use the tool (read by the LLM)
3. **Schema**: Zod schema defining input parameters
4. **Function**: Async function that executes the action

```typescript
interface ToolDefinition<T extends z.ZodObject<any>> {
    name: string
    description: string
    schema: T
    func: (input: z.infer<T>) => Promise<string>
}
```

## Creating Tools

### Basic Tool

```typescript
import { z } from 'zod'
import type { ToolDefinition } from '@/contents/plugins/langchain/lib/tools-builder'

const listItemsTool: ToolDefinition<typeof schema> = {
    name: 'list_items',
    description: 'List all items for the current user',
    schema: z.object({
        limit: z.number().optional().default(20).describe('Max items to return'),
    }),
    func: async ({ limit }) => {
        const items = await ItemService.list(userId, { limit })
        return JSON.stringify(items)
    },
}
```

### Tool Factory Pattern

The recommended pattern is to create a factory function that receives context:

```typescript
import { z } from 'zod'
import type { ToolDefinition } from '@/contents/plugins/langchain/lib/tools-builder'

interface ToolContext {
    userId: string
    teamId: string
}

export function createItemTools(context: ToolContext): ToolDefinition<any>[] {
    const { userId, teamId } = context

    return [
        {
            name: 'list_items',
            description: 'List all items for the current user',
            schema: z.object({
                limit: z.number().optional().default(20),
            }),
            func: async ({ limit }) => {
                const items = await ItemService.list(userId, { limit })
                return JSON.stringify(items)
            },
        },
        {
            name: 'create_item',
            description: 'Create a new item',
            schema: z.object({
                name: z.string().describe('Item name'),
                description: z.string().optional().describe('Item description'),
            }),
            func: async (data) => {
                const item = await ItemService.create(userId, { ...data, teamId })
                return JSON.stringify(item)
            },
        },
    ]
}
```

## Zod Schema Best Practices

### Use Descriptive Fields

The `.describe()` method helps the LLM understand parameters:

```typescript
schema: z.object({
    // Good - describes the field purpose
    query: z.string().describe('Search term to match against item names'),

    // Good - explains valid values
    status: z.enum(['active', 'completed', 'archived'])
        .describe('Filter by item status'),

    // Good - explains defaults
    limit: z.number().optional().default(20)
        .describe('Maximum items to return (default: 20)'),
})
```

### Required vs Optional Fields

```typescript
schema: z.object({
    // Required - must be provided
    name: z.string().min(1).describe('Item name (required)'),

    // Optional with default
    priority: z.enum(['low', 'medium', 'high'])
        .optional()
        .default('medium')
        .describe('Priority level'),

    // Optional, truly optional
    notes: z.string().optional().describe('Additional notes'),
})
```

### Common Schema Patterns

```typescript
// Pagination
z.object({
    limit: z.number().optional().default(20),
    offset: z.number().optional().default(0),
})

// Search
z.object({
    query: z.string().min(1).describe('Search query'),
    limit: z.number().optional().default(10),
})

// Entity ID
z.object({
    entityId: z.string().describe('The unique identifier of the entity'),
})

// Date handling
z.object({
    dueDate: z.string().optional().describe('Due date in ISO format (YYYY-MM-DD)'),
})

// Arrays
z.object({
    tags: z.array(z.string()).optional().describe('List of tags'),
    days: z.array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri']))
        .optional()
        .describe('Days of the week'),
})
```

## Real-World Examples

### Task Tools

```typescript
// tools/tasks.ts
import { z } from 'zod'
import { TasksService } from '@/themes/default/entities/tasks/tasks.service'
import type { ToolDefinition } from '@/contents/plugins/langchain/lib/tools-builder'

interface TaskToolContext {
    userId: string
    teamId: string
}

export function createTaskTools(context: TaskToolContext): ToolDefinition<any>[] {
    const { userId, teamId } = context

    return [
        {
            name: 'list_tasks',
            description: 'List tasks with optional filtering by status or priority.',
            schema: z.object({
                status: z.enum(['todo', 'in-progress', 'review', 'done', 'blocked'])
                    .optional()
                    .describe('Filter by task status'),
                priority: z.enum(['low', 'medium', 'high', 'urgent'])
                    .optional()
                    .describe('Filter by priority level'),
            }),
            func: async (params) => {
                try {
                    const result = await TasksService.list(userId, params)
                    return JSON.stringify(result.tasks.map(t => ({
                        id: t.id,
                        title: t.title,
                        status: t.status,
                        priority: t.priority,
                        dueDate: t.dueDate,
                    })), null, 2)
                } catch (error) {
                    return `Error listing tasks: ${error instanceof Error ? error.message : 'Unknown'}`
                }
            },
        },
        {
            name: 'search_tasks',
            description: 'Search tasks by keyword in title or description.',
            schema: z.object({
                query: z.string().describe('Search term'),
            }),
            func: async ({ query }) => {
                try {
                    const result = await TasksService.list(userId, {})
                    const filtered = result.tasks.filter(t =>
                        t.title.toLowerCase().includes(query.toLowerCase()) ||
                        t.description?.toLowerCase().includes(query.toLowerCase())
                    )
                    return JSON.stringify(filtered.map(t => ({
                        id: t.id,
                        title: t.title,
                        status: t.status,
                    })), null, 2)
                } catch (error) {
                    return `Error searching tasks: ${error instanceof Error ? error.message : 'Unknown'}`
                }
            },
        },
        {
            name: 'get_task_details',
            description: 'Get full details of a specific task by ID.',
            schema: z.object({
                taskId: z.string().describe('The task ID to retrieve'),
            }),
            func: async ({ taskId }) => {
                try {
                    const task = await TasksService.getById(taskId, userId)
                    if (!task) {
                        return JSON.stringify({ error: 'Task not found' })
                    }
                    return JSON.stringify(task, null, 2)
                } catch (error) {
                    return `Error getting task: ${error instanceof Error ? error.message : 'Unknown'}`
                }
            },
        },
        {
            name: 'create_task',
            description: 'Create a new task with title and optional details.',
            schema: z.object({
                title: z.string().min(1).describe('Task title (required)'),
                description: z.string().optional().describe('Task description'),
                priority: z.enum(['low', 'medium', 'high'])
                    .optional()
                    .default('medium')
                    .describe('Priority level'),
                dueDate: z.string().optional().describe('Due date (ISO format)'),
            }),
            func: async (data) => {
                try {
                    const task = await TasksService.create(userId, {
                        ...data,
                        teamId,
                        status: 'todo',
                    })
                    return JSON.stringify({
                        success: true,
                        task,
                        message: `Task created: ${task.title}`,
                        link: `/dashboard/tasks/${task.id}`,
                    }, null, 2)
                } catch (error) {
                    return `Error creating task: ${error instanceof Error ? error.message : 'Unknown'}`
                }
            },
        },
        {
            name: 'update_task',
            description: 'Update an existing task. Only specify fields you want to change.',
            schema: z.object({
                taskId: z.string().describe('The task ID to update'),
                title: z.string().optional().describe('New title'),
                description: z.string().optional().describe('New description'),
                status: z.enum(['todo', 'in-progress', 'review', 'done', 'blocked']).optional(),
                priority: z.enum(['low', 'medium', 'high']).optional(),
                dueDate: z.string().optional(),
            }),
            func: async ({ taskId, ...updates }) => {
                try {
                    const task = await TasksService.update(userId, taskId, updates)
                    return JSON.stringify({
                        success: true,
                        task,
                        message: `Task updated: ${task.title}`,
                        link: `/dashboard/tasks/${task.id}`,
                    }, null, 2)
                } catch (error) {
                    return `Error updating task: ${error instanceof Error ? error.message : 'Unknown'}`
                }
            },
        },
    ]
}
```

### Customer Tools

```typescript
// tools/customers.ts
import { z } from 'zod'
import { CustomersService } from '@/themes/default/entities/customers/customers.service'
import type { ToolDefinition } from '@/contents/plugins/langchain/lib/tools-builder'

export function createCustomerTools(context: { userId: string; teamId: string }): ToolDefinition<any>[] {
    const { userId, teamId } = context

    return [
        {
            name: 'list_customers',
            description: 'List all customers with optional pagination and sorting.',
            schema: z.object({
                limit: z.number().optional().default(20).describe('Max customers'),
                offset: z.number().optional().default(0).describe('Pagination offset'),
                orderBy: z.enum(['name', 'account', 'office', 'salesRep', 'createdAt'])
                    .optional()
                    .describe('Sort field'),
                orderDir: z.enum(['asc', 'desc']).optional().describe('Sort direction'),
            }),
            func: async (params) => {
                try {
                    const result = await CustomersService.list(userId, params)
                    return JSON.stringify({
                        customers: result.customers.map(c => ({
                            id: c.id,
                            name: c.name,
                            account: c.account,
                            office: c.office,
                            phone: c.phone,
                        })),
                        total: result.total,
                    }, null, 2)
                } catch (error) {
                    return `Error: ${error instanceof Error ? error.message : 'Unknown'}`
                }
            },
        },
        {
            name: 'search_customers',
            description: 'Search customers by name, account, office, or sales rep.',
            schema: z.object({
                query: z.string().describe('Search term'),
                limit: z.number().optional().default(10),
            }),
            func: async (params) => {
                try {
                    const results = await CustomersService.search(userId, params)
                    return JSON.stringify(results.map(c => ({
                        id: c.id,
                        name: c.name,
                        account: c.account,
                        office: c.office,
                        phone: c.phone,
                    })), null, 2)
                } catch (error) {
                    return `Error: ${error instanceof Error ? error.message : 'Unknown'}`
                }
            },
        },
        {
            name: 'get_customer',
            description: 'Get full details of a specific customer by ID.',
            schema: z.object({
                customerId: z.string().describe('The customer ID to retrieve'),
            }),
            func: async ({ customerId }) => {
                try {
                    const customer = await CustomersService.getById(customerId, userId)
                    if (!customer) {
                        return JSON.stringify({ error: 'Customer not found' })
                    }
                    return JSON.stringify(customer, null, 2)
                } catch (error) {
                    return `Error: ${error instanceof Error ? error.message : 'Unknown'}`
                }
            },
        },
        {
            name: 'create_customer',
            description: 'Create a new customer. Name, account, and office are required.',
            schema: z.object({
                name: z.string().describe('Customer or company name'),
                account: z.number().describe('Unique account number'),
                office: z.string().describe('Office location or branch'),
                phone: z.string().optional().describe('Contact phone number'),
                salesRep: z.string().optional().describe('Assigned sales representative'),
                visitDays: z.array(z.enum(['lun', 'mar', 'mie', 'jue', 'vie']))
                    .optional()
                    .describe('Days for in-person visits'),
                contactDays: z.array(z.enum(['lun', 'mar', 'mie', 'jue', 'vie']))
                    .optional()
                    .describe('Days for phone/email contact'),
            }),
            func: async (data) => {
                try {
                    const customer = await CustomersService.create(userId, {
                        ...data,
                        teamId,
                    })
                    return JSON.stringify({
                        success: true,
                        customer,
                        link: `/dashboard/customers/${customer.id}`,
                    }, null, 2)
                } catch (error) {
                    return `Error: ${error instanceof Error ? error.message : 'Unknown'}`
                }
            },
        },
        {
            name: 'update_customer',
            description: 'Update a customer. Only specify fields to change.',
            schema: z.object({
                customerId: z.string().describe('The customer ID to update'),
                name: z.string().optional(),
                phone: z.string().optional(),
                office: z.string().optional(),
                salesRep: z.string().optional(),
                visitDays: z.array(z.enum(['lun', 'mar', 'mie', 'jue', 'vie']))
                    .optional()
                    .describe('New visit days'),
                contactDays: z.array(z.enum(['lun', 'mar', 'mie', 'jue', 'vie']))
                    .optional()
                    .describe('New contact days'),
            }),
            func: async ({ customerId, ...updates }) => {
                try {
                    const customer = await CustomersService.update(userId, customerId, updates)
                    return JSON.stringify({
                        success: true,
                        customer,
                        link: `/dashboard/customers/${customer.id}`,
                    }, null, 2)
                } catch (error) {
                    return `Error: ${error instanceof Error ? error.message : 'Unknown'}`
                }
            },
        },
        {
            name: 'delete_customer',
            description: 'Delete a customer permanently. This action cannot be undone.',
            schema: z.object({
                customerId: z.string().describe('The customer ID to delete'),
            }),
            func: async ({ customerId }) => {
                try {
                    const success = await CustomersService.delete(userId, customerId)
                    return JSON.stringify({
                        success,
                        message: success ? 'Customer deleted successfully' : 'Failed to delete customer',
                    })
                } catch (error) {
                    return `Error: ${error instanceof Error ? error.message : 'Unknown'}`
                }
            },
        },
    ]
}
```

## Orchestrator Tools

Orchestrator tools are special - they route requests to other agents:

```typescript
// tools/orchestrator.ts
import { z } from 'zod'
import type { ToolDefinition } from '@/contents/plugins/langchain/lib/tools-builder'

export interface RoutingResult {
    agent: 'task' | 'customer' | 'page'
    message: string
}

export interface ClarificationResult {
    action: 'clarify'
    question: string
    options: Array<{ label: string; description: string }>
}

export function createOrchestratorTools(): ToolDefinition<any>[] {
    return [
        {
            name: 'route_to_task',
            description: 'Route to task agent for task-related requests.',
            schema: z.object({
                message: z.string().describe('The user message to forward'),
            }),
            func: async ({ message }) => {
                return JSON.stringify({ agent: 'task', message } as RoutingResult)
            },
        },
        {
            name: 'route_to_customer',
            description: 'Route to customer agent for customer-related requests.',
            schema: z.object({
                message: z.string().describe('The user message to forward'),
            }),
            func: async ({ message }) => {
                return JSON.stringify({ agent: 'customer', message } as RoutingResult)
            },
        },
        {
            name: 'route_to_page',
            description: 'Route to page agent for content/page requests.',
            schema: z.object({
                message: z.string().describe('The user message to forward'),
            }),
            func: async ({ message }) => {
                return JSON.stringify({ agent: 'page', message } as RoutingResult)
            },
        },
        {
            name: 'ask_clarification',
            description: 'Ask user for clarification when intent is unclear.',
            schema: z.object({
                question: z.string().describe('The clarifying question'),
                options: z.array(z.object({
                    label: z.string(),
                    description: z.string(),
                })).describe('Options for the user'),
            }),
            func: async ({ question, options }) => {
                return JSON.stringify({
                    action: 'clarify',
                    question,
                    options,
                } as ClarificationResult)
            },
        },
    ]
}
```

## Building Tools with buildTools

The plugin provides a `buildTools` helper:

```typescript
import { buildTools, type ToolDefinition } from '@/contents/plugins/langchain/lib/tools-builder'

const toolDefinitions: ToolDefinition<any>[] = [
    { name: 'tool1', schema: z.object({}), ... },
    { name: 'tool2', schema: z.object({}), ... },
]

// Convert to LangChain DynamicStructuredTool instances
const langChainTools = buildTools(toolDefinitions)
```

## Tool Response Format

Tools should return JSON strings:

```typescript
// Good - structured response
func: async () => {
    const data = await Service.getData()
    return JSON.stringify(data, null, 2)
}

// Good - with metadata
func: async () => {
    const item = await Service.create(...)
    return JSON.stringify({
        success: true,
        item,
        message: 'Created successfully',
        link: `/items/${item.id}`,
    }, null, 2)
}

// Good - error handling
func: async () => {
    try {
        const data = await Service.getData()
        return JSON.stringify(data)
    } catch (error) {
        return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
}
```

## Error Handling

Always handle errors gracefully:

```typescript
{
    name: 'risky_operation',
    schema: z.object({ id: z.string() }),
    func: async ({ id }) => {
        try {
            const result = await Service.riskyOperation(id)
            return JSON.stringify({ success: true, result })
        } catch (error) {
            // Return error as string - agent can inform user
            if (error instanceof NotFoundError) {
                return JSON.stringify({ error: 'Item not found', id })
            }
            if (error instanceof PermissionError) {
                return JSON.stringify({ error: 'Access denied' })
            }
            return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
    },
}
```

## Security Considerations

### Always Use Context

Tools receive context with user/team IDs - use them:

```typescript
createTools: (context) => [
    {
        func: async (params) => {
            // Use context.userId for RLS
            const data = await Service.list(context.userId, params)
            return JSON.stringify(data)
        },
    },
]
```

### Never Expose Internal IDs

Return only necessary fields:

```typescript
// Bad - exposes internal data
return JSON.stringify(fullDatabaseRecord)

// Good - curated response
return JSON.stringify({
    id: record.id,
    name: record.name,
    // Exclude: internalId, secrets, etc.
})
```

### Validate Before Destructive Actions

```typescript
{
    name: 'delete_item',
    description: 'Delete an item. This action cannot be undone.',
    schema: z.object({
        itemId: z.string(),
        confirm: z.boolean().describe('Must be true to confirm deletion'),
    }),
    func: async ({ itemId, confirm }) => {
        if (!confirm) {
            return JSON.stringify({
                error: 'Deletion not confirmed',
                message: 'Set confirm=true to proceed',
            })
        }
        await Service.delete(itemId)
        return JSON.stringify({ success: true, deleted: itemId })
    },
}
```

## Using Presets

The plugin includes a tools preset:

```bash
cp contents/plugins/langchain/presets/lib/tools/entity-tools.ts.preset \
   contents/themes/your-theme/lib/langchain/tools/my-entity.ts
```

## Next Steps

- [Set up graph orchestration](../03-orchestration/01-graph-orchestrator.md) (recommended)
- [Advanced customization](../05-reference/02-customization.md)
- [Configure observability](../04-advanced/01-observability.md)
