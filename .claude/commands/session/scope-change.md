# /session:scope-change

Handle a scope change by creating a new iteration.

---

## Syntax

```
/session:scope-change <reason> [description]
```

---

## Parameters

| Parameter | Description |
|-----------|-------------|
| `reason` | `scope-change` \| `blocked` \| `review-feedback` \| `continuation` |
| `description` | Brief description of the change (optional) |

---

## When to Use

| Situation | Reason |
|-----------|--------|
| Scope changed (new ACs, fields, etc.) | `scope-change` |
| There's a blocker that requires replanning | `blocked` |
| Code review requires major changes | `review-feedback` |
| Resuming after a long pause | `continuation` |

---

## Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  /session:scope-change                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Verify active session (must be story)                       │
│     ↓                                                           │
│  2. Document change                                             │
│     - What changed?                                             │
│     - Why?                                                      │
│     - How does it affect the plan?                              │
│     ↓                                                           │
│  3. Execute iteration-init.sh                                   │
│     - Close current iteration                                   │
│     - Create new iteration                                      │
│     - Update symlinks                                           │
│     ↓                                                           │
│  4. Create scope-change.md (if reason=scope-change)             │
│     ↓                                                           │
│  5. Ask whether to update plan/requirements                     │
│     ↓                                                           │
│  6. Update task manager (if enabled)                            │
│     ↓                                                           │
│  7. Show next step                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Usage Example

```
/session:scope-change scope-change "add variants field"
```

Output:

```
🔄 SCOPE CHANGE

Session: stories/2026-01-11-new-products-entity
Current iteration: 01-initial (60% completed)

─────────────────────────────────────────

📝 DOCUMENTING CHANGE

What changed?
> Need to add "variants" field to products

Why?
> New client requirement for products with variants

How does it affect the plan?
> Requires updating migration, API and UI

─────────────────────────────────────────

Closing iteration 01-initial...
✓ Iteration closed

Creating iteration 02-scope-change-add-variants-field...
✓ Iteration created

─────────────────────────────────────────

📁 FILES CREATED

iterations/02-scope-change-add-variants-field/
├── scope-change.md   (change documentation)
├── progress.md       (new progress)
└── changes.md        (new changes)

─────────────────────────────────────────

Update requirements.md with new ACs? [Yes/No]
Update plan.md? [Yes/No]
```

---

## scope-change.md

File that documents the change:

```markdown
# Scope Change: 02-scope-change-add-variants-field

**Date:** 2026-01-14 15:30
**Previous Iteration:** 01-initial
**Reason:** scope-change

## What Changed

Need to add "variants" field to the products entity.

## Why

New client requirement for products with variants
(e.g., sizes, colors).

## Impact on Plan

### Affected phases:
- Phase 5: db-developer → New migration
- Phase 7: backend-developer → Update API
- Phase 11: frontend-developer → New UI for variants

### Additional estimate:
- Original T-Shirt: L
- Increment: +S
- New T-Shirt: L (high)

## Updated Acceptance Criteria

- AC5: [NEW] User can create product variants
- AC6: [NEW] Variants have unique SKU
```

---

## Task Manager Integration

If `taskManager.enabled`:

```
📋 UPDATING TASK

ClickUp: #abc123

Posting scope change comment...
✓ Comment posted

Add new ACs as subtasks? [Yes/No]
```

---

## Related Commands

| Command | Action |
|---------|--------|
| `/session:status` | View status with iterations |
| `/session:execute` | Continue from new iteration |
