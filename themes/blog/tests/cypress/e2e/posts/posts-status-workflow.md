# Posts Status Workflow - E2E Tests

## Overview

Tests for publish/unpublish workflow and auto-save functionality in the Blog theme.

**Test File:** `test/cypress/e2e/themes/blog/posts/posts-status-workflow.cy.ts`

## Workflow Description

Posts have two statuses:
- **Draft** - Not visible to public
- **Published** - Visible on public blog

The workflow supports:
- Publishing from list (quick action)
- Publishing from editor (full control)
- Unpublishing (reverting to draft)
- Auto-save for drafts
- Featured post management

## Test Coverage

### 1. PUBLISH - Draft to Published (2 tests)

| ID | Test Case | Description | Status |
|----|-----------|-------------|--------|
| BLOG_STATUS_001 | Publish from list | Publish draft via list actions menu | ✅ Passing |
| BLOG_STATUS_002 | Publish from editor | Publish draft from edit page | ✅ Passing |

### 2. UNPUBLISH - Published to Draft (2 tests)

| ID | Test Case | Description | Status |
|----|-----------|-------------|--------|
| BLOG_STATUS_003 | Unpublish from list | Unpublish via list actions menu | ✅ Passing |
| BLOG_STATUS_004 | Unpublish from editor | Unpublish from edit page | ✅ Passing |

### 3. AUTO-SAVE (2 tests)

| ID | Test Case | Description | Status |
|----|-----------|-------------|--------|
| BLOG_STATUS_005 | Auto-save indicator | Validate auto-save works | ✅ Passing |
| BLOG_STATUS_006 | Unsaved changes | Show unsaved changes indicator | ✅ Passing |

### 4. FEATURED Posts (2 tests)

| ID | Test Case | Description | Status |
|----|-----------|-------------|--------|
| BLOG_STATUS_007 | Mark as featured | Toggle featured on | ✅ Passing |
| BLOG_STATUS_008 | Remove featured | Toggle featured off | ✅ Passing |

## Summary

| Category | Total | Passing | Pending | Failing |
|----------|-------|---------|---------|---------|
| PUBLISH | 2 | 2 | 0 | 0 |
| UNPUBLISH | 2 | 2 | 0 | 0 |
| AUTO-SAVE | 2 | 2 | 0 | 0 |
| FEATURED | 2 | 2 | 0 | 0 |
| **Total** | **8** | **8** | **0** | **0** |

## Data-cy Selectors Used

```
[data-cy="post-edit-status"]
[data-cy="post-edit-autosaved"]
[data-cy="post-edit-publish"]
[data-cy="post-edit-unpublish"]
[data-cy="post-edit-featured-toggle"]
[data-cy="posts-publish-{id}"]
[data-cy="posts-unpublish-{id}"]
[data-cy="posts-status-{id}"]
```

## Running Tests

```bash
npx cypress run --spec "test/cypress/e2e/themes/blog/posts/posts-status-workflow.cy.ts"
```

---

**Last Updated:** 2025-12-04
