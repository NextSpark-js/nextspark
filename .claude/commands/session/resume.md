# /session:resume

Resume an existing session by recovering all context.

---

## Syntax

```
/session:resume [session-path]
```

---

## Behavior

### Without path (wizard)

```
/session:resume
```

Shows list of active sessions to select from.

### With path

```
/session:resume stories/2026-01-11-new-entity
/session:resume 2026-01-11-new-entity
```

Resumes the specified session directly.

---

## Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  /session:resume                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. SESSION SELECTION                                           │
│     │                                                           │
│     ├─► With path: Use that session                             │
│     │                                                           │
│     └─► Without path: Show wizard                               │
│         ┌─────────────────────────────────────┐                 │
│         │ Active sessions:                    │                 │
│         │                                     │                 │
│         │ STORIES:                            │                 │
│         │ [1] 2026-01-11-new-entity (iter-02) │                 │
│         │ [2] 2026-01-08-refactor-auth        │                 │
│         │                                     │                 │
│         │ TASKS:                              │                 │
│         │ [3] 2026-01-10-improve-search       │                 │
│         │                                     │                 │
│         │ Which one to resume? [1-3]          │                 │
│         └─────────────────────────────────────┘                 │
│     ↓                                                           │
│  2. CONTEXT LOADING                                             │
│     │                                                           │
│     │  For Stories:                                             │
│     │  [✓] context.md                                           │
│     │  [✓] requirements.md                                      │
│     │  [✓] plan.md                                              │
│     │  [✓] scope.json                                           │
│     │  [✓] pendings.md                                          │
│     │  [✓] iterations/*/closed.json                             │
│     │  [✓] current/progress.md                                  │
│     │                                                           │
│     │  For Tasks:                                               │
│     │  [✓] requirements.md                                      │
│     │  [✓] progress.md                                          │
│     ↓                                                           │
│  3. CONTEXT SUMMARY                                             │
│     ↓                                                           │
│  4. ASK NEXT STEPS                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Example Output

```
📋 SESSION LOADED

Project: New Entity - Products
Type: Story (STORY workflow)
T-Shirt: L
Iteration: 02-scope-change

─────────────────────────────────────────

📝 Objective:
Implement Products entity with complete CRUD...

📊 Current state:
- Phase: EXECUTE (backend-developer completed)
- Progress: 60%
- Next: frontend-developer

🔄 Scope change (iteration-02):
- Added "variants" field to entity
- Requires updating migrations and API

📌 Global pending items:
- [ ] Add performance tests
- [ ] Document API endpoints
- [ ] Review DB indexes

─────────────────────────────────────────

What would you like to do?
[1] Continue from where you left off
[2] View more details
[3] Create new iteration
[4] Change phase
```

---

## File Reading Order

### For Stories

1. `context.md` → Understand the project
2. `requirements.md` → What needs to be achieved
3. `plan.md` → How to achieve it
4. `scope.json` → What files are in scope
5. `pendings.md` → What was left pending
6. `iterations/*/closed.json` → Why each iteration was closed
7. `current/progress.md` → Current phase state
8. `current/changes.md` → What files were modified

### For Tasks

1. `requirements.md` → What needs to be achieved
2. `progress.md` → Current state

---

## Iteration Evaluation

For each closed iteration:

```json
{
  "iteration": "01-initial",
  "status": "completed",
  "closedAt": "2026-01-05T10:30:00Z",
  "summary": "Initial implementation, pending scope change",
  "nextIteration": "02-scope-change"
}
```

Claude must:
1. **Read** closing reason
2. **Extract** learnings (what worked, what didn't)
3. **Not repeat** mistakes from previous iterations
4. **Respect** previous decisions

---

## Special Considerations

| Situation | Action |
|-----------|--------|
| High business risk | Remind when resuming |
| Critical pending items | Show highlighted |
| Previous iteration failed | Explain what went wrong |
| Long time since last activity | Suggest reviewing code changes |

---

## Example with Alert

```
⚠️ RISK REMINDER

This session works with: Checkout Flow (critical)

Last activity: 5 days ago
There have been 12 commits in the repo since then.

Recommendation: Verify there are no conflicts with
recent changes before continuing.

Continue? [Yes/Review changes first]
```
