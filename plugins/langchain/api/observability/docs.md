# Observability API

Monitor AI agent traces, spans, and performance metrics for LangChain-powered applications.

## Overview

The Observability API provides comprehensive monitoring for AI agents, including execution traces, detailed spans, and aggregated metrics. This API is designed for administrators to debug, analyze, and optimize AI agent performance.

**Access Level:** Admin only (superadmin or developer roles)

## Authentication

All endpoints require authentication via:
- **Session cookie** (for browser-based requests)
- **API Key** header (for server-to-server requests)

**Role Requirements:**
- `superadmin` or `developer` role required

## Endpoints

### List Traces
`GET /api/langchain/observability/traces`

Returns a paginated list of root traces (agent executions) with cursor-based pagination.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| status | string | - | Filter by status: `running`, `success`, `error` |
| agent | string | - | Filter by agent name |
| teamId | string | - | Filter by team ID |
| from | datetime | - | Start date filter (ISO 8601) |
| to | datetime | - | End date filter (ISO 8601) |
| limit | number | 50 | Results per page (max: 100) |
| cursor | string | - | Pagination cursor (ISO timestamp) |

**Example Response:**
```json
{
  "success": true,
  "data": {
    "traces": [
      {
        "traceId": "trace_abc123",
        "userId": "user_456",
        "teamId": "team_789",
        "sessionId": "sess_xyz",
        "agentName": "customer-support-agent",
        "agentType": "conversational",
        "status": "success",
        "input": "How do I reset my password?",
        "output": "To reset your password...",
        "startedAt": "2024-01-15T10:30:00Z",
        "endedAt": "2024-01-15T10:30:05Z",
        "durationMs": 5234,
        "inputTokens": 150,
        "outputTokens": 320,
        "totalTokens": 470,
        "totalCost": 0.0047,
        "llmCalls": 2,
        "toolCalls": 1,
        "metadata": {},
        "tags": ["support", "password"],
        "createdAt": "2024-01-15T10:30:00Z"
      }
    ],
    "hasMore": true,
    "nextCursor": "2024-01-15T10:29:00Z"
  }
}
```

### Get Trace Detail
`GET /api/langchain/observability/traces/[traceId]`

Returns detailed information about a specific trace, including spans and child traces.

**Path Parameters:**
- `traceId` (string, required): The trace ID

**Example Response:**
```json
{
  "success": true,
  "data": {
    "trace": {
      "traceId": "trace_abc123",
      "userId": "user_456",
      "teamId": "team_789",
      "sessionId": "sess_xyz",
      "agentName": "customer-support-agent",
      "agentType": "conversational",
      "status": "success",
      "input": "How do I reset my password?",
      "output": "To reset your password...",
      "startedAt": "2024-01-15T10:30:00Z",
      "endedAt": "2024-01-15T10:30:05Z",
      "durationMs": 5234,
      "inputTokens": 150,
      "outputTokens": 320,
      "totalTokens": 470,
      "totalCost": 0.0047,
      "llmCalls": 2,
      "toolCalls": 1,
      "metadata": {},
      "tags": ["support", "password"],
      "createdAt": "2024-01-15T10:30:00Z"
    },
    "spans": [
      {
        "spanId": "span_001",
        "traceId": "trace_abc123",
        "name": "ChatOpenAI",
        "type": "llm",
        "provider": "openai",
        "model": "gpt-4",
        "inputTokens": 100,
        "outputTokens": 200,
        "status": "success",
        "startedAt": "2024-01-15T10:30:01Z",
        "endedAt": "2024-01-15T10:30:03Z",
        "durationMs": 2100,
        "depth": 0,
        "createdAt": "2024-01-15T10:30:01Z"
      },
      {
        "spanId": "span_002",
        "traceId": "trace_abc123",
        "name": "search_knowledge_base",
        "type": "tool",
        "toolName": "search_knowledge_base",
        "toolInput": {"query": "password reset"},
        "toolOutput": {"results": [...]},
        "status": "success",
        "startedAt": "2024-01-15T10:30:02Z",
        "endedAt": "2024-01-15T10:30:02Z",
        "durationMs": 450,
        "depth": 1,
        "createdAt": "2024-01-15T10:30:02Z"
      }
    ],
    "childTraces": [],
    "childSpansMap": {},
    "parentTrace": null
  }
}
```

### Get Metrics
`GET /api/langchain/observability/metrics`

Returns aggregated metrics for a time period.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| period | string | 24h | Time period: `1h`, `24h`, `7d`, `30d` |

**Example Response:**
```json
{
  "success": true,
  "data": {
    "period": "24h",
    "totalTraces": 1250,
    "successTraces": 1180,
    "errorTraces": 70,
    "avgLatency": 3456,
    "totalTokens": 2450000
  }
}
```

## Data Models

### Trace

| Field | Type | Description |
|-------|------|-------------|
| traceId | string | Unique trace identifier |
| userId | string | User who initiated the trace |
| teamId | string | Team context |
| sessionId | string | Associated conversation session (optional) |
| agentName | string | Name of the AI agent |
| agentType | string | Type of agent (optional) |
| parentId | string | Parent trace ID for nested agents (optional) |
| input | string | Input to the agent |
| output | string | Output from the agent (optional) |
| status | enum | `running`, `success`, `error` |
| error | string | Error message if status is error (optional) |
| errorType | string | Error type classification (optional) |
| errorStack | string | Error stack trace (optional) |
| startedAt | datetime | When the trace started |
| endedAt | datetime | When the trace ended (optional) |
| durationMs | number | Duration in milliseconds (optional) |
| inputTokens | number | Input token count |
| outputTokens | number | Output token count |
| totalTokens | number | Total token count |
| totalCost | number | Estimated cost in USD |
| llmCalls | number | Number of LLM API calls |
| toolCalls | number | Number of tool invocations |
| metadata | object | Custom metadata |
| tags | string[] | Tags for categorization (optional) |
| createdAt | datetime | Record creation timestamp |

### Span

| Field | Type | Description |
|-------|------|-------------|
| spanId | string | Unique span identifier |
| traceId | string | Parent trace ID |
| parentSpanId | string | Parent span ID for nesting (optional) |
| name | string | Span name |
| type | enum | `llm`, `tool`, `chain`, `retriever` |
| provider | string | LLM provider (e.g., openai, anthropic) (optional) |
| model | string | Model name (optional) |
| inputTokens | number | Input tokens for LLM spans (optional) |
| outputTokens | number | Output tokens for LLM spans (optional) |
| toolName | string | Tool name for tool spans (optional) |
| toolInput | any | Tool input data (optional) |
| toolOutput | any | Tool output data (optional) |
| input | any | Span input (optional) |
| output | any | Span output (optional) |
| status | enum | `running`, `success`, `error` |
| error | string | Error message (optional) |
| startedAt | datetime | When the span started |
| endedAt | datetime | When the span ended (optional) |
| durationMs | number | Duration in milliseconds (optional) |
| depth | number | Nesting depth level |
| createdAt | datetime | Record creation timestamp |

### Metrics

| Field | Type | Description |
|-------|------|-------------|
| period | string | Time period queried |
| totalTraces | number | Total number of traces |
| successTraces | number | Traces with success status |
| errorTraces | number | Traces with error status |
| avgLatency | number | Average duration in milliseconds |
| totalTokens | number | Total tokens consumed |

## Error Responses

| Status | Description |
|--------|-------------|
| 400 | Invalid period parameter |
| 401 | Unauthorized - Missing or invalid auth |
| 403 | Forbidden - Admin access required |
| 404 | Trace not found |
| 500 | Internal server error |

## Related APIs

- **[Sessions](/api/langchain/sessions)** - Conversation session management
- **[Teams](/api/v1/teams)** - Team management
- **[Users](/api/v1/users)** - User management
