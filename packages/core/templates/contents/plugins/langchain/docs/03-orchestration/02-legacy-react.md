# Orchestration (Legacy)

> **DEPRECATED**: This document describes the legacy ReAct-based orchestration approach.
> For new implementations, use the **Graph-Based Orchestrator** which is 25-50x faster.
>
> **Recommended**: See [Graph Orchestrator](./01-graph-orchestrator.md) for the modern approach.
>
> **Migration**: Set `LANGCHAIN_USE_GRAPH_ORCHESTRATOR=true` to enable the new system.

---

Orchestration enables complex multi-agent systems where a central orchestrator routes requests to specialized agents. This guide covers orchestration patterns, implementation, and best practices.

## Why Orchestration?

As applications grow, a single agent with many tools becomes:
- **Hard to maintain**: Too many tools, complex prompts
- **Slow**: LLM must consider all tools for every request
- **Error-prone**: More tools = more chance of wrong tool selection

Orchestration solves this by:
- **Separating concerns**: Each agent handles one domain
- **Improving focus**: Smaller tool sets = better accuracy
- **Enabling specialization**: Different models/temps per domain

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          USER REQUEST                            │
│                    "Show me customer details"                    │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                        ORCHESTRATOR                              │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    System Prompt                         │    │
│  │    "Analyze intent and route to appropriate agent"       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                               │                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Routing Tools                         │    │
│  │  route_to_task | route_to_customer | route_to_page      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│                    Decision: route_to_customer                   │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     CUSTOMER AGENT                               │
│                                                                  │
│  Tools: search_customers, get_customer, update_customer, ...    │
│                                                                  │
│  *Executes request and returns response*                        │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                           RESPONSE                               │
│                    "Here's the customer..."                      │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation

### Step 1: Configure Agents

```typescript
// langchain.config.ts
export const AGENTS = {
    // Orchestrator - low temperature for consistent routing
    'orchestrator': {
        provider: 'ollama',
        temperature: 0.1,
        description: 'Routes requests to specialized agents',
        systemPrompt: 'orchestrator',
        createTools: () => createOrchestratorTools(),
    },

    // Specialized agents
    'task-assistant': {
        provider: 'ollama',
        temperature: 0.3,
        systemPrompt: 'task-assistant',
        createTools: (ctx) => createTaskTools(ctx),
    },
    'customer-assistant': {
        provider: 'ollama',
        temperature: 0.3,
        systemPrompt: 'customer-assistant',
        createTools: (ctx) => createCustomerTools(ctx),
    },
    'page-assistant': {
        provider: 'ollama',
        temperature: 0.3,
        systemPrompt: 'page-assistant',
        createTools: (ctx) => createPageTools(ctx),
    },
}
```

### Step 2: Create Routing Tools

```typescript
// tools/orchestrator.ts
import { z } from 'zod'

export interface RoutingResult {
    agent: 'task' | 'customer' | 'page'
    message: string
}

export interface ClarificationResult {
    action: 'clarify'
    question: string
    options: Array<{ label: string; description: string }>
}

export function createOrchestratorTools() {
    return [
        {
            name: 'route_to_task',
            description: 'Route to task agent when user mentions tasks, todos, or work items.',
            schema: z.object({
                message: z.string().describe('User message to forward'),
            }),
            func: async ({ message }) => {
                return JSON.stringify({ agent: 'task', message })
            },
        },
        {
            name: 'route_to_customer',
            description: 'Route to customer agent when user mentions customers, clients, or accounts.',
            schema: z.object({
                message: z.string().describe('User message to forward'),
            }),
            func: async ({ message }) => {
                return JSON.stringify({ agent: 'customer', message })
            },
        },
        {
            name: 'route_to_page',
            description: 'Route to page agent when user mentions pages, content, or blocks.',
            schema: z.object({
                message: z.string().describe('User message to forward'),
            }),
            func: async ({ message }) => {
                return JSON.stringify({ agent: 'page', message })
            },
        },
        {
            name: 'ask_clarification',
            description: 'Ask user for clarification when intent is unclear.',
            schema: z.object({
                question: z.string(),
                options: z.array(z.object({
                    label: z.string(),
                    description: z.string(),
                })),
            }),
            func: async ({ question, options }) => {
                return JSON.stringify({ action: 'clarify', question, options })
            },
        },
    ]
}
```

### Step 3: Orchestrator System Prompt

```markdown
<!-- agents/orchestrator.md -->

You are an AI Orchestrator that routes user requests to specialized agents.

## CRITICAL RULE

**YOU CAN ONLY DO TWO THINGS:**
1. Call a routing tool (route_to_task, route_to_customer, route_to_page)
2. Respond to simple greetings

**NEVER claim to perform actions like creating, updating, or deleting data.** You don't have those tools. Only the specialized agents do.

## Routing Rules

**route_to_customer** - Use when:
- User mentions customers, clients, accounts (cliente, customer, cuenta)
- User wants to modify something about a previously discussed customer
- User references a customer from earlier ("modificalo", "cambialo")

**route_to_task** - Use when:
- User mentions tasks, to-dos, work items (tarea, task, pendiente)
- User wants to create, update, or list tasks
- User asks for suggestions to add to a task

**route_to_page** - Use when:
- User mentions pages, content, website (página, page, contenido)
- User wants to create or modify landing pages, blocks

## Context Awareness

When the user says "modificalo", "cambialo", "actualízalo":
- Look at the conversation history to determine WHAT they're referring to
- If discussing a customer → route_to_customer
- If discussing a task → route_to_task
- If discussing a page → route_to_page

## Direct Response (ONLY for greetings)

Respond directly ONLY for:
- "Hola" → "¡Hola! ¿En qué puedo ayudarte?"
- "Hello" → "Hello! How can I help you?"

For EVERYTHING else, use a routing tool.
```

### Step 4: Orchestrator Handler

```typescript
// orchestrator.ts
import { createAgent } from '@/contents/plugins/langchain/lib/agent-factory'
import { loadSystemPrompt } from './agents'
import { getAgentConfig, getAgentModelConfig, getAgentTools } from './langchain.config'
import type { RoutingResult, ClarificationResult } from './tools/orchestrator'

type AgentType = 'task' | 'customer' | 'page'

const AGENT_NAME_MAP: Record<AgentType, string> = {
    task: 'task-assistant',
    customer: 'customer-assistant',
    page: 'page-assistant',
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
 * Extract routing decision from the LATEST turn only
 */
function extractRoutingFromMessages(messages: any[]): RoutingResult | ClarificationResult | null {
    // Find last human message (start of current turn)
    let lastHumanIndex = -1
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i]._getType() === 'human') {
            lastHumanIndex = i
            break
        }
    }

    // Only search for tool results AFTER the last human message
    for (let i = messages.length - 1; i > lastHumanIndex; i--) {
        const msg = messages[i]
        if (msg._getType() === 'tool') {
            const content = typeof msg.content === 'string'
                ? msg.content
                : JSON.stringify(msg.content)
            try {
                const parsed = JSON.parse(content)
                if (parsed.action === 'clarify' || parsed.agent) {
                    return parsed
                }
            } catch {
                // Not JSON
            }
        }
    }
    return null
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

    const config = getAgentConfig(agentName)
    if (!config?.systemPrompt) {
        throw new Error(`Agent not found: ${agentName}`)
    }

    const agent = await createAgent({
        sessionId: `${sessionId}-${agentType}`,
        systemPrompt: loadSystemPrompt(config.systemPrompt as any),
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
        // Step 1: Create orchestrator
        const orchestratorAgent = await createAgent({
            sessionId: `${sessionId}-orchestrator`,
            systemPrompt: loadSystemPrompt('orchestrator'),
            tools: getAgentTools('orchestrator', { userId, teamId }),
            modelConfig: getAgentModelConfig('orchestrator'),
            context: { userId, teamId },
        })

        // Step 2: Get routing decision
        const routingResponse = await orchestratorAgent.chat(message)

        // Step 3: Extract routing from tool results
        const decision = extractRoutingFromMessages(routingResponse.messages || [])

        if (!decision) {
            // Orchestrator responded directly (greeting, meta-question)
            return {
                content: routingResponse.content,
                sessionId,
                agentUsed: 'orchestrator',
            }
        }

        // Step 4: Handle clarification
        if ('action' in decision && decision.action === 'clarify') {
            let response = decision.question + '\n\n'
            decision.options.forEach((opt, i) => {
                response += `${i + 1}. **${opt.label}**: ${opt.description}\n`
            })
            return {
                content: response,
                sessionId,
                agentUsed: 'orchestrator',
            }
        }

        // Step 5: Route to specialized agent
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

### Step 5: API Integration

```typescript
// api/ai/chat/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/core/lib/auth/server'
import { processWithOrchestrator } from '@/themes/default/lib/langchain/orchestrator'

export async function POST(request: NextRequest) {
    try {
        const { user, teamId } = await authenticateRequest(request)
        if (!user || !teamId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { message, sessionId } = await request.json()

        const response = await processWithOrchestrator(message, {
            userId: user.id,
            teamId,
            sessionId: sessionId || `session-${Date.now()}`,
        })

        return NextResponse.json(response)
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Error' },
            { status: 500 }
        )
    }
}
```

## Session Management

Orchestration creates separate sessions for each agent:

```
Main session: user-123-session-1
├── Orchestrator: user-123-session-1-orchestrator
├── Task Agent: user-123-session-1-task
├── Customer Agent: user-123-session-1-customer
└── Page Agent: user-123-session-1-page
```

This allows:
- Independent conversation history per agent
- Context isolation between domains
- Parallel conversations if needed

## Handling Context References

A key challenge is handling contextual references like "modificalo" (modify it):

### Problem

```
User: "Show me customer StartupXYZ"
Agent: *shows customer details*
User: "modificalo, su nuevo telefono es +1 555..."
       ^^^^^^^^^^
       What is "it"?
```

### Solution: Context Awareness in Prompt

```markdown
## Context Awareness

When the user says "modificalo", "cambialo", "actualízalo":
- Look at the conversation history to determine WHAT they're referring to
- If you were just discussing a customer → route_to_customer
- If you were just discussing a task → route_to_task
- If you were just discussing a page → route_to_page
```

### Solution: Extracting Only Current Turn

```typescript
// Only look at messages after the last human message
function extractRoutingFromMessages(messages) {
    let lastHumanIndex = -1
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i]._getType() === 'human') {
            lastHumanIndex = i
            break
        }
    }

    // Search only in current turn
    for (let i = messages.length - 1; i > lastHumanIndex; i--) {
        // Extract routing...
    }
}
```

## Orchestration Patterns

### Pattern 1: Simple Router

Route based on keywords only:

```typescript
'orchestrator': {
    temperature: 0.1,
    systemPrompt: 'simple-router',
    createTools: () => [routeToTask, routeToCustomer, routeToPage],
}
```

### Pattern 2: Intent Classifier

More sophisticated intent analysis:

```markdown
## Intent Classification

Before routing, classify the user's intent:

1. **CRUD Operations**: Create, Read, Update, Delete
2. **Search/Query**: Finding specific items
3. **Aggregation**: Summaries, counts, reports
4. **Action**: Workflows, multi-step operations

Then route to the appropriate agent.
```

### Pattern 3: Hierarchical Orchestration

For very complex systems:

```
Main Orchestrator
├── Domain A Orchestrator
│   ├── Agent A1
│   └── Agent A2
└── Domain B Orchestrator
    ├── Agent B1
    └── Agent B2
```

### Pattern 4: Fallback Chain

Try agents in order:

```typescript
async function processWithFallback(message, context) {
    try {
        return await processWithOrchestrator(message, context)
    } catch {
        // Fallback to single agent
        return await processSingleAgent(message, context)
    }
}
```

## Clarification Flow

When intent is unclear, ask for clarification:

```typescript
{
    name: 'ask_clarification',
    description: 'Ask user for clarification when intent is ambiguous.',
    schema: z.object({
        question: z.string(),
        options: z.array(z.object({
            label: z.string(),
            description: z.string(),
        })),
    }),
    func: async ({ question, options }) => {
        return JSON.stringify({
            action: 'clarify',
            question,
            options,
        })
    },
}
```

**Example:**

```
User: "Create a new entry"
Orchestrator: *calls ask_clarification*
Response:
  "What type of entry would you like to create?"

  1. **Task**: Create a new task or todo item
  2. **Customer**: Create a new customer record
  3. **Page**: Create a new content page
```

## Debugging Orchestration

### Enable Logging

```env
LOG_ENABLED=true
```

### Check Logs

```bash
# View orchestrator decisions
cat logger/ai/session-*-orchestrator.log

# View sub-agent execution
cat logger/ai/session-*-task.log
cat logger/ai/session-*-customer.log
```

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Wrong agent selected | Unclear routing rules | Improve prompt keywords |
| Stale routing | Using old tool results | Only check current turn |
| Direct response instead of routing | Too permissive direct response rules | Restrict to greetings only |
| Infinite loops | Agent calling itself | Check recursion limits |

## Best Practices

### 1. Keep Orchestrator Lightweight

```typescript
'orchestrator': {
    temperature: 0.1,  // Low for consistency
    // Only routing tools, no data tools
    createTools: () => createOrchestratorTools(),
}
```

### 2. Be Explicit About Routing Rules

```markdown
## Routing Rules

**route_to_customer** - Use when message contains:
- "customer", "cliente", "client"
- "account", "cuenta"
- "phone", "teléfono"
- OR when referring to a previously discussed customer
```

### 3. Handle Edge Cases

```markdown
## Edge Cases

- If message could match multiple agents, ask for clarification
- If user says "undo", route to the same agent as previous action
- If user says "help", respond directly with capability list
```

### 4. Monitor and Iterate

- Track routing accuracy
- Log misrouted requests
- Continuously improve prompts

## Next Steps

- [Advanced customization](../05-reference/02-customization.md)
- [API reference](../05-reference/01-api-reference.md)
