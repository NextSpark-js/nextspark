# API Reference

Complete API documentation for the LangChain plugin.

## Import Paths

The plugin does not have a central entry point. Import from specific modules:

```typescript
// Agent Factory
import { createAgent } from '@/contents/plugins/langchain/lib/agent-factory'

// Tool System
import { createTool, buildTools, type ToolDefinition } from '@/contents/plugins/langchain/lib/tools-builder'

// Memory Store
import {
    memoryStore,
    dbMemoryStore,
    generateSessionId,
    CONVERSATION_LIMITS,
    type DbMemoryStoreContext,
    type SessionConfig,
    type ConversationInfo,
} from '@/contents/plugins/langchain/lib/memory-store'

// Message Serialization
import {
    serializeMessages,
    deserializeMessages,
    type SerializedMessage,
} from '@/contents/plugins/langchain/lib/message-serializer'

// Providers
import {
    createOllamaModel,
    createOpenAIModel,
    createAnthropicModel,
    getModel,
} from '@/contents/plugins/langchain/lib/providers'

// Provider Availability
import {
    isProviderAvailable,
    getAvailableProviders,
} from '@/contents/plugins/langchain/plugin.config'

// Types
import type {
    ModelConfig,
    LLMProvider,
    ThemeLangChainConfig,
    AgentConfig,
    AgentResponse,
    AgentDefinition,
    ToolContext,
    ChatMessage,
} from '@/contents/plugins/langchain/types/langchain.types'

// Theme Helper Factory
import { createAgentHelpers } from '@/contents/plugins/langchain/lib/agent-helpers'
```

> **Note:** There is no central `index.ts` for this plugin. Import directly from the module that provides the functionality you need.

---

## createAgent

Creates a new AI agent instance.

### Signature

```typescript
function createAgent(config: AgentConfig): Promise<Agent>
```

### Parameters

```typescript
interface AgentConfig {
    // Required: Unique session identifier
    sessionId: string

    // Optional: System prompt for agent behavior
    systemPrompt?: string

    // Optional: Tools the agent can use
    tools?: ToolDefinition<any>[]

    // Optional: Model configuration
    modelConfig?: Partial<ModelConfig>

    // Optional: Context for memory persistence (RECOMMENDED)
    // Without context, conversation history won't be persisted
    context?: {
        userId: string
        teamId: string
    }
}

interface ModelConfig {
    provider: 'openai' | 'anthropic' | 'ollama'
    model?: string
    temperature?: number
    maxTokens?: number
    options?: {
        apiKey?: string
        baseUrl?: string
    }
}
```

### Returns

```typescript
interface Agent {
    // Send a message and get a response
    chat(message: string): Promise<AgentResponse>

    // Get conversation history (requires context)
    getHistory(): Promise<ChatMessage[]>
}

interface AgentResponse {
    content: string
    sessionId: string
    messages: BaseMessage[]  // Full LangChain message array from the turn
}
```

> **Note:** The `messages` field contains the complete LangChain message array including tool calls and responses. This is always present and is essential for extracting tool results in orchestration patterns.

### Example

```typescript
const agent = await createAgent({
    sessionId: `user-${userId}-${Date.now()}`,
    systemPrompt: 'You are a helpful assistant.',
    tools: [
        {
            name: 'get_time',
            description: 'Get current time',
            schema: z.object({}),
            func: async () => new Date().toISOString(),
        },
    ],
    modelConfig: {
        provider: 'ollama',
        temperature: 0.3,
    },
    // IMPORTANT: Always provide context for conversation persistence
    context: { userId, teamId },
})

const response = await agent.chat('What time is it?')
console.log(response.content)

// Access full message history including tool calls
console.log(response.messages)
```

> **Warning:** If you omit `context`, the agent will still work but conversations won't be persisted to the database. A warning will be logged in development mode.

---

## buildTools

Converts tool definitions to LangChain DynamicStructuredTool instances.

### Signature

```typescript
function buildTools(definitions: ToolDefinition<any>[]): DynamicStructuredTool[]
```

### Parameters

```typescript
interface ToolDefinition<T extends z.ZodObject<any>> {
    // Unique tool identifier
    name: string

    // Description for the LLM (IMPORTANT: this is what the model reads)
    description: string

    // Zod schema for input validation
    schema: T

    // Async function that executes the tool
    // MUST return a string (JSON.stringify for objects)
    func: (input: z.infer<T>) => Promise<string>
}
```

### Example

```typescript
const toolDefs: ToolDefinition<any>[] = [
    {
        name: 'add_numbers',
        description: 'Add two numbers together',
        schema: z.object({
            a: z.number().describe('First number'),
            b: z.number().describe('Second number'),
        }),
        func: async ({ a, b }) => JSON.stringify({ result: a + b }),
    },
]

const langChainTools = buildTools(toolDefs)
```

---

## createTool

Creates a single LangChain DynamicStructuredTool from a tool definition. Use this when you need to create individual tools rather than batches.

### Signature

```typescript
function createTool<T extends z.ZodObject<any>>(def: ToolDefinition<T>): DynamicStructuredTool
```

### Example

```typescript
import { createTool } from '@/contents/plugins/langchain/lib/tools-builder'

const weatherTool = createTool({
    name: 'get_weather',
    description: 'Get current weather for a city',
    schema: z.object({
        city: z.string().describe('City name'),
    }),
    func: async ({ city }) => {
        const weather = await fetchWeather(city)
        return JSON.stringify(weather)
    },
})

// Use directly with LangChain
const agent = createReactAgent({
    llm: model,
    tools: [weatherTool],
})
```

> **Note:** Most theme code should use `buildTools()` for convenience. Use `createTool()` when integrating with raw LangChain APIs or when you need individual tool instances.

---

## memoryStore

Interface for conversation persistence. All methods are async and require context for multi-tenancy.

### Type: DbMemoryStoreContext

```typescript
interface DbMemoryStoreContext {
    userId: string
    teamId: string
}
```

### Type: SessionConfig

Optional configuration for session behavior.

```typescript
interface SessionConfig {
    /** Maximum messages to keep (sliding window). Default: 50 */
    maxMessages?: number
    /** TTL in hours. null = no expiration (default) */
    ttlHours?: number | null
}
```

**Usage:**
```typescript
// Use custom message limit
await memoryStore.addMessages(sessionId, messages, context, {
    maxMessages: 100,  // Keep more messages
})

// Use expiring sessions (e.g., for temporary support chats)
await memoryStore.addMessages(sessionId, messages, context, {
    ttlHours: 24,  // Expire after 24 hours
})
```

> **Note:** By default, sessions never expire and use a 50-message sliding window.

### Methods

#### getMessages

Get messages for a session. Returns LangChain BaseMessage instances.

```typescript
memoryStore.getMessages(
    sessionId: string,
    context: DbMemoryStoreContext
): Promise<BaseMessage[]>
```

#### addMessages

Add messages to a session. Automatically creates the session if it doesn't exist.

```typescript
memoryStore.addMessages(
    sessionId: string,
    messages: BaseMessage[],
    context: DbMemoryStoreContext,
    config?: SessionConfig
): Promise<void>
```

> **Note:** Messages are stored using a sliding window. When the limit (default: 50) is reached, older messages are automatically removed.

#### createSession

Create a new empty session. Returns an auto-generated sessionId.

```typescript
memoryStore.createSession(
    context: DbMemoryStoreContext,
    name?: string
): Promise<{ sessionId: string; createdAt: Date }>
```

**Example:**
```typescript
const context = { userId: 'user-123', teamId: 'team-456' }

// Create session (sessionId is auto-generated using userId + timestamp)
const { sessionId, createdAt } = await memoryStore.createSession(context, 'My Chat')
console.log(sessionId) // e.g., 'user-123-1704067200000'
```

#### listSessions

List all sessions for a user in a team.

```typescript
memoryStore.listSessions(
    context: DbMemoryStoreContext
): Promise<ConversationInfo[]>

interface ConversationInfo {
    sessionId: string
    name: string | null
    messageCount: number
    firstMessage: string | null
    isPinned: boolean
    createdAt: Date   // Note: Date object, not string
    updatedAt: Date   // Note: Date object, not string
}
```

#### getSession

Get full session info. Returns null if not found.

```typescript
memoryStore.getSession(
    sessionId: string,
    context: DbMemoryStoreContext
): Promise<ConversationInfo | null>
```

#### renameSession

Rename a session.

```typescript
memoryStore.renameSession(
    sessionId: string,
    name: string,           // Note: name comes BEFORE context
    context: DbMemoryStoreContext
): Promise<void>
```

#### togglePinSession

Toggle pin status of a session.

```typescript
memoryStore.togglePinSession(
    sessionId: string,
    isPinned: boolean,      // Note: isPinned comes BEFORE context
    context: DbMemoryStoreContext
): Promise<void>
```

#### clearSession

Delete a session and all its messages.

```typescript
memoryStore.clearSession(
    sessionId: string,
    context: DbMemoryStoreContext
): Promise<void>
```

#### countSessions

Count sessions for limit enforcement.

```typescript
memoryStore.countSessions(
    context: DbMemoryStoreContext
): Promise<number>
```

#### cleanup

Remove expired sessions (if TTL is set).

```typescript
memoryStore.cleanup(): Promise<number>
// Returns: number of sessions cleaned up
```

### Complete Example

```typescript
const context = { userId: 'user-123', teamId: 'team-456' }

// Create a new session (sessionId auto-generated)
const { sessionId } = await memoryStore.createSession(context, 'My Chat')

// List all sessions
const sessions = await memoryStore.listSessions(context)
console.log(`You have ${sessions.length} conversations`)

// Get messages from a session
const messages = await memoryStore.getMessages(sessionId, context)

// Rename the session (note parameter order!)
await memoryStore.renameSession(sessionId, 'Renamed Chat', context)

// Pin the session (note parameter order!)
await memoryStore.togglePinSession(sessionId, true, context)

// Check session count before creating new ones
const count = await memoryStore.countSessions(context)
if (count >= 50) {
    console.log('Maximum conversations reached!')
}

// Clean up
await memoryStore.clearSession(sessionId, context)
```

---

## Message Serialization

### serializeMessages

Convert LangChain messages to JSON-serializable format.

```typescript
function serializeMessages(messages: BaseMessage[]): SerializedMessage[]

interface SerializedMessage {
    type: 'human' | 'ai' | 'system' | 'tool'
    content: string
    name?: string
    additional_kwargs?: Record<string, unknown>
    response_metadata?: Record<string, unknown>
    tool_call_id?: string
}
```

### deserializeMessages

Convert serialized messages back to LangChain format.

```typescript
function deserializeMessages(messages: SerializedMessage[]): BaseMessage[]
```

### Example

```typescript
// Serialize for custom storage
const serialized = serializeMessages(langchainMessages)
const json = JSON.stringify(serialized)

// Deserialize when loading
const parsed = JSON.parse(json)
const messages = deserializeMessages(parsed)
```

> **Note:** The memoryStore handles serialization automatically. You only need these functions if implementing custom storage.

---

## Provider Functions

### getModel

Get an LLM instance based on configuration.

```typescript
function getModel(config: Partial<ModelConfig>): BaseChatModel
```

### isProviderAvailable

Check if a provider is configured and available.

```typescript
function isProviderAvailable(provider: LLMProvider): boolean
```

### getAvailableProviders

List all configured providers.

```typescript
function getAvailableProviders(): LLMProvider[]
```

### createOllamaModel

```typescript
function createOllamaModel(config?: {
    model?: string
    temperature?: number
    baseUrl?: string
}): ChatOllama
```

### createOpenAIModel

```typescript
function createOpenAIModel(config?: {
    model?: string
    temperature?: number
    apiKey?: string
    baseUrl?: string  // For OpenAI-compatible servers like LM Studio
}): ChatOpenAI
```

### createAnthropicModel

```typescript
function createAnthropicModel(config?: {
    model?: string
    temperature?: number
    apiKey?: string
}): ChatAnthropic
```

### Example

```typescript
// Check available providers
const providers = getAvailableProviders()
// ['ollama', 'openai'] (depends on env config)

// Check specific provider
if (isProviderAvailable('anthropic')) {
    const model = createAnthropicModel({
        model: 'claude-3-5-sonnet-20241022',
        temperature: 0.3,
    })
}

// Get model from config (uses env defaults)
const model = getModel({
    provider: 'ollama',
    temperature: 0.3,
})
```

---

## generateSessionId

Utility to generate unique session IDs. Must be imported from memory-store.

```typescript
import { generateSessionId } from '@/contents/plugins/langchain/lib/memory-store'

function generateSessionId(userId: string): string
// Returns: '{userId}-{timestamp}'
// Example: 'user-123-1704067200000'
```

> **Note:** The generated ID combines the userId with a timestamp for uniqueness and traceability.

### Example

```typescript
import { generateSessionId } from '@/contents/plugins/langchain/lib/memory-store'

const sessionId = generateSessionId('user-123')
// 'user-123-1704067200000'
```

---

## Theme Helper Factory

Must be imported directly from the lib folder.

```typescript
import { createAgentHelpers } from '@/contents/plugins/langchain/lib/agent-helpers'

function createAgentHelpers(
    agents: Record<string, AgentDefinition>,
    defaults: {
        provider?: LLMProvider
        model?: string
        temperature?: number
    }
): AgentHelpers

interface AgentHelpers {
    getAgentConfig(name: string): AgentDefinition | undefined
    getAgentModelConfig(name: string): Partial<ModelConfig> | undefined
    getAgentTools(name: string, context: ToolContext): ToolDefinition<any>[]
    getAgentPromptName(name: string): string | undefined
    hasAgent(name: string): boolean
    getAgentNames(): string[]
}
```

### Example

```typescript
import { createAgentHelpers } from '@/contents/plugins/langchain/lib/agent-helpers'

const helpers = createAgentHelpers(AGENTS, {
    provider: 'ollama',
    temperature: 0.3,
})

// Check if agent exists
if (helpers.hasAgent('task-assistant')) {
    const config = helpers.getAgentConfig('task-assistant')
    const tools = helpers.getAgentTools('task-assistant', { userId, teamId })
}

// List all agents
const agentNames = helpers.getAgentNames()
// ['single-agent', 'orchestrator', 'task-assistant', ...]
```

---

## Types

### LLMProvider

```typescript
type LLMProvider = 'openai' | 'anthropic' | 'ollama'
```

### AgentDefinition

```typescript
interface AgentDefinition {
    provider: LLMProvider
    model?: string
    temperature?: number
    description?: string
    systemPrompt?: string  // Filename (loads .md) or inline string (contains \n)
    createTools?: (context: ToolContext) => ToolDefinition<any>[]
}
```

### ThemeLangChainConfig

```typescript
interface ThemeLangChainConfig {
    defaultProvider: LLMProvider
    defaultModel?: string
    defaultTemperature?: number
    agents?: Record<string, AgentDefinition>
}
```

### ToolContext

```typescript
interface ToolContext {
    userId: string
    teamId: string
}
```

### ChatMessage

Used for UI display (different from LangChain BaseMessage).

```typescript
interface ChatMessage {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: number  // Unix timestamp in milliseconds
}
```

---

## REST API Endpoints

The plugin provides REST endpoints via `api/sessions/route.ts`.

> **Date Format Note:** REST API responses serialize dates as ISO 8601 strings (e.g., `"2024-01-01T00:00:00.000Z"`), while `memoryStore` methods return JavaScript `Date` objects. When using the REST API, parse dates with `new Date(response.data.createdAt)` if needed.

> **Important:** All responses are wrapped in a standard format:
> ```typescript
> {
>     success: boolean
>     data?: any        // Present on success
>     error?: string    // Present on failure
>     code?: string     // Error code for programmatic handling
> }
> ```

### Headers Required

All endpoints require:
- **Authentication**: Session cookie or `x-api-key` header
- **Team Context**: `x-team-id` header

### GET /api/plugin/langchain/sessions

List all conversations or get a specific one.

**Query Parameters:**
- `id` (optional): Session ID to get specific conversation

**Response (list):**
```json
{
    "success": true,
    "data": {
        "sessions": [
            {
                "sessionId": "session-123",
                "name": "My Chat",
                "messageCount": 5,
                "firstMessage": "Hello!",
                "isPinned": false,
                "createdAt": "2024-01-01T00:00:00.000Z",
                "updatedAt": "2024-01-01T00:05:00.000Z"
            }
        ],
        "count": 1,
        "maxAllowed": 50
    }
}
```

**Response (single):**
```json
{
    "success": true,
    "data": {
        "sessionId": "session-123",
        "name": "My Chat",
        "messageCount": 5,
        "firstMessage": "Hello!",
        "isPinned": false,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:05:00.000Z"
    }
}
```

### POST /api/plugin/langchain/sessions

Create a new empty conversation.

**Request Body:**
```json
{
    "name": "Optional name"
}
```

**Response (success):**
```json
{
    "success": true,
    "data": {
        "sessionId": "generated-uuid",
        "name": "Optional name",
        "createdAt": "2024-01-01T00:00:00.000Z"
    }
}
```

**Response (limit reached):**
```json
{
    "success": false,
    "error": "CONVERSATION_LIMIT_REACHED",
    "message": "Maximum of 50 conversations reached. Delete an existing conversation to create a new one.",
    "data": {
        "currentCount": 50,
        "maxAllowed": 50,
        "oldestSession": {
            "sessionId": "oldest-session-id",
            "name": "Old Chat",
            "updatedAt": "2024-01-01T00:00:00.000Z"
        }
    }
}
```

### PATCH /api/plugin/langchain/sessions

Update a conversation (rename, pin/unpin).

**Request Body:**
```json
{
    "sessionId": "session-123",
    "name": "New Name",
    "isPinned": true
}
```

**Response:**
```json
{
    "success": true,
    "data": {
        "sessionId": "session-123",
        "name": "New Name",
        "isPinned": true,
        "messageCount": 5,
        "firstMessage": "Hello!",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:10:00.000Z"
    }
}
```

### DELETE /api/plugin/langchain/sessions

Delete a conversation.

**Request Body:**
```json
{
    "sessionId": "session-123"
}
```

**Response:**
```json
{
    "success": true,
    "message": "Conversation deleted successfully",
    "sessionId": "session-123"
}
```

### Error Responses

**401 Unauthorized:**
```json
{ "success": false, "error": "Unauthorized" }
```

**400 Bad Request (missing team):**
```json
{ "success": false, "error": "Team context required", "code": "TEAM_CONTEXT_REQUIRED" }
```

**404 Not Found:**
```json
{ "success": false, "error": "Conversation not found" }
```

---

## Streaming API

Real-time token-by-token responses via Server-Sent Events (SSE).

### POST /api/v1/theme/default/ai/chat/stream

Stream chat responses.

**Request Body:**
```json
{
    "message": "Show my tasks",
    "sessionId": "session-123",
    "agentName": "orchestrator"
}
```

**Response Headers:**
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

**Response Stream:**
```
data: {"type":"token","content":"I"}

data: {"type":"token","content":" found"}

data: {"type":"tool_start","toolName":"list_tasks"}

data: {"type":"tool_end","toolName":"list_tasks","result":[...]}

data: {"type":"token","content":" 3"}

data: {"type":"token","content":" tasks"}

data: {"type":"done","fullContent":"I found 3 tasks...","tokenUsage":{"inputTokens":50,"outputTokens":30}}

data: [DONE]
```

**Stream Chunk Types:**

| Type | Description |
|------|-------------|
| `token` | A generated token: `{ type: 'token', content: string }` |
| `done` | Stream complete: `{ type: 'done', fullContent: string, tokenUsage?: object }` |
| `error` | Error occurred: `{ type: 'error', error: string }` |
| `tool_start` | Tool invocation started: `{ type: 'tool_start', toolName: string }` |
| `tool_end` | Tool completed: `{ type: 'tool_end', toolName: string, result: any }` |

> **Full Documentation**: [Streaming](../04-advanced/03-streaming.md)

---

## Observability API

Tracing and metrics endpoints. **Requires superadmin authentication.**

### GET /api/v1/theme/default/observability/traces

List traces with filtering and pagination.

**Query Parameters:**
- `limit` - Results per page (default: 50)
- `offset` - Pagination offset
- `status` - Filter by status: `success` | `error`
- `agentName` - Filter by agent name
- `teamId` - Filter by team (admin only)
- `from` - Start date (ISO 8601)
- `to` - End date (ISO 8601)

**Response:**
```json
{
    "success": true,
    "data": {
        "traces": [
            {
                "traceId": "abc-123",
                "agentName": "orchestrator",
                "status": "success",
                "durationMs": 2340,
                "inputTokens": 150,
                "outputTokens": 80,
                "totalCost": 0.002,
                "llmCalls": 2,
                "toolCalls": 1,
                "startedAt": "2024-12-23T10:00:00Z"
            }
        ],
        "total": 156,
        "hasMore": true
    }
}
```

### GET /api/v1/theme/default/observability/traces/[traceId]

Get single trace with all spans.

**Response:**
```json
{
    "success": true,
    "data": {
        "trace": {
            "traceId": "abc-123",
            "input": "Show my tasks",
            "output": "Found 3 tasks...",
            "status": "success",
            "durationMs": 2340,
            "spans": [
                {
                    "spanId": "span-1",
                    "name": "router",
                    "type": "llm",
                    "provider": "anthropic",
                    "model": "claude-3-haiku",
                    "durationMs": 1200,
                    "status": "success"
                },
                {
                    "spanId": "span-2",
                    "name": "task_handler",
                    "type": "tool",
                    "durationMs": 340,
                    "status": "success"
                }
            ]
        }
    }
}
```

### GET /api/v1/theme/default/observability/metrics

Get aggregate metrics.

**Query Parameters:**
- `period` - Time period: `1h`, `24h`, `7d`, `30d`

**Response:**
```json
{
    "success": true,
    "data": {
        "summary": {
            "totalTraces": 1500,
            "successRate": 98.5,
            "avgLatencyMs": 2340,
            "totalCost": 15.23,
            "totalLlmCalls": 2800,
            "totalToolCalls": 1200
        },
        "byAgent": [
            {
                "agentName": "orchestrator",
                "count": 1500,
                "successRate": 98.5,
                "avgLatencyMs": 2340
            }
        ],
        "byStatus": {
            "success": 1478,
            "error": 22
        }
    }
}
```

> **Full Documentation**: [Observability](../04-advanced/01-observability.md)

---

## Token Usage API

Token usage and cost tracking endpoints.

### GET /api/v1/theme/default/ai/usage

Get current user's usage stats.

**Query Parameters:**
- `period` - `today`, `7d`, `30d`, or `all` (default: `30d`)

**Response:**
```json
{
    "success": true,
    "data": {
        "totalTokens": 150000,
        "totalCost": 2.45,
        "inputTokens": 100000,
        "outputTokens": 50000,
        "requestCount": 450,
        "byModel": {
            "gpt-4o-mini": { "tokens": 120000, "cost": 0.50 },
            "claude-3-haiku": { "tokens": 30000, "cost": 1.95 }
        }
    }
}
```

### GET /api/v1/theme/default/ai/usage/team

Get team-wide usage stats. **Requires admin permission.**

**Query Parameters:**
- `period` - `today`, `7d`, `30d`, or `all` (default: `30d`)

**Response:**
```json
{
    "success": true,
    "data": {
        "totalTokens": 500000,
        "totalCost": 8.50,
        "byUser": {
            "user-1": { "tokens": 200000, "cost": 3.40 },
            "user-2": { "tokens": 300000, "cost": 5.10 }
        }
    }
}
```

> **Full Documentation**: [Token Tracking](../04-advanced/02-token-tracking.md)

---

## Graph Orchestrator

### invokeOrchestrator

Invoke the graph-based orchestrator directly.

```typescript
import { invokeOrchestrator } from '@/contents/plugins/langchain/lib/graph/orchestrator'

const result = await invokeOrchestrator(
    message: string,
    sessionId: string,
    context: { userId: string, teamId: string },
    history: BaseMessage[],
    options?: {
        traceId?: string
        modelConfig?: {
            router?: ModelConfig
            combiner?: ModelConfig
        }
    }
)

interface OrchestratorResult {
    finalResponse: string
    intents: Intent[]
    handlerResults: HandlerResult[]
    completedHandlers: string[]
    error?: string
}
```

### streamChat

Stream chat responses with SSE support.

```typescript
import { streamChat, StreamChunk } from '@/contents/plugins/langchain/lib/streaming'

async function* handleStream(): AsyncGenerator<StreamChunk> {
    yield* streamChat(
        agent,
        message,
        context,
        { modelConfig: { provider: 'openai', model: 'gpt-4o-mini' } },
        {
            sessionId: 'session-123',
            agentName: 'orchestrator',
            signal: abortController.signal,
        }
    )
}
```

---

## Guardrails Service

Security middleware for input/output processing.

```typescript
import { guardrails } from '@/contents/plugins/langchain/lib/guardrails'

// Check for prompt injection
const injectionCheck = guardrails.checkInjection(input, config.promptInjection)
// { safe: boolean, reason?: string, pattern?: string }

// Mask PII
const piiResult = guardrails.maskPII(input, config.piiMasking)
// { masked: string, mappings: [...], hasPII: boolean }

// Filter content
const filterResult = guardrails.filterContent(output, config.contentFilter)
// { filtered: string, blocked: boolean, reason?: string }

// Full input pipeline
const { processed, warnings } = await guardrails.processInput(input, config)

// Full output pipeline
const { processed, blocked } = await guardrails.processOutput(output, config)
```

> **Full Documentation**: [Guardrails](../04-advanced/04-guardrails.md)

---

## Tracer Service

Observability tracing service.

```typescript
import { tracer } from '@/contents/plugins/langchain/lib/tracer'

// Start a trace
const traceContext = await tracer.startTrace(
    context: { userId, teamId },
    agentName: string,
    input: string,
    options?: { sessionId?: string, metadata?: object }
)

// Start a span within a trace
const spanContext = await tracer.startSpan(
    context: { userId, teamId },
    traceId: string,
    options: {
        name: string,
        type: 'llm' | 'tool' | 'chain',
        provider?: string,
        model?: string,
        input?: object,
    }
)

// End a span
await tracer.endSpan(
    context: { userId, teamId },
    traceId: string,
    spanId: string,
    options: { output?: object, error?: Error, tokens?: object }
)

// End a trace
await tracer.endTrace(
    context: { userId, teamId },
    traceId: string,
    options: {
        output?: string,
        error?: Error,
        tokens?: { input: number, output: number, total: number },
        cost?: number,
        llmCalls?: number,
        toolCalls?: number,
    }
)
```

> **Full Documentation**: [Observability](../04-advanced/01-observability.md)

---

## Token Tracker Service

Token usage and cost tracking service.

```typescript
import { tokenTracker } from '@/contents/plugins/langchain/lib/token-tracker'

// Track usage
await tokenTracker.trackUsage({
    context: { userId, teamId },
    sessionId: string,
    provider: string,
    model: string,
    usage: { inputTokens: number, outputTokens: number, totalTokens: number },
    agentName?: string,
})

// Calculate cost
const costs = tokenTracker.calculateCost(model, usage)
// { inputCost: number, outputCost: number, totalCost: number }

// Get usage stats
const stats = await tokenTracker.getUsage(context, period)
// { totalTokens, totalCost, inputTokens, outputTokens, requestCount, byModel }

// Get daily usage (for charts)
const daily = await tokenTracker.getDailyUsage(context, days)
// [{ date, tokens, cost, requests }, ...]

// Get team usage (admin)
const teamStats = await tokenTracker.getTeamUsage(teamId, period)
```

> **Full Documentation**: [Token Tracking](../04-advanced/02-token-tracking.md)

---

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `LANGCHAIN_PLUGIN_ENABLED` | Enable/disable plugin | `false` | Yes |
| `LANGCHAIN_PLUGIN_DEBUG` | Enable debug console logging | `false` | No |
| `LOG_ENABLED` | Enable file logging to logger/ai/ (core variable) | `false` | No |
| `LANGCHAIN_OLLAMA_BASE_URL` | Ollama server URL | `http://localhost:11434` | For Ollama |
| `LANGCHAIN_OLLAMA_MODEL` | Default Ollama model | `llama3.2:3b` | For Ollama |
| `OPENAI_API_KEY` | OpenAI API key | - | For OpenAI |
| `LANGCHAIN_OPENAI_MODEL` | Default OpenAI model | `gpt-4o-mini` | No |
| `LANGCHAIN_OPENAI_BASE_URL` | Custom OpenAI URL (for LM Studio) | - | No |
| `ANTHROPIC_API_KEY` | Anthropic API key | - | For Anthropic |
| `LANGCHAIN_ANTHROPIC_MODEL` | Default Anthropic model | `claude-3-5-sonnet-20241022` | No |

---

## Constants

### Conversation Limits

```typescript
import { CONVERSATION_LIMITS } from '@/contents/plugins/langchain/lib/memory-store'

const CONVERSATION_LIMITS = {
    MAX_CONVERSATIONS: 50,              // Per user per team
    MAX_MESSAGES_PER_CONVERSATION: 50   // Sliding window (oldest removed)
}
```

> **Sliding Window:** When a conversation reaches 50 messages, older messages are automatically removed when new ones are added. The most recent 50 messages are always preserved.

---

## Logging

When `LOG_ENABLED=true`, the plugin logs to files in `logger/ai/` using the core `FileLogger` utility:

```
logger/ai/
├── session-abc123-orchestrator.log
├── session-abc123-task.log
└── session-abc123-customer.log
```

> **Note:** The logging uses `FileLogger` from `@/core/lib/utils/file-logger`, a generic utility that can be used by any theme or plugin.

**Log format:**
```
[2024-01-01T12:00:00.000Z] [SESSION_INIT]
{
  "provider": "ollama",
  "model": "qwen2.5:7b",
  "temperature": 0.3,
  "toolsCount": 5
}
--------------------------------------------------
[2024-01-01T12:00:01.000Z] [USER_MESSAGE]
{
  "message": "Show me my tasks"
}
--------------------------------------------------
[2024-01-01T12:00:05.000Z] [AGENT_RESPONSE]
{
  "messages": [...]
}
--------------------------------------------------
```

---

## Error Handling

All async functions may throw errors. Handle them appropriately:

```typescript
try {
    const agent = await createAgent(config)
    const response = await agent.chat(message)
} catch (error) {
    if (error.message.includes('Provider')) {
        // LLM provider issue (API key, rate limit, connection)
        console.error('Provider error:', error.message)
    } else if (error.message.includes('database') || error.message.includes('RLS')) {
        // Database issue (connection, permissions)
        console.error('Database error:', error.message)
    } else {
        // Unknown error
        console.error('Error:', error)
    }
}
```

---

## Next Steps

- [Examples](./03-examples.md) - Real-world implementation examples
- [Graph Orchestrator](../03-orchestration/01-graph-orchestrator.md) - Modern orchestration approach
- [Observability](../04-advanced/01-observability.md) - Tracing and debugging
- [Token Tracking](../04-advanced/02-token-tracking.md) - Usage and cost monitoring
- [Streaming](../04-advanced/03-streaming.md) - Real-time responses
- [Guardrails](../04-advanced/04-guardrails.md) - Security middleware
