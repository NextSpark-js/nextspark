# PM Decisions & AC Classification (v4.0)

> **Version 4.0** - 4 mandatory PM decisions and acceptance criteria classification system.

## Introduction

PM Decisions are **mandatory questions** that the Product Manager agent asks at the beginning of each task. These decisions directly control which workflow phases execute and how validation gates behave.

**Key Concepts:**
- **4 Mandatory Decisions** - Asked at start of every task
- **Workflow Branching** - Decisions determine which phases execute
- **AC Classification** - Tags that define how criteria are verified
- **Scope Control** - Decisions populate `scope.json` permissions

---

## AC Classification System

Every Acceptance Criteria in `requirements.md` MUST be classified with one of three tags.

### Classification Tags

| Tag | Description | Verified By | Phase |
|-----|-------------|-------------|-------|
| `[AUTO]` | Can be verified with automated tests (Cypress API/UAT) | qa-automation | 15 |
| `[MANUAL]` | Requires manual verification (visual, UX, navigation) | qa-manual | 14 |
| `[REVIEW]` | Requires human review (code quality, docs) | code-reviewer | 16 |

### Classification in requirements.md

```markdown
## Acceptance Criteria (CLASSIFIED)

### Functional Criteria
- [AUTO] User can create a product with valid data
- [AUTO] System returns 400 for invalid input
- [AUTO] User can edit existing product
- [AUTO] User can delete a product with confirmation

### Manual Verification
- [MANUAL] Form layout matches design mockup
- [MANUAL] Loading states display correctly
- [MANUAL] Navigation flow is intuitive
- [MANUAL] Responsive design works on mobile

### Review Items
- [REVIEW] Code follows project conventions
- [REVIEW] API documentation is complete
- [REVIEW] Error messages are user-friendly
```

### Classification Impact

```text
┌────────────────────────────────────────────────────────────────────────┐
│                    AC CLASSIFICATION FLOW                               │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  requirements.md                                                        │
│  ├─ [AUTO] AC-001: Create product    ──┬──► qa-automation (Phase 15)   │
│  ├─ [AUTO] AC-002: Edit product        │    - Cypress UAT tests         │
│  ├─ [AUTO] AC-003: Delete product    ──┘    - AC Coverage Report        │
│  │                                                                      │
│  ├─ [MANUAL] AC-004: Form design     ──┬──► qa-manual (Phase 14)       │
│  ├─ [MANUAL] AC-005: Loading states    │    - Playwright navigation     │
│  ├─ [MANUAL] AC-006: Responsive      ──┘    - Visual verification       │
│  │                                                                      │
│  └─ [REVIEW] AC-007: Code quality    ──┬──► code-reviewer (Phase 16)   │
│     [REVIEW] AC-008: Documentation   ──┘    - Human review              │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

### AC Coverage Report

`qa-automation` generates a coverage report mapping tests to [AUTO] criteria:

```markdown
## AC Coverage Report

| AC ID | Description | Type | Test File | Status |
|-------|-------------|------|-----------|--------|
| AC-001 | Create product | [AUTO] | products-crud.cy.ts | ✅ |
| AC-002 | Edit product | [AUTO] | products-crud.cy.ts | ✅ |
| AC-003 | Delete product | [AUTO] | products-crud.cy.ts | ✅ |
| AC-004 | Form validation | [AUTO] | products-form.cy.ts | ✅ |
| AC-005 | Visual design | [MANUAL] | - | qa-manual ✅ |
| AC-006 | Code quality | [REVIEW] | - | code-reviewer |

**Coverage:** 4/4 [AUTO] ACs covered (100%)
```

---

## The 4 Mandatory PM Decisions

### Decision 1: Development Type (Dev Type)

**Question:** What type of development is this task?

```typescript
await AskUserQuestion({
  questions: [{
    header: "Dev Type",
    question: "What type of development is this task?",
    options: [
      { label: "Feature", description: "Feature in existing theme (default)" },
      { label: "New Theme", description: "Create a new theme from scratch" },
      { label: "New Plugin", description: "Create a reusable plugin" },
      { label: "Plugin + Theme", description: "Create plugin AND new theme for testing" },
      { label: "Core Change", description: "Modification to core framework (requires scope core: true)" }
    ],
    multiSelect: false
  }]
})
```

#### Dev Type Impact on Workflow

| Dev Type | Phases 3-4 (Plugin) | Phases 3b-4b (Theme) | scope.json |
|----------|---------------------|----------------------|------------|
| Feature | SKIP | SKIP | `defaultTheme: true` |
| New Theme | SKIP | EXECUTE | `themes.newTheme: true` |
| New Plugin | EXECUTE | SKIP | `plugins.newPlugin: true` |
| Plugin + Theme | EXECUTE | EXECUTE | Both enabled |
| Core Change | SKIP | SKIP | `core: true` |

#### Dev Type Examples

**Feature (Default)**
- Adding a new dashboard page
- Creating a new API endpoint
- Modifying existing components

**New Theme**
- Creating a theme for a specific industry (e.g., `healthcare`, `education`)
- Building a custom white-label theme

**New Plugin**
- Creating a payment integration plugin
- Building an analytics plugin
- Developing a notification system

**Plugin + Theme**
- Creating a plugin that requires custom UI testing
- Building a full-stack feature as a plugin with its own theme

**Core Change**
- Modifying `core/lib/entities/core/`
- Changing authentication logic
- Updating registry system

---

### Decision 2: Database Policy

**Question:** What is the database policy?

```typescript
await AskUserQuestion({
  questions: [{
    header: "DB Policy",
    question: "What is the database policy?",
    options: [
      { label: "Reset Allowed", description: "Initial development, can drop data" },
      { label: "Incremental Migrations", description: "Production/existing data" }
    ],
    multiSelect: false
  }]
})
```

#### DB Policy Impact

| Policy | db-validator Behavior | Sample Data |
|--------|----------------------|-------------|
| Reset Allowed | DROP + migrate | Regenerate all |
| Incremental | migrate only | Preserve + add new |

#### DB Policy Examples

**Reset Allowed**
- New project development
- Feature branch with isolated database
- Testing environment with disposable data

**Incremental Migrations**
- Production database
- Shared development database
- Data that cannot be regenerated (user-uploaded content)

---

### Decision 3: Requires Blocks

**Question:** Does this feature require creating or modifying page builder blocks?

```typescript
await AskUserQuestion({
  questions: [{
    header: "Blocks",
    question: "Does this feature require creating or modifying page builder blocks?",
    options: [
      { label: "No", description: "No blocks needed" },
      { label: "Yes", description: "Create or modify blocks" }
    ],
    multiSelect: false
  }]
})
```

#### Blocks Decision Impact

| Decision | Phase 10 | block-developer |
|----------|----------|-----------------|
| No | SKIP | Not invoked |
| Yes | EXECUTE | Creates/modifies blocks |

#### When Blocks = Yes

The `block-developer` agent (Phase 10) will:
1. Create new blocks in `contents/themes/{theme}/blocks/`
2. Define block schema and configuration
3. Implement React components
4. Run `node core/scripts/build/registry.mjs`
5. Update block registry

---

### Decision 4: Plugin Configuration (Conditional)

**Condition:** Only asked if Dev Type = "New Plugin" or "Plugin + Theme"

**Questions:**

```typescript
if (devType === 'New Plugin' || devType === 'Plugin + Theme') {
  await AskUserQuestion({
    questions: [
      {
        header: "Complexity",
        question: "What is the plugin complexity?",
        options: [
          { label: "Utility", description: "Helper functions only, no UI" },
          { label: "Service (Recommended)", description: "API + components + hooks" },
          { label: "Full-featured", description: "Own entities + migrations + UI" }
        ],
        multiSelect: false
      },
      {
        header: "Entities",
        question: "Will the plugin have its own entities (DB tables)?",
        options: [
          { label: "No", description: "Plugin without its own database" },
          { label: "Yes", description: "Plugin with entities and migrations" }
        ],
        multiSelect: false
      }
    ]
  })
}
```

#### Plugin Complexity Impact

| Complexity | Plugin Structure | Has UI | Has API | Has DB |
|------------|-----------------|--------|---------|--------|
| Utility | `lib/core.ts` only | No | No | No |
| Service | Full structure | Yes | Yes | No |
| Full-featured | Full + migrations | Yes | Yes | Yes |

#### Plugin Entities Impact

| Has Entities | db-developer Behavior | Migrations |
|--------------|----------------------|------------|
| No | Skip plugin migrations | None |
| Yes | Create plugin migrations | In `plugins/{name}/migrations/` |

#### Plugin File Structure by Complexity

**Utility Plugin:**
```text
contents/plugins/my-plugin/
├── plugin.config.ts
├── lib/
│   ├── core.ts
│   └── types.ts
└── tests/
```

**Service Plugin:**
```text
contents/plugins/my-plugin/
├── plugin.config.ts
├── lib/
│   ├── core.ts
│   └── types.ts
├── api/
│   └── example/route.ts
├── components/
│   └── ExampleComponent.tsx
├── hooks/
│   └── useExample.ts
├── messages/
│   ├── en.json
│   └── es.json
└── tests/
```

**Full-featured Plugin:**
```text
contents/plugins/my-plugin/
├── plugin.config.ts
├── lib/
│   ├── core.ts
│   ├── types.ts
│   └── entities/
├── api/
│   └── example/route.ts
├── components/
│   └── ExampleComponent.tsx
├── hooks/
│   └── useExample.ts
├── messages/
│   ├── en.json
│   └── es.json
├── migrations/
│   ├── 001_create_table.sql
│   └── 002_sample_data.sql
└── tests/
```

---

## Decision Flow Diagram

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    PM DECISIONS FLOW (Phase 1)                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  DECISION 1: Dev Type                                             │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │   │
│  │  │  Feature    │  │ New Theme   │  │ New Plugin  │               │   │
│  │  │  (default)  │  │             │  │             │               │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘               │   │
│  │         │                │                │                       │   │
│  │         │                │                └─────────────┐         │   │
│  │         │                │                              │         │   │
│  │  Skip Plugin+Theme  Execute Theme    Execute Plugin     │         │   │
│  │  Phases 3,4,3b,4b   Phases 3b,4b     Phases 3,4        │         │   │
│  │                                                         │         │   │
│  │                                      ┌──────────────────┘         │   │
│  │                                      │                            │   │
│  │  ┌─────────────────────────────────────────────────────────────┐ │   │
│  │  │  DECISION 4: Plugin Config (only if plugin)                 │ │   │
│  │  │  - Complexity: Utility / Service / Full-featured            │ │   │
│  │  │  - Has Entities: Yes / No                                   │ │   │
│  │  └─────────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  DECISION 2: DB Policy                                            │   │
│  │  ┌─────────────────────┐    ┌─────────────────────┐              │   │
│  │  │  Reset Allowed      │    │  Incremental        │              │   │
│  │  │  DROP + migrate     │    │  migrate only       │              │   │
│  │  └─────────────────────┘    └─────────────────────┘              │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  DECISION 3: Requires Blocks                                      │   │
│  │  ┌─────────────────────┐    ┌─────────────────────┐              │   │
│  │  │  No                 │    │  Yes                │              │   │
│  │  │  Skip Phase 10      │    │  Execute Phase 10   │              │   │
│  │  └─────────────────────┘    └─────────────────────┘              │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Decisions in scope.json

PM Decisions are recorded in the session's `scope.json` file:

```json
{
  "session": "2025-12-15-products-v1",
  "decisions": {
    "devType": "Feature",
    "dbPolicy": "Reset Allowed",
    "requiresBlocks": false,
    "pluginConfig": null
  },
  "permissions": {
    "core": false,
    "defaultTheme": true,
    "themes": {},
    "plugins": {}
  },
  "conditionalPhases": {
    "3-plugin-creator": false,
    "4-plugin-validator": false,
    "3b-theme-creator": false,
    "4b-theme-validator": false,
    "10-block-developer": false
  }
}
```

### scope.json for New Plugin

```json
{
  "session": "2025-12-15-analytics-plugin-v1",
  "decisions": {
    "devType": "New Plugin",
    "dbPolicy": "Reset Allowed",
    "requiresBlocks": false,
    "pluginConfig": {
      "name": "analytics",
      "complexity": "Service",
      "hasEntities": false
    }
  },
  "permissions": {
    "core": false,
    "defaultTheme": false,
    "themes": {},
    "plugins": {
      "analytics": true
    }
  },
  "conditionalPhases": {
    "3-plugin-creator": true,
    "4-plugin-validator": true,
    "3b-theme-creator": false,
    "4b-theme-validator": false,
    "10-block-developer": false
  }
}
```

### scope.json for Plugin + Theme

```json
{
  "session": "2025-12-15-payments-v1",
  "decisions": {
    "devType": "Plugin + Theme",
    "dbPolicy": "Incremental Migrations",
    "requiresBlocks": true,
    "pluginConfig": {
      "name": "payments",
      "complexity": "Full-featured",
      "hasEntities": true
    }
  },
  "permissions": {
    "core": false,
    "defaultTheme": false,
    "themes": {
      "payments-demo": true
    },
    "plugins": {
      "payments": true
    }
  },
  "conditionalPhases": {
    "3-plugin-creator": true,
    "4-plugin-validator": true,
    "3b-theme-creator": true,
    "4b-theme-validator": true,
    "10-block-developer": true
  }
}
```

---

## Examples by Scenario

### Scenario 1: Simple Feature in Existing Theme

**Decisions:**
- Dev Type: Feature
- DB Policy: Reset Allowed
- Requires Blocks: No

**Phases Executed:**
```text
1 → 2 → 5 → 6 → 7 → 8 → 9 → 11 → 12 → 13 → 14 → 15 → 16 → 17
```

**Skipped:** 3, 4, 3b, 4b, 10, 18, 19

---

### Scenario 2: Feature with Page Builder Blocks

**Decisions:**
- Dev Type: Feature
- DB Policy: Reset Allowed
- Requires Blocks: Yes

**Phases Executed:**
```text
1 → 2 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17
```

**Skipped:** 3, 4, 3b, 4b, 18, 19

---

### Scenario 3: New Theme Development

**Decisions:**
- Dev Type: New Theme
- DB Policy: Reset Allowed
- Requires Blocks: No

**Phases Executed:**
```text
1 → 2 → 3b → 4b → 5 → 6 → 7 → 8 → 9 → 11 → 12 → 13 → 14 → 15 → 16 → 17
```

**Skipped:** 3, 4, 10, 18, 19

---

### Scenario 4: New Plugin (Service Complexity)

**Decisions:**
- Dev Type: New Plugin
- DB Policy: Reset Allowed
- Requires Blocks: No
- Complexity: Service
- Has Entities: No

**Phases Executed:**
```text
1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 11 → 12 → 13 → 14 → 15 → 16 → 17
```

**Skipped:** 3b, 4b, 10, 18, 19

**Note:** Plugin uses `plugin-sandbox` theme for testing.

---

### Scenario 5: Full-featured Plugin with Custom Theme

**Decisions:**
- Dev Type: Plugin + Theme
- DB Policy: Incremental Migrations
- Requires Blocks: Yes
- Complexity: Full-featured
- Has Entities: Yes

**Phases Executed (ALL):**
```text
1 → 2 → 3 → 4 → 3b → 4b → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18 → 19
```

**Skipped:** None (optional 18, 19 if requested)

---

### Scenario 6: Core Framework Change

**Decisions:**
- Dev Type: Core Change
- DB Policy: Incremental Migrations
- Requires Blocks: No

**Phases Executed:**
```text
1 → 2 → 5 → 6 → 7 → 8 → 9 → 11 → 12 → 13 → 14 → 15 → 16 → 17
```

**Skipped:** 3, 4, 3b, 4b, 10, 18, 19

**Special:** `scope.json` has `core: true`, allowing modifications to `core/` directory.

---

## Best Practices

### When to Choose Each Dev Type

| If you need to... | Choose |
|-------------------|--------|
| Add features to existing theme | Feature |
| Create a new branded/industry theme | New Theme |
| Create reusable functionality | New Plugin |
| Create plugin with custom test UI | Plugin + Theme |
| Modify core framework | Core Change |

### When to Choose Each DB Policy

| If your database... | Choose |
|---------------------|--------|
| Is new or can be wiped | Reset Allowed |
| Has production data | Incremental Migrations |
| Is shared with others | Incremental Migrations |
| Contains test data only | Reset Allowed |

### AC Classification Guidelines

| Criteria Type | Tag | Example |
|---------------|-----|---------|
| CRUD operations | [AUTO] | "User can create product" |
| Validation rules | [AUTO] | "Form shows error for invalid email" |
| API responses | [AUTO] | "API returns 404 for missing resource" |
| Visual design | [MANUAL] | "Button matches design mockup" |
| User experience | [MANUAL] | "Flow feels intuitive" |
| Animations | [MANUAL] | "Loading spinner displays correctly" |
| Code quality | [REVIEW] | "Code follows conventions" |
| Documentation | [REVIEW] | "API is well documented" |

---

## Next Steps

- **[Workflow Phases](./04-workflow-phases.md)** - How decisions affect phase execution
- **[Quality Gates](./07-quality-gates.md)** - Validation based on decisions
- **[Agents](./03-agents.md)** - Conditional agent invocation
- **[Sessions](./05-sessions.md)** - How scope.json is structured
