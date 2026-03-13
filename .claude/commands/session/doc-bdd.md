---
disable-model-invocation: true
---

# /session:doc:bdd

Generate BDD documentation (.bdd.md) from Cypress tests.

---

## Required Skills

**[MANDATORY]** Read before executing:
- `.claude/skills/cypress-api/SKILL.md` - Understand API test structure
- `.claude/skills/cypress-e2e/SKILL.md` - Understand UAT test structure
- `.claude/skills/documentation/SKILL.md` - Documentation patterns

---

## Syntax

```
/session:doc:bdd [--spec <pattern>]
```

---

## Behavior

Creates human-readable BDD documentation from existing Cypress test files.

---

## Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  /session:doc:bdd                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Find Cypress test files                                     │
│     ↓                                                           │
│  2. Parse test structure                                        │
│     - describe blocks                                           │
│     - it statements                                             │
│     - grep tags                                                 │
│     ↓                                                           │
│  3. Generate Gherkin scenarios                                  │
│     - Feature description                                       │
│     - Scenarios from tests                                      │
│     - Multi-locale support                                      │
│     ↓                                                           │
│  4. Create .bdd.md files                                        │
│     ↓                                                           │
│  5. Update test registry                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Example Output

```
📝 GENERATE BDD DOCUMENTATION

Session: stories/2026-01-11-new-products-entity

─────────────────────────────────────────

🔍 FINDING TEST FILES

Spec pattern: cypress/e2e/**/*products*.cy.ts

Found:
├─ cypress/e2e/api/products.cy.ts (12 tests)
└─ cypress/e2e/uat/products.cy.ts (8 tests)

─────────────────────────────────────────

📝 PARSING: products.cy.ts (API)

Extracting structure...
├─ describe: "@api @products Products API"
│   ├─ describe: "@crud CRUD Operations"
│   │   ├─ it: "@create should create a product"
│   │   ├─ it: "@read should get product by ID"
│   │   └─ ...
│   └─ describe: "@auth Authentication"
│       └─ ...

─────────────────────────────────────────

📝 GENERATING BDD

File: cypress/e2e/api/products.bdd.md

```markdown
# Products API

**File:** `cypress/e2e/api/products.cy.ts`
**Tags:** `@api` `@products`

## Feature: Products CRUD Operations

As an API consumer
I want to manage products via REST API
So that I can integrate product management into my application

### Scenario: Create a new product
**Tags:** `@api` `@crud` `@create`

```gherkin
Given I am authenticated with a valid API key
When I POST to /api/v1/products with valid data
  | name        | Test Product |
  | price       | 99.99        |
  | categoryId  | {category}   |
Then the response status should be 201
And the response should contain the created product
And the product should have a generated UUID
```

### Scenario: Get product by ID
**Tags:** `@api` `@crud` `@read`

```gherkin
Given a product exists with ID {productId}
When I GET /api/v1/products/{productId}
Then the response status should be 200
And the response should contain the product details
```

### Scenario: Reject unauthenticated request
**Tags:** `@api` `@auth` `@unauthorized`

```gherkin
Given I am not authenticated
When I POST to /api/v1/products
Then the response status should be 401
And the response should contain "Unauthorized"
```

---

## Multi-Locale Support (en, es)

### Scenario: Create a new product

**English:**
```gherkin
Given I am authenticated with a valid API key
When I POST to /api/v1/products with valid data
Then the response status should be 201
```

**Español:**
```gherkin
Dado que estoy autenticado con una API key válida
Cuando hago POST a /api/v1/products con datos válidos
Entonces el código de respuesta debe ser 201
```
```

─────────────────────────────────────────

📁 FILES CREATED

├─ cypress/e2e/api/products.bdd.md
└─ cypress/e2e/uat/products.bdd.md

─────────────────────────────────────────

📊 SUMMARY

Tests documented: 20
Scenarios generated: 20
Locales: 2 (en, es)

BDD documentation complete.
```

---

## BDD Format

Each `.bdd.md` file includes:

1. **Feature header** - File reference and tags
2. **Feature description** - User story format
3. **Scenarios** - Gherkin format with tags
4. **Multi-locale** - Translations if configured

---

## Options

| Option | Description |
|--------|-------------|
| `--spec <pattern>` | Specific test files |
| `--locale <code>` | Generate for specific locale |
| `--update` | Update existing BDD files |

---

## Related Commands

| Command | Action |
|---------|--------|
| `/session:test:write` | Write Cypress tests |
| `/session:doc:feature` | Feature documentation |
