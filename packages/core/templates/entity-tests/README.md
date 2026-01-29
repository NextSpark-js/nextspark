# Entity Test Templates

This directory contains templates for generating Cypress tests for new entities. The `qa-automation` agent uses these templates to automatically create test files when implementing new features.

## Overview

Templates use `{{PLACEHOLDER}}` syntax that gets replaced with actual values during generation. This ensures consistent test patterns across all entities.

## Directory Structure

```
entity-tests/
├── README.md                    # This file
├── pom/
│   └── EntityPOM.ts.template   # Page Object Model template
├── controllers/
│   └── EntityAPIController.js.template  # API controller template
├── e2e/
│   ├── entity-crud.cy.ts.template      # API CRUD tests
│   └── entity-owner.cy.ts.template     # UAT owner tests
└── selectors/
    └── entity-selectors.cy.ts.template # UI selector validation
```

## Available Templates

### 1. EntityPOM.ts.template

**Purpose:** Generate Page Object Model class for UI testing

**Location:** `pom/EntityPOM.ts.template`

**Generated file:** `src/components/{{ENTITY_PASCAL}}POM.ts`

**Key features:**
- Extends `DashboardEntityPOM` base class
- Entity-specific form filling methods
- CRUD workflow methods with API waits
- Assertion helpers

### 2. EntityAPIController.js.template

**Purpose:** Generate API controller for API testing

**Location:** `controllers/EntityAPIController.js.template`

**Generated file:** `src/controllers/{{ENTITY_PASCAL}}APIController.js`

**Key features:**
- Extends `BaseAPIController` base class
- CRUD operations (list, getById, create, update, delete)
- Data generators for test data
- Entity-specific validators

### 3. entity-crud.cy.ts.template

**Purpose:** Generate API CRUD test suite

**Location:** `e2e/entity-crud.cy.ts.template`

**Generated file:** `e2e/api/{{ENTITY_SLUG}}/{{ENTITY_SLUG}}-crud.cy.ts`

**Key features:**
- Full CRUD test coverage (LIST, CREATE, GET, UPDATE, DELETE)
- Authentication and team context tests
- Integration lifecycle test
- Automatic cleanup

### 4. entity-owner.cy.ts.template

**Purpose:** Generate UAT tests for owner role

**Location:** `e2e/entity-owner.cy.ts.template`

**Generated file:** `e2e/{{ENTITY_SLUG}}/{{ENTITY_SLUG}}-owner.cy.ts`

**Key features:**
- Full CRUD UI tests with owner permissions
- Uses POM for interactions
- API intercepts for deterministic waits
- Allure reporting integration

### 5. entity-selectors.cy.ts.template

**Purpose:** Generate UI selector validation tests

**Location:** `selectors/entity-selectors.cy.ts.template`

**Generated file:** `e2e/ui-selectors/{{ENTITY_SLUG}}-selectors.cy.ts`

**Key features:**
- Validates data-cy selectors exist
- Tests list, create, and detail pages
- Runs during frontend-validator phase (Phase 12)
- Tagged with `@ui-selectors`

## Placeholder Reference

| Placeholder | Example | Description |
|-------------|---------|-------------|
| `{{ENTITY_SLUG}}` | `customers` | Entity slug (lowercase, hyphenated) |
| `{{ENTITY_SLUG_UPPER}}` | `CUSTOMERS` | Entity slug uppercase for test IDs |
| `{{ENTITY_PASCAL}}` | `Customers` | PascalCase name for classes |
| `{{ENTITY_CAMEL}}` | `customers` | camelCase name for variables |
| `{{ENTITY_PLURAL}}` | `Customers` | Plural display name |
| `{{ENTITY_SINGULAR}}` | `customer` | Singular name for comments |
| `{{SESSION_NAME}}` | `customer-management` | Current session for scope tags |
| `{{TIMESTAMP}}` | `2024-12-19T10:30:00Z` | Generation timestamp |

## Usage by qa-automation Agent

The `qa-automation` agent (Phase 15) uses these templates to generate tests:

1. **Reads entity configuration** from `entities.json`
2. **Loads appropriate template** based on test type needed
3. **Replaces placeholders** with entity-specific values
4. **Writes generated file** to correct location
5. **Customizes TODOs** based on entity schema

### Example Generation Flow

```
Input: Generate tests for "customers" entity

1. Load EntityPOM.ts.template
2. Replace {{ENTITY_SLUG}} → customers
3. Replace {{ENTITY_PASCAL}} → Customers
4. Replace {{SESSION_NAME}} → current-session
5. Write to src/components/CustomersPOM.ts
6. Repeat for other templates...
```

## Manual Usage

Developers can manually use these templates:

### Step 1: Copy Template

```bash
cp core/templates/entity-tests/pom/EntityPOM.ts.template \
   contents/themes/default/tests/cypress/src/components/CustomersPOM.ts
```

### Step 2: Replace Placeholders

Use find/replace in your editor:
- `{{ENTITY_SLUG}}` → `customers`
- `{{ENTITY_PASCAL}}` → `Customers`
- `{{ENTITY_CAMEL}}` → `customers`
- `{{ENTITY_PLURAL}}` → `Customers`
- `{{ENTITY_SINGULAR}}` → `customer`
- `{{SESSION_NAME}}` → `your-session-name`
- `{{TIMESTAMP}}` → current date

### Step 3: Customize TODOs

Search for `TODO:` comments and implement:
- Form data interface fields
- Form filling logic
- Data generators
- Validators

## Base Classes Reference

Templates depend on base classes in the theme preset:

| Base Class | Location | Purpose |
|------------|----------|---------|
| `DashboardEntityPOM` | `src/core/DashboardEntityPOM.ts` | Standard CRUD POM operations |
| `BasePOM` | `src/core/BasePOM.ts` | Core POM functionality |
| `BaseAPIController` | `src/controllers/BaseAPIController.js` | API CRUD operations |
| `ApiInterceptor` | `src/helpers/ApiInterceptor.ts` | Deterministic API waits |

## Working Example

See the Tasks example in the theme preset for a complete implementation:

```
core/templates/contents/themes/starter/tests/cypress/_examples/tasks/
├── TasksPOM.ts           # POM implementation
├── TaskAPIController.js  # API controller
├── tasks-owner.cy.ts     # UAT tests
└── tasks-crud.cy.ts      # API tests
```

## Tags Convention

Generated tests use these tag patterns:

| Tag | Purpose |
|-----|---------|
| `@api` | API test suite |
| `@uat` | User Acceptance Test |
| `@feat-{slug}` | Feature identifier |
| `@crud` | CRUD operations |
| `@role-owner` | Owner role tests |
| `@scope-{session}` | Session scope |
| `@ui-selectors` | Selector validation |
| `@smoke` | Critical path tests |
| `@regression` | Full regression suite |

## Notes

- **Permission tests excluded:** Member role permission tests (`entity-member.cy.ts.template`) are not included - they will be handled differently in a future implementation.
- **Customization required:** Generated files contain `TODO:` markers for entity-specific implementation.
- **Base class dependency:** Templates assume base classes are available from the theme preset.
