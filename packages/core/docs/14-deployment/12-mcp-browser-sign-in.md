# MCP Browser Sign-In Deployment

> **Experimental and opt-in.** MCP browser sign-in (#541) is off unless a project turns it on. It has been run against Claude (web, desktop and mobile) and ChatGPT (web); other clients have not been run. **In production the framework enforces two items of this checklist**, Redis (item 5) and the database role (item 6): sign-in does not serve without them unless `MCP_OAUTH_ACCEPT_RISKS` names what the deployment accepts. Nothing checks the other items.

## Introduction

With MCP browser sign-in the app is the OAuth 2.1 authorization server of its own MCP endpoint, `/api/mcp`: an MCP
client such as Claude connects by sending the user to the app's login, team picker and consent screen, instead of
being configured with an API key. What the feature does is described in [MCP server](../05-api/20-mcp-server.md)
and [MCP Browser Sign-in (OAuth 2.1)](../06-authentication/14-mcp-browser-sign-in.md).
This page is what a deployment needs before it is turned on, and how to check it.

A project that does not turn the feature on needs nothing from this page: `/api/mcp` keeps taking an API key only.

---

## Checklist

| # | Item | Where |
| --- | --- | --- |
| 1 | Build flag `features.mcpOAuth`, and a build that runs `nextspark prepare`. Literal values in the entity configs and the `mcp.ts` files | `nextspark.config.ts`, `entities/` |
| 2 | `MCP_ENABLED=true`; `MCP_OAUTH_ENABLED` unset or not `false` | Environment |
| 3 | Migration `049_oauth_provider.sql` applied | `pnpm db:migrate` |
| 4 | App URL and issuer URL are the public https URLs | `NEXT_PUBLIC_APP_URL`, `BETTER_AUTH_URL` |
| 5 | Redis for the shared per-credential limit. **Enforced in production** | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| 6 | The runtime database role is not the table owner, so RLS is in effect. **Enforced in production** | `DATABASE_URL`, `DATABASE_SERVICE_URL` |
| 7 | Optional: the list of applications that may connect | `config/app.config.ts` |
| 8 | Hand-written tools declare their permissions | `meta.requiredScopes` of each tool |
| 9 | Verify: the 401 challenge, the discovery documents, a real client | Below |

Items 5 and 6 are the [production gate](#the-production-gate). A deployment that runs without one of them says so:

```bash
MCP_OAUTH_ACCEPT_RISKS=no-shared-rate-limit,rls-not-enforced   # one name, or both
```

### 1. The feature flag and `nextspark prepare`

```ts
// nextspark.config.ts
export default defineConfig({
  features: { mcpOAuth: true },
})
```

The flag is read at build time. `nextspark prepare` (run by `nextspark build` and `nextspark dev`) generates the
routes of the feature only when it is `true`: the discovery documents under `/.well-known/`, the pages
`/oauth/select-team` and `/oauth/consent`, and the internal routes `/api/internal/oauth-team` and
`/api/internal/oauth-connections`. Without the flag the host has none of them, the authorization server is not
registered, and no environment variable can turn the feature on.

Changing the flag needs a new build. A build command that calls `next build` directly, without `nextspark prepare`
before it, does not regenerate the routes.

`oauth` and `.well-known` are reserved slugs: a page-builder page cannot take them.

With the flag on, `nextspark prepare` also generates the permissions of the feature as data
(`.nextspark/registries/mcp-scopes.ts`). It reads them from the source of the entity configs (`slug`, `enabled`,
`access.api`) and of the `entities/<slug>/mcp.ts` files (`exclude`, `excludeOperations`, `extraToolScopes`,
whether there are `extraTools`), without running them. Those values have to be literals, and an `mcp.ts` has to
`export default` an object literal that spreads no other object. A value that cannot be read stops the build and
names the file and what to write. See
[Where the list comes from](../06-authentication/14-mcp-browser-sign-in.md#where-the-list-comes-from).

### 2. The runtime switches

```bash
MCP_ENABLED=true          # production: the endpoint is off unless this is exactly 'true'
# MCP_OAUTH_ENABLED=false # only to switch browser sign-in off
```

`MCP_OAUTH_ENABLED=false` is the emergency switch. It needs no change to the project and no new routes: every
OAuth route answers `404` and `/api/mcp` takes an API key only. Like any environment variable it is read by a new
server process, so on a platform that builds on every deployment it takes a redeploy. It deletes nothing: the
rows of the existing connections stay in the database.

### 3. Migration 049

```bash
pnpm db:migrate --dry-run --expect-database <name> --expect-host <host>
pnpm db:migrate --expect-database <name> --expect-host <host>
```

`049_oauth_provider.sql` is a core migration, so `db:migrate` applies it to every project, with the feature on or
off. It adds ten tables (`jwks`, `oauthClient`, `oauthResource`, `oauthClientResource`, `oauthRefreshToken`,
`oauthAccessToken`, `oauthConsent`, `oauthClientAssertion`, `oauthTeamSelection`, `oauthRevocation`), all
service-only under RLS, nine triggers and ten functions. It changes no existing table; three of the triggers are on existing
tables (`account`, for a changed password, `users`, for a suspension, and `team_members`, for a member who leaves
or is removed). The app neither reads nor writes the new tables while the feature is off; those three triggers
run in every project: the first two record one row in `oauthRevocation`, the third deletes consents that do not
exist while the feature is off.

To check it:

```sql
SELECT tgname FROM pg_trigger WHERE tgname LIKE 'oauth_%' ORDER BY tgname;
-- oauth_consent_narrowed, oauth_consent_removed, oauth_consent_requires_membership,
-- oauth_end_on_member_removed, oauth_refresh_token_deleted,
-- oauth_refresh_token_requires_consent, oauth_refresh_token_revoked,
-- oauth_revoke_on_password_change, oauth_revoke_on_suspension

SELECT to_regprocedure('public.revoke_oauth_scope(text)') IS NOT NULL;   -- the operator's function, see Operations
```

The triggers are part of the security of the feature, not a convenience: they are what refuses a token for a
connection that was ended, and what cuts a token down when its consent is narrowed. See
[Migrations](../10-backend/02-migrations.md#migration-049-mcp-browser-sign-in) and
[Database Migrations in Production](./05-database-migrations-production.md).

### 4. The app URL and the issuer URL

```bash
NEXT_PUBLIC_APP_URL=https://app.yourdomain.com
BETTER_AUTH_URL=https://app.yourdomain.com
```

- The **MCP resource** is `NEXT_PUBLIC_APP_URL` + `/api/mcp` (with the Next.js `basePath`, when there is one).
  Access tokens are issued for exactly that URL, and `/api/mcp` accepts no other audience.
- The **issuer** is where Better Auth is served: `BETTER_AUTH_URL`, with `/api/auth` added when the variable has no
  path of its own.

Both have to be the URLs a client reaches from the internet, over https. A client follows the discovery documents
and compares them with the URL it was given: a `localhost` resource, an `http` URL or another domain ends the
connection before the login page. Under a `basePath` the discovery documents are served inside it and the 401
challenge points there. See [Environment Configuration](./02-environment-configuration.md#application-urls).

### 5. Redis for the shared limit

```bash
UPSTASH_REDIS_REST_URL=https://<your-database>.upstash.io
UPSTASH_REDIS_REST_TOKEN=<token>
```

A connection has 1000 charges a minute (tier `credential`; change it in `rateLimit.tiers` of
`config/app.config.ts`): one per request, and one more for each API handler a tool calls, so a generated entity
tool costs two. Without Redis that count is kept by each process, so a deployment with several instances,
and any serverless deployment, multiplies it by the number of instances. Both variables are required, and only
Upstash's REST API is supported. On Vercel the Marketplace integration creates other variable names: see
[Vercel Deployment](./03-vercel-deployment.md#upstash-redis-from-vercels-marketplace).

**In production sign-in does not start without both variables.** The deployment then behaves as with
`MCP_OAUTH_ENABLED=false`: every OAuth route answers `404`, `/api/mcp` takes an API key only, and the server log
says why once, at start. `MCP_OAUTH_ACCEPT_RISKS=no-shared-rate-limit` starts it with the per-process count.

To check it on the deployment, and to size the Redis plan (about 4 commands for each per-credential check), follow
[Verifying the shared rate limit with Redis](../12-testing/12-shared-rate-limit-verification.md).

The limit is a safety cap: `DISABLE_RATE_LIMITING=true` does not turn it off. As said above, a request with one generated entity
tool costs two charges.

### 6. A runtime database role that is not the owner

```bash
DATABASE_URL=postgresql://<login that inherits nextspark_app>:...   # user requests: RLS applies
DATABASE_SERVICE_URL=postgresql://<owner or BYPASSRLS role>:...     # the authorization server and other system work
MIGRATE_DATABASE_URL=postgresql://<owner>:...                       # migrations
```

Every OAuth table is service-only under RLS: `jwks` holds the private half of the signing keys, and the token
tables hold credentials. A policy only protects them from a connection that is subject to RLS. While
`DATABASE_URL` connects as the table owner, RLS is not applied to any of the application's queries, and that
protection does not exist.

Do the documented cutover before turning the feature on:
[RLS Policies → Enforcement Layer](../10-backend/03-rls-policies.md#enforcement-layer-beta167). At a production
start core logs a warning beginning with `[rls]` when the role of `DATABASE_URL` skips RLS, and `nextspark doctor`
reports the same. Neither stops the server.

**In production sign-in serves no OAuth request while that role skips RLS** (it owns the tables, is a superuser or
has `BYPASSRLS`). The server starts and everything else works. The endpoints of the authorization server and the
discovery documents answer `503`, the OAuth path of `/api/mcp` answers `503` with no challenge, and a line
beginning with `[mcp:oauth]` says why at start. Connecting as the owner is the default setup, so this is what a
project that turns the feature on without the cutover sees. `MCP_OAUTH_ACCEPT_RISKS=rls-not-enforced` serves
sign-in without the cutover.

### 7. Optional: which applications may connect

By default any application that publishes a valid Client ID Metadata Document can start a sign-in, and the user
decides on the consent screen, which names the application and its host. To accept only some:

```ts
// config/app.config.ts
mcp: { oauth: { allowedClientHosts: ['claude.ai', 'chatgpt.com'] } }
```

- An application is then accepted only when its client id is an https URL, without credentials in it, on one of
  the hosts. `*.example.com` accepts the subdomains of a host.
- The list is applied before the application's metadata document is fetched, when it asks for authorization, at
  the token and identity endpoints, and on every request to `/api/mcp`: a connection made before the list changed
  stops working.
- Only an absent or empty list is open. A list that names no usable host (a typo such as `https//claude.ai`, or
  `null`) closes the server to **every** application, and the server log names the unusable entries once.

This is `app.config`, so changing it is a new build.

### 8. Hand-written tools declare their permissions

A tool a project writes (`extraTools` of an `mcp.ts`, `utilityTools`) is refused to every browser sign-in
connection unless it declares what it needs:

```ts
meta: { operation: 'workflow', requiredScopes: ['tasks:read', 'tasks:write'] }
meta: { requiredScopes: [] }   // a tool that needs no permission
```

A scope no generated tool uses also goes in `extraToolScopes` of the `mcp.ts`. With an API key nothing changes. A
build with the flag on logs a warning for each tool that declares nothing. See
[Scopes a tool needs](../05-api/20-mcp-server.md#scopes-a-tool-needs).

### 9. Verify

With `APP=https://app.yourdomain.com`:

```bash
# 1. The challenge: 401 with a WWW-Authenticate header that names the resource metadata
curl -si -X POST "$APP/api/mcp" -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"ping"}' | grep -i -E '^HTTP|^www-authenticate'

# 2. The resource metadata (RFC 9728): "resource" is $APP/api/mcp, "authorization_servers" has the issuer
curl -s "$APP/.well-known/oauth-protected-resource/api/mcp"

# 3. The authorization server metadata (RFC 8414): "issuer" is $APP/api/auth
curl -s "$APP/.well-known/oauth-authorization-server/api/auth"
curl -s "$APP/api/auth/.well-known/openid-configuration"

# 4. The public half of the signing keys
curl -s "$APP/api/auth/jwks"
```

How to read the results:

| Result | Meaning |
| --- | --- |
| `404` on `/api/mcp` | `MCP_ENABLED` is not `true` |
| `401` without `WWW-Authenticate`, with a message about an API key | The endpoint is on and browser sign-in is not: the build has no `features.mcpOAuth`, or `MCP_OAUTH_ENABLED=false` |
| `401` with `WWW-Authenticate: Bearer ...` naming `/.well-known/oauth-protected-resource/api/mcp` | Browser sign-in is on |
| `404` on a discovery document | The routes were not generated (no build flag, or a build without `nextspark prepare`), the runtime switch is off, or in production Redis is missing (item 5) |
| `503` on `/api/mcp` or on a discovery document | The production gate: the role of `DATABASE_URL` skips RLS (item 6), the migrations have not run, or the database could not be asked. The server log has the reason |
| `resource` or `issuer` with `localhost`, `http://` or another host | Item 4 |

Then connect a real client. In Claude, add the app as a custom connector with the URL `$APP/api/mcp`. The browser
should show the app's login, the team picker when the account is in several teams, and the consent screen with one
row per entity. After accepting:

- the client lists the tools and a call returns data;
- **Settings > Security > Connected applications** shows the connection, with its team and permissions;
- the call is recorded in `api_audit_log` with the endpoint `mcp:<tool>` (the write is best effort: if the row is
  missing, look for `[mcp:audit]` in the server log);
- **Disconnect** on that screen ends it: the next call from the client is refused.

`/api/mcp` also has the per-address `api` tier (100 requests a minute), which applies to the `curl` checks too.

---

## The Production Gate

In production (`NODE_ENV=production`) two items of the checklist are enforced:

| Risk name | Without it | To accept it |
| --- | --- | --- |
| `no-shared-rate-limit` | No Redis (item 5): sign-in does not start, as with `MCP_OAUTH_ENABLED=false` | `MCP_OAUTH_ACCEPT_RISKS=no-shared-rate-limit` |
| `rls-not-enforced` | `DATABASE_URL` connects as a role that skips RLS (item 6): every OAuth request is answered `503` | `MCP_OAUTH_ACCEPT_RISKS=rls-not-enforced` |

- Both names go in the one variable, separated by a comma or a space. A value that is neither name, such as
  `true`, accepts nothing and is logged.
- The log says at start what is refused and how to fix or accept it, and, with a risk accepted, what the server is
  running without.
- A client that revokes its token (`/oauth2/revoke`) and a user who withdraws a consent are still served while the
  gate refuses.
- Outside production there is no gate.

The reasons and the details are in
[MCP Browser Sign-in: production gate](../06-authentication/14-mcp-browser-sign-in.md#production-gate).

## What the Framework Does Not Enforce

A production build with the feature on starts and serves sign-in in each of these cases, without refusing:

- there is no list of applications, so any application with a valid metadata document can start a sign-in;
- `MCP_OAUTH_ACCEPT_RISKS` accepts a condition of the gate: the per-credential limit is then per instance, or RLS
  has no effect, as the name says.

Known limits, as of this version:

- Run against Claude and ChatGPT only. With ChatGPT, widening a connection's permissions after a refused call has not been run.
- Removing a tool does not cut connections off: its scope stays accepted and stops being offered and issued. It is not a revocation: the consents still name the scope, and it counts again if a tool needs it again. To take it away from existing connections, run `nextspark mcp:revoke-scope` (see Operations).
- A change to the tools that changes the permissions on offer has to reach every instance at once. Each instance writes the policy that cuts tokens down to those permissions when it starts, with no version check, so in a gradual deployment an instance of the earlier version that starts late puts the earlier list back until an instance of the new version starts again. Deploy such a change all at once, or drain the earlier version first.
- A client that renews its token, loses the answer and retries within 30 seconds across such a deployment is refused with `invalid_grant` and has to authorize again.
- `tools/list` shows every tool, including the ones the connection has no permission to call.
- A tool written by hand that declares no `meta.requiredScopes` cannot be called through a connection (item 8).
- When everything a client asks for is already consented, Better Auth shows no consent screen on reconnect.
- Signing out of the browser does not disconnect an application.

---

## Operations

**No job to schedule.** Expired tokens, client assertions, team selections, old revocations and retired signing
keys are purged where tokens are issued, at most once an hour per process, at most 2000 rows of each kind per run,
a day after they expired (signing keys 31 days after). This is not a Scheduled Action and needs no cron. A project
that wants its own schedule calls `purgeExpiredOAuth` from `lib/mcp/oauth/purge`, an internal module.

**Retiring a permission.** Removing a tool, or excluding an operation, stops its scope from being offered and
issued. The consents that had it keep it. To remove it from them, after the deployment that retires the tool is the
only one serving:

```bash
nextspark mcp:revoke-scope tasks:delete          # reports: how many connections hold it, how many would be ended
nextspark mcp:revoke-scope tasks:delete --yes    # applies it
```

Each connection that held the scope loses it at once (its tokens are cut down and the access tokens already issued
are refused), and one left with no entity permission is ended. It connects with `MIGRATE_DATABASE_URL`, else
`DATABASE_SERVICE_URL`, else `DATABASE_URL`, and refuses a role that RLS applies to. It is not run automatically:
during a rolling deployment that would take the scope away from connections the earlier version still serves. See
[When a scope is retired](../06-authentication/14-mcp-browser-sign-in.md#when-a-scope-is-retired).

**Signing keys rotate by themselves** every 30 days; the replaced key stays published for 30 more days, far longer
than the ten minutes an access token lives. A key created before rotation was configured has no expiry and does not
rotate by itself.

**Rolling back.** To stop the feature, set `MCP_OAUTH_ENABLED=false`. To remove it, build without the flag.
Migration 049 has no down step: its tables can stay, unused. Dropping them signs every MCP client out.

**Updating later.** Migration 049 is the only migration of the feature. Once a release carries it, it is never
edited: a later change to these tables or triggers comes as a new migration, applied by `pnpm db:migrate`.

---

## Related

- [MCP server](../05-api/20-mcp-server.md) - the endpoint and the two credentials it accepts
- [MCP Browser Sign-in (OAuth 2.1)](../06-authentication/14-mcp-browser-sign-in.md) - the model: teams, consent, connected applications, security
- [Environment Configuration](./02-environment-configuration.md) - the variables
- [Vercel Deployment](./03-vercel-deployment.md) - the Upstash variable names on Vercel
- [Verifying the shared rate limit with Redis](../12-testing/12-shared-rate-limit-verification.md)
- [Integration Testing](../12-testing/07-integration-testing.md) - the PostgreSQL test of the rules of migration 049
- [RLS Policies](../10-backend/03-rls-policies.md) - the runtime role and the cutover

---

**Last Updated:** 2026-11-24
**Status:** Experimental
