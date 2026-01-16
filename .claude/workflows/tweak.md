# TWEAK Workflow v1.0

**T-Shirt Size:** XS - S
**Session:** `tweaks/` (optional)
**Subagents:** None
**Duration:** 5-20 minutes
**Token Estimate:** 10-40k

---

## Overview

The TWEAK workflow is designed for small adjustments that don't require planning, documentation, or specialized agents. It's the most efficient path for minor fixes, config changes, and small improvements.

---

## Initial Questions (3 Core)

Before starting, Claude asks **3 core questions** to gather essential context:

```
┌─────────────────────────────────────────────────────────────────┐
│  TWEAK DISCOVERY (Claude asks directly)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. TASK MANAGER                                                │
│     Is there an existing task in a project management system?   │
│     - No                                                        │
│     - Yes, ClickUp (request task_id)                            │
│     - Yes, Jira (request task_id)                               │
│     - Yes, Linear (request task_id)                             │
│     - Yes, Asana (request task_id)                              │
│                                                                 │
│  2. TESTING                                                     │
│     Does this change need tests?                                │
│     - No tests needed (existing tests cover it)                 │
│     - Run existing tests only                                   │
│     - Modify existing tests                                     │
│                                                                 │
│  3. DOCUMENTATION                                               │
│     Does this need documentation updates?                       │
│     - No documentation needed                                   │
│     - Update existing docs                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Note:** If answers suggest more complexity (new tests, new docs, etc.), Claude should recommend escalating to TASK workflow.

---

## When to Use

### Criteria (ALL must apply)

| Criterion | Requirement |
|-----------|-------------|
| **Files affected** | 1-3 files maximum |
| **Business risk** | None or negligible |
| **Technical risk** | Low (isolated changes) |
| **Planning needed** | No |
| **New tests needed** | No (only run existing) |
| **Documentation** | Not required |

### Examples

| Task | T-Shirt | Why TWEAK |
|------|---------|-----------|
| Fix typo in translation | XS | 1 file, zero risk |
| Update version in package.json | XS | 1 file, routine change |
| Add optional field with default | S | 2-3 files, low risk |
| Fix simple validation bug | S | 1-2 files, existing tests cover it |
| Update config constant | XS | 1 file, no side effects |
| Correct CSS styling issue | S | 1-2 files, visual only |

---

## When NOT to Use

**Escalate to TASK if:**
- More than 3 files affected
- New tests need to be written
- Touches authentication, authorization, or payments
- Requires any database changes
- Needs documentation
- Business stakeholder should approve

**Escalate to STORY if:**
- New entity or major feature
- Architecture decisions needed
- High business risk
- Multiple layers (DB + API + UI)

---

## Context Awareness

**CRITICAL:** Before modifying any files, read `.claude/config/context.json` to understand the environment.

### Scope Check (Phase 1: ANALYZE)

Before making changes, verify the file path is allowed:

```typescript
const context = await Read('.claude/config/context.json')
const filePath = 'core/utils/helper.ts'

// Check if path is allowed
if (context.context === 'consumer') {
  if (filePath.startsWith('core/')) {
    // STOP - Cannot modify core in consumer context
    return `
      ❌ Cannot modify ${filePath} in consumer context.

      This file is in core/, which is read-only in your project.

      Alternatives:
      1. Create theme-specific override in contents/themes/${activeTheme}/
      2. Create utility in contents/plugins/
      3. If core change is truly needed → Document as "Core Enhancement Request"
    `
  }
}
```

### Monorepo TWEAK

When context is `monorepo`:
- **CAN** modify any file in allowed paths
- **CAN** fix issues in `core/` files
- **CAN** update shared utilities
- Quick fixes across themes are allowed

### Consumer TWEAK

When context is `consumer`:
- **LIMITED** to active theme and plugins only
- Core files are **READ-ONLY** (in node_modules)
- If fix requires core change → Suggest workaround
- Document core issues for upstream maintainers

### Path Validation Quick Check

```typescript
const context = await Read('.claude/config/context.json')

// TWEAK can only modify paths in allowedPaths
const isAllowed = context.allowedPaths.some(pattern =>
  matchGlob(filePath, pattern)
)

if (!isAllowed) {
  // Escalate or suggest alternative
  return suggestAlternative(filePath, context)
}
```

---

## Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  TWEAK WORKFLOW v1.0                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Phase 0: DISCOVERY (< 1 minute)                                │
│  ───────────────────────────────                                │
│  [MANDATORY] Claude asks 3 core questions                       │
│  ├── Task Manager? (link external task)                         │
│  ├── Testing? (none / run existing / modify)                    │
│  └── Documentation? (none / update existing)                    │
│     ↓                                                           │
│  Phase 1: ANALYZE (< 1 minute)                                  │
│  ─────────────────────────────                                  │
│  [MANDATORY] Understand the task                                │
│  ├── What needs to change?                                      │
│  ├── Which files are affected?                                  │
│  ├── Are there existing tests that cover this?                  │
│  └── Confirm T-Shirt size is XS or S                            │
│     ↓                                                           │
│  Phase 2: IMPLEMENT                                             │
│  ─────────────────────                                          │
│  [MANDATORY] Make the change                                    │
│  ├── Read affected files                                        │
│  ├── Apply minimal, focused changes                             │
│  └── Follow existing code patterns                              │
│     ↓                                                           │
│  Phase 3: VALIDATE                                              │
│  ────────────────────                                           │
│  [MANDATORY] Verify the change works                            │
│  ├── TypeScript compiles (tsc --noEmit)                         │
│  ├── Build passes (pnpm build)                                  │
│  ├── Existing tests pass (affected only)                        │
│  └── Visual verification (if UI change)                         │
│     ↓                                                           │
│  Phase 4: LOG (Optional)                                        │
│  ────────────────────────                                       │
│  [OPTIONAL] Create session log                                  │
│  └── Only if tracking is needed                                 │
│     ↓                                                           │
│  DONE: Ready for commit                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Detailed Phase Descriptions

### Phase 1: ANALYZE

**Duration:** < 1 minute
**Goal:** Confirm this is truly a TWEAK task

```
[MANDATORY] Quick Analysis Steps:

1. Parse the task description
   - What is the user asking for?
   - Is it a fix, update, or minor addition?

2. Identify affected files
   - Use Grep/Glob to find relevant code
   - If > 3 files → Escalate to TASK

3. Check existing coverage
   - Are there tests for this code path?
   - If no tests and tests needed → Escalate to TASK

4. Assess risk
   - Does this touch critical flows? → Escalate
   - Could this break other features? → Escalate
   - Is this isolated and safe? → Continue

5. Confirm T-Shirt size
   - XS: 1 file, trivial change
   - S: 2-3 files, simple change
   - Anything else → Escalate
```

**Red Flags (escalate immediately):**
- File path contains `auth`, `payment`, `checkout`, `billing`
- Change requires modifying database schema
- User mentions "new feature" or "new entity"
- Multiple teams/areas affected

---

### Phase 2: IMPLEMENT

**Duration:** 2-10 minutes
**Goal:** Make the change with minimal footprint

```
[MANDATORY] Implementation Rules:

1. Read before writing
   - Always read the file first
   - Understand the existing pattern

2. Minimal changes
   - Only change what's necessary
   - Don't refactor "while you're there"
   - Don't add comments to unchanged code

3. Follow patterns
   - Match existing code style
   - Use same patterns as surrounding code
   - Don't introduce new dependencies

4. No scope creep
   - Stick to the original request
   - If you find other issues, note them but don't fix
   - One change at a time
```

**What NOT to do:**
- Add new npm packages
- Create new files (unless absolutely necessary)
- Change unrelated code
- Add "improvements" not requested

---

### Phase 3: VALIDATE

**Duration:** 1-5 minutes
**Goal:** Ensure the change doesn't break anything

```
[MANDATORY] Validation Checklist:

□ TypeScript compiles
  Command: pnpm tsc --noEmit
  If errors: Fix before proceeding

□ Build passes
  Command: pnpm build
  If errors: Fix before proceeding

□ Lint passes (for changed files)
  Command: pnpm lint --fix
  If warnings: Review and fix if significant

□ Tests pass (if applicable)
  Command: pnpm test -- --testPathPattern="<pattern>"
  Only run tests related to changed files

□ Visual verification (for UI changes)
  - Open in browser
  - Check the change works as expected
  - Check no visual regressions
```

**If validation fails:**
1. Fix the issue
2. Re-validate
3. If multiple fixes needed → Consider escalating to TASK

---

### Phase 4: LOG (Optional)

**When to create a log:**
- User explicitly requests documentation
- Change might need to be referenced later
- Part of a series of related quick fixes

**Log location:**
```
.claude/sessions/tweaks/YYYY-MM-DD-short-name.md
```

**Log format:**
```markdown
# Quick Fix: [Short Name]

**Date:** YYYY-MM-DD HH:MM
**Type:** quick-fix
**T-Shirt:** XS/S

## Summary
[One sentence describing what was done]

## Files Changed
- `path/to/file.ts` - [What changed]

## Verification
- [x] TypeScript compiles
- [x] Build passes
- [x] Tests pass
- [x] Visual check (if applicable)

## Notes
[Any important context for future reference]
```

---

## Commands

### Start TWEAK workflow

```bash
# Explicit TWEAK
/session:start:tweak Fix typo in login button

# Automatic detection (Claude evaluates)
/start Fix typo in login button
```

### Related commands

| Command | When to use |
|---------|-------------|
| `/session:fix:bug` | Quick bug fixes (auto-evaluates workflow) |
| `/session:fix:build` | Fix build errors |
| `/session:commit` | Prepare commit after changes |

---

## Characteristics Summary

| Aspect | TWEAK Workflow |
|--------|----------------|
| **Session files** | None (or optional log) |
| **Subagents** | Not used |
| **Planning** | Not needed |
| **Requirements doc** | Not created |
| **Tests** | Run existing only |
| **Code review** | Not formal (self-check) |
| **Documentation** | Not required |
| **Typical duration** | 5-20 minutes |
| **Token estimate** | 10-40k |

---

## Decision Matrix: TWEAK vs TASK

```
                              Files Affected
                         1-3         4-10        11+
                    ┌───────────┬───────────┬───────────┐
         None/Low   │   TWEAK   │  TASK │  STORY │
                    ├───────────┼───────────┼───────────┤
Risk     Medium     │  TASK │  TASK │  STORY │
                    ├───────────┼───────────┼───────────┤
         High       │  TASK │  STORY │  STORY │
                    └───────────┴───────────┴───────────┘
```

---

## Examples

### Example 1: Fix Translation Typo (XS)

```
User: Fix typo "Submti" → "Submit" in Spanish translation

Claude's process:
1. ANALYZE
   - Task: Fix typo
   - Files: 1 (es.json)
   - Risk: None
   - T-Shirt: XS → TWEAK

2. IMPLEMENT
   - Read contents/themes/default/messages/es.json
   - Change "Submti" to "Enviar" (correct Spanish)
   - Save file

3. VALIDATE
   - pnpm build ✓
   - No tests for translations (OK)

4. LOG: Not needed

Result: Ready for commit in ~3 minutes
```

### Example 2: Add Default Value to Field (S)

```
User: Add default value "active" to status field in user config

Claude's process:
1. ANALYZE
   - Task: Add default value
   - Files: 2 (config + types)
   - Risk: Low (default value is safe)
   - T-Shirt: S → TWEAK

2. IMPLEMENT
   - Read user.config.ts
   - Add default: "active" to status field
   - Update types if needed

3. VALIDATE
   - pnpm tsc --noEmit ✓
   - pnpm build ✓
   - Run user tests ✓

4. LOG: Not needed

Result: Ready for commit in ~5 minutes
```

### Example 3: Escalation to TASK

```
User: Fix the search not returning correct results

Claude's process:
1. ANALYZE
   - Task: Fix search functionality
   - Files: Need to investigate...
   - Found: 6 files in search module
   - Risk: Medium (affects user experience)

⚠️ ESCALATION TRIGGERED
   - More than 3 files
   - Medium risk

Claude: "This appears to affect 6 files and has medium risk.
I recommend using TASK workflow. Proceed with TASK?"
```

---

## Anti-Patterns

### What TWEAK is NOT for

| Anti-Pattern | Why It's Wrong |
|--------------|----------------|
| "Quick" new feature | Features need planning |
| "Just add this field to DB" | DB changes need migrations |
| "Small auth fix" | Auth is never small risk |
| "Quick refactor" | Refactors need tests |
| "Add error handling" | Could affect multiple flows |

### Signs You're Using TWEAK Wrong

1. **You're reading more than 5 files** → Too complex
2. **You want to "improve" other code** → Scope creep
3. **You need to add a new dependency** → Not quick
4. **You're creating new files** → Probably needs TASK
5. **You're uncertain about the impact** → Needs analysis

---

## Related Documentation

- `workflows/task.md` - For medium complexity
- `workflows/story.md` - For major features
- `commands/session-start.md` - Start command details
- `commands/session-fix-bug.md` - Bug fix workflow

---

## Version History

| Version | Changes |
|---------|---------|
| v1.0 | Initial English version with comprehensive detail |
