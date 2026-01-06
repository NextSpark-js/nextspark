# Architecture

This section explains the technical architecture of the LangChain plugin, including core patterns, data flow, and design decisions.

## System Architecture

### Layer Model

The plugin follows a layered architecture with clear responsibilities:

```
┌─────────────────────────────────────────────────────────────────────┐
│                           API LAYER                                  │
│  Theme API endpoints (e.g., /api/v1/theme/ai/chat)                  │
├─────────────────────────────────────────────────────────────────────┤
│                        THEME LAYER                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Config       │  │ Agents       │  │ Tools        │              │
│  │ Definition   │  │ (Prompts)    │  │ (CRUD ops)   │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
├─────────────────────────────────────────────────────────────────────┤
│                        PLUGIN LAYER                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Agent        │  │ Memory       │  │ Provider     │              │
│  │ Factory      │  │ Store        │  │ Factory      │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│  ┌──────────────┐  ┌──────────────┐                                │
│  │ Tools        │  │ Message      │                                │
│  │ Builder      │  │ Serializer   │                                │
│  └──────────────┘  └──────────────┘                                │
├─────────────────────────────────────────────────────────────────────┤
│                     LANGCHAIN LAYER                                  │
│  LangChain Core | LangGraph | Provider SDKs                        │
├─────────────────────────────────────────────────────────────────────┤
│                     PERSISTENCE LAYER                                │
│  PostgreSQL (langchain_sessions table with RLS)                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Agent Factory

The `createAgent()` function is the entry point for creating AI agents:

```typescript
const agent = await createAgent({
    sessionId: 'user-123-session-1',
    systemPrompt: 'You are a helpful assistant...',
    tools: myTools,
    modelConfig: {
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0.3
    },
    context: { userId, teamId }
})
```

**Responsibilities:**
- Creates the LLM instance from the provider factory
- Converts tool definitions to LangChain tools
- Sets up the ReAct agent graph with LangGraph
- Manages conversation memory (if context provided)
- Provides `chat()` and `getHistory()` methods

**Agent Lifecycle:**

```
createAgent()
    │
    ├─→ getModel(config)           # Get LLM instance
    ├─→ buildTools(toolDefs)       # Convert to LangChain tools
    ├─→ loadHistory(context)       # Load existing messages
    ├─→ createReactAgent(...)      # Build LangGraph agent
    │
    └─→ Returns { chat, getHistory }
```

### 2. Provider Factory

The provider system abstracts LLM access:

```typescript
// Provider factory map
const providers = {
    openai: createOpenAIModel,
    anthropic: createAnthropicModel,
    ollama: createOllamaModel
}

// Get model instance
const model = getModel({ provider: 'openai', model: 'gpt-4o' })
```

**Supported Providers:**

| Provider | SDK | Use Case |
|----------|-----|----------|
| `openai` | `@langchain/openai` | Production, high quality |
| `anthropic` | `@langchain/anthropic` | Production, alternative |
| `ollama` | `@langchain/ollama` | Development, local, free |

**OpenAI-Compatible Servers:**

The `openai` provider supports custom base URLs for compatible servers:

```env
# Use LM Studio locally
LANGCHAIN_OPENAI_BASE_URL=http://localhost:1234/v1
```

### 3. Memory Store

Conversation persistence with multi-tenancy:

```typescript
interface DbMemoryStoreContext {
    userId: string    // User identifier
    teamId: string    // Team identifier
}

const context = { userId: 'user-123', teamId: 'team-456' }

// Get messages for a session (returns LangChain BaseMessage[])
const messages = await memoryStore.getMessages(sessionId, context)

// Add messages to session
await memoryStore.addMessages(sessionId, newMessages, context)

// Session management
// Note: createSession auto-generates sessionId
const { sessionId, createdAt } = await memoryStore.createSession(context, 'My Chat')
await memoryStore.listSessions(context)
// Note: parameter order is (sessionId, value, context)
await memoryStore.renameSession(sessionId, 'New Name', context)
await memoryStore.togglePinSession(sessionId, true, context)
await memoryStore.clearSession(sessionId, context)
```

**Conversation Limits:**

```typescript
const LIMITS = {
    MAX_CONVERSATIONS: 50,           // Per user per team
    MAX_MESSAGES_PER_CONVERSATION: 50  // Sliding window
}
```

### 4. Tools Builder

Converts simple tool definitions to LangChain-compatible tools:

```typescript
interface ToolDefinition<T> {
    name: string
    description: string
    schema: z.ZodSchema<T>
    func: (input: T) => Promise<string>
}

// Usage
const tools = buildTools([
    {
        name: 'get_weather',
        description: 'Get current weather for a city',
        schema: z.object({
            city: z.string().describe('City name')
        }),
        func: async ({ city }) => {
            const weather = await WeatherService.get(city)
            return JSON.stringify(weather)
        }
    }
])
```

### 5. Message Serializer

Handles LangChain message serialization for database storage:

```typescript
interface SerializedMessage {
    type: 'human' | 'ai' | 'system' | 'tool'
    content: string
    name?: string
    tool_call_id?: string
    additional_kwargs?: Record<string, unknown>
}

// Serialize for storage
const serialized = serializeMessages(langchainMessages)

// Deserialize for agent
const messages = deserializeMessages(serialized)
```

## Data Flow

### Single Agent Flow

```
┌─────────┐     ┌─────────────┐     ┌─────────────┐
│  User   │────→│  API Route  │────→│   Agent     │
└─────────┘     └─────────────┘     └──────┬──────┘
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    │                      ▼                      │
                    │              ┌─────────────┐                │
                    │              │    LLM      │                │
                    │              └──────┬──────┘                │
                    │                     │                       │
                    │         ┌───────────┴───────────┐           │
                    │         ▼                       ▼           │
                    │  ┌─────────────┐         ┌─────────────┐    │
                    │  │  Tool Call  │         │   Response  │    │
                    │  └──────┬──────┘         └─────────────┘    │
                    │         │                                   │
                    │         ▼                                   │
                    │  ┌─────────────┐                            │
                    │  │  Service    │                            │
                    │  │  (RLS)      │                            │
                    │  └──────┬──────┘                            │
                    │         │                                   │
                    │         ▼                                   │
                    │  ┌─────────────┐                            │
                    │  │  Database   │                            │
                    │  └─────────────┘                            │
                    │                                             │
                    │              AGENT LOOP                     │
                    └─────────────────────────────────────────────┘
```

### Graph-Based Orchestrator Flow (Recommended)

The graph-based orchestrator uses a **state machine** approach instead of ReAct loops:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GRAPH ORCHESTRATOR                                   │
│                                                                              │
│   ┌─────────┐                                                                │
│   │  START  │                                                                │
│   └────┬────┘                                                                │
│        │                                                                     │
│        ▼                                                                     │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                        ROUTER NODE                                   │   │
│   │  • Structured output (Zod validation)                               │   │
│   │  • Intent classification: task, customer, page, greeting, unclear   │   │
│   │  • Multi-provider compatible (OpenAI, Anthropic, Ollama)            │   │
│   │  • Single LLM call with retry logic                                 │   │
│   └─────────────────────────────────────────┬───────────────────────────┘   │
│                                             │                                │
│           ┌─────────────┬──────────────────┼──────────────────┬─────────┐   │
│           ▼             ▼                  ▼                  ▼         ▼   │
│   ┌───────────┐  ┌───────────┐     ┌───────────┐     ┌───────────┐  ┌────┐ │
│   │   Task    │  │ Customer  │     │   Page    │     │ Greeting  │  │END │ │
│   │  Handler  │  │  Handler  │     │  Handler  │     │ Handler   │  │    │ │
│   │ (0 LLM)   │  │  (0 LLM)  │     │  (0 LLM)  │     │ (0 LLM)   │  │    │ │
│   └─────┬─────┘  └─────┬─────┘     └─────┬─────┘     └─────┬─────┘  └────┘ │
│         │              │                 │                 │               │
│         └──────────────┴────────┬────────┴─────────────────┘               │
│                                 │                                           │
│                                 ▼                                           │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                       COMBINER NODE                                  │   │
│   │  • Aggregates handler results                                       │   │
│   │  • Template-based for single intent (0 LLM calls)                   │   │
│   │  • LLM synthesis for multi-intent (1 LLM call)                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                 │                                           │
│                                 ▼                                           │
│                           ┌─────────┐                                       │
│                           │   END   │                                       │
│                           └─────────┘                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Advantages over ReAct:**

| Aspect | Graph Orchestrator | ReAct Loop |
|--------|-------------------|------------|
| **LLM Calls** | 1-2 per request | 50+ possible |
| **Latency** | 2-3 seconds | 10-15+ seconds |
| **Predictability** | Deterministic flow | Non-deterministic |
| **Recursion Limits** | Never hit | Frequent issue |
| **Cost** | ~$0.001/request | ~$0.05/request |

> **Full Documentation**: See [Graph Orchestrator](../03-orchestration/01-graph-orchestrator.md) for complete details.

### Legacy Orchestrator Flow (Deprecated)

> **Note**: This approach is deprecated. Use the graph-based orchestrator instead.

```
┌─────────┐     ┌─────────────────┐     ┌─────────────────┐
│  User   │────→│  Orchestrator   │────→│ Routing Tools   │
└─────────┘     └────────┬────────┘     └────────┬────────┘
                         │                       │
                         │    ┌──────────────────┘
                         │    │
                         ▼    ▼
                ┌────────────────────────┐
                │   Routing Decision     │
                │   { agent, message }   │
                └───────────┬────────────┘
                            │
           ┌────────────────┼────────────────┐
           ▼                ▼                ▼
    ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
    │ Task Agent  │  │ Customer    │  │ Page Agent  │
    │             │  │ Agent       │  │             │
    └─────────────┘  └─────────────┘  └─────────────┘
```

## Design Patterns

### Factory Pattern

Used for creating agents and LLM instances:

```typescript
// Agent Factory
const agent = await createAgent(config)

// Provider Factory
const model = getModel(modelConfig)

// Helper Factory
const helpers = createAgentHelpers(agents, defaults)
```

### Facade Pattern

The memory store provides a simplified interface:

```typescript
// External interface (memoryStore)
memoryStore.getMessages(sessionId, context)

// Internal implementation (dbMemoryStore)
dbMemoryStore.getMessages(sessionId, context)
```

### Strategy Pattern

Tool factories allow themes to define custom strategies:

```typescript
// Each agent has its own tool strategy
createTools: (context) => [
    // Theme-specific tools
]
```

### Template Pattern

Presets provide templates for common patterns:

```
presets/
├── lib/langchain.config.ts.preset    # Configuration template
├── api/chat/route.ts.preset          # API endpoint template
├── lib/tools/entity-tools.ts.preset  # Tools template
└── agents/entity-assistant.md.preset # Prompt template
```

## Security Architecture

### Multi-Tenancy

All data is isolated by `userId` + `teamId`:

```sql
-- Every query includes tenant context
SELECT * FROM langchain_sessions
WHERE "userId" = $1 AND "teamId" = $2 AND "sessionId" = $3
```

### Row-Level Security

The database table has RLS policies:

```sql
-- Only owner can access their sessions
CREATE POLICY langchain_sessions_policy ON langchain_sessions
    USING (
        "userId" = current_setting('app.user_id')::text
        AND "teamId" = current_setting('app.team_id')::text
    );
```

### Tool-Level Authorization

Tools receive context for authorization:

```typescript
createTools: (context: ToolContext) => [
    {
        func: async (input) => {
            // context.userId and context.teamId available
            // Service calls use these for RLS
            return TasksService.list(context.userId, input)
        }
    }
]
```

## Performance Considerations

### Message Limits

Conversations use a sliding window to control token usage:

```typescript
// Only last 50 messages are kept
if (messages.length > MAX_MESSAGES) {
    messages = messages.slice(-MAX_MESSAGES)
}
```

### No Dynamic Imports

All imports are static for optimal bundling:

```typescript
// Good - static import
import { createAgent } from '@/contents/plugins/langchain/lib/agent-factory'

// Bad - dynamic import (not used)
const agent = await import('@/contents/plugins/langchain')
```

### Caching

Session data is cached in memory during agent lifetime:

```typescript
const agent = await createAgent(config)
// First call loads from DB
await agent.chat('Hello')
// Subsequent calls use cached history
await agent.chat('How are you?')
```

## Database Schema

```sql
CREATE TABLE public."langchain_sessions" (
    id              TEXT PRIMARY KEY,

    -- Multi-tenancy keys
    "userId"        TEXT NOT NULL REFERENCES users(id),
    "teamId"        TEXT NOT NULL REFERENCES teams(id),
    "sessionId"     TEXT NOT NULL,

    -- Metadata
    name            TEXT DEFAULT NULL,
    "isPinned"      BOOLEAN DEFAULT false,

    -- Message storage
    messages        JSONB NOT NULL DEFAULT '[]',
    metadata        JSONB DEFAULT '{}',
    "maxMessages"   INTEGER DEFAULT 50,
    "expiresAt"     TIMESTAMPTZ DEFAULT NULL,

    -- Timestamps
    "createdAt"     TIMESTAMPTZ DEFAULT now(),
    "updatedAt"     TIMESTAMPTZ DEFAULT now(),

    UNIQUE ("userId", "teamId", "sessionId")
);

-- Performance indexes
CREATE INDEX idx_sessions_lookup
    ON langchain_sessions("userId", "teamId", "sessionId");
CREATE INDEX idx_sessions_pinned
    ON langchain_sessions("userId", "teamId", "isPinned");
CREATE INDEX idx_sessions_updated
    ON langchain_sessions("userId", "teamId", "updatedAt" DESC);
```

## Supporting Systems

### Observability Layer

End-to-end tracing for debugging and monitoring:

```
┌─────────────────────────────────────────────────────────────┐
│                    TRACE RECORD                              │
│  traceId: abc-123                                           │
│  ├─ Span: router (llm)          1200ms                      │
│  ├─ Span: task_handler (tool)    340ms                      │
│  └─ Span: combiner (llm)         800ms                      │
│                                                              │
│  Total: 2340ms | Tokens: 230 | Cost: $0.002                 │
└─────────────────────────────────────────────────────────────┘
```

- **Traces**: Complete agent invocations
- **Spans**: Individual operations (LLM calls, tool calls)
- **Metrics**: Aggregate performance data
- **Dashboard**: Visual debugging at `/sector7/ai-observability`

> **Documentation**: [Observability](../04-advanced/01-observability.md)

### Token & Cost Tracking

Per-request and aggregate usage tracking:

```
LLM Request → Token Usage → Cost Calculation → Database → Analytics
                ↓               ↓
          inputTokens      pricing table
          outputTokens          ↓
                          totalCost (USD)
```

- Track input/output tokens per request
- Calculate costs based on model pricing
- Dashboard at `/dashboard/settings/ai-usage`

> **Documentation**: [Token Tracking](../04-advanced/02-token-tracking.md)

### Streaming (SSE)

Real-time token-by-token responses:

```
User Request → streamChat() → SSE Response
                   │
                   ├─→ { type: 'token', content: 'Hello' }
                   ├─→ { type: 'tool_start', toolName: 'list_tasks' }
                   ├─→ { type: 'tool_end', result: [...] }
                   └─→ { type: 'done', fullContent: '...' }
```

> **Documentation**: [Streaming](../04-advanced/03-streaming.md)

### Guardrails & Security

Multi-layer protection for AI interactions:

```
User Input → [Injection Check] → [PII Mask] → Agent → [Content Filter] → Response
```

- **Prompt Injection Detection**: Block manipulation attempts
- **PII Masking**: Redact sensitive data (emails, phones, etc.)
- **Content Filtering**: Filter inappropriate outputs

> **Documentation**: [Guardrails](../04-advanced/04-guardrails.md)

---

## Next Steps

- [Installation](../01-getting-started/02-installation.md) - Set up the plugin
- [Configuration](../01-getting-started/03-configuration.md) - Configure agents at the theme level
- [Graph Orchestrator](../03-orchestration/01-graph-orchestrator.md) - Modern orchestration approach
- [Observability](../04-advanced/01-observability.md) - Tracing and debugging
- [Token Tracking](../04-advanced/02-token-tracking.md) - Usage and cost monitoring
- [Streaming](../04-advanced/03-streaming.md) - Real-time responses
- [Guardrails](../04-advanced/04-guardrails.md) - Security middleware
