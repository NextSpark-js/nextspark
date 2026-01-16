# BLOCKS Workflow v1.0

**T-Shirt Size:** XS - S
**Session:** `blocks/`
**Subagents:** 2-3 (mock-analyst, block-developer, visual-comparator)
**Duration:** 15-60 minutes
**Token Estimate:** 30-80k

---

## Overview

The BLOCKS workflow is a simplified, mock-driven workflow specifically designed for page builder block development. It requires a design mock and focuses on rapid block creation with visual validation.

**Key Characteristics:**
- Mock is **required** (not optional)
- No PM or Architecture phases
- Visual validation loop with retry
- 4 simple phases

---

## When to Use

### Criteria (ALL must apply)

| Criterion | Requirement |
|-----------|-------------|
| **Task type** | Page builder block development only |
| **Mock available** | Yes (required) |
| **Complexity** | Single block or simple variant |
| **Dependencies** | No database, no API changes |
| **Testing** | Visual comparison only |

### Examples

| Task | T-Shirt | Why BLOCKS |
|------|---------|------------|
| Hero block from Stitch mock | XS-S | Single block, mock-driven |
| Pricing table from Figma | S | Standard block with config |
| Feature grid from UXPilot | S | Repeating pattern block |
| CTA section variant | XS | Variant of existing block |

---

## When NOT to Use

**Use TASK instead if:**
- No mock available
- Block needs API integration
- Block requires new entity data
- Multiple interconnected blocks

**Use STORY instead if:**
- Full landing page with multiple blocks
- Database changes required
- New entity needed for block data
- High business risk

**Use TWEAK instead if:**
- Simple fix to existing block
- Styling adjustments only
- No new functionality

---

## Initial Questions (BLOCKS-specific)

Before starting, Claude asks 7 questions for block development:

```
┌─────────────────────────────────────────────────────────────────┐
│  BLOCKS DISCOVERY (7 questions)                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. TASK MANAGER                                                │
│     Is there an existing task in a project management system?   │
│     [1] No                                                      │
│     [2] Yes, ClickUp (request task_id)                          │
│     [3] Yes, Jira (request task_id)                             │
│     [4] Yes, Linear (request task_id)                           │
│     [5] Yes, Asana (request task_id)                            │
│                                                                 │
│  2. BLOCK TYPE                                                  │
│     What type of block is this?                                 │
│     [1] Hero / Banner                                           │
│     [2] Features / Grid                                         │
│     [3] CTA / Call to Action                                    │
│     [4] Testimonials / Reviews                                  │
│     [5] Pricing / Plans                                         │
│     [6] FAQ / Accordion                                         │
│     [7] Footer / Header                                         │
│     [8] Other (describe)                                        │
│                                                                 │
│  3. BLOCK DECISION                                              │
│     Is this a new block or modification?                        │
│     [1] New block (create from scratch)                         │
│     [2] Variant of existing block (specify which)               │
│     [3] Modification to existing block (specify which)          │
│                                                                 │
│  4. MOCK SOURCE                                                 │
│     Where was the mock created?                                 │
│     [1] Stitch                                                  │
│     [2] UXPilot                                                 │
│     [3] Figma                                                   │
│     [4] Other                                                   │
│                                                                 │
│  5. SPECIFIC REQUIREMENTS (optional)                            │
│     Any specific requirements?                                  │
│     - Animation requirements                                    │
│     - Responsive behavior                                       │
│     - Accessibility needs                                       │
│                                                                 │
│  6. TESTING                                                     │
│     What testing is needed?                                     │
│     [1] Visual validation only (default)                        │
│     [2] Add Cypress component test                              │
│     [3] Add unit tests for block logic                          │
│                                                                 │
│  7. DOCUMENTATION                                               │
│     What documentation is needed?                               │
│     [1] No documentation needed                                 │
│     [2] Update block catalog                                    │
│     [3] Create usage guide                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  BLOCKS WORKFLOW v1.0                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Phase 0: DISCOVERY + MOCK UPLOAD                               │
│  ────────────────────────────────────                           │
│  [MANDATORY] Claude asks 7 BLOCKS questions                     │
│  ├── Task Manager? (No/ClickUp/Jira/Linear/Asana)               │
│  ├── Block type? (hero/features/cta/etc)                        │
│  ├── Block decision? (new/variant/modify)                       │
│  ├── Mock source? (Stitch/UXPilot/Figma/Other)                  │
│  ├── Specific requirements? (optional)                          │
│  ├── Testing? (visual only/Cypress/unit)                        │
│  └── Documentation? (none/catalog/guide)                                     │
│     ↓                                                           │
│  [MANDATORY] Create session folder                              │
│  ├── Create blocks/YYYY-MM-DD-block-name/                       │
│  └── Create mocks/ subfolder                                    │
│     ↓                                                           │
│  [PAUSE] Ask user to upload mock files                          │
│  ├── Display upload instructions                                │
│  ├── Wait for user confirmation ("ready")                       │
│  └── Validate mock files exist                                  │
│     ↓                                                           │
│  Phase 1: MOCK ANALYSIS                                         │
│  ────────────────────────────                                   │
│  [SUBAGENT] mock-analyst runs                                   │
│  ├── Detect files (*.html, *.png, *.jpg, *.pdf)                 │
│  ├── Parse HTML structure (if available)                        │
│  ├── Extract Tailwind config tokens                             │
│  ├── Map to theme tokens (ds-mapping.json)                      │
│  ├── Generate analysis.json                                     │
│  └── Generate block-plan.json (decision matrix)                 │
│     ↓                                                           │
│  Phase 2: BLOCK DEVELOPMENT                                     │
│  ────────────────────────────────                               │
│  [SUBAGENT] block-developer runs                                │
│  ├── Read analysis.json + ds-mapping.json                       │
│  ├── Follow block-plan.json decision                            │
│  ├── Create/modify block files (5 files)                        │
│  │   ├── config.ts                                              │
│  │   ├── schema.ts                                              │
│  │   ├── fields.ts                                              │
│  │   ├── component.tsx                                          │
│  │   └── index.ts                                               │
│  ├── Apply design tokens from ds-mapping                        │
│  └── Register block (rebuild registry)                          │
│     ↓                                                           │
│  Phase 3: VISUAL VALIDATION                                     │
│  ────────────────────────────────                               │
│  [GATE] visual-comparator runs                                  │
│  ├── Navigate to DevTools block preview                         │
│  ├── Take screenshot of rendered block                          │
│  ├── Compare with mock screenshot                               │
│  └── Return verdict: PASS / WARNING / FAIL                      │
│     │                                                           │
│     ├── PASS → Complete, ready for commit                       │
│     │                                                           │
│     ├── WARNING → Show differences, ask user                    │
│     │   └── User decides: Accept or Fix                         │
│     │                                                           │
│     └── FAIL → Return to Phase 2                                │
│         ├── Max 3 retries                                       │
│         └── After 3 fails → Stop, report issues                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Mock Upload Pause

After creating the session folder, Claude pauses and displays:

```
┌─────────────────────────────────────────────────────────────────┐
│  MOCK UPLOAD REQUIRED                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Session created at:                                            │
│  .claude/sessions/blocks/YYYY-MM-DD-block-name/                 │
│                                                                 │
│  Please upload your mock files to:                              │
│  .claude/sessions/blocks/YYYY-MM-DD-block-name/mocks/           │
│                                                                 │
│  Expected files (auto-detected):                                │
│  ├── HTML: code.html, index.html, or any *.html                 │
│  ├── Screenshot: screen.png, or any *.png, *.jpg                │
│  └── Optional: assets/, tailwind.config.js                      │
│                                                                 │
│  Reply "ready" when files are uploaded.                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Mock Validation

When user responds "ready", Claude validates:

```
Validation checks:
├── [REQUIRED] At least one image file (*.png, *.jpg, *.jpeg)
├── [RECOMMENDED] At least one HTML file (*.html)
├── [OPTIONAL] Tailwind config (tailwind.config.js)
└── [OPTIONAL] Assets folder (assets/)

If HTML missing:
├── WARNING: "No HTML file found. Analysis will be limited to visual comparison."
└── Continue with screenshot-only analysis
```

---

## Session Files

### Directory Structure

```
.claude/sessions/blocks/YYYY-MM-DD-block-name/
├── mocks/                    # User uploads here
│   ├── code.html             # From Stitch/Figma export
│   ├── screen.png            # Visual reference
│   └── assets/               # Images, fonts (optional)
│
├── analysis.json             # Mock structure analysis
├── ds-mapping.json           # Design token mapping
├── block-plan.json           # Block decision (new/variant/existing)
└── progress.md               # Status tracking
```

### progress.md Template

```markdown
# Block: [Block Name]

**Status:** In Progress | Blocked | Done
**Workflow:** BLOCKS
**Created:** YYYY-MM-DD

---

## Discovery Answers

| Question | Answer |
|----------|--------|
| **Mock Source** | Stitch / UXPilot / Figma / Other |
| **Block Type** | Hero / Features / CTA / etc |
| **Block Decision** | New / Variant / Modification |
| **Requirements** | [Any specific requirements] |

---

## Mock Files

| File | Status |
|------|--------|
| code.html | Uploaded |
| screen.png | Uploaded |

---

## Analysis Results

**Sections found:** [number]
**Design tokens:** [number mapped] / [number gaps]
**Block decision:** New block: [name] / Variant of: [existing] / Modify: [existing]

---

## Development Progress

- [ ] Block config created
- [ ] Block schema defined
- [ ] Fields configured
- [ ] Component implemented
- [ ] Registry rebuilt

---

## Visual Validation

| Attempt | Result | Notes |
|---------|--------|-------|
| 1 | PASS/WARNING/FAIL | [Notes] |

---

## Checklist

- [ ] Mock uploaded
- [ ] Analysis complete
- [ ] Block created/modified
- [ ] Visual validation passed
- [ ] Ready for commit
```

---

## Phase Details

### Phase 0: Discovery + Mock Upload

**Duration:** 2-5 minutes
**Goal:** Gather context and receive mock files

```
Steps:
1. Ask BLOCKS discovery questions
2. Create session folder structure
3. Display mock upload instructions
4. Wait for user confirmation
5. Validate mock files
6. Initialize progress.md
```

### Phase 1: Mock Analysis

**Duration:** 2-5 minutes
**Goal:** Analyze mock and prepare for development

**Agent:** `mock-analyst`

```
Inputs:
├── mocks/ folder path
├── Mock source (from discovery)
└── Block type hint (from discovery)

Process:
├── Detect and catalog files
├── Parse HTML if available
├── Extract Tailwind tokens
├── Map to theme globals.css
├── Identify sections/components
└── Determine block decision

Outputs:
├── analysis.json
├── ds-mapping.json
└── block-plan.json
```

### Phase 2: Block Development

**Duration:** 10-40 minutes
**Goal:** Create or modify block files

**Agent:** `block-developer`

```
Inputs:
├── analysis.json
├── ds-mapping.json
├── block-plan.json
└── Block type from discovery

Process:
├── Read block decision from block-plan.json
├── If NEW: Create 5 block files
├── If VARIANT: Copy and modify existing
├── If MODIFY: Update existing block
├── Apply tokens from ds-mapping.json
└── Rebuild block registry

Outputs:
├── Block files (5 files)
├── Updated registry
└── Updated progress.md
```

### Phase 3: Visual Validation

**Duration:** 2-10 minutes (per attempt)
**Goal:** Verify visual match with mock

**Agent:** `visual-comparator`

```
Inputs:
├── Block name
├── mocks/screen.png (reference)
└── Theme and locale context

Process:
├── Start dev server (if not running)
├── Navigate to DevTools preview
├── Render block with sample data
├── Take screenshot
├── Compare with mock screenshot
└── Calculate similarity score

Outputs:
├── Comparison result (PASS/WARNING/FAIL)
├── Diff image (if differences found)
└── Specific issues list

Thresholds:
├── PASS: > 90% similarity
├── WARNING: 70-90% similarity
└── FAIL: < 70% similarity
```

---

## Visual Validation Loop

```
┌─────────────────────────────────────────────────────────────────┐
│  VISUAL VALIDATION LOOP                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Attempt 1:                                                     │
│  ├── visual-comparator runs                                     │
│  └── Result: PASS → Done                                        │
│              WARNING → Ask user (accept/fix)                    │
│              FAIL → Go to Attempt 2                             │
│                                                                 │
│  Attempt 2 (if FAIL):                                           │
│  ├── block-developer fixes identified issues                    │
│  ├── visual-comparator runs again                               │
│  └── Result: PASS → Done                                        │
│              WARNING → Ask user (accept/fix)                    │
│              FAIL → Go to Attempt 3                             │
│                                                                 │
│  Attempt 3 (if FAIL):                                           │
│  ├── block-developer fixes identified issues                    │
│  ├── visual-comparator runs again                               │
│  └── Result: PASS → Done                                        │
│              WARNING → Ask user (accept/fix)                    │
│              FAIL → STOP, report issues to user                 │
│                                                                 │
│  Max Retries: 3                                                 │
│  After 3 fails: Manual intervention required                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Commands

### Start BLOCKS workflow

```bash
# Explicit BLOCKS
/session:start:blocks Hero block from Stitch mock

# Auto-detection (if mock mentioned)
/start Create pricing block from this Figma design
```

### Key commands for BLOCKS

| Command | Phase | Purpose |
|---------|-------|---------|
| `/session:start:blocks` | 0 | Start BLOCKS workflow |
| `/session:status` | Any | Check progress |
| `/session:commit` | End | Prepare commit |

---

## Skills Reference

For BLOCKS workflow, consult these skills:

| Skill | Purpose |
|-------|---------|
| `page-builder-blocks` | Block file structure and patterns |
| `mock-analysis` | Mock parsing patterns |
| `design-system` | Token mapping |
| `tailwind-theming` | Theme CSS variables |
| `shadcn-components` | UI component patterns |

---

## Characteristics Summary

| Aspect | BLOCKS Workflow |
|--------|-----------------|
| **Initial questions** | 7 (block-specific) |
| **Session files** | 4 (progress.md + 3 analysis files) |
| **Mock requirement** | Required |
| **Subagents** | 2-3 (mock-analyst, block-developer, visual-comparator) |
| **Validation** | Visual comparison |
| **Retry loop** | Yes (max 3) |
| **Typical duration** | 15-60 minutes |
| **Token estimate** | 30-80k |

---

## Comparison: BLOCKS vs TASK vs STORY

```
                        BLOCKS            TASK              STORY
────────────────────────────────────────────────────────────────────
Questions               7 block-specific  7 standard        7 standard
Mock required           Yes               No                No
Phases                  4                 4 informal        15 formal
Session files           4                 2                 8+
Subagents              2-3               0-3               8-10
Validation             Visual            Self              4 gates
DB support             No                Limited           Full
Duration               15-60 min         30-120 min        1-5 hours
Use case               Block from mock   Medium work       Complex feature
```

---

## Anti-Patterns

### What BLOCKS is NOT for

| Anti-Pattern | Why It's Wrong |
|--------------|----------------|
| Block without mock | Use TASK instead |
| Multiple blocks at once | Use STORY or separate sessions |
| Block with API integration | Use TASK or STORY |
| Complex interactive block | May need STORY for proper testing |
| Block with database needs | Use STORY |

### Signs You're Using BLOCKS Wrong

1. **No mock uploaded** → Use TASK
2. **Need API calls** → Escalate to TASK
3. **Multiple blocks** → Create separate sessions
4. **Database changes** → Escalate to STORY
5. **Taking > 2 hours** → Wrong workflow

---

## Error Handling

### Mock Upload Issues

```
If mock folder is empty:
├── Error: "No files found in mocks/ folder"
└── Action: Wait for user to upload

If no image file:
├── Error: "No screenshot found (*.png, *.jpg)"
└── Action: Cannot proceed without visual reference

If HTML is malformed:
├── Warning: "Could not parse HTML structure"
└── Action: Continue with limited analysis
```

### Visual Validation Issues

```
If DevTools preview unavailable:
├── Error: "Cannot render block preview"
└── Action: Check dev server, verify block registration

If screenshot fails:
├── Error: "Could not capture screenshot"
└── Action: Retry or use manual verification

If comparison fails after 3 attempts:
├── Error: "Visual validation failed after 3 attempts"
└── Action: Report specific issues, request manual review
```

---

## Related Documentation

- `workflows/task.md` - For tasks without mock
- `workflows/story.md` - For complex features
- `skills/page-builder-blocks/SKILL.md` - Block patterns
- `skills/mock-analysis/SKILL.md` - Mock parsing
- `skills/design-system/SKILL.md` - Token mapping

---

## Version History

| Version | Changes |
|---------|---------|
| v1.0 | Initial version - Mock-driven block development workflow |
