# /session:test:run

Execute Cypress test suite with options for specific tests or full run.

---

## Syntax

```
/session:test:run [--spec <pattern>] [--tags <tags>]
```

---

## Behavior

Runs Cypress tests and reports results with detailed analysis.

---

## Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  /session:test:run                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Determine tests to run                                      │
│     - All tests, or filtered                                    │
│     ↓                                                           │
│  2. Start dev server (if not running)                           │
│     ↓                                                           │
│  3. Execute Cypress tests                                       │
│     ↓                                                           │
│  4. Collect results                                             │
│     - Passed/Failed/Skipped                                     │
│     - Screenshots on failure                                    │
│     ↓                                                           │
│  5. Analyze failures (if any)                                   │
│     ↓                                                           │
│  6. Report summary                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Example Output

```
🧪 RUN TESTS

─────────────────────────────────────────

🚀 STARTING TEST RUN

Server: http://localhost:3000 ✓
Browser: Chrome (headless)
Spec pattern: cypress/e2e/**/*.cy.ts

─────────────────────────────────────────

📋 EXECUTING TESTS

API Tests:
├─ products.cy.ts
│  ├─ ✓ should create a product (1.2s)
│  ├─ ✓ should get product by ID (0.8s)
│  ├─ ✓ should update product (0.9s)
│  ├─ ✓ should delete product (0.7s)
│  ├─ ✓ should work with API key (1.1s)
│  └─ ✓ should reject unauthenticated (0.5s)

UAT Tests:
├─ products.cy.ts
│  ├─ ✓ should create a new product (3.2s)
│  ├─ ❌ should upload product images (timeout)
│  ├─ ✓ should assign categories (2.1s)
│  ├─ ✓ should display with pagination (2.5s)
│  └─ ✓ should show for team members (1.8s)

─────────────────────────────────────────

❌ FAILURE ANALYSIS

Test: should upload product images
File: cypress/e2e/uat/products.cy.ts:45

Error:
Timed out waiting for element: [data-cy=image-upload]

Screenshot: cypress/screenshots/products-upload-fail.png

Possible causes:
1. Element not rendered (check component)
2. Selector changed (verify data-cy)
3. Async loading issue (add wait)

─────────────────────────────────────────

📊 SUMMARY

Passed:  10
Failed:  1
Skipped: 0

Duration: 14.8s

Coverage:
├─ API: 100% (6/6)
└─ UAT: 80% (4/5)

─────────────────────────────────────────

Options:
[1] Fix failing test (/session:test:fix)
[2] View failure screenshot
[3] Re-run failed test only
```

---

## Run with Tags

```
/session:test:run --tags @api
```

Output:

```
🧪 RUN TESTS

Filter: @api tag only

─────────────────────────────────────────

📋 EXECUTING TESTS

Specs matching @api: 3 files
Tests matching @api: 18 tests

├─ products.cy.ts (6 tests)
│  ├─ ✓ @api @crud should create
│  ├─ ✓ @api @crud should read
│  └─ ...
├─ categories.cy.ts (6 tests)
└─ users.cy.ts (6 tests)

─────────────────────────────────────────

📊 SUMMARY

Passed:  18
Failed:  0

Duration: 8.2s

All @api tests passing.
```

---

## Run Specific Spec

```
/session:test:run --spec "cypress/e2e/uat/products.cy.ts"
```

---

## Options

| Option | Description |
|--------|-------------|
| `--spec <pattern>` | Run specific spec files |
| `--tags <tags>` | Filter by grep tags |
| `--headed` | Run with visible browser |
| `--record` | Record to Cypress Cloud |
| `--parallel` | Run in parallel |

---

## Test Tags Reference

| Tag | Description |
|-----|-------------|
| `@api` | API tests |
| `@uat` | UAT tests |
| `@crud` | CRUD operations |
| `@auth` | Authentication tests |
| `@smoke` | Smoke tests (critical path) |
| `@regression` | Full regression suite |

---

## Related Commands

| Command | Action |
|---------|--------|
| `/session:test:write` | Write new tests |
| `/session:test:fix` | Fix failing tests |
| `/session:validate` | Full validation |
