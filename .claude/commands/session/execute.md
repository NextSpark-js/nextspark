# /session:execute

Execute the development of the active session.

**Aliases:** `/execute`

---

## Workflow Detection

**[MANDATORY]** Before executing, determine the workflow type:

1. Check session path:
   - `stories/*` → STORY workflow
   - `tasks/*` → TASK workflow
   - No session files → TWEAK workflow

2. Read `progress.md` (if exists) for current phase

3. Adapt execution based on workflow type

---

## Syntax

```
/session:execute [--from-phase <phase>]
```

---

## Behavior

Continues workflow execution from the current phase (or from a specific phase).

---

## Flow by Workflow

### TWEAK

```
Does not use /session:execute
Development is direct without phases.
```

### TASK

```
/session:execute

1. Read requirements.md
2. Implement changes
   - Call subagents if needed
3. Validate
   - Build passes?
   - Tests pass?
4. Update progress.md
5. Ready for commit
```

### STORY

```
/session:execute

1. Read progress.md (current phase)
2. Execute next phase:
   - Call corresponding subagent
   - Wait for result
   - Validate gate (if applicable)
3. Update progress.md
4. Repeat until complete or blocker
```

---

## Example: TASK

```
🚀 EXECUTING: improve-search

Reading requirements.md...
✓ 3 ACs defined

─────────────────────────────────────────

📋 EXECUTION PLAN

1. [ ] Optimize query in SearchService
2. [ ] Add index in DB
3. [ ] Update tests

─────────────────────────────────────────

Starting implementation...

[backend-developer] Optimizing SearchService...
✓ Query optimized

[backend-developer] Verifying build...
✓ Build successful

─────────────────────────────────────────

📊 PROGRESS: 66%

- [x] Optimize query
- [x] Add index
- [ ] Update tests

Continue with tests? [Yes/Pause]
```

---

## Example: STORY

```
🚀 EXECUTING: new-products-entity

Session: stories/2026-01-11-new-products-entity
Iteration: 02-scope-change

─────────────────────────────────────────

📊 CURRENT STATE

Completed phase: backend-validator [PASS]
Current phase: api-tester

─────────────────────────────────────────

Starting Phase 9: api-tester...

[api-tester] Running API tests...
├─ POST /api/v1/products     ✓
├─ GET /api/v1/products      ✓
├─ GET /api/v1/products/:id  ✓
├─ PATCH /api/v1/products/:id ✓
└─ DELETE /api/v1/products/:id ✓

[api-tester] Result: 5/5 tests passed

─────────────────────────────────────────

✓ GATE PASSED: api-tester

Next phase: frontend-developer
Continue? [Yes/Pause]
```

---

## Options

| Option | Description |
|--------|-------------|
| `--from-phase <phase>` | Start from specific phase |
| `--skip-gates` | Skip gate validation (not recommended) |
| `--dry-run` | Show what would be done without executing |

---

## Error Handling

### Failed Gate

```
❌ GATE FAILED: backend-validator

Errors found:
- TypeScript error in products.ts:45
- Test failing: products.test.ts

Options:
[1] Call backend-developer to fix
[2] Fix manually
[3] Pause execution
```

### Blocker

```
🚫 BLOCKER DETECTED

The api-tester subagent reported:
"API endpoint /products returns 500"

Options:
[1] Create new iteration (blocked)
[2] Call backend-developer
[3] Pause and review manually
```

---

## Related Commands

| Command | Action |
|---------|--------|
| `/session:status` | View current state |
| `/session:scope-change` | If there's a scope change |
| `/session:close` | When finished |
