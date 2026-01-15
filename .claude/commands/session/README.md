# /session:* Commands

Unified namespace for development session management.

---

## Top-Level Aliases

| Alias | Full Command | Description |
|-------|--------------|-------------|
| `/start` | `/session:start` | Start new session |
| `/execute` | `/session:execute` | Execute development |
| `/commit` | `/session:commit` | Prepare commit |
| `/fix` | `/session:fix:bug` | Fix bug |
| `/status` | `/session:status` | View status |

---

## Commands by Category

### Lifecycle (session management)

| Command | Description |
|---------|-------------|
| `/session:start` | Intelligent entry point |
| `/session:start:tweak` | Tweak workflow (XS-S) |
| `/session:start:task` | Task workflow (S-M-L) |
| `/session:start:story` | Story workflow (L-XL) |
| `/session:resume` | Resume existing session |
| `/session:status` | View session status |
| `/session:close` | Close active session |

### Phases (development phases)

| Command | Description |
|---------|-------------|
| `/session:execute` | Execute development |
| `/session:validate` | Validate implementation |
| `/session:review` | Final code review |
| `/session:refine` | Refine requirements or plan |

### Actions (common actions)

| Command | Description |
|---------|-------------|
| `/session:commit` | Prepare commit |
| `/session:demo` | Visual demo with Playwright |
| `/session:explain` | Explain code/decision |
| `/session:pending` | Document pending items |
| `/session:scope-change` | Handle scope change |

### Fix (corrections)

| Command | Description |
|---------|-------------|
| `/session:fix:bug` | Fix bug |
| `/session:fix:build` | Fix build errors |
| `/session:fix:test` | Fix failing tests |

### Block (page builder)

| Command | Description |
|---------|-------------|
| `/session:block:create` | Create new block |
| `/session:block:update` | Modify existing block |
| `/session:block:list` | List available blocks |
| `/session:block:validate` | Validate structure |

### DB (database)

| Command | Description |
|---------|-------------|
| `/session:db:entity` | Create entity migration |
| `/session:db:sample` | Generate sample data |
| `/session:db:fix` | Fix migrations |

### Test (testing)

| Command | Description |
|---------|-------------|
| `/session:test:write` | Write Cypress tests |
| `/session:test:run` | Run test suite |
| `/session:test:fix` | Fix failing tests |

### Doc (documentation)

| Command | Description |
|---------|-------------|
| `/session:doc:feature` | Document feature |
| `/session:doc:read` | Read docs before working |
| `/session:doc:bdd` | Generate BDD from tests |

---

## Command Standards

Each command follows these conventions:

### 1. Required Skills Section
Commands that need specific knowledge include a **Required Skills** section listing skills to read before executing.

### 2. Mandatory Markers
Steps marked with **[MANDATORY]** must be performed. Steps without this marker are recommended but can be adapted.

### 3. Workflow Context
Generic commands include a **Workflow Detection** or **Workflow Context** section explaining how they behave in TWEAK, TASK, and STORY workflows.

### 4. Skill → Command Mapping
See `skills/README.md` for the complete Command → Skill Mapping table.

---

## Naming Convention

```
:  (colon) → SUBCOMMAND separator (hierarchy)

   /session:start           → start command
   /session:start:tweak     → quick subcommand of start
   /session:fix:bug         → bug subcommand of fix

-  (hyphen) → COMPOUND WORD separator

   /session:scope-change    → "scope change" is a concept
```

---

## Typical Flow

```
1. /session:start "description"     # Evaluate and create session
   ↓
2. (Claude suggests workflow)
   ↓
3. /session:execute                  # Execute development
   ↓
4. (if scope changes)
   /session:scope-change scope-change "reason"
   ↓
5. /session:status                   # Verify progress
   ↓
6. /session:close "summary"          # Close session
```

---

## Command Files

### Lifecycle
- [session-start.md](./session-start.md) - Start session
- [session-resume.md](./session-resume.md) - Resume session
- [session-status.md](./session-status.md) - View status
- [session-close.md](./session-close.md) - Close session

### Phases
- [session-execute.md](./session-execute.md) - Execute development
- [session-validate.md](./session-validate.md) - Validate implementation
- [session-review.md](./session-review.md) - Code review
- [session-refine.md](./session-refine.md) - Refine requirements/plan

### Actions
- [session-commit.md](./session-commit.md) - Prepare commit
- [session-demo.md](./session-demo.md) - Visual demo
- [session-explain.md](./session-explain.md) - Explain code
- [session-pending.md](./session-pending.md) - Document pending
- [session-scope-change.md](./session-scope-change.md) - Scope change

### Fix
- [session-fix-bug.md](./session-fix-bug.md) - Fix bug
- [session-fix-build.md](./session-fix-build.md) - Fix build errors
- [session-fix-test.md](./session-fix-test.md) - Fix failing tests

### Block
- [session-block-create.md](./session-block-create.md) - Create block
- [session-block-update.md](./session-block-update.md) - Update block
- [session-block-list.md](./session-block-list.md) - List blocks
- [session-block-validate.md](./session-block-validate.md) - Validate blocks

### DB
- [session-db-entity.md](./session-db-entity.md) - Create entity migration
- [session-db-sample.md](./session-db-sample.md) - Generate sample data
- [session-db-fix.md](./session-db-fix.md) - Fix migrations

### Test
- [session-test-write.md](./session-test-write.md) - Write tests
- [session-test-run.md](./session-test-run.md) - Run tests
- [session-test-fix.md](./session-test-fix.md) - Fix tests

### Doc
- [session-doc-feature.md](./session-doc-feature.md) - Document feature
- [session-doc-read.md](./session-doc-read.md) - Read documentation
- [session-doc-bdd.md](./session-doc-bdd.md) - Generate BDD docs
