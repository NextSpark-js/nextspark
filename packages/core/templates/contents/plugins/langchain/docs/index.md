# LangChain Plugin Documentation

Complete documentation for the LangChain Plugin - a comprehensive AI agent infrastructure for Next.js applications.

---

## Quick Links

| I want to... | Go to... |
|--------------|----------|
| Understand what this plugin does | [Overview](./01-getting-started/01-overview.md) |
| Install and configure the plugin | [Installation](./01-getting-started/02-installation.md) |
| Set up the graph orchestrator | [Graph Orchestrator](./03-orchestration/01-graph-orchestrator.md) |
| Monitor AI usage and costs | [Token Tracking](./04-advanced/02-token-tracking.md) |
| Debug agent execution | [Observability](./04-advanced/01-observability.md) |

---

## Documentation Structure

### 01 - Getting Started

Essential guides for setting up and configuring the plugin.

| Document | Description |
|----------|-------------|
| [01 - Overview](./01-getting-started/01-overview.md) | Introduction and core concepts |
| [02 - Installation](./01-getting-started/02-installation.md) | Setup, migrations, and dependencies |
| [03 - Configuration](./01-getting-started/03-configuration.md) | Theme-level agent configuration |

### 02 - Core Concepts

Deep dives into the fundamental building blocks.

| Document | Description |
|----------|-------------|
| [01 - Architecture](./02-core-concepts/01-architecture.md) | Technical architecture and patterns |
| [02 - Agents](./02-core-concepts/02-agents.md) | Creating and customizing agents |
| [03 - Tools](./02-core-concepts/03-tools.md) | Building tools for agents |

### 03 - Orchestration

Multi-agent routing and coordination patterns.

| Document | Description |
|----------|-------------|
| [01 - Graph Orchestrator](./03-orchestration/01-graph-orchestrator.md) | **Recommended** - Modern state-machine orchestration |
| [02 - Legacy ReAct](./03-orchestration/02-legacy-react.md) | Deprecated ReAct-based approach |

### 04 - Advanced Topics

Production-ready features for monitoring, security, and performance.

| Document | Description |
|----------|-------------|
| [01 - Observability](./04-advanced/01-observability.md) | Tracing, metrics, and debugging dashboard |
| [02 - Token Tracking](./04-advanced/02-token-tracking.md) | Token usage and cost monitoring |
| [03 - Streaming](./04-advanced/03-streaming.md) | Real-time SSE streaming responses |
| [04 - Guardrails](./04-advanced/04-guardrails.md) | Security: injection detection, PII masking |

### 05 - Reference

Complete API documentation and examples.

| Document | Description |
|----------|-------------|
| [01 - API Reference](./05-reference/01-api-reference.md) | Complete API documentation |
| [02 - Customization](./05-reference/02-customization.md) | Advanced customization guide |
| [03 - Examples](./05-reference/03-examples.md) | Real-world implementation examples |

---

## Version History

| Version | Changes |
|---------|---------|
| v3.0 | Added Graph Orchestrator, Observability, Token Tracking, Streaming, Guardrails |
| v2.0 | Added multi-provider support, persistent memory |
| v1.0 | Initial release with ReAct-based orchestration |

---

## Related Documentation

- [Theme AI Documentation](../../themes/default/docs/03-ai/) - Theme-specific AI customization
