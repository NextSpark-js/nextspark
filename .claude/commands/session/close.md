---
disable-model-invocation: true
---

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
│  4. Worktree cleanup (if session used a worktree)               │
│     - Check if worktree path exists in session metadata         │
│     - Check PR merge status:                                    │
│       $ gh pr list --head <branch> --state merged               │
│     │                                                           │
│     ├─► PR MERGED: Auto-suggest removal                         │
│     │   "PR merged! Removing worktree and branch..."            │
│     │   $ git worktree remove <path>                            │
│     │   $ git branch -d <branch>                                │
│     │   (Still ask for confirmation before deleting)             │
│     │                                                           │
│     ├─► PR OPEN: Ask what to do                                 │
│     │   "PR still open. Remove worktree?"                       │
│     │   [1] Remove worktree (keep branch)                       │
│     │   [2] Keep worktree                                       │
│     │                                                           │
│     └─► NO PR: Ask with all options                             │
│         [1] Remove worktree and delete branch                   │
│         [2] Remove worktree but keep branch                     │
│         [3] Keep worktree                                       │
│     ↓                                                           │
│  5. Archive?                                                    │
│     [Yes, archive] [No, keep]                                   │
│     ↓                                                           │
│  6. Update task manager (if enabled)                            │
│     - Post final comment                                        │
│     - Change status to "done"                                   │
│     ↓                                                           │
│  7. Show summary                                                │
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

## With Worktree

### PR Already Merged

```
🌳 WORKTREE CLEANUP

This session used a worktree:
  Path: G:/GitHub/nextspark/repo-add-phone-field
  Branch: feature/add-phone-field

✅ PR #42 was MERGED into main.

Recommended: Remove worktree and clean up branch.

$ git worktree remove ../repo-add-phone-field
✓ Worktree removed

$ git branch -d feature/add-phone-field
✓ Branch deleted (was merged)

$ git remote prune origin
✓ Remote references cleaned
```

### PR Still Open

```
🌳 WORKTREE CLEANUP

This session used a worktree:
  Path: G:/GitHub/nextspark/repo-add-phone-field
  Branch: feature/add-phone-field

⏳ PR #42 is still OPEN (not merged yet).

Options:
[1] Remove worktree but keep branch (can re-create worktree later)
[2] Keep worktree (continue working later)
```

### No PR Found

```
🌳 WORKTREE CLEANUP

This session used a worktree:
  Path: G:/GitHub/nextspark/repo-add-phone-field
  Branch: feature/add-phone-field

Options:
[1] Remove worktree and delete branch
[2] Remove worktree but keep branch
[3] Keep worktree (remove later with: git worktree remove ../repo-add-phone-field)
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
