# E2E Testing with Cypress

## Introduction

Cypress provides **end-to-end testing** in real browsers, validating complete user flows from UI interactions to API calls. Use Cypress to test critical paths that users actually follow.

**Focus:** User journeys, authentication flows, CRUD operations, navigation.

**Key Features:**
- Theme-level test isolation
- @cypress/grep for tag-based filtering
- Allure reporting with rich dashboards
- Global sessions for 3-5x faster execution
- CI workflow templates for automation

---

## Core vs Theme Architecture

The testing system follows a **core provides, theme consumes** pattern:

### Core (`core/tests/cypress/`)

Shared infrastructure used by all themes:

```text
core/tests/cypress/
├── support/
│   ├── e2e.ts           # Main support file
│   ├── commands.ts      # Custom Cypress commands
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

> **Note:** Tags are automatically discovered and validated during registry build. See [Tag Validation](./09-tag-validation-system.md).

---

## Cypress Setup

### Theme-Level Configuration

Each theme has its own Cypress config:

```typescript
// contents/themes/{theme}/tests/cypress.config.ts
import { defineConfig } from 'cypress'
import path from 'path'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    specPattern: path.join(__dirname, 'cypress/e2e/**/*.cy.ts'),
    supportFile: path.resolve(__dirname, '../../../../core/tests/cypress/support/e2e.ts'),

    viewportWidth: 1280,
    viewportHeight: 720,

    video: true,
    screenshotOnRunFailure: true,

    env: {
      grepFilterSpecs: true,
      grepOmitFiltered: true,
    },

    setupNodeEvents(on, config) {
      // Grep plugin (v5.x)
      const { plugin: grepPlugin } = require('@cypress/grep/plugin')
      grepPlugin(config)

      // Allure plugin
      const { allureCypress } = require('allure-cypress/reporter')
      allureCypress(on, config, {
        resultsDir: path.join(__dirname, 'cypress/allure-results'),
      })

      return config
    },
  },
})
```

### Running Cypress

```bash
# Interactive mode (development)
pnpm cypress:open

# Headless mode (CI)
pnpm cypress:run

# Specific test file
pnpm cypress:run --spec "core/tests/cypress/e2e/auth/login.cy.ts"

# Specific browser
pnpm cypress:run --browser chrome

# With theme-level config
pnpm cypress:run --config-file contents/themes/default/tests/cypress.config.ts
```

---

## Test Categorization with Tags

### @cypress/grep Integration

Use tags to categorize and filter tests:

```typescript
// Tag at describe level
describe('Customers API - CRUD', {
  tags: ['@api', '@feat-customers', '@crud', '@regression']
}, () => {

  // Tag at test level
  it('should create customer', { tags: '@smoke' }, () => {
    // Critical path test
  })
})
```

### Running with Tag Filters

```bash
# Run smoke tests only
pnpm cypress:run --env grepTags=@smoke

# Run API tests
pnpm cypress:run --env grepTags=@api

# Combine tags (AND logic)
pnpm cypress:run --env grepTags=@api+@smoke

# Exclude tags
pnpm cypress:run --env grepTags=-@slow

# Feature-specific tests
pnpm cypress:run --env grepTags=@feat-customers
```

### Tag Categories

| Category | Prefix | Examples |
|----------|--------|----------|
| Layer | - | `@api`, `@uat` |
| Priority | - | `@smoke`, `@sanity`, `@regression` |
| Feature | `feat-` | `@feat-customers`, `@feat-tasks` |
| Role | `role-` | `@role-owner`, `@role-member` |
| Operation | - | `@crud`, `@security`, `@workflow` |

**See:** [Tag Validation System](./09-tag-validation-system.md) for complete tag documentation.

---

## Global Sessions for Performance

### Why Global Sessions?

Without global sessions, login runs before **every test** = slow execution.

With global sessions, login runs **once per role** = 3-5x faster.

### Session Helper Pattern

```typescript
// core/tests/cypress/src/classes/shared/session-helpers.ts
import { LoginPage } from '../components/LoginPage'

export function ensureLoggedInAs(
  role: 'owner' | 'admin' | 'member',
  sessionId: string
) {
  cy.session(sessionId, () => {
    const credentials = getCredentialsForRole(role)
    const loginPage = new LoginPage()
    loginPage.login(credentials.email, credentials.password)
    cy.url().should('include', '/dashboard')
  }, {
    validate() {
      cy.getCookie('session').should('exist')
    }
  })
}
```

### Usage in Tests

```typescript
describe('Customers - Owner Role', {
  tags: ['@uat', '@feat-customers', '@role-owner']
}, () => {

  beforeEach(() => {
    ensureLoggedInAs('owner', 'owner-session')
    cy.visit('/dashboard/customers')
  })

  it('OWNER_001: Should create customer', { tags: '@smoke' }, () => {
    // Test runs with cached session
  })
})
```

### Performance Impact

| Approach | 10 Tests | 50 Tests |
|----------|----------|----------|
| Login per test | ~30s | ~150s |
| Global session | ~8s | ~35s |
| **Improvement** | **3.75x** | **4.3x** |

---

## Allure Labels Integration

### Adding Labels to Tests

```typescript
import * as allure from 'allure-cypress'

describe('Customers API - CRUD', {
  tags: ['@api', '@feat-customers', '@crud']
}, () => {

  beforeEach(() => {
    // Labels for report organization
    allure.epic('API')
    allure.feature('Customers')
  })

  it('CUST_API_001: Should create customer', { tags: '@smoke' }, () => {
    allure.story('CRUD Operations')
    allure.severity('critical')

    // Test code with steps
    allure.step('Prepare test data', () => {
      // setup
    })

    allure.step('Send POST request', () => {
      cy.request('POST', '/api/v1/customers', testData)
    })
  })
})
```

### Label Hierarchy

```text
Epic: API
├── Feature: Customers
│   ├── Story: CRUD Operations
│   │   └── severity: critical
│   └── Story: Validation
│       └── severity: normal
```

### Tag ↔ Label Correlation

| Cypress Tag | Allure Label |
|-------------|--------------|
| `@api` | `epic: API` |
| `@uat` | `epic: UAT` |
| `@feat-customers` | `feature: Customers` |
| `@crud` | `story: CRUD Operations` |
| `@smoke` | `severity: critical` |

**See:** [Allure Reporting](./11-allure-reporting.md) for complete reporting guide.

---

## Page Object Model (POM) Architecture

### What are POMs?

Page Object Models encapsulate UI interactions and selectors, making tests more readable and maintainable. Each POM class represents a page or component in the application.

### POM Structure

```text
core/tests/cypress/src/classes/
├── components/           # Shared POMs (auth, navigation)
│   ├── LoginPage.ts
│   ├── Navigation.ts
│   └── index.ts
├── controllers/          # Shared API controllers
│   └── BaseAPIController.ts
└── shared/
    └── session-helpers.ts

contents/themes/{theme}/tests/cypress/src/
├── components/           # Theme-specific POMs
│   ├── CustomersPOM.ts
│   ├── TasksPOM.ts
│   └── index.ts
├── controllers/          # Theme-specific API controllers
│   ├── CustomerAPIController.ts
│   └── index.ts
└── session-helpers.ts    # Theme-specific session config
```

### POM Class Pattern

**Centralized Selector Architecture (v3.0):**

POMs use `cySelector()` from the centralized selector system instead of hardcoded selectors:

```typescript
// contents/themes/{theme}/tests/cypress/src/entities/CustomersPOM.ts
import { DashboardEntityPOM } from '../core/DashboardEntityPOM'
import { cySelector } from '../selectors'
import entitiesConfig from '../../fixtures/entities.json'

export class CustomersPOM extends DashboardEntityPOM {
  constructor() {
    super(entitiesConfig.entities.customers.slug)
  }

  // Selectors using cySelector() - Single Source of Truth
  get selectors() {
    const slug = this.slug
    return {
      // Entity selectors (from DashboardEntityPOM)
      ...super.selectors,
      // Custom selectors for this entity
      listContainer: cySelector('entities.table.container', { slug }),
      addButton: cySelector('entities.table.addButton', { slug }),
      row: (id: string) => cySelector('entities.table.row', { slug, id }),
      field: (name: string) => cySelector('entities.form.field', { slug, name }),
    }
  }

  // Navigation
  navigateToList() {
    cy.visit(`/dashboard/${this.slug}`)
    cy.get(this.selectors.listContainer).should('exist')
  }

  // Actions
  clickCreate() {
    cy.get(this.selectors.addButton).click()
  }

  fillForm(data: { name: string; email: string }) {
    cy.get(this.selectors.field('name')).type(data.name)
    cy.get(this.selectors.field('email')).type(data.email)
  }

  // Composite actions
  createCustomer(data: { name: string; email: string }) {
    this.clickCreate()
    this.fillForm(data)
    this.submitForm()
  }
}
```

**Selector Import Pattern:**
```typescript
// POMs import from theme's selectors.ts
import { cySelector } from '../selectors'

// selectors.ts extends CORE_SELECTORS from core
import { createSelectorHelpers, CORE_SELECTORS } from '../../../core/lib/test'
const THEME_SELECTORS = { ...CORE_SELECTORS }
export const { cySelector, sel, SELECTORS } = createSelectorHelpers(THEME_SELECTORS)
```

### Using POMs in Tests

```typescript
// contents/themes/{theme}/tests/cypress/e2e/customers/customers-owner.cy.ts
import { CustomersPOM } from '../../src/components'
import { ensureLoggedInAs, getThemeUsers } from '../../src/session-helpers'

describe('Customers - Owner Role', {
  tags: ['@uat', '@feat-customers', '@role-owner', '@regression']
}, () => {
  const customersPOM = new CustomersPOM()
  const users = getThemeUsers()

  beforeEach(() => {
    ensureLoggedInAs('owner', 'owner-customers-session')
    customersPOM.navigateToList()
  })

  it('CUST_OWNER_001: Should create customer', { tags: '@smoke' }, () => {
    customersPOM.createCustomer({
      name: 'Test Customer',
      email: 'test@example.com'
    })
    customersPOM.verifyCustomerInList('Test Customer')
  })
})
```

### API Controller Pattern

```typescript
// contents/themes/{theme}/tests/cypress/src/controllers/CustomerAPIController.ts
export class CustomerAPIController {
  private baseUrl = '/api/v1/customers'

  create(data: { name: string; email: string }) {
    return cy.request({
      method: 'POST',
      url: this.baseUrl,
      body: data,
    })
  }

  getAll() {
    return cy.request({
      method: 'GET',
      url: this.baseUrl,
    })
  }

  getById(id: string) {
    return cy.request({
      method: 'GET',
      url: `${this.baseUrl}/${id}`,
    })
  }

  update(id: string, data: Partial<{ name: string; email: string }>) {
    return cy.request({
      method: 'PATCH',
      url: `${this.baseUrl}/${id}`,
      body: data,
    })
  }

  delete(id: string) {
    return cy.request({
      method: 'DELETE',
      url: `${this.baseUrl}/${id}`,
    })
  }
}
```

---

## File Naming Conventions

### Test Files

| Type | Pattern | Example |
|------|---------|---------|
| API tests | `{entity}-crud.cy.ts` | `customers-crud.cy.ts` |
| UAT by role | `{entity}-{role}.cy.ts` | `customers-owner.cy.ts` |
| Workflow tests | `{feature}-workflow.cy.ts` | `auth-workflow.cy.ts` |
| Cross-feature | `{flow-name}.cy.ts` | `onboarding-flow.cy.ts` |

### Directory Structure

```text
cypress/e2e/
├── api/                    # API tests (no browser)
│   ├── customers-crud.cy.ts
│   └── tasks-crud.cy.ts
├── customers/              # Feature: Customers
│   ├── customers-owner.cy.ts
│   ├── customers-admin.cy.ts
│   └── customers-member.cy.ts
├── tasks/                  # Feature: Tasks
│   ├── tasks-owner.cy.ts
│   └── tasks-member.cy.ts
└── flows/                  # Cross-feature journeys
    └── onboarding-flow.cy.ts
```

---

## Test ID Conventions

### Naming Pattern

```text
{ENTITY}_{LAYER}_{NUMBER}: Description
```

**Components:**
- `ENTITY`: Short entity name (CUST, TASK, AUTH)
- `LAYER`: API or UAT + role suffix
- `NUMBER`: Sequential 3-digit number

### Examples

| Test ID | Meaning |
|---------|---------|
| `CUST_API_001` | Customer API test #1 |
| `CUST_OWNER_001` | Customer UAT test as owner #1 |
| `CUST_MEMBER_001` | Customer UAT test as member #1 |
| `AUTH_UAT_001` | Authentication UAT test #1 |
| `TASK_API_005` | Task API test #5 |

### In Code

```typescript
describe('Customers API - CRUD', {
  tags: ['@api', '@feat-customers', '@crud']
}, () => {

  it('CUST_API_001: Should create customer with valid data', () => {
    // Test implementation
  })

  it('CUST_API_002: Should return 400 for invalid email', () => {
    // Test implementation
  })
})
```

---

## Layer Architecture

### Visual Overview

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                            TESTING LAYERS                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         @uat (Browser Tests)                         │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │ @role-owner  │  │ @role-admin  │  │ @role-member │              │   │
│  │  │   Full UI    │  │  Admin UI    │  │  Limited UI  │              │   │
│  │  │   testing    │  │   testing    │  │   testing    │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         @api (HTTP Tests)                            │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │    @crud     │  │  @security   │  │   @workflow  │              │   │
│  │  │   CRUD ops   │  │  Auth/Perms  │  │   Stateful   │              │   │
│  │  │    tests     │  │    tests     │  │    tests     │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Priority Tags: @smoke (critical) → @sanity (quick) → @regression (full)   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Layer Descriptions

| Layer | Tag | Purpose | Speed |
|-------|-----|---------|-------|
| **UAT** | `@uat` | Real browser, user interactions | Slower |
| **API** | `@api` | Direct HTTP requests | Faster |

### Role-Based Testing

| Role | Tag | Access Level |
|------|-----|--------------|
| Owner | `@role-owner` | Full access |
| Admin | `@role-admin` | Administrative |
| Member | `@role-member` | Limited access |
| Viewer | `@role-viewer` | Read-only |

---

## Test Structure

### Basic Test Pattern

```typescript
// core/tests/cypress/e2e/tasks/create-task.cy.ts
describe('Create Task', () => {
  beforeEach(() => {
    // Setup: Login before each test
    cy.visit('/login')
    cy.get('[data-cy="email"]').type('user@example.com')
    cy.get('[data-cy="password"]').type('password123')
    cy.get('[data-cy="login-btn"]').click()
    cy.url().should('include', '/dashboard')
  })

  it('should create a new task successfully', () => {
    // Navigate to tasks
    cy.visit('/dashboard/tasks')
    
    // Open create modal
    cy.get('[data-cy="create-task-btn"]').click()
    
    // Fill form
    cy.get('[data-cy="task-title"]').type('Test Task')
    cy.get('[data-cy="task-description"]').type('Task description')
    
    // Submit
    cy.get('[data-cy="submit-btn"]').click()
    
    // Verify success
    cy.contains('Task created successfully')
    cy.get('[data-cy="task-list"]').should('contain', 'Test Task')
  })

  it('should show validation error for empty title', () => {
    cy.visit('/dashboard/tasks')
    cy.get('[data-cy="create-task-btn"]').click()
    cy.get('[data-cy="submit-btn"]').click()
    
    cy.contains('Title is required')
  })
})
```

---

## Best Practices

### Use data-cy Attributes

```tsx
// ✅ CORRECT - Use data-cy for test selectors
<button data-cy="submit-btn">Submit</button>
<input data-cy="email-input" type="email" />

// ❌ WRONG - Don't use CSS classes or IDs
<button className="btn-primary">Submit</button>
<input id="email" type="email" />
```

**Why:** data-cy selectors are stable and don't break when styling changes.

### Custom Commands

```typescript
// core/tests/cypress/support/commands.ts
Cypress.Commands.add('login', (email: string, password: string) => {
  cy.visit('/login')
  cy.get('[data-cy="email"]').type(email)
  cy.get('[data-cy="password"]').type(password)
  cy.get('[data-cy="login-btn"]').click()
  cy.url().should('include', '/dashboard')
})

// Usage in tests
describe('Dashboard', () => {
  beforeEach(() => {
    cy.login('user@example.com', 'password123')
  })

  it('should display dashboard', () => {
    cy.contains('Welcome to Dashboard')
  })
})
```

---

## Common Patterns

### API Testing

```typescript
describe('Tasks API', () => {
  it('should fetch tasks via API', () => {
    cy.request({
      method: 'GET',
      url: '/api/v1/tasks',
      headers: {
        'Authorization': `Bearer ${Cypress.env('API_KEY')}`
      }
    }).then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body).to.have.property('data')
      expect(response.body.data).to.be.an('array')
    })
  })

  it('should create task via API', () => {
    cy.request({
      method: 'POST',
      url: '/api/v1/tasks',
      headers: {
        'Authorization': `Bearer ${Cypress.env('API_KEY')}`
      },
      body: {
        title: 'API Test Task',
        description: 'Created via API'
      }
    }).then((response) => {
      expect(response.status).to.eq(201)
      expect(response.body.data.title).to.eq('API Test Task')
    })
  })
})
```

### Waiting for Elements

```typescript
// Wait for element to exist
cy.get('[data-cy="task-list"]').should('exist')

// Wait for element to be visible
cy.get('[data-cy="modal"]').should('be.visible')

// Wait for text content
cy.contains('Loading...').should('not.exist')
cy.contains('Data loaded')

// Wait for API call
cy.intercept('GET', '/api/v1/tasks').as('getTasks')
cy.visit('/dashboard/tasks')
cy.wait('@getTasks')
```

### Testing Forms

```typescript
it('should validate form inputs', () => {
  cy.visit('/dashboard/tasks/new')
  
  // Empty form submission
  cy.get('[data-cy="submit"]').click()
  cy.contains('Title is required')
  
  // Fill form
  cy.get('[data-cy="title"]').type('Valid Title')
  cy.get('[data-cy="description"]').type('Valid description')
  
  // Successful submission
  cy.get('[data-cy="submit"]').click()
  cy.url().should('include', '/dashboard/tasks')
})
```

---

## Testing Authentication

### Login Flow

```typescript
describe('Authentication', () => {
  it('should login successfully', () => {
    cy.visit('/login')
    cy.get('[data-cy="email"]').type('user@example.com')
    cy.get('[data-cy="password"]').type('password123')
    cy.get('[data-cy="login-btn"]').click()
    
    cy.url().should('include', '/dashboard')
    cy.contains('Welcome')
  })

  it('should show error for invalid credentials', () => {
    cy.visit('/login')
    cy.get('[data-cy="email"]').type('wrong@example.com')
    cy.get('[data-cy="password"]').type('wrongpassword')
    cy.get('[data-cy="login-btn"]').click()
    
    cy.contains('Invalid credentials')
    cy.url().should('include', '/login')
  })

  it('should logout successfully', () => {
    cy.login('user@example.com', 'password123')
    cy.get('[data-cy="user-menu"]').click()
    cy.get('[data-cy="logout-btn"]').click()
    
    cy.url().should('include', '/login')
  })
})
```

---

## Intercepting API Calls

### Mock API Responses

```typescript
describe('Tasks with mocked API', () => {
  beforeEach(() => {
    // Mock API response
    cy.intercept('GET', '/api/v1/tasks', {
      statusCode: 200,
      body: {
        data: [
          { id: '1', title: 'Task 1' },
          { id: '2', title: 'Task 2' },
        ]
      }
    }).as('getTasks')
  })

  it('should display mocked tasks', () => {
    cy.visit('/dashboard/tasks')
    cy.wait('@getTasks')
    
    cy.contains('Task 1')
    cy.contains('Task 2')
  })
})
```

---

## Videos and Screenshots

### Automatic Capture

```typescript
// Videos: Automatically recorded in core/tests/cypress/videos/
// Screenshots: Captured on test failure in core/tests/cypress/screenshots/

// Manual screenshot
cy.screenshot('custom-name')

// Screenshot specific element
cy.get('[data-cy="chart"]').screenshot('chart-view')
```

---

## Best Practices Summary

### ✅ DO

```typescript
// Use data-cy selectors
cy.get('[data-cy="submit-btn"]')

// Wait for async operations
cy.wait('@apiCall')
cy.get('[data-cy="result"]').should('exist')

// Clean up after tests
afterEach(() => {
  // Delete created data
})

// Use descriptive test names
it('should create task with valid title and description', () => {})
```

### ❌ DON'T

```typescript
// Use fragile selectors
cy.get('.btn-primary')  // Breaks if CSS changes
cy.get('#submit')       // Breaks if ID changes

// Use arbitrary waits
cy.wait(5000)  // Use cy.wait('@alias') instead

// Test too much in one test
// Split into multiple focused tests

// Ignore test isolation
// Each test should be independent
```

---

## Quick Reference

```typescript
// Navigation
cy.visit('/dashboard')
cy.go('back')
cy.reload()

// Selectors
cy.get('[data-cy="element"]')
cy.contains('Text content')

// Actions
cy.click()
cy.type('text')
cy.select('option')
cy.check()
cy.uncheck()

// Assertions
.should('exist')
.should('be.visible')
.should('have.text', 'Expected')
.should('have.value', 'value')

// API
cy.request('GET', '/api/endpoint')
cy.intercept('POST', '/api/endpoint').as('apiCall')
cy.wait('@apiCall')
```

---

## Next Steps

- Write E2E tests for critical flows
- Add data-cy attributes to UI components
- Set up theme-level Cypress config
- Configure tag registry for validation

**Related Documentation:**
- [Tag Validation System](./09-tag-validation-system.md) - Tag management and validation
- [CI Workflow Templates](./10-ci-workflows.md) - Automated testing workflows
- [Allure Reporting](./11-allure-reporting.md) - Rich HTML test reports
- [Testing API Endpoints](./04-testing-api-endpoints.md) - API testing patterns

---

**Last Updated:** 2025-12-13
**Version:** 2.0.0
**Status:** Complete
