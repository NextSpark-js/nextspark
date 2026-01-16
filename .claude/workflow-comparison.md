# Workflow Comparison

Comprehensive comparison of the four workflow types in Claude Workflows v1.0.

---

## 1. Phases & Agents Comparison

### Overview Matrix

| Aspect | TWEAK | BLOCKS | TASK | STORY |
|--------|-------|--------|------|-------|
| **T-Shirt Size** | XS - S | XS - S | S - M - L | L - XL |
| **Duration** | 5-20 min | 15-60 min | 30-120 min | 1-5 hours |
| **Token Usage** | 10-40k | 30-80k | 50-200k | 120-350k |
| **Total Phases** | 0 | 4 | 5 | 16 |
| **Subagents** | 0 | 2-3 | 0-3 | 8-10 |
| **Validation Gates** | Self-check | 1 (visual) | Self-check | 4 mandatory |
| **Mock Support** | No | Required | Optional | Optional |
| **DB Migrations** | No | No | No | Yes |

### Detailed Phase Breakdown

#### TWEAK Workflow (0 Phases)

```
No formal phases - Direct implementation by Claude
```

| Step | Type | Agent | Description |
|------|------|-------|-------------|
| Discovery | ORCHESTRATOR | Claude | 3 questions |
| Implementation | ORCHESTRATOR | Claude | Direct code changes |
| Self-check | ORCHESTRATOR | Claude | Verify changes work |

---

#### BLOCKS Workflow (4 Phases)

```
Phase 0 → Phase 1 → Phase 2 → Phase 3 (with retry loop)
```

| Phase | Name | Type | Agent | Description |
|-------|------|------|-------|-------------|
| 0 | Discovery + Mock Upload | ORCHESTRATOR | Claude | 7 questions, create folder, wait for mock |
| 1 | Mock Analysis | SUBAGENT | mock-analyst | Generate analysis.json, ds-mapping.json, block-plan.json |
| 2 | Block Development | SUBAGENT | block-developer | Create/modify block files |
| 3 | Visual Validation | GATE | visual-comparator | Compare rendered vs mock (max 3 retries) |

---

#### TASK Workflow (5 Phases)

```
Phase 0 → [0.5] → [0.6] → Phase 1 → Phase 2 → Phase 3
```

| Phase | Name | Type | Agent | Conditional |
|-------|------|------|-------|-------------|
| 0 | Discovery | ORCHESTRATOR | Claude | Always |
| 0.5 | Mock Upload Pause | ORCHESTRATOR | Claude | If mock selected |
| 0.6 | Mock Analysis | SUBAGENT | mock-analyst | If mock selected |
| 1 | Requirements | ORCHESTRATOR | Claude | Always (creates requirements.md) |
| 2 | Light Planning | ORCHESTRATOR | Claude | Always |
| 3 | Execute | ORCHESTRATOR | Claude + selective | Uses subagents as needed |
| 4 | Validate | ORCHESTRATOR | Claude | Self-check |

---

#### STORY Workflow (16 Phases)

```
Full planning → DB → Backend → Frontend → QA → Finalization
```

| Phase | Name | Type | Agent | Block |
|-------|------|------|-------|-------|
| 0 | Discovery | ORCHESTRATOR | Claude | BLOQUE 0: INIT |
| 0.5 | Mock Upload Pause | ORCHESTRATOR | Claude | BLOQUE 0: INIT |
| 0.6 | Mock Analysis | SUBAGENT | mock-analyst | BLOQUE 0: INIT |
| 1 | PM Requirements | SUBAGENT | product-manager | BLOQUE 1: PLANNING |
| 2 | Architecture | SUBAGENT | architecture-supervisor | BLOQUE 1: PLANNING |
| 3 | DB Entity | SUBAGENT | db-developer | BLOQUE 2: DATABASE |
| 4 | DB Validation | GATE | db-validator | BLOQUE 2: DATABASE |
| 5 | Backend TDD | SUBAGENT | backend-developer | BLOQUE 3: BACKEND |
| 6 | Backend Validation | GATE | backend-validator | BLOQUE 3: BACKEND |
| 7 | API Testing | GATE | api-tester | BLOQUE 3: BACKEND |
| 8 | Frontend | SUBAGENT | frontend-developer | BLOQUE 4: FRONTEND |
| 9 | Frontend Validation | GATE | frontend-validator | BLOQUE 4: FRONTEND |
| 10 | QA Manual | ORCHESTRATOR | Claude | BLOQUE 5: QA |
| 11 | QA Automation | OPTIONAL | qa-automation | BLOQUE 5: QA |
| 12 | Code Review | SUBAGENT | code-reviewer | BLOQUE 6: FINALIZATION |
| 13 | Documentation | CONDITIONAL | documentation-writer | BLOQUE 6: FINALIZATION |
| 14 | Unit Tests | OPTIONAL | unit-test-writer | BLOQUE 6: FINALIZATION |

---

## 2. Workflow Descriptions & Use Cases

### TWEAK

**Purpose:** Quick fixes and small adjustments that don't require planning or validation.

**Characteristics:**
- No session files created
- No subagents involved
- Claude implements directly
- Self-validation only

**Example Use Cases:**

| Use Case | Description |
|----------|-------------|
| Fix typo | "Fix typo in login button text" |
| Config change | "Update API timeout from 30s to 60s" |
| Style tweak | "Change header background to dark blue" |
| Add comment | "Add JSDoc to calculateTotal function" |
| Update constant | "Change MAX_RETRIES from 3 to 5" |

**When NOT to use:**
- If you have a design mock → Use BLOCKS
- If tests need to be created → Escalate to TASK
- If documentation is needed → Escalate to TASK

---

### BLOCKS

**Purpose:** Page builder block development from design mocks with visual validation.

**Characteristics:**
- Mock is **required**
- Specialized for block development only
- Visual validation with retry loop (max 3)
- No PM or Architecture phases

**Example Use Cases:**

| Use Case | Description |
|----------|-------------|
| New hero block | "Hero block with terminal animation from Stitch mock" |
| Pricing variant | "Pricing table with monthly/yearly toggle" |
| Features grid | "Features block with 3-column icon grid" |
| CTA section | "CTA block with gradient background" |
| Testimonials | "Testimonials carousel block" |

**When NOT to use:**
- If API integration is needed → Escalate to TASK
- If database changes are needed → Escalate to STORY
- If multiple pages/blocks are needed → Escalate to STORY

---

### TASK

**Purpose:** Medium-sized features with light planning. Claude creates requirements and executes.

**Characteristics:**
- Claude creates requirements.md (not PM)
- Light planning (no architecture-supervisor)
- Selective subagent usage
- Mock support (optional)

**Example Use Cases:**

| Use Case | Description |
|----------|-------------|
| Add field | "Add phone field to user profile" |
| New component | "Create reusable date picker component" |
| Improve search | "Add filters to product search" |
| Form validation | "Add validation to checkout form" |
| API endpoint | "Create endpoint for user preferences" |

**When NOT to use:**
- If new database entity is needed → Escalate to STORY
- If complex blocks from mock → Use BLOCKS
- If it's a simple typo/config → Use TWEAK

---

### STORY

**Purpose:** Complex features requiring full planning, database changes, and comprehensive validation.

**Characteristics:**
- PM creates requirements.md
- Architecture-supervisor creates plan.md
- Full validation gates (4 mandatory)
- Supports database migrations
- Mock support (optional)

**Example Use Cases:**

| Use Case | Description |
|----------|-------------|
| New entity | "Create products entity with CRUD" |
| Full feature | "Implement shopping cart system" |
| Complex integration | "Add Stripe payment processing" |
| Landing page | "New landing page from Stitch mock (5+ sections)" |
| Auth system | "Implement team-based permissions" |

**When NOT to use:**
- If no database changes → Consider TASK
- If single block from mock → Use BLOCKS
- If simple change → Use TWEAK

---

## 3. Initialization Questions

### Questions by Workflow

| Question | TWEAK | BLOCKS | TASK | STORY |
|----------|:-----:|:------:|:----:|:-----:|
| **1. Task Manager** | ✓ | ✓ | ✓ | ✓ |
| **2. Database Policy** | - | - | ✓ | ✓ |
| **3. Entity Type** | - | - | ✓ | ✓ |
| **4. Blocks** | - | ✓* | ✓ | ✓ |
| **5. Mock** | - | ✓** | ✓ | ✓ |
| **5a. Mock For** | - | - | (if mock)*** | (if mock)*** |
| **5b. Mock Source** | - | ✓** | (if mock) | (if mock) |
| **5c. Mock Complexity** | - | - | (if mock) | (if mock) |
| **6. Testing** | ✓ | ✓ | ✓ | ✓ |
| **7. Documentation** | ✓ | ✓ | ✓ | ✓ |

**Notes:**
- *BLOCKS: Asks Block Type and Block Decision (more specific than generic Blocks question)
- **BLOCKS: Mock is required (source always asked)
- ***If Q4 = blocks, defaults to "Page builder blocks"

### Question Options

#### Q1. Task Manager
```
[1] No
[2] Yes, ClickUp (request task_id)
[3] Yes, Jira (request task_id)
[4] Yes, Linear (request task_id)
[5] Yes, Asana (request task_id)
```

#### Q2. Database Policy (TASK/STORY only)
```
[1] No database changes needed
[2] Reset allowed (dev/staging)
[3] Incremental migrations only (production)
```

#### Q3. Entity Type (TASK/STORY only)
```
[1] No entity changes
[2] Modify existing entity (request name)
[3] New entity (⚠️ may trigger STORY recommendation)
```

#### Q4. Blocks
**TASK/STORY:**
```
[1] No blocks needed
[2] Simple blocks (Claude/frontend-developer creates)
[3] Complex blocks (⚠️ recommend BLOCKS workflow)
```

**BLOCKS:**
```
Block Type:
[1] Hero / Banner
[2] Features / Grid
[3] CTA / Call to Action
[4] Testimonials / Reviews
[5] Pricing / Plans
[6] FAQ / Accordion
[7] Footer / Header
[8] Other (describe)

Block Decision:
[1] New block (create from scratch)
[2] Variant of existing block (specify which)
[3] Modification to existing block (specify which)
```

#### Q5. Mock
**TASK/STORY:**
```
[1] No
[2] Yes, I have a mock
    IF YES:
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
```

**BLOCKS:**
```
Mock Source (required):
[1] Stitch
[2] UXPilot
[3] Figma
[4] Other
```

#### Q6. Testing
**TWEAK/TASK/STORY:**
```
[1] Run existing tests only
[2] Modify existing tests
[3] Create new tests (API/UAT/Unit)
```

**BLOCKS:**
```
[1] Visual validation only
[2] Visual + Cypress component test
[3] Visual + Unit tests
```

#### Q7. Documentation
**TWEAK/TASK/STORY:**
```
[1] No documentation needed
[2] Update existing docs
[3] Create new docs (public/superadmin/skills)
```

**BLOCKS:**
```
[1] None
[2] Update block catalog
[3] Create usage guide
```

---

## 4. Session Folder Structure

### TWEAK

```
No session folder created (optional log only)

.claude/sessions/tweaks/
└── 2024-01-12-fix-typo.md          # Optional log
```

### BLOCKS

```
.claude/sessions/blocks/
└── 2024-01-12-hero-terminal/
    ├── mocks/                       # User uploads here
    │   ├── code.html                # Auto-detected
    │   ├── screen.png               # Auto-detected
    │   └── assets/                  # Optional
    ├── analysis.json                # From mock-analyst
    ├── ds-mapping.json              # From mock-analyst
    ├── block-plan.json              # Block decision
    └── progress.md                  # Status tracking
```

### TASK

```
.claude/sessions/tasks/
└── 2024-01-12-add-phone-field/
    ├── mocks/                       # Optional (if mock selected)
    │   ├── screen.png
    │   └── code.html
    ├── analysis.json                # If mock (from mock-analyst)
    ├── ds-mapping.json              # If mock (from mock-analyst)
    ├── requirements.md              # Created by Claude
    └── progress.md                  # Status tracking
```

### STORY

```
.claude/sessions/stories/
└── 2024-01-12-products-entity/
    ├── mocks/                       # Optional (if mock selected)
    │   ├── screen.png
    │   └── code.html
    ├── analysis.json                # If mock (from mock-analyst)
    ├── ds-mapping.json              # If mock (from mock-analyst)
    ├── context.md                   # Business context
    ├── requirements.md              # Created by PM subagent
    ├── clickup_task.md              # If task manager linked
    ├── plan.md                      # Created by architecture-supervisor
    ├── scope.json                   # File modification scope
    ├── pendings.md                  # Deferred items
    ├── tests.md                     # Test documentation
    └── iterations/
        └── 01-initial/
            ├── progress.md          # Iteration progress
            └── changes.md           # Changes made
```

---

## Quick Decision Guide

```
                                    Has Mock?
                                       │
                        ┌──────────────┴──────────────┐
                        │                             │
                       YES                           NO
                        │                             │
                 Mock is for?                  New DB Entity?
                        │                             │
          ┌─────────────┼─────────────┐        ┌──────┴──────┐
          │             │             │        │             │
      Single       Multiple      Full Page   YES            NO
       Block        Blocks         (5+)       │             │
          │             │             │       │      Files Affected?
          ↓             ↓             ↓       ↓             │
       BLOCKS        TASK          STORY   STORY    ┌───────┼───────┐
                                                    │       │       │
                                                   1-3    4-15    16+
                                                    │       │       │
                                                 TWEAK    TASK   STORY
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-01-12 | Initial version - Four workflow system |
