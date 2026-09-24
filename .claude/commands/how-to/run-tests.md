# /how-to:run-tests

Interactive guide to run tests in NextSpark.

---

## Required Skills

Before executing, these skills provide deeper context:
- `.claude/skills/cypress-api/SKILL.md` - API testing patterns
- `.claude/skills/cypress-e2e/SKILL.md` - E2E testing patterns
- `.claude/skills/jest-unit/SKILL.md` - Unit testing patterns

---

## Syntax

```
/how-to:run-tests
```

---

## Behavior

Guides the user through running API tests, E2E tests, and unit tests.

---

## Tutorial Overview

```
STEPS OVERVIEW (4 steps)

Step 1: Understanding Test Types
        └── API, E2E, Unit tests

Step 2: Run API Tests
        └── Cypress API tests

Step 3: Run E2E/UAT Tests
        └── Cypress browser tests

Step 4: Run Unit Tests
        └── Jest unit tests
```

---

## Step 1: Understanding Test Types

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 HOW TO: RUN TESTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1 OF 4: Understanding Test Types

NextSpark uses three types of tests:

┌─────────────────────────────────────────────┐
│  TEST TYPES                                 │
│  ─────────────────────────────────────────  │
│                                             │
│  1. API TESTS (Cypress)                     │
│     Test API endpoints directly             │
│     Fast, no browser needed                 │
│                                             │
│  2. E2E/UAT TESTS (Cypress)                 │
│     Test user flows in browser              │
│     Slower, but comprehensive               │
│                                             │
│  3. UNIT TESTS (Jest)                       │
│     Test individual functions               │
│     Fastest, isolated                       │
│                                             │
└─────────────────────────────────────────────┘

```

**📂 Test File Locations:**

```
tests/
├── cypress/
│   ├── e2e/
│   │   ├── api/           # API tests
│   │   │   └── products.cy.ts
│   │   └── uat/           # E2E tests
│   │       └── products.cy.ts
│   └── support/
│       └── commands.ts
└── jest/
    └── unit/              # Unit tests
        └── services/
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What type of tests would you like to run?

[1] API Tests (fastest)
[2] E2E/UAT Tests (browser)
[3] Unit Tests (Jest)
[4] Run all tests
```

---

## Step 2: Run API Tests

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 OF 4: Run API Tests
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**📋 Run All API Tests:**

```bash
# Make sure dev server is running
pnpm dev

# In another terminal, run API tests
pnpm test:api

# Or run with UI
pnpm test:api:open
```

**📋 Run Specific API Tests:**

```bash
# Run tests for a specific entity
pnpm test:api --spec "**/api/products.cy.ts"

# Run tests by grep pattern
pnpm test:api --env grepTags="@smoke"

# Run tests by priority
pnpm test:api --env grepTags="@P0"
```

**📋 API Test Example:**

```typescript
// tests/cypress/e2e/api/products.cy.ts
describe('Products API', { tags: ['@api', '@products'] }, () => {
  beforeEach(() => {
    cy.getApiKey().as('apiKey')
  })

  it('should list products', { tags: ['@P0', '@smoke'] }, function() {
    cy.request({
      method: 'GET',
      url: '/api/v1/entities/products',
      headers: { Authorization: `Bearer ${this.apiKey}` },
    }).then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body.success).to.be.true
      expect(response.body.data).to.be.an('array')
    })
  })

  it('should create product', { tags: ['@P1'] }, function() {
    cy.request({
      method: 'POST',
      url: '/api/v1/entities/products',
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: {
        name: 'Test Product',
        price: 99.99,
        sku: 'TEST-001',
      },
    }).then((response) => {
      expect(response.status).to.eq(201)
    })
  })
})
```

```
What would you like to do?

[1] Continue to Step 3 (E2E Tests)
[2] Show me how to write API tests
[3] How do I debug failing tests?
```

---

## Step 3: Run E2E/UAT Tests

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 OF 4: Run E2E/UAT Tests
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**📋 Run All E2E Tests:**

```bash
# Run in headless mode
pnpm test:e2e

# Run with Cypress UI (recommended for debugging)
pnpm test:e2e:open
```

**📋 Run Specific E2E Tests:**

```bash
# Run tests for specific feature
pnpm test:e2e --spec "**/uat/products.cy.ts"

# Run smoke tests only
pnpm test:e2e --env grepTags="@smoke"

# Run tests in specific browser
pnpm test:e2e --browser chrome
```

**📋 E2E Test Example:**

```typescript
// tests/cypress/e2e/uat/products.cy.ts
import { ProductsPOM } from '../../support/pom/ProductsPOM'

describe('Products Management', { tags: ['@uat', '@products'] }, () => {
  let pom: ProductsPOM

  beforeEach(() => {
    // Login with session caching
    cy.session('admin', () => {
      cy.login('admin@test.com', 'Test1234')
    })

    cy.visit('/dashboard/products')
    pom = new ProductsPOM()
  })

  it('should display products list', { tags: ['@P0', '@smoke'] }, () => {
    pom.shouldBeVisible()
    pom.shouldHaveProducts()
  })

  it('should create a new product', { tags: ['@P1'] }, () => {
    pom.clickCreateButton()
    pom.fillProductForm({
      name: 'New Product',
      price: 49.99,
      sku: 'NEW-001',
    })
    pom.submitForm()
    pom.shouldShowSuccess('Product created')
  })

  it('should edit existing product', { tags: ['@P1'] }, () => {
    pom.clickFirstProduct()
    pom.clickEditButton()
    pom.updateField('name', 'Updated Product')
    pom.submitForm()
    pom.shouldShowSuccess('Product updated')
  })
})
```

**📋 Test Tags:**

| Tag | Purpose |
|-----|---------|
| @smoke | Critical path tests |
| @P0 | Highest priority |
| @P1 | High priority |
| @P2 | Medium priority |
| @api | API tests |
| @uat | User acceptance tests |

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 4 (Unit Tests)
[2] Show me how to write E2E tests
[3] How do I use Page Object Models?
```

---

## Step 4: Run Unit Tests

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 OF 4: Run Unit Tests
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**📋 Run All Unit Tests:**

```bash
# Run all Jest tests
pnpm test:unit

# Run with coverage
pnpm test:unit --coverage

# Run in watch mode
pnpm test:unit --watch
```

**📋 Run Specific Unit Tests:**

```bash
# Run tests for specific file
pnpm test:unit -- products.test.ts

# Run tests matching pattern
pnpm test:unit -- --testNamePattern="should calculate"

# Run tests in specific directory
pnpm test:unit -- services/
```

**📋 Unit Test Example:**

```typescript
// tests/jest/unit/services/products.test.ts
import { ProductsService } from '@/core/lib/services/products.service'

describe('ProductsService', () => {
  describe('calculateDiscount', () => {
    it('should calculate percentage discount', () => {
      const result = ProductsService.calculateDiscount(100, 20)
      expect(result).toBe(80)
    })

    it('should handle zero discount', () => {
      const result = ProductsService.calculateDiscount(100, 0)
      expect(result).toBe(100)
    })

    it('should round to 2 decimal places', () => {
      const result = ProductsService.calculateDiscount(99.99, 15)
      expect(result).toBe(84.99)
    })
  })

  describe('validateSKU', () => {
    it('should accept valid SKU format', () => {
      expect(ProductsService.validateSKU('PROD-001')).toBe(true)
    })

    it('should reject invalid SKU', () => {
      expect(ProductsService.validateSKU('')).toBe(false)
      expect(ProductsService.validateSKU('invalid sku')).toBe(false)
    })
  })
})
```

**📋 Run All Tests:**

```bash
# Run complete test suite
pnpm test

# This runs:
# 1. Unit tests (Jest)
# 2. API tests (Cypress)
# 3. E2E tests (Cypress)
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ TUTORIAL STORY!

You've learned:
• API tests with Cypress
• E2E/UAT tests with Cypress
• Unit tests with Jest
• Test tags and filtering

📚 Related tutorials:
   • /session:test:write - Write new tests
   • /session:test:fix - Fix failing tests

🔙 Back to menu: /how-to:start
```

---

## Related Commands

| Command | Action |
|---------|--------|
| `/session:test:write` | Write tests |
| `/session:test:run` | Run tests (workflow) |
