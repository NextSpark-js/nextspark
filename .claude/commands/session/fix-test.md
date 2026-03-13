---
disable-model-invocation: true
---

# /session:fix:test

Fix failing tests automatically.

---

## Syntax

```
/session:fix:test [--spec <pattern>] [--max-iterations <n>]
```

---

## Behavior

Runs tests, analyzes failures, and fixes them iteratively until all pass.

---

## Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  /session:fix:test                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Run test suite                                              │
│     ↓                                                           │
│  2. Parse failures                                              │
│     - Unit tests (Jest)                                         │
│     - API tests (Cypress)                                       │
│     - UAT tests (Cypress)                                       │
│     ↓                                                           │
│  3. Analyze each failure                                        │
│     - Is it test code issue?                                    │
│     - Is it implementation bug?                                 │
│     ↓                                                           │
│  4. Apply fix                                                   │
│     - Update test assertion                                     │
│     - Fix implementation                                        │
│     - Update selectors                                          │
│     ↓                                                           │
│  5. Re-run failed tests                                         │
│     │                                                           │
│     ├─► Still failing: Go to step 3                             │
│     │                                                           │
│     └─► All pass: Done                                          │
│     ↓                                                           │
│  6. Show summary                                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Example Output

```
🧪 FIX FAILING TESTS

─────────────────────────────────────────

📋 ITERATION 1

Running tests...
❌ 3 of 15 tests failing

Failures:
1. [Jest] ProductsService.test.ts
   "should calculate price with discount"
   Expected: 90, Received: 89.99

2. [Cypress API] products.cy.ts
   "POST /products - should create product"
   Expected status 201, got 400

3. [Cypress UAT] products.cy.ts
   "should display product list"
   Element [data-cy=product-row] not found

─────────────────────────────────────────

🔍 ANALYZING FAILURES

[1/3] ProductsService.test.ts - Price calculation
      Analysis: Floating point precision issue
      Type: Test assertion needs update
      Fix: Use toBeCloseTo instead of toBe

[2/3] products.cy.ts - POST /products
      Analysis: Missing required field 'categoryId'
      Type: Test data incomplete
      Fix: Add categoryId to test fixture

[3/3] products.cy.ts - Display list
      Analysis: Selector changed in implementation
      Type: Test selector outdated
      Fix: Update from [data-cy=product-row] to [data-cy=products-row]

─────────────────────────────────────────

🔧 APPLYING FIXES

[1/3] ProductsService.test.ts
      ✓ Updated assertion to use toBeCloseTo(90, 2)

[2/3] products.cy.ts (API)
      ✓ Added categoryId to fixture

[3/3] products.cy.ts (UAT)
      ✓ Updated selector

─────────────────────────────────────────

📋 ITERATION 2

Running failed tests...
✓ All 3 tests now passing

Running full suite...
✓ 15/15 tests passing

─────────────────────────────────────────

📊 SUMMARY

Iterations: 2
Tests fixed: 3
Files modified: 2
  - ProductsService.test.ts
  - products.cy.ts

All tests passing.
```

---

## Test Types Handled

| Type | Runner | Fix Approach |
|------|--------|--------------|
| Unit Tests | Jest | Update assertions, fix mocks |
| API Tests | Cypress | Fix endpoints, update fixtures |
| UAT Tests | Cypress | Update selectors, fix flows |

---

## Fix vs Implementation Bug

```
🔍 FAILURE ANALYSIS

Test: "should return products for authenticated user"

Analysis:
This appears to be an IMPLEMENTATION BUG, not a test issue.

Evidence:
- Test was passing before
- Recent change to ProductsService
- Error: "Unauthorized" when should succeed

Recommended action:
Fix implementation in ProductsService.ts:45

Proceed with implementation fix? [Yes/Fix test instead]
```

---

## Options

| Option | Description |
|--------|-------------|
| `--spec <pattern>` | Run specific test files |
| `--max-iterations <n>` | Max fix attempts (default: 5) |
| `--unit-only` | Only fix Jest tests |
| `--e2e-only` | Only fix Cypress tests |

---

## Related Commands

| Command | Action |
|---------|--------|
| `/session:fix:build` | Fix build errors |
| `/session:fix:bug` | Fix reported bug |
| `/session:validate` | Full validation |
