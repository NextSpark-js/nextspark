# Observability & Tracing

This guide covers the observability system for LangChain agents, including tracing, metrics, and the debugging dashboard.

## Overview

The observability system provides **end-to-end visibility** into AI agent execution:

```
User Request → Trace
    ├── Router Span (LLM call)
    ├── Task Handler Span (tool call)
    ├── Customer Handler Span (tool call)
    └── Combiner Span (LLM call)
```

**Key Features**:
- **Traces**: Track complete agent invocations
- **Spans**: Track individual operations within traces
- **Metrics**: Aggregate performance data
- **Dashboard**: Visual debugging interface
- **PII Protection**: Mask sensitive data automatically

---

## Architecture

### Tracing Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    AGENT INVOCATION                          │
│                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │   LLM    │    │   Tool   │    │   LLM    │              │
│  │  Call    │───►│   Call   │───►│   Call   │              │
│  └──────────┘    └──────────┘    └──────────┘              │
│       │               │               │                     │
│       ▼               ▼               ▼                     │
│  ┌──────────────────────────────────────────────┐          │
│  │              TRACE RECORD                     │          │
│  │  ├─ Span: router (llm)                       │          │
│  │  ├─ Span: task_handler (tool)                │          │
│  │  └─ Span: combiner (llm)                     │          │
│  └──────────────────────────────────────────────┘          │
│                         │                                   │
│                         ▼                                   │
│                ┌─────────────┐                             │
│                │  DATABASE   │                             │
│                │  (RLS)      │                             │
│                └─────────────┘                             │
└─────────────────────────────────────────────────────────────┘
```

### Database Schema

Two tables with full Row-Level Security:

**`langchain_traces`** - Main trace records

| Column | Type | Description |
|--------|------|-------------|
| `traceId` | TEXT | Unique identifier |
| `userId` | TEXT | User who triggered |
| `teamId` | TEXT | Team context |
| `sessionId` | TEXT | Session identifier |
| `agentName` | TEXT | Agent name |
| `input` | TEXT | User input (truncated) |
| `output` | TEXT | Agent output (truncated) |
| `status` | TEXT | running/success/error |
| `error` | TEXT | Error message |
| `durationMs` | INTEGER | Execution time |
| `inputTokens` | INTEGER | Input token count |
| `outputTokens` | INTEGER | Output token count |
| `totalCost` | DECIMAL | Cost in USD |
| `llmCalls` | INTEGER | Number of LLM calls |
| `toolCalls` | INTEGER | Number of tool calls |
| `metadata` | JSONB | Additional data |
| `tags` | TEXT[] | Filtering tags |

**`langchain_spans`** - Individual operations

| Column | Type | Description |
|--------|------|-------------|
| `spanId` | TEXT | Unique identifier |
| `traceId` | TEXT | Parent trace |
| `parentSpanId` | TEXT | Parent span (for nesting) |
| `name` | TEXT | Span name |
| `type` | TEXT | llm/tool/chain |
| `provider` | TEXT | LLM provider |
| `model` | TEXT | Model name |
| `toolName` | TEXT | Tool name (if tool) |
| `input` | JSONB | Span input |
| `output` | JSONB | Span output |
| `status` | TEXT | running/success/error |
| `durationMs` | INTEGER | Span duration |
| `depth` | INTEGER | Nesting depth |

---

## Configuration

Configure in `langchain.config.ts`:

```typescript
export const langchainConfig = {
  observability: {
    enabled: true,

    retention: {
      traces: 30,  // Days to keep traces
    },

    sampling: {
      rate: 1.0,            // 1.0 = 100% of requests
      alwaysTraceErrors: true,  // Always trace errors
    },

    pii: {
      maskInputs: false,     // Mask PII in inputs
      maskOutputs: true,     // Mask PII in outputs
      truncateAt: 10000,     // Max content length
    },
  },
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable/disable tracing |
| `retention.traces` | number | `30` | Days to keep trace data |
| `sampling.rate` | number | `1.0` | Sample rate (0.0-1.0) |
| `sampling.alwaysTraceErrors` | boolean | `true` | Always trace errors |
| `pii.maskInputs` | boolean | `false` | Mask PII in inputs |
| `pii.maskOutputs` | boolean | `true` | Mask PII in outputs |
| `pii.truncateAt` | number | `10000` | Max content length |

### Sampling

Control how many requests are traced:

```typescript
// Development: trace everything
sampling: { rate: 1.0, alwaysTraceErrors: true }

// Production: trace 10% + all errors
sampling: { rate: 0.1, alwaysTraceErrors: true }

// High traffic: trace 1% + errors
sampling: { rate: 0.01, alwaysTraceErrors: true }
```

---

## Tracer Service

### Basic Usage

```typescript
import { tracer } from '@/contents/plugins/langchain/lib/tracer'

// Start a trace
const traceContext = await tracer.startTrace(
  { userId, teamId },
  'orchestrator',
  userMessage,
  { sessionId, metadata: { source: 'chat' } }
)

try {
  // Your agent logic here
  const result = await processMessage(userMessage)

  // End trace with success
  await tracer.endTrace(
    { userId, teamId },
    traceContext.traceId,
    {
      output: result.content,
      tokens: { input: 100, output: 50, total: 150 },
      cost: 0.002,
      llmCalls: 2,
      toolCalls: 1,
    }
  )
} catch (error) {
  // End trace with error
  await tracer.endTrace(
    { userId, teamId },
    traceContext.traceId,
    { error }
  )
}
```

### Spans

Track individual operations within a trace:

```typescript
// Start a span
const spanContext = await tracer.startSpan(
  { userId, teamId },
  traceId,
  {
    name: 'router',
    type: 'llm',
    provider: 'anthropic',
    model: 'claude-3-haiku',
    input: { message: userInput },
  }
)

try {
  const result = await routerNode(state)

  // End span with success
  await tracer.endSpan(
    { userId, teamId },
    traceId,
    spanContext.spanId,
    {
      output: { intents: result.intents },
      tokens: { input: 50, output: 20 },
    }
  )
} catch (error) {
  await tracer.endSpan(
    { userId, teamId },
    traceId,
    spanContext.spanId,
    { error }
  )
}
```

### Span Types

| Type | Description | Example |
|------|-------------|---------|
| `llm` | LLM call | Router, Combiner |
| `tool` | Tool invocation | TaskHandler, CustomerHandler |
| `chain` | Chain/workflow | Graph execution |
| `retriever` | RAG retrieval | Vector search |

---

## API Endpoints

All endpoints require **superadmin** authentication.

### List Traces

```
GET /api/v1/theme/default/observability/traces
```

**Query Parameters**:
- `limit` - Results per page (default: 50)
- `offset` - Pagination offset
- `status` - Filter by status (success/error)
- `agentName` - Filter by agent
- `teamId` - Filter by team
- `from` - Start date (ISO)
- `to` - End date (ISO)

**Response**:
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

### Get Trace Detail

```
GET /api/v1/theme/default/observability/traces/[traceId]
```

**Response**:
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

### Get Metrics

```
GET /api/v1/theme/default/observability/metrics
```

**Query Parameters**:
- `period` - Time period: `1h`, `24h`, `7d`, `30d`

**Response**:
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

---

## Dashboard

The observability dashboard is available at:

```
/sector7/ai-observability
```

> **Note**: This is a superadmin-only page in the Sector7 protected zone.

### Features

1. **Traces Table**
   - Paginated list of all traces
   - Filter by status, agent, date range
   - Click to view details

2. **Trace Detail**
   - Full trace timeline
   - All spans with durations
   - Input/output inspection
   - Error details

3. **Metrics Overview**
   - Total traces
   - Success rate
   - Average latency
   - Cost tracking

### Components

| Component | Purpose |
|-----------|---------|
| `ObservabilityDashboard` | Main dashboard container |
| `TracesTable` | Paginated trace list |
| `TraceDetail` | Single trace view |
| `SpansList` | Span timeline |
| `FiltersPanel` | Filter controls |
| `TraceStatusBadge` | Status indicator |

---

## React Hooks

### useTraces

Fetch paginated trace list:

```typescript
import { useTraces } from '@/contents/plugins/langchain/hooks/observability'

function TracesList() {
  const { data, isLoading, error } = useTraces({
    status: 'error',
    agentName: 'orchestrator',
    limit: 20,
  })

  if (isLoading) return <Loading />
  if (error) return <Error />

  return (
    <table>
      {data.traces.map(trace => (
        <TraceRow key={trace.traceId} trace={trace} />
      ))}
    </table>
  )
}
```

### useTraceDetail

Fetch single trace with spans:

```typescript
import { useTraceDetail } from '@/contents/plugins/langchain/hooks/observability'

function TraceView({ traceId }) {
  const { data, isLoading } = useTraceDetail(traceId)

  if (isLoading) return <Loading />

  return (
    <div>
      <h2>{data.trace.agentName}</h2>
      <pre>{data.trace.input}</pre>
      <SpanTimeline spans={data.trace.spans} />
    </div>
  )
}
```

### useMetrics

Fetch aggregate metrics:

```typescript
import { useMetrics } from '@/contents/plugins/langchain/hooks/observability'

function MetricsDashboard() {
  const { data } = useMetrics({ period: '24h' })

  return (
    <div>
      <Stat label="Total Traces" value={data.summary.totalTraces} />
      <Stat label="Success Rate" value={`${data.summary.successRate}%`} />
      <Stat label="Avg Latency" value={`${data.summary.avgLatencyMs}ms`} />
    </div>
  )
}
```

---

## PII Protection

### Automatic Masking

When enabled, the tracer masks common PII patterns:

| Pattern | Example | Masked |
|---------|---------|--------|
| Email | john@example.com | [EMAIL] |
| Phone | +1 (555) 123-4567 | [PHONE] |
| Credit Card | 1234-5678-9012-3456 | [CARD] |
| SSN | 123-45-6789 | [SSN] |

### Configuration

```typescript
pii: {
  maskInputs: false,   // Don't mask inputs (for debugging)
  maskOutputs: true,   // Mask PII in outputs
  truncateAt: 10000,   // Truncate long content
}
```

### Content Truncation

Long content is automatically truncated:

```
Original: "Very long message..." (15000 chars)
Stored:   "Very long message..." (10000 chars) + "[truncated]"
```

---

## Integration with Graph Orchestrator

The graph orchestrator automatically tracks traces and spans:

```typescript
// In orchestrator.ts
const traceContext = await tracer.startTrace(
  { userId: context.userId, teamId: context.teamId },
  'graph-orchestrator',
  message,
  { sessionId }
)

const result = await invokeOrchestrator(
  message,
  sessionId,
  context,
  history,
  { traceId: traceContext?.traceId }
)

// Router node creates spans automatically
// Handler nodes create spans automatically
// Combiner node creates spans automatically

await tracer.endTrace(
  { userId, teamId },
  traceContext.traceId,
  {
    output: result.finalResponse,
    llmCalls: 2,
    toolCalls: result.completedHandlers.length,
  }
)
```

---

## Best Practices

### 1. Use Meaningful Span Names

```typescript
// Good
{ name: 'router', type: 'llm' }
{ name: 'task_handler', type: 'tool' }

// Bad
{ name: 'step1', type: 'llm' }
{ name: 'process', type: 'tool' }
```

### 2. Include Provider/Model Info

```typescript
await tracer.startSpan(context, traceId, {
  name: 'router',
  type: 'llm',
  provider: 'anthropic',  // Include this
  model: 'claude-3-haiku', // Include this
})
```

### 3. Always End Traces

```typescript
try {
  // Logic
  await tracer.endTrace(ctx, traceId, { output })
} catch (error) {
  await tracer.endTrace(ctx, traceId, { error })  // Always end
  throw error
}
```

### 4. Use Tags for Filtering

```typescript
await tracer.startTrace(context, agent, input, {
  tags: ['production', 'chat', 'high-priority'],
})
```

### 5. Sample in Production

```typescript
// Production config
sampling: {
  rate: 0.1,  // Only trace 10%
  alwaysTraceErrors: true,  // But always trace errors
}
```

---

## Troubleshooting

### Traces Not Appearing

1. Check `enabled: true` in config
2. Verify sampling rate
3. Check superadmin permissions
4. Look for console errors

### Missing Spans

1. Ensure `startSpan` is called before `endSpan`
2. Check traceId is passed correctly
3. Verify RLS policies allow insert

### High Storage Usage

1. Reduce `retention.traces`
2. Lower `pii.truncateAt`
3. Reduce `sampling.rate`

---

## Related Documentation

- [Graph Orchestrator](../03-orchestration/01-graph-orchestrator.md) - How tracing integrates with the graph
- [Token Tracking](./02-token-tracking.md) - Cost and usage tracking
- [Configuration](../01-getting-started/03-configuration.md) - Full configuration reference
