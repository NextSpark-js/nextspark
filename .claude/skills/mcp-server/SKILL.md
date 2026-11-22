---
name: mcp-server
description: |
  The app's own MCP server (`/api/mcp`): tools generated from the entity registry, the two credentials
  it accepts (API key, OAuth access token) and MCP browser sign-in (OAuth 2.1 with Better Auth as the
  authorization server): one team per connection, per-entity consent bound to the role, connected
  applications, the allow-list of applications, the rules migration 048 keeps in the database, audit
  and rate limit.
  Use this skill when changing anything under `lib/mcp/`, the `/api/mcp` route, an `entities/<slug>/mcp.ts`
  override, the OAuth consent or team pages, `/api/internal/oauth-*`, or the OAuth tables and triggers.
  For building an MCP server for another service see anthropics-mcp-builder.
allowed-tools: Read, Glob, Grep, Bash
version: 1.0.0
---

# MCP Server Skill

The MCP endpoint every NextSpark app serves, and the browser sign-in that lets an application such as Claude
connect to it without an API key.

**Canonical user-facing reference:** `packages/core/docs/05-api/20-mcp-server.md`. This skill is the companion
for an agent about to change the code: where each rule lives and what breaks when it is moved.

All paths below are relative to `packages/core/` unless they start with another top-level directory.

## Architecture Overview

```
src/routes/api/mcp/route.ts            # POST /api/mcp: picks the credential path, builds the engine
src/lib/mcp/
├── engine.ts                          # createMcpEngine: tools from the registry, handleJsonRpc,
│                                      #   requiredScopesFor, toolScopes, auditRefused
├── tool-generator.ts                  # the five tools of an entity, tool names, withData
├── schema-builder.ts                  # tool input schemas from the entity's fields
├── executor.ts                        # runs a tool by calling the generic entity handler in process
├── audit.ts                           # api_audit_log rows (mcp:<tool>), redactSecrets
├── errors.ts, transport.ts, types.ts
└── oauth/                             # MCP browser sign-in (#541)
    ├── config.ts                      # isMcpEnabled, isMcpOAuthBuilt, isMcpOAuthEnabled, URLs, claims
    ├── plugins.ts                     # mcpOAuthPlugins(): jwt(), mcp(), cimd(), consentWithinRolePlugin()
    ├── consent-plugin.ts              # server-side bound of a consent; refusals
    ├── resource-server.ts             # handleOAuthMcpRequest: token -> principal, insufficient_scope
    ├── team-selection.ts              # the team of an authorization
    ├── scopes.ts, scope-names.ts      # what a client is told to ask for; entityScope, isPreselectedScope
    ├── allowed-clients.ts             # mcp.oauth.allowedClientHosts
    ├── connection-store.ts            # connections in the database: list, disconnect, narrow
    ├── connections.ts                 # who may manage other members' connections
    ├── revocation.ts                  # the `rev` claim against oauthRevocation
    ├── purge.ts                       # housekeeping of expired rows
    ├── discovery.ts                   # the .well-known documents
    └── sign-in-continuation.ts        # going on with an authorization after sign-in

src/lib/api/auth/in-process-principal.ts   # the verified principal attached to in-process requests
src/routes/(auth)/oauth/{select-team,consent}/   # team picker and consent pages
src/routes/.well-known/oauth-{protected-resource,authorization-server}/
src/routes/api/internal/oauth-team/route.ts
src/routes/api/internal/oauth-connections/route.ts
src/components/auth/OAuthConsent.tsx
src/components/settings/ConnectedApps.tsx
migrations/048_oauth_provider.sql      # tables, RLS, triggers
```

## When to Use This Skill

- Changing how tools are generated, named, described or audited
- Writing or reviewing an `entities/<slug>/mcp.ts` override or a hand-written tool
- Touching the OAuth flow: plugins, consent, team picker, resource server, allow-list
- Adding any code path that writes or deletes a consent, a refresh token or a revocation
- Debugging a 401 / 403 / 429 from `/api/mcp`
- Changing migration 048's tables or triggers (see the checklist first)

## The endpoint: `/api/mcp`

- Streamable HTTP, stateless JSON. `POST` only; `GET` and `DELETE` answer 405.
- Kill switch `MCP_ENABLED` (`isMcpEnabled`): in development on unless `'false'`; in production off unless
  `'true'`. Off is a 404.
- An `Origin` header, when present, must be the app's own (`NEXT_PUBLIC_APP_URL`, `BETTER_AUTH_URL` or the
  request's origin): otherwise 403.
- Wrapped in `withRateLimitTier(..., 'api')` (per address); the per-credential limit is on top (see Rate limit).

### How tools are generated

`createMcpEngine(registry, options)` in `src/lib/mcp/engine.ts` builds the tool set once, when the route module
loads. The engine never imports theme files: overrides arrive through `options.overrides`, which the route
fills from the generated `MCP_OVERRIDES` registry (`@nextsparkjs/registries/mcp-registry`).

- Every entity that is `enabled` and has `access.api` gets `list`, `get`, `create`, `update`, `delete`. When
  `access.api` is an object, only the operations it enables (`isApiOperationEnabled`; `list` and `get` are reads).
- `patterns` is excluded by default (`DEFAULT_EXCLUDED_SLUGS`; `options.excludeSlugs` replaces the list).
- `entities/<slug>/mcp.ts` (default export of type `McpEntityOverride`, a sibling of `<slug>.config.ts`, not
  under `api/`) is discovered by `scripts/build/registry/discovery/mcp-overrides.mjs`. It can: `exclude` the
  entity, `excludeOperations`, `relaxRequired`, `describe`, add `errorHints`, `transformInput`,
  `transformOutput`, and add `extraTools`. Working example: `apps/dev/entities/tasks/mcp.ts`.
- Tool names: `{prefix}_list_{plural}`, `{prefix}_{get|create|update|delete}_{singular}`. The prefix is
  `MCP_TOOL_PREFIX` (default `app`). The plural comes from the entity **slug**, the singular from
  `names.singular`, both through `toolToken`. A duplicate name throws at startup (`assertUniqueNames`).
- A tool runs by calling the real generic entity handler in process (`executeEntityOperation`), with
  `x-team-id` set to the resolved team. Scopes, team-role permissions, ownership and field guards are the
  handler's: there is no second authorization layer to keep in step.
- Entity tools return their data twice (`withData` in `tool-generator.ts`): as `structuredContent`, and as the
  same JSON in a second text block after the summary. Clients such as Claude read only the text; without the
  second block a list answered "15 Tasks" and nothing else. This applies to both credentials.

### Scopes a tool call needs

`engine.requiredScopesFor(toolName)`:

| Tool | Scopes |
|------|--------|
| generated `list` / `get` | `<entity>:read` |
| generated `create` / `update` | `<entity>:write` |
| generated `delete` | `<entity>:delete` |
| hand-written (`extraTools`, `utilityTools`) | what it declares in `meta.requiredScopes`; none if it declares nothing |

`engine.toolScopes` is the sorted union over all tools. Both feed the OAuth path: the up-front 403 and what a
connecting client is told to ask for.

## Two credentials, never mixed

| | API key | OAuth access token |
|---|---------|--------------------|
| Presented as | `Authorization: Bearer sk_live_...` / `sk_test_...`, or `x-api-key` | `Authorization: Bearer <JWT>` |
| Available | always | only when `isMcpOAuthEnabled()` |
| Team | `x-team-id` header or the user's default team (`resolveTeamContext`) | the token's `team_id` claim; `x-team-id` cannot change it |
| Lifetime | does not expire by default | 10 minutes, renewed with a rotating refresh token |
| Handled by | `authenticateRequest(request, { allowAnyScope: true })` in the route | `handleOAuthMcpRequest` in `oauth/resource-server.ts` |

- `presentsApiKey` / `presentsOAuthBearer` decide. A request that presents both is refused:
  `400`, JSON-RPC `-32600`. An empty or whitespace `x-api-key` is not a credential.
- With browser sign-in on, a request with no API key is an OAuth request: with no token it gets the `401`
  with the `WWW-Authenticate` challenge that tells the client where to sign in.
- With browser sign-in off, a request without a valid API key gets `401` `-32001`.
- Session cookies are not a credential for this endpoint.
- The access token goes no further than the resource server. Tools receive a principal, and the executor
  attaches it to the request it builds (`attachInProcessPrincipal`, a `WeakMap<Request, DualAuthResult>`);
  `authenticateRequest` reads it back (`inProcessPrincipal`). Nothing sent over HTTP can set it.
- That principal has `type: 'api-key'` plus `oauth: { clientId, tokenId }` (`DualAuthResult` in
  `src/lib/api/auth/dual-auth.ts`). A route that branches on `type === 'api-key'` treats an OAuth connection
  as a key. It is a bridge, not the final model: do not read `keyId` for such a principal (there is no
  `api_key` row), check `oauth` when the difference matters.

## Turning on browser sign-in

1. `features: { mcpOAuth: true }` in `nextspark.config.ts` (opt-in, default `false`). `nextspark prepare` then
   generates the routes. Without it the host has none of them, no plugin is registered, and `/api/mcp` takes
   an API key only.
2. Apply migration `migrations/048_oauth_provider.sql`.
3. `MCP_ENABLED` must allow the endpoint. `MCP_OAUTH_ENABLED=false` switches browser sign-in off at runtime
   without a build.

`isMcpOAuthBuilt()` (the build flag, client-safe) and `isMcpOAuthEnabled()` (build flag, env and `MCP_ENABLED`)
are in `src/lib/mcp/oauth/config.ts`. Use the second for anything that serves a request.

### Routes the host serves when it is on

| URL | What |
|-----|------|
| `/.well-known/oauth-protected-resource/api/mcp` | Resource metadata (RFC 9728) |
| `/.well-known/oauth-authorization-server/api/auth`, `/api/auth/.well-known/openid-configuration` | Authorization server metadata (RFC 8414) |
| `/api/auth/oauth2/authorize`, `/token`, `/revoke`, `/userinfo`, `/consent`, `/continue` | Better Auth's OAuth endpoints |
| `/api/auth/jwks` | Signing keys (public half) |
| `/oauth/select-team`, `/oauth/consent` | Team picker and consent pages |
| `/api/internal/oauth-team` | GET: teams, `selected`, `allowed`, `granted`. POST: choose the team. Session only |
| `/api/internal/oauth-connections` | GET list, PATCH narrow, DELETE disconnect. Session only |

`src/routes/manifest.json` lists the routes; `OPT_IN_CORE_ROUTES.mcpOAuth` in
`scripts/build/registry/host/features.mjs` leaves them out unless the feature is `true`. A route added to the
feature needs both. `oauth` and `.well-known` are reserved slugs (`src/lib/constants/reserved-slugs.ts`).
Built with the feature and switched off at runtime, the two pages are rewritten to a 404 by `src/proxy/index.ts`
and every route handler answers 404 itself (`if (!isMcpOAuthEnabled()) return notFound()`).

## The model

- **Plugins** (`mcpOAuthPlugins()` in `oauth/plugins.ts`, spread into `lib/auth.ts`; returns `[]` while the
  feature is off): Better Auth `jwt()` signs the access tokens (EdDSA keys in table `jwks`), `mcp()` from
  `@better-auth/mcp` is the OAuth provider bound to the MCP resource, `cimd()` from `@better-auth/cimd` accepts
  Client ID Metadata Documents, and the project's own `consentWithinRolePlugin()`.
- **Clients** identify themselves with a Client ID Metadata Document (an https URL as client id), as Claude and
  ChatGPT do. Unauthenticated dynamic client registration is closed. A client set to skip consent
  (`skipConsent`) is refused (`refuseConsentSkippingClient`): the consent is where the user chooses and the row
  every refresh token is held to.
- **Grants**: authorization code with PKCE (S256), and refresh token. No client credentials.
- **Access tokens** are JWTs for the resource `/api/mcp`, valid 10 minutes (`accessTokenExpiresIn: 600`).
  **Refresh tokens rotate.**
- **Resource vs issuer**: the resource is a URL of the app (`mcpResourceUrl()`: `NEXT_PUBLIC_APP_URL` +
  `/api/mcp`); the issuer is where Better Auth is served (`mcpOAuthIssuer()`: `BETTER_AUTH_URL`, with its own
  path when it has one, otherwise the origin + `/api/auth`). They may be different origins. Everything goes
  through `withBasePath`, so it works under a Next.js `basePath`. Never build these URLs by hand.
- **Signing keys rotate** every 30 days (`SIGNING_KEY_ROTATION_SECONDS`); the replaced key stays published for
  Better Auth's 30-day grace period. A key created before rotation was configured has no expiry and does not
  rotate by itself.

## Multi-tenant: one team per connection

- A connection is a client acting for a user in **one team**: `(userId, clientId, teamId)`. The team is the
  consent's `referenceId` and the access token's `team_id` claim (`TEAM_CLAIM`).
- A user in one team gets that team. A user in several picks one on `/oauth/select-team`
  (`oauth/team-selection.ts`, table `oauthTeamSelection`). The choice is stored per browser session and per
  authorization request (its PKCE challenge, `isAuthorizationKey`), is written once (`409 TEAM_ALREADY_CHOSEN`
  for a different second choice) and is checked against the user's memberships when written and when read.
- To use two teams the application is connected twice.
- On every request `principalFromClaims` re-reads the user, the team and the membership: a suspended account,
  a user removed from the team or a deleted team is refused on the next call, not when the token expires.

## Permissions

- Scopes are the entity scopes API keys use: `<entity>:read|write|delete` (`mcpOAuthResourceScopes()`; wildcards
  are never offered). `offline_access` and the identity scopes (`OIDC_SCOPES`) are not permissions.
- **What the challenge asks for**: the 401 tells a connecting client to request `offline_access` plus every
  scope some tool of this server uses: `mcpOAuthDefaultScopes(engine.toolScopes)`. Without `offline_access`
  there is no refresh token and the connection ends with its first access token. A scope no tool needs is not
  asked for, so the consent screen offers nothing that would do nothing.
- **The user chooses** on the consent screen (`OAuthConsent.tsx`): one row per entity with read, write,
  delete. First connection: read and write ticked, delete not (`isPreselectedScope`). A permission the role
  cannot hold is shown disabled (`allowed` from `/api/internal/oauth-team`). An application already connected
  to that team comes with exactly what it holds ticked (`granted`).
- **The server holds the grant to the role** whatever the browser sends: `consentWithinRolePlugin` rewrites
  the scopes of `/oauth2/consent` and `/oauth2/update-consent` to requested ∩ accepted ∩ what the role can
  hold in that team (`consentedScopes`, `validateScopesForUser`).
- **The consent is the authority and it is read on every request** (`principalFromClaims`): effective scopes =
  token scopes ∩ consent scopes, then cut down to what the user's role in the team allows now. A connection
  with no consent row is refused (401), whatever its token says.
- **`insufficient_scope` and step-up**: a call that needs a scope the connection was not granted is answered
  `403` before anything runs, with `WWW-Authenticate: Bearer error="insufficient_scope", scope="..."` naming
  what it has plus what is missing (`mcpOAuthStepUpScopes`), so authorizing again with that list loses
  nothing. A batch is refused whole. A scope that was granted and the role no longer allows is refused by the
  tool instead: asking again would not help.

## Ending and narrowing a connection

- **Settings > Security > Connected applications** (`ConnectedApps.tsx`, rendered only when
  `isMcpOAuthBuilt()`): application, host, team, permissions per entity, dates; "Edit permissions" and
  "Disconnect". A connection is listed while it has a live refresh token.
- **Edit permissions only takes permissions away** (`narrowConnection`, `PATCH /api/internal/oauth-connections`):
  the application stays connected with what is left, and what it had been issued is refused at once. Keeping
  nothing is `400 NO_PERMISSION_LEFT`: that is disconnecting. More is asked for by the application, on the
  consent screen.
- **Disconnect** (`disconnect`, `DELETE /api/internal/oauth-connections`) ends it at once. The refresh tokens
  are deleted, not marked revoked: Better Auth takes a revoked refresh token presented again for a stolen one
  and ends every connection of that client for the user, in every team.
- **Other members' connections** are managed with the team permission `settings.integrations`
  (`MANAGE_CONNECTIONS` in `oauth/connections.ts`): owner and admin by default, decided by
  `hasTeamPermission`, so a project's own roles and `teams.appRoleBypass` count. Such a member sees
  (`managedConnections`, the `managed` field of the GET) and can end (`disconnectManaged`, `userId` in the
  DELETE body), not edit, the other members' connections to that team. The actor's team role and app role
  are read and locked (`FOR SHARE`) in the transaction that ends the connection (`disconnectAs`).
- **Also ending connections**: a changed password and a suspended account (every connection of the user;
  every application asks for consent again), a refresh token presented again after it was replaced, the
  client revoking its token (`/oauth2/revoke`), and Better Auth's own `/oauth2/delete-consent`.
- Signing out of the browser does not disconnect an application.

## Which applications may connect

By default any application with a valid metadata document can start a sign-in; the consent screen names it and
its host. A project can list the hosts it accepts in `config/app.config.ts`:

```typescript
mcp: { oauth: { allowedClientHosts: ['claude.ai', 'chatgpt.com'] } }  // '*.example.com' accepts subdomains
```

Rule (`oauth/allowed-clients.ts`, `isClientAllowed`): with a list, an application is accepted only when its
client id is an https URL, with no credentials in it, on one of the hosts.

**Fail-closed.** Only an absent (`undefined`) or empty list is open. Anything else that names no usable host,
`null` included, closes the server to every application and logs the unusable entries once
(`allowedClientHosts()` in `config.ts`). `['https//claude.ai']` must never mean "anyone".

The list applies in four places; a change must keep all four:

1. Before the metadata document is fetched (`isMetadataDocumentUrlAllowed` of `cimd()`).
2. When the application asks for authorization (`refuseUnlistedClient` in `consentReferenceId`).
3. At `/oauth2/token` and `/oauth2/userinfo` (`isRequestAllowed` in `consentWithinRolePlugin`): the request
   must name a client, and every client it names (body `client_id`, a client assertion, HTTP Basic, the `azp`
   of a token) must be accepted. With a list, `/oauth2/userinfo` therefore answers only to JWT access tokens:
   an opaque token does not say whose it is.
4. On every request to `/api/mcp` (`principalFromClaims`), so a token issued before the list changed counts
   no more.

## Rules that live in the database (migration 048)

Better Auth changes these rows from several endpoints (`/oauth2/consent`, `/oauth2/update-consent`,
`/oauth2/delete-consent`, `/oauth2/revoke`, `/oauth2/token`) and renews a token in separate statements (it
reads the old one, marks it replaced, writes the new one). A rule kept in application code would hold for the
paths core wrote and for none of Better Auth's. So the rules are triggers:

| Trigger | Rule |
|---------|------|
| `oauth_refresh_token_requires_consent` (BEFORE INSERT on `oauthRefreshToken`) | A refresh token with a team is written only while the connection's consent exists (it takes `FOR SHARE` on the consent row; otherwise `oauth connection ended`), and holding no more than the consent (cut down with `oauth_scopes_within`, not refused) |
| `oauth_consent_narrowed` (AFTER UPDATE OF scopes on `oauthConsent`) | A consent that loses a scope records a revocation and cuts the connection's live refresh tokens down to it |
| `oauth_consent_removed` (AFTER DELETE on `oauthConsent`) | Removing a consent records a revocation and removes the connection's refresh tokens, so nothing comes back with the next consent |
| `oauth_refresh_token_revoked`, `oauth_refresh_token_deleted` | A live refresh token revoked or deleted records a revocation of that connection. A rotation is not one |
| `oauth_revoke_on_password_change` (on `account`), `oauth_revoke_on_suspension` (on `users`) | End every connection of the user |

- **The share lock is what orders a renewal against a disconnection or a narrowing.** The new token either is
  written first (and removed or cut down with the rest), or waits and then finds no consent (refused) or a
  smaller one (cut down). Code that ends or narrows a connection must touch the consent row first, in one
  transaction (`withServiceTransaction`; `narrowConnection` takes it `FOR UPDATE`).
- **Revocation** (`oauth/revocation.ts`, table `oauthRevocation`): an access token carries in its `rev` claim
  (`REVOCATION_CLAIM`) the number of the user's newest revocation when it was issued (`latestRevocation`), and
  is refused once a newer row covers its client and team, or all of the user's connections
  (`isRevokedSince`). No clock is compared, so it holds across instances. A missing or malformed `rev` is
  refused.
- **Unique index** `uq_oauth_consent_connection` on `oauthConsent("userId", "clientId", "referenceId")`: one
  consent per connection.
- **RLS**: every OAuth table is service-only (`can_bypass_rls()`), `jwks` included. All code that reads them
  uses the service connection (`query`, `queryOne`, `queryRows`), never `queryWithRLS` with a user id.
- **Single migration file.** Everything is in `048_oauth_provider.sql`, written to be applied again without
  effect (`CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `DROP TRIGGER IF EXISTS`). Until the
  branch is published a change goes in that file; once published, in a new migration.

## Housekeeping

`oauth/purge.ts`: `purgeExpiredOAuthIfDue()` runs where tokens are issued (`customAccessTokenClaims`), at most
once an hour per process, and never fails the token. It removes, a day after expiry and at most `PURGE_BATCH`
(2000) rows of each kind per run with `FOR UPDATE SKIP LOCKED`: access token rows, refresh tokens (by their own
expiry only: a replaced token is kept until then, the authorization server needs it to recognise reuse),
client assertions, team selections, old revocations (a user's newest stays: it is the number the next token
carries), and signing keys 31 days after they expired. There is no job to set up and it is not a scheduled
action. A project that wants its own schedule calls `purgeExpiredOAuth()`.

## Audit

`src/lib/mcp/audit.ts`, table `api_audit_log`, endpoint `mcp:<tool>`:

- Every tool call that reaches its handler is a `mcp:<tool>` row. `statusCode` is `200`; the HTTP status the
  API answered for an error (403, 404, 409...); `400` for an error that never reached the API (a rule the
  handler checks, such as an update with no fields); `500` for a handler that threw.
- A generated entity tool also leaves the row of the generic handler it calls (`/api/v1/...`): what the agent
  asked for, and what the API answered. A hand-written tool leaves one such row per API handler it actually
  calls: none, one or several.
- **Known gaps:** a call the SDK rejects before the handler (wrong shape or type, an unknown parameter or tool)
  leaves no row, and the audit write is best effort: a failed insert is logged and the call goes on.
- A call refused before running because the connection lacks a scope is recorded too (`engine.auditRefused`):
  status `403`, `requestBody.refused = 'insufficient_scope'`, `requestBody.missingScopes`.
- An OAuth call has `apiKeyId` null and `requestBody.credential = 'oauth'`, `oauthClientId`, `oauthTokenId`.
- Argument values whose key names a secret are replaced by `[redacted]` at any depth (`redactSecrets`,
  `namesSecret`: by the words of the key, so `tokenCount` and `secretaryName` are left alone). Arguments over
  4000 characters are truncated.

## Rate limit

- The route's own tier is `api`, per address.
- On top, the per-credential limit `credentialRateLimitResponse` (tier `credential`, 1000 a minute): for an
  API key by its key id, for an OAuth connection by `oauthRateLimitKey` (`oauth:<clientId>:<userId>`).
- A tool call counts twice: the MCP request, and the API handler it calls in process. Same with an API key.
- On the OAuth path a request batches at most 50 JSON-RPC messages (`MAX_BATCH_MESSAGES`); a larger batch is
  `400 -32600`.

Details (Redis, fail-open, `DISABLE_RATE_LIMITING`): see the `rate-limiting` skill.

## When you change this code

- **Any new path that writes or deletes a consent or a refresh token** (a new endpoint, a new Better Auth
  plugin or version, an admin tool, a cleanup) must be checked against the triggers: what records the
  revocation, what removes or cuts down the tokens, and which lock orders it against a renewal in flight.
- **End a connection by removing its consent, first, in one transaction.** Delete refresh tokens; do not mark
  them revoked.
- **Never add scopes outside the consent screen.** `narrowConnection` only removes. A path that widens a
  consent must go through `/oauth2/consent` so `consentWithinRolePlugin` bounds it.
- **Never trust the consent page.** What it sends is a suggestion; the bound is on the server
  (`consentWithinRolePlugin`) and again on every request (`principalFromClaims`).
- **A hand-written tool declares `meta.requiredScopes`** with every scope its calls need. Without it the tool
  gets no up-front `insufficient_scope`: each call is checked where it is made, and a tool can fail half done.
- **A hand-written tool calls `api.execute` and `api.entitySchemas`**, the engine's wired versions, never the
  handlers directly: output normalization and `transformOutput` would be skipped.
- **A new route of the feature** is added to `src/routes/manifest.json` and to `OPT_IN_CORE_ROUTES.mcpOAuth`,
  and answers 404 while `isMcpOAuthEnabled()` is false.
- **A new check of the allow-list** uses `isClientAllowed(clientId, allowedClientHosts())`. Do not read the
  config yourself: the fail-closed reading is in `readAllowList`.
- **Keep `connection-store.ts` free of project-config imports** (`@nextsparkjs/registries/*`, `config-client`):
  the PostgreSQL integration test loads it against a bare database. Who-may-do-it logic that needs the
  permission registry goes in `connections.ts`.
- **Anything involving two statements or two connections** (a race, a lock, a trigger) gets a case in
  `tests/node/oauth-connections-pg.test.ts`. A Jest test with mocked queries proves nothing about it.
- **A Better Auth upgrade**: re-read the column list at the top of migration 048 against the new version's
  schema, and run both node suites below.

## How to test

```bash
# Jest (queries mocked): from packages/core
pnpm test -- tests/jest/lib/mcp
pnpm test -- tests/jest/api/oauth-connections-route.test.ts tests/jest/components/auth/OAuthConsent.test.tsx
pnpm test -- tests/jest/lib/api/credential-rate-limit.test.ts tests/jest/lib/api/in-process-principal.test.ts

# PostgreSQL integration (real triggers and locks): from packages/core
npx tsx --test tests/node/oauth-connections-pg.test.ts
npx tsx --test tests/node/mcp-oauth-sign-in.test.ts
pnpm test:node          # every node test
```

- **Jest suites**: `tests/jest/lib/mcp/**` (engine, audit, tool generator, executor, and `oauth/`:
  allowed-clients, config, connections, consent-plugin, credentials, purge, revocation, scopes,
  sign-in-continuation, team-selection), plus the route, consent screen, rate limit and principal suites
  above. The Better Auth OAuth packages are mocked (`tests/jest/__mocks__/better-auth-oauth.js`).
- **`tests/node/oauth-connections-pg.test.ts`** (18 cases) starts a throwaway cluster
  (`tests/node/_pg-cutover.ts`, `scripts/test/throwaway-postgres.cjs`), applies every core migration from
  nothing, and loads the real `connection-store.ts` and `purge.ts` against it. It needs `initdb`, `pg_ctl`
  and `postgres` on the PATH (`HAS_POSTGRES`) and is skipped otherwise: a skipped run is not a pass. It uses
  two clients and a `stillWaiting` helper to prove lock ordering (which statement waits for which).
- **`tests/node/mcp-oauth-sign-in.test.ts`** runs real Better Auth and the real auth route in a child process
  against a throwaway cluster: an authorization goes on after password, Google and magic-link sign-in.
- **End to end** there is no automated suite in the repo. A pass against a running host goes: `POST /api/mcp`
  with no credential (401 and its challenge) -> the two discovery documents -> authorize with PKCE -> login ->
  team picker -> consent -> token -> `tools/list` and a `tools/call` -> a call outside the granted scopes
  (403 `insufficient_scope`) -> refresh -> disconnect and confirm the next call is refused. From Claude Code:
  `claude mcp add --transport http <name> <app-url>/api/mcp`, then `/mcp` to sign in. Better Auth's own
  limiter answers 429 to a bulk run of authorizations from one address.

## Known limits

- No production gate: the feature does not refuse to start when the database connection owns the tables (RLS
  without effect) or when there is no Redis (the per-credential limit is then per process).
- Run against Claude (web, desktop, mobile). Not run against ChatGPT's hosted client.
- Removing a team does not end its connections: the resource server refuses them, the rows stay.
- Hand-written tools get the up-front 403 only if they declare `meta.requiredScopes`.
- `tools/list` shows every tool, including those the connection cannot use.
- If everything a client asks for is already consented, Better Auth shows no consent screen on reconnect.
- An API key is not bound to a team and does not expire by default; an OAuth connection is bound to one team
  and its token lives 10 minutes. The two models are not reconciled.
- A call the SDK rejects before the handler runs (arguments that fail the input schema) is not audited.

## Anti-Patterns

```typescript
// NEVER: forward the access token to another route or to a handler
headers.authorization = request.headers.get('authorization')  // issued for /api/mcp only

// CORRECT: the executor attaches the verified principal to the request it builds
attachInProcessPrincipal(request, ctx.principal)

// NEVER: take the team of an OAuth call from a header
const teamId = request.headers.get('x-team-id')

// CORRECT: the team is the token's claim, already in the context
const teamId = ctx.teamId

// NEVER: decide who manages connections by role name
if (role === 'owner' || role === 'admin') { /* ... */ }

// CORRECT: the team permission, so extended roles and teams.appRoleBypass count
hasTeamPermission(appRole, teamRole, MANAGE_CONNECTIONS)

// NEVER: trust the scopes a token carries
const scopes = String(claims.scope).split(' ')

// CORRECT: token ∩ consent ∩ what the role allows now (principalFromClaims)

// NEVER: treat a list that names no usable host as "no list"
if (!hosts.length) return true

// CORRECT: only undefined or [] is open (readAllowList)
```

```sql
-- NEVER: end a connection by revoking its tokens and leaving the consent
UPDATE "oauthRefreshToken" SET revoked = now() WHERE ...;

-- CORRECT: remove the consent; the trigger records the revocation and removes the tokens
DELETE FROM "oauthConsent" WHERE "userId" = $1 AND "clientId" = $2 AND "referenceId" = $3;
```

## Checklist

- [ ] Both credential paths still work, and a request with both is still refused
- [ ] New feature route: in `manifest.json`, in `OPT_IN_CORE_ROUTES.mcpOAuth`, 404 while the feature is off
- [ ] Session-only routes use `getAuthorizationSession`, never `authenticateRequest`
- [ ] Hand-written tool declares `meta.requiredScopes` and uses `api.execute`
- [ ] Consent scopes are bound on the server, not only in `OAuthConsent.tsx`
- [ ] A write or delete of a consent or a refresh token was checked against the triggers of migration 048
- [ ] Multi-statement work on OAuth tables runs inside `withServiceTransaction`, consent row first
- [ ] OAuth tables are read on the service connection
- [ ] The allow-list is still applied in its four places
- [ ] `connection-store.ts` imports no project configuration
- [ ] New race, lock or trigger has a case in `tests/node/oauth-connections-pg.test.ts`, run where
      `HAS_POSTGRES` is true
- [ ] Nothing listed under "Known limits" is described as done in docs or messages

## Related Skills

- `better-auth` - Better Auth configuration, plugins, the principal of a request
- `rate-limiting` - the `credential` tier and the shared count
- `permissions-system` - `settings.integrations`, `hasTeamPermission`, role scopes
- `database-migrations` - invariants as triggers, idempotent migrations
- `rls-enforcement` - service-only tables, `withServiceTransaction`
- `jest-unit` - when a mocked-query test is not enough; `tests/node/*-pg.test.ts`
- `nextjs-api-development` - session-only internal routes, feature-gated routes
- `entity-api` - the handlers every tool runs through
- `entity-system` - `access.api`, which decides what becomes a tool
- `anthropics-mcp-builder` - building an MCP server for another service
