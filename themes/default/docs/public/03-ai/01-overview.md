---
title: AI Assistant Overview
description: Learn about the AI-powered assistant features and multi-agent architecture.
---

# AI Assistant - Overview

This theme includes an AI-powered assistant that helps users manage tasks, customers, and pages through natural language.

## Features

### Multi-Agent Architecture

The assistant uses a graph-based orchestrator that routes requests to specialized handlers:

| Intent | Handler | Description |
|--------|---------|-------------|
| `task` | Task Handler | Manage tasks (create, update, list, delete) |
| `customer` | Customer Handler | Manage customers (CRUD, search) |
| `page` | Page Handler | Manage pages and blocks |
| `greeting` | Greeting Handler | Respond to casual greetings |
| `unclear` | Clarification | Ask for more details |

### Key Capabilities

- **Natural Language**: Talk to the assistant in plain English
- **Multi-Intent**: Handle multiple requests in one message
- **Context-Aware**: Remembers conversation history
- **Real-Time Streaming**: See responses as they're generated
- **Tool Execution**: Automatically executes CRUD operations

---

## Quick Start

### Accessing the Assistant

The AI assistant is available at:

```
/dashboard/ai-assistant
```

### Example Interactions

**Task Management:**
```
User: Show my tasks for this week
Assistant: I found 5 tasks due this week...

User: Create a new task to review the quarterly report
Assistant: Done! Created task "Review quarterly report" with default settings.
```

**Customer Management:**
```
User: Find customers from California
Assistant: Found 3 customers in California...

User: Show me John Smith's details
Assistant: Here are the details for John Smith...
```

**Page Management:**
```
User: List all published pages
Assistant: You have 12 published pages...
```

---

## Configuration

### Theme Configuration

The AI assistant is configured in `langchain.config.ts`:

```typescript
// contents/themes/default/langchain.config.ts
export const langchainConfig: LangChainConfig = {
    observability: {
        enabled: true,
        retention: { traces: 30 },
        sampling: { rate: 1.0, alwaysTraceErrors: true },
        pii: { maskInputs: false, maskOutputs: false, truncateAt: 10000 },
    },
}
```

### Environment Variables

Required environment variables:

```env
# Enable the LangChain plugin
LANGCHAIN_PLUGIN_ENABLED=true

# Choose your LLM provider
LANGCHAIN_OLLAMA_MODEL=qwen2.5:7b        # For local development
# OR
OPENAI_API_KEY=sk-...                     # For production
LANGCHAIN_OPENAI_MODEL=gpt-4o-mini

# Enable graph orchestrator (recommended)
LANGCHAIN_USE_GRAPH_ORCHESTRATOR=true
```

---

## Architecture

### Graph Orchestrator

The theme uses the graph-based orchestrator for efficient multi-intent handling:

```
User Message → Router → Handlers → Combiner → Response
                 │
                 ├─→ Task Handler (0 LLM calls)
                 ├─→ Customer Handler (0 LLM calls)
                 ├─→ Page Handler (0 LLM calls)
                 └─→ Greeting Handler (0 LLM calls)
```

**Benefits:**
- 1-2 LLM calls per request (vs 50+ with ReAct)
- 2-3 second response time
- No recursion limit issues
- ~$0.001 per request

### Available Agents

| Agent | Purpose | Tools |
|-------|---------|-------|
| `orchestrator` | Main entry point | Intent routing |
| `task-assistant` | Task management | Task CRUD |
| `customer-assistant` | Customer management | Customer CRUD |
| `page-assistant` | Page/block management | Page CRUD |
| `single-agent` | Unified agent | All tools |

---

## Monitoring

### Token Usage Dashboard

Track AI usage at:

```
/dashboard/settings/ai-usage
```

Shows:
- Total tokens used
- Cost breakdown by model
- Daily usage charts
- Request counts

### Observability Dashboard (Admin)

For superadmins, detailed traces at:

```
/sector7/ai-observability
```

Shows:
- Request traces with timing
- Individual LLM/tool spans
- Error debugging
- Performance metrics

---

## Security

### Built-in Protections

The assistant includes guardrails for:

- **Prompt Injection Detection**: Blocks manipulation attempts
- **PII Masking**: Redacts sensitive data in traces
- **Content Filtering**: Filters inappropriate outputs

### Data Isolation

All data is isolated by user and team through Row-Level Security (RLS).

---

## Troubleshooting

### Common Issues

**Assistant not responding:**
1. Check `LANGCHAIN_PLUGIN_ENABLED=true`
2. Verify LLM provider is configured
3. Check browser console for errors

**Slow responses:**
1. Enable graph orchestrator: `LANGCHAIN_USE_GRAPH_ORCHESTRATOR=true`
2. Use faster model (gpt-4o-mini, claude-3-haiku)
3. Check network latency to LLM provider

**Wrong tool called:**
1. Be more specific in your request
2. Try rephrasing the question
3. Check agent prompts for clarity

---

## Related Documentation

- [Plugin Overview](../../../plugins/langchain/docs/01-overview.md)
- [Graph Orchestrator](../../../plugins/langchain/docs/11-graph-orchestrator.md)
- [Configuration](../../../plugins/langchain/docs/04-configuration.md)
