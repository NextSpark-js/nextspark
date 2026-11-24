# Integration Testing

## Introduction

Integration tests verify that **multiple components work together correctly**. They test the interaction between different layers (API + Database, Frontend + Backend).

The first sections are patterns for a project's suites. Core's own tests against a real PostgreSQL server, and the
test of the rules MCP browser sign-in keeps in the database, are in
[PostgreSQL integration tests in core](#postgresql-integration-tests-in-core-testsnode).

---

## API + Database Integration

### Testing Complete Flow

```typescript
describe('Task API Integration', () => {
  beforeEach(async () => {
    // Setup test database
    await setupTestDatabase()
  })

  afterEach(async () => {
    // Clean up
    await cleanTestDatabase()
  })

  it('should create and retrieve task', async () => {
    // Create task via API
    const createResponse = await fetch('/api/v1/tasks', {
      method: 'POST',
      headers: {
        'x-api-key': TEST_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: 'Integration Test Task',
        description: 'Testing full flow'
      })
    })

    expect(createResponse.status).toBe(201)
    const created = await createResponse.json()

    // Retrieve task via API
    const getResponse = await fetch(`/api/v1/tasks/${created.data.id}`, {
      headers: { 'x-api-key': TEST_API_KEY }
    })

    expect(getResponse.status).toBe(200)
    const retrieved = await getResponse.json()
    expect(retrieved.data.title).toBe('Integration Test Task')

    // Verify in database
    const dbTask = await query(
      'SELECT * FROM tasks WHERE id = $1',
      [created.data.id]
    )
    expect(dbTask[0].title).toBe('Integration Test Task')
  })
})
```

---

## Frontend + Backend Integration

### Cypress Integration Tests

```typescript
describe('Task Management Integration', () => {
  beforeEach(() => {
    cy.login('user@example.com', 'password')
  })

  it('should create, update, and delete task', () => {
    // Create task
    cy.visit('/dashboard/tasks')
    cy.get('[data-cy="create-task"]').click()
    cy.get('[data-cy="title"]').type('Integration Test')
    cy.get('[data-cy="submit"]').click()
    
    // Verify created
    cy.contains('Integration Test')

    // Update task
    cy.contains('Integration Test').click()
    cy.get('[data-cy="edit"]').click()
    cy.get('[data-cy="title"]').clear().type('Updated Task')
    cy.get('[data-cy="submit"]').click()
    
    // Verify updated
    cy.contains('Updated Task')

    // Delete task
    cy.get('[data-cy="delete"]').click()
    cy.get('[data-cy="confirm"]').click()
    
    // Verify deleted
    cy.contains('Updated Task').should('not.exist')
  })
})
```

---

## Testing with Real Database

### Using Test Database

```typescript
// Setup test database connection
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL

beforeAll(async () => {
  // Connect to test database
  await connectToDatabase(TEST_DATABASE_URL)
  
  // Run migrations
  await runMigrations()
})

afterAll(async () => {
  // Close connection
  await disconnectFromDatabase()
})
```

The snippets above are patterns for a project's own suites. Core's own integration tests against PostgreSQL are
described next.

---

## PostgreSQL integration tests in core (`tests/node`)

Core has a second test runner next to Jest: the files in `packages/core/tests/node/*.test.ts` are `node:test`
suites run with `tsx`. Many of them need a real PostgreSQL server, because what they check lives in the database:
row-level security policies, triggers, locks, the migration runner. Those suites start a server of their own and
never use the `DATABASE_URL` of the environment.

### How a suite gets its database

| Piece | What it does |
| --- | --- |
| `scripts/test/throwaway-postgres.cjs` | `startCluster(prefix)` runs `initdb` in a new directory of the OS temp directory and starts the server with `pg_ctl` on a free port of `127.0.0.1`, with `trust` authentication and one superuser, `owner`. `stop()` stops the server and removes the directory. `clusterUrl(cluster)` is its connection string. `HAS_POSTGRES` says whether a cluster can be started at all. The file ships with the package, so a project's suites can use it too (see [Unit Testing with Jest](./02-unit-testing-jest.md)). |
| `tests/support/throwaway-postgres.ts` | Re-exports the file above under the import path core's suites use. |
| `tests/node/_pg-cutover.ts` | `cutoverDatabase(t)` starts a cluster, applies every file of `packages/core/migrations/` in order to the empty database (all but `090_sample_data.sql`, and any file named in `except`), and creates `app_login`, a login role without `BYPASSRLS` that inherits `nextspark_app`: the documented RLS cutover. It returns an `owner` client, an `app` client and both URLs, and registers the cleanup with `t.after`. `asUser(app)` runs a statement on the app connection as one user, in its own transaction, the way `lib/db.ts` does. |

So every run proves that the migrations apply from nothing, and the code under test runs against the schema the
migrations really produce.

### What it needs on the `PATH`

`initdb`, `pg_ctl` and `postgres`. `HAS_POSTGRES` runs each with `--version` and is true only when all three
answer. The `postgres` binary is required since the MCP browser sign-in work (#541): some installs put `initdb` and
`pg_ctl` on the `PATH` with the client tools alone (Homebrew's `libpq`), and a cluster cannot start without the
server.

A suite that needs a cluster is **skipped, not failed**, when `HAS_POSTGRES` is false. The skip reason still reads
`initdb/pg_ctl not on PATH`, also when the missing binary is `postgres`:

```text
﹣ MCP browser sign-in: the rules the database holds (0.29ms) # initdb/pg_ctl not on PATH
ℹ tests 1
ℹ pass 0
ℹ fail 0
ℹ skipped 1
```

A run with `skipped` in its summary has not checked the database rules. Put the server's `bin` directory on the
`PATH` (for example `/opt/homebrew/opt/postgresql@16/bin` with Homebrew's `postgresql@16`, or
`/usr/lib/postgresql/16/bin` on Debian and Ubuntu) and run it again. CI does this: see
[CI Workflows](./10-ci-workflows.md#what-this-repositorys-ci-runs).

### Running them

```bash
# Every node:test suite of core, from the repository root
pnpm --filter @nextsparkjs/core test:node

# The same from packages/core
pnpm test:node

# One file, from packages/core
npx tsx --test tests/node/oauth-connections-pg.test.ts

# Jest and the node:test suites together, from packages/core
pnpm test:all
```

`test:node` is `npx tsx --test tests/node/*.test.ts`. The suites are not part of `pnpm test:core`, which runs
Jest only, and they are not counted in the Jest coverage report.

### MCP browser sign-in: `oauth-connections-pg.test.ts`

`tests/node/oauth-connections-pg.test.ts` checks the rules of MCP browser sign-in that the database holds:
the triggers, the unique index and the locks of migration `049_oauth_provider.sql`, and the two modules that rely
on them, `src/lib/mcp/oauth/connection-store.ts` and `src/lib/mcp/oauth/purge.ts`.

**Why it exists.** The Jest suites of those modules (`tests/jest/lib/mcp/oauth/`) mock the queries. They check the
statements a function sends and what it does with the rows it gets back, but they run no trigger and take no
lock. Whether a disconnection and a token renewal that happen at the same moment leave a live token behind is
decided by PostgreSQL, and is only seen with two real connections. The test points `DATABASE_URL` at the throwaway
cluster, then imports the real `src/lib/db`, `connection-store` and `purge`. `connection-store.ts` imports no
project configuration so that this is possible.

**What it covers.** One top-level test with 28 cases (`node --test` reports 29 tests: the cases and the test that holds them):

| # | Case |
| --- | --- |
| 1 | Migration 049 applies on a database with nothing in it, leaves exactly the nine `oauth_*` triggers, and applying it again changes nothing |
| 2 | A refresh token is written only for a connection that has a consent, and holding no more than the consent: a wider token is cut down, and the consent of another team or another client does not count |
| 3 | A connection has one consent: a second row for the same user, client and team is refused (`uq_oauth_consent_connection`) |
| 4 | `disconnect` removes the consent and the tokens and records the revocation; the same client in another team is untouched |
| 5 | A connection with a consent and no refresh token is ended with a revocation of its own |
| 6 | A consent row deleted directly (what Better Auth's `/oauth2/delete-consent` does) takes the tokens with it, and nothing comes back when a new consent is written |
| 7 | A renewal that writes its token first: the disconnection waits for it, then removes that token too |
| 8 | A disconnection that gets there first: the renewal waits for it, then is refused (`oauth connection ended`) |
| 9 | A consent narrowed with an `UPDATE` cuts the live tokens down to it and records a revocation; no token is removed |
| 10 | The token that held more was already replaced when the consent narrows: the revocation is recorded all the same, and widening a consent records nothing |
| 11 | A renewal racing a narrowing, in both orders: the token ends up holding no more than the consent |
| 12 | Permissions taken away between the steps of a renewal: the renewal still leaves a live token, holding less |
| 13 | A connection ended between the steps of a renewal: the renewal leaves nothing |
| 14 | `narrowConnection`: `narrowed`, `unchanged`, `nothing-left` and `not-found`, and what each leaves in the consent and the tokens |
| 15 | `revokeScopeFromConnections` (the function `revoke_oauth_scope`): the scope leaves every consent that holds it, the live tokens are cut down, a connection left with no entity permission is ended, a connection that did not hold it is untouched, and a later renewal does not get it back. Called as the app role, which RLS applies to, it changes nothing. A wildcard or an identity scope is refused |
| 16 | `nextspark mcp:revoke-scope` (the script, run as a process): it reports without `--yes`, says when a tool still needs the scope, refuses a role that cannot see the consents, uses `DATABASE_SERVICE_URL` before `DATABASE_URL`, applies with `--yes`, and refuses what is not one entity scope |
| 17 | `disconnectAs` reads the actor's app role and team role inside the transaction and holds them: it waits for a role change in flight and decides on its result |
| 18 | `othersConnections` reads other members' connections by team and never the reader's own |
| 19 | A suspended account loses its consents with its tokens, and a renewal in flight cannot write a token |
| 20 | A member removed from a team loses the connections to it, and they do not come back when the member does |
| 21 | A consent is written only for a member of the team |
| 22 | A removal that gets there first: the consent being written waits for it, then is refused |
| 23 | A consent that gets there first: the removal waits for it, then takes it away |
| 24 | A change of role does not wait for a consent being written, nor the other way round |
| 25 | A change of role is not a removal: the connection stays |
| 26 | Deleting a team ends every connection to it and leaves the connections to other teams |
| 27 | A user who is deleted takes their connections with them, and nothing fails on the way |
| 28 | `purgeExpiredOAuth` removes what expired and keeps a replaced token until its own expiry; a user's newest revocation stays |

Cases 12 and 13 follow a renewal step by step because Better Auth renews in separate statements: it reads the old
token, marks it replaced, then writes the new one with the scopes it read. The test performs each step itself and
puts the other operation in between.

### Proving lock order with two connections

A test that only checks the final state cannot tell "the second operation waited for the first" from "the second
operation happened to run later". The suite proves the wait itself, with two connections and four steps:

1. Open a transaction on one connection and run the first operation in it, without committing.
2. Start the second operation on another connection and keep its promise.
3. Assert that the promise is still pending after a short time: it is waiting on a lock the first one holds.
4. Commit the first transaction, await the second operation, and assert the outcome.

```typescript
/** Whether a promise is still pending after `ms`: it is waiting on a lock. */
async function stillWaiting(promise: Promise<unknown>, ms = 400): Promise<boolean> {
  const settled = promise.then(() => true, () => true)
  return !(await Promise.race([settled, new Promise<false>(resolve => setTimeout(() => resolve(false), ms))]))
}

// A renewal wrote its token and has not committed yet
await other.query('BEGIN')
await other.query(tokenSql, tokenArgs('u-ana', 'team-1', [...BASE, READ]).args)

// The disconnection starts on another connection...
const ending = store.disconnect('u-ana', CLIENT, 'team-1')
// ...and waits on the consent row the renewal holds
assert.equal(await stillWaiting(ending), true)

await other.query('COMMIT')
assert.equal(await ending, true)
// The token the renewal wrote is gone with the rest
assert.deepEqual(await tokensOf('u-ana', 'team-1'), [])
```

Write each race in both orders (cases 7 and 8, and both halves of case 11): the rule has to hold whichever side
gets the lock first. When the waiting operation is expected to fail, attach a `catch` to its promise before
asserting that it waits, so the rejection is not reported as unhandled, and assert it afterwards with
`assert.rejects`.

### When to add a case

Add a case to `oauth-connections-pg.test.ts`, in the same change, when you:

- add a migration that creates, replaces or drops a trigger, function, index or policy on an OAuth table
  (`oauthConsent`, `oauthRefreshToken`, `oauthAccessToken`, `oauthRevocation`, `oauthTeamSelection`, `jwks` and the
  client tables), or a trigger on `users` or `account` that ends connections;
- change a statement in `connection-store.ts` or `purge.ts`, in particular the order in which rows are locked,
  updated or deleted;
- add a way to end, narrow or renew a connection, or rely on a new step of Better Auth that writes these tables;
- fix a defect that only shows with two operations at once. Write the interleaving that failed, in both orders.

A Jest test with mocked queries is not enough for any of these: it would pass with the trigger missing. The same
applies to the other database rules in core: a change to an RLS policy or a trigger belongs in a `tests/node`
suite built on `cutoverDatabase`.

### The authorization server itself: `mcp-oauth-sign-in.test.ts`

Core's Jest configuration maps `better-auth` and the OAuth packages of the feature (`@better-auth/mcp`,
`@better-auth/cimd`, `@better-auth/oauth-provider/client`, `@better-auth/core/context`) to mocks
(`tests/jest/__mocks__/better-auth-oauth.js`), so the authorization server never runs under Jest. The suite that
runs the real library is `tests/node/mcp-oauth-sign-in.test.ts`: real Better Auth and core's real auth route, in a
child process (`tests/node/fixtures/registration-gates/driver.mts`), against a throwaway cluster, with Google's
token endpoint and the email provider stubbed. Its three tests check that an authorization sends a signed-out
browser to the login page with its signed query, and that a Google sign-in and a sign-in link opened later both
continue that authorization. It needs the same binaries and skips the same way.

The full flow against a running app (discovery, client metadata documents, PKCE, consent, token, refresh,
revocation, a real MCP client) has no suite in the repository. It was run by hand against a deployment, and is the
"connect a real client" step of [MCP Browser Sign-In Deployment](../14-deployment/12-mcp-browser-sign-in.md#8-verify).

For a rule held outside the database, see
[Verifying the shared rate limit with Redis](./12-shared-rate-limit-verification.md).

---

## Best Practices

### ✅ DO

```typescript
// Test real integrations
// Don't mock the layer you're testing

// Use test database
// Separate from production/development

// Clean state between tests
beforeEach(() => cleanDatabase())

// Test critical paths
// Auth + DB, API + DB, UI + API
```

### ❌ DON'T

```typescript
// Test too many layers at once
// Keep integration tests focused

// Share database between tests
// Use fresh state for each test

// Skip integration tests
// They catch real-world issues
```

---

**Last Updated:** 2026-11-22  
**Version:** 1.1.0  
**Status:** In Development
