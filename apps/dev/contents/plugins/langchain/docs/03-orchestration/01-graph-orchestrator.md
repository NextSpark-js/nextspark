# Graph-Based Orchestration

This guide covers the **LangGraph-based orchestrator**, the recommended approach for multi-agent systems. It replaces inefficient ReAct loops with an explicit state machine, achieving 25-50x faster execution with deterministic flow.

> **Note**: For the legacy ReAct-based approach, see [Legacy Orchestration](./02-legacy-react.md) (deprecated).

## Why Graph-Based Orchestration?

The traditional ReAct (Reasoning + Acting) pattern has significant drawbacks at scale:

### The Problem with ReAct Loops

```
User: "Show my tasks and find StartupXYZ account number"

┌─────────────────────────────────────────────────────────────┐
│ ORCHESTRATOR ReAct Loop (~10-20 iterations)                 │
│ ├─ Think → Act → Observe → Think → Act...                   │
│ └─ Decide: route_to_task                                    │
│     ↓                                                       │
│     ┌─────────────────────────────────────────────────┐     │
│     │ TASK-ASSISTANT ReAct Loop (~10-15 iterations)   │     │
│     │ └─ Think → Act → Observe → Think...             │     │
│     └─────────────────────────────────────────────────┘     │
│     ↓ (returns to orchestrator)                             │
│ ├─ Think → decide second part                               │
│ └─ Decide: route_to_customer                                │
│     ↓                                                       │
│     ┌─────────────────────────────────────────────────┐     │
│     │ CUSTOMER-ASSISTANT ReAct Loop (~10-15 iter)     │     │
│     └─────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘

TOTAL: 50+ LLM iterations → TIMEOUT (2-5 minutes)
```

**Issues:**
- **50+ LLM calls** for a simple multi-intent request
- **Recursion limit errors** from nested loops
- **Non-deterministic** - different paths each time
- **Expensive** - each iteration costs tokens
- **Slow** - 2-5 minute response times

### The Solution: Explicit State Machine

```
User: "Show my tasks and find StartupXYZ account number"

┌─────────────────────────────────────────────────────────────┐
│                         START                                │
│                           ↓                                  │
│                  ┌─────────────┐                            │
│                  │   ROUTER    │ ← 1 LLM call               │
│                  │   (Intent)  │   (structured output)       │
│                  └──────┬──────┘                            │
│                         ↓                                    │
│         ┌───────────────┴───────────────┐                   │
│         ↓                               ↓                   │
│   ┌──────────────┐              ┌──────────────┐           │
│   │ TASK_HANDLER │              │ CUST_HANDLER │           │
│   │   (0 LLM)    │              │   (0 LLM)    │           │
│   └───────┬──────┘              └───────┬──────┘           │
│           ↓                             ↓                   │
│           └─────────────┬───────────────┘                   │
│                         ↓                                    │
│                  ┌─────────────┐                            │
│                  │  COMBINER   │ ← 1 LLM call               │
│                  │ (Response)  │   (optional)               │
│                  └──────┬──────┘                            │
│                         ↓                                    │
│                        END                                   │
└─────────────────────────────────────────────────────────────┘

TOTAL: 2 LLM calls → 2-3 seconds
```

**Benefits:**
- **1-2 LLM calls** instead of 50+
- **No recursion** - explicit transitions
- **Deterministic** - same input = same path
- **Cost effective** - 25-50x fewer tokens
- **Fast** - 2-10 second responses

---

## Theoretical Foundations

### What is LangGraph?

LangGraph is a framework for building **stateful, multi-step AI applications** using explicit graphs. Unlike ReAct patterns where the LLM decides what to do next in a loop, LangGraph defines explicit states and transitions.

Key concepts:

| Concept | Description |
|---------|-------------|
| **State** | The data that flows through the graph |
| **Node** | A function that transforms state |
| **Edge** | Connection between nodes |
| **Conditional Edge** | Edge that chooses next node based on state |
| **Channel** | How state updates are merged |

### State Machines vs ReAct Loops

| Aspect | ReAct Loop | State Machine |
|--------|------------|---------------|
| **Control Flow** | LLM decides | Code defines |
| **Predictability** | Variable | Deterministic |
| **LLM Calls** | O(n) per step | O(1) total |
| **Debugging** | Hard (black box) | Easy (explicit) |
| **Parallelism** | Limited | Native support |

### Why Deterministic Flow Matters

1. **Reproducibility**: Same input produces same execution path
2. **Debugging**: You can trace exactly which nodes executed
3. **Testing**: Unit test each node independently
4. **Cost Control**: Predictable token usage
5. **SLA Compliance**: Guaranteed response times

---

## Architecture

### Graph Overview

```
                    ┌──────────────────────────────────────────────────────┐
                    │                    ORCHESTRATOR GRAPH                 │
                    │                                                       │
   User Input ──────┤                                                       │
                    │   ┌─────────┐                                        │
                    │   │  START  │                                        │
                    │   └────┬────┘                                        │
                    │        │                                             │
                    │        ▼                                             │
                    │   ┌──────────┐     Structured Output                 │
                    │   │  ROUTER  │ ◄── (Zod Schema)                      │
                    │   │  (LLM)   │     Intent Classification             │
                    │   └────┬─────┘                                       │
                    │        │                                             │
                    │   ┌────┴────┬────────────┬─────────────┐            │
                    │   ▼         ▼            ▼             ▼            │
                    │ greeting  clarify    single       multi            │
                    │   │         │        intent       intent           │
                    │   │         │           │            │              │
                    │   │         │           ▼            ▼              │
                    │   │         │     ┌──────────┐  ┌──────────┐       │
                    │   │         │     │ HANDLER  │  │ HANDLER  │ ...   │
                    │   │         │     │ (No LLM) │  │ (No LLM) │       │
                    │   │         │     └────┬─────┘  └────┬─────┘       │
                    │   │         │          │             │              │
                    │   │         │          └──────┬──────┘              │
                    │   │         │                 ▼                     │
                    │   │         │          ┌──────────┐                 │
                    │   └─────────┴─────────►│ COMBINER │                 │
                    │                        │  (LLM)   │                 │
                    │                        └────┬─────┘                 │
                    │                             │                       │
                    │                             ▼                       │
                    │                        ┌────────┐                   │
   Response ◄───────┤                        │  END   │                   │
                    │                        └────────┘                   │
                    └──────────────────────────────────────────────────────┘
```

### Node Responsibilities

| Node | Purpose | LLM Calls | Input | Output |
|------|---------|-----------|-------|--------|
| **Router** | Classify user intent | 1 | User message | Intent[] |
| **Task Handler** | Execute task operations | 0 | Intent | JSON result |
| **Customer Handler** | Execute customer operations | 0 | Intent | JSON result |
| **Page Handler** | Execute page operations | 0 | Intent | JSON result |
| **Combiner** | Synthesize response | 0-1 | All results | User text |

### Data Flow

1. **User Input** → Raw message string
2. **Router** → Parses to structured `Intent[]`
3. **Handlers** → Execute operations, return JSON
4. **Combiner** → Converts JSON to natural language
5. **Response** → Text for user

---

## Nodes Reference

### Router Node

The router is the "brain" that classifies user intent in a single LLM call.

**Location**: `lib/graph/nodes/router.ts`

**Features**:
- **Structured Output**: Uses Zod schema for reliable JSON extraction
- **Multi-Intent**: Detects multiple intents in one message
- **Retry Logic**: Handles malformed responses from local models
- **Provider Agnostic**: Works with OpenAI, Anthropic, Ollama, LM Studio

**Output Schema**:

```typescript
const RouterOutputSchema = z.object({
    intents: z.array(z.object({
        type: z.enum(['task', 'customer', 'page', 'greeting', 'clarification']),
        action: z.enum(['list', 'create', 'update', 'delete', 'search', 'get', 'unknown']),
        parameters: z.record(z.unknown()),
        originalText: z.string(),
    })),
    needsClarification: z.boolean(),
    clarificationQuestion: z.string().nullable(),
})
```

**Examples**:

```
Input: "Show my tasks"
Output: {
    intents: [{
        type: "task",
        action: "list",
        parameters: {},
        originalText: "Show my tasks"
    }],
    needsClarification: false
}

Input: "Create task 'Buy milk' high priority and find customer ABC"
Output: {
    intents: [
        { type: "task", action: "create", parameters: { title: "Buy milk", priority: "high" } },
        { type: "customer", action: "search", parameters: { query: "ABC" } }
    ],
    needsClarification: false
}
```

### Handler Nodes

Handlers execute operations **without LLM calls** - they directly call entity services.

#### Task Handler

**Location**: `lib/graph/nodes/task-handler.ts`

**Supported Actions**:
- `list` - Get all tasks with optional filters
- `get` - Get single task by ID
- `create` - Create new task
- `update` - Update task fields
- `search` - Find tasks by query
- `delete` - Delete task

**Example**:

```typescript
// Intent: { type: "task", action: "create", parameters: { title: "Buy milk", priority: "high" } }

// Handler calls:
await TasksService.create(userId, teamId, { title: "Buy milk", priority: "high" })

// Returns:
{
    success: true,
    operation: "create",
    data: { id: "123", title: "Buy milk", priority: "high", status: "todo" },
    message: "Created task: Buy milk"
}
```

#### Customer Handler

**Location**: `lib/graph/nodes/customer-handler.ts`

**Supported Actions**:
- `list` - Get all customers
- `get` - Get single customer
- `create` - Create new customer
- `update` - Update customer fields
- `search` - Find customers by name, email, phone, account
- `delete` - Delete customer

#### Page Handler

**Location**: `lib/graph/nodes/page-handler.ts`

**Supported Actions**:
- `list` - Get published pages
- `get` - Get page by ID or slug
- `search` - Find pages by title

> **Note**: Create/Update/Delete for pages returns error directing to Page Builder UI.

### Combiner Node

The combiner converts JSON handler results into natural language.

**Location**: `lib/graph/nodes/combiner.ts`

**Optimization**: For simple single-intent operations, uses **template-based responses** without LLM:

```typescript
// Template response (no LLM needed):
// Intent: list 3 tasks
"Found 3 task(s):
• Buy milk (high) - todo
• Call client (medium) - in-progress
• Review docs (low) - done"

// LLM response (multi-intent or complex):
// Uses GPT-4o-mini to synthesize natural response
```

**When LLM is used**:
- Multiple handler results (task + customer)
- List/search with >5 items
- Complex data requiring summarization

**When templates are used**:
- Single intent operations
- Simple list/search with <=5 items
- CRUD confirmations

---

## State Schema

### OrchestratorState

The complete state that flows through the graph:

```typescript
interface OrchestratorState {
    // ---- Input (immutable) ----
    input: string                          // User message
    sessionId: string                      // Session identifier
    context: AgentContext                  // userId, teamId
    conversationHistory: BaseMessage[]     // Recent messages (last 5)

    // ---- Router Output ----
    intents: Intent[]                      // Classified intents
    needsClarification: boolean            // If true, ask user
    clarificationQuestion?: string         // Question to ask

    // ---- Handler Outputs ----
    handlerResults: {                      // JSON from each handler
        task?: TaskHandlerResult
        customer?: CustomerHandlerResult
        page?: PageHandlerResult
    }
    completedHandlers: IntentType[]        // Which handlers ran

    // ---- Final Output ----
    finalResponse: string | null           // Text for user
    error: string | null                   // Error message

    // ---- Tracing ----
    traceId?: string                       // Observability trace
}
```

### Intent Type

```typescript
interface Intent {
    type: 'task' | 'customer' | 'page' | 'greeting' | 'clarification'
    action: 'list' | 'create' | 'update' | 'delete' | 'search' | 'get' | 'unknown'
    parameters: Record<string, unknown>
    originalText: string
    confidence?: number
}
```

### Handler Results

```typescript
interface TaskHandlerResult {
    success: boolean
    operation: 'list' | 'create' | 'update' | 'delete' | 'search' | 'get'
    data: TaskData[] | TaskData | null
    count?: number
    message: string
    error?: string
}
```

---

## Routing Logic

### From Router to Handlers

The `routeByIntents` function determines execution path:

```typescript
function routeByIntents(state: OrchestratorState): RouterRoute {
    const intentTypes = state.intents.map(i => i.type)

    // Handle special cases
    if (state.error) return 'error'
    if (state.needsClarification) return 'clarification'
    if (intentTypes.length === 1 && intentTypes[0] === 'greeting') return 'greeting'

    // Determine handler combination
    const hasTask = intentTypes.includes('task')
    const hasCustomer = intentTypes.includes('customer')
    const hasPage = intentTypes.includes('page')

    if (hasTask && hasCustomer && hasPage) return 'all_handlers'
    if (hasTask && hasCustomer) return 'task_and_customer'
    if (hasTask && hasPage) return 'task_and_page'
    if (hasCustomer && hasPage) return 'customer_and_page'
    if (hasTask) return 'task_only'
    if (hasCustomer) return 'customer_only'
    if (hasPage) return 'page_only'

    return 'clarification'
}
```

### Handler Sequencing

For multi-intent requests, handlers execute sequentially:

```
task_and_customer: Task Handler → Customer Handler → Combiner
task_and_page:     Task Handler → Page Handler → Combiner
all_handlers:      Task Handler → Customer Handler → Page Handler → Combiner
```

Each handler's output is **merged** into `handlerResults`, preserving all results.

### Conditional Transitions

```typescript
// After task handler
function routeAfterTask(state): string {
    if (needsCustomer && !completedCustomer) return 'customer_handler'
    if (needsPage && !completedPage) return 'page_handler'
    return 'combiner'
}
```

---

## Multi-Model Compatibility

### Structured Output Methods

Different LLM providers support different structured output methods:

| Provider | Method | Notes |
|----------|--------|-------|
| OpenAI API | `functionCalling` | Most reliable |
| Anthropic | `functionCalling` | Tool use |
| Ollama | `functionCalling` | Most models |
| LM Studio | `jsonSchema` | OpenAI-compatible servers |

The `getStructuredOutputMethod()` helper auto-detects the best method:

```typescript
import { getStructuredOutputMethod } from '../../providers'

const method = getStructuredOutputMethod({ provider: 'openai' })
// Returns: 'functionCalling' for real OpenAI, 'jsonSchema' for LM Studio

const structuredModel = model.withStructuredOutput(schema, { method })
```

### Retry Logic with Zod Validation

Local models (LM Studio, Ollama) may produce malformed JSON. The router includes retry logic:

```typescript
async function invokeRouterWithRetry(model, messages, method) {
    for (let attempt = 1; attempt <= 3; attempt++) {
        // Try 1: Structured output
        const result = await tryStructuredOutput(model, messages, method)
        if (result) return result

        // Try 2: Manual JSON parsing (fallback)
        const manual = await tryManualJsonParsing(model, messages)
        if (manual) return manual

        // Exponential backoff before retry
        await sleep(500 * Math.pow(2, attempt - 1))
    }
    throw new Error('Router failed after retries')
}

function tryManualJsonParsing(model, messages) {
    const result = await model.invoke(messages)
    const content = result.content as string

    // Extract JSON from markdown code blocks or raw text
    const json = extractJsonFromResponse(content)
    const parsed = JSON.parse(json)

    // Validate with Zod
    return RouterOutputSchema.safeParse(parsed)
}
```

### Provider Configuration

Configure providers in theme's `langchain.config.ts`:

```typescript
'orchestrator': {
    provider: 'anthropic',              // Claude for router
    model: 'claude-3-haiku-20240307',
    temperature: 0.1,                   // Low for consistency
},
'task-assistant': {
    provider: 'openai',                 // GPT-4o-mini for handlers
    model: 'gpt-4o-mini',
    temperature: 0.3,
}
```

---

## Configuration

### Environment Variables

```env
# Enable graph orchestrator (recommended)
LANGCHAIN_USE_GRAPH_ORCHESTRATOR=true

# Provider settings
LANGCHAIN_DEFAULT_PROVIDER=openai

# Debug mode
LANGCHAIN_PLUGIN_DEBUG=true

# Provider-specific
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

### Graph Configuration

```typescript
interface GraphConfig {
    maxHistoryMessages: number     // Default: 5
    routerTemperature: number      // Default: 0.1
    combinerTemperature: number    // Default: 0.3
    parallelExecution: boolean     // Default: true (future)
    handlerTimeout: number         // Default: 30000ms
}
```

### Usage

```typescript
import { invokeOrchestrator } from '@/contents/plugins/langchain/lib/graph'

const result = await invokeOrchestrator(
    message,
    sessionId,
    { userId, teamId },
    conversationHistory,
    {
        config: {
            maxHistoryMessages: 10,
            routerTemperature: 0.05,
        },
        traceId: 'trace-123',
    }
)
```

---

## Performance Comparison

### Benchmarks

| Metric | Graph Orchestrator | ReAct Loops | Improvement |
|--------|-------------------|-------------|-------------|
| **LLM Calls (single intent)** | 1 | 20-30 | 20-30x |
| **LLM Calls (multi intent)** | 2 | 50+ | 25-50x |
| **Response Time (single)** | 2-3s | 10-15s | 5x |
| **Response Time (multi)** | 3-5s | 60-120s | 20-30x |
| **Token Cost** | ~500 | ~15,000 | 30x |
| **Recursion Errors** | Never | Frequent | - |
| **Timeout Errors** | Never | Common | - |

### Real-World Example

**Query**: "Show my tasks and find the account number for StartupXYZ"

| Metric | Graph | ReAct |
|--------|-------|-------|
| Total LLM calls | 2 | 47 |
| Router calls | 1 | - |
| Orchestrator iterations | - | 15 |
| Task agent iterations | - | 12 |
| Customer agent iterations | - | 20 |
| Response time | 4.2s | 127s (timeout) |
| Tokens used | 892 | 23,450 |
| Estimated cost | $0.002 | $0.047 |

---

## Examples

### Single Intent Flow

```typescript
// User: "List my tasks"

// 1. Router (1 LLM call)
{
    intents: [{ type: "task", action: "list", parameters: {} }],
    needsClarification: false
}

// 2. Route: task_only → task_handler

// 3. Task Handler (0 LLM calls)
{
    handlerResults: {
        task: {
            success: true,
            operation: "list",
            data: [{ id: "1", title: "Task A" }, ...],
            count: 5
        }
    }
}

// 4. Combiner (0 LLM calls - uses template)
{
    finalResponse: "Found 5 task(s):\n• Task A\n• Task B..."
}

// TOTAL: 1 LLM call
```

### Multi-Intent Flow

```typescript
// User: "Show tasks and find StartupXYZ phone number"

// 1. Router (1 LLM call)
{
    intents: [
        { type: "task", action: "list", parameters: {} },
        { type: "customer", action: "search", parameters: { query: "StartupXYZ", fields: ["phone"] } }
    ]
}

// 2. Route: task_and_customer → task_handler → customer_handler → combiner

// 3. Task Handler (0 LLM)
// 4. Customer Handler (0 LLM)
{
    handlerResults: {
        task: { success: true, data: [...], count: 3 },
        customer: { success: true, data: [{ name: "StartupXYZ", phone: "+1-555-1234" }] }
    }
}

// 5. Combiner (1 LLM call - multi-result)
{
    finalResponse: "Found 3 tasks. StartupXYZ phone number is +1-555-1234."
}

// TOTAL: 2 LLM calls
```

### Error Handling

```typescript
// User: "Update task 999" (non-existent)

// Task Handler returns error:
{
    handlerResults: {
        task: {
            success: false,
            operation: "update",
            data: null,
            error: "Task not found",
            message: "Could not find task with ID 999"
        }
    }
}

// Combiner generates friendly error:
{
    finalResponse: "I couldn't find that task. Would you like to see your task list?"
}
```

---

## Debugging

### Enable Debug Mode

```env
LANGCHAIN_PLUGIN_DEBUG=true
```

### Debug Output

```
[Router] Classifying intent for: Show my tasks
[Router] Classified intents: [{"type":"task","action":"list"}]
[Task Handler] Processing intent: list
[Task Handler] Found 5 tasks
[Combiner] Using template-based response
```

### Observability

Use the [Observability Dashboard](../04-advanced/01-observability.md) to trace execution:

- View trace timeline with each node
- See provider/model used per node
- Inspect input/output at each step
- Track token usage and costs

---

## Migration from ReAct

### Step 1: Enable Graph Mode

```env
LANGCHAIN_USE_GRAPH_ORCHESTRATOR=true
```

### Step 2: Configure Providers

Ensure providers are configured in `langchain.config.ts`:

```typescript
'orchestrator': {
    provider: 'anthropic',  // Claude for reliable classification
    model: 'claude-3-haiku-20240307',
    temperature: 0.1,
}
```

### Step 3: Test

```bash
# Run your test suite
pnpm test

# Monitor observability dashboard
# /sector7/ai-observability
```

### Fallback

The system supports automatic fallback:

```typescript
// In orchestrator.ts
if (isGraphOrchestratorEnabled()) {
    return processWithGraphOrchestrator(message, context)
}
return processWithOrchestrator(message, context)  // Legacy ReAct
```

---

## Best Practices

### 1. Keep Router Focused

The router should only classify intent. Keep the system prompt simple and focused on intent extraction.

### 2. Use Low Temperature

```typescript
routerTemperature: 0.1  // Consistent classification
combinerTemperature: 0.3  // Slightly creative responses
```

### 3. Handle All Intent Types

Ensure your handlers cover all possible actions for each entity type.

### 4. Monitor Performance

Use observability to track:
- Intent classification accuracy
- Handler execution times
- Combiner usage (template vs LLM)

### 5. Test Multi-Intent

Always test with multi-intent queries to ensure proper sequencing.

---

## Related Documentation

- [Observability & Tracing](../04-advanced/01-observability.md) - Debug and monitor execution
- [Token Tracking](../04-advanced/02-token-tracking.md) - Cost management
- [Configuration](../01-getting-started/03-configuration.md) - Provider setup
- [Legacy Orchestration](./02-legacy-react.md) - ReAct-based approach (deprecated)
