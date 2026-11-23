# MCP Server

> **Experimental:** The MCP server is not part of the stable 1.0 surface and may change without a deprecation period.

**Model Context Protocol • Registry-driven tools • API key or browser sign-in • Theme extension point**

---

## Table of Contents

- [Overview](#overview)
- [How Tools Are Generated](#how-tools-are-generated)
- [Enabling MCP in Your App](#enabling-mcp-in-your-app)
- [Authentication](#authentication)
- [Connecting an MCP Client](#connecting-an-mcp-client)
- [Browser Sign-in (experimental)](#browser-sign-in-experimental)
- [Security Model](#security-model)
- [Audit Trail](#audit-trail)
- [Rate Limits](#rate-limits)
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
of typed `list` / `get` / `create` / `update` / `delete` tools an LLM client (Claude, Claude Code,
ChatGPT, or any MCP-compatible client) can call directly — no per-entity code required.

**Key properties:**

- ✅ **Registry-driven** — new entities become MCP tools automatically the moment they're
  registered with `access.api: true`, the same way they get REST routes today.
- ✅ **Zero per-entity code** — tool schemas are derived from each entity's `EntityField[]`
  definitions; descriptions are seeded from `api/presets.ts`.
- ✅ **Real validation, not a shadow copy** — every generated entity tool round-trips in-process
  through the same `handleGenericList/Create/Read/Update/Delete` handlers the REST API uses, so scope
  checks, team-role permissions, ownership filtering, and field guards are the handlers' own, not a
  copy kept for MCP. A hand-written tool is bound by them for each API handler it calls. With
  browser sign-in the scopes are checked a second time, earlier: before anything runs.
- ✅ **Two credentials** — an API key, or, when the project turns on
  [browser sign-in](#browser-sign-in-experimental), an OAuth access token the client obtains by sending the user to
  sign in. Session cookies are not a credential for this endpoint.
- ✅ **Theme-extensible** — a theme can customize or extend any entity's MCP surface via an
  `entities/<slug>/mcp.ts` file, discovered by the registry build the same way
  `entities/<slug>/api/presets.ts` is discovered today.
- ✅ **Audited** — every tool call that reaches its handler, success or failure, is recorded in `api_audit_log`
  (best effort: a failed write is logged and does not stop the call). See
  [Audit Trail](#audit-trail).

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

### What a tool returns

The `list`, `get`, `create` and `update` tools return their data **twice** (`withData` in
`lib/mcp/tool-generator.ts`):

- as `structuredContent`, for a client that reads structured results;
- as text: a first text block with a one-line summary (`15 Tasks (page 1/2)`), and a second text block with the
  same data serialized as JSON.

The second text block is there because an assistant such as Claude reads only the text of a result. Without it a
list answered "15 Tasks" and the model saw no rows. This applies to both credentials.

A `delete` returns a text confirmation only. An error returns one text block with `isError: true`.

### Scopes a tool needs

The engine knows which scopes a call to a tool needs before it runs:

| | |
|---|---|
| `engine.requiredScopesFor(toolName)` | A generated entity tool: `<entity>:read` for `list` and `get`, `<entity>:write` for `create` and `update`, `<entity>:delete` for `delete`. A hand-written tool: what it declares in `meta.requiredScopes`. Nothing for a hand-written tool that declares none, or for an unknown name |
| `engine.toolScopes` | The union over all tools: every scope some tool of this server needs |
| `engine.auditRefused(body, ctx, granted)` | Tries to record, best effort, the tool calls of a request that was refused for missing scopes: one row for each well-formed call of a known tool; a write that fails is logged and nothing else |

A hand-written tool that makes several API calls (an `extraTools` entry, a utility tool) should declare what it
needs:

```ts
const mergeCustomers: McpToolDefinition = {
  name: 'acme_merge_customers',
  // ...
  meta: { operation: 'workflow', requiredScopes: ['customers:read', 'customers:write', 'customers:delete'] },
}
```

On the API key path this metadata changes nothing: each API call the tool makes is checked by its handler. With
[browser sign-in](#browser-sign-in-experimental) it is what lets the server refuse the call up front with a `403`
that tells the client which permission to ask the user for. A hand-written tool without `meta.requiredScopes` still
has each call checked where it is made, but the client gets a tool error instead of the challenge.

**A scope no generated tool uses has to be declared next to the tools.** Browser sign-in publishes, offers on the
consent screen and grants only the scopes of the generated tools, plus the ones a project declares as a plain list:

```ts
// entities/tasks/mcp.ts: delete is not exposed as a tool, an archive tool needs the scope
const tasksMcpOverride: McpEntityOverride = {
  excludeOperations: ['delete'],
  extraTools: api => [archiveTask(api)],   // meta.requiredScopes: ['tasks:read', 'tasks:delete']
  extraToolScopes: ['tasks:delete'],
}
```

`extraToolScopes` goes with `extraTools` in an entity's `mcp.ts`; `utilityToolScopes` goes with `utilityTools` in
the engine options. The list is read without building the tools, because the authorization server is configured
before there is an engine. A tool that needs a scope that is in neither still works with an API key, but no browser
sign-in connection can be granted that scope: the engine logs a warning that names the tool and the scope when it
builds it.

---

## Enabling MCP in Your App

MCP is served by core: `@nextsparkjs/core/routes/api/mcp/route` (`packages/core/src/routes/api/mcp/route.ts` in this monorepo) wires the core engine to the generated registries, and `nextspark prepare` generates `src/app/api/mcp/route.ts` re-exporting it. There is nothing to add to your project. The shape of that route is:

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

**Environment variables:**

| Variable | Effect |
|---|---|
| `MCP_ENABLED` | The kill-switch. In production MCP is **off** unless this is exactly `true`. In development MCP is **on** unless this is exactly `false` |
| `MCP_TOOL_PREFIX` | The prefix of tool names. Defaults to `app` |
| `MCP_OAUTH_ENABLED` | Only meaningful in a project built with browser sign-in: `false` switches it off at runtime without a build |

**With API keys, no other setup is required** — `MCP_OVERRIDES` is empty (but valid) until a theme adds its first
`entities/<slug>/mcp.ts` file, and every `access.api` entity is exposed automatically.

**Browser sign-in needs more**: the build flag `features: { mcpOAuth: true }` in `nextspark.config.ts`, migration
`048_oauth_provider.sql`, and correct `NEXT_PUBLIC_APP_URL` and `BETTER_AUTH_URL`. For production, also a list of
accepted applications and Redis. See [Browser Sign-in](#browser-sign-in-experimental).

---

## Authentication

The endpoint accepts two credentials, and never both in one request.

| Credential | How it is presented | When it is accepted |
|---|---|---|
| **API key** | `Authorization: Bearer sk_live_...` (or `sk_test_...`), or the `x-api-key` header | Always |
| **OAuth access token** | `Authorization: Bearer <JWT>` | Only when browser sign-in is on: built with `features.mcpOAuth` and not switched off by `MCP_OAUTH_ENABLED=false` |

A session cookie is not a credential here: this endpoint is for MCP clients, not for the dashboard.

**Without browser sign-in** the endpoint takes an API key only. Any other request gets `401` with the message
"This endpoint requires an API key...".

**With browser sign-in** the route decides which path a request takes from what it presents
(`presentsApiKey`, `presentsOAuthBearer` in `lib/mcp/oauth/resource-server.ts`):

| The request presents | Result |
|---|---|
| An API key: a non-empty `x-api-key`, or a bearer in the key format (`sk_live_`, `sk_test_`) | The API key path |
| A bearer that is not in the key format | The OAuth path: the token is verified |
| No credential | The OAuth path: `401` with a `WWW-Authenticate` challenge that tells the client where to sign in |
| An API key **and** a bearer that is not a key | `400`, JSON-RPC error `-32600`: "Present one credential: an API key or an OAuth access token, not both." |

An empty or whitespace-only `x-api-key` (a proxy that always sets the header) does not count as presenting an API
key.

Inside the server both credentials become the same thing: a user, a team and a list of scopes, handed to the
entity handlers, which run the same checks for both. A handler can tell them apart if it has to: the principal of
an OAuth call carries `oauth: { clientId, tokenId }`. See
[API Authentication](./02-authentication.md#oauth-access-token-authentication-apimcp-only) for how an OAuth call
travels to them.

---

## Connecting an MCP Client

The endpoint is `POST /api/mcp`, Streamable HTTP in **stateless JSON mode** (no SSE, no
sessions — one request in, one JSON-RPC response out).

`GET` and `DELETE` on `/api/mcp` return `405` — this server never had a session to resume or
delete.

### With an API key

1. Generate an API key in Settings → API Keys with the scopes you need (e.g. `customers:read`,
   `customers:write`). See [API Authentication](./02-authentication.md) for the scope system.
2. Configure your MCP client (e.g. Claude Desktop's `claude_desktop_config.json`, or a custom
   `mcp remote` connector) to POST to `https://your-app.com/api/mcp` with:
   - `Authorization: Bearer sk_live_...`
   - `x-team-id: <team-id>` (optional — falls back to the user's default team; required if the key's user belongs to more than one team and you want a
     specific one).

An API key is not bound to a team: the team is chosen per request.

### With browser sign-in

1. In the client, add a remote MCP server (a "connector") with the URL `https://your-app.com/api/mcp`. Do not
   configure a key or a header.
2. The client calls the endpoint, gets the `401` challenge, discovers the authorization server and opens the app in
   a browser.
3. The user signs in, chooses a team when they belong to several, and approves the permissions on the consent
   screen.
4. The client receives its tokens and starts calling tools. It renews its access token by itself.

The connection is bound to the team chosen in step 3; `x-team-id` is ignored. To use the same client in two teams,
connect it twice.

---

## Browser Sign-in (experimental)

With `features: { mcpOAuth: true }` the app is the **OAuth 2.1 authorization server of its own MCP endpoint**. This
section is the summary a developer of the MCP surface needs. The complete reference — the model, the multi-tenant
logic, permissions and consent, connected applications, the list of accepted applications and the database rules —
is [MCP Browser Sign-in](../06-authentication/14-mcp-browser-sign-in.md).

**Turning it on:**

```ts
// nextspark.config.ts
export default defineConfig({
  features: { mcpOAuth: true },
})
```

Run the migrations (`048_oauth_provider.sql` adds the tables). `MCP_ENABLED` still has to allow the endpoint, and
`MCP_OAUTH_ENABLED=false` switches browser sign-in off at runtime without a build. Without the build flag the host
has none of the feature's routes.

**What changes on this endpoint:**

- **A second credential.** See [Authentication](#authentication). An API key keeps working on the same endpoint.
- **Discovery.** The `401` of `/api/mcp` carries a `WWW-Authenticate` challenge naming
  `/.well-known/oauth-protected-resource/api/mcp` and the scopes to ask for: `offline_access` plus the scopes
  some tool needs. The same list is what the server publishes as `scopes_supported` and what the consent screen
  offers: an entity kept out of MCP, or an operation an `mcp.ts` excludes, has no permission to grant.
- **One team per connection.** The access token carries the team the user chose. `x-team-id` cannot change it.
- **The user chooses the permissions.** Scopes are the entity scopes an API key uses. The consent screen lists them
  per entity; the server holds the grant to what the user's role can hold.
- **The consent is read on every request.** What a call may do is the token's scopes ∩ the consent's scopes, cut
  down to what the user's role in the team allows at that moment. The user, the membership and the team are read
  again too.
- **Step-up.** A call that needs a scope the connection was not granted is answered `403` with an
  `insufficient_scope` challenge before anything runs. A batch is refused whole. See
  [Scopes a tool needs](#scopes-a-tool-needs).
- **Batches are bounded.** A request with an access token may batch at most 50 JSON-RPC messages
  (`MAX_BATCH_MESSAGES`); a larger batch is `400` with `-32600`. The API key path has no such bound.
- **Access tokens** are JWTs for `/api/mcp` only and live ten minutes; refresh tokens rotate.
- **Which applications may connect** is open by default and can be restricted with
  `mcp.oauth.allowedClientHosts` in `config/app.config.ts`. An unusable list closes the server to every application.
- **Connected applications.** Settings > Security lists the user's connections, with a button to edit the
  permissions of each and one to disconnect it.

Each of these is described in full, with what enforces it, in
[MCP Browser Sign-in](../06-authentication/14-mcp-browser-sign-in.md).

---

## Security Model

- **Kill-switch** — `MCP_ENABLED`. Returns a generic `404` (not `403`) when disabled, so the
  endpoint's existence isn't revealed.
- **Origin validation** — if the request carries an `Origin` header (browser-originated), it
  must match the app's own origin, `NEXT_PUBLIC_APP_URL`, or `BETTER_AUTH_URL` — no CORS
  reflection. Non-browser MCP clients typically send no `Origin` at all and are unaffected.
- **A scoped credential, never a session** — the request must present an API key or, with browser sign-in on, an
  OAuth access token. A valid session cookie alone is rejected. A request that presents both credentials is
  refused instead of one being picked.
- **API key path** — `authenticateRequest` must resolve `type: 'api-key'`. The key's user and the team named by
  `x-team-id` (or the user's default team) are the context of the call.
- **OAuth path** — the token's signature, issuer, audience and expiry are verified in process; then the user, the
  team membership, the list of accepted applications, the revocations and the consent are read from the database on
  every request. The token itself goes no further than this endpoint: tools receive the resolved principal, not a
  credential. See [MCP Browser Sign-in: security model](../06-authentication/14-mcp-browser-sign-in.md#security-model).
- **Scope + team-role permission + ownership/field guards** — enforced by the real generic
  entity handler the in-process executor calls (`handleGenericCreate`, etc.), not by a
  duplicate check in the MCP layer. This means the same `<slug>:read`/`<slug>:write`/
  `<slug>:delete` scopes and the same team-role permission matrix that gate the REST API gate
  MCP tool calls too, for both credentials. The OAuth path adds one check in front: the up-front `403` for a scope
  the connection was never granted.
- **`confirm: true` required on every delete** — the delete tool's schema always includes a
  `confirm` boolean; the handler rejects the call *before* the executor is ever invoked if it
  isn't `true`.
- **Audit trail** — see [Audit Trail](#audit-trail).
- **Rate limiting** — see [Rate Limits](#rate-limits).

---

## Audit Trail

Tool calls are recorded in `api_audit_log` by `lib/mcp/audit.ts`, with the endpoint `mcp:<tool-name>`.

**What is recorded:**

- **Every tool call that reaches its handler**, whether it succeeds or fails: one row, written best effort (see
  the end of this section).
- **A call refused before it ran because an OAuth connection lacks a scope**: one row per refused call, with status
  `403`, `requestBody.refused = 'insufficient_scope'` and `requestBody.missingScopes` (`engine.auditRefused`).
  Nothing ran, and the attempt is still part of the trail.

**What is not recorded:** a call the MCP SDK rejects before the handler runs. The SDK validates the arguments
against the tool's input schema first, so malformed arguments (a wrong type, an unknown parameter) never reach the
handler and leave no row. The same goes for a call to a tool that does not exist.

**The status is the real one:**

| `statusCode` | Meaning |
|---|---|
| `200` | The call succeeded |
| the API's status (`403`, `404`, `409`, ...) | The API answered an error; its HTTP status is kept |
| `400` | An error that never reached the API: arguments the handler's own rules refused (a `delete` without `confirm: true`, `from`/`to` without `dateField`) |
| `500` | The handler threw |

**The row:** `userId`, `apiKeyId`, `statusCode`, `responseTime`, and a `requestBody` with the tool, the entity, the
operation, the record id, the team and the arguments.

- **Credential.** An API key call carries `apiKeyId`. An OAuth call has `apiKeyId` null and carries
  `requestBody.credential = 'oauth'`, `oauthClientId` and `oauthTokenId`.
- **Redaction.** The value of an argument whose key names a secret is replaced by `[redacted]`, at any depth
  (`redactSecrets`, `namesSecret`). The decision is made on the words of the key, so `password`, `clientSecret`,
  `apiKey` and `refresh_token` are redacted while `tokenCount` and `secretaryName` are left alone.
- **Truncation.** Arguments longer than 4000 characters as JSON are stored as a truncated preview.

A generated entity tool also produces the row of the underlying API request (endpoint `/api/v1/...`), written by
the generic entity handler. The two are complementary: the `mcp:` row carries what the agent asked for, the other
what the API answered. A hand-written tool produces one such row per API handler it actually calls: none, one or
several. The audit write is best effort: when the insert fails the failure is logged and the call goes on.

---

## Rate Limits

Two limits apply to `/api/mcp`. The per-address one counts every request; the per-credential one counts every request that presents a valid credential.

| Limit | Counted by | Default | Where |
|---|---|---|---|
| Tier `api` | Client address | 100 requests per minute | `withRateLimitTier(handleMcpPost, 'api')`, before anything is authenticated |
| Tier `credential` | The API key, or the OAuth connection (application and user) | 1000 charges per minute | `credentialRateLimitResponse`, after the credential is verified |

- **The credential limit charges per request, and again per API handler**: one charge for the request and one more for each API handler a tool calls in process. A request with one
  generated entity tool therefore costs two, a hand-written tool one plus the handlers it calls, and a batch pays
  the outer request once and then each handler. This is the same for both credentials.
- **The in-process handlers are not counted per address.** The executor calls the entity handlers directly, without
  the per-route wrapper, so the `api` tier on `/api/mcp` is the only per-address limit on the whole MCP surface.
  Size it with MCP traffic in mind: the users of a hosted client can arrive from a few shared addresses.
- **The credential limit is shared between instances only with Redis.** It is always counted in the process, and
  also in Redis when both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set. Without Redis each process
  counts on its own, which on serverless is close to no limit.
- **`DISABLE_RATE_LIMITING=true` turns off the `api` tier and not the credential limit.**
- Both numbers can be changed in `rateLimit.tiers` of `config/app.config.ts`.
- A request over the credential limit is answered `429` with a JSON-RPC error and a `Retry-After` header. A
  request over the per-address limit is answered `429` with the generic rate limit body of the route wrapper.

See [Rate Limiting](./07-rate-limiting.md) for the tiers, the per-credential limit and Redis.

---

## The `entities/<slug>/mcp.ts` Extension Point

A theme customizes one entity's MCP surface by adding `entities/<slug>/mcp.ts` — a sibling of
`<slug>.config.ts`, `api/presets.ts`, and `migrations/`, **not** nested under `api/`. It's
discovered automatically by the registry build (`scripts/build/registry/discovery/mcp-overrides.mjs`)
and exposed as `MCP_OVERRIDES[slug]` in the generated `mcp-registry.ts` — no manual wiring, no
import list to maintain.

```ts
// entities/tasks/mcp.ts
import { McpToolError, type McpEntityOverride } from '@nextsparkjs/core/lib/mcp'

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
    // Declare meta.requiredScopes on each: see "Scopes a tool needs".
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

An excluded entity or operation also disappears from the scopes a connecting client is told to ask for, so the
consent screen of browser sign-in does not offer a permission that would do nothing.

A real, working example ships in this repo: `apps/dev/entities/tasks/mcp.ts`.

---

## Tool Naming and Descriptions

- `toolPrefix` comes from `MCP_TOOL_PREFIX`, falling back to `app`.
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

These messages were written for API keys and still say "your API key" when the call came from an OAuth
connection. For a connection, read "API key" as "connection".

---

## Known Limitations

- **Browser sign-in is opt-in and experimental** (#541). Without `features: { mcpOAuth: true }` the host has none
  of its routes and the endpoint takes an API key only. Its own limits are listed in
  [MCP Browser Sign-in: known limits](../06-authentication/14-mcp-browser-sign-in.md#known-limits); the ones that
  show on this endpoint are the next three.
- **`tools/list` shows every tool**, including those an OAuth connection was not granted the scope for. The call
  is refused when it is made.
- **A hand-written tool gets the up-front `403` only if it declares `meta.requiredScopes`.** See
  [Scopes a tool needs](#scopes-a-tool-needs).
- **Browser sign-in has been run against Claude** (web, desktop and mobile), and not against ChatGPT's hosted
  client.
- **No production gate.** Nothing refuses to start when Redis is missing or when the database role makes row-level
  security ineffective. See
  [Security Best Practices](../06-authentication/07-security-best-practices.md#mcp-browser-sign-in).
- **The per-credential limit is per process without Redis** — see [Rate Limits](#rate-limits).
- **A call rejected by the SDK's argument validation is not audited** — see [Audit Trail](#audit-trail).
- **`access.api` is a boolean or a per-operation object** — with `api: false` API-key requests to the REST
  API and the MCP server are rejected (REST answers `404 Entity not found`), while session requests from the
  dashboard keep working. With an object (`{ read: true }`) the MCP server registers only the enabled operations
  (`list` and `get` are `read`) and the REST API answers `405` for the rest. Use `excludeOperations` in an
  `entities/<slug>/mcp.ts` override to narrow MCP further than REST (e.g. read-only MCP access to an entity that
  still needs full CRUD via the REST API).

---

## Troubleshooting

### Both credentials

**`404` on every request**
`MCP_ENABLED` is unset or `false` in production, or explicitly `false` in development.

**`403` "Origin not allowed"**
A browser-originated request's `Origin` header didn't match the app's own origin,
`NEXT_PUBLIC_APP_URL`, or `BETTER_AUTH_URL`. Non-browser MCP clients that send no `Origin` are
unaffected.

**`400` "Present one credential: an API key or an OAuth access token, not both."**
The request carries an API key (`x-api-key`, or a bearer starting with `sk_`) and another bearer token. Remove one.
A client configured with a static `x-api-key` header that also signed in through the browser does this.

**`429`**
A JSON-RPC error "Request limit reached..." means the credential is over the `credential` tier; remember that a
generated tool costs two charges, the request and the API handler it calls. A plain JSON body with `"code": "RATE_LIMIT_EXCEEDED"` and "Too many requests"
means the client address is over the `api` tier. Both carry `Retry-After`. See [Rate Limits](#rate-limits).

**"No permission for `<op>` on `<slug>`... needs the `<slug>:<op>` scope... your role in the team does not allow
this action"**
A tool error, not an HTTP error: the API handler refused the call. Either the credential lacks the scope, or the
user's role in the team does not allow the action. For an API key, mint a new key with the required scope — see
[API Authentication](./02-authentication.md). For an OAuth connection this message appears when the scope was
granted and the user's role no longer allows it; a scope that was never granted produces the `403` below instead.

**A tool call left no row in `api_audit_log`**
Either the call did not reach a tool handler (the MCP SDK rejected its arguments first), or the audit write
failed: it is best effort, and a failed insert is logged as `[mcp:audit] failed to write api_audit_log entry`
without stopping the call. See [Audit Trail](#audit-trail).

### API key

**`401` "This endpoint requires an API key"**
Browser sign-in is not on, and the request used a session cookie, an invalid key, or no credential at all. Send
`Authorization: Bearer sk_...` or `x-api-key`.

**The client tries to sign in through the browser and fails with that same `401`**
The client expected an OAuth challenge and the server has none to give: the project was not built with
`features: { mcpOAuth: true }`, or `MCP_OAUTH_ENABLED=false` is set. Check that
`/.well-known/oauth-protected-resource/api/mcp` answers; a `404` there confirms it. After turning the flag on, run
`nextspark prepare` and rebuild.

**"The API key user is not a member of the team specified in x-team-id" / "Could not resolve the user team"**
The `x-team-id` header names a team the key's user does not belong to, or there is no header and the user has no
default team.

### Browser sign-in

**`401` with a `WWW-Authenticate` challenge, when you sent an API key**
With browser sign-in on, a request that does not present an API key is an OAuth request. The key was not
recognised as one: a bearer that does not start with `sk_live_` or `sk_test_`, or an empty `x-api-key` header. For
a request with no credential at all this `401` is the expected first step of sign-in, not an error.

**`403` with `WWW-Authenticate: Bearer error="insufficient_scope"` — "This connection was not granted: ..."**
JSON-RPC error `-32003`. The call needs a scope the user did not approve. Nothing ran. The `scope` of the challenge
is what the connection has plus what is missing: a client that supports step-up sends the user to the consent
screen with it. Otherwise the user disconnects and connects again, ticking the permission. If the permission is
shown disabled on the consent screen, the user's role in that team cannot hold it.

**`401` "This connection was ended. Connect again." / "This connection was revoked. Connect again."**
The connection has no consent any more, or a revocation was recorded after the token was issued. It was
disconnected in Settings > Security (by the user or by a member who manages the team's integrations), or the user's
password changed, or the account was suspended, or a replaced refresh token was presented again. The user connects
the application again from the application.

**`403` "This application is not among the ones this server accepts."**
`mcp.oauth.allowedClientHosts` is set and the application's client id is not an `https` URL on one of the listed
hosts. During sign-in the same refusal appears as `access_denied` at the authorization endpoint or `invalid_client`
at the token endpoint. If **no** application can connect, look in the server log for
`[mcp:oauth] mcp.oauth.allowedClientHosts has entries that name no host`: a list with no usable entry closes the
server to all of them.

**Sign-in stops with `access_denied`: "choose the team this connection is for"**
No team was chosen for the authorization. The user belongs to no team, or the choice expired (it is kept for 15
minutes), or the authorization was continued in another browser session. Start again from the application.

**`409 TEAM_ALREADY_CHOSEN` on the team picker**
A team was already chosen for this authorization and a different one was submitted. The first choice stands; start
again from the application to choose another.

**`403` "The access token is not bound to a team. Connect again."**
The token carries no `team_id` claim. Connect again.

**`403` "The account is no longer a member of the team this connection was approved for."**
The user was removed from the team, or the team was deleted. The connection cannot be used; disconnect it and
connect to another team.

**`401` "The account of this access token is not active."**
The account was suspended or deleted.

**`400` "Invalid Request: a batch holds at most 50 messages"**
A request with an access token batches at most 50 JSON-RPC messages. Split the batch.

**The consent screen does not appear when the application is connected again**
Everything the application asked for was already consented, so Better Auth skips the screen. Use Settings >
Security > Connected applications to review or reduce what it holds.

**Next Steps:**
- [MCP Browser Sign-in](../06-authentication/14-mcp-browser-sign-in.md) — the complete reference of browser sign-in
- [API Authentication](./02-authentication.md) — scopes, API keys, and where each credential is accepted
- [Rate Limiting](./07-rate-limiting.md) — tiers, the per-credential limit and Redis
- [Error Handling](./08-error-handling.md) — the underlying REST error codes MCP translates

**Documentation:** `core/docs/05-api/20-mcp-server.md`
