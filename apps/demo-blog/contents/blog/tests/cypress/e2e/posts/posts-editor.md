# Posts Editor (WYSIWYG) - E2E Tests

## Overview

Tests for WYSIWYG editor formatting and functionality in the Blog theme.

**Test File:** `test/cypress/e2e/themes/blog/posts/posts-editor.cy.ts`

## Editor Features

The WYSIWYG editor supports:
- Text formatting (bold, italic, underline, strikethrough)
- Headings (H1, H2, H3)
- Lists (bullet, ordered)
- Blocks (blockquote, code)
- Media (links, images, horizontal rule)
- Undo/Redo
- Preview mode
- Word count

## Test Coverage

### 1. TEXT FORMATTING (3 tests)

| ID | Test Case | Description | Status |
|----|-----------|-------------|--------|
| BLOG_EDITOR_001 | Apply bold | Toggle bold formatting | ✅ Passing |
| BLOG_EDITOR_002 | Apply italic | Toggle italic formatting | ✅ Passing |
| BLOG_EDITOR_003 | Multiple styles | Apply bold + italic | ✅ Passing |

### 2. HEADINGS (3 tests)

| ID | Test Case | Description | Status |
|----|-----------|-------------|--------|
| BLOG_EDITOR_004 | Insert H1 | Create heading level 1 | ✅ Passing |
| BLOG_EDITOR_005 | Insert H2 | Create heading level 2 | ✅ Passing |
| BLOG_EDITOR_006 | Insert H3 | Create heading level 3 | ✅ Passing |

### 3. LISTS (2 tests)

| ID | Test Case | Description | Status |
|----|-----------|-------------|--------|
| BLOG_EDITOR_007 | Create bullet list | Insert unordered list | ✅ Passing |
| BLOG_EDITOR_008 | Create ordered list | Insert numbered list | ✅ Passing |

### 4. BLOCKS (3 tests)

| ID | Test Case | Description | Status |
|----|-----------|-------------|--------|
| BLOG_EDITOR_009 | Insert blockquote | Create quote block | ✅ Passing |
| BLOG_EDITOR_010 | Insert code block | Create pre block | ✅ Passing |
| BLOG_EDITOR_011 | Insert horizontal rule | Create hr element | ✅ Passing |

### 5. LINKS (1 test)

| ID | Test Case | Description | Status |
|----|-----------|-------------|--------|
| BLOG_EDITOR_012 | Insert link | Create anchor tag | ✅ Passing |

### 6. UNDO/REDO (2 tests)

| ID | Test Case | Description | Status |
|----|-----------|-------------|--------|
| BLOG_EDITOR_013 | Undo action | Revert last change | ✅ Passing |
| BLOG_EDITOR_014 | Redo action | Restore undone change | ✅ Passing |

### 7. PREVIEW MODE (2 tests)

| ID | Test Case | Description | Status |
|----|-----------|-------------|--------|
| BLOG_EDITOR_015 | Toggle to preview | Switch to preview mode | ✅ Passing |
| BLOG_EDITOR_016 | Toggle to edit | Switch back to edit mode | ✅ Passing |

### 8. WORD COUNT (1 test)

| ID | Test Case | Description | Status |
|----|-----------|-------------|--------|
| BLOG_EDITOR_017 | Show word count | Display correct word count | ✅ Passing |

### 9. PLACEHOLDER (2 tests)

| ID | Test Case | Description | Status |
|----|-----------|-------------|--------|
| BLOG_EDITOR_018 | Show placeholder | Display when empty | ✅ Passing |
| BLOG_EDITOR_019 | Hide placeholder | Hide when content exists | ✅ Passing |

## Summary

| Category | Total | Passing | Pending | Failing |
|----------|-------|---------|---------|---------|
| TEXT FORMATTING | 3 | 3 | 0 | 0 |
| HEADINGS | 3 | 3 | 0 | 0 |
| LISTS | 2 | 2 | 0 | 0 |
| BLOCKS | 3 | 3 | 0 | 0 |
| LINKS | 1 | 1 | 0 | 0 |
| UNDO/REDO | 2 | 2 | 0 | 0 |
| PREVIEW MODE | 2 | 2 | 0 | 0 |
| WORD COUNT | 1 | 1 | 0 | 0 |
| PLACEHOLDER | 2 | 2 | 0 | 0 |
| **Total** | **19** | **19** | **0** | **0** |

## Data-cy Selectors Used

```
[data-cy="wysiwyg-container"]
[data-cy="wysiwyg-toolbar"]
[data-cy="wysiwyg-content"]
[data-cy="wysiwyg-preview"]
[data-cy="wysiwyg-preview-toggle"]
[data-cy="wysiwyg-bold"]
[data-cy="wysiwyg-italic"]
[data-cy="wysiwyg-underline"]
[data-cy="wysiwyg-strikeThrough"]
[data-cy="wysiwyg-formatBlock-h1|h2|h3"]
[data-cy="wysiwyg-insertUnorderedList"]
[data-cy="wysiwyg-insertOrderedList"]
[data-cy="wysiwyg-formatBlock-blockquote"]
[data-cy="wysiwyg-formatBlock-pre"]
[data-cy="wysiwyg-insertHorizontalRule"]
[data-cy="wysiwyg-createLink"]
[data-cy="wysiwyg-undo"]
[data-cy="wysiwyg-redo"]
[data-cy="wysiwyg-wordcount"]
[data-cy="wysiwyg-placeholder"]
```

## POM Class

**WysiwygEditor:** `test/cypress/src/classes/themes/blog/WysiwygEditor.js`

## Running Tests

```bash
npx cypress run --spec "test/cypress/e2e/themes/blog/posts/posts-editor.cy.ts"
```

---

**Last Updated:** 2025-12-04
