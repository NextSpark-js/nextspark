# Test Cases Feature

> BDD test documentation viewer with bilingual support and Gherkin syntax highlighting.

## Overview

The Test Cases feature provides a comprehensive viewer for BDD (Behavior-Driven Development) test documentation. It transforms markdown files with Gherkin scenarios into an interactive, searchable interface with syntax highlighting.

**Route**: `/devtools/tests/[[...path]]`
**Location**: `core/components/devtools/bdd/`

## Key Features

| Feature | Description |
|---------|-------------|
| File Tree Navigation | Browse test files organized by folder structure |
| BDD Test Viewer | Specialized viewer for `.bdd.md` files |
| Markdown Viewer | Standard viewer for `.md` files |
| URL Synchronization | Shareable deep links to specific files |
| Bilingual Support | Global EN/ES language toggle |
| Gherkin Highlighting | Color-coded syntax for Given/When/Then |
| Collapsible Cards | Expand/collapse individual test cases |
| Sticky TOC | Always-visible table of contents |
| Search/Filter | Quick search across tests |
| Copy to Clipboard | One-click copy for scenarios and grep tags |

## BDD Document Format

Test documentation uses a specialized markdown format with the `.bdd.md` extension.

### Structure

```markdown
---
feature: Feature Name
priority: high | medium | low
tags: [tag1, tag2, tag3]
grepTags: [uat, smoke, regression]
coverage: 14
---

# Feature Name

> Feature description.

## @test TEST-ID-001: Test Title

### Metadata
- **Priority:** High
- **Type:** Smoke | Regression | Integration | E2E
- **Tags:** tag1, tag2
- **Grep:** `@smoke`

```gherkin:en
Scenario: English scenario description

Given I am logged in as Owner
And I have created a test page via API
When I visit the page editor
And I perform some action
Then the expected result should occur
```

```gherkin:es
Scenario: Descripcion del escenario en espanol

Given estoy logueado como Owner
And he creado una pagina de prueba via API
When visito el editor de paginas
And realizo alguna accion
Then el resultado esperado deberia ocurrir
```

### Expected Results
- First expected outcome
- Second expected outcome
- Third expected outcome

---

## @test TEST-ID-002: Next Test Title
...
```

### Frontmatter Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `feature` | string | Yes | Feature/module name |
| `priority` | string | No | `high`, `medium`, or `low` |
| `tags` | array | No | Categorical tags for the feature |
| `grepTags` | array | No | Tags for Cypress `--grep` filtering |
| `coverage` | number | No | Number of test cases (auto-calculated if omitted) |

### Test Case Format

- Header: `## @test ID: Title`
- ID format: Usually `FEATURE-AREA-NNN` (e.g., `PB-BLOCK-001`)
- Bilingual scenarios use `gherkin:en` and `gherkin:es` code blocks

## Component Architecture

```text
BDDTestViewer (main container)
├── BDDHeader
│   ├── Feature title and description
│   ├── Priority badge
│   ├── Test count indicator
│   ├── Tags display
│   ├── Grep tags (click to copy)
│   └── Language toggle (EN/ES)
├── Separator
├── Toolbar
│   ├── Search input
│   └── Expand/Collapse all button
├── Test Cases List
│   └── BDDTestCard (for each test)
│       ├── Collapsible trigger
│       │   ├── Index number
│       │   ├── Test ID
│       │   ├── Test title
│       │   ├── Type badge
│       │   └── Priority badge
│       └── Collapsible content
│           ├── Tags
│           ├── GherkinHighlighter
│           ├── Copy button
│           └── Expected results
└── BDDTableOfContents (sidebar, sticky)
    └── Navigation links to each test
```

## Gherkin Syntax Highlighting

The `GherkinHighlighter` component provides color-coded syntax:

| Keyword | Color | CSS Class |
|---------|-------|-----------|
| Given | Blue | `text-blue-500` |
| When | Green | `text-green-500` |
| Then | Purple | `text-purple-500` |
| And/But | Gray | `text-slate-500` |
| Scenario/Feature | Orange | `text-orange-500` |
| "Quoted strings" | Amber | `text-amber-400` |
| `<placeholders>` | Cyan | `text-cyan-400` |

## Bilingual Support

### Language Toggle

The header displays a language toggle when the document contains both EN and ES scenarios:

```text
[EN] [ES]  ← Toggle buttons, active state highlighted
```

### Persistence

Language preference is stored in `localStorage`:

```typescript
const LANGUAGE_STORAGE_KEY = 'bdd-viewer-language';

// Save preference
localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);

// Load on mount
const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
```

### Fallback Behavior

```typescript
// Priority: selected language → other language → legacy field
const currentScenario =
  test.scenarios?.[language] ||
  test.scenarios?.en ||
  test.scenarios?.es ||
  test.scenario;
```

## URL Synchronization

The viewer supports deep linking via the `useTreeNavigation` hook:

| URL | Result |
|-----|--------|
| `/devtools/tests` | Empty state, file tree visible |
| `/devtools/tests/auth/login.bdd.md` | Opens auth folder, displays login file |
| `/devtools/tests/page-builder/admin/block-crud.bdd.md` | Opens nested path |

### Hook Usage

```typescript
const {
  selectedPath,       // Current file path (relative, without basePath)
  expandedFolders,    // Set of expanded folder paths
  navigateToFile,     // Navigate to a file
  toggleFolder,       // Toggle folder expansion
  expandFolder,       // Expand a folder without navigation
  collapseFolder,     // Collapse a folder
  isPathInSelection,  // Check if path is within current selection
  clearSelection,     // Return to empty state (navigate to base)
} = useTreeNavigation({ basePath: "/devtools/tests" });
```

### Hook Options

```typescript
interface UseTreeNavigationOptions {
  basePath: string;                        // Base path (e.g., '/devtools/tests')
  autoExpandPath?: boolean;                // Auto-expand folders to selected file (default: true)
  onPathChange?: (path: string | null) => void;  // Callback when path changes
}
```

## API Endpoints

### List Test Files

```text
GET /api/devtools/tests
```

**Response:**

```json
{
  "success": true,
  "data": {
    "tree": [
      {
        "name": "auth",
        "path": "auth",
        "type": "folder",
        "children": [
          {
            "name": "login.bdd.md",
            "path": "auth/login.bdd.md",
            "type": "file"
          }
        ]
      }
    ]
  }
}
```

### Get File Content

```text
GET /api/devtools/tests/[...path]
```

**Response:**

```json
{
  "success": true,
  "data": {
    "path": "auth/login.bdd.md",
    "content": "---\nfeature: Login...",
    "frontmatter": {
      "feature": "Login",
      "priority": "high"
    }
  }
}
```

## TypeScript Types

```typescript
// types.ts

export interface BDDFeature {
  title: string;
  description: string;
  priority?: 'high' | 'medium' | 'low';
  tags?: string[];
  grepTags?: string[];
  coverage?: number;
}

export interface BDDTestMetadata {
  priority?: 'high' | 'medium' | 'low';
  type?: 'smoke' | 'regression' | 'integration' | 'e2e';
  tags?: string[];
  automated?: boolean;
}

export type BDDLanguage = 'en' | 'es';

export interface BDDScenarios {
  en?: string;
  es?: string;
}

export interface BDDTestCase {
  id: string;
  title: string;
  metadata: BDDTestMetadata;
  scenario: string;           // @deprecated - use scenarios
  scenarios: BDDScenarios;    // Bilingual scenarios
  expectedResults?: string[];
  notes?: string;
}

export interface BDDDocument {
  feature: BDDFeature;
  tests: BDDTestCase[];
  rawContent: string;
}
```

## Parser Details

The `parser.ts` module handles:

1. **YAML Frontmatter Extraction**: Parses `---` delimited YAML
2. **Feature Parsing**: Extracts title from `# Heading` or frontmatter
3. **Test Detection**: Splits on `## @test` markers
4. **Scenario Extraction**: Regex for `gherkin:en` and `gherkin:es` blocks
5. **Metadata Parsing**: Extracts priority, type, tags from markdown
6. **Expected Results**: Parses bullet lists after `### Expected Results`

### Key Regex Patterns

```typescript
// Bilingual Gherkin blocks
const langBlockPattern = /```gherkin:(en|es)\n([\s\S]*?)```/g;

// Test header
const headerMatch = section.match(/^## @test\s+([\w-]+):\s*(.+)$/m);

// Metadata extraction
const priorityMatch = section.match(/\*\*Priority:\*\*\s*(\w+)/i);
const typeMatch = section.match(/\*\*Type:\*\*\s*(\w+)/i);
```

## Data Attributes (Cypress)

All interactive elements include `data-cy` attributes:

### TestCasesViewer (Container)

| Selector | Element |
|----------|---------|
| `[data-cy="devtools-tests-loading"]` | Initial loading state |
| `[data-cy="devtools-tests-viewer"]` | Main viewer grid |
| `[data-cy="devtools-tests-tree"]` | File tree container |
| `[data-cy="devtools-tests-not-found"]` | 404 state for invalid paths |
| `[data-cy="devtools-tests-back-to-list"]` | Back button in 404 state |
| `[data-cy="devtools-tests-empty-state"]` | Empty state (no selection) |
| `[data-cy="devtools-tests-file-loading"]` | File loading state |
| `[data-cy="devtools-tests-error"]` | Error state |
| `[data-cy="devtools-tests-content"]` | Content container |

### BDDTestViewer (BDD Files)

| Selector | Element |
|----------|---------|
| `[data-cy="bdd-test-viewer"]` | Main BDD viewer container |
| `[data-cy="bdd-header"]` | Feature header |
| `[data-cy="bdd-language-toggle"]` | Language toggle container |
| `[data-cy="bdd-lang-en"]` | English toggle button |
| `[data-cy="bdd-lang-es"]` | Spanish toggle button |
| `[data-cy="bdd-search"]` | Search input |
| `[data-cy="bdd-expand-toggle"]` | Expand/collapse all button |
| `[data-cy="bdd-test-{id}"]` | Test card container |
| `[data-cy="bdd-test-trigger-{id}"]` | Test card trigger button |
| `[data-cy="bdd-copy-{id}"]` | Copy scenario button |
| `[data-cy="bdd-toc"]` | Table of contents |
| `[data-cy="bdd-toc-item-{id}"]` | TOC navigation item |

## Styling Notes

### Sticky TOC

The table of contents uses CSS sticky positioning:

```tsx
<aside className="hidden lg:block w-64 shrink-0 self-start sticky top-0">
  <div className="max-h-[calc(100vh-14rem)] overflow-y-auto">
    <BDDTableOfContents ... />
  </div>
</aside>
```

Key classes:
- `self-start`: Aligns to top of flex container
- `sticky top-0`: Sticks to top when scrolling
- `max-h-[calc(100vh-14rem)]`: Limits height with overflow scroll

### Conditional Overflow

The `TestCasesViewer` applies overflow conditionally:

```tsx
<CardContent className={cn(
  "p-6 h-full",
  selectedPath?.endsWith('.bdd.md') ? "" : "overflow-y-auto"
)}>
```

BDD viewer handles its own scrolling; other content needs container scroll.

## Translations

Required translation keys in `messages/{locale}.json`:

```json
{
  "dev": {
    "tests": {
      "title": "Test Cases",
      "description": "Browse test documentation",
      "fileTree": "Test Files",
      "fileTreeDescription": "Browse test documentation",
      "selectFile": "Select a file to view",
      "selectFileDescription": "Choose a test file from the tree to see its content",
      "noTests": "No test files found",
      "noMatchingTests": "No tests match your search",
      "searchPlaceholder": "Search tests...",
      "expandAll": "Expand All",
      "collapseAll": "Collapse All",
      "fileNotFound": "File Not Found",
      "fileNotFoundDescription": "The test file \"{path}\" could not be found.",
      "backToList": "Back to Test List",
      "error": "Failed to load file",
      "loading": "Loading..."
    }
  }
}
```

## File Locations

```text
app/devtools/tests/[[...path]]/page.tsx      # Route page
app/api/devtools/tests/route.ts              # Tree API
app/api/devtools/tests/[...path]/route.ts    # File content API

core/components/devtools/
├── TestCasesViewer.tsx                      # Main viewer component
├── FileTree.tsx                             # File tree navigation
├── MarkdownViewer.tsx                       # Standard markdown viewer
└── bdd/
    ├── index.ts                             # Exports
    ├── types.ts                             # TypeScript interfaces
    ├── parser.ts                            # BDD document parser
    ├── GherkinHighlighter.tsx               # Syntax highlighting
    ├── BDDHeader.tsx                        # Feature header
    ├── BDDTestCard.tsx                      # Collapsible test card
    ├── BDDTableOfContents.tsx               # Navigation sidebar
    └── BDDTestViewer.tsx                    # Main BDD viewer

core/hooks/useTreeNavigation.ts              # URL sync hook

contents/themes/default/tests/cypress/e2e/   # Test documentation location
```

## Example BDD Document

See `contents/themes/default/tests/cypress/e2e/page-builder/admin/block-crud.bdd.md` for a complete example with:
- 14 test cases
- Bilingual scenarios (EN/ES)
- Various priority levels
- Multiple test types (smoke, regression)
- Grep tags for test filtering
