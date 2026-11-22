# Better Auth 1.7.27, migration 048 and MCP browser sign-in

> **Unreleased.** These changes are in core after `0.1.0-beta.205` (issue [#541](https://github.com/NextSpark-js/nextspark/issues/541)) and have no release number yet. "The release that carries them" below is the first release after `0.1.0-beta.205`. When it is published, its changelog entry is the authoritative list.

One change set brings four things: a newer Better Auth, a core migration, an opt-in feature and a rate limit tier. A
project that does not turn the feature on has two things to do: move two dependencies and run the migration.

## What changes

| Area | Before (`0.1.0-beta.205`) | After |
| --- | --- | --- |
| `better-auth` | `~1.7.7` | `~1.7.27` |
| `@better-fetch/fetch` | `1.3.2` | `1.3.3`, the exact version Better Auth 1.7.27 pins |
| Core's own dependencies | | `@better-auth/oauth-provider`, `@better-auth/mcp`, `@better-auth/cimd` and `@better-auth/core`, all `~1.7.27`. They come with `@nextsparkjs/core`: a project does not declare them |
| Migrations | Up to `047` | `048_oauth_provider.sql`: ten service-only tables and seven triggers for the OAuth authorization server. No existing table is altered |
| MCP endpoint (`/api/mcp`) | API key only | API key, and, only when the project turns it on, an OAuth access token obtained by signing in through the browser |
| Rate limit tiers | `auth`, `authIdentifier`, `api`, `strict`, `read`, `write`, `webhook`, `ingest` | The same plus `credential`: 1000 requests a minute per API key or MCP connection |
| `features` of `nextspark.config.ts` | `billing`, `superadmin` (both on by default) | The same plus `mcpOAuth`, **off** by default |
| `config/app.config.ts` | | Optional `mcp.oauth.allowedClientHosts` |
| New projects | | `create-nextspark-app` and the CLI wizard write `better-auth ~1.7.27` and `@better-fetch/fetch 1.3.3` |

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

   `048_oauth_provider.sql` is applied to every project, with the feature on or off. Nothing reads or writes its
   tables while the feature is off. It adds two triggers to existing tables, on `account` (a changed password) and
   on `users` (a suspension); with no OAuth connection they find nothing to do. Like every core migration it has
   no down step: take a backup first if you need to be able to go back.

That is all. Nothing else changes for a project that leaves the feature off:

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
[MCP Browser Sign-In Deployment](../14-deployment/12-mcp-browser-sign-in.md) before production: the framework
does not check its items at start. What the feature does is in [MCP server](../05-api/20-mcp-server.md) and
[MCP Browser Sign-in (OAuth 2.1)](../06-authentication/14-mcp-browser-sign-in.md).

Two things to know for project code and clients:

- Inside the server an OAuth connection is carried as a principal of type `'api-key'` with an `oauth` field. A
  route that branches on `type === 'api-key'` treats an MCP connection as a key.
- With the feature on, a request to `/api/mcp` that presents no API key is an OAuth request: it gets a `401` with a
  `WWW-Authenticate` challenge instead of the API key message. An empty `x-api-key` header does not count as
  presenting a key, and a request that presents both a key and an OAuth bearer is refused (`400`).

## Contributors: tests

- `scripts/test/throwaway-postgres.cjs`: `HAS_POSTGRES` now requires the `postgres` binary as well as `initdb`
  and `pg_ctl`. A machine with the client tools only (Homebrew's `libpq`) used to try to start a cluster and fail;
  its PostgreSQL suites are now skipped. A project's `db` Jest project uses the same helper.
- New: `tests/node/oauth-connections-pg.test.ts`, 18 cases on the rules migration 048 keeps in the database. See
  [Integration Testing](../12-testing/07-integration-testing.md#postgresql-integration-tests-in-core-testsnode).

## Not done

- No production gate: the feature does not refuse to start with a database connection that owns the tables (RLS
  without effect) or without Redis.
- Not run against ChatGPT's hosted client. Run against Claude (web, desktop, mobile).
- Migration 048 is the only migration of the feature. From the release that carries it, a change to its tables or
  triggers is a new migration; the file is not edited.
