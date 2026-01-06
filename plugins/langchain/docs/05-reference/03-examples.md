# Examples

Real-world implementation examples from the default theme. These examples demonstrate complete working implementations that you can adapt for your own themes.

## Example 1: Task Management Agent

A complete task management agent with CRUD operations.

### Configuration

```typescript
// langchain.config.ts
'task-assistant': {
    provider: 'ollama',
    temperature: 0.3,
    description: 'Specialized agent for task management',
    systemPrompt: 'task-assistant',
    createTools: (context: ToolContext) => createTaskTools(context),
},
```

### System Prompt

```markdown
<!-- agents/task-assistant.md -->
You are a task management AI assistant for the Boilerplate application.

## CRITICAL RULE - MUST FOLLOW

**YOU MUST ALWAYS USE TOOLS TO GET DATA. NEVER FABRICATE OR IMAGINE TASK INFORMATION.**

Before responding with ANY task information, you MUST:
1. Call the appropriate tool (list_tasks, search_tasks, get_task_details)
2. Wait for the tool result
3. ONLY THEN respond based on the REAL data from the tool

If a tool returns an error or empty results, tell the user honestly - NEVER make up fake tasks.

## Your Capabilities
- List, search, and view tasks (using tools)
- Create new tasks with title, description, priority, and due dates
- Update existing tasks (status, priority, details)
- Suggest ideas, recipes, lists, or content to ADD to tasks when asked

## Handling Suggestions + Task Updates

When the user asks you to "suggest X for task Y" or "add recommendations to task":
1. First, find the task using search_tasks or get_task_details
2. Generate your suggestions (recipes, ideas, items, etc.) using your knowledge
3. Update the task with the suggestions using update_task
4. Confirm what you added

## Available Tools - USE THEM

| Tool | When to use |
|------|-------------|
| **list_tasks** | User asks to see tasks, pending items, todo list |
| **search_tasks** | User wants to find specific tasks by keyword |
| **get_task_details** | User asks about a specific task |
| **create_task** | User wants to create a new task |
| **update_task** | User wants to modify an existing task |

## Response Format
- Use Spanish when the user writes in Spanish, English when they write in English
- Be concise but helpful
- Use bullet points for task lists
- When a task is created or updated, provide a link: [Task Title](/dashboard/tasks/{id})
- If no tasks found, say so honestly - don't invent them

## What NOT to do
- NEVER respond with example/fake tasks like "Task 1: Description..."
- NEVER imagine what tasks the user might have
- NEVER skip calling tools before responding about tasks
```

### Tools Implementation

```typescript
// tools/tasks.ts
import { z } from 'zod'
import { TasksService } from '@/themes/default/entities/tasks/tasks.service'
import type { ToolDefinition } from '@/contents/plugins/langchain/lib/tools-builder'

export interface TaskToolContext {
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
                    if (result.tasks.length === 0) {
                        return JSON.stringify({
                            message: 'No tasks found',
                            tasks: [],
                        })
                    }
                    return JSON.stringify(result.tasks.map(t => ({
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
                query: z.string().describe('Search term to match against task fields'),
            }),
            func: async ({ query }) => {
                try {
                    const result = await TasksService.list(userId, {})
                    const filtered = result.tasks.filter(t =>
                        t.title.toLowerCase().includes(query.toLowerCase()) ||
                        t.description?.toLowerCase().includes(query.toLowerCase())
                    )
                    if (filtered.length === 0) {
                        return JSON.stringify({
                            message: `No tasks found matching "${query}"`,
                            tasks: [],
                        })
                    }
                    return JSON.stringify(filtered.map(t => ({
                        id: t.id,
                        title: t.title,
                        status: t.status,
                        description: t.description?.substring(0, 100),
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
                taskId: z.string().describe('The task ID to retrieve'),
            }),
            func: async ({ taskId }) => {
                try {
                    const task = await TasksService.getById(taskId, userId)
                    if (!task) {
                        return JSON.stringify({ error: 'Task not found', taskId })
                    }
                    return JSON.stringify(task, null, 2)
                } catch (error) {
                    return `Error getting task: ${error instanceof Error ? error.message : 'Unknown error'}`
                }
            },
        },
        {
            name: 'create_task',
            description: 'Create a new task with title and optional details.',
            schema: z.object({
                title: z.string().min(1).describe('Task title (required)'),
                description: z.string().optional().describe('Detailed description'),
                priority: z.enum(['low', 'medium', 'high'])
                    .optional()
                    .default('medium')
                    .describe('Priority level'),
                dueDate: z.string().optional().describe('Due date in ISO format (YYYY-MM-DD)'),
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
                        task: {
                            id: task.id,
                            title: task.title,
                            status: task.status,
                            priority: task.priority,
                        },
                        message: `Task "${task.title}" created successfully`,
                        link: `/dashboard/tasks/${task.id}`,
                    }, null, 2)
                } catch (error) {
                    return `Error creating task: ${error instanceof Error ? error.message : 'Unknown error'}`
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
                status: z.enum(['todo', 'in-progress', 'review', 'done', 'blocked']).optional().describe('New status'),
                priority: z.enum(['low', 'medium', 'high']).optional().describe('New priority'),
                dueDate: z.string().optional().describe('New due date (ISO format)'),
            }),
            func: async ({ taskId, ...updates }) => {
                try {
                    // Filter out undefined values
                    const cleanUpdates = Object.fromEntries(
                        Object.entries(updates).filter(([_, v]) => v !== undefined)
                    )

                    if (Object.keys(cleanUpdates).length === 0) {
                        return JSON.stringify({ error: 'No fields to update provided' })
                    }

                    const task = await TasksService.update(userId, taskId, cleanUpdates)
                    return JSON.stringify({
                        success: true,
                        task: {
                            id: task.id,
                            title: task.title,
                            status: task.status,
                        },
                        message: `Task "${task.title}" updated successfully`,
                        link: `/dashboard/tasks/${task.id}`,
                    }, null, 2)
                } catch (error) {
                    return `Error updating task: ${error instanceof Error ? error.message : 'Unknown error'}`
                }
            },
        },
    ]
}
```

### Usage

```typescript
import { createAgent } from '@/contents/plugins/langchain/lib/agent-factory'
import { loadSystemPrompt } from './agents'
import { getAgentModelConfig, getAgentTools } from './langchain.config'

// Create agent
const taskAgent = await createAgent({
    sessionId: `user-${userId}-task-session`,
    systemPrompt: loadSystemPrompt('task-assistant'),
    tools: getAgentTools('task-assistant', { userId, teamId }),
    modelConfig: getAgentModelConfig('task-assistant'),
    context: { userId, teamId },
})

// Example conversations
await taskAgent.chat('Show me my pending tasks')
// Calls list_tasks, returns formatted list

await taskAgent.chat('Create a task to review the quarterly report')
// Calls create_task, returns success with link

await taskAgent.chat('Mark the report task as in progress')
// Calls search_tasks → update_task
```

---

## Example 2: Customer Search and Update

A customer management agent with contextual updates.

### Configuration

```typescript
'customer-assistant': {
    provider: 'ollama',
    temperature: 0.3,
    description: 'Specialized agent for customer management',
    systemPrompt: 'customer-assistant',
    createTools: (context: ToolContext) => createCustomerTools(context),
},
```

### Tools Implementation

```typescript
// tools/customers.ts
import { z } from 'zod'
import { CustomersService } from '@/themes/default/entities/customers/customers.service'
import type { DayOfWeek } from '@/themes/default/entities/customers/customers.types'

export function createCustomerTools(context: { userId: string; teamId: string }) {
    const { userId, teamId } = context

    return [
        {
            name: 'list_customers',
            description: 'List all customers with optional pagination and sorting.',
            schema: z.object({
                limit: z.number().optional().default(20).describe('Max customers to return'),
                offset: z.number().optional().default(0).describe('Offset for pagination'),
                orderBy: z.enum(['name', 'account', 'office', 'salesRep', 'createdAt'])
                    .optional()
                    .describe('Field to order by'),
                orderDir: z.enum(['asc', 'desc'])
                    .optional()
                    .describe('Order direction'),
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
                            salesRep: c.salesRep,
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
            description: 'Search customers by name, account number, office, or sales representative.',
            schema: z.object({
                query: z.string().describe('Search term'),
                limit: z.number().optional().default(10).describe('Max results'),
            }),
            func: async (params) => {
                try {
                    const results = await CustomersService.search(userId, params)
                    if (results.length === 0) {
                        return JSON.stringify({
                            message: `No customers found matching "${params.query}"`,
                            customers: [],
                        })
                    }
                    return JSON.stringify(results.map(c => ({
                        id: c.id,
                        name: c.name,
                        account: c.account,
                        office: c.office,
                        salesRep: c.salesRep,
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
            name: 'update_customer',
            description: 'Update an existing customer. Only specify fields you want to change.',
            schema: z.object({
                customerId: z.string().describe('The customer ID to update'),
                name: z.string().optional().describe('New customer name'),
                account: z.number().optional().describe('New account number'),
                office: z.string().optional().describe('New office location'),
                phone: z.string().optional().describe('New phone number'),
                salesRep: z.string().optional().describe('New sales representative'),
                visitDays: z.array(z.enum(['lun', 'mar', 'mie', 'jue', 'vie']))
                    .optional()
                    .describe('New visit days'),
                contactDays: z.array(z.enum(['lun', 'mar', 'mie', 'jue', 'vie']))
                    .optional()
                    .describe('New contact days'),
            }),
            func: async ({ customerId, ...updates }) => {
                try {
                    const customer = await CustomersService.update(userId, customerId, {
                        ...updates,
                        visitDays: updates.visitDays as DayOfWeek[] | undefined,
                        contactDays: updates.contactDays as DayOfWeek[] | undefined,
                    })
                    return JSON.stringify({
                        success: true,
                        customer: {
                            id: customer.id,
                            name: customer.name,
                            phone: customer.phone,
                        },
                        message: `Customer "${customer.name}" updated successfully`,
                        link: `/dashboard/customers/${customer.id}`,
                    }, null, 2)
                } catch (error) {
                    return `Error: ${error instanceof Error ? error.message : 'Unknown'}`
                }
            },
        },
    ]
}
```

### Example Conversation

```
User: "Dime el teléfono de StartupXYZ"
Agent: *calls search_customers with query "StartupXYZ"*
       "El teléfono de StartupXYZ es +1 512 555 0102.
        Ver detalles: [StartupXYZ](/dashboard/customers/customer-002)"

User: "Modificalo, su nuevo teléfono es +1 457 45465245"
Agent: *calls update_customer with customerId="customer-002" and phone="+1 457 45465245"*
       "He actualizado el teléfono de StartupXYZ a +1 457 45465245.
        [StartupXYZ](/dashboard/customers/customer-002)"
```

---

## Example 3: Multi-Agent Orchestration

Complete orchestrator implementation with routing.

### Orchestrator Handler

```typescript
// orchestrator.ts
import { createAgent } from '@/contents/plugins/langchain/lib/agent-factory'
import { loadSystemPrompt } from './agents'
import {
    getAgentConfig,
    getAgentModelConfig,
    getAgentTools,
} from './langchain.config'
import type { RoutingResult, ClarificationResult } from './tools/orchestrator'

type AgentType = 'task' | 'customer' | 'page'

const AGENT_NAME_MAP: Record<AgentType, string> = {
    task: 'task-assistant',
    customer: 'customer-assistant',
    page: 'page-assistant',
}

interface AgentMessage {
    _getType(): string
    content: string | unknown
}

export interface OrchestratorContext {
    userId: string
    teamId: string
    sessionId: string
}

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
        if (parsed.action === 'clarify') return parsed as ClarificationResult
        if (parsed.agent && ['task', 'customer', 'page'].includes(parsed.agent)) {
            return parsed as RoutingResult
        }
        return null
    } catch {
        return null
    }
}

/**
 * Extract routing decision from the LATEST turn only
 */
function extractRoutingFromMessages(messages: AgentMessage[]): RoutingResult | ClarificationResult | null {
    // Find last human message
    let lastHumanIndex = -1
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i]._getType() === 'human') {
            lastHumanIndex = i
            break
        }
    }

    // Search for tool results AFTER last human message
    for (let i = messages.length - 1; i > lastHumanIndex; i--) {
        const msg = messages[i]
        if (msg._getType() === 'tool') {
            const content = typeof msg.content === 'string'
                ? msg.content
                : JSON.stringify(msg.content)
            const decision = parseRoutingDecision(content)
            if (decision) return decision
        }
    }
    return null
}

/**
 * Get system prompt for an agent
 */
function getSystemPromptForAgent(agentName: string): string {
    const config = getAgentConfig(agentName)
    if (!config?.systemPrompt) {
        throw new Error(`No system prompt for agent: ${agentName}`)
    }
    if (config.systemPrompt.includes('\n')) {
        return config.systemPrompt
    }
    return loadSystemPrompt(config.systemPrompt as any)
}

/**
 * Invoke a specialized sub-agent
 */
async function invokeSubAgent(
    agentType: AgentType,
    message: string,
    context: OrchestratorContext
): Promise<OrchestratorResponse> {
    const { userId, teamId, sessionId } = context
    const agentName = AGENT_NAME_MAP[agentType]

    const agent = await createAgent({
        sessionId: `${sessionId}-${agentType}`,
        systemPrompt: getSystemPromptForAgent(agentName),
        tools: getAgentTools(agentName, { userId, teamId }),
        modelConfig: getAgentModelConfig(agentName),
        context: { userId, teamId },
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
 */
export async function processWithOrchestrator(
    message: string,
    context: OrchestratorContext
): Promise<OrchestratorResponse> {
    const { userId, teamId, sessionId } = context

    try {
        // Create orchestrator agent
        const orchestratorAgent = await createAgent({
            sessionId: `${sessionId}-orchestrator`,
            systemPrompt: getSystemPromptForAgent('orchestrator'),
            tools: getAgentTools('orchestrator', { userId, teamId }),
            modelConfig: getAgentModelConfig('orchestrator'),
            context: { userId, teamId },
        })

        // Get routing decision
        const routingResponse = await orchestratorAgent.chat(message)

        // Extract routing from tool results
        const decision = extractRoutingFromMessages(routingResponse.messages || [])

        if (!decision) {
            // Direct response (greeting, meta-question)
            return {
                content: routingResponse.content,
                sessionId,
                agentUsed: 'orchestrator',
            }
        }

        // Handle clarification
        if ('action' in decision && decision.action === 'clarify') {
            return {
                content: formatClarificationQuestion(decision),
                sessionId,
                agentUsed: 'orchestrator',
            }
        }

        // Route to specialized agent
        if ('agent' in decision) {
            return await invokeSubAgent(
                decision.agent,
                decision.message || message,
                context
            )
        }

        return {
            content: routingResponse.content,
            sessionId,
            agentUsed: 'orchestrator',
        }
    } catch (error) {
        console.error('[Orchestrator] Error:', error)
        throw new Error(
            error instanceof Error ? error.message : 'Failed to process message'
        )
    }
}
```

### API Route

```typescript
// api/ai/chat/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/core/lib/auth/server'
import { processWithOrchestrator } from '@/themes/default/lib/langchain/orchestrator'
import { memoryStore } from '@/contents/plugins/langchain/lib/memory-store'

export async function POST(request: NextRequest) {
    try {
        // Authenticate
        const { user, teamId } = await authenticateRequest(request)
        if (!user || !teamId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { message, sessionId: providedSessionId, mode = 'orchestrator' } = await request.json()

        if (!message?.trim()) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 })
        }

        // Check conversation limits
        const count = await memoryStore.countSessions({ userId: user.id, teamId })
        if (count >= 50 && !providedSessionId) {
            return NextResponse.json({
                error: 'Maximum conversations reached (50). Delete some to continue.',
            }, { status: 400 })
        }

        const sessionId = providedSessionId || `session-${Date.now()}`

        // Process with orchestrator
        const response = await processWithOrchestrator(message, {
            userId: user.id,
            teamId,
            sessionId,
        })

        return NextResponse.json({
            ...response,
            mode: 'orchestrator',
        })
    } catch (error) {
        console.error('[Chat API] Error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal error' },
            { status: 500 }
        )
    }
}

export async function GET(request: NextRequest) {
    try {
        const { user, teamId } = await authenticateRequest(request)
        if (!user || !teamId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const sessionId = request.nextUrl.searchParams.get('sessionId')
        if (!sessionId) {
            return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
        }

        const messages = await memoryStore.getMessages(sessionId, {
            userId: user.id,
            teamId,
        })

        return NextResponse.json({ messages, sessionId })
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal error' },
            { status: 500 }
        )
    }
}
```

---

## Example 4: Page Builder Agent

Agent for managing pages and blocks.

### Tools Implementation

```typescript
// tools/pages.ts (simplified)
import { z } from 'zod'
import { PagesManagementService } from '@/themes/default/entities/pages/pages-management.service'
import { BLOCK_REGISTRY } from '@/core/lib/registries/block-registry'

export function createPageTools(context: { userId: string; teamId: string }) {
    const { userId, teamId } = context

    return [
        {
            name: 'list_pages',
            description: 'List all pages with optional filtering.',
            schema: z.object({
                status: z.enum(['draft', 'published']).optional(),
                limit: z.number().optional().default(20),
            }),
            func: async (params) => {
                const pages = await PagesManagementService.list(userId, params)
                return JSON.stringify(pages.map(p => ({
                    id: p.id,
                    title: p.title,
                    slug: p.slug,
                    status: p.status,
                    blocksCount: p.blocks?.length || 0,
                })), null, 2)
            },
        },
        {
            name: 'create_page',
            description: 'Create a new page.',
            schema: z.object({
                title: z.string().describe('Page title'),
                slug: z.string().describe('URL slug'),
                seoTitle: z.string().optional(),
                seoDescription: z.string().optional(),
            }),
            func: async (data) => {
                const page = await PagesManagementService.create(userId, {
                    ...data,
                    teamId,
                    status: 'draft',
                })
                return JSON.stringify({
                    success: true,
                    page: { id: page.id, title: page.title, slug: page.slug },
                    link: `/dashboard/pages/${page.id}`,
                }, null, 2)
            },
        },
        {
            name: 'add_block',
            description: 'Add a block to a page.',
            schema: z.object({
                pageId: z.string().describe('The page ID'),
                blockSlug: z.string().describe('Block type slug from available blocks'),
                props: z.record(z.any()).optional().describe('Block properties'),
                position: z.number().optional().describe('Position in page'),
            }),
            func: async ({ pageId, blockSlug, props, position }) => {
                const page = await PagesManagementService.addBlock(
                    userId,
                    pageId,
                    blockSlug,
                    props || {},
                    position
                )
                return JSON.stringify({
                    success: true,
                    message: `Added ${blockSlug} block to page`,
                    blocksCount: page.blocks?.length,
                }, null, 2)
            },
        },
        {
            name: 'list_available_blocks',
            description: 'List all available block types that can be added to pages.',
            schema: z.object({
                category: z.string().optional().describe('Filter by category'),
            }),
            func: async ({ category }) => {
                const blocks = Object.entries(BLOCK_REGISTRY)
                    .filter(([_, block]) => !category || block.category === category)
                    .map(([slug, block]) => ({
                        slug,
                        name: block.name,
                        description: block.description,
                        category: block.category,
                    }))
                return JSON.stringify(blocks, null, 2)
            },
        },
        {
            name: 'publish_page',
            description: 'Publish a page to make it publicly visible.',
            schema: z.object({
                pageId: z.string().describe('The page ID to publish'),
            }),
            func: async ({ pageId }) => {
                const page = await PagesManagementService.publish(userId, pageId)
                return JSON.stringify({
                    success: true,
                    message: `Page "${page.title}" is now published`,
                    url: `/${page.slug}`,
                }, null, 2)
            },
        },
    ]
}
```

### Example Conversation

```
User: "Create a landing page for our new product"
Agent: "What would you like to call the page and what URL slug should it have?"

User: "Call it 'New Product Launch' with slug 'new-product'"
Agent: *calls create_page*
       "Created page 'New Product Launch'. Now let's add some blocks.
        [Edit page](/dashboard/pages/page-123)"

User: "Add a hero section with a title"
Agent: *calls list_available_blocks to find hero block*
       *calls add_block with blockSlug="hero"*
       "Added a hero block to the page. You can customize it in the editor."

User: "Publish it"
Agent: *calls publish_page*
       "Page 'New Product Launch' is now live at /new-product"
```

---

## Summary

These examples demonstrate:

1. **Tool Patterns**: CRUD operations with proper error handling
2. **Context Usage**: userId/teamId for multi-tenancy
3. **Response Format**: Structured JSON with links and messages
4. **Orchestration**: Routing between specialized agents
5. **System Prompts**: Clear rules and examples for agent behavior

Use these as templates for your own implementations, adapting the entities and business logic to your needs.
