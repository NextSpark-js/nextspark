# /session:refine

Refine requirements or plan before continuing execution.

---

## Syntax

```
/session:refine [requirements|plan]
```

---

## Behavior

Opens refinement mode to adjust requirements or technical plan without creating a new iteration.

---

## When to Use

| Situation | Action |
|-----------|--------|
| Minor clarification needed | `/session:refine requirements` |
| Technical approach adjustment | `/session:refine plan` |
| Add missing AC | `/session:refine requirements` |
| Change implementation detail | `/session:refine plan` |

**Note:** For major scope changes, use `/session:scope-change` instead.

---

## Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  /session:refine                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Load current session                                        │
│     ↓                                                           │
│  2. Show current state                                          │
│     - requirements.md or plan.md                                │
│     ↓                                                           │
│  3. Ask for refinements                                         │
│     - What needs to change?                                     │
│     - Why?                                                      │
│     ↓                                                           │
│  4. Apply changes                                               │
│     - Update file                                               │
│     - Log change in progress.md                                 │
│     ↓                                                           │
│  5. Show diff and confirm                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Example: Refine Requirements

```
/session:refine requirements
```

Output:

```
📝 REFINE REQUIREMENTS

Session: stories/2026-01-11-new-products-entity

─────────────────────────────────────────

📋 CURRENT ACCEPTANCE CRITERIA

AC1: Admin can create a new product ✓
AC2: Admin can upload product images ✓
AC3: Admin can assign products to categories
AC4: Products are listed with pagination
AC5: Team members can view products

─────────────────────────────────────────

What would you like to refine?
> Add AC for product search functionality

─────────────────────────────────────────

📝 PROPOSED CHANGES

+ AC6: Products can be searched by name and SKU

Why this change?
> Client requested search feature during review

─────────────────────────────────────────

Apply these changes? [Yes/Edit/Cancel]

> Yes

✓ requirements.md updated
✓ Change logged in progress.md
```

---

## Example: Refine Plan

```
/session:refine plan
```

Output:

```
📐 REFINE PLAN

Session: stories/2026-01-11-new-products-entity

─────────────────────────────────────────

📋 CURRENT PLAN

## Phase 2: Backend
- [ ] Configure entity in entities.config.ts
- [ ] Add translations

─────────────────────────────────────────

What would you like to refine?
> Need custom service for price calculation

─────────────────────────────────────────

📝 PROPOSED CHANGES

## Phase 2: Backend
- [ ] Configure entity in entities.config.ts
+ - [ ] Create ProductsService with price calculation
- [ ] Add translations

Estimated impact: +2 files

─────────────────────────────────────────

Apply these changes? [Yes/Edit/Cancel]

> Yes

✓ plan.md updated
✓ scope.json updated (2 new files)
✓ Change logged in progress.md
```

---

## Refinement vs Scope Change

| Refinement | Scope Change |
|------------|--------------|
| Minor clarifications | Major new requirements |
| Implementation details | New ACs that change scope |
| Same T-Shirt size | T-Shirt size increases |
| No new iteration | Creates new iteration |
| `/session:refine` | `/session:scope-change` |

---

## Options

| Option | Description |
|--------|-------------|
| `requirements` | Refine requirements.md |
| `plan` | Refine plan.md |
| `--interactive` | Guided refinement mode |

---

## Related Commands

| Command | Action |
|---------|--------|
| `/session:scope-change` | For major scope changes |
| `/session:execute` | Continue after refinement |
| `/session:status` | View current state |
