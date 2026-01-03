# Tag Validation System

## Introduction

The Tag Validation System ensures that Cypress test tags are consistent and traceable across the codebase. Validation happens **automatically during the registry build** - no separate validation step required.

**Key Benefits:**
- **Automatic** - Tags are discovered and validated during `node core/scripts/build/registry.mjs`
- **Zero Configuration** - No opt-in files or manual registration needed
- **TypeScript Registry** - All tags exported in `testing-registry.ts` for type-safe access
- **Build-time Validation** - Invalid tags fail the build immediately

---

## How It Works

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AUTOMATIC TAG VALIDATION                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   1. Registry Build                2. Tag Discovery              3. Output  │
│   ┌─────────────┐                 ┌─────────────┐           ┌─────────────┐ │
│   │  registry   │───────────────▶ │  Scan all   │─────────▶ │  testing-   │ │
│   │  .mjs       │                 │  .cy.ts     │           │  registry   │ │
│   │             │                 │  files      │           │  .ts        │ │
│   └─────────────┘                 └─────────────┘           └─────────────┘ │
│                                          │                                  │
│                                          ▼                                  │
│                                   ┌─────────────┐                           │
│                                   │  Validate   │                           │
│                                   │  against    │                           │
│                                   │  configs    │                           │
│                                   └─────────────┘                           │
│                                          │                                  │
│                                          ▼                                  │
│                                   Build fails if                            │
│                                   invalid tags found                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Output: testing-registry.ts

The registry builder generates `core/lib/registries/testing-registry.ts` with:

```typescript
// Features with test coverage
export const FEATURE_REGISTRY: Record<string, FeatureEntry> = {
  customers: {
    key: "customers",
    name: "Customers",
    tag: "feat-customers",
    testing: {
      hasTests: true,
      testCount: 4,
      files: ["cypress/e2e/api/customers-crud.cy.ts", ...]
    }
  },
  // ...
}

// All discovered tags organized by category
export const TAGS_REGISTRY = {
  features: { customers: { tag: "@feat-customers", testCount: 4, files: [...] } },
  flows: { onboarding: { tag: "@flow-onboarding", testCount: 2, files: [...] } },
  blocks: { hero: { tag: "@b-hero", testCount: 1, files: [...] } },
  layers: { uat: { tag: "@uat", testCount: 40, files: [...] } },
  priorities: { smoke: { tag: "@smoke", testCount: 42, files: [...] } },
  roles: { member: { tag: "@role-member", testCount: 3, files: [...] } },
  operations: { crud: { tag: "@crud", testCount: 11, files: [...] } },
  other: { /* miscellaneous tags */ }
} as const

// Coverage summary
export const COVERAGE_SUMMARY = {
  theme: 'default',
  features: { total: 13, withTests: 11, withoutTests: 2 },
  flows: { total: 3, withTests: 0, withoutTests: 3 },
  tags: { total: 59, testFiles: 87 }
} as const
```

---

## Tag Categories

| Category | Prefix | Example | Validated Against |
|----------|--------|---------|-------------------|
| Feature | `feat-` | `@feat-customers` | `features.config.ts` |
| Flow | `flow-` | `@flow-onboarding` | `flows.config.ts` |
| Block | `b-` | `@b-hero` | `block-registry.ts` |
| Layer | - | `@api`, `@uat` | Built-in |
| Priority | - | `@smoke`, `@regression` | Built-in |
| Role | `role-` | `@role-owner` | Built-in |
| Operation | - | `@crud`, `@security` | Built-in |

---

## Validation Rules

The build validates:

1. **Feature tags** (`@feat-*`) must match a key in `features.config.ts`
2. **Flow tags** (`@flow-*`) must match a key in `flows.config.ts`
3. **Block tags** (`@b-*`) must match a block in `block-registry.ts`

If validation fails, the build exits with an error:

```text
❌ Feature/Flow tag validation errors:
   ❌ Unknown feature tag @feat-unknown
      → contents/themes/default/tests/cypress/e2e/some-test.cy.ts
```

---

## Running Tests by Tag

Use `@cypress/grep` to filter which tests execute:

```bash
# Run smoke tests only
pnpm cypress:run --env grepTags=@smoke

# Run API tests
pnpm cypress:run --env grepTags=@api

# Run feature-specific tests
pnpm cypress:run --env grepTags=@feat-customers

# Combine tags (AND logic)
pnpm cypress:run --env grepTags=@api+@smoke

# Exclude tags
pnpm cypress:run --env grepTags=-@slow
```

---

## Adding New Tags

### For Features

1. Add the feature to `contents/themes/{theme}/config/features.config.ts`
2. Use the tag in your test: `{ tags: ['@feat-new-feature'] }`
3. Run `node core/scripts/build/registry.mjs` - validation happens automatically

### For Other Tags

Simply use the tag in your test file. It will be discovered and added to the appropriate category in `TAGS_REGISTRY`:

```typescript
describe('My Test', { tags: ['@api', '@smoke', '@security'] }, () => {
  // ...
})
```

---

## CI Integration

Tag validation is part of the registry build. Any CI workflow that runs the build will automatically validate tags:

```yaml
- name: Build registries
  run: node core/scripts/build/registry.mjs
  # Fails if invalid tags found
```

---

## Using Tags in Code

Import from the auto-generated registry:

```typescript
import {
  FEATURE_REGISTRY,
  TAGS_REGISTRY,
  COVERAGE_SUMMARY
} from '@/core/lib/registries/testing-registry'

// Check if a feature has tests
const hasTests = FEATURE_REGISTRY.customers.testing.hasTests

// Get all smoke test files
const smokeFiles = TAGS_REGISTRY.priorities.smoke.files

// Coverage stats
console.log(`${COVERAGE_SUMMARY.features.withTests} features have tests`)
```

---

## Quick Reference

| Task | Command |
|------|---------|
| Build & validate tags | `node core/scripts/build/registry.mjs` |
| Run smoke tests | `pnpm cypress:run --env grepTags=@smoke` |
| Run feature tests | `pnpm cypress:run --env grepTags=@feat-customers` |
| Run API tests | `pnpm cypress:run --env grepTags=@api` |

---

## Next Steps

- [E2E Testing with Cypress](./03-e2e-testing-cypress.md) - Full Cypress guide
- [CI Workflow Templates](./10-ci-workflows.md) - CI/CD setup

---

**Last Updated:** 2025-12-30
**Version:** 2.0.0
**Status:** Complete
