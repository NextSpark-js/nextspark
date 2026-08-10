# MCP Server

**Model Context Protocol • Registry-driven tools • LLM tool-calling • Theme extension point**

---

## Table of Contents

- [Overview](#overview)
- [How Tools Are Generated](#how-tools-are-generated)
- [Enabling MCP in Your App](#enabling-mcp-in-your-app)
- [Connecting an MCP Client](#connecting-an-mcp-client)
- [Security Model](#security-model)
- [The `entities/<slug>/mcp.ts` Extension Point](#the-entitiesslugmcpts-extension-point)
- [Tool Naming and Descriptions](#tool-naming-and-descriptions)
- [Error Messages](#error-messages)
- [Known Limitations](#known-limitations)
- [Troubleshooting](#troubleshooting)

---

## Overview

Every `access.api`-enabled entity in the entity registry already gets a generic REST CRUD
surface at `/api/v1/{entity}` for free. The MCP engine (`@nextsparkjs/core/lib/mcp`) gives
the same entities a **Model Context Protocol** server for free too: every entity becomes a set
of typed `list` / `get` / `create` / `update` / `delete` tools an LLM client (Claude Desktop,
Claude Code, or any MCP-compatible client) can call directly — no per-entity code required.

**Key properties:**

- ✅ **Registry-driven** — new entities become MCP tools automatically the moment they're
  registered with `access.api: true`, the same way they get REST routes today.
- ✅ **Zero per-entity code** — tool schemas are derived from each entity's `EntityField[]`
  definitions; descriptions are seeded from `api/presets.ts`.
- ✅ **Real validation, not a shadow copy** — every tool call round-trips in-process through
  the same `handleGenericList/Create/Read/Update/Delete` handlers the REST API uses, so scope
  checks, team-role permissions, ownership filtering, and field guards are enforced exactly
  once, in one place.
- ✅ **Theme-extensible** — a theme can customize or extend any entity's MCP surface via an
  `entities/<slug>/mcp.ts` file, discovered by the registry build the same way
  `entities/<slug>/api/presets.ts` is discovered today.
- ✅ **Audited** — every tool call, success or failure, is written to `api_audit_log`.

---

## How Tools Are Generated

At server start, `createMcpEngine(registry, options)` iterates the entity registry and, for
every entity where `enabled: true` and `access.api: true` (and not in `excludeSlugs`, which
defaults to `['patterns']`), generates up to five tools:

| Operation | Tool name pattern         | HTTP equivalent              |
|-----------|----------------------------|-------------------------------|
| `list`    | `{prefix}_list_{plural}`   | `GET /api/v1/{slug}`          |
| `get`     | `{prefix}_get_{singular}`  | `GET /api/v1/{slug}/{id}`     |
| `create`  | `{prefix}_create_{singular}` | `POST /api/v1/{slug}`       |
| `update`  | `{prefix}_update_{singular}` | `PATCH /api/v1/{slug}/{id}` |
| `delete`  | `{prefix}_delete_{singular}` | `DELETE /api/v1/{slug}/{id}`|

For a `customers` entity with `toolPrefix: 'acme'`, this produces `acme_list_customers`,
`acme_get_customer`, `acme_create_customer`, `acme_update_customer`, `acme_delete_customer`.

**Input schemas** are built by `buildEntitySchemas()` (`lib/mcp/schema-builder.ts`) from the
entity's `EntityField[]` — not from `generateEntitySchemas()` (the core's own Zod schema
generator), because that generator's fields use `z.union([..., z.undefined()]).transform(...)`
pipelines that `z.toJSONSchema()` cannot convert to JSON Schema (required for MCP's
`tools/list`). The MCP schema is a **presentation layer**: it must be correct about shape,
enums, and required-ness, and must never be *stricter* than what the real API accepts — final
semantic validation always happens inside the real handler at execution time.

This presentation layer also hardens the generic `list` operation against known silent-failure
modes of the underlying API:

- `.strict()` objects — an unknown/misspelled parameter is a validation error, not silently dropped.
- `sortBy` is an enum of the entity's actually-sortable fields (`field.api.sortable`).
- `datetime` fields are excluded from `filters` (the core does `=` equality, which never
  matches a timestamptz — a filter on a datetime field would silently return `[]`). Plain
  `date` fields remain filterable.
- `dateField`/`from`/`to` are validated as a set — the API silently ignores a lone `from`/`to`
  without `dateField`.
- `search` is only exposed when the entity has a `name`/`title`/`slug`/`content` field, and the
  tool description states exactly which field it searches.
- `distinct` is never exposed as an MCP parameter at all.

---

## Enabling MCP in Your App

MCP is delivered the same way the generic entity REST routes are: a small route file your app
owns, wiring the core engine to the generated registries. Add
`app/api/mcp/route.ts` — see `apps/dev/app/api/mcp/route.ts` in this monorepo for the complete,
working reference implementation. The shape is:

```ts
import { createMcpEngine } from '@nextsparkjs/core/lib/mcp'
import { ENTITY_REGISTRY, ENTITY_METADATA } from '@nextsparkjs/registries/entity-registry'
import { MCP_OVERRIDES } from '@nextsparkjs/registries/mcp-registry'
import { API_PRESETS_REGISTRY } from '@nextsparkjs/registries/api-presets-registry'
// ...auth, rate-limit, kill-switch, Origin checks (see the reference route.ts)

const engine = createMcpEngine(entityConfigs, {
  toolPrefix: 'acme',
  overrides: MCP_OVERRIDES,   // auto-discovered entities/<slug>/mcp.ts files
  presets: presetsBySlug,     // tool descriptions seeded from api/presets.ts
})

export const POST = withRateLimitTier(handleMcpPost, 'api')
```

**Required environment variable:**

```bash
# Kill-switch. In production, MCP is OFF unless this is exactly 'true'.
# In development, MCP is ON unless this is exactly 'false'.
MCP_ENABLED=true
```

No other setup is required — `MCP_OVERRIDES` is empty (but valid) until a theme adds its first
`entities/<slug>/mcp.ts` file, and every `access.api` entity is exposed automatically.

---

## Connecting an MCP Client

The endpoint is `POST /api/mcp`, Streamable HTTP in **stateless JSON mode** (no SSE, no
sessions — one request in, one JSON-RPC response out). It authenticates with an **API key
only**; session cookies are rejected.

1. Generate an API key in Settings → API Keys with the scopes you need (e.g. `customers:read`,
   `customers:write`). See [API Authentication](./02-authentication.md) for the scope system.
2. Configure your MCP client (e.g. Claude Desktop's `claude_desktop_config.json`, or a custom
   `mcp remote` connector) to POST to `https://your-app.com/api/mcp` with:
   - `Authorization: Bearer sk_live_...`
   - `x-team-id: <team-id>` (optional — falls back to the `activeTeamId` cookie or the user's
     default team; required if the key's user belongs to more than one team and you want a
     specific one).

`GET` and `DELETE` on `/api/mcp` return `405` — this server never had a session to resume or
delete.

---

## Security Model

- **Kill-switch** — `MCP_ENABLED`. Returns a generic `404` (not `403`) when disabled, so the
  endpoint's existence isn't revealed.
- **Origin validation** — if the request carries an `Origin` header (browser-originated), it
  must match the app's own origin, `NEXT_PUBLIC_APP_URL`, or `BETTER_AUTH_URL` — no CORS
  reflection. Non-browser MCP clients typically send no `Origin` at all and are unaffected.
- **API-key-only auth** — `authenticateRequest` must resolve `type: 'api-key'`; a valid session
  cookie alone is rejected with a message pointing at Settings → API Keys.
- **Scope + team-role permission + ownership/field guards** — enforced by the real generic
  entity handler the in-process executor calls (`handleGenericCreate`, etc.), not by a
  duplicate check in the MCP layer. This means the same `<slug>:read`/`<slug>:write`/
  `<slug>:delete` scopes and the same team-role permission matrix that gate the REST API gate
  MCP tool calls too — there is exactly one place this logic lives.
- **`confirm: true` required on every delete** — the delete tool's schema always includes a
  `confirm` boolean; the handler rejects the call *before* the executor is ever invoked if it
  isn't `true`.
- **Full audit trail** — every tool call, whether it succeeds or fails, is written to
  `api_audit_log` with an `mcp:<tool-name>` endpoint prefix, the resolved `apiKeyId`/`userId`,
  status code, and a truncated copy of the arguments.
- **Rate limiting** — `withRateLimitTier(handler, 'api')`. Because the executor invokes
  handlers in-process (bypassing the normal per-route rate-limit middleware), this is the
  *only* rate limit on the whole MCP surface — make sure distributed rate limiting (Redis) is
  configured in production. See [Rate Limiting](./07-rate-limiting.md).

---

## The `entities/<slug>/mcp.ts` Extension Point

A theme customizes one entity's MCP surface by adding `entities/<slug>/mcp.ts` — a sibling of
`<slug>.config.ts`, `api/presets.ts`, and `migrations/`, **not** nested under `api/`. It's
discovered automatically by the registry build (`scripts/build/registry/discovery/mcp-overrides.mjs`)
and exposed as `MCP_OVERRIDES[slug]` in the generated `mcp-registry.ts` — no manual wiring, no
import list to maintain.

```ts
// themes/<theme>/entities/tasks/mcp.ts
import type { McpEntityOverride } from '@nextsparkjs/core/lib/mcp'

const tasksMcpOverride: McpEntityOverride = {
  excludeOperations: ['delete'],       // hide specific generated tools
  relaxRequired: ['dueDate'],          // optional in the MCP schema even if the API requires it
  describe: {
    entity: 'A to-do item owned by a team member.',
    fields: { title: 'Short, action-oriented task title.' },
    tools: { delete: 'This also removes any linked reminders.' },
  },
  errorHints: ['weekStart must be a Monday'],   // appended to unexplained 500s
  transformInput: async (operation, input, ctx) => {
    if (operation === 'create' && !input.dueDate) {
      throw new McpToolError('dueDate is required — never invent one, ask the user.')
    }
    return input
  },
  transformOutput: (operation, output) => output,
  extraTools: (api) => [
    // Non-CRUD "workflow" tools. Use api.execute / api.entitySchemas — the engine's OWN wired
    // versions (date normalization + transformOutput applied) — never call handlers directly.
  ],
}

export default tasksMcpOverride
```

| Field                | Purpose                                                                 |
|-----------------------|--------------------------------------------------------------------------|
| `exclude`             | Hide the entire entity from the MCP surface.                            |
| `excludeOperations`   | Hide specific generated tools. A first-class security mechanism, not just UX. |
| `relaxRequired`       | Field names optional in the MCP schema even though the API requires them (pair with `transformInput` to still enforce them intentionally). |
| `describe`             | Override entity/field/tool descriptions shown to the LLM.               |
| `errorHints`          | Extra guidance appended to unexplained `500` errors (e.g. a swallowed CHECK constraint). |
| `transformInput`      | Mutate or reject (`throw new McpToolError(...)`) input before it reaches the executor. |
| `transformOutput`     | Mutate output after every read/write — applies to generated tools *and* `extraTools`. |
| `extraTools`           | Add non-CRUD "workflow" tools (batch operations, multi-step merges, etc.). |

A real, working example ships in this repo: `themes/default/entities/tasks/mcp.ts`.

---

## Tool Naming and Descriptions

- `toolPrefix` comes from `MCP_TOOL_PREFIX`, falling back to a sanitized `NEXT_PUBLIC_ACTIVE_THEME`.
- The plural segment of list-tool names (`{prefix}_list_{plural}`) is derived from the entity
  **slug**, not `names.plural` — a display name like "Meal Plans" would otherwise produce
  `acme_list_meal_plans` next to `acme_get_mealplan`, a mismatch that makes the tool set harder
  to reason about.
- Descriptions are seeded from `api/presets.ts`: the preset file's `summary` becomes the entity
  description, and a matching preset's `payload`/`params` becomes an inline few-shot example.

---

## Error Messages

API errors are translated into actionable, LLM-facing text by `translateApiError()`
(`lib/mcp/errors.ts`) rather than surfaced as raw HTTP status codes — e.g. a `403` on a delete
call explicitly names the missing scope (`customers:delete`) and distinguishes a scope problem
from a team-role permission problem.

---

## Known Limitations

- **No OAuth flow yet** — connecting a client today means manually generating and configuring
  an API key. An OAuth-based "connect in two clicks" flow for claude.ai custom connectors
  (via Better Auth's `mcp`/`oidc-provider` plugins) is tracked as a follow-up, not part of this
  initial version.
- **One rate-limit tier for the whole surface** — see [Security Model](#security-model) above;
  size your `'api'` tier limits with MCP traffic in mind.
- **Per-entity operation granularity only** — `access.api` is all-or-nothing per entity; use
  `excludeOperations` in an `entities/<slug>/mcp.ts` override for finer control (e.g. read-only
  MCP access to an entity that still needs full CRUD via the REST API).

---

## Troubleshooting

**`401` "This endpoint requires an API key"**
The request used a session cookie, or no credential at all. MCP only accepts
`Authorization: Bearer sk_...` / `x-api-key`.

**`403` "Origin not allowed"**
A browser-originated request's `Origin` header didn't match the app's own origin,
`NEXT_PUBLIC_APP_URL`, or `BETTER_AUTH_URL`. Non-browser MCP clients that send no `Origin` are
unaffected.

**`404` on every request**
`MCP_ENABLED` is unset or `false` in production, or explicitly `false` in development.

**"Sin permiso para `<op>` en `<slug>`... necesita el scope `<slug>:<op>`"**
The API key's scopes don't authorize this operation. Mint a new key with the required scope —
see [API Authentication](./02-authentication.md).

**A tool call succeeds but nothing shows up in `api_audit_log`**
Confirm the call actually reached a tool handler — an input-schema validation failure at the
MCP SDK layer (malformed arguments) is rejected before the engine's handler wrapper runs, so it
is never audited. Only calls that reach `tool.handler` are recorded.

**Next Steps:**
- [API Authentication](./02-authentication.md) — scopes, API keys, dual auth
- [Rate Limiting](./07-rate-limiting.md) — tiers and distributed rate limiting
- [Error Handling](./08-error-handling.md) — the underlying REST error codes MCP translates

**Documentation:** `core/docs/05-api/20-mcp-server.md`
