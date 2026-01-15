# /session:commit

Create a git commit for the current session changes.

**Aliases:** `/commit`

---

## Syntax

```
/session:commit [message]
```

---

## Behavior

Creates a structured commit with session context and proper co-author attribution.

---

## Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  /session:commit                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Check for uncommitted changes                               │
│     ↓                                                           │
│  2. Load session context                                        │
│     - Read scope.json                                           │
│     - Read progress.md                                          │
│     ↓                                                           │
│  3. Analyze changes                                             │
│     - Categorize by type (feat/fix/refactor)                    │
│     - Identify related ACs                                      │
│     ↓                                                           │
│  4. Generate commit message                                     │
│     - Following conventional commits                            │
│     - Reference session/task if applicable                      │
│     ↓                                                           │
│  5. Show preview and confirm                                    │
│     ↓                                                           │
│  6. Execute commit                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Example Output

```
📦 SESSION COMMIT

Session: stories/2026-01-11-new-products-entity

─────────────────────────────────────────

📊 CHANGES DETECTED

Staged:
├─ core/config/entities/products.ts (new)
├─ core/db/migrations/008_products.sql (new)
├─ core/services/ProductsService.ts (new)
└─ core/components/products/ProductForm.tsx (new)

Unstaged:
└─ (none)

─────────────────────────────────────────

📝 GENERATED COMMIT MESSAGE

feat(products): add products entity with CRUD operations

- Create products migration with fields and relations
- Configure entity in entities.config.ts
- Add ProductsService for custom price logic
- Create ProductForm component with validation

Relates to: AC1, AC2, AC3
Session: stories/2026-01-11-new-products-entity

Co-Authored-By: Claude <noreply@anthropic.com>

─────────────────────────────────────────

Commit with this message? [Yes/Edit/Cancel]

> Yes

✓ Changes committed: abc1234
```

---

## With Custom Message

```
/session:commit "feat(products): initial entity setup"
```

Output:

```
📦 SESSION COMMIT

Using provided message: "feat(products): initial entity setup"

─────────────────────────────────────────

📝 FINAL COMMIT MESSAGE

feat(products): initial entity setup

Co-Authored-By: Claude <noreply@anthropic.com>

─────────────────────────────────────────

Commit? [Yes/Edit/Cancel]
```

---

## Commit Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code refactoring |
| `docs` | Documentation changes |
| `test` | Test additions/changes |
| `chore` | Maintenance tasks |

---

## Options

| Option | Description |
|--------|-------------|
| `--no-verify` | Skip pre-commit hooks |
| `--amend` | Amend last commit |
| `--push` | Push after commit |

---

## Task Manager Integration

If `taskManager.enabled`:

```
📋 LINKING COMMIT

ClickUp: #abc123

Add commit reference to task? [Yes/No]

> Yes

✓ Commit linked to task
```

---

## Related Commands

| Command | Action |
|---------|--------|
| `/session:validate` | Validate before commit |
| `/session:close` | Close after final commit |
