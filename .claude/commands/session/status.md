---
disable-model-invocation: true
---

# /session:status

View the status of active sessions.

**Aliases:** `/status`

---

## Syntax

```
/session:status [session-path]
```

---

## Behavior

### Without path (all sessions)

```
/session:status
```

Shows summary of all active sessions.

### With path (specific session)

```
/session:status stories/2026-01-11-new-entity
```

Shows detailed status of a specific session.

---

## General Output

```
📊 SESSION STATUS

STORIES (2 active)
─────────────────────────────────────────
[L] 2026-01-11-new-products-entity
    Iteration: 02-scope-change
    Phase: EXECUTE (frontend-developer)
    Progress: 60%
    Last activity: 2 hours ago

[XL] 2026-01-08-refactor-auth
    Iteration: 01-initial
    Phase: BACKEND (api-tester)
    Progress: 35%
    Last activity: 1 day ago

TASKS (1 active)
─────────────────────────────────────────
[M] 2026-01-10-improve-search
    Progress: 80%
    Last activity: 5 hours ago

LOGS (3 today)
─────────────────────────────────────────
2026-01-11-fix-typo-login
2026-01-11-update-config
2026-01-11-fix-validation
```

---

## Detailed Output (with path)

```
📊 STATUS: 2026-01-11-new-products-entity

Type: Story (STORY workflow)
T-Shirt: L
Created: 2026-01-11
Last activity: 2 hours ago

─────────────────────────────────────────

📈 PROGRESS

BLOCK 1: PLANNING ████████████████████ 100%
├─ [✓] product-manager
└─ [✓] architecture-supervisor

BLOCK 2: FOUNDATION ████████████████████ 100%
├─ [✓] db-entity-developer
└─ [✓] db-entity-validator

BLOCK 3: BACKEND ████████████████████ 100%
├─ [✓] backend-developer
└─ [✓] backend-validator

BLOCK 4: DESIGN ░░░░░░░░░░░░░░░░░░░░ SKIP

BLOCK 5: FRONTEND ████████░░░░░░░░░░░░ 40%
├─ [→] frontend-developer (in progress)
└─ [ ] frontend-validator

BLOCK 6: CODE REVIEW ░░░░░░░░░░░░░░░░░░░░ 0%
└─ [ ] code-reviewer

BLOCK 7: QA ░░░░░░░░░░░░░░░░░░░░ 0%
├─ [ ] qa-manual (Claude orchestrator)
└─ [ ] qa-automation

BLOCK 8: FINALIZATION ░░░░░░░░░░░░░░░░░░░░ 0%
├─ [ ] documentation-writer
└─ [ ] unit-test-writer

─────────────────────────────────────────

📁 ITERATIONS

01-initial [CLOSED]
   Duration: 3 days
   Reason: scope-change
   Summary: "Initial implementation done"

02-scope-change [ACTIVE]
   Started: 2026-01-14
   Reason: "add-variants-field"
   Progress: In frontend

─────────────────────────────────────────

📌 PENDING ITEMS (3)

- [ ] Add performance tests
- [ ] Document API endpoints
- [ ] Review DB indexes

─────────────────────────────────────────

🎯 NEXT STEP

Complete frontend-developer:
- [ ] Create UI components
- [ ] Implement hooks
- [ ] Add translations
```

---

## Task Manager Integration

If a task is linked:

```
📋 LINKED TASK

ClickUp: #abc123
URL: https://app.clickup.com/t/abc123
Status: In Progress
Assignee: Pablo
```

---

## Related Commands

| Command | Action |
|---------|--------|
| `/session:resume` | Resume this session |
| `/session:close` | Close this session |
| `/session:scope-change` | Create new iteration |
