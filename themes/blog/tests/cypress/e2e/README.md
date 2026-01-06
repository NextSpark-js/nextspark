# Blog Theme - E2E Testing Suite

## Overview

Complete E2E testing infrastructure for the Blog theme. The blog theme operates in **single-user mode** where each user owns their own isolated blog without team collaboration.

## Test Status: ✅ All Tests Passing (52/52)

| Test File | Tests | Status |
|-----------|-------|--------|
| `categories/categories-crud.cy.ts` | 9 | ✅ Passing |
| `posts/posts-crud.cy.ts` | 16 | ✅ Passing |
| `posts/posts-editor.cy.ts` | 19 | ✅ Passing |
| `posts/posts-status-workflow.cy.ts` | 8 | ✅ Passing |
| **Total** | **52** | **100%** |

## Test Structure

```
test/cypress/e2e/themes/blog/
├── posts/
│   ├── posts-crud.cy.ts           # Full CRUD operations (16 tests)
│   ├── posts-status-workflow.cy.ts # Publish/Unpublish workflow (8 tests)
│   └── posts-editor.cy.ts         # WYSIWYG editor tests (19 tests)
├── categories/
│   └── categories-crud.cy.ts      # Standard CRUD (9 tests)
└── README.md                      # This file
```

## Test Users

All blog theme tests use isolated blog author accounts:

| Author | Email | Description |
|--------|-------|-------------|
| **Marcos** (Primary) | `blog_author_marcos@nextspark.dev` | Main test author |
| Lucia | `blog_author_lucia@nextspark.dev` | Lifestyle blog author |
| Carlos | `blog_author_carlos@nextspark.dev` | Finance blog author |

**Password for all users:** `Test1234`

## POM Classes

Blog theme POM classes are located at `test/cypress/src/classes/themes/blog/`:

| Class | Description |
|-------|-------------|
| `PostsList.js` | Posts list page interactions (filters, views, actions) |
| `PostEditor.js` | Create/Edit post pages (supports both modes) |
| `WysiwygEditor.js` | Rich text editor component |
| `FeaturedImageUpload.js` | Image upload component |
| `session-helpers.ts` | Blog-specific login helpers |

## Session Helpers

Blog theme has its own session helpers for isolated login:

```typescript
import { loginAsBlogAuthor, BLOG_USERS } from '../../../src/session-helpers'

// Login as default author (Marcos)
loginAsBlogAuthor('MARCOS')

// Login as specific author
loginAsBlogAuthor('LUCIA')
loginAsBlogAuthor('CARLOS')
```

## Running Tests

```bash
# Run all blog theme tests
npx cypress run --spec "test/cypress/e2e/themes/blog/**/*.cy.ts"

# Run only posts tests
npx cypress run --spec "test/cypress/e2e/themes/blog/posts/**/*.cy.ts"

# Run only categories tests
npx cypress run --spec "test/cypress/e2e/themes/blog/categories/**/*.cy.ts"

# Run with blog theme active
NEXT_PUBLIC_ACTIVE_THEME=blog npx cypress run --spec "test/cypress/e2e/themes/blog/**/*.cy.ts"
```

## Data-cy Selectors

### Posts List Page

```
[data-cy="posts-list-container"]
[data-cy="posts-stat-all|published|draft|scheduled"]
[data-cy="posts-search-input"]
[data-cy="posts-sort-select"]
[data-cy="posts-view-table|grid"]
[data-cy="posts-row-{id}"]
[data-cy="posts-title-{id}"]
[data-cy="posts-status-{id}"]
[data-cy="posts-actions-{id}"]
[data-cy="posts-edit-{id}"]
[data-cy="posts-publish-{id}"]
[data-cy="posts-delete-{id}"]
[data-cy="posts-create-button"]
[data-cy="posts-delete-dialog"]
[data-cy="posts-delete-confirm|cancel"]
```

### Post Editor (Create/Edit)

```
[data-cy="post-{mode}-container"]       # mode = create|edit
[data-cy="post-{mode}-header"]
[data-cy="post-{mode}-back"]
[data-cy="post-{mode}-status"]
[data-cy="post-{mode}-autosaved"]
[data-cy="post-{mode}-save"]
[data-cy="post-{mode}-publish"]
[data-cy="post-{mode}-unpublish"]       # edit only
[data-cy="post-{mode}-title"]
[data-cy="post-{mode}-content"]
[data-cy="post-{mode}-settings"]
[data-cy="post-{mode}-status-select"]
[data-cy="post-{mode}-slug"]
[data-cy="post-{mode}-excerpt"]
[data-cy="post-{mode}-featured-image"]
[data-cy="post-{mode}-featured-toggle"]
[data-cy="post-{mode}-delete"]          # edit only
[data-cy="post-{mode}-delete-dialog"]
```

### WYSIWYG Editor

```
[data-cy="wysiwyg-container"]
[data-cy="wysiwyg-toolbar"]
[data-cy="wysiwyg-content"]
[data-cy="wysiwyg-preview"]
[data-cy="wysiwyg-preview-toggle"]
[data-cy="wysiwyg-{command}"]           # undo, redo, bold, italic, etc.
[data-cy="wysiwyg-formatBlock-{tag}"]   # h1, h2, h3, blockquote, pre
[data-cy="wysiwyg-wordcount"]
```

### Featured Image Upload

```
[data-cy="featured-image-container"]
[data-cy="featured-image-dropzone"]
[data-cy="featured-image-input"]
[data-cy="featured-image-preview"]
[data-cy="featured-image-remove"]
[data-cy="featured-image-loading"]
[data-cy="featured-image-error"]
```

## Dependencies

- Generic POM classes from `test/cypress/src/classes/components/entities/`
- DevKeyring for authentication: `test/cypress/src/classes/components/auth/DevKeyring.js`
- Core session helpers (NOT modified): `test/cypress/src/helpers/session-helpers.ts`

## Notes

- Blog theme uses **custom UI** for posts (PostsList, PostEditor) unlike generic EntityList/EntityForm
- Categories use the **generic EntityList/EntityForm** pattern
- All tests use **cy.session()** for cached authentication (3-5x faster)
- Tests are designed to be **self-contained** and create their own test data

---

**Last Updated:** 2025-12-04
