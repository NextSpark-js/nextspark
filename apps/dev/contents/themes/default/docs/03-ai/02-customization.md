# AI Assistant - Customization

This guide covers how to customize and extend the AI assistant for your specific needs.

## Creating Custom Tools

### Tool Structure

Tools are defined with a name, description, schema, and function:

```typescript
// contents/themes/default/lib/langchain/tools/my-entity.ts

import { z } from 'zod'
import type { ToolDefinition } from '@/contents/plugins/langchain/types/langchain.types'
import type { ToolContext } from '@/contents/plugins/langchain/types/langchain.types'
import { MyEntityService } from '@/contents/themes/default/entities/my-entity/my-entity.service'

export function createMyEntityTools(context: ToolContext): ToolDefinition<any>[] {
    return [
        {
            name: 'list_my_entities',
            description: 'List all my entities for the current user',
            schema: z.object({
                limit: z.number().optional().describe('Maximum number of results'),
                status: z.string().optional().describe('Filter by status'),
            }),
            func: async ({ limit, status }) => {
                const entities = await MyEntityService.list(context.userId, {
                    limit: limit || 10,
                    status,
                })
                return JSON.stringify(entities)
            },
        },
        {
            name: 'create_my_entity',
            description: 'Create a new entity',
            schema: z.object({
                name: z.string().describe('Entity name'),
                description: z.string().optional().describe('Entity description'),
            }),
            func: async ({ name, description }) => {
                const entity = await MyEntityService.create(context.userId, {
                    name,
                    description,
                })
                return JSON.stringify(entity)
            },
        },
    ]
}
```

### Tool Best Practices

1. **Clear Descriptions**: The LLM reads descriptions to decide which tool to use
2. **Zod Schemas**: Use `.describe()` for parameter documentation
3. **JSON Output**: Always return `JSON.stringify()` results
4. **Context Usage**: Use `context.userId` and `context.teamId` for data isolation

---

## Creating Custom Agents

### Agent Definition

Define agents in the theme's langchain configuration:

```typescript
// contents/themes/default/lib/langchain/agents.config.ts

import type { AgentDefinition, AgentContext } from '@/contents/plugins/langchain/types/langchain.types'
import { createMyEntityTools } from './tools/my-entity'

export const CUSTOM_AGENTS: Record<string, AgentDefinition> = {
    'my-entity-assistant': {
        provider: 'ollama',        // or 'openai', 'anthropic'
        temperature: 0.3,
        description: 'Specialized agent for my entity management',
        systemPrompt: 'my-entity-assistant',  // loads agents/my-entity-assistant.md
        createTools: (context: AgentContext) => createMyEntityTools(context),
    },
}
```

### System Prompt

Create the agent's system prompt:

```markdown
<!-- contents/themes/default/lib/langchain/agents/my-entity-assistant.md -->

You are a helpful assistant specialized in managing entities.

## Your Capabilities
- List entities with filters
- Create new entities
- Update existing entities
- Delete entities

## Guidelines
1. Always confirm destructive actions before proceeding
2. Format lists in a readable way
3. Ask clarifying questions when the request is ambiguous
4. Be concise but helpful

## Available Tools
- `list_my_entities`: Get entities with optional filters
- `create_my_entity`: Create a new entity
```

---

## Adding Graph Handlers

### Handler Structure

For the graph orchestrator, add custom handlers:

```typescript
// contents/themes/default/lib/langchain/handlers/my-entity-handler.ts

import type { OrchestratorState, HandlerResult } from '@/contents/plugins/langchain/lib/graph/types'
import { MyEntityService } from '@/contents/themes/default/entities/my-entity/my-entity.service'

export async function myEntityHandler(
    state: OrchestratorState
): Promise<Partial<OrchestratorState>> {
    const context = state.context
    const intent = state.intents.find(i => i.type === 'my_entity')

    if (!intent) {
        return {}
    }

    try {
        // Determine action from intent parameters
        const action = intent.parameters?.action || 'list'

        let result: HandlerResult

        switch (action) {
            case 'list':
                const entities = await MyEntityService.list(context.userId, {})
                result = {
                    handler: 'my_entity',
                    success: true,
                    data: entities,
                    message: `Found ${entities.length} entities`,
                }
                break

            case 'create':
                const newEntity = await MyEntityService.create(context.userId, {
                    name: intent.parameters?.name,
                })
                result = {
                    handler: 'my_entity',
                    success: true,
                    data: newEntity,
                    message: `Created entity "${newEntity.name}"`,
                }
                break

            default:
                result = {
                    handler: 'my_entity',
                    success: false,
                    error: `Unknown action: ${action}`,
                }
        }

        return {
            handlerResults: [...state.handlerResults, result],
            completedHandlers: [...state.completedHandlers, 'my_entity'],
        }
    } catch (error) {
        return {
            handlerResults: [
                ...state.handlerResults,
                {
                    handler: 'my_entity',
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                },
            ],
            completedHandlers: [...state.completedHandlers, 'my_entity'],
        }
    }
}
```

### Router Integration

Update the router to recognize your new intent:

```typescript
// The router uses structured output to classify intents
// Add your intent type to the schema:

const intentSchema = z.object({
    type: z.enum([
        'task',
        'customer',
        'page',
        'my_entity',  // Add your intent
        'greeting',
        'unclear',
    ]),
    confidence: z.number(),
    parameters: z.object({
        action: z.string().optional(),
        // Add entity-specific parameters
    }).optional(),
})
```

---

## Customizing Prompts

### Template Variables

System prompts support Handlebars templates:

```markdown
<!-- agents/my-assistant.md -->

You are assisting {{user.name}} with their {{team.name}} account.

{{#if user.isAdmin}}
As an admin, you can also manage team settings.
{{/if}}

Today's date is {{today}}.
```

### Context Enrichment

Provide data for templates:

```typescript
'my-assistant': {
    provider: 'openai',
    systemPrompt: 'my-assistant',
    enrichContext: async ({ userId, teamId }) => {
        const user = await UsersService.getById(userId)
        const team = await TeamsService.getById(teamId)
        return {
            userId,
            teamId,
            user: { name: user.name, isAdmin: user.role === 'admin' },
            team: { name: team.name },
            today: new Date().toLocaleDateString(),
        }
    },
}
```

---

## UI Integration

### Using the Chat Hook

```typescript
import { useStreamingChat } from '@/contents/plugins/langchain/hooks/useStreamingChat'

function MyAIChat() {
    const {
        isStreaming,
        streamContent,
        error,
        sendMessage,
        cancelStream,
    } = useStreamingChat({
        sessionId: 'my-session-id',
        agentName: 'my-entity-assistant',
        onComplete: (fullContent, tokenUsage) => {
            console.log('Response complete:', fullContent)
            console.log('Tokens used:', tokenUsage)
        },
        onError: (error) => {
            console.error('Chat error:', error)
        },
    })

    return (
        <div>
            {isStreaming && <TypingIndicator content={streamContent} />}
            <button onClick={() => sendMessage('Show my entities')}>
                Send
            </button>
            {isStreaming && (
                <button onClick={cancelStream}>Cancel</button>
            )}
        </div>
    )
}
```

### Token Usage Hook

```typescript
import { useTokenUsage } from '@/contents/plugins/langchain/hooks/useTokenUsage'

function UsageDisplay() {
    const { data, isLoading } = useTokenUsage({ period: '30d' })

    if (isLoading) return <Loading />

    return (
        <div>
            <p>Tokens: {data.totalTokens.toLocaleString()}</p>
            <p>Cost: ${data.totalCost.toFixed(2)}</p>
        </div>
    )
}
```

---

## Testing

### Testing Tools

```typescript
// tests/langchain/my-entity-tools.test.ts

import { createMyEntityTools } from '../lib/langchain/tools/my-entity'

describe('My Entity Tools', () => {
    const context = { userId: 'test-user', teamId: 'test-team' }

    it('should list entities', async () => {
        const tools = createMyEntityTools(context)
        const listTool = tools.find(t => t.name === 'list_my_entities')

        const result = await listTool.func({ limit: 5 })
        const parsed = JSON.parse(result)

        expect(Array.isArray(parsed)).toBe(true)
    })
})
```

### Testing Handlers

```typescript
// tests/langchain/my-entity-handler.test.ts

import { myEntityHandler } from '../lib/langchain/handlers/my-entity-handler'

describe('My Entity Handler', () => {
    it('should handle list intent', async () => {
        const state = {
            context: { userId: 'test-user', teamId: 'test-team' },
            intents: [{ type: 'my_entity', parameters: { action: 'list' } }],
            handlerResults: [],
            completedHandlers: [],
        }

        const result = await myEntityHandler(state)

        expect(result.completedHandlers).toContain('my_entity')
        expect(result.handlerResults[0].success).toBe(true)
    })
})
```

---

## Best Practices

### 1. Keep Handlers Simple

Handlers should do minimal work (0 LLM calls):

```typescript
// Good: Direct service call
const data = await Service.list(userId)

// Bad: Additional LLM call in handler
const agent = await createAgent(...)
const result = await agent.chat(...)
```

### 2. Use Structured Output

For router customization, use Zod schemas for type-safe output:

```typescript
const schema = z.object({
    intent: z.enum(['task', 'customer', 'my_entity']),
    confidence: z.number().min(0).max(1),
})
```

### 3. Handle Errors Gracefully

Always return meaningful error messages:

```typescript
try {
    const result = await riskyOperation()
    return { success: true, data: result }
} catch (error) {
    return {
        success: false,
        error: `Failed to process: ${error.message}`,
    }
}
```

### 4. Document Your Tools

Clear descriptions help the LLM choose correctly:

```typescript
{
    name: 'search_products',
    description: 'Search products by name, category, or price range. ' +
                 'Use this when the user wants to find specific products. ' +
                 'Returns up to 20 matching products.',
    // ...
}
```

---

## Related Documentation

- [Plugin Tools Guide](../../../plugins/langchain/docs/06-tools.md)
- [Graph Orchestrator](../../../plugins/langchain/docs/11-graph-orchestrator.md)
- [Agent Configuration](../../../plugins/langchain/docs/04-configuration.md)
