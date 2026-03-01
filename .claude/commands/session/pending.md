---
disable-model-invocation: true
---

# /session:pending

Document pending items discovered during development.

---

## Syntax

```
/session:pending [add|list|resolve] [description]
```

---

## Behavior

Manages pending items that are discovered during implementation but are out of scope for the current session.

---

## Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  /session:pending add                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Load session context                                        │
│     ↓                                                           │
│  2. Categorize pending item                                     │
│     - Bug discovered                                            │
│     - Enhancement idea                                          │
│     - Technical debt                                            │
│     - Missing feature                                           │
│     ↓                                                           │
│  3. Assess priority                                             │
│     - Critical / Important / Nice-to-have                       │
│     ↓                                                           │
│  4. Add to pendings.md                                          │
│     ↓                                                           │
│  5. Optionally create task in manager                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Example: Add Pending

```
/session:pending add "Performance optimization needed for product list"
```

Output:

```
📌 ADD PENDING ITEM

Session: stories/2026-01-11-new-products-entity

─────────────────────────────────────────

📝 NEW PENDING ITEM

Description: Performance optimization needed for product list

Category?
[1] Bug discovered
[2] Enhancement idea
[3] Technical debt
[4] Missing feature

> 3

Priority?
[1] Critical - Must fix before release
[2] Important - Should fix soon
[3] Nice-to-have - Future improvement

> 2

Additional context?
> List becomes slow with 100+ products, consider pagination

─────────────────────────────────────────

📄 ITEM RECORDED

```markdown
## P-003: Performance optimization for product list

**Category:** Technical debt
**Priority:** Important
**Discovered:** 2026-01-14
**Session:** new-products-entity

### Description
Performance optimization needed for product list.
List becomes slow with 100+ products.

### Suggested Action
Consider pagination or virtual scrolling.
```

─────────────────────────────────────────

Create task in ClickUp? [Yes/No]
```

---

## Example: List Pending

```
/session:pending list
```

Output:

```
📌 PENDING ITEMS

Session: stories/2026-01-11-new-products-entity

─────────────────────────────────────────

## Critical (0)
(none)

## Important (2)

P-001: Add search index for products table
       [Technical debt] Discovered: 2026-01-12

P-003: Performance optimization for product list
       [Technical debt] Discovered: 2026-01-14

## Nice-to-have (1)

P-002: Add bulk import for products
       [Enhancement] Discovered: 2026-01-13

─────────────────────────────────────────

Total: 3 pending items
```

---

## Example: Resolve Pending

```
/session:pending resolve P-001
```

Output:

```
📌 RESOLVE PENDING

Item: P-001 - Add search index for products table

─────────────────────────────────────────

How was this resolved?
[1] Fixed in this session
[2] Fixed in another session
[3] Won't fix (explain why)
[4] Duplicate

> 1

Additional notes?
> Added GIN index in migration 009

─────────────────────────────────────────

✓ P-001 marked as resolved
  Resolution: Fixed in this session
  Notes: Added GIN index in migration 009
```

---

## pendings.md Format

```markdown
# Pending Items

## Active

### P-003: Performance optimization for product list
- **Category:** Technical debt
- **Priority:** Important
- **Discovered:** 2026-01-14
- **Session:** new-products-entity

#### Description
List becomes slow with 100+ products.

#### Suggested Action
Consider pagination or virtual scrolling.

---

## Resolved

### P-001: Add search index for products table
- **Resolved:** 2026-01-15
- **Resolution:** Fixed in session
- **Notes:** Added GIN index in migration 009
```

---

## Options

| Option | Description |
|--------|-------------|
| `add` | Add new pending item |
| `list` | List all pending items |
| `resolve <id>` | Mark item as resolved |
| `--priority <level>` | Filter by priority |

---

## Related Commands

| Command | Action |
|---------|--------|
| `/session:close` | Shows pending items summary |
| `/session:scope-change` | For in-scope changes |
