---
description: Interactive code walkthrough for understanding a completed feature
---

# Task Explain - Interactive Feature Learning

ultrathink You are providing an interactive code walkthrough to help the user understand a feature.

**Session or Feature to explain:**
{{{ input }}}

---

## Your Mission

Create an interactive learning experience that guides the user through the code implementation step by step. The goal is to help them deeply understand how the feature works, not just see the code.

---

## Phase 1: Context Gathering

### If a session path is provided:

```typescript
const sessionPath = `.claude/sessions/${sessionName}/`

// Load session files to understand the feature
await Read(`${sessionPath}/requirements.md`)
await Read(`${sessionPath}/plan.md`)
await Read(`${sessionPath}/tests.md`)
```

### If no session, analyze the feature:

1. Ask the user which feature/area they want to understand
2. Use Glob and Grep to identify all related files
3. Read key files to understand the implementation scope

---

## Phase 2: Build the Learning Index

After understanding the feature scope, create a **Learning Index** - a structured progression from foundation to completion.

### Learning Index Structure:

```markdown
## Learning Index: [Feature Name]

**Total Items:** [N items]
**Estimated Walkthrough:** [N sections of 3 items each]

### Foundation Layer
1. [Entry point / Configuration] - `path/to/file.ts`
2. [Core types/interfaces] - `path/to/types.ts`
3. [Database schema (if applicable)] - `path/to/migration.sql`

### Data Layer
4. [API route handler] - `app/api/.../route.ts`
5. [Business logic / services] - `core/lib/.../service.ts`
6. [Validation schemas] - `core/lib/.../schema.ts`

### UI Layer
7. [Main component] - `app/(dashboard)/.../page.tsx`
8. [Sub-components] - `core/components/.../Component.tsx`
9. [Hooks / state management] - `core/hooks/useFeature.ts`

### Integration Layer
10. [Tests] - `tests/cypress/e2e/.../feature.cy.ts`
11. [Translations] - `messages/en.json (namespace)`
12. [Selectors] - `tests/cypress/fixtures/selectors.json`
```

### Index Creation Rules:

1. **Start from the root** - Begin with config, types, or database schema
2. **Follow the data flow** - DB -> API -> Frontend -> UI
3. **Group logically** - Related files together
4. **Include line references** - Note key functions/methods with `file:line`
5. **Maximum 15 items** - Keep it digestible, skip trivial files

---

## Phase 3: Interactive Walkthrough

Present the index to the user, then begin the walkthrough.

### Initial Presentation:

```markdown
## Feature: [Name]

I've analyzed the implementation and created a learning path with [N] items.

**Learning Index:**
[Show full index]

---

Let's start with the first 3 items. I'll explain each file, highlight key methods, and show how they connect.

Ready to begin?
```

### For Each Section (3 items):

1. **Read the files** in that section
2. **Explain the purpose** of each file (1-2 sentences)
3. **Show key code snippets** with explanations
4. **Explain connections** between the files
5. **Highlight important patterns** (registry usage, hooks, etc.)

### Section Presentation Format:

```markdown
## Section [N]: [Section Name]

### 1. [File Name] (`path/to/file.ts`)

**Purpose:** [What this file does and why it exists]

**Key Code:**
```typescript
// path/to/file.ts:45-60
[relevant code snippet]
```

**Explanation:**
- [Bullet point explaining what this code does]
- [How it connects to other parts]

---

### 2. [Next File]...

---

## Connections in This Section:
- [File A] provides [X] which [File B] uses to [Y]
- [Pattern observed]: [e.g., "Uses TanStack Query for server state"]

---

**Questions about this section?** Or type "continue" for the next 3 items.
```

---

## Interaction Guidelines

### Balance Information Load:

- **DO:** Focus on key methods and their purpose
- **DO:** Show how pieces connect together
- **DO:** Highlight patterns and best practices used
- **DON'T:** Show every line of code
- **DON'T:** Explain obvious TypeScript syntax
- **DON'T:** Overwhelm with too many details at once

### User Commands:

- **"continue"** - Proceed to next 3 items
- **"explain [X]"** - Deep dive into specific concept
- **"show [function]"** - Display full function code
- **"how does [X] connect to [Y]?"** - Explain relationship
- **"skip to [section]"** - Jump to specific section
- **"summary"** - Provide high-level summary of entire feature

### Adaptive Depth:

- If user asks questions, provide deeper explanations
- If user says "continue" quickly, maintain current depth
- If user seems confused, simplify and add more context

---

## Example Interaction

**Claude:**
```
## Feature: Scheduled Actions

I've analyzed the implementation and created a learning path with 12 items across 4 sections.

**Learning Index:**

### Foundation (Items 1-3)
1. Database schema - `core/migrations/017_scheduled_actions_table.sql`
2. Core types - `core/lib/scheduled-actions/types.ts`
3. Registry integration - `core/lib/registries/entity-registry.ts`

### Backend (Items 4-6)
4. API handler - `app/api/v1/scheduled-actions/route.ts`
5. Action executor - `core/lib/scheduled-actions/executor.ts`
6. Cron endpoint - `app/api/v1/cron/scheduled-actions/route.ts`

### Frontend (Items 7-9)
7. List page - `app/devtools/scheduled-actions/page.tsx`
8. Action form - `core/components/devtools/scheduled-actions/ActionForm.tsx`
9. Status display - `core/components/devtools/scheduled-actions/StatusBadge.tsx`

### Testing (Items 10-12)
10. API tests - `tests/cypress/e2e/api/scheduled-actions/`
11. UAT tests - `tests/cypress/e2e/uat/scheduled-actions/`
12. Jest units - `core/tests/jest/lib/scheduled-actions/`

Ready to start with the Foundation section?
```

**User:** yes

**Claude:**
```
## Section 1: Foundation

### 1. Database Schema (`core/migrations/017_scheduled_actions_table.sql`)

**Purpose:** Defines the persistent storage structure for scheduled actions.

**Key Code:**
```sql
-- core/migrations/017_scheduled_actions_table.sql:12-28
CREATE TABLE "scheduledAction" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "actionType" TEXT NOT NULL,
  "schedule" TEXT NOT NULL,  -- cron expression
  "payload" JSONB DEFAULT '{}',
  "status" TEXT DEFAULT 'active',
  "lastRun" TIMESTAMP WITH TIME ZONE,
  "nextRun" TIMESTAMP WITH TIME ZONE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Key Points:**
- Uses camelCase column names (project convention)
- `schedule` stores cron expressions like "0 9 * * *"
- `payload` is JSONB for flexible action parameters
- `status` tracks if action is active/paused/error

---

### 2. Core Types (`core/lib/scheduled-actions/types.ts`)

[...continues with next file...]
```

---

## Completion

After all sections are covered:

```markdown
## Walkthrough Complete!

You've explored all [N] items covering:
- [Section 1]: [brief summary]
- [Section 2]: [brief summary]
- ...

**Key Takeaways:**
1. [Main pattern/architecture used]
2. [Important design decision]
3. [How it integrates with the rest of the system]

**Want to:**
- Ask any remaining questions?
- See a specific part in more detail?
- Move on to `/task:demo` to see the feature in action?
```

---

**Now analyze the feature and create the Learning Index.**
