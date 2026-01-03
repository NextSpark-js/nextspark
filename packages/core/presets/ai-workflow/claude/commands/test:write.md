---
description: "[Test Step 1] Write or update Cypress tests (API and UAT) for a feature"
---

# Test Write - Create Cypress Tests

You are writing Cypress tests for a feature or entity.

**Feature or Entity to Test:**
{{{ input }}}

---

## Your Mission

Create comprehensive Cypress tests following project patterns:

1. **Analyze the feature** to understand test requirements
2. **Create API tests** using BaseAPIController
3. **Create UAT tests** using Page Object Models (POMs)
4. **Document selectors** in `core-selectors.ts` AND tests.md (if session exists)
5. **Create/Update BDD documentation** (`.bdd.md` file)
6. **Run tests** to verify they pass

---

## ⚠️ IMPORTANT: Test Deliverables

**Every test task produces TWO files:**

| File Type | Extension | Purpose |
|-----------|-----------|---------|
| Cypress Test | `.cy.ts` | Executable test code |
| BDD Documentation | `.bdd.md` | Gherkin scenarios (EN/ES), selectors, metadata |

**Both files must be created/updated together. The task is NOT complete without the BDD file.**

---

## Cypress Execution Commands

The project uses a custom runner that auto-detects the active theme:

```bash
# ✅ CORRECT - Use these commands (auto-detect theme)
pnpm cy:open                                    # Open Cypress UI
pnpm cy:run                                     # Run all tests headless
pnpm cy:run -- --spec "cypress/e2e/**/*.cy.ts"  # Run specific spec

# With grep tags (filter by test tags)
pnpm cy:run -- --env grepTags=@smoke            # Only @smoke tests
pnpm cy:run -- --env grepTags="@uat+@superadmin"  # AND logic
pnpm cy:run -- --env grepTags="@uat @superadmin"  # OR logic

# ❌ WRONG - Do NOT use these (hardcodes theme)
# pnpm cypress run --config-file contents/themes/default/tests/cypress.config.ts
```

**Theme Detection:** Uses `NEXT_PUBLIC_ACTIVE_THEME` from `.env` (defaults to `default`)

---

## Test Writing Protocol

### Step 1: Understand What to Test

```typescript
// If session path provided, read context
if (input.includes('.claude/sessions/')) {
  await Read(`${input}/requirements.md`)
  await Read(`${input}/tests.md`)
  await Read(`${input}/clickup_task.md`)
}

// Otherwise, analyze the feature/entity
await Grep({
  pattern: entityName,
  path: 'app/',
  type: 'ts'
})

// Find API routes
await Glob('app/api/v1/**/*.ts')

// Find UI components
await Glob(`app/components/**/*${entityName}*.tsx`)
```

### Step 2: Read Existing Test Patterns

```typescript
// Read base test utilities
await Read('contents/themes/default/tests/cypress/support/base-api-controller.ts')
await Read('contents/themes/default/tests/cypress/support/commands.ts')

// Read existing POMs for patterns
await Glob('contents/themes/default/tests/cypress/support/page-objects/*.ts')

// Read existing API tests
await Glob('contents/themes/default/tests/cypress/e2e/api/*.cy.ts')

// Read existing UAT tests
await Glob('contents/themes/default/tests/cypress/e2e/uat/*.cy.ts')
```

---

## API Test Creation

### Step 3: Create API Test File

```typescript
const apiTestPath = `contents/themes/default/tests/cypress/e2e/api/${entityName}.cy.ts`

await Write({
  file_path: apiTestPath,
  content: `/**
 * API Tests: ${EntityName}
 *
 * Tests the ${entityName} API endpoints for:
 * - CRUD operations (Create, Read, Update, Delete)
 * - Authentication (session + API key)
 * - Validation (invalid inputs, edge cases)
 * - Error handling (401, 403, 404, 500)
 */

import { BaseAPIController } from '../../support/base-api-controller'

describe('API: ${EntityName}', () => {
  const api = new BaseAPIController()
  const endpoint = '/api/v1/${entityName}'

  beforeEach(() => {
    // Login before each test
    cy.loginByApi('superadmin@nextspark.dev', 'Test123!@#')
  })

  // ============================================
  // GET - List All
  // ============================================

  describe('GET ${endpoint}', () => {
    it('should return list with valid session', () => {
      api.get(endpoint)
        .then((response) => {
          expect(response.status).to.eq(200)
          expect(response.body).to.have.property('data')
          expect(response.body.data).to.be.an('array')
        })
    })

    it('should return 401 without authentication', () => {
      cy.clearCookies()
      api.get(endpoint, { failOnStatusCode: false })
        .then((response) => {
          expect(response.status).to.eq(401)
        })
    })

    it('should work with API key authentication', () => {
      cy.clearCookies()
      api.get(endpoint, {
        headers: {
          'x-api-key': Cypress.env('API_KEY')
        }
      })
        .then((response) => {
          expect(response.status).to.eq(200)
        })
    })

    it('should support pagination', () => {
      api.get(\`\${endpoint}?page=1&limit=10\`)
        .then((response) => {
          expect(response.status).to.eq(200)
          expect(response.body).to.have.property('pagination')
          expect(response.body.pagination).to.have.property('page', 1)
          expect(response.body.pagination).to.have.property('limit', 10)
        })
    })
  })

  // ============================================
  // GET - Single Item
  // ============================================

  describe('GET ${endpoint}/:id', () => {
    let testId: string

    before(() => {
      // Create a test item
      api.post(endpoint, { name: 'Test ${EntityName}' })
        .then((response) => {
          testId = response.body.data.id
        })
    })

    it('should return item by ID', () => {
      api.get(\`\${endpoint}/\${testId}\`)
        .then((response) => {
          expect(response.status).to.eq(200)
          expect(response.body.data).to.have.property('id', testId)
        })
    })

    it('should return 404 for non-existent ID', () => {
      api.get(\`\${endpoint}/00000000-0000-0000-0000-000000000000\`, {
        failOnStatusCode: false
      })
        .then((response) => {
          expect(response.status).to.eq(404)
        })
    })

    it('should return 400 for invalid UUID', () => {
      api.get(\`\${endpoint}/invalid-uuid\`, { failOnStatusCode: false })
        .then((response) => {
          expect(response.status).to.eq(400)
        })
    })
  })

  // ============================================
  // POST - Create
  // ============================================

  describe('POST ${endpoint}', () => {
    it('should create new item with valid data', () => {
      const payload = {
        name: 'New ${EntityName}',
        description: 'Test description'
      }

      api.post(endpoint, payload)
        .then((response) => {
          expect(response.status).to.eq(201)
          expect(response.body.data).to.have.property('id')
          expect(response.body.data).to.have.property('name', payload.name)
        })
    })

    it('should return 400 for missing required fields', () => {
      api.post(endpoint, {}, { failOnStatusCode: false })
        .then((response) => {
          expect(response.status).to.eq(400)
          expect(response.body).to.have.property('error')
        })
    })

    it('should return 400 for invalid field types', () => {
      api.post(endpoint, { name: 12345 }, { failOnStatusCode: false })
        .then((response) => {
          expect(response.status).to.eq(400)
        })
    })

    it('should return 401 without authentication', () => {
      cy.clearCookies()
      api.post(endpoint, { name: 'Test' }, { failOnStatusCode: false })
        .then((response) => {
          expect(response.status).to.eq(401)
        })
    })
  })

  // ============================================
  // PATCH - Update
  // ============================================

  describe('PATCH ${endpoint}/:id', () => {
    let testId: string

    beforeEach(() => {
      api.post(endpoint, { name: 'Update Test' })
        .then((response) => {
          testId = response.body.data.id
        })
    })

    it('should update item with valid data', () => {
      api.patch(\`\${endpoint}/\${testId}\`, { name: 'Updated Name' })
        .then((response) => {
          expect(response.status).to.eq(200)
          expect(response.body.data).to.have.property('name', 'Updated Name')
        })
    })

    it('should return 404 for non-existent ID', () => {
      api.patch(\`\${endpoint}/00000000-0000-0000-0000-000000000000\`, {
        name: 'Test'
      }, { failOnStatusCode: false })
        .then((response) => {
          expect(response.status).to.eq(404)
        })
    })

    it('should return 400 for invalid data', () => {
      api.patch(\`\${endpoint}/\${testId}\`, { name: '' }, {
        failOnStatusCode: false
      })
        .then((response) => {
          expect(response.status).to.eq(400)
        })
    })
  })

  // ============================================
  // DELETE - Remove
  // ============================================

  describe('DELETE ${endpoint}/:id', () => {
    let testId: string

    beforeEach(() => {
      api.post(endpoint, { name: 'Delete Test' })
        .then((response) => {
          testId = response.body.data.id
        })
    })

    it('should delete item', () => {
      api.delete(\`\${endpoint}/\${testId}\`)
        .then((response) => {
          expect(response.status).to.eq(200)
        })

      // Verify deleted
      api.get(\`\${endpoint}/\${testId}\`, { failOnStatusCode: false })
        .then((response) => {
          expect(response.status).to.eq(404)
        })
    })

    it('should return 404 for non-existent ID', () => {
      api.delete(\`\${endpoint}/00000000-0000-0000-0000-000000000000\`, {
        failOnStatusCode: false
      })
        .then((response) => {
          expect(response.status).to.eq(404)
        })
    })
  })
})
`
})
```

---

## UAT Test Creation

### Step 4: Create Page Object Model

```typescript
const pomPath = `contents/themes/default/tests/cypress/support/page-objects/${entityName}.page.ts`

await Write({
  file_path: pomPath,
  content: `/**
 * Page Object Model: ${EntityName}
 *
 * Encapsulates ${entityName} page interactions for E2E tests.
 * Uses data-cy selectors for reliable element targeting.
 */

export class ${EntityName}Page {
  // ============================================
  // Selectors (data-cy attributes)
  // ============================================

  readonly selectors = {
    // Page elements
    pageTitle: '[data-cy="${entityName}-page-title"]',
    container: '[data-cy="${entityName}-container"]',

    // List elements
    list: '[data-cy="${entityName}-list"]',
    listItem: '[data-cy="${entityName}-item"]',
    emptyState: '[data-cy="${entityName}-empty-state"]',
    loadingState: '[data-cy="${entityName}-loading"]',

    // Card/Item elements
    card: (id: string) => \`[data-cy="${entityName}-card-\${id}"]\`,
    cardTitle: '[data-cy="${entityName}-card-title"]',
    cardActions: '[data-cy="${entityName}-card-actions"]',

    // Form elements
    form: '[data-cy="${entityName}-form"]',
    nameInput: '[data-cy="${entityName}-name-input"]',
    descriptionInput: '[data-cy="${entityName}-description-input"]',
    submitButton: '[data-cy="${entityName}-submit-button"]',
    cancelButton: '[data-cy="${entityName}-cancel-button"]',

    // Action buttons
    createButton: '[data-cy="${entityName}-create-button"]',
    editButton: (id: string) => \`[data-cy="${entityName}-edit-\${id}"]\`,
    deleteButton: (id: string) => \`[data-cy="${entityName}-delete-\${id}"]\`,

    // Dialog elements
    dialog: '[data-cy="${entityName}-dialog"]',
    confirmDelete: '[data-cy="${entityName}-confirm-delete"]',
    cancelDelete: '[data-cy="${entityName}-cancel-delete"]',

    // Toast/Notification
    successToast: '[data-cy="toast-success"]',
    errorToast: '[data-cy="toast-error"]',

    // Pagination
    pagination: '[data-cy="${entityName}-pagination"]',
    nextPage: '[data-cy="${entityName}-pagination-next"]',
    prevPage: '[data-cy="${entityName}-pagination-prev"]',

    // Search/Filter
    searchInput: '[data-cy="${entityName}-search-input"]',
    filterDropdown: '[data-cy="${entityName}-filter-dropdown"]',
  }

  // ============================================
  // Navigation
  // ============================================

  visit() {
    cy.visit('/${entityName}')
    return this
  }

  visitCreate() {
    cy.visit('/${entityName}/new')
    return this
  }

  visitEdit(id: string) {
    cy.visit(\`/${entityName}/\${id}/edit\`)
    return this
  }

  // ============================================
  // List Operations
  // ============================================

  getList() {
    return cy.get(this.selectors.list)
  }

  getItems() {
    return cy.get(this.selectors.listItem)
  }

  getItemCount() {
    return this.getItems().its('length')
  }

  getCard(id: string) {
    return cy.get(this.selectors.card(id))
  }

  clickCreate() {
    cy.get(this.selectors.createButton).click()
    return this
  }

  clickEdit(id: string) {
    cy.get(this.selectors.editButton(id)).click()
    return this
  }

  clickDelete(id: string) {
    cy.get(this.selectors.deleteButton(id)).click()
    return this
  }

  // ============================================
  // Form Operations
  // ============================================

  fillName(name: string) {
    cy.get(this.selectors.nameInput).clear().type(name)
    return this
  }

  fillDescription(description: string) {
    cy.get(this.selectors.descriptionInput).clear().type(description)
    return this
  }

  submitForm() {
    cy.get(this.selectors.submitButton).click()
    return this
  }

  cancelForm() {
    cy.get(this.selectors.cancelButton).click()
    return this
  }

  // ============================================
  // Dialog Operations
  // ============================================

  confirmDeletion() {
    cy.get(this.selectors.confirmDelete).click()
    return this
  }

  cancelDeletion() {
    cy.get(this.selectors.cancelDelete).click()
    return this
  }

  // ============================================
  // Search/Filter
  // ============================================

  search(query: string) {
    cy.get(this.selectors.searchInput).clear().type(query)
    return this
  }

  clearSearch() {
    cy.get(this.selectors.searchInput).clear()
    return this
  }

  // ============================================
  // Assertions
  // ============================================

  shouldShowLoading() {
    cy.get(this.selectors.loadingState).should('be.visible')
    return this
  }

  shouldShowEmpty() {
    cy.get(this.selectors.emptyState).should('be.visible')
    return this
  }

  shouldShowSuccess(message?: string) {
    cy.get(this.selectors.successToast).should('be.visible')
    if (message) {
      cy.get(this.selectors.successToast).should('contain', message)
    }
    return this
  }

  shouldShowError(message?: string) {
    cy.get(this.selectors.errorToast).should('be.visible')
    if (message) {
      cy.get(this.selectors.errorToast).should('contain', message)
    }
    return this
  }

  shouldContainItem(name: string) {
    cy.get(this.selectors.list).should('contain', name)
    return this
  }

  shouldNotContainItem(name: string) {
    cy.get(this.selectors.list).should('not.contain', name)
    return this
  }

  shouldHaveItemCount(count: number) {
    this.getItems().should('have.length', count)
    return this
  }
}
`
})
```

### Step 5: Create UAT Test File

```typescript
const uatTestPath = `contents/themes/default/tests/cypress/e2e/uat/${entityName}.cy.ts`

await Write({
  file_path: uatTestPath,
  content: `/**
 * UAT Tests: ${EntityName}
 *
 * User Acceptance Tests for the ${entityName} feature.
 * Tests complete user workflows from UI perspective.
 */

import { ${EntityName}Page } from '../../support/page-objects/${entityName}.page'

describe('UAT: ${EntityName}', () => {
  const page = new ${EntityName}Page()

  beforeEach(() => {
    // Login and visit page
    cy.loginByUI('superadmin@nextspark.dev', 'Test123!@#')
  })

  // ============================================
  // Happy Path - CRUD Operations
  // ============================================

  describe('Happy Path', () => {
    it('should display ${entityName} list', () => {
      page.visit()

      page.getList().should('be.visible')
    })

    it('should create new ${entityName}', () => {
      const name = \`Test ${EntityName} \${Date.now()}\`

      page.visit()
      page.clickCreate()

      page.fillName(name)
      page.fillDescription('Test description')
      page.submitForm()

      page.shouldShowSuccess()
      page.shouldContainItem(name)
    })

    it('should edit existing ${entityName}', () => {
      // First create one
      const originalName = \`Original \${Date.now()}\`
      const updatedName = \`Updated \${Date.now()}\`

      // Create via API for speed
      cy.request('POST', '/api/v1/${entityName}', { name: originalName })
        .then((response) => {
          const id = response.body.data.id

          page.visit()
          page.clickEdit(id)

          page.fillName(updatedName)
          page.submitForm()

          page.shouldShowSuccess()
          page.shouldContainItem(updatedName)
          page.shouldNotContainItem(originalName)
        })
    })

    it('should delete ${entityName}', () => {
      const name = \`Delete Me \${Date.now()}\`

      // Create via API
      cy.request('POST', '/api/v1/${entityName}', { name })
        .then((response) => {
          const id = response.body.data.id

          page.visit()
          page.clickDelete(id)
          page.confirmDeletion()

          page.shouldShowSuccess()
          page.shouldNotContainItem(name)
        })
    })
  })

  // ============================================
  // Validation - Error States
  // ============================================

  describe('Validation', () => {
    it('should show error for empty name', () => {
      page.visit()
      page.clickCreate()

      page.submitForm()

      // Form should show validation error
      cy.get(page.selectors.nameInput)
        .parent()
        .should('contain', 'required')
    })

    it('should show error for name too short', () => {
      page.visit()
      page.clickCreate()

      page.fillName('ab')  // Too short
      page.submitForm()

      cy.get(page.selectors.nameInput)
        .parent()
        .should('contain', 'at least')
    })

    it('should show error for name too long', () => {
      page.visit()
      page.clickCreate()

      page.fillName('a'.repeat(256))  // Too long
      page.submitForm()

      cy.get(page.selectors.nameInput)
        .parent()
        .should('contain', 'maximum')
    })
  })

  // ============================================
  // Search and Filter
  // ============================================

  describe('Search and Filter', () => {
    beforeEach(() => {
      // Create test data via API
      cy.request('POST', '/api/v1/${entityName}', { name: 'Apple' })
      cy.request('POST', '/api/v1/${entityName}', { name: 'Banana' })
      cy.request('POST', '/api/v1/${entityName}', { name: 'Cherry' })
    })

    it('should filter list by search query', () => {
      page.visit()
      page.search('Apple')

      page.shouldContainItem('Apple')
      page.shouldNotContainItem('Banana')
      page.shouldNotContainItem('Cherry')
    })

    it('should show empty state for no results', () => {
      page.visit()
      page.search('NonExistent12345')

      page.shouldShowEmpty()
    })

    it('should clear search and show all', () => {
      page.visit()
      page.search('Apple')
      page.clearSearch()

      page.shouldContainItem('Apple')
      page.shouldContainItem('Banana')
      page.shouldContainItem('Cherry')
    })
  })

  // ============================================
  // Edge Cases
  // ============================================

  describe('Edge Cases', () => {
    it('should handle special characters in name', () => {
      const name = 'Test <script>alert("xss")</script> & "quotes"'

      page.visit()
      page.clickCreate()
      page.fillName(name)
      page.submitForm()

      // Should be escaped/sanitized
      page.shouldShowSuccess()
    })

    it('should handle very long description', () => {
      const longText = 'a'.repeat(1000)

      page.visit()
      page.clickCreate()
      page.fillName('Long Description Test')
      page.fillDescription(longText)
      page.submitForm()

      page.shouldShowSuccess()
    })

    it('should cancel delete and keep item', () => {
      const name = \`Keep Me \${Date.now()}\`

      cy.request('POST', '/api/v1/${entityName}', { name })
        .then((response) => {
          const id = response.body.data.id

          page.visit()
          page.clickDelete(id)
          page.cancelDeletion()

          page.shouldContainItem(name)
        })
    })
  })

  // ============================================
  // Loading States
  // ============================================

  describe('Loading States', () => {
    it('should show loading indicator', () => {
      // Intercept and delay API
      cy.intercept('GET', '/api/v1/${entityName}*', (req) => {
        req.on('response', (res) => {
          res.setDelay(1000)
        })
      }).as('getList')

      page.visit()
      page.shouldShowLoading()

      cy.wait('@getList')
      page.getList().should('be.visible')
    })
  })

  // ============================================
  // Accessibility
  // ============================================

  describe('Accessibility', () => {
    it('should be keyboard navigable', () => {
      page.visit()

      // Tab to create button
      cy.get('body').tab()
      cy.focused().should('have.attr', 'data-cy', '${entityName}-create-button')

      // Press Enter to activate
      cy.focused().type('{enter}')

      // Should open form
      cy.get(page.selectors.form).should('be.visible')
    })

    it('should have proper ARIA labels', () => {
      page.visit()

      cy.get(page.selectors.createButton)
        .should('have.attr', 'aria-label')

      cy.get(page.selectors.list)
        .should('have.attr', 'role', 'list')
    })
  })
})
`
})
```

---

## Step 6: Update tests.md (if session exists)

```typescript
if (sessionPath) {
  await Edit({
    file_path: `${sessionPath}/tests.md`,
    old_string: '[frontend-validator documenta componentes y data-cy necesarios]',
    new_string: `### Selectores data-cy Documentados

| Componente | Selector | Descripción |
|------------|----------|-------------|
| Page Title | \`${entityName}-page-title\` | Título de la página |
| Container | \`${entityName}-container\` | Contenedor principal |
| List | \`${entityName}-list\` | Lista de items |
| Item | \`${entityName}-item\` | Item individual |
| Card | \`${entityName}-card-{id}\` | Card con ID dinámico |
| Create Button | \`${entityName}-create-button\` | Botón crear nuevo |
| Edit Button | \`${entityName}-edit-{id}\` | Botón editar |
| Delete Button | \`${entityName}-delete-{id}\` | Botón eliminar |
| Form | \`${entityName}-form\` | Formulario |
| Name Input | \`${entityName}-name-input\` | Campo nombre |
| Submit Button | \`${entityName}-submit-button\` | Botón enviar |
| Dialog | \`${entityName}-dialog\` | Modal de confirmación |
| Search Input | \`${entityName}-search-input\` | Campo de búsqueda |
| Empty State | \`${entityName}-empty-state\` | Estado vacío |
| Loading State | \`${entityName}-loading\` | Estado cargando |`
  })
}
```

---

## Step 7: Add Selectors (IMPORTANT: Choose Correct Location)

**Understanding where to add selectors is KEY.** You must understand the context of the component:

### Decision Tree: Where to Add Selectors?

| Component Location | Selector Location | Example |
|-------------------|-------------------|---------|
| `app/admin/**` | `core/lib/test/core-selectors.ts` | Admin panel components |
| `app/dashboard/**` | `core/lib/test/core-selectors.ts` | Dashboard components |
| `app/(auth)/**` | `core/lib/test/core-selectors.ts` | Auth pages |
| `core/**` | `core/lib/test/core-selectors.ts` | Core library components |
| `contents/themes/{theme}/**` | Theme's `selectors.ts` file | Theme-specific components |
| Entity pages using blocks | Theme's entity selectors | Feature-specific UI |

### Option A: Core Selectors (for core/app components)

```typescript
// File: core/lib/test/core-selectors.ts
// Use for: Components in app/, core/, admin panels, dashboard, auth

await Edit({
  file_path: 'core/lib/test/core-selectors.ts',
  old_string: '// existing selectors section',
  new_string: `// existing selectors section

  // ${entityName} selectors
  ${entityName}: {
    container: '[data-cy="${entityName}-container"]',
    list: '[data-cy="${entityName}-list"]',
    item: '[data-cy="${entityName}-item"]',
    form: '[data-cy="${entityName}-form"]',
  },`
})
```

### Option B: Theme Selectors (for theme-specific components)

```typescript
// File: contents/themes/{activeTheme}/tests/cypress/src/selectors.ts
// Use for: Components in contents/themes/, blocks, theme-specific features

await Edit({
  file_path: `contents/themes/${activeTheme}/tests/cypress/src/selectors.ts`,
  old_string: 'export const selectors = {',
  new_string: `export const selectors = {
  // ${entityName} selectors
  ${entityName}: {
    container: '[data-cy="${entityName}-container"]',
    list: '[data-cy="${entityName}-list"]',
    item: '[data-cy="${entityName}-item"]',
    form: '[data-cy="${entityName}-form"]',
  },`
})
```

### How to Determine the Correct Location

1. **Find where the component lives:**
   ```bash
   # Search for the component
   grep -r "data-cy=\"${entityName}" app/ core/ contents/
   ```

2. **If component is in `app/` or `core/`:** → Use `core-selectors.ts`
3. **If component is in `contents/themes/`:** → Use theme's `selectors.ts`
4. **If component is used by both:** → Use `core-selectors.ts` (shared)

---

## Step 8: Create BDD Documentation File

**REQUIRED:** Every `.cy.ts` file must have a companion `.bdd.md` file.

```typescript
const bddPath = `contents/themes/${activeTheme}/tests/cypress/e2e/uat/${entityName}.bdd.md`

await Write({
  file_path: bddPath,
  content: `---
feature: ${EntityName} Management
priority: high
tags: [uat, feat-${entityName}, crud]
grepTags: [@uat, @feat-${entityName}]
coverage: ${testCount}
---

# ${EntityName} Management

> Tests for the ${entityName} feature covering CRUD operations and user interactions.

## @test ${entityName.toUpperCase()}-001: List Access

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** ${entityName}, list, access
- **Grep:** \`@smoke\`

\`\`\`gherkin:en
Scenario: User can access ${entityName} list

Given I am logged in as Owner
When I visit /${entityName}
Then the URL should include /${entityName}
And I should see the ${entityName} list
And the ${entityName} container should be visible
\`\`\`

\`\`\`gherkin:es
Scenario: Usuario puede acceder a la lista de ${entityName}

Given estoy logueado como Owner
When visito /${entityName}
Then la URL deberia incluir /${entityName}
And deberia ver la lista de ${entityName}
And el contenedor de ${entityName} deberia estar visible
\`\`\`

### Expected Results
- Page loads correctly
- List displays items

---

## UI Elements

| Element | Selector | Description |
|---------|----------|-------------|
| Container | \`[data-cy="${entityName}-container"]\` | Main container |
| List | \`[data-cy="${entityName}-list"]\` | Items list |
| Item | \`[data-cy="${entityName}-item"]\` | Individual item |
| Form | \`[data-cy="${entityName}-form"]\` | Create/Edit form |
| Submit | \`[data-cy="${entityName}-submit"]\` | Submit button |

---

## Summary

| Test ID | Block | Description | Tags |
|---------|-------|-------------|------|
| ${entityName.toUpperCase()}-001 | Access | List access | \`@smoke\` |
| ${entityName.toUpperCase()}-002 | CRUD | Create item | |
| ${entityName.toUpperCase()}-003 | CRUD | Edit item | |
| ${entityName.toUpperCase()}-004 | CRUD | Delete item | |
`
})
```

---

## Step 9: Run Tests

```typescript
// Run tests using the correct command (auto-detects active theme)
await Bash({
  command: `pnpm cy:run -- --spec "cypress/e2e/**/*${entityName}*.cy.ts"`,
  description: 'Run entity tests'
})

// Or run by tag
await Bash({
  command: `pnpm cy:run -- --env grepTags=@feat-${entityName}`,
  description: 'Run tests by feature tag'
})
```

---

## Output Format

```markdown
## Tests Created: ${EntityName}

### Files Created
- **API Tests:** \`contents/themes/{activeTheme}/tests/cypress/e2e/api/${entityName}.cy.ts\`
- **UAT Tests:** \`contents/themes/{activeTheme}/tests/cypress/e2e/uat/${entityName}.cy.ts\`
- **BDD Docs:** \`contents/themes/{activeTheme}/tests/cypress/e2e/uat/${entityName}.bdd.md\`
- **Page Object:** \`contents/themes/{activeTheme}/tests/cypress/support/page-objects/${entityName}.page.ts\`
- **Selectors:** Updated \`core/lib/test/core-selectors.ts\` OR \`contents/themes/{theme}/tests/cypress/src/selectors.ts\`

### Test Coverage

**API Tests (12 tests):**
- GET /api/v1/${entityName} - List all
- GET /api/v1/${entityName}/:id - Get single
- POST /api/v1/${entityName} - Create
- PATCH /api/v1/${entityName}/:id - Update
- DELETE /api/v1/${entityName}/:id - Delete
- Auth tests (401, 403)
- Validation tests (400)
- Not found tests (404)

**UAT Tests (15 tests):**
- Happy path CRUD
- Form validation
- Search/filter functionality
- Edge cases (special chars, long text)
- Loading states
- Accessibility (keyboard, ARIA)

### Data-cy Selectors Required
Ensure these selectors exist in components:
\`\`\`
${entityName}-page-title
${entityName}-container
${entityName}-list
${entityName}-item
${entityName}-card-{id}
${entityName}-create-button
${entityName}-edit-{id}
${entityName}-delete-{id}
${entityName}-form
${entityName}-name-input
${entityName}-submit-button
\`\`\`

### Next Steps
1. Run \`/test:run\` to execute tests
2. If failures, run \`/test:fix\` to auto-repair
3. Add missing data-cy selectors to components
4. Verify BDD file is complete and accurate
```

---

## Common Grep Tags

| Tag | Description | Usage |
|-----|-------------|-------|
| `@smoke` | Critical path tests | `pnpm cy:run -- --env grepTags=@smoke` |
| `@uat` | User acceptance tests | `pnpm cy:run -- --env grepTags=@uat` |
| `@api` | API endpoint tests | `pnpm cy:run -- --env grepTags=@api` |
| `@in-develop` | Tests being fixed | `pnpm cy:run -- --env grepTags=@in-develop` |
| `@feat-{name}` | Feature-specific | `pnpm cy:run -- --env grepTags=@feat-admin` |

---

**Now create tests for the feature or entity described above.**
