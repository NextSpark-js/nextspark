# Categories CRUD - E2E Tests

## Overview

Tests for Categories entity CRUD operations in the Blog theme.

**Test File:** `test/cypress/e2e/themes/blog/categories/categories-crud.cy.ts`

## Entity Characteristics

| Property | Value |
|----------|-------|
| **Entity** | Categories |
| **UI** | Generic (EntityList, EntityForm) |
| **Team Mode** | Single-user (isolated) |
| **Fields** | name, slug, description |

## Test Coverage

### 1. CREATE (3 tests)

| ID | Test Case | Description | Status |
|----|-----------|-------------|--------|
| BLOG_CAT_CREATE_001 | Create category | Create with name and slug | ✅ Passing |
| BLOG_CAT_CREATE_002 | Create with description | Create with all fields | ✅ Passing |
| BLOG_CAT_CREATE_003 | Validation empty name | Show error for empty name | ✅ Passing |

### 2. READ (2 tests)

| ID | Test Case | Description | Status |
|----|-----------|-------------|--------|
| BLOG_CAT_READ_001 | View categories list | Display list of categories | ✅ Passing |
| BLOG_CAT_READ_002 | Search categories | Search by name | ✅ Passing |

### 3. UPDATE (2 tests)

| ID | Test Case | Description | Status |
|----|-----------|-------------|--------|
| BLOG_CAT_UPDATE_001 | Edit name | Update category name | ✅ Passing |
| BLOG_CAT_UPDATE_002 | Edit description | Update description | ✅ Passing |

### 4. DELETE (2 tests)

| ID | Test Case | Description | Status |
|----|-----------|-------------|--------|
| BLOG_CAT_DELETE_001 | Delete category | Confirm and delete | ✅ Passing |
| BLOG_CAT_DELETE_002 | Cancel delete | Cancel delete operation | ✅ Passing |

## Summary

| Category | Total | Passing | Pending | Failing |
|----------|-------|---------|---------|---------|
| CREATE | 3 | 3 | 0 | 0 |
| READ | 2 | 2 | 0 | 0 |
| UPDATE | 2 | 2 | 0 | 0 |
| DELETE | 2 | 2 | 0 | 0 |
| **Total** | **9** | **9** | **0** | **0** |

## POM Classes

Uses generic entity classes:
- **EntityList:** `test/cypress/src/classes/components/entities/EntityList.js`
- **EntityForm:** `test/cypress/src/classes/components/entities/EntityForm.js`

## Running Tests

```bash
npx cypress run --spec "test/cypress/e2e/themes/blog/categories/categories-crud.cy.ts"
```

---

**Last Updated:** 2025-12-04
