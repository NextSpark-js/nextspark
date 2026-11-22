# Verifying the shared rate limit with Redis

## Introduction

Every API key and every MCP connection has a limit of its own, the `credential` tier: 1000 charges per minute (a plain request such as `ping` is one charge)
unless `rateLimit.tiers` of `config/app.config.ts` says otherwise. `credentialRateLimitResponse` in
`src/lib/api/rate-limit.ts` counts it in the process and, when Redis is configured, in Redis as well, so every
instance of a deployment shares one count. A request is refused when either count is over.

Without Redis the count is per process. On a serverless platform each instance then gives a credential its own
1000, which is close to no limit.

This page covers the two ways the shared count is tested:

- a Jest suite, with the shared store mocked;
- a procedure to run against a real deployment with a real Redis, with the result of the run made for this
  feature (#541) as a reference.

Only Upstash Redis over its REST API is supported, and both `UPSTASH_REDIS_REST_URL` and
`UPSTASH_REDIS_REST_TOKEN` have to be set (`maybeRedisConfigured` in `src/lib/rate-limit-redis.ts`). With one of
them missing the limit stays in memory. `REDIS_URL` and the `KV_REST_API_*` variables are not read.

---

## Unit suite

`packages/core/tests/jest/lib/api/credential-rate-limit.test.ts`

```bash
pnpm test:core -- lib/api/credential-rate-limit.test.ts
```

It mocks `lib/rate-limit-redis` and checks what `credentialRateLimitResponse` does with the answers:

| Case | What it checks |
| --- | --- |
| Without Redis | The count is the one of the process, and the shared store is not asked |
| With Redis | The credential is counted in the shared store, under its own identifier, in the `credential` tier |
| Counted once | A request authenticated several times is counted once in the shared store |
| Shared count over | A `429` with `Retry-After`, although this process counted little |
| Local count over | The request is refused without asking the shared store |
| Two instances | One counter for a credential: the request that takes it over the limit is refused wherever it lands |
| Configured tier | Without Redis the count of the process follows the numbers of `rateLimit.tiers`, below and above the default |

What the suite does not show:

- that a real Redis counts. The store is a mock, so "two instances" is one counter in the test, not two processes
  against Upstash;
- what happens when Redis fails. The shared check then lets the request through (`checkRateLimit` in
  `src/lib/rate-limit-redis.ts` catches the error, logs it and answers as allowed) and the count of the process
  still applies. That path is inside the mocked module, and no test in the repository exercises it.

The procedure below covers the first point. The second is not covered by any test.

---

## Procedure against a deployment

Run it on a deployment made for testing: step 2 turns the per-address limits off while it runs.

### 1. Configure Redis

Create an Upstash Redis database and set, in the environment of the deployment:

```bash
UPSTASH_REDIS_REST_URL=https://<your-database>.upstash.io
UPSTASH_REDIS_REST_TOKEN=<token>
```

A database created from Vercel's Marketplace sets `KV_REST_API_URL` and `KV_REST_API_TOKEN` instead. Add the two
`UPSTASH_REDIS_REST_*` variables with the same values: see
[Vercel Deployment](../14-deployment/03-vercel-deployment.md#upstash-redis-from-vercels-marketplace).

### 2. Turn the per-address limits off for the run

`/api/mcp` also has the `api` tier of `withRateLimitTier`: 100 requests per minute per client address. A run from
one machine would be stopped by it long before the credential reaches 1000.

```bash
DISABLE_RATE_LIMITING=true
```

This turns off the per-address tiers and Better Auth's own sign-in, sign-up and one-time-code limits. It does not
turn off the per-credential limit, which is a safety cap. Remove the variable when the run is over (step 7).

### 3. Deploy

Deploy with both changes. The feature has to be on for an MCP connection: `features.mcpOAuth`, migration 048,
`MCP_ENABLED=true` in production (see
[MCP browser sign-in deployment](../14-deployment/12-mcp-browser-sign-in.md)).

### 4. Get the access token of one connection

Any MCP connection will do. Either connect a real client and take its access token, or script the authorization
as the reference run did, with a session cookie kept between the calls:

1. Sign in: `POST /api/auth/sign-in/email`.
2. Create a public client for the signed-in user: `POST /api/auth/oauth2/create-client`, with a loopback
   redirect URI and the grant types `authorization_code` and `refresh_token`. (Unauthenticated registration is
   closed. With `mcp.oauth.allowedClientHosts` set, a client whose id is not an https URL on a listed host is
   refused, so run this without a list or use a listed client.)
3. Start the authorization: `GET /api/auth/oauth2/authorize` with `response_type=code`, the client id, the
   redirect URI, `resource=<app URL>/api/mcp`, a scope such as `openid offline_access tasks:read`, and a PKCE
   challenge (`code_challenge_method=S256`).
4. When the answer points at `/oauth/select-team`, choose the team: `POST /api/internal/oauth-team` with
   `{ "teamId": "<team id>", "authorization": "<the code_challenge>" }`, then `POST /api/auth/oauth2/continue`.
5. When the answer points at `/oauth/consent`, accept: `POST /api/auth/oauth2/consent`.
6. Exchange the code: `POST /api/auth/oauth2/token` with `grant_type=authorization_code`, the code, the redirect
   URI, the client id, the PKCE verifier and the same `resource`.

An access token lives ten minutes, which is enough for the run.

### 5. Send more than the limit inside one window

Send more requests than the limit in well under a minute, many at a time, so that several instances serve them.
The reference run sent 1300 JSON-RPC `ping` requests, 60 at a time. A `ping` is enough: the limit is checked
before the body is read.

```js
// shared-limit.mjs: node shared-limit.mjs
const APP_URL = process.env.APP_URL            // https://app.example.com
const ACCESS_TOKEN = process.env.ACCESS_TOKEN  // from step 4
const TOTAL = Number(process.env.TOTAL ?? 1300)
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 60)

const counts = {}
let next = 0
let firstRefusedAt = null
const started = Date.now()

async function worker() {
  while (next < TOTAL) {
    const n = ++next
    const res = await fetch(`${APP_URL}/api/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        authorization: `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: n, method: 'ping' }),
    })
    await res.arrayBuffer()
    counts[res.status] = (counts[res.status] ?? 0) + 1
    if (res.status === 429 && firstRefusedAt === null) firstRefusedAt = n
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker))
console.log(`${TOTAL} requests in ${((Date.now() - started) / 1000).toFixed(1)} s:`, counts, 'first 429 at', firstRefusedAt)
```

Expected with the default tier: 1000 answers `200` and the rest `429`. A `429` here is a JSON-RPC error with a
`Retry-After` header.

### 6. Read the counter in Redis

That exactly 1000 pass does not prove the count was shared: one instance serving every request would give the
same number with the count in memory. Read the counter itself, right after the run (the keys expire shortly after
the window ends).

The limiter of a tier writes under the prefix `ratelimit:<tier>`, followed by the identifier of the credential:

| Credential | Identifier |
| --- | --- |
| MCP connection | `oauth:<client id>:<user id>` |
| API key | the id of the key |

With Upstash's REST API:

```bash
# The keys of the tier: the counter of the connection and the limiter's analytics key
curl -s "$UPSTASH_REDIS_REST_URL" -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN" \
  -d '["KEYS", "ratelimit:credential:*"]'

# The value of the counter (the key ends with the window it counts)
curl -s "$UPSTASH_REDIS_REST_URL" -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN" \
  -d '["GET", "ratelimit:credential:oauth:<client id>:<user id>:<window>"]'
```

The counter of the connection reads the limit (1000) when the count was kept in Redis. The database's dashboard
shows the peak of commands of the run as well.

### 7. Put the limits back

Remove `DISABLE_RATE_LIMITING` and deploy again. Check that the variable is gone from the environment: while it is
set, each server process logs `[RateLimit] WARNING: Rate limiting is DISABLED via DISABLE_RATE_LIMITING=true` once.

---

## Reference result

Run on 2026-11-22 against a serverless deployment with an Upstash Redis database, one MCP connection with the
scope `tasks:read`:

| Measure | Value |
| --- | --- |
| Requests sent | 1300 |
| At a time | 60 |
| Duration | 7.5 s |
| Answered `200` | 1000 |
| Answered `429` | 300 |
| First `429` | request number 996 |
| Counter of the connection in Redis | 1000 |

The first `429` is request 996 and not 1001 because the requests run in parallel and are numbered when they are
sent, not when they are counted.

---

## What the procedure does not cover

- **It does not show which instance served a request.** The platform does not expose it. The evidence that the
  count is shared is the counter in Redis, not the spread of the requests.
- **An API key.** The same function limits an API key, by the id of the key, but the run was made with an MCP
  connection only.
- **Redis failing.** See [Unit suite](#unit-suite): the fail-open path has no test.
- **Tool calls.** A tool call counts twice: once for the MCP request and once for the API handler the tool calls
  in process. That is the same for an API key, and the run (`ping` requests) does not measure it.

---

## Sizing

The 1300 requests of the reference run used about 5,400 Redis commands: **about 4 commands for each
per-credential check**. The figure was measured with the per-address limits off.

- With Redis configured, every tier is counted there, the per-address tiers included, so a request in normal
  operation costs more than one check.
- A tool call makes two per-credential checks (see above).
- At 4 commands per check, a quota of 500,000 commands a month is about 120,000 checks. Compare the expected
  traffic with the command quota of the Redis plan before going to production.

---

## Related

- [Integration Testing](./07-integration-testing.md) - the PostgreSQL tests of the rules the database holds
- [MCP browser sign-in deployment](../14-deployment/12-mcp-browser-sign-in.md) - deployment checklist
- [MCP server](../05-api/20-mcp-server.md) - the endpoint and its limits
- [Rate limiting](../rate-limiting.md) - tiers and configuration

---

**Last Updated:** 2026-11-22
**Status:** Experimental feature (MCP browser sign-in, #541)
