# Advanced Customization

This guide covers advanced customization techniques for building sophisticated AI agent systems tailored to different product types and complexity levels.

## Customization Philosophy

The LangChain plugin is designed to be **flexible and extensible**. While presets provide a starting point, real-world applications often require custom behavior based on:

- **Product Type**: CRM, CMS, productivity app, e-commerce
- **Complexity Level**: Simple assistant vs. enterprise multi-agent
- **User Needs**: Technical users vs. non-technical users
- **Domain Requirements**: Industry-specific terminology and workflows

## Orchestration Complexity Levels

### Level 1: Single Agent (Simplest)

**Best for:** MVPs, prototypes, simple tools

```
User → Single Agent → Response
```

**Implementation:**

```typescript
// One agent with all tools
export const AGENTS = {
    'assistant': {
        provider: 'ollama',
        temperature: 0.3,
        systemPrompt: 'unified-assistant',
        createTools: (ctx) => [
            ...createTaskTools(ctx),
            ...createCustomerTools(ctx),
            ...createPageTools(ctx),
        ],
    },
}
```

**Prompt Pattern:**

```markdown
You are a helpful assistant with access to tasks, customers, and pages.

## Available Tools
- Task tools: list_tasks, create_task, update_task, ...
- Customer tools: list_customers, search_customers, ...
- Page tools: list_pages, create_page, ...

## Guidelines
- Use the appropriate tool based on user request
- Always use tools to access data
- Format responses clearly
```

**Pros:** Simple, fast, low latency
**Cons:** All tools in one context, potential confusion with many tools

---

### Level 2: Keyword-Based Router

**Best for:** Small teams, clear domain separation

```
User → Router (keywords) → Specialized Agent → Response
```

**Implementation:**

```typescript
export const AGENTS = {
    'orchestrator': {
        provider: 'ollama',
        temperature: 0.1,
        systemPrompt: 'keyword-router',
        createTools: () => createRoutingTools(),
    },
    'task-assistant': { ... },
    'customer-assistant': { ... },
}
```

**Prompt Pattern:**

```markdown
You route requests based on keywords.

## Routing Rules

| Keywords | Route To |
|----------|----------|
| task, tarea, todo, pendiente | route_to_task |
| customer, cliente, client, account | route_to_customer |
| page, página, content, block | route_to_page |

## Rules
- Match the FIRST keyword found
- If no keywords match, ask for clarification
- ONLY route or greet, never perform actions directly
```

**Pros:** Predictable, fast routing
**Cons:** Can miss intent with paraphrased requests

---

### Level 3: Intent-Based Router

**Best for:** Medium complexity, varied user input

```
User → Router (intent analysis) → Specialized Agent → Response
```

**Implementation:**

```typescript
export const AGENTS = {
    'orchestrator': {
        provider: 'openai',  // Better model for intent analysis
        model: 'gpt-4o-mini',
        temperature: 0.1,
        systemPrompt: 'intent-router',
        createTools: () => createRoutingTools(),
    },
    // ... specialized agents
}
```

**Prompt Pattern:**

```markdown
You analyze user intent and route to the appropriate agent.

## Intent Classification

### Task-Related Intents:
- TASK_LIST: User wants to see their tasks
- TASK_CREATE: User wants to create a new task
- TASK_UPDATE: User wants to modify an existing task
- TASK_SEARCH: User is looking for a specific task

### Customer-Related Intents:
- CUSTOMER_INFO: User wants customer details
- CUSTOMER_SEARCH: User is looking for customers
- CUSTOMER_UPDATE: User wants to modify customer data

### Page-Related Intents:
- PAGE_CREATE: User wants to create content
- PAGE_EDIT: User wants to modify pages/blocks

## Context Awareness

When the user uses pronouns or references:
- "it", "this", "that" → Check conversation history
- "the same", "that one" → Reference previous entity
- "modify it", "update it" → Route to same agent as last operation

## Ambiguity Handling

If intent is unclear between two domains:
1. Check conversation context for clues
2. If still unclear, use ask_clarification tool
```

**Pros:** Handles varied input, context-aware
**Cons:** Higher latency, requires better model

---

### Level 4: Hierarchical Multi-Agent

**Best for:** Enterprise applications, complex domains

```
User → Domain Router → Domain Orchestrator → Specialized Agent → Response
```

**Implementation:**

```typescript
export const AGENTS = {
    // Top-level router
    'main-orchestrator': {
        provider: 'openai',
        model: 'gpt-4o-mini',
        temperature: 0.1,
        systemPrompt: 'main-orchestrator',
        createTools: () => createDomainRoutingTools(),
    },

    // Domain orchestrators
    'crm-orchestrator': {
        provider: 'ollama',
        temperature: 0.1,
        systemPrompt: 'crm-orchestrator',
        createTools: () => createCrmRoutingTools(),
    },
    'content-orchestrator': {
        provider: 'ollama',
        temperature: 0.1,
        systemPrompt: 'content-orchestrator',
        createTools: () => createContentRoutingTools(),
    },

    // Specialized agents
    'lead-specialist': { ... },
    'deal-specialist': { ... },
    'page-specialist': { ... },
    'blog-specialist': { ... },
}
```

**Pros:** Handles complex domains, scales well
**Cons:** Higher latency, more complex maintenance

---

### Level 5: Adaptive Agent System

**Best for:** AI-first products, dynamic workflows

```
User → Meta-Orchestrator → [Create/Select/Combine Agents] → Response
```

**Implementation:**

```typescript
// Dynamic agent creation based on user needs
async function createAdaptiveAgent(userProfile, context) {
    const capabilities = analyzeRequiredCapabilities(userProfile)

    return await createAgent({
        sessionId: context.sessionId,
        systemPrompt: generateDynamicPrompt(capabilities),
        tools: selectRelevantTools(capabilities, context),
        modelConfig: selectOptimalModel(capabilities),
        context,
    })
}
```

**Pros:** Highly personalized, efficient
**Cons:** Complex implementation, requires careful testing

## Product-Specific Patterns

### CRM Application

**Entities:** Leads, Contacts, Deals, Activities

```typescript
export const AGENTS = {
    'sales-assistant': {
        provider: 'openai',
        temperature: 0.3,
        systemPrompt: 'sales-assistant',
        createTools: (ctx) => [
            ...createLeadTools(ctx),
            ...createContactTools(ctx),
            ...createDealTools(ctx),
            ...createActivityTools(ctx),
        ],
    },
}
```

**Prompt Features:**

```markdown
## Sales Context Awareness

When user mentions:
- "prospect", "lead" → Lead entity
- "contact", "person" → Contact entity
- "deal", "opportunity" → Deal entity
- "call", "meeting", "email" → Activity entity

## Sales Workflow Understanding

- Leads can be converted to Contacts
- Contacts are associated with Deals
- Activities are logged against Deals or Contacts

## Proactive Suggestions

After showing a lead, suggest:
- "Would you like to convert this lead?"
- "Should I log a follow-up activity?"
```

---

### Content Management System

**Entities:** Pages, Posts, Blocks, Media

```typescript
export const AGENTS = {
    'content-orchestrator': {
        temperature: 0.1,
        createTools: () => createContentRoutingTools(),
    },
    'page-editor': {
        temperature: 0.5,  // Higher for creative content
        createTools: (ctx) => createPageTools(ctx),
    },
    'blog-writer': {
        temperature: 0.7,  // Even higher for blog content
        createTools: (ctx) => createBlogTools(ctx),
    },
}
```

**Prompt Features:**

```markdown
## Content Types

- **Pages**: Landing pages, static content
- **Posts**: Blog articles, news
- **Blocks**: Reusable content components

## Creative Assistance

When asked to create content:
1. Ask about tone (formal, casual, persuasive)
2. Ask about target audience
3. Generate multiple options when appropriate

## SEO Awareness

Always suggest:
- Meta titles and descriptions
- Keyword placement
- Alt text for images
```

---

### E-Commerce Platform

**Entities:** Products, Orders, Customers, Inventory

```typescript
export const AGENTS = {
    'commerce-orchestrator': {
        temperature: 0.1,
        createTools: () => createCommerceRoutingTools(),
    },
    'product-manager': {
        temperature: 0.3,
        createTools: (ctx) => [
            ...createProductTools(ctx),
            ...createInventoryTools(ctx),
        ],
    },
    'order-specialist': {
        temperature: 0.2,  // Lower for accuracy
        createTools: (ctx) => [
            ...createOrderTools(ctx),
            ...createShippingTools(ctx),
        ],
    },
}
```

**Prompt Features:**

```markdown
## Commerce Context

- Products have variants (size, color)
- Inventory is tracked per variant
- Orders can have multiple items

## Critical Operations

Before any order modification:
1. Verify current order status
2. Check inventory availability
3. Confirm with user if total changes

## Customer Service Mode

When user mentions complaint or issue:
- Show empathy
- Offer resolution options
- Log the interaction
```

---

### Project Management Tool

**Entities:** Projects, Tasks, Sprints, Team Members

```typescript
export const AGENTS = {
    'pm-assistant': {
        provider: 'openai',
        temperature: 0.3,
        createTools: (ctx) => [
            ...createProjectTools(ctx),
            ...createTaskTools(ctx),
            ...createSprintTools(ctx),
            ...createTeamTools(ctx),
        ],
    },
}
```

**Prompt Features:**

```markdown
## Project Structure

- Projects contain Sprints
- Sprints contain Tasks
- Tasks are assigned to Team Members

## Agile Awareness

Understand:
- Sprint planning and capacity
- Story points and velocity
- Blockers and dependencies

## Reporting Capabilities

Can generate:
- Sprint burndown status
- Task completion reports
- Team workload distribution
```

## Advanced Prompt Techniques

### Dynamic Context Injection

```typescript
function buildDynamicPrompt(basePrompt: string, context: any): string {
    let prompt = basePrompt

    // Inject user preferences
    if (context.userPreferences) {
        prompt += `\n\n## User Preferences\n${context.userPreferences}`
    }

    // Inject recent activity
    if (context.recentActivity) {
        prompt += `\n\n## Recent Activity\n${context.recentActivity}`
    }

    return prompt
}
```

### Conditional Tool Loading

```typescript
createTools: (context) => {
    const tools = [...coreTools(context)]

    // Add admin tools for admins
    if (context.userRole === 'admin') {
        tools.push(...adminTools(context))
    }

    // Add premium tools for paid users
    if (context.isPremium) {
        tools.push(...premiumTools(context))
    }

    return tools
}
```

### Personalized Responses

```markdown
## Response Personalization

Based on user profile:
- **New users**: Provide more explanation, offer tips
- **Power users**: Be concise, skip basics
- **Technical users**: Include IDs, technical details
- **Non-technical users**: Use simple language, avoid jargon
```

## Model Selection Strategy

### By Task Type

| Task Type | Recommended Model | Reasoning |
|-----------|-------------------|-----------|
| Routing | gpt-4o-mini / qwen2.5:7b | Fast, accurate for classification |
| Data CRUD | qwen2.5:7b / llama3.2:3b | Simple operations, low latency |
| Creative | gpt-4o / claude-3-sonnet | Better quality for content |
| Analysis | gpt-4o | Complex reasoning |

### By Importance

```typescript
export const AGENTS = {
    // Critical path - use best model
    'checkout-assistant': {
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0.1,
    },

    // Standard operations - use fast model
    'inventory-checker': {
        provider: 'ollama',
        temperature: 0.2,
    },

    // Background tasks - use cheapest
    'report-generator': {
        provider: 'ollama',
        temperature: 0.3,
    },
}
```

## Error Handling Strategies

### Graceful Degradation

```typescript
async function processWithFallback(message, context) {
    try {
        // Try orchestrated flow
        return await processWithOrchestrator(message, context)
    } catch (orchestratorError) {
        console.warn('Orchestrator failed, falling back to single agent')

        try {
            // Fall back to single agent
            return await processSingleAgent(message, context)
        } catch (singleError) {
            // Last resort - provide helpful error
            return {
                content: 'Lo siento, estoy teniendo problemas. Por favor intenta de nuevo.',
                error: true,
            }
        }
    }
}
```

### Retry with Different Model

```typescript
async function chatWithRetry(agent, message, maxRetries = 2) {
    for (let i = 0; i <= maxRetries; i++) {
        try {
            return await agent.chat(message)
        } catch (error) {
            if (i === maxRetries) throw error

            // Try with different model on retry
            agent = await createAgentWithFallbackModel(agent.config)
        }
    }
}
```

## Performance Optimization

### Caching Strategies

```typescript
const promptCache = new Map<string, string>()
const toolCache = new Map<string, any[]>()

function getTools(agentName: string, context: ToolContext) {
    const cacheKey = `${agentName}-${context.teamId}`

    if (!toolCache.has(cacheKey)) {
        toolCache.set(cacheKey, createToolsForAgent(agentName, context))
    }

    return toolCache.get(cacheKey)
}
```

### Parallel Tool Loading

```typescript
async function initializeAgents(context) {
    // Load all agents in parallel
    const [taskAgent, customerAgent, pageAgent] = await Promise.all([
        createAgent({ ...taskConfig, context }),
        createAgent({ ...customerConfig, context }),
        createAgent({ ...pageConfig, context }),
    ])

    return { taskAgent, customerAgent, pageAgent }
}
```

## Testing Customizations

### Unit Testing Prompts

```typescript
describe('Orchestrator Routing', () => {
    it('routes task requests correctly', async () => {
        const result = await orchestrator.chat('Show me my tasks')
        expect(result.agentUsed).toBe('task')
    })

    it('handles context references', async () => {
        await orchestrator.chat('Show customer StartupXYZ')
        const result = await orchestrator.chat('Update their phone')
        expect(result.agentUsed).toBe('customer')
    })
})
```

### Integration Testing

```typescript
describe('Full Workflow', () => {
    it('completes task creation flow', async () => {
        const response = await processWithOrchestrator(
            'Create a task to review the proposal',
            testContext
        )

        expect(response.content).toContain('created')
        expect(response.content).toMatch(/\/dashboard\/tasks\//)
    })
})
```

## Next Steps

- [API Reference](./01-api-reference.md) - Complete API documentation
- [Examples](./03-examples.md) - Real-world implementation examples
