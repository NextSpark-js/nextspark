# Better Auth 1.7.27, migration 049 and MCP browser sign-in

> **Unreleased.** These changes are in core after `0.1.0-beta.205` (issue [#541](https://github.com/NextSpark-js/nextspark/issues/541)) and have no release number yet. "The release that carries them" below is the first release after `0.1.0-beta.205`. When it is published, its changelog entry is the authoritative list.

One change set brings four things: a newer Better Auth, a core migration, an opt-in feature and a rate limit tier. A
project that does not turn the feature on has two things to do: move two dependencies and run the migration.

## What changes

| Area | Before (`0.1.0-beta.205`) | After |
| --- | --- | --- |
| `better-auth` | `~1.7.7` | `~1.7.27` |
| `@better-fetch/fetch` | `1.3.2` | `1.3.3`, the exact version Better Auth 1.7.27 pins |
| Core's own dependencies | | `@better-auth/oauth-provider`, `@better-auth/mcp`, `@better-auth/cimd` and `@better-auth/core`, all `~1.7.27`. They come with `@nextsparkjs/core`: a project does not declare them |
| Migrations | Up to `048` | `049_oauth_provider.sql`: ten service-only tables, nine triggers and ten functions for the OAuth authorization server. Three of the triggers are on existing tables (`account`, `users`, `team_members`). No existing table is altered |
| MCP endpoint (`/api/mcp`) | API key only | API key, and, only when the project turns it on, an OAuth access token obtained by signing in through the browser |
| Rate limit tiers | `auth`, `authIdentifier`, `api`, `strict`, `read`, `write`, `webhook`, `ingest` | The same plus `credential`: 1000 charges a minute per API key or MCP connection |
| `features` of `nextspark.config.ts` | `billing`, `superadmin` (both on by default) | The same plus `mcpOAuth`, **off** by default |
| `config/app.config.ts` | | Optional `mcp.oauth.allowedClientHosts` |
| New projects | | `create-nextspark-app` and the CLI wizard write `better-auth ~1.7.27` and `@better-fetch/fetch 1.3.3` |
| Generated registries | | `mcp-scopes.ts`: the permissions of MCP browser sign-in as data. Empty lists in a project without `features.mcpOAuth`, whose sources are not read for it |
| Generated `scope-registry.ts` | Carried its own copy of the permission to scope rule | Calls core's `entityScopesOfRole` (`lib/api/auth/entity-role-scopes`). The scopes of every role are the same |
| CLI | | `nextspark mcp:revoke-scope <scope>`: takes a permission of MCP browser sign-in away from every connection that holds it |
| Environment | | `MCP_OAUTH_ACCEPT_RISKS`, read only in production by a project built with `features.mcpOAuth` |

## Better Auth 1.7.27: what behaves differently

Found by comparing the same app on 1.7.7 and on 1.7.27, with the feature off:

| Behaviour | 1.7.7 | 1.7.27 |
| --- | --- | --- |
| `POST /api/auth/sign-out` with no body | `415` | `200` |
| A sign-up whose `after` hook fails because the user's team could not be created (`TEAM_CREATION_FAILED`, `500`) | The verification email had already been sent; its link found no user | The verification email is not sent. The rest is the same: `500`, and no rows are left |
| Apple sign-in | | Only an `RS256` id token is accepted, which is what Apple issues. This matters to a test fixture that signed with another algorithm, not to a deployment |

Not changed: the schema of `users`, `session`, `account` and `verification`, and the names and attributes of the
session cookies (a production build sets the `__Secure-` prefixed cookies it set before).

A test that asserted the `415` of an empty sign-out, or the verification email of a failed sign-up, needs updating.

## What a project has to do

### Every project

1. **Move the two dependencies.** `pnpm update-core` raises `better-auth` to core's range by itself. It does not
   touch `@better-fetch/fetch`, which is not a dependency of core: set it by hand, as an exact version.

   ```bash
   pnpm add '@better-fetch/fetch@1.3.3'
   ```

   With `--no-dependency-floors`, or on an updater older than `0.1.0-beta.199`, move both:
   `pnpm add 'better-auth@~1.7.27' '@better-fetch/fetch@1.3.3'`. See
   [Core update command](./01-update-core.md#after-a-successful-update).

2. **Run the migration.** `update-core` reports the new core migration.

   ```bash
   pnpm db:migrate
   ```

   `049_oauth_provider.sql` is applied to every project, with the feature on or off. The app neither reads nor
   writes its tables while the feature is off. It adds three triggers to existing tables, which run in every
   project: on `account` (a changed password) and on `users` (a suspension), each of which records one row in
   `oauthRevocation` (the newest of a user is kept), and on `team_members` (a member who leaves or is removed),
   which deletes that member's consents for the team: there are none while the feature is off. Like every core
   migration it has no down step: take a backup first if you need to be able to go back.

That is all, apart from two things that reach a project that leaves the feature off: the page slugs `oauth` and
`.well-known` are reserved, and the per-key limit of API keys is shared across instances when Redis is configured
(see below). `nextspark prepare` writes one more registry file, `mcp-scopes.ts`, with empty lists; it is generated
with the others and needs nothing. Nothing else changes:

- `/api/mcp` keeps taking an API key only, and answers the same `401` without one.
- The host gets no new route: the OAuth routes are generated only with `features.mcpOAuth`.
- API keys are created, stored, validated and scoped as before.

### A project that limits API keys itself

- `apiKeyRateLimitResponse` (`@nextsparkjs/core/lib/api/rate-limit`) **still exists** and still counts in the
  process only. Code that calls it keeps working.
- Core's own call sites now use `credentialRateLimitResponse(request, auth)`, which is async and adds the shared
  count: with `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` both set, the per-key limit is counted in
  Redis too, so every instance shares it. A deployment that already has Redis configured gets this without doing
  anything: a key that used to get 1000 charges a minute from each instance now gets 1000 in total, and each
  check costs Redis commands (about 4).
- The numbers are those of the new `credential` tier, and `rateLimit.tiers.credential` in `config/app.config.ts`
  changes them. A project that had declared a custom tier of its own with that name is now configuring the
  built-in one.
- `DISABLE_RATE_LIMITING=true` does not turn this limit off, as before.

### A project that uses the MCP endpoint with API keys

Two changes apply to API keys as well, with the feature off:

- Entity tools return their data twice: in `structuredContent`, and as a JSON text block after the summary. A
  client that reads only text used to get "15 Tasks" and nothing else.
- The audit row of a tool call (`api_audit_log`, endpoint `mcp:<tool>`) records the status the API answered
  (`403`, `404`, `409`...), `400` for arguments that never reached the API and `500` for a handler that threw, and
  the value of an argument whose key names a secret is stored as `[redacted]`.

### A project that turns MCP browser sign-in on

It is opt-in and experimental: `features: { mcpOAuth: true }` in `nextspark.config.ts`, then a build. Follow
[MCP Browser Sign-In Deployment](../14-deployment/12-mcp-browser-sign-in.md) before production. In production the
framework checks two of its items, Redis and the database role, and none of the others. What the feature does is
in [MCP server](../05-api/20-mcp-server.md) and
[MCP Browser Sign-in (OAuth 2.1)](../06-authentication/14-mcp-browser-sign-in.md).

Three things the project has to have in place, or the feature does not build or does not serve:

- **Literal values in the entity configs and the `mcp.ts` files.** With the feature on, `nextspark prepare` reads
  the permissions from source, without running it: `slug`, `enabled` and `access.api` of each entity config, and
  `exclude`, `excludeOperations`, `extraToolScopes` and the presence of `extraTools` of each
  `entities/<slug>/mcp.ts`. An `mcp.ts` has an `export default` of an object literal that spreads no other object.
  A value that is not a literal stops the build and names the file and what to write.
- **The production gate.** In production sign-in does not start without Redis (`UPSTASH_REDIS_REST_URL` and
  `UPSTASH_REDIS_REST_TOKEN`), and it answers every OAuth request `503` while the role of `DATABASE_URL` skips
  row-level security. Connecting as the owner of the tables is the default setup until the `nextspark_app`
  cutover, so do the cutover, or name what the deployment accepts:
  `MCP_OAUTH_ACCEPT_RISKS=no-shared-rate-limit,rls-not-enforced` (one name or both). The server log says at start
  what is refused.
- **`meta.requiredScopes` on every hand-written tool.** A tool of `extraTools` or `utilityTools` that declares
  none is refused to every browser sign-in connection; `requiredScopes: []` is for a tool that needs no
  permission. With an API key the tool runs as before.

Three things to know for project code, clients and operations:

- Inside the server an OAuth connection is carried as a principal of type `'api-key'` with an `oauth` field. A
  route that branches on `type === 'api-key'` treats an MCP connection as a key.
- With the feature on, a request to `/api/mcp` that presents no API key is an OAuth request: it gets a `401` with a
  `WWW-Authenticate` challenge instead of the API key message. An empty `x-api-key` header does not count as
  presenting a key, and a request that presents both a key and an OAuth bearer is refused (`400`).
- Removing a tool does not take its scope out of the consents that had it. To do that, run
  `nextspark mcp:revoke-scope <entity>:<read|write|delete> --yes` after the deployment that removes the tool is
  the only one serving. Without `--yes` it only reports.

## Contributors: tests

- `scripts/test/throwaway-postgres.cjs`: `HAS_POSTGRES` now requires the `postgres` binary as well as `initdb`
  and `pg_ctl`. A machine with the client tools only (Homebrew's `libpq`) used to try to start a cluster and fail;
  its PostgreSQL suites are now skipped. A project's `db` Jest project uses the same helper.
- New: `tests/node/oauth-connections-pg.test.ts`, 28 cases on the rules migration 049 keeps in the database. See
  [Integration Testing](../12-testing/07-integration-testing.md#postgresql-integration-tests-in-core-testsnode).
- New: `scripts/build/registry/__tests__/mcp-scopes.test.mjs` (the generator of `mcp-scopes.ts`) and
  `tests/node/mcp-oauth-auth-graph.test.ts` (sign-in adds no path from `lib/auth` to the entity registry, the scope
  registry or the `mcp.ts` files).
- `tests/node/core-routes.test.ts`: the check that a per-entity route does not load the entity registry now
  follows a literal `require()` too. One older `require` is named in it as the only exception
  (`types/meta.types.ts`).
- A Jest test of a project that mocks `@nextsparkjs/registries/*` by hand needs a mock of
  `@nextsparkjs/registries/mcp-scopes` when it loads `lib/mcp/oauth`. Core's preset ships one, with empty lists.

## Not done

- The production gate checks Redis and the database role only. The list of accepted applications and the rest of
  the deployment checklist are not checked.
- `tools/list` is not filtered by what a connection can call.
- Run against Claude (web, desktop, mobile) and ChatGPT (web). Not run against other clients.
- Migration 049 is the only migration of the feature. From the release that carries it, a change to its tables or
  triggers is a new migration; the file is not edited.
