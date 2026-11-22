# Test Coverage

## Introduction

Test coverage measures how much of your code is executed during tests. While **100% coverage doesn't guarantee quality**, good coverage helps identify untested critical paths.

---

## Coverage Metrics

### Understanding Coverage

```typescript
const COVERAGE_METRICS = {
  statements: 'Percentage of statements executed',
  branches: 'Percentage of if/else branches tested',
  functions: 'Percentage of functions called',
  lines: 'Percentage of lines executed',
}
```

---

## Generating Coverage Reports

### Jest Coverage

```bash
# Generate coverage report
pnpm --filter @nextsparkjs/core test:coverage

# View HTML report
open packages/core/coverage/lcov-report/index.html

# Coverage for specific files
pnpm --filter @nextsparkjs/core test:coverage --collectCoverageFrom="src/lib/**/*.ts"
```

### Coverage Output

```bash
-----------------|---------|----------|---------|---------|
File             | % Stmts | % Branch | % Funcs | % Lines |
-----------------|---------|----------|---------|---------|
All files        |   75.23 |    68.45 |   81.20 |   74.89 |
 lib/            |   82.15 |    75.30 |   88.50 |   81.75 |
  utils.ts       |   90.00 |    85.00 |   95.00 |   89.50 |
  validation.ts  |   75.00 |    65.00 |   80.00 |   74.00 |
 hooks/          |   68.50 |    60.20 |   75.00 |   67.80 |
  useDebounce.ts |   85.00 |    80.00 |   90.00 |   84.50 |
-----------------|---------|----------|---------|---------|
```

---

## Coverage Goals

### Target Levels

```typescript
const COVERAGE_TARGETS = {
  critical: {
    level: '90%+',
    areas: [
      'Authentication logic',
      'Payment processing',
      'Data mutations',
      'Permission checks',
    ]
  },
  
  important: {
    level: '80%+',
    areas: [
      'API endpoints',
      'Form validation',
      'Business logic',
      'Entity operations',
    ]
  },
  
  general: {
    level: '70%+',
    areas: [
      'Utilities',
      'Helpers',
      'Formatting',
      'UI components',
    ]
  },
  
  overall: {
    target: '75%',
    current: '35%',
    status: '⚠️ In Progress'
  }
}
```

---

## Improving Coverage

### Identify Gaps

```bash
# View uncovered lines in report
# Red highlights = not covered
# Green highlights = covered
open packages/core/coverage/lcov-report/index.html
```

### Add Missing Tests

```typescript
// Found uncovered code:
// utils.ts line 45-50 not covered

// Add test:
describe('utils', () => {
  it('should handle edge case from line 45-50', () => {
    const result = handleEdgeCase()
    expect(result).toBeDefined()
  })
})
```

---

## Coverage in CI/CD

### Enforce Minimum Coverage

```yaml
# .github/workflows/test.yml
- name: Test with coverage
  run: pnpm --filter @nextsparkjs/core test:coverage --coverageThreshold='{"global":{"branches":70,"functions":80,"lines":75,"statements":75}}'
```

### Coverage Badges

```markdown
# README.md
![Coverage](https://img.shields.io/badge/coverage-75%25-yellow)
```

---

## What the Coverage Report Does Not Include

`pnpm --filter @nextsparkjs/core test:coverage` is `jest --coverage`: it measures the lines of `src/**/*.{ts,tsx}`
that the Jest suites execute. Two kinds of checks are outside it.

**The `node:test` suites.** The files in `packages/core/tests/node` run with `tsx`, not Jest, so what they execute
adds nothing to the report. A module can show low Jest coverage and still be exercised there, and the reverse.

**Rules that live in the database.** A trigger, a policy, a unique index or a lock is SQL in a migration, not a
line of TypeScript, so no coverage number describes it. The Jest suites of the modules that rely on such rules
mock the queries: they can reach 100% of the module's lines while the trigger they depend on is never run. The
case of MCP browser sign-in:

| Code | Jest (in the report) | What checks the database rule |
| --- | --- | --- |
| `src/lib/mcp/oauth/connection-store.ts`, `purge.ts` | `tests/jest/lib/mcp/oauth/connections.test.ts`, `purge.test.ts`, with the queries mocked | `tests/node/oauth-connections-pg.test.ts`: 18 cases against a real PostgreSQL with migration 048 applied |
| `src/lib/api/rate-limit.ts` (`credentialRateLimitResponse`) | `tests/jest/lib/api/credential-rate-limit.test.ts`, with the shared store mocked | A run against a deployment with a real Redis, by hand |

Read a coverage number for these modules as "the TypeScript was executed", not as "the rule holds". See
[Integration Testing](./07-integration-testing.md#mcp-browser-sign-in-oauth-connections-pgtestts) and
[Verifying the shared rate limit with Redis](./12-shared-rate-limit-verification.md).

---

## What NOT to Test

### Skip Low-Value Tests

```typescript
// ❌ Don't test:
// - Third-party libraries
// - Framework code
// - Generated files (registries)
// - Simple getters/setters
// - Type definitions

// ✅ Do test:
// - Business logic
// - Data transformations
// - Validations
// - Edge cases
// - Error handling
```

---

## Best Practices

### ✅ DO

```typescript
// Focus on critical paths first
// 90%+ coverage on auth, payments

// Test behavior, not implementation
// Coverage follows good tests

// Use coverage to find gaps
// Not as a goal itself

// Set realistic targets
// 75% overall is good
```

### ❌ DON'T

```typescript
// Chase 100% coverage blindly
// Diminishing returns after ~80%

// Write tests just for coverage
// Write meaningful tests

// Ignore uncovered critical code
// Low coverage on auth = danger

// Test trivial code
// Focus on what matters
```

---

## Current Status

### Coverage Progress

```typescript
const CURRENT_COVERAGE = {
  date: '2025-11-20',
  overall: '35%',
  
  by_area: {
    'core/lib/utils': '65%',
    'core/lib/db': '45%',
    'core/hooks': '40%',
    'core/components': '20%',
    'api': '50%',
  },
  
  priority: [
    '1. Increase auth coverage to 90%',
    '2. Cover all API endpoints (80%)',
    '3. Test critical hooks (80%)',
    '4. Cover entity operations (75%)',
  ],
  
  target_date: 'Q1 2025',
  target_coverage: '75%',
}
```

---

## Quick Reference

```bash
# Generate coverage
pnpm --filter @nextsparkjs/core test:coverage

# Watch mode with coverage
pnpm --filter @nextsparkjs/core test:watch --coverage

# Coverage for changed files only
pnpm --filter @nextsparkjs/core test:coverage --changedSince=main

# View HTML report
open packages/core/coverage/lcov-report/index.html
```

---

**Last Updated:** 2025-11-20  
**Version:** 1.0.0  
**Status:** In Development  
**Current Coverage:** ~35%  
**Target:** 75%
