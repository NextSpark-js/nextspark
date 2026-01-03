# LangChain Plugin - Overview

## Introduction

The LangChain Plugin is a comprehensive AI agent infrastructure that enables themes to integrate conversational AI capabilities into their applications. Built on top of [LangChain](https://langchain.com/) and [LangGraph](https://langchain-ai.github.io/langgraph/), this plugin provides a complete framework for creating, configuring, and deploying AI agents with:

- **Multiple LLM Provider Support**: OpenAI, Anthropic, and Ollama (local)
- **Persistent Conversation Memory**: Database-backed session management
- **Tool-based Architecture**: Agents interact with your data through well-defined tools
- **Multi-tenant Security**: Row-Level Security (RLS) for data isolation
- **Orchestration Patterns**: Route requests to specialized agents

## Core Concepts

### What is an AI Agent?

An AI agent is a system that uses a Large Language Model (LLM) to reason about problems and take actions through tools. Unlike simple chat interfaces, agents can:

1. **Reason** about the user's intent
2. **Plan** a sequence of actions
3. **Execute** tools to retrieve or modify data
4. **Respond** with accurate, data-driven answers

```
User Message → Agent (LLM + Tools) → Tool Execution → Response
```

### Plugin vs Theme Responsibility

This plugin follows a clear separation of concerns:

| Plugin Provides | Theme Implements |
|-----------------|------------------|
| Agent creation infrastructure | Agent definitions and configuration |
| Memory persistence | Entity-specific tools |
| Provider abstraction | System prompts |
| Tool building utilities | API endpoints |
| Message serialization | Orchestration logic |

The plugin is **entity-agnostic** - it doesn't know about your tasks, customers, or pages. Themes define what data agents can access and how.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         THEME LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│  langchain.config.ts    │  agents/*.md   │  tools/*.ts          │
│  (Agent Definitions)    │  (Prompts)     │  (Entity Tools)      │
├─────────────────────────────────────────────────────────────────┤
│                         PLUGIN LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│  createAgent()   │  memoryStore    │  providers     │  buildTools│
│  (Factory)       │  (Persistence)  │  (LLM Access)  │  (Helpers) │
├─────────────────────────────────────────────────────────────────┤
│                       LANGCHAIN/LANGGRAPH                        │
├─────────────────────────────────────────────────────────────────┤
│  LLM Providers   │  ReAct Pattern  │  Message Types │  Tool Calls│
└─────────────────────────────────────────────────────────────────┘
```

## Key Features

### 1. Multi-Provider Support

Switch between LLM providers without changing your agent code:

```typescript
// Use local Ollama for development
{ provider: 'ollama', model: 'llama3.2:3b' }

// Use OpenAI for production
{ provider: 'openai', model: 'gpt-4o' }

// Use Anthropic for specific agents
{ provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' }
```

### 2. Persistent Conversations

All conversations are automatically persisted to PostgreSQL with:

- **Session Management**: Create, list, rename, pin conversations
- **Message Limits**: Configurable sliding window (default: 50 messages)
- **Conversation Limits**: Maximum 50 conversations per user
- **Multi-tenancy**: Isolated by userId + teamId

### 3. Tool-Based Data Access

Agents interact with your data through tools, not direct database access:

```typescript
const taskTools = [
    {
        name: 'list_tasks',
        description: 'List all tasks for the current user',
        schema: z.object({ status: z.string().optional() }),
        func: async ({ status }) => TasksService.list(userId, { status })
    }
]
```

### 4. Orchestration Patterns

Route requests to specialized agents based on user intent:

```
User: "Show me my tasks"
  → Orchestrator analyzes intent
  → Routes to Task Agent
  → Task Agent uses task tools
  → Returns task list
```

## Use Cases

### Single Agent Architecture

Best for simple applications with unified data access:

- Personal productivity apps
- Small business tools
- Prototypes and MVPs

```
User → Single Agent (all tools) → Response
```

### Multi-Agent Orchestration

Best for complex applications with specialized domains:

- Enterprise CRM systems
- Content management platforms
- E-commerce with multiple entities

```
User → Orchestrator → [Task Agent | Customer Agent | Page Agent] → Response
```

## Getting Started

To integrate the LangChain plugin into your theme:

1. **Install Dependencies**: Run the database migration
2. **Configure Environment**: Set up LLM provider credentials
3. **Create Configuration**: Define agents in `langchain.config.ts`
4. **Build Tools**: Create tools for your entities
5. **Write Prompts**: Define agent behavior in markdown files
6. **Expose API**: Create chat endpoints for your frontend

Continue to the [Architecture](../02-core-concepts/01-architecture.md) section for detailed technical concepts, or jump to [Installation](./02-installation.md) to get started immediately.

## Documentation Structure

See the full [Documentation Index](../index.md) for navigation.

### Getting Started

| Section | Description |
|---------|-------------|
| [Overview](./01-overview.md) | Introduction and core concepts (you are here) |
| [Installation](./02-installation.md) | Setup and dependencies |
| [Configuration](./03-configuration.md) | Theme-level configuration |

### Core Concepts

| Section | Description |
|---------|-------------|
| [Architecture](../02-core-concepts/01-architecture.md) | Technical architecture and patterns |
| [Agents](../02-core-concepts/02-agents.md) | Creating and customizing agents |
| [Tools](../02-core-concepts/03-tools.md) | Building tools for agents |

### Orchestration

| Section | Description |
|---------|-------------|
| [Graph Orchestrator](../03-orchestration/01-graph-orchestrator.md) | **Recommended** - Modern state-machine orchestration |
| [Legacy ReAct](../03-orchestration/02-legacy-react.md) | Deprecated ReAct-based approach |

### Advanced Topics

| Section | Description |
|---------|-------------|
| [Observability](../04-advanced/01-observability.md) | Tracing, metrics, and debugging dashboard |
| [Token Tracking](../04-advanced/02-token-tracking.md) | Token usage and cost monitoring |
| [Streaming](../04-advanced/03-streaming.md) | Real-time SSE streaming responses |
| [Guardrails](../04-advanced/04-guardrails.md) | Security: injection detection, PII masking |

### Reference

| Section | Description |
|---------|-------------|
| [API Reference](../05-reference/01-api-reference.md) | Complete API documentation |
| [Customization](../05-reference/02-customization.md) | Advanced customization guide |
| [Examples](../05-reference/03-examples.md) | Real-world implementation examples |
