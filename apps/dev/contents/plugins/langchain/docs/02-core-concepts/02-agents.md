# Agents

Agents are the core of the LangChain plugin. This guide covers how to create, configure, and customize AI agents with system prompts.

## What is an Agent?

An agent combines three elements:

1. **LLM (Brain)**: The language model that reasons and makes decisions
2. **Tools (Hands)**: Functions the agent can call to interact with data
3. **System Prompt (Personality)**: Instructions that define agent behavior

```
┌─────────────────────────────────────────┐
│                 AGENT                    │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │         System Prompt             │   │
│  │   "You are a task assistant..."   │   │
│  └──────────────────────────────────┘   │
│                    │                     │
│                    ▼                     │
│  ┌──────────────────────────────────┐   │
│  │              LLM                  │   │
│  │         (Reasoning)               │   │
│  └──────────────────────────────────┘   │
│                    │                     │
│         ┌─────────┴─────────┐           │
│         ▼                   ▼           │
│  ┌─────────────┐     ┌─────────────┐    │
│  │   Tool 1    │     │   Tool 2    │    │
│  │ list_tasks  │     │ create_task │    │
│  └─────────────┘     └─────────────┘    │
│                                          │
└─────────────────────────────────────────┘
```

## Creating an Agent

### Step 1: Define in Configuration

```typescript
// langchain.config.ts
export const AGENTS = {
    'my-assistant': {
        provider: 'ollama',
        temperature: 0.3,
        description: 'Helps users manage their items',
        systemPrompt: 'my-assistant',
        createTools: (context) => createMyTools(context),
    },
}
```

### Step 2: Create System Prompt

```markdown
<!-- agents/my-assistant.md -->

You are an AI assistant that helps users manage their items.

## Your Capabilities
- List, search, and view items
- Create new items
- Update existing items
- Delete items (with confirmation)

## Rules
1. Always use tools to access data - never fabricate information
2. Confirm before destructive actions
3. Match the user's language (Spanish/English)

## Response Format
- Be concise but helpful
- Use bullet points for lists
- Provide links after creating/updating: [Item Name](/items/{id})
```

### Step 3: Create Tools

```typescript
// tools/my-entity.ts
export function createMyTools(context: AgentContext): ToolDefinition[] {
    return [
        {
            name: 'list_items',
            description: 'List all items',
            schema: z.object({}),
            func: async () => {
                const items = await MyService.list(context.userId)
                return JSON.stringify(items)
            },
        },
    ]
}
```

### Step 4: Use the Agent

```typescript
import { createAgent } from '@/contents/plugins/langchain/lib/agent-factory'
import { getAgentTools, getAgentModelConfig } from './langchain.config'
import { loadSystemPrompt } from './agents'

const agent = await createAgent({
    sessionId: `user-${userId}-${Date.now()}`,
    systemPrompt: loadSystemPrompt('my-assistant'),
    tools: getAgentTools('my-assistant', { userId, teamId }),
    modelConfig: getAgentModelConfig('my-assistant'),
    context: { userId, teamId },
})

const response = await agent.chat('Show me my items')
```

## System Prompts

System prompts define agent behavior. They are loaded from markdown files in the `agents/` folder.

### Prompt Loader

```typescript
// agents/index.ts
import fs from 'fs'
import path from 'path'

const AGENTS_DIR = path.join(__dirname)

export type AgentName =
    | 'orchestrator'
    | 'task-assistant'
    | 'customer-assistant'
    | 'page-assistant'
    | 'single-agent'

const promptCache = new Map<string, string>()

export function loadSystemPrompt(agentName: AgentName): string {
    if (promptCache.has(agentName)) {
        return promptCache.get(agentName)!
    }

    const filePath = path.join(AGENTS_DIR, `${agentName}.md`)
    const content = fs.readFileSync(filePath, 'utf-8')
    promptCache.set(agentName, content)

    return content
}

export function agentExists(agentName: string): boolean {
    const filePath = path.join(AGENTS_DIR, `${agentName}.md`)
    return fs.existsSync(filePath)
}
```

### Prompt Structure

A well-structured system prompt includes:

```markdown
# Agent Name

Brief description of what the agent does.

## Critical Rules

**Rules that MUST be followed:**
- Rule 1: Always use tools
- Rule 2: Never fabricate data
- Rule 3: ...

## Capabilities

What this agent can do:
- Capability 1
- Capability 2
- ...

## Available Tools

| Tool | When to Use |
|------|-------------|
| `tool_name` | Description of when to use |
| `other_tool` | Description... |

## Workflow

How the agent should approach tasks:

1. Step 1
2. Step 2
3. ...

## Response Format

Guidelines for formatting responses:
- Use bullet points
- Match user language
- Provide links: [Name](/path/{id})

## Examples

Example interactions (optional):

User: "Show me my items"
Agent: *calls list_items* → Formats and displays results

## What NOT to Do

- Don't fabricate data
- Don't skip tool calls
- Don't ...
```

## Dynamic Prompts with Handlebars

System prompts support Handlebars templates for injecting runtime data. This allows prompts to be personalized based on user context, business data, or other dynamic information.

### Enabling Dynamic Prompts

1. **Define `enrichContext` in your agent configuration:**

```typescript
// langchain.config.ts
'sales-assistant': {
    provider: 'openai',
    systemPrompt: 'sales-assistant',  // Template file

    enrichContext: async ({ userId, teamId }) => {
        const user = await UsersService.getById(userId)
        const team = await TeamsService.getById(teamId)
        const quotas = await QuotasService.getForUser(userId)

        return {
            userId,
            teamId,
            salesperson: { name: user.name, email: user.email },
            company: { name: team.name, timezone: team.timezone },
            quotas,
        }
    },
}
```

2. **Use Handlebars syntax in your prompt:**

```markdown
<!-- agents/sales-assistant.md -->

# Sales Assistant

You are helping **{{salesperson.name}}** from **{{company.name}}**.
Current timezone: {{company.timezone}}

{{#if quotas}}
## Your quotas this month:
{{#each quotas}}
- {{this.name}}: {{this.current}} / {{this.target}}
{{/each}}
{{/if}}

## Your Capabilities
...
```

### Handlebars Syntax

| Syntax | Description | Example |
|--------|-------------|---------|
| `{{variable}}` | Simple variable | `{{user.name}}` |
| `{{nested.key}}` | Nested property | `{{company.timezone}}` |
| `{{#if condition}}...{{/if}}` | Conditional | `{{#if isAdmin}}Admin mode{{/if}}` |
| `{{#unless condition}}...{{/unless}}` | Inverse conditional | `{{#unless hasData}}No data{{/unless}}` |
| `{{#each items}}...{{/each}}` | Loop over array | `{{#each tasks}}{{this.title}}{{/each}}` |
| `{{#with object}}...{{/with}}` | Change context | `{{#with user}}{{name}}{{/with}}` |

### Prompt Renderer

The plugin provides a `renderPrompt` utility:

```typescript
import { renderPrompt } from '@/contents/plugins/langchain/lib/prompt-renderer'

const template = 'Hello {{user.name}} from {{company.name}}!'
const context = {
    userId: '123',
    teamId: '456',
    user: { name: 'John' },
    company: { name: 'Acme Corp' },
}

const rendered = renderPrompt(template, context)
// "Hello John from Acme Corp!"
```

### Best Practices

1. **Keep templates readable** - Don't overuse conditionals
2. **Provide defaults** - Handle missing data gracefully
3. **Document required context** - Note what data the template expects
4. **Test with sample data** - Ensure templates render correctly

## Real-World Examples

### Task Assistant

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

### Customer Assistant

```markdown
<!-- agents/customer-assistant.md -->

You are a customer management AI assistant for the Boilerplate application.

## CRITICAL RULE - MUST FOLLOW

**YOU MUST ALWAYS USE TOOLS TO GET DATA. NEVER FABRICATE OR IMAGINE CUSTOMER INFORMATION.**

Before responding with ANY customer information, you MUST:
1. Call the appropriate tool (list_customers, search_customers, get_customer)
2. Wait for the tool result
3. ONLY THEN respond based on the REAL data from the tool

## Your Capabilities
- List, search, and view customer details (using tools)
- Create new customers with all their information
- Update existing customer data
- Delete customers (with confirmation)

## Customer Fields
- **name**: Company or customer name (required)
- **account**: Account number (required, numeric, must be unique)
- **office**: Office location/branch (required)
- **phone**: Contact phone number (optional)
- **salesRep**: Assigned sales representative name (optional)
- **visitDays**: Days for in-person visits (optional)
- **contactDays**: Days for phone/email contact (optional)

## Handling Contextual Updates

When the user says "modificalo", "cambialo", "actualízalo" (modify it, change it, update it):
1. Look at the conversation history to identify which customer they're referring to
2. Get the customer ID from your previous search/get results
3. Call update_customer with that ID and the new values
4. Confirm the update with a link

**Example:**
- Previous context: You showed StartupXYZ (id: customer-002, phone: +1 512 555 0102)
- User: "modificalo, su nuevo telefono es +1 457 45465245"
- YOU: Call update_customer with customerId="customer-002" and phone="+1 457 45465245"

## Response Format
- Use Spanish when the user writes in Spanish, English otherwise
- After creating or updating a customer, provide a link: [Customer Name](/dashboard/customers/{id})
- When listing customers, summarize key info: name, office, salesRep
- Always confirm before deleting a customer
```

### Orchestrator

```markdown
<!-- agents/orchestrator.md -->

You are an AI Orchestrator that routes user requests to specialized agents.

## CRITICAL RULE

**YOU CAN ONLY DO TWO THINGS:**
1. Call a routing tool (route_to_task, route_to_customer, route_to_page)
2. Respond to simple greetings

**NEVER claim to perform actions like creating, updating, or deleting data.** You don't have those tools.

## Your Job

1. Analyze the user's message AND the conversation history
2. Decide which agent should handle it
3. Call the appropriate routing tool OR respond to greetings only

## Routing Rules

**route_to_customer** - Use when:
- User mentions customers, clients, accounts
- User wants to modify something about a previously discussed customer
- User references a customer from earlier ("modificalo", "cambialo")

**route_to_task** - Use when:
- User mentions tasks, to-dos, work items
- User wants to create, update, or list tasks
- User asks for suggestions to add to a task

**route_to_page** - Use when:
- User mentions pages, content, website
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
- "¿Quién eres?" → "Soy tu asistente para tareas, clientes y páginas."

For EVERYTHING else, use a routing tool.
```

## Agent Patterns

### Pattern 1: Single Domain Agent

For simple applications with one entity type:

```typescript
'item-assistant': {
    provider: 'ollama',
    temperature: 0.3,
    systemPrompt: 'item-assistant',
    createTools: (ctx) => createItemTools(ctx),
}
```

### Pattern 2: Unified Multi-Domain Agent

For applications where one agent handles everything:

```typescript
'assistant': {
    provider: 'ollama',
    temperature: 0.3,
    systemPrompt: 'unified-assistant',
    createTools: (ctx) => [
        ...createTaskTools(ctx),
        ...createCustomerTools(ctx),
        ...createPageTools(ctx),
    ],
}
```

### Pattern 3: Specialized Agents

For complex applications with domain experts:

```typescript
const AGENTS = {
    'task-expert': { createTools: (ctx) => createTaskTools(ctx) },
    'customer-expert': { createTools: (ctx) => createCustomerTools(ctx) },
    'content-expert': { createTools: (ctx) => createPageTools(ctx) },
}
```

### Pattern 4: Hierarchical Agents

Orchestrator + specialized agents:

```typescript
const AGENTS = {
    'orchestrator': {
        temperature: 0.1,
        createTools: () => createRoutingTools(),
    },
    'task-assistant': { ... },
    'customer-assistant': { ... },
}
```

## Best Practices

### 1. Be Explicit About Tool Usage

```markdown
## CRITICAL RULE
You MUST use tools to get data. NEVER fabricate information.
```

### 2. Provide Examples

```markdown
## Workflow Example
1. User: "Show me my tasks"
2. YOU: Call list_tasks
3. Tool returns: [{id: "1", title: "Review report"}]
4. YOU: Format and display the real data
```

### 3. Handle Edge Cases

```markdown
## Error Handling
- If no results found, say so honestly
- If a tool fails, report the error to the user
- Never make up data to fill gaps
```

### 4. Match User Language

```markdown
## Language
- Use Spanish when the user writes in Spanish
- Use English when the user writes in English
```

### 5. Provide Action Feedback

```markdown
## Response Format
- After creating: [Item Name](/items/{id})
- After updating: "Updated successfully"
- Before deleting: "Are you sure?"
```

## Debugging Prompts

Enable logging to see how the agent interprets prompts:

```env
LOG_ENABLED=true
```

Check logs in `logger/ai/session-{id}.log`:

```
[SESSION_INIT] { model: "qwen2.5:7b", toolsCount: 5 }
[USER_MESSAGE] { message: "Show me my tasks" }
[AGENT_RESPONSE] {
  messages: [
    { type: "human", content: "Show me my tasks" },
    { type: "ai", content: "", tool_calls: [{ name: "list_tasks" }] },
    { type: "tool", content: "[{...}]" },
    { type: "ai", content: "Here are your tasks:..." }
  ]
}
```

## Next Steps

- [Build tools for your agents](./03-tools.md)
- [Set up graph orchestration](../03-orchestration/01-graph-orchestrator.md) (recommended)
- [Configure observability](../04-advanced/01-observability.md)
