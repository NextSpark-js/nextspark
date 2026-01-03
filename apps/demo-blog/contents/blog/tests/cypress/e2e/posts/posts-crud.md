# Posts CRUD - E2E Tests

## Overview

Tests for Posts entity CRUD operations in the Blog theme.

**Test File:** `test/cypress/e2e/themes/blog/posts/posts-crud.cy.ts`

## Entity Characteristics

| Property | Value |
|----------|-------|
| **Entity** | Posts |
| **UI** | Custom (PostsList, PostEditor) |
| **Team Mode** | Single-user (isolated) |
| **Status** | Draft/Published workflow |
| **Features** | Featured toggle, WYSIWYG editor |

## Test Users

| Author | Email | Role |
|--------|-------|------|
| Marcos Tech | blog_author_marcos@nextspark.dev | Owner |
| Lucia Lifestyle | blog_author_lucia@nextspark.dev | Owner |
| Carlos Finance | blog_author_carlos@nextspark.dev | Owner |

**Password:** `Test1234`

## Test Coverage

### 1. CREATE (4 tests)

| ID | Test Case | Description | Status |
|----|-----------|-------------|--------|
| BLOG_POST_CREATE_001 | Create draft post | Create a new post as draft | ✅ Passing |
| BLOG_POST_CREATE_002 | Create and publish immediately | Create post and publish in one action | ✅ Passing |
| BLOG_POST_CREATE_003 | Create with all metadata | Create post with slug, excerpt, featured | ✅ Passing |
| BLOG_POST_CREATE_004 | Validation error empty title | Show error when title is empty | ✅ Passing |

### 2. READ (5 tests)

| ID | Test Case | Description | Status |
|----|-----------|-------------|--------|
| BLOG_POST_READ_001 | View posts in table mode | Display posts in table layout | ✅ Passing |
| BLOG_POST_READ_002 | View posts in grid mode | Display posts in grid layout | ✅ Passing |
| BLOG_POST_READ_003 | Filter by status | Filter posts by published/draft | ✅ Passing |
| BLOG_POST_READ_004 | Search posts | Search posts by title | ✅ Passing |
| BLOG_POST_READ_005 | View post details | Navigate to edit page | ✅ Passing |

### 3. UPDATE (4 tests)

| ID | Test Case | Description | Status |
|----|-----------|-------------|--------|
| BLOG_POST_UPDATE_001 | Edit title and content | Update post title and content | ✅ Passing |
| BLOG_POST_UPDATE_002 | Change status | Publish draft post | ✅ Passing |
| BLOG_POST_UPDATE_003 | Toggle featured flag | Mark post as featured | ✅ Passing |
| BLOG_POST_UPDATE_004 | Update URL slug | Change post slug | ✅ Passing |

### 4. DELETE (3 tests)

| ID | Test Case | Description | Status |
|----|-----------|-------------|--------|
| BLOG_POST_DELETE_001 | Delete draft post | Delete post from list actions | ✅ Passing |
| BLOG_POST_DELETE_002 | Delete from edit page | Delete post from editor | ✅ Passing |
| BLOG_POST_DELETE_003 | Cancel delete | Cancel delete operation | ✅ Passing |

## Summary

| Category | Total | Passing | Pending | Failing |
|----------|-------|---------|---------|---------|
| CREATE | 4 | 4 | 0 | 0 |
| READ | 5 | 5 | 0 | 0 |
| UPDATE | 4 | 4 | 0 | 0 |
| DELETE | 3 | 3 | 0 | 0 |
| **Total** | **16** | **16** | **0** | **0** |

## Data-cy Selectors Used

### PostsList

```
[data-cy="posts-list-container"]
[data-cy="posts-stat-{status}"]
[data-cy="posts-search-input"]
[data-cy="posts-view-{mode}"]
[data-cy="posts-row-{id}"]
[data-cy="posts-actions-{id}"]
[data-cy="posts-create-button"]
```

### PostEditor

```
[data-cy="post-{mode}-container"]
[data-cy="post-{mode}-title"]
[data-cy="post-{mode}-content"]
[data-cy="post-{mode}-save"]
[data-cy="post-{mode}-publish"]
```

## POM Classes

- **PostsList:** `test/cypress/src/classes/themes/blog/PostsList.js`
- **PostEditor:** `test/cypress/src/classes/themes/blog/PostEditor.js`
- **WysiwygEditor:** `test/cypress/src/classes/themes/blog/WysiwygEditor.js`

## Running Tests

```bash
npx cypress run --spec "test/cypress/e2e/themes/blog/posts/posts-crud.cy.ts"
```

---

**Last Updated:** 2025-12-04
