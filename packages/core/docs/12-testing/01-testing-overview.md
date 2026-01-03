# Testing Overview

## Introduction

Testing ensures code quality, prevents regressions, and builds confidence in deployments. Our testing strategy uses **Jest for unit tests** and **Cypress for E2E tests**, providing comprehensive coverage from individual functions to complete user flows.

**Current Status:** ✅ Testing infrastructure is complete with:
- Jest unit testing with coverage reporting
- Cypress E2E testing with theme-level isolation
- Tag-based test filtering with @cypress/grep
- Tag validation system with opt-in per theme
- Allure reporting with rich HTML dashboards
- CI workflow templates for automated testing
- Core vs Theme architecture separation

---

## Testing Philosophy

### Test What Matters

```typescript
const TESTING_PRIORITIES = {
  critical: [
    'Authentication flows',
    'Data mutations (create, update, delete)',
    'Permission checks',
    'Payment processing',
  ],
  
  important: [
    'Entity CRUD operations',
    'API endpoints',
    'Form validations',
    'Navigation flows',
  ],
  
  nice_to_have: [
    'UI component rendering',
    'Utility functions',
    'Edge cases',
  ],
}
```

**Focus:** Test critical paths thoroughly, important features adequately, nice-to-haves minimally.

---

## Testing Pyramid

### Three Layers of Testing

```text
         /\
        /  \         E2E Tests (Cypress)
       /    \        • Slow, expensive
      /      \       • Critical user flows
     /________\      • ~10% of tests
    
    /          \     Integration Tests
   /            \    • Medium speed
  /              \   • API + DB + Logic
 /________________\  • ~30% of tests

/                  \ Unit Tests (Jest)
____________________• Fast, cheap
                     • Pure functions
                     • ~60% of tests
```

**Strategy:** Many fast unit tests, fewer integration tests, minimal E2E tests.

---

## Core vs Theme Architecture

The testing system follows a **core provides, theme consumes** pattern:

### Core (`core/tests/cypress/`)

Shared testing infrastructure used by all themes:

```text
core/tests/cypress/
├── support/
│   ├── e2e.ts           # Main support file
│   ├── commands.ts      # Custom commands
│   └── allure.ts        # Allure plugin setup
└── src/classes/
    ├── components/      # Shared POMs (auth, navigation)
    ├── controllers/     # Shared API controllers
    └── shared/          # Session utilities
```

**Core provides:**
- Custom Cypress commands
- @cypress/grep integration
- Allure reporter configuration
- Shared Page Object Models (POMs)
- Session management utilities

### Theme (`contents/themes/{theme}/tests/`)

Theme-specific test configuration and specs:

```text
contents/themes/{theme}/tests/
├── cypress.config.ts          # Theme-level Cypress config
└── cypress/
    ├── e2e/                   # Test specifications
    │   ├── api/               # API tests
    │   └── {feature}/         # Feature tests
    ├── fixtures/              # Test data
    └── src/                   # Theme-specific POMs
```

**Theme provides:**
- Test specifications
- Theme-specific POMs and controllers
- Test fixtures and data

> **Note:** Tag discovery and validation happens automatically during registry build. See [Tag Validation System](./09-tag-validation-system.md).

### Why This Separation?

1. **Isolation** - Each theme can have different entities and test requirements
2. **Reuse** - Common patterns shared across themes
3. **Independence** - Themes can evolve their testing without affecting core

---

## Current Test Setup

### Jest (Unit Testing)

```bash
# Run all unit tests
pnpm test

# Run specific test file
pnpm test -- lib/utils.test.ts

# Run with coverage
pnpm test -- --coverage

# Watch mode for development
pnpm test -- --watch
```

**Configuration:** `jest.config.cjs`

**Test Location:** `core/tests/jest/**/*.test.ts`

**Key Features:**
- ts-jest for TypeScript
- React Testing Library for components
- jsdom environment for DOM testing

### Cypress (E2E Testing)

```bash
# Open Cypress UI (development)
pnpm cypress:open

# Run all E2E tests (CI)
pnpm cypress:run

# Run specific test
pnpm cypress:run --spec "core/tests/cypress/e2e/auth/login.cy.ts"
```

**Configuration:** `core/tests/cypress.config.js`

**Test Location:** `core/tests/cypress/e2e/**/*.cy.ts`

**Key Features:**
- Real browser testing
- Video recording
- Screenshot on failure
- Allure reporting

---

## Test Organization

### Directory Structure

```text
test/
├── jest/                     # Unit tests
│   ├── api/                  # API logic tests
│   ├── components/           # React component tests
│   ├── hooks/                # Custom hooks tests
│   ├── lib/                  # Utility function tests
│   └── __mocks__/            # Mock implementations
│
├── cypress/                  # E2E tests
│   ├── e2e/                  # Test specifications
│   │   ├── auth/             # Authentication tests
│   │   ├── api/              # API endpoint tests
│   │   └── tasks/            # Task feature tests
│   ├── support/              # Custom commands
│   └── fixtures/             # Test data
│
└── cases/                    # Test case definitions (CSV)
    ├── auth/
    ├── tasks/
    └── api/
```

---

## Writing Tests

### Jest Unit Test Template

```typescript
// core/tests/jest/lib/utils.test.ts
import { myFunction } from '@/core/lib/utils'

describe('myFunction', () => {
  it('should handle valid input', () => {
    const result = myFunction('valid')
    expect(result).toBe('expected')
  })

  it('should handle invalid input', () => {
    expect(() => myFunction('')).toThrow()
  })

  it('should return default for null', () => {
    expect(myFunction(null)).toBe('default')
  })
})
```

### Cypress E2E Test Template

```typescript
// core/tests/cypress/e2e/feature/flow.cy.ts
describe('Feature Flow', () => {
  beforeEach(() => {
    // Login before each test
    cy.visit('/')
    // Add login logic or use custom command
  })

  it('should complete user flow', () => {
    cy.visit('/dashboard/feature')
    cy.get('[data-cy="action-btn"]').click()
    cy.get('[data-cy="input"]').type('test data')
    cy.get('[data-cy="submit"]').click()
    cy.contains('Success message')
  })
})
```

---

## Coverage Recommendations

When deciding what to test and how much coverage to aim for, consider these guidelines:

### Priority-Based Approach

| Priority | What to Test | Recommended Coverage |
|----------|--------------|---------------------|
| **Critical** | Auth, payments, data mutations | High coverage recommended |
| **Important** | Entity CRUD, API endpoints | Moderate coverage |
| **Standard** | Utilities, helpers | Basic coverage |

### Practical Guidance

- **Focus on behavior, not metrics** - High coverage doesn't guarantee quality
- **Test critical paths first** - Authentication, permissions, data integrity
- **Use tags for organization** - `@smoke` for critical, `@regression` for comprehensive
- **Balance cost vs value** - E2E tests are expensive, unit tests are cheap

```typescript
// Example: Testing priorities by feature type
const testingStrategy = {
  authentication: 'Comprehensive - test all flows and edge cases',
  entityCRUD: 'Moderate - test happy paths and key validations',
  uiComponents: 'Selective - test complex interactions only',
  utilities: 'As needed - test pure functions with edge cases',
}
```

---

## Running Tests in CI/CD

### GitHub Actions Integration

```yaml
# .github/workflows/test.yml (example)
name: Tests

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm test --coverage

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm build
      - run: pnpm start & pnpm cypress:run
```

---

## Best Practices

### ✅ DO

```typescript
// Use descriptive test names
it('should create task with valid title and description', () => {})

// Test one thing per test
it('should validate email format', () => {})
it('should reject empty email', () => {})

// Use data-cy attributes for E2E
<button data-cy="submit-btn">Submit</button>

// Clean up after tests
afterEach(() => {
  // Reset state, clear mocks
})
```

### ❌ DON'T

```typescript
// Vague test names
it('should work', () => {})

// Test multiple things
it('should create, update, and delete task', () => {})

// Use fragile selectors
cy.get('.btn-primary.submit')  // Breaks if CSS changes

// Leave side effects
// Always clean up database, state, etc.
```

---

## Quick Reference

### Jest Commands

```bash
pnpm test                    # Run all tests
pnpm test -- --watch         # Watch mode
pnpm test -- --coverage      # Coverage report
pnpm test -- utils.test.ts   # Specific file
```

### Cypress Commands

```bash
pnpm cypress:open            # Interactive mode
pnpm cypress:run             # Headless mode
pnpm cypress:run --spec "**/auth/*.cy.ts"  # Specific tests
```

---

## Next Steps

This testing section covers:

1. **[Testing Overview](./01-testing-overview.md)** (this document) - Strategy and setup
2. **[Unit Testing with Jest](./02-unit-testing-jest.md)** - Jest configuration and patterns
3. **[E2E Testing with Cypress](./03-e2e-testing-cypress.md)** - Cypress best practices
4. **[Testing API Endpoints](./04-testing-api-endpoints.md)** - API testing strategies
5. **[Mocking Strategies](./05-mocking-strategies.md)** - Mocks and stubs
6. **[Test Data Management](./06-test-data-management.md)** - Test fixtures and factories
7. **[Integration Testing](./07-integration-testing.md)** - Integration test patterns
8. **[Test Coverage](./08-test-coverage.md)** - Coverage analysis and goals
9. **[Tag Validation System](./09-tag-validation-system.md)** - Tag management and CI validation
10. **[CI Workflow Templates](./10-ci-workflows.md)** - Automated testing workflows
11. **[Allure Reporting](./11-allure-reporting.md)** - Rich HTML test reports

---

**Last Updated:** 2025-12-13
**Version:** 2.1.0
**Status:** Complete
