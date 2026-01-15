# /session:close

Close the active session or a specific session.

---

## Syntax

```
/session:close [session-path] [summary]
```

---

## Behavior

### Without path (active session)

```
/session:close
```

Closes the current active session (if there is one).

### With path

```
/session:close stories/2026-01-11-new-entity "Feature completed"
```

Closes the specified session.

---

## Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  /session:close                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Verify ACs are met                                          │
│     - Read requirements.md                                      │
│     - Verify checklist in progress.md                           │
│     ↓                                                           │
│  2. All ACs completed?                                          │
│     │                                                           │
│     ├─► YES: Continue                                           │
│     │                                                           │
│     └─► NO: Warn                                                │
│         "There are 2 pending ACs. Close anyway?"                │
│     ↓                                                           │
│  3. Execute session-close.sh                                    │
│     ↓                                                           │
│  4. Archive?                                                    │
│     [Yes, archive] [No, keep]                                   │
│     ↓                                                           │
│  5. Update task manager (if enabled)                            │
│     - Post final comment                                        │
│     - Change status to "done"                                   │
│     ↓                                                           │
│  6. Show summary                                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Example Output

```
📋 CLOSING SESSION

Session: stories/2026-01-11-new-products-entity
Type: Story (STORY)
Iterations: 2

─────────────────────────────────────────

✅ AC VERIFICATION

AC1: Create products migration           ✓
AC2: Implement CRUD API                  ✓
AC3: Create management UI                ✓
AC4: Automated tests                     ✓

All ACs completed: 4/4

─────────────────────────────────────────

📊 SUMMARY

- Total duration: 5 days
- Iterations: 2
- Files modified: 23
- Tests created: 12

─────────────────────────────────────────

✓ Session closed

Archive session? [Yes/No]
```

---

## With Pending ACs

```
⚠️ WARNING

There are pending ACs:
- [ ] AC4: Automated tests

Options:
[1] Close anyway (document pending items)
[2] Cancel and continue working
[3] Move pending to new iteration
```

---

## Task Manager Integration

If `taskManager.enabled`:

```
📋 TASK UPDATE

ClickUp: #abc123

Posting final comment...
✓ Comment posted

Updating status to "done"...
✓ Status updated
```

---

## Related Commands

| Command | Action |
|---------|--------|
| `/session:status` | View status before closing |
| `/session:pending` | Document pending items |
