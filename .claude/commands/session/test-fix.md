---
disable-model-invocation: true
---

# /session:test:fix

Fix failing Cypress tests iteratively until all pass.

**Aliases:** Wrapper for `/session:fix:test` focused on Cypress

---

## Syntax

```
/session:test:fix [--spec <pattern>] [--max-retries <n>]
```

---

## Behavior

Runs Cypress tests, analyzes failures, applies fixes, and retries until all pass.

---

## Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  /session:test:fix                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Run Cypress tests                                           │
│     ↓                                                           │
│  2. Identify failures                                           │
│     ↓                                                           │
│  3. For each failure:                                           │
│     │                                                           │
│     ├─► Selector issue?                                         │
│     │   - Update data-cy in component                           │
│     │   - Update selector in test                               │
│     │                                                           │
│     ├─► Timing issue?                                           │
│     │   - Add cy.wait or cy.intercept                           │
│     │                                                           │
│     ├─► Assertion issue?                                        │
│     │   - Update expected value                                 │
│     │                                                           │
│     └─► Implementation bug?                                     │
│         - Fix source code                                       │
│     ↓                                                           │
│  4. Re-run failed tests                                         │
│     │                                                           │
│     ├─► Still failing: Go to step 3                             │
│     │                                                           │
│     └─► All pass: Run full suite                                │
│     ↓                                                           │
│  5. Report final status                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Example Output

```
🔧 FIX CYPRESS TESTS

─────────────────────────────────────────

📋 ITERATION 1

Running Cypress tests...
❌ 3 tests failing

Failures:
1. [UAT] products.cy.ts:45 - "should upload images"
   Error: Element [data-cy=image-upload] not found

2. [UAT] products.cy.ts:78 - "should filter by category"
   Error: Expected 5, got 3

3. [API] products.cy.ts:23 - "should create with category"
   Error: Expected 201, got 400

─────────────────────────────────────────

🔍 ANALYZING FAILURE 1/3

Test: should upload images
Type: Selector not found

Analysis:
- Component uses: data-cy="upload-image"
- Test expects: data-cy="image-upload"

Action: Update test selector

Fix applied:
```typescript
// Before
cy.get('[data-cy=image-upload]')

// After
cy.get('[data-cy=upload-image]')
```

✓ Test file updated

─────────────────────────────────────────

🔍 ANALYZING FAILURE 2/3

Test: should filter by category
Type: Assertion mismatch

Analysis:
- Sample data has 3 products in "Electronics"
- Test expects 5

Action: Update test data or assertion

Options:
[1] Update assertion to match data (3)
[2] Add more sample data
[3] The data is wrong - fix sample

> 1

Fix applied:
```typescript
// Before
pom.verifyProductCount(5);

// After
pom.verifyProductCount(3);
```

✓ Test file updated

─────────────────────────────────────────

🔍 ANALYZING FAILURE 3/3

Test: should create with category
Type: Implementation bug

Analysis:
- API returns 400: "categoryId required"
- Test sends categoryId correctly
- Bug: API validation not reading categoryId

Action: Fix API implementation

Fix applied in: core/api/v1/products/route.ts:34
```typescript
// Before
const { name, price } = await req.json();

// After
const { name, price, categoryId } = await req.json();
```

✓ Implementation fixed

─────────────────────────────────────────

📋 ITERATION 2

Re-running failed tests...
✓ All 3 previously failed tests now pass

Running full suite...
✓ 20/20 tests passing

─────────────────────────────────────────

📊 SUMMARY

Iterations: 2
Tests fixed: 3
  - 1 selector fix (test)
  - 1 assertion fix (test)
  - 1 implementation fix (source)

Files modified:
├─ cypress/e2e/uat/products.cy.ts (2 changes)
└─ core/api/v1/products/route.ts (1 change)

All tests passing.
```

---

## Fix Categories

| Category | Fix Location | Common Causes |
|----------|--------------|---------------|
| Selector | Test or Component | Changed markup, typo |
| Timing | Test | Async operations, loading |
| Assertion | Test | Changed behavior, data |
| Implementation | Source | Bug in code |

---

## Options

| Option | Description |
|--------|-------------|
| `--spec <pattern>` | Fix specific spec |
| `--max-retries <n>` | Max fix iterations (default: 5) |
| `--test-only` | Only fix test code, not source |
| `--source-only` | Only fix source code |

---

## Related Commands

| Command | Action |
|---------|--------|
| `/session:test:write` | Write new tests |
| `/session:test:run` | Run tests |
| `/session:fix:build` | Fix build errors |
