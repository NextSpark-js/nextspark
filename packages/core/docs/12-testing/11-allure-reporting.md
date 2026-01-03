# Allure Reporting

## Introduction

Allure provides rich HTML reports with interactive dashboards, test history, and detailed failure analysis. It transforms test results into a comprehensive report that stakeholders can navigate without technical knowledge.

**Benefits over console output:**
- Interactive test result browsing
- Screenshots and videos embedded
- Test execution timeline
- Historical trends (when preserved)
- Shareable HTML format

---

## Labels System

Allure uses labels to organize tests into a navigable hierarchy. The project uses four primary labels:

### Label Hierarchy

```text
Epic: API
├── Feature: Customers
│   ├── Story: CRUD Operations
│   │   └── severity: critical
│   └── Story: Validation
│       └── severity: normal
├── Feature: Users
│   └── Story: Security
│       └── severity: critical
└── Feature: API Keys
    └── Story: CRUD Operations
        └── severity: normal

Epic: UAT
├── Feature: Customers
│   ├── Story: Owner Permissions
│   └── Story: Member Permissions
├── Feature: Authentication
│   ├── Story: Login
│   └── Story: Logout
└── Feature: Teams
    └── Story: Switcher
```

### Label Reference

| Label | Purpose | Values |
|-------|---------|--------|
| `epic` | Test layer | `API`, `UAT` |
| `feature` | Entity/area | `Customers`, `Tasks`, `Authentication` |
| `story` | Operation type | `CRUD Operations`, `Permissions`, `Workflow` |
| `severity` | Priority level | `critical`, `normal`, `minor`, `trivial` |

---

## Correlation with Cypress Grep Tags

The project uses **two complementary systems** that share a common vocabulary:

1. **Cypress Grep** - Filters which tests to execute via tags
2. **Allure Labels** - Organizes test results in reports

### Design Principle

Both systems intentionally share terminology. This correlation enables:
- **Unified mental model** - Same vocabulary to describe the product
- **Report navigation** - Find specific test results using familiar terms
- **Execution filtering** - Select tests using the same concepts you see in reports
- **Team communication** - QA, developers, and stakeholders speak the same language

### Visual Correlation

```text
┌───────────────────────────────────────────────────────────────────────┐
│                     UNIFIED MENTAL MODEL                              │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│   CYPRESS GREP (Execution)          ALLURE (Reporting)               │
│   ───────────────────────          ──────────────────                │
│                                                                       │
│   @api ─────────────────────────── epic: API                         │
│   @uat ─────────────────────────── epic: UAT                         │
│                                                                       │
│   @feat-customers ──────────────── feature: Customers                │
│   @feat-tasks ──────────────────── feature: Tasks                    │
│                                                                       │
│   @crud ────────────────────────── story: CRUD Operations            │
│   @security ────────────────────── story: Security                   │
│   @workflow ────────────────────── story: Workflow                   │
│                                                                       │
│   @smoke ───────────────────────── severity: critical                │
│   @sanity ──────────────────────── severity: normal                  │
│   @regression ──────────────────── (execution scope)                 │
│                                                                       │
│   Same vocabulary → Same mental model → Better collaboration         │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### Mapping Table

| Cypress Grep Tag | Allure Label | Type |
|------------------|--------------|------|
| `@api` | `epic: API` | Layer |
| `@uat` | `epic: UAT` | Layer |
| `@feat-customers` | `feature: Customers` | Feature |
| `@feat-tasks` | `feature: Tasks` | Feature |
| `@crud` | `story: CRUD Operations` | Operation |
| `@security` | `story: Security` | Operation |
| `@smoke` | `severity: critical` | Priority |
| `@regression` | (no direct mapping) | Priority |

### Example: Unified Approach

When you tag a test with `@feat-customers` and call `allure.feature('Customers')`, you're creating a bridge between what you execute and what you analyze.

```typescript
// Tag for execution filtering
describe('Customers API - CRUD', {
  tags: ['@api', '@feat-customers', '@crud', '@regression']
}, () => {

  beforeEach(() => {
    // Labels for report organization
    allure.epic('API')
    allure.feature('Customers')
  })

  it('CUST_API_001: Should create customer', { tags: '@smoke' }, () => {
    allure.story('CRUD Operations')
    allure.severity('critical')
    // test code...
  })
})
```

**Result:**
- Run with `grepTags=@feat-customers` → Only customer tests execute
- View report → Navigate to Epic: API → Feature: Customers → Story: CRUD Operations

---

## Setup

### Dependencies

The project uses `allure-cypress` for Cypress integration:

```bash
# Already installed in project
pnpm add -D allure-cypress
```

### cypress.config.ts Configuration

Each theme configures Allure in its Cypress config:

```typescript
// contents/themes/{theme}/tests/cypress.config.ts
import { defineConfig } from 'cypress'
import path from 'path'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',

    setupNodeEvents(on, config) {
      const { allureCypress } = require('allure-cypress/reporter')

      allureCypress(on, config, {
        resultsDir: path.join(__dirname, 'cypress/allure-results'),
      })

      return config
    },
  },
})
```

### Support File Integration

Import Allure in the shared support file:

```typescript
// core/tests/cypress/support/allure.ts
/// <reference types="cypress" />
// allure-cypress auto-registers commands
```

```typescript
// core/tests/cypress/support/e2e.ts
import './allure'
```

---

## Using Allure in Tests

### API Test Pattern

```typescript
import * as allure from 'allure-cypress'

describe('Customers API - CRUD', {
  tags: ['@api', '@feat-customers', '@crud', '@regression']
}, () => {

  beforeEach(() => {
    allure.epic('API')
    allure.feature('Customers')
  })

  describe('POST /api/v1/customers', { tags: '@smoke' }, () => {

    it('CUST_API_010: Should create customer with valid data', {
      tags: '@smoke'
    }, () => {
      allure.story('CRUD Operations')
      allure.severity('critical')

      // Add step descriptions for clarity in report
      allure.step('Prepare test data', () => {
        // setup...
      })

      allure.step('Send POST request', () => {
        cy.request('POST', '/api/v1/customers', testData)
      })

      allure.step('Verify response', () => {
        // assertions...
      })
    })
  })
})
```

### UAT Test Pattern

```typescript
import * as allure from 'allure-cypress'

describe('Customers - Owner Role', {
  tags: ['@uat', '@feat-customers', '@crud', '@role-owner', '@regression']
}, () => {

  beforeEach(() => {
    allure.epic('UAT')
    allure.feature('Customers')
    allure.story('Owner Permissions')
    // login...
  })

  describe('CREATE', { tags: '@smoke' }, () => {

    it('OWNER_CREATE_001: Should create new customer', {
      tags: '@smoke'
    }, () => {
      allure.severity('critical')
      // test code...
    })
  })

  describe('DELETE', () => {

    it('OWNER_DELETE_001: Should delete customer', () => {
      allure.severity('normal')
      // test code...
    })
  })
})
```

---

## Generating Reports

### Local Development

After running tests:

```bash
# Generate HTML report from results
npx allure generate contents/themes/default/tests/cypress/allure-results \
  -o contents/themes/default/tests/cypress/allure-report --clean

# Open report in browser
npx allure open contents/themes/default/tests/cypress/allure-report
```

### One-liner

```bash
NEXT_PUBLIC_ACTIVE_THEME=default pnpm cy:run && \
npx allure generate contents/themes/default/tests/cypress/allure-results \
  -o contents/themes/default/tests/cypress/allure-report --clean && \
npx allure open contents/themes/default/tests/cypress/allure-report
```

### CI Integration

In GitHub Actions (from `cypress-regression.yml`):

```yaml
- name: Run Cypress tests
  uses: cypress-io/github-action@v6
  with:
    config-file: contents/themes/default/tests/cypress.config.ts

- name: Generate Allure Report
  if: always()
  run: |
    npx allure generate contents/themes/default/tests/cypress/allure-results \
      -o contents/themes/default/tests/cypress/allure-report --clean

- name: Upload Allure Report
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: allure-report
    path: contents/themes/default/tests/cypress/allure-report
```

---

## Output Directories

```text
contents/themes/{theme}/tests/cypress/
├── allure-results/        # Raw data (gitignored)
│   ├── {uuid}-result.json
│   ├── {uuid}-container.json
│   └── ...
└── allure-report/         # HTML report (gitignored)
    ├── index.html
    ├── data/
    └── ...
```

Both directories are gitignored as they're generated artifacts.

---

## Report Structure

### Overview Dashboard

- **Test execution summary** - Pass/fail/skip counts
- **Duration** - Total and per-test timing
- **Categories** - Grouped by failure type
- **Severity breakdown** - Critical vs normal distribution

### Suites View

Navigate the test hierarchy:
```text
Epic → Feature → Story → Test Case
```

### Timeline View

Visualize test execution order and parallelism.

### Graphs View

- **Status trend** - Historical pass/fail rates
- **Duration trend** - Performance over time
- **Categories trend** - Failure patterns

### Packages View

Tests organized by file path.

---

## Best Practices

### Severity Guidelines

| Severity | When to use | Allure call |
|----------|-------------|-------------|
| `critical` | Smoke tests, core functionality | `allure.severity('critical')` |
| `normal` | Standard features, CRUD | `allure.severity('normal')` |
| `minor` | Edge cases, validations | `allure.severity('minor')` |
| `trivial` | UI polish, nice-to-have | `allure.severity('trivial')` |

### Naming Conventions

```typescript
// Test IDs for traceability
it('CUST_API_001: Should list all customers', () => {})
it('USER_SEC_010: Superadmin should get 200', () => {})

// Descriptive story names
allure.story('CRUD Operations')
allure.story('Permission Validation')
allure.story('Bulk Operations')
```

### Step Descriptions

Use steps for complex tests:

```typescript
it('should complete checkout flow', () => {
  allure.step('Add item to cart', () => {
    // ...
  })

  allure.step('Enter shipping info', () => {
    // ...
  })

  allure.step('Process payment', () => {
    // ...
  })

  allure.step('Verify confirmation', () => {
    // ...
  })
})
```

---

## Troubleshooting

### Results not generated

1. Check `setupNodeEvents` in cypress.config.ts calls `allureCypress()`
2. Verify `resultsDir` path is correct
3. Ensure `allure-cypress` is imported in support file

### Report empty

```bash
# Verify results exist
ls contents/themes/default/tests/cypress/allure-results/
# Should see *.json files
```

### Labels not appearing

Ensure Allure calls are made in test body:

```typescript
// ✅ Correct - in beforeEach or test
beforeEach(() => {
  allure.epic('API')
  allure.feature('Customers')
})

// ❌ Wrong - outside test context
allure.epic('API')  // Won't be captured
describe('Test', () => { ... })
```

### Clear and regenerate

```bash
# Remove old results
rm -rf contents/themes/default/tests/cypress/allure-results/*

# Run tests fresh
pnpm cy:run

# Generate report
npx allure generate ...
```

---

## Quick Reference

| Task | Command |
|------|---------|
| Run tests | `pnpm cy:run` |
| Generate report | `npx allure generate {results-dir} -o {report-dir} --clean` |
| Open report | `npx allure open {report-dir}` |
| Clear results | `rm -rf cypress/allure-results/*` |

### Allure API

```typescript
import * as allure from 'allure-cypress'

allure.epic('API')              // Top-level grouping
allure.feature('Customers')     // Feature/entity
allure.story('CRUD Operations') // Specific operation
allure.severity('critical')     // Priority level

allure.step('Description', () => {
  // grouped actions
})

allure.attachment('name', content, 'text/plain')
allure.link('http://...', 'Related Issue')
```

---

## Next Steps

- [Tag Validation System](./09-tag-validation-system.md) - Tag management
- [CI Workflow Templates](./10-ci-workflows.md) - Automated reporting
- [E2E Testing with Cypress](./03-e2e-testing-cypress.md) - Full Cypress guide

---

**Last Updated:** 2025-12-13
**Version:** 1.0.0
**Status:** Complete
