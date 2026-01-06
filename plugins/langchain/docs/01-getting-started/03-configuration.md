# Configuration

This guide covers theme-level configuration of the LangChain plugin. All agent definitions, provider settings, and tool factories are configured here.

## Configuration File

The central configuration file is located at:

```
contents/themes/your-theme/lib/langchain/langchain.config.ts
```

This file is the **single source of truth** for all agent configuration in your theme.

## Basic Structure

```typescript
import type {
    ThemeLangChainConfig,
    AgentDefinition,
    AgentContext,
} from '@/contents/plugins/langchain/types/langchain.types'
// Note: createAgentHelpers must be imported from lib/agent-helpers directly
// It is NOT exported from the main plugin entry point
import { createAgentHelpers } from '@/contents/plugins/langchain/lib/agent-helpers'

// 1. Import your tool factories
import { createEntityTools } from './tools/entities'

// 2. Define agents
export const AGENTS: Record<string, AgentDefinition> = {
    'my-agent': {
        provider: 'ollama',
        temperature: 0.3,
        description: 'What this agent does',
        systemPrompt: 'my-agent',  // loads agents/my-agent.md
        createTools: (context: AgentContext) => createEntityTools(context),
    },
}

// 3. Theme configuration
export const langchainConfig: ThemeLangChainConfig = {
    defaultProvider: 'ollama',
    defaultTemperature: 0.3,
    agents: AGENTS,
}

// 4. Create and export helpers
const helpers = createAgentHelpers(AGENTS, {
    provider: langchainConfig.defaultProvider,
    temperature: langchainConfig.defaultTemperature,
})

export const {
    getAgentConfig,
    getAgentModelConfig,
    getAgentTools,
    getAgentPromptName,
    getAgentSessionConfig,
    getAgentEnrichContext,
    hasAgent,
    getAgentNames,
} = helpers
```

## Agent Definition

Each agent is defined with the following properties:

```typescript
interface AgentDefinition {
    // LLM Provider
    provider: 'openai' | 'anthropic' | 'ollama'

    // Optional: Model override (defaults to env config)
    model?: string

    // Creativity level (0 = deterministic, 1 = creative)
    temperature?: number

    // Documentation
    description?: string

    // System prompt filename or inline prompt
    // Supports Handlebars templates: {{user.name}}, {{#if isAdmin}}...{{/if}}
    systemPrompt?: string

    // Tool factory function
    createTools?: (context: AgentContext) => ToolDefinition[]

    // Memory customization (TTL, maxMessages)
    sessionConfig?: SessionConfig

    // Inject runtime data into prompt templates
    enrichContext?: (context: AgentContext) => Promise<AgentContext>
}
```

### Session Configuration

Customize memory behavior per agent:

```typescript
interface SessionConfig {
    // Maximum messages to keep (sliding window)
    maxMessages?: number  // Default: 50

    // TTL in hours (null = no expiration)
    ttlHours?: number | null  // Default: null
}
```

Example for a sales bot with expiring conversations:

```typescript
'sales-assistant': {
    provider: 'openai',
    sessionConfig: {
        ttlHours: 24,      // Conversations expire after 24 hours
        maxMessages: 100,  // Keep more messages for context
    },
}
```

### Context Enrichment

Inject runtime data for dynamic prompt templates:

```typescript
'my-agent': {
    provider: 'ollama',
    systemPrompt: 'my-agent',  // Template with {{user.name}}, etc.

    enrichContext: async ({ userId, teamId }) => {
        const user = await UsersService.getById(userId)
        return {
            userId,
            teamId,
            user: { name: user.name, email: user.email },
        }
    },
}
```

The enriched context is used to render Handlebars templates in the system prompt.

### Provider Selection

Choose the provider based on your use case:

| Provider | Best For | Cost |
|----------|----------|------|
| `ollama` | Development, local testing | Free |
| `openai` | Production, high quality | Pay per token |
| `anthropic` | Alternative production | Pay per token |

### Temperature Settings

```typescript
// Low temperature: Consistent, factual responses
{ temperature: 0.1 }  // Best for: Data retrieval, routing, orchestrators

// Medium temperature: Balanced
{ temperature: 0.3 }  // Best for: General assistants

// High temperature: Creative responses
{ temperature: 0.7 }  // Best for: Content generation
```

> **Plugin Default:** The plugin's default temperature is `0.1` for maximum consistency. Theme configurations typically override this to `0.3` for more conversational agents. Orchestrators should always use `0.1` for reliable routing.

### System Prompt Loading

The `systemPrompt` field supports two modes:

```typescript
// 1. Filename (loads from agents/my-agent.md)
systemPrompt: 'my-agent'

// 2. Inline prompt (contains newlines)
systemPrompt: `You are a helpful assistant.
You help users manage their tasks.`
```

## Using Presets

The plugin provides a configuration preset as a starting point:

```bash
cp contents/plugins/langchain/presets/lib/langchain.config.ts.preset \
   contents/themes/your-theme/lib/langchain/langchain.config.ts
```

### Preset Contents

```typescript
// From presets/lib/langchain.config.ts.preset

export const AGENTS: Record<string, AgentDefinition> = {
    // Single unified agent with all tools
    'single-agent': {
        provider: 'ollama',
        temperature: 0.3,
        description: 'Unified agent with access to all entity tools',
        systemPrompt: 'single-agent',
        createTools: (context: AgentContext) => [
            ...createEntityATools(context),
            ...createEntityBTools(context),
        ],
    },

    // Orchestrator for multi-agent routing
    'orchestrator': {
        provider: 'ollama',
        temperature: 0.1,  // Low for consistent routing
        description: 'Routes requests to specialized agents',
        systemPrompt: 'orchestrator',
        createTools: () => createOrchestratorTools(),
    },

    // Specialized agent for Entity A
    'entity-a-assistant': {
        provider: 'ollama',
        temperature: 0.3,
        description: 'Specialized agent for Entity A management',
        systemPrompt: 'entity-a-assistant',
        createTools: (context: AgentContext) => createEntityATools(context),
    },
}
```

## Real-World Example

Here's a complete configuration from the default theme:

```typescript
// contents/themes/default/lib/langchain/langchain.config.ts

import type {
    ThemeLangChainConfig,
    AgentDefinition,
    AgentContext,
} from '@/contents/plugins/langchain/types/langchain.types'
import { createAgentHelpers } from '@/contents/plugins/langchain/lib/agent-helpers'

import { createTaskTools } from './tools/tasks'
import { createCustomerTools } from './tools/customers'
import { createPageTools } from './tools/pages'
import { createOrchestratorTools } from './tools/orchestrator'

export const AGENTS: Record<string, AgentDefinition> = {
    // Single agent mode: One agent with all tools
    'single-agent': {
        provider: 'ollama',
        temperature: 0.3,
        description: 'Unified agent with access to all entity tools',
        systemPrompt: 'single-agent',
        createTools: (context: AgentContext) => [
            ...createTaskTools(context),
            ...createCustomerTools(context),
            ...createPageTools(context),
        ],
    },

    // Orchestrator: Routes to specialized agents
    'orchestrator': {
        provider: 'ollama',
        temperature: 0.1,
        description: 'Analyzes intent and routes to specialized agents',
        systemPrompt: 'orchestrator',
        createTools: () => createOrchestratorTools(),
    },

    // Task management specialist
    'task-assistant': {
        provider: 'ollama',
        temperature: 0.3,
        description: 'Specialized agent for task management',
        systemPrompt: 'task-assistant',
        createTools: (context: AgentContext) => createTaskTools(context),
    },

    // Customer management specialist
    'customer-assistant': {
        provider: 'ollama',
        temperature: 0.3,
        description: 'Specialized agent for customer management',
        systemPrompt: 'customer-assistant',
        createTools: (context: AgentContext) => createCustomerTools(context),
    },

    // Page/content management specialist
    'page-assistant': {
        provider: 'ollama',
        temperature: 0.3,
        description: 'Specialized agent for page and block management',
        systemPrompt: 'page-assistant',
        createTools: (context: AgentContext) => createPageTools(context),
    },
}

export const langchainConfig: ThemeLangChainConfig = {
    defaultProvider: 'ollama',
    defaultTemperature: 0.3,
    agents: AGENTS,
}

const helpers = createAgentHelpers(AGENTS, {
    provider: langchainConfig.defaultProvider,
    temperature: langchainConfig.defaultTemperature,
})

export const {
    getAgentConfig,
    getAgentModelConfig,
    getAgentTools,
    getAgentPromptName,
    getAgentSessionConfig,
    getAgentEnrichContext,
    hasAgent,
    getAgentNames,
} = helpers
```

## Helper Functions

The `createAgentHelpers` factory creates utility functions for accessing agent configuration:

### getAgentConfig

Get the full configuration for an agent:

```typescript
const config = getAgentConfig('task-assistant')
// {
//   provider: 'ollama',
//   temperature: 0.3,
//   description: '...',
//   systemPrompt: 'task-assistant',
//   createTools: [Function]
// }
```

### getAgentModelConfig

Get only the model-related configuration:

```typescript
const modelConfig = getAgentModelConfig('task-assistant')
// {
//   provider: 'ollama',
//   model: undefined,  // Will use env default
//   temperature: 0.3
// }
```

### getAgentTools

Create tools with the provided context:

```typescript
const tools = getAgentTools('task-assistant', { userId, teamId })
// [ToolDefinition, ToolDefinition, ...]
```

### getAgentPromptName

Get the system prompt filename:

```typescript
const promptName = getAgentPromptName('task-assistant')
// 'task-assistant'
```

### getAgentSessionConfig

Get session configuration for memory customization:

```typescript
const sessionConfig = getAgentSessionConfig('sales-assistant')
// {
//   ttlHours: 24,
//   maxMessages: 100
// }
```

### getAgentEnrichContext

Get the context enrichment function:

```typescript
const enrichContext = getAgentEnrichContext('my-agent')
if (enrichContext) {
    const enrichedContext = await enrichContext({ userId, teamId })
    // { userId, teamId, user: { name: 'John', ... } }
}
```

### hasAgent / getAgentNames

```typescript
hasAgent('task-assistant')  // true
hasAgent('unknown-agent')   // false

getAgentNames()  // ['single-agent', 'orchestrator', 'task-assistant', ...]
```

## Environment-Based Configuration

Models are typically configured via environment variables:

```env
# Ollama
LANGCHAIN_OLLAMA_MODEL=qwen2.5:7b

# OpenAI
LANGCHAIN_OPENAI_MODEL=gpt-4o-mini

# Anthropic
LANGCHAIN_ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

Override per-agent if needed:

```typescript
'premium-agent': {
    provider: 'openai',
    model: 'gpt-4o',  // Override env default
    temperature: 0.3,
    // ...
}
```

## Configuration Patterns

### Pattern 1: Single Agent

Simple applications with one unified agent:

```typescript
export const AGENTS = {
    'assistant': {
        provider: 'ollama',
        temperature: 0.3,
        systemPrompt: 'assistant',
        createTools: (ctx) => [...allTools(ctx)],
    },
}
```

### Pattern 2: Multi-Agent with Orchestrator

Complex applications with domain-specific agents:

```typescript
export const AGENTS = {
    'orchestrator': {
        provider: 'ollama',
        temperature: 0.1,
        systemPrompt: 'orchestrator',
        createTools: () => createRoutingTools(),
    },
    'domain-a': {
        provider: 'ollama',
        temperature: 0.3,
        systemPrompt: 'domain-a',
        createTools: (ctx) => createDomainATools(ctx),
    },
    'domain-b': {
        provider: 'ollama',
        temperature: 0.3,
        systemPrompt: 'domain-b',
        createTools: (ctx) => createDomainBTools(ctx),
    },
}
```

### Pattern 3: Provider Tiering

Different providers for different quality needs:

```typescript
export const AGENTS = {
    // Fast, cheap routing
    'router': {
        provider: 'ollama',
        temperature: 0.1,
        // ...
    },
    // High-quality customer interactions
    'premium-support': {
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0.3,
        // ...
    },
    // Standard operations
    'general': {
        provider: 'ollama',
        temperature: 0.3,
        // ...
    },
}
```

## System Configuration

Beyond agent definitions, the plugin supports system-wide configuration for observability, guardrails, and other features.

### Configuration File Location

```
contents/themes/your-theme/langchain.config.ts
```

### Full Configuration Structure

```typescript
import type { ObservabilityConfig } from '@/contents/plugins/langchain/types/observability.types'
import type { GuardrailsConfig } from '@/contents/plugins/langchain/lib/guardrails'

export interface LangChainConfig {
    observability: ObservabilityConfig
    guardrails?: GuardrailsConfig
}

export const langchainConfig: LangChainConfig = {
    observability: { ... },
    guardrails: { ... },
}
```

---

## Observability Configuration

Controls tracing and monitoring of agent invocations.

```typescript
observability: {
    /** Enable observability tracing */
    enabled: true,

    /** Data retention settings */
    retention: {
        /** Days to keep trace data */
        traces: 30,
    },

    /** Sampling configuration */
    sampling: {
        /** Sample rate (0.0-1.0) - 1.0 = 100% */
        rate: 1.0,
        /** Always trace errors regardless of sample rate */
        alwaysTraceErrors: true,
    },

    /** PII and content processing */
    pii: {
        /** Mask inputs for PII (email, phone, card, SSN patterns) */
        maskInputs: false,
        /** Mask outputs for PII */
        maskOutputs: true,
        /** Truncate content at this length (characters) */
        truncateAt: 10000,
    },
}
```

### Observability Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable/disable tracing |
| `retention.traces` | number | `30` | Days to retain trace data |
| `sampling.rate` | number | `1.0` | Sample rate (0.0-1.0) |
| `sampling.alwaysTraceErrors` | boolean | `true` | Always trace errors |
| `pii.maskInputs` | boolean | `false` | Mask PII in inputs |
| `pii.maskOutputs` | boolean | `true` | Mask PII in outputs |
| `pii.truncateAt` | number | `10000` | Max content length |

### Environment-based Sampling

```typescript
// Development: trace everything
sampling: { rate: 1.0, alwaysTraceErrors: true }

// Production: trace 10% + all errors
sampling: { rate: 0.1, alwaysTraceErrors: true }

// High traffic: trace 1% + errors
sampling: { rate: 0.01, alwaysTraceErrors: true }
```

> **Full Documentation**: [Observability](../04-advanced/01-observability.md)

---

## Guardrails Configuration

Controls security middleware for prompt injection detection, PII masking, and content filtering.

```typescript
guardrails: {
    promptInjection: {
        enabled: true,
        action: 'block',          // 'block' | 'warn' | 'log'
        customPatterns: [],       // Additional regex patterns
    },
    piiMasking: {
        enabled: true,
        types: ['email', 'phone', 'ssn', 'creditCard', 'ipAddress'],
        action: 'mask',           // 'mask' | 'remove' | 'log'
    },
    contentFilter: {
        enabled: true,
        customPatterns: [],       // Content patterns to filter
        action: 'redact',         // 'block' | 'redact'
    },
}
```

### Guardrails Options

| Section | Option | Type | Description |
|---------|--------|------|-------------|
| `promptInjection` | `enabled` | boolean | Enable injection detection |
| | `action` | string | `block`, `warn`, or `log` |
| | `customPatterns` | RegExp[] | Additional detection patterns |
| `piiMasking` | `enabled` | boolean | Enable PII masking |
| | `types` | string[] | PII types to mask |
| | `action` | string | `mask`, `remove`, or `log` |
| `contentFilter` | `enabled` | boolean | Enable output filtering |
| | `customPatterns` | RegExp[] | Patterns to filter |
| | `action` | string | `block` or `redact` |

> **Full Documentation**: [Guardrails](../04-advanced/04-guardrails.md)

---

## Graph Orchestrator Configuration

Enable the modern graph-based orchestration approach.

### Environment Variable

```env
# Enable graph-based orchestrator (recommended)
LANGCHAIN_USE_GRAPH_ORCHESTRATOR=true
```

### Per-Node Model Configuration

The graph orchestrator can use different models for different nodes:

```typescript
// In theme code, when invoking the orchestrator
const result = await invokeOrchestrator(message, sessionId, context, history, {
    modelConfig: {
        router: {
            provider: 'anthropic',
            model: 'claude-3-haiku',
            temperature: 0.1,
        },
        combiner: {
            provider: 'openai',
            model: 'gpt-4o-mini',
            temperature: 0.3,
        },
    },
})
```

### Structured Output Methods

Configure how structured output works for multi-provider compatibility:

| Method | Providers | Description |
|--------|-----------|-------------|
| `functionCalling` | OpenAI, Anthropic | Native function calling |
| `jsonMode` | Most providers | JSON response mode |
| `jsonSchema` | OpenAI | JSON Schema validation |

> **Full Documentation**: [Graph Orchestrator](../03-orchestration/01-graph-orchestrator.md)

---

## Environment Variables

### Provider Configuration

```env
# Default models per provider
LANGCHAIN_OLLAMA_MODEL=qwen2.5:7b
LANGCHAIN_OPENAI_MODEL=gpt-4o-mini
LANGCHAIN_ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# OpenAI-compatible base URL (for LM Studio, local servers)
LANGCHAIN_OPENAI_BASE_URL=http://localhost:1234/v1

# API Keys (auto-detected)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

### Feature Flags

```env
# Enable graph orchestrator (recommended)
LANGCHAIN_USE_GRAPH_ORCHESTRATOR=true

# Debug mode
LANGCHAIN_DEBUG=true
```

---

## Best Practices

### 1. Use Low Temperature for Routing

```typescript
'orchestrator': {
    temperature: 0.1,  // Consistent routing decisions
}
```

### 2. Keep Specialized Agents Focused

Each agent should have only the tools it needs:

```typescript
'task-assistant': {
    createTools: (ctx) => createTaskTools(ctx),  // Only task tools
}
```

### 3. Document Agent Purpose

```typescript
'customer-assistant': {
    description: 'Handles customer CRUD operations and search',
}
```

### 4. Use Environment for Secrets

Never hardcode API keys:

```typescript
// Bad
{ options: { apiKey: 'sk-...' } }

// Good - uses env automatically
{ provider: 'openai' }
```

### 5. Enable Graph Orchestrator

The graph-based orchestrator is significantly more efficient:

```env
LANGCHAIN_USE_GRAPH_ORCHESTRATOR=true
```

### 6. Configure Guardrails for Production

```typescript
// Production guardrails
guardrails: {
    promptInjection: { enabled: true, action: 'block' },
    piiMasking: { enabled: true, action: 'mask' },
    contentFilter: { enabled: true, action: 'redact' },
}
```

### 7. Sample Traces in High-Traffic Production

```typescript
// Reduce tracing overhead
observability: {
    sampling: { rate: 0.1, alwaysTraceErrors: true },
}
```

---

## Next Steps

- [Create agent system prompts](../02-core-concepts/02-agents.md)
- [Build entity tools](../02-core-concepts/03-tools.md)
- [Set up graph orchestration](../03-orchestration/01-graph-orchestrator.md)
- [Configure observability](../04-advanced/01-observability.md)
- [Configure guardrails](../04-advanced/04-guardrails.md)
