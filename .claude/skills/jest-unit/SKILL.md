---
name: jest-unit
description: |
  Jest unit testing patterns for this Next.js application.
  Covers test structure, mocking strategies, React component testing, hook testing, and coverage targets.
  Use this skill when writing unit tests for services, hooks, utilities, or components.
allowed-tools: Read, Glob, Grep
version: 1.2.0
---

# Jest Unit Testing Skill

Patterns for writing effective unit tests with Jest and React Testing Library.

## Architecture Overview

```
TEST FILE STRUCTURE:

core/tests/jest/
├── api/                 # API route tests
├── hooks/               # React hooks tests
├── lib/                 # Utility tests
├── components/          # Component tests
├── services/            # Service tests
├── __mocks__/           # Mock utilities
│   ├── db-mocks.ts
│   ├── better-auth.js
│   └── next-server.js
└── setup.ts             # Global configuration

core/tests/node/         # node:test suites (NOT Jest): real processes, real PostgreSQL
├── *.test.ts            # run with `pnpm test:node`
├── *-pg.test.ts         # against a throwaway PostgreSQL cluster
└── _pg-cutover.ts       # cutoverDatabase(): cluster + every core migration

tests/jest/
└── ...                  # Theme-specific tests

plugins/*/__tests__/
└── ...                  # Plugin-specific tests
```

## When to Use This Skill

- Writing unit tests for services
- Testing React hooks
- Testing React components
- Mocking database operations
- Setting up test coverage
- Deciding whether a mocked-query test is enough, or the code needs a real PostgreSQL (`tests/node/*-pg.test.ts`)

---

## Test File Structure

### Naming Conventions

```
*.test.ts   - TypeScript unit tests
*.test.tsx  - React component tests
```

### Standard Test Structure

```typescript
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { functionToTest } from '@nextsparkjs/core/lib/module'

describe('ModuleName', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.clearAllMocks()
    jest.resetModules()
  })

  describe('Feature Group', () => {
    test('should do expected behavior when condition met', () => {
      // Arrange
      const input = 'test-data'

      // Act
      const result = functionToTest(input)

      // Assert
      expect(result).toBe('expected-output')
    })
  })
})
```

---

## Jest Configuration

```typescript
// jest.config.ts
import type { Config } from 'jest'

export const baseConfig: Partial<Config> = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',

  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@nextsparkjs/core/(.*)$': '<rootDir>/core/$1',
    'next/server': '<rootDir>/core/tests/jest/__mocks__/next-server.js',
  },

  setupFilesAfterEnv: ['<rootDir>/core/tests/setup.ts'],
  testTimeout: 10000,
}
```

### Test Scripts

```bash
pnpm test              # Run all core tests
pnpm --dir apps/dev exec jest --watchman=false        # Run theme-specific tests
pnpm test:coverage     # Generate coverage reports
pnpm test:watch        # Watch mode
```

---

## Essential Mocking (Quick Reference)

### Database (MANDATORY)

```typescript
jest.mock('@nextsparkjs/core/lib/db', () => ({
  queryWithRLS: jest.fn(),
  queryOneWithRLS: jest.fn(),
  mutateWithRLS: jest.fn(),
}))

const mockQueryWithRLS = queryWithRLS as jest.MockedFunction<typeof queryWithRLS>

test('example', async () => {
  mockQueryWithRLS.mockResolvedValue([{ id: '123' }])
  // ...
})
```

### Next.js Navigation

```typescript
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))
```

### Translations

```typescript
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}))
```

→ See `references/mocking-patterns.md` for complete mocking strategies

---

## Quick Testing Patterns

### Component Test

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

test('form submission', async () => {
  const user = userEvent.setup()
  render(<MyForm />)

  await user.type(screen.getByLabelText('Email'), 'test@example.com')
  await user.click(screen.getByRole('button', { name: /submit/i }))

  expect(await screen.findByText('Success')).toBeInTheDocument()
})
```

→ See `references/component-testing.md` for complete patterns

### Hook Test

```typescript
import { renderHook, act } from '@testing-library/react'

test('hook state update', () => {
  const { result } = renderHook(() => useCounter())

  act(() => {
    result.current.increment()
  })

  expect(result.current.count).toBe(1)
})
```

→ See `references/service-hook-testing.md` for complete patterns

---

## When Mocked Queries Are Not Enough: `tests/node/*-pg.test.ts`

A Jest test that mocks `@nextsparkjs/core/lib/db` runs no SQL: no trigger fires, no constraint is checked, no
lock is taken. It proves what the code asks the database for, not what the database does. Write a node test
against a real PostgreSQL when the behaviour under test is:

- a **trigger, constraint, unique index or RLS policy** of a migration;
- **two statements** that must be atomic, or **two connections** racing (which one waits, what the loser sees);
- a migration applied **from nothing**, or applied **twice**.

These are `node:test` suites, not Jest. Reference: `packages/core/tests/node/oauth-connections-pg.test.ts`
(the database rules of MCP browser sign-in, see the `mcp-server` skill).

```bash
# from packages/core
pnpm test:node                                             # every node test
npx tsx --test tests/node/oauth-connections-pg.test.ts     # one file
```

### The pattern

```typescript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { cutoverDatabase, HAS_POSTGRES } from './_pg-cutover'

test('the rules the database holds', { skip: !HAS_POSTGRES && 'initdb/pg_ctl not on PATH', timeout: 300000 }, async t => {
  // Throwaway cluster, every core migration applied from nothing (no sample data); stopped by t.after
  const db = await cutoverDatabase(t)

  // Load the REAL module against it: set the env before the dynamic import
  process.env.DATABASE_URL = db.ownerUrl
  delete process.env.DATABASE_SERVICE_URL
  const core = await import('../../src/lib/db')
  const store = await import('../../src/lib/mcp/oauth/connection-store')
  t.after(() => core.pool.end())

  // A second client, to hold a transaction open while the code under test runs
  const other = new pg.Client({ connectionString: db.ownerUrl })
  other.on('error', () => {})
  await other.connect()
  t.after(() => other.end())

  await t.test('a disconnection waits for a renewal in flight', async () => {
    await other.query('BEGIN')
    // ... `other` writes a row and keeps its transaction open
    const ending = store.disconnect('u-1', 'client', 'team-1')
    assert.equal(await stillWaiting(ending), true)   // blocked on the lock
    await other.query('COMMIT')
    assert.equal(await ending, true)                 // then it goes on
  })
})
```

- **Throwaway cluster**: `cutoverDatabase(t)` (`tests/node/_pg-cutover.ts`) starts one with `startCluster`
  (`scripts/test/throwaway-postgres.cjs`), applies every file of `packages/core/migrations` except
  `090_sample_data.sql`, and returns `owner` and `app` clients with `ownerUrl` / `appUrl`. It never touches the
  database of `DATABASE_URL`.
- **`HAS_POSTGRES` needs three binaries on the PATH: `initdb`, `pg_ctl` and `postgres`.** Client-only installs
  (Homebrew's `libpq`) have the first two and not the server, so the suite is skipped there. A skipped suite
  is not a pass: say so when you report results, and run it where the server is installed.
- **Two clients to prove lock ordering.** Assert that a promise is still pending after a short wait (the
  `stillWaiting` helper in the reference test), release the other transaction, then assert the outcome. Test
  both orders of a race.
- **Migrations from nothing, and again.** Re-run the migration file on the migrated database and assert it
  changes nothing: it proves the file is idempotent.
- **Real Better Auth in a child process** when the library's own behaviour is under test:
  `tests/node/mcp-oauth-sign-in.test.ts` drives `tests/node/fixtures/registration-gates/driver.mts`.

### Keep the module loadable

A node test imports the real source file with `tsx`, without the Jest module mapper and without a built
project. A module that imports project configuration (`@nextsparkjs/registries/*`, `lib/config/config-client`)
cannot be loaded that way. So the database half of a feature lives in a module with no such import:
`src/lib/mcp/oauth/connection-store.ts` imports only `lib/db` and a pure helper, and the half that needs the
permission registry is in `connections.ts`, which passes its decision in as a callback (`disconnectAs`).
Split a module the same way before you conclude it cannot be integration-tested.

---

## Coverage Targets

| Category | Target | Notes |
|----------|--------|-------|
| **Critical Paths** | 90%+ | Auth, API, Validation |
| **Features** | 80%+ | UI, Business Logic |
| **Utilities** | 80%+ | Helpers, Services |
| **Components** | 70%+ | UI Components |

---

## Common Assertions

```typescript
// Equality
expect(result).toBe('expected')
expect(result).toEqual({ id: '123' })

// Truthiness
expect(result).toBeTruthy()
expect(result).toBeNull()
expect(result).toBeDefined()

// Collections
expect(array).toHaveLength(2)
expect(array).toContain('item')
expect(obj).toHaveProperty('key')

// DOM (Testing Library)
expect(element).toBeInTheDocument()
expect(element).toHaveClass('className')
expect(element).toBeVisible()
expect(element).toBeDisabled()

// Mocks
expect(mockFn).toHaveBeenCalled()
expect(mockFn).toHaveBeenCalledWith('arg')
expect(mockFn).toHaveBeenCalledTimes(1)
```

---

## Anti-Patterns

```typescript
// ❌ NEVER: Test implementation details
expect(result.current._internalState).toBe('value')

// ✅ CORRECT: Test observable behavior
expect(result.current.displayValue).toBe('value')

// ❌ NEVER: Skip cleanup
// No afterEach → leaks between tests

// ✅ CORRECT: Always cleanup
afterEach(() => jest.clearAllMocks())

// ❌ NEVER: Async without await
fetchData().then(data => expect(data).toBeDefined())

// ✅ CORRECT: Properly await
const data = await fetchData()
expect(data).toBeDefined()

// ❌ NEVER: Use fireEvent for user actions
fireEvent.change(input, { target: { value: 'text' } })

// ✅ CORRECT: Use userEvent
await user.type(input, 'text')
```

---

## Checklist

Before finalizing unit tests:

- [ ] All database calls mocked (queryWithRLS, mutateWithRLS)
- [ ] External APIs mocked (fetch)
- [ ] Next.js functions mocked (useRouter, useSearchParams)
- [ ] afterEach cleanup with jest.clearAllMocks()
- [ ] Async tests properly awaited
- [ ] Test both success and error paths
- [ ] Edge cases covered (null, empty, invalid input)
- [ ] Coverage targets met (90%+ critical, 80%+ features)
- [ ] Test names are descriptive
- [ ] Triggers, constraints, locks and multi-statement atomicity are covered by a `tests/node/*-pg.test.ts`
      case, not by a mocked-query test; the run was not skipped (`HAS_POSTGRES`)

---

## References

- `references/mocking-patterns.md` - Complete mocking strategies
- `references/component-testing.md` - React component testing patterns
- `references/service-hook-testing.md` - Service and hook testing patterns

## Related Skills

- `mcp-server` - The feature whose database rules `oauth-connections-pg.test.ts` covers
- `database-migrations` - Invariants as triggers, idempotent migrations
- `cypress-e2e` - Integration/E2E testing
- `cypress-api` - API testing with Cypress
- `zod-validation` - Schema validation testing
- `service-layer` - Service patterns to test
