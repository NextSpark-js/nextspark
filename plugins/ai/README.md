# @nextsparkjs/plugin-ai

Core AI utilities for NextSpark: text generation and embedding endpoints, a model selector, cost calculation, and an AI history entity that records each call. It supports OpenAI, Anthropic and Ollama (local models). The endpoints work as shipped, with authentication, an API key scope and rate limiting; its utilities also let you build your own endpoints and components.

> **Stability: experimental.** The first-party plugins are not part of the stable 1.0 surface and may change in a minor release without a deprecation period. See [Stability](https://github.com/NextSpark-js/nextspark/blob/main/packages/core/docs/22-stability-and-support/01-stability.md).

## What it provides

| Piece | Where |
| --- | --- |
| Text generation | `POST /api/plugins/ai/generate` (`GET` returns the capabilities) |
| Embeddings | `POST /api/plugins/ai/embeddings`, with OpenAI `text-embedding-3-small` |
| AI history | The `ai-history` entity (`/api/v1/ai-history`), with its own migrations |
| Utilities | `selectModel`, `calculateCost`, `checkCostLimits`, `validatePlugin`, `extractTokens`, `handleAIError` and `COST_CONFIG`, in `lib/core-utils` |
| Types | `types/ai.types` |

The routes accept a session or an API key with the `ai:write` scope, and are rate limited.

## Installation

1. Add the package and enable it:

   ```bash
   pnpm add @nextsparkjs/plugin-ai
   ```

   ```ts
   // nextspark.config.ts
   export default defineConfig({ plugins: ['@nextsparkjs/plugin-ai'] })
   ```

   Add `'@nextsparkjs/plugin-ai'` to `transpilePackages` in your Next config, next to `@nextsparkjs/core`: the plugin ships TypeScript source, and `nextspark prepare` stops and tells you if it is missing. `pnpm exec nextspark add:plugin @nextsparkjs/plugin-ai` is an experimental helper that adds a plugin to a project.

2. Run `pnpm db:migrate` to create the `ai_history` tables.

3. Set the provider variables in your project's `.env`. The package's `.env.example` is the template:

   | Variable | Default | Purpose |
   | --- | --- | --- |
   | `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` | none | Cloud providers; embeddings need `OPENAI_API_KEY` |
   | `OLLAMA_BASE_URL`, `OLLAMA_DEFAULT_MODEL` | `http://localhost:11434`, `llama3.2:3b` | Local models, no key needed |
   | `USE_LOCAL_AI` | `false` | Prefer Ollama over the cloud models |
   | `DEFAULT_CLOUD_MODEL` | `claude-sonnet-4-5-20250929` | Model for cloud requests |
   | `AI_PLUGIN_ENABLED` | `true` | `false` makes the endpoints answer 503 |
   | `AI_PLUGIN_DEFAULT_PROVIDER` | `anthropic` | `anthropic`, `openai` or `ollama` |
   | `AI_PLUGIN_MAX_TOKENS`, `AI_PLUGIN_DEFAULT_TEMPERATURE` | `4000`, `0.7` | Generation defaults |
   | `AI_PLUGIN_COST_TRACKING_ENABLED`, `AI_PLUGIN_DAILY_COST_LIMIT`, `AI_PLUGIN_MONTHLY_COST_LIMIT` | `true`, `10.00`, `100.00` (USD) | Cost tracking and the limits `checkCostLimits` uses (see Notes) |
   | `AI_PLUGIN_DEBUG` | `false` | Debug logging |

4. Call the endpoints, or build your own on `lib/core-utils`. The guides below have the request bodies and examples.

Notes:

- `.env.example` also lists `AI_PLUGIN_RATE_LIMIT_REQUESTS_PER_MINUTE` and `AI_PLUGIN_RATE_LIMIT_TOKENS_PER_MINUTE`: the plugin reads them, but no route uses them; the routes use core's rate limit tiers.
- `checkCostLimits` is a utility for your own routes: the routes the plugin ships do not call it, so the endpoints apply no cost limit. It sums the usage in `langchain_token_usage`, so it needs the LangChain plugin's migrations; without that table it throws instead of letting the request through. With the daily and monthly limits both at `0` it does nothing.

## Requirements

- `@nextsparkjs/core` `>=0.1.0-beta.192`, with Next.js `~16.4.5` and React `^19.2.0`
- Peer dependencies: `@tanstack/react-query` `^5`, `lucide-react` `^0.539.0` and `zod` `^4.6.6`
- Node.js 22.x (22.14.0 or later) or 24.x
- Standard PostgreSQL 15 to 18 (see the [support matrix](https://github.com/NextSpark-js/nextspark/blob/main/packages/core/docs/22-stability-and-support/02-support-matrix.md))
- A provider: an API key for Anthropic or OpenAI, or a running Ollama server

## Documentation

- [Introduction](./docs/01-getting-started/01-introduction.md), [installation](./docs/01-getting-started/02-installation.md) and [configuration](./docs/01-getting-started/03-configuration.md)
- [Text generation](./docs/02-features/01-text-generation.md), [embeddings](./docs/02-features/02-embeddings.md) and [AI history](./docs/02-features/03-ai-history.md)
- [Core utilities](./docs/03-advanced-usage/01-core-utilities.md) and [content generation](./docs/04-use-cases/01-content-generation.md)
- [The generate endpoint](./api/generate/docs.md)
- [Plugin system](https://www.nextspark.dev/docs/plugin-system/introduction) in the NextSpark documentation

## License

MIT
