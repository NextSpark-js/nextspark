# @nextsparkjs/plugin-langchain

AI agent infrastructure for NextSpark, built on [LangChain](https://langchain.com/) and [LangGraph](https://langchain-ai.github.io/langgraph/): agents with tools, conversation memory stored in PostgreSQL, several LLM providers, a graph orchestrator, token tracking, guardrails, streaming and an observability dashboard.

> **Stability: experimental.** The first-party plugins are not part of the stable 1.0 surface and may change in a minor release without a deprecation period; `definePlugin` itself is stable. See [Stability](https://github.com/NextSpark-js/nextspark/blob/main/packages/core/docs/22-stability-and-support/01-stability.md).

## What it provides

| Area | What you get |
| --- | --- |
| Providers | OpenAI, Anthropic and Ollama; any OpenAI-compatible server (LM Studio, LocalAI) through `LANGCHAIN_OPENAI_BASE_URL` |
| Agents | `createAgent` in `lib/agent-factory`, tools helpers in `lib/tools-builder`, per-agent model configuration |
| Memory | Sessions saved in the `langchain_sessions` table, isolated by team with row-level security |
| Orchestration | A graph (state machine) orchestrator that routes a request to specialized agents |
| Operations | Token and cost tracking, injection and PII guardrails, SSE streaming |
| Observability | Traces, spans and metrics in `langchain_traces` and `langchain_spans`, with a dashboard component and the `/api/plugins/langchain/observability/*` routes |
| API | `/api/plugins/langchain/sessions`, with the API key scopes `ai:read` and `ai:write` |

The plugin knows nothing about your entities: your project defines the agents, the tools and the system prompts, and the plugin runs them.

## Installation

1. Add the package, enable it and tell Next.js to compile it:

   ```bash
   pnpm add @nextsparkjs/plugin-langchain
   ```

   ```ts
   // nextspark.config.ts
   export default defineConfig({ plugins: ['@nextsparkjs/plugin-langchain'] })
   ```

   Add `'@nextsparkjs/plugin-langchain'` to `transpilePackages` in your Next config, next to `@nextsparkjs/core`: the plugin ships TypeScript source, and `nextspark prepare` stops and tells you if it is missing. `pnpm exec nextspark add:plugin @nextsparkjs/plugin-langchain` is an experimental helper that adds a plugin to a project.

2. Run the migrations: `pnpm db:migrate`. They create `langchain_sessions`, `langchain_token_usage`, `langchain_traces` and `langchain_spans`.

3. Set the variables in your project's `.env`. The plugin is disabled unless `LANGCHAIN_PLUGIN_ENABLED=true`.

   | Variable | Purpose |
   | --- | --- |
   | `LANGCHAIN_PLUGIN_ENABLED` | `true` enables the plugin |
   | `LANGCHAIN_DEFAULT_PROVIDER` | `ollama` (default), `openai` or `anthropic` |
   | `LANGCHAIN_OLLAMA_BASE_URL`, `LANGCHAIN_OLLAMA_MODEL` | Local Ollama server; defaults `http://localhost:11434` and `llama3.2:3b`. No API key |
   | `OPENAI_API_KEY`, `LANGCHAIN_OPENAI_MODEL`, `LANGCHAIN_OPENAI_BASE_URL` | OpenAI, or an OpenAI-compatible server with the base URL |
   | `ANTHROPIC_API_KEY`, `LANGCHAIN_ANTHROPIC_MODEL` | Anthropic |
   | `LANGCHAIN_USE_GRAPH_ORCHESTRATOR`, `LANGCHAIN_PLUGIN_DEBUG`, `LANGCHAIN_DEBUG` | Feature flag and debug logging |

   The package's `.env.example` is the template.

4. Define your agents and tools in your project and import the plugin's modules by path, for example `@nextsparkjs/plugin-langchain/lib/agent-factory`. The [installation guide](./docs/01-getting-started/02-installation.md) and the [configuration guide](./docs/01-getting-started/03-configuration.md) show the project side.

## Requirements

- `@nextsparkjs/core` `>=0.1.0-beta.192`, with Next.js `~16.4.5` and React `^19.2.0`
- Peer dependencies: `@tanstack/react-query` `^5`, `next-intl` `^4`, `lucide-react` `^0.539.0` and `zod` `^4.6.6`
- Node.js 22.x (22.14.0 or later) or 24.x
- Standard PostgreSQL 15 to 18 (see the [support matrix](https://github.com/NextSpark-js/nextspark/blob/main/packages/core/docs/22-stability-and-support/02-support-matrix.md))
- At least one reachable LLM provider

## Documentation

The plugin's guides are in [`docs/`](./docs/index.md):

- [Overview](./docs/01-getting-started/01-overview.md) and [installation](./docs/01-getting-started/02-installation.md)
- [Agents](./docs/02-core-concepts/02-agents.md) and [tools](./docs/02-core-concepts/03-tools.md)
- [Graph orchestrator](./docs/03-orchestration/01-graph-orchestrator.md)
- [Observability](./docs/04-advanced/01-observability.md), [token tracking](./docs/04-advanced/02-token-tracking.md), [streaming](./docs/04-advanced/03-streaming.md) and [guardrails](./docs/04-advanced/04-guardrails.md)
- [API reference](./docs/05-reference/01-api-reference.md)
- [Plugin system](https://www.nextspark.dev/docs/plugin-system/introduction) in the NextSpark documentation

## License

MIT
