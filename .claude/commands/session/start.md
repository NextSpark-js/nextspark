# /session:start

Intelligent entry point to start a new development session.

**Aliases:** `/start`

---

## Required Skills

Before executing, read these skills for context:
- `.claude/skills/core-theme-responsibilities/SKILL.md` - Understand core/theme/plugin boundaries
- `.claude/skills/entity-system/SKILL.md` - If the task involves entities

---

## Syntax

```
/session:start [description]
/session:start:tweak [description]
/session:start:task [description]
/session:start:story [description]
/session:start:blocks [description]
```

---

## Behavior

### Without subcommand (intelligent)

```
/session:start Add phone field to user profile
```

Claude:
1. **[MANDATORY]** Analyzes the description
2. **[MANDATORY]** Reads `/about/` from active theme (if exists)
3. **[MANDATORY]** Evaluates technical and business risk
4. **[MANDATORY]** Determines T-Shirt size
5. **[MANDATORY]** Suggests appropriate workflow
6. **[MANDATORY]** Asks for user confirmation
7. **[MANDATORY]** Asks discovery questions (graduated by workflow)
8. **[MANDATORY]** Executes workflow with discovery context

### With subcommand (explicit)

```
/session:start:tweak Fix typo in login
/session:start:task Improve product search
/session:start:story New products entity
/session:start:blocks Hero block from Stitch mock
```

Skips evaluation but still asks discovery questions for the selected workflow.

**Note:** BLOCKS workflow requires a mock and uses BLOCKS-specific questions (see `session-start-blocks.md`).

---

## Detailed Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  /session:start                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PHASE A: EVALUATION                                            │
│  ───────────────────                                            │
│  1. Read user description                                       │
│     ↓                                                           │
│  2. Read .claude/config/workspace.json                          │
│     - preferences.language                                      │
│     - preferences.defaultWorkflow                               │
│     ↓                                                           │
│  3. Read /about from theme (if exists)                          │
│     - business.md                                               │
│     - critical-flows.md                                         │
│     - risk-areas.md                                             │
│     ↓                                                           │
│  4. Evaluate Technical Risk                                     │
│     - How many files?                                           │
│     - How many layers (DB/API/UI)?                              │
│     - Existing tests?                                           │
│     ↓                                                           │
│  5. Evaluate Business Risk                                      │
│     - Touches critical flows?                                   │
│     - Affects revenue?                                          │
│     - Is it reversible?                                         │
│     ↓                                                           │
│  6. Apply bidimensional matrix → T-Shirt Size                   │
│     ↓                                                           │
│  7. Determine workflow:                                         │
│     - XS → TWEAK                                                │
│     - S (low risk) → TWEAK                                      │
│     - S-M → TASK                                                │
│     - L-XL → STORY                                              │
│     - Mock-driven block → BLOCKS                                │
│     ↓                                                           │
│  8. Show evaluation and ask for confirmation                    │
│     ↓                                                           │
│  PHASE B: DISCOVERY (Claude asks questions)                     │
│  ──────────────────────────────────────────                     │
│  9. Ask discovery questions based on workflow:                  │
│     │                                                           │
│     ├── TWEAK: 3 core questions                                 │
│     │   ├── Task Manager?                                       │
│     │   ├── Testing?                                            │
│     │   └── Documentation?                                      │
│     │                                                           │
│     ├── BLOCKS: 7 block-specific questions                      │
│     │   ├── Task Manager?                                       │
│     │   ├── Block Type? (hero/features/cta/etc)                 │
│     │   ├── Block Decision? (new/variant/modify)                │
│     │   ├── Mock Source? (Stitch/UXPilot/Figma/Other)           │
│     │   ├── Specific Requirements? (optional)                   │
│     │   ├── Testing?                                            │
│     │   └── Documentation?                                      │
│     │                                                           │
│     ├── TASK: All 7 questions + conditional mock questions      │
│     │   ├── Task Manager?                                       │
│     │   ├── Database Policy?                                    │
│     │   ├── Entity Type?                                        │
│     │   ├── Blocks?                                             │
│     │   ├── Mock? + IF YES: 5a, 5b, 5c (see below)              │
│     │   ├── Testing?                                            │
│     │   └── Documentation?                                      │
│     │                                                           │
│     └── STORY: All 7 questions + conditional mock questions     │
│     ↓                                                           │
│  10. Collect discovery context                                  │
│     ↓                                                           │
│  PHASE C: MOCK UPLOAD PAUSE (if mock selected)                  │
│  ──────────────────────────────────────────────                 │
│  10.5 If mock was selected:                                     │
│     ├── Create session folder with mocks/ subfolder             │
│     ├── Display upload instructions                             │
│     ├── Wait for user to confirm "ready"                        │
│     └── Validate mock files exist                               │
│     ↓                                                           │
│  PHASE D: EXECUTION                                             │
│  ──────────────────────                                         │
│  11. Execute workflow with context:                             │
│     │                                                           │
│     ├── TWEAK: Implement directly                               │
│     │                                                           │
│     ├── BLOCKS: mock-analyst → block-developer → visual-compare │
│     │                                                           │
│     ├── TASK: [If mock] → Phase 0.6 mock-analyst                │
│     │         → Create requirements.md → Execute                │
│     │                                                           │
│     └── STORY: [If mock] → Phase 0.6 mock-analyst               │
│               → Launch PM with context → Arc → Execute          │
│     ↓                                                           │
│  12. Show next steps                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Example Output

### Phase A: Evaluation

```
📊 TASK EVALUATION

Description: "Add phone field to user profile"

┌─────────────────────────────────────────┐
│ Technical Risk: LOW                     │
│ - Estimated files: 4-6                  │
│ - Layers: API + UI                      │
│ - Existing tests: Yes                   │
├─────────────────────────────────────────┤
│ Business Risk: LOW                      │
│ - Critical flows: No                    │
│ - Affects revenue: No                   │
└─────────────────────────────────────────┘

📐 T-Shirt Size: S
🔄 Recommended workflow: TASK

Proceed with TASK workflow? [Yes/No/Change]
```

### Phase B: Discovery Questions

After user confirms workflow, Claude asks discovery questions:

```
📋 DISCOVERY QUESTIONS

I need some context before we begin. Please answer:

─────────────────────────────────────────

1. TASK MANAGER
   Is there an existing task in a project management system?

   [1] No
   [2] Yes, ClickUp
   [3] Yes, Jira
   [4] Yes, Linear
   [5] Yes, Asana

> 2
> Task ID: abc123

─────────────────────────────────────────

2. DATABASE POLICY
   How should the database be handled?

   [1] No database changes needed
   [2] Reset allowed (dev/staging)
   [3] Incremental migrations only (production)

> 1

─────────────────────────────────────────

3. ENTITY TYPE
   What type of entity work?

   [1] No entity changes
   [2] Modify existing entity
   [3] New entity (⚠️ recommend STORY)

> 2
> Entity name: users

─────────────────────────────────────────

4. BLOCKS
   Are blocks needed?

   [1] No blocks needed
   [2] Simple blocks
   [3] Complex blocks (⚠️ recommend BLOCKS workflow)

> 1

─────────────────────────────────────────

5. MOCK
   Do you have a design mock?

   [1] No
   [2] Yes

> 1

─────────────────────────────────────────

6. TESTING
   What testing is needed?

   [1] Run existing tests only
   [2] Modify existing tests
   [3] Create new tests

> 2

─────────────────────────────────────────

7. DOCUMENTATION
   What documentation is needed?

   [1] No documentation needed
   [2] Update existing docs
   [3] Create new docs

> 1

─────────────────────────────────────────

✓ Discovery complete!

Context collected:
├── Task Manager: ClickUp (abc123)
├── Database: No changes
├── Entity: Modify users
├── Blocks: None
├── Mock: None
├── Testing: Modify existing
└── Documentation: None

Proceeding with TASK workflow...
```

### Phase C: Execution

```
📁 Creating session...

Session created: tasks/2026-01-12-add-phone-field/

Creating requirements.md with discovery context...

✓ Ready to execute

Next steps:
1. Review requirements.md
2. Run /session:execute to implement
```

---

## Risk Alerts

If high business risk is detected:

```
⚠️ BUSINESS RISK ALERT

This change affects: Checkout Flow (critical flow)

Potential impact:
- Conversion loss if errors occur
- Directly affects revenue

Recommendations:
1. Use STORY workflow (mandatory)
2. Exhaustive E2E testing
3. Deploy during low traffic hours
4. Have rollback plan ready

Continue with these precautions? [Yes/No]
```

---

## Discovery Questions Reference

### Questions by Workflow

| Question | TWEAK | BLOCKS | TASK | STORY |
|----------|:-----:|:------:|:----:|:-----:|
| 1. Task Manager | ✓ | ✓ | ✓ | ✓ |
| 2. Database Policy | - | - | ✓ | ✓ |
| 3. Entity Type | - | - | ✓ | ✓ |
| 4. Blocks | - | ✓* | ✓ | ✓ |
| 5. Mock | - | ✓** | ✓ | ✓ |
| 5a. Mock For | - | - | (if mock)*** | (if mock)*** |
| 5b. Mock Source | - | ✓** | (if mock) | (if mock) |
| 5c. Mock Complexity | - | - | (if mock) | (if mock) |
| 6. Testing | ✓ | ✓ | ✓ | ✓ |
| 7. Documentation | ✓ | ✓ | ✓ | ✓ |

*BLOCKS: Asks Block Type and Block Decision instead of generic Blocks question
**BLOCKS: Mock is required (source always asked)
***If Q4 = blocks, defaults to "Page builder blocks"

### Question Details

```
1. TASK MANAGER
   - No
   - Yes, ClickUp (request task_id)
   - Yes, Jira (request task_id)
   - Yes, Linear (request task_id)
   - Yes, Asana (request task_id)

2. DATABASE POLICY
   - No database changes needed
   - Reset allowed (dev/staging)
   - Incremental migrations only (production)

3. ENTITY TYPE
   - No entity changes
   - Modify existing entity (request name)
   - New entity (⚠️ may trigger STORY recommendation)

4. BLOCKS
   - No blocks needed
   - Simple blocks
   - Complex blocks (⚠️ may trigger BLOCKS workflow)

5. MOCK
   - No
   - Yes, I have a mock
     IF YES, ask conditional questions:
     ├── 5a. Mock is for:
     │   [1] Page builder blocks (default if Q4=blocks)
     │   [2] Complete screens/pages
     │   [3] Specific components
     │
     ├── 5b. Mock was created in:
     │   [1] Stitch
     │   [2] UXPilot
     │   [3] Figma
     │   [4] Other
     │
     └── 5c. Number of sections/blocks:
         [1] Single block/component
         [2] Multiple (2-4)
         [3] Full page (5+)

6. TESTING
   - Run existing tests only
   - Modify existing tests
   - Create new tests (API/UAT/Unit)

7. DOCUMENTATION
   - No documentation needed
   - Update existing docs
   - Create new docs (public/superadmin/skills)
```

### Escalation Triggers

During discovery, if user answers suggest more complexity:

| Answer | Current Workflow | Recommendation |
|--------|-----------------|----------------|
| New entity | TASK | Escalate to STORY |
| Complex blocks (Q4) | TASK | Use BLOCKS workflow |
| DB migrations needed | TASK | Escalate to STORY |
| Create new tests | TWEAK | Escalate to TASK |
| Create new docs | TWEAK | Escalate to TASK |
| Q4=blocks + Q5=mock (single) | TASK | Suggest BLOCKS workflow |
| Mock for full page (5+) | TASK | Escalate to STORY |
| Mock with API integration | BLOCKS | Escalate to TASK |
| Mock + DB changes needed | BLOCKS | Escalate to STORY |

---

## Optional Parameters

| Parameter | Description |
|-----------|-------------|
| `--force-quick` | Force TWEAK without evaluation |
| `--force-standard` | Force TASK without evaluation |
| `--force-complete` | Force STORY without evaluation |
| `--no-risk-check` | Skip risk evaluation |
| `--task <id>` | Link with existing task |

---

## After Execution

Depending on the workflow:

### TWEAK
- Does not create session files
- Uses discovery context (3 questions) internally
- Proceeds directly to implementation
- If task manager linked → Updates external task status

### BLOCKS
- Creates `blocks/YYYY-MM-DD-name/`
- Creates `mocks/` subfolder
- **PAUSES** for user to upload mock files
- After "ready", runs mock-analyst → block-developer → visual-comparator
- Visual validation loop (max 3 retries)
- See `session-start-blocks.md` for details

### TASK
- Creates `tasks/YYYY-MM-DD-name/`
- **If mock selected:** Creates `mocks/` subfolder, PAUSES for upload
- **If mock selected:** Runs mock-analyst (Phase 0.6) → analysis.json, ds-mapping.json
- Creates `requirements.md` with Discovery Answers section (includes mock analysis)
- Claude uses discovery context to define ACs and approach
- If task manager linked → Syncs with external task

### STORY
- Creates `stories/YYYY-MM-DD-name/`
- **If mock selected:** Creates `mocks/` subfolder, PAUSES for upload
- **If mock selected:** Runs mock-analyst (Phase 0.6) → analysis.json, ds-mapping.json
- Launches `product-manager` subagent WITH discovery context + mock analysis
- PM creates `requirements.md` (does NOT ask questions again)
- PM creates `clickup_task.md` if task manager linked
- Then launches `architecture-supervisor` for plan.md
