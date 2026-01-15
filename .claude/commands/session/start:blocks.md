# /session:start:blocks

Start a new BLOCKS workflow session for mock-driven block development.

**Aliases:** `/blocks`

---

## Required Skills

Before executing, read these skills for context:
- `.claude/skills/page-builder-blocks/SKILL.md` - Block file structure and patterns
- `.claude/skills/mock-analysis/SKILL.md` - Mock parsing patterns
- `.claude/skills/design-system/SKILL.md` - Token mapping

---

## Syntax

```
/session:start:blocks [description]
/blocks [description]
```

---

## Behavior

The BLOCKS workflow is specifically designed for page builder block development from design mocks. It requires a mock and uses visual validation.

**Key differences from TASK/STORY:**
- Mock is **required** (not optional)
- Block-specific discovery (7 questions with block focus)
- No PM or Architecture phases
- Visual validation with retry loop
- 4 phases total

---

## Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  /session:start:blocks                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PHASE A: DISCOVERY (BLOCKS-specific, 7 questions)              │
│  ─────────────────────────────────────────────────              │
│  1. Ask BLOCKS questions:                                       │
│     ├── Task Manager?                                           │
│     ├── Block type? (hero/features/cta/etc)                     │
│     ├── New block or variant?                                   │
│     ├── Mock source? (Stitch/UXPilot/Figma/Other)               │
│     ├── Specific requirements? (optional)                       │
│     ├── Testing?                                                │
│     └── Documentation?                                          │
│     ↓                                                           │
│  PHASE B: SESSION CREATION                                      │
│  ─────────────────────────────                                  │
│  2. Create session folder:                                      │
│     └── blocks/YYYY-MM-DD-block-name/mocks/                     │
│     ↓                                                           │
│  PHASE C: MOCK UPLOAD PAUSE                                     │
│  ──────────────────────────────                                 │
│  3. Display upload instructions                                 │
│  4. Wait for user confirmation ("ready")                        │
│  5. Validate mock files exist                                   │
│     ↓                                                           │
│  PHASE D: EXECUTION                                             │
│  ──────────────────────                                         │
│  6. Phase 1: mock-analyst → analysis.json, ds-mapping.json      │
│  7. Phase 2: block-developer → block files                      │
│  8. Phase 3: visual-comparator → PASS/WARNING/FAIL              │
│     └── If FAIL: retry loop (max 3)                             │
│     ↓                                                           │
│  DONE: Ready for commit                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Discovery Questions

BLOCKS workflow asks 7 questions (consistent with TASK/STORY):

```
┌─────────────────────────────────────────────────────────────────┐
│  BLOCKS DISCOVERY (7 questions)                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. TASK MANAGER                                                │
│     Is there an existing task in a project management system?   │
│     [1] No                                                      │
│     [2] Yes, ClickUp                                            │
│     [3] Yes, Jira                                               │
│     [4] Yes, Linear                                             │
│     [5] Yes, Asana                                              │
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
│     - Other considerations                                      │
│                                                                 │
│  6. TESTING                                                     │
│     What testing is needed?                                     │
│     [1] Visual validation only                                  │
│     [2] Visual + Cypress component test                         │
│     [3] Visual + Unit tests                                     │
│                                                                 │
│  7. DOCUMENTATION                                               │
│     What documentation is needed?                               │
│     [1] None                                                    │
│     [2] Update block catalog                                    │
│     [3] Create usage guide                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Mock Upload Pause

After creating the session folder, Claude pauses with this message:

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

When user responds "ready":

```
Validation:
├── [REQUIRED] At least one image file (*.png, *.jpg)
├── [RECOMMENDED] At least one HTML file (*.html)
└── [OPTIONAL] Tailwind config, assets folder

If validation fails:
├── No image: ERROR - Cannot proceed
├── No HTML: WARNING - Limited analysis, continue
└── Empty folder: ERROR - Ask user to upload
```

---

## Example Usage

### Example 1: New Hero Block from Stitch

```
User: /session:start:blocks Hero block with terminal animation

Claude asks:
├── Task Manager? → ClickUp (abc123)
├── Block type? → Hero / Banner
├── Block decision? → New block
├── Mock source? → Stitch
├── Requirements? → Terminal animation, dark theme
├── Testing? → Visual validation only
└── Documentation? → Update block catalog

Claude creates:
└── blocks/2026-01-12-hero-terminal/mocks/

Claude displays:
"Upload your mock to blocks/2026-01-12-hero-terminal/mocks/"
"Reply 'ready' when done."

User: ready

Claude validates mocks/ → files found

Claude executes:
├── Phase 1: mock-analyst analyzes
├── Phase 2: block-developer creates hero-terminal block
├── Phase 3: visual-comparator validates
│   └── Attempt 1: PASS
└── DONE: Block ready for commit
```

### Example 2: Pricing Block Variant

```
User: /blocks Pricing table variant with toggle

Claude asks:
├── Task Manager? → No
├── Block type? → Pricing / Plans
├── Block decision? → Variant of existing (pricing)
├── Mock source? → Figma
├── Requirements? → Monthly/yearly toggle
├── Testing? → Visual + Cypress component test
└── Documentation? → None

Claude creates folder, waits for upload...

User: ready

Claude executes:
├── Phase 1: mock-analyst identifies differences from existing
├── Phase 2: block-developer creates pricing-toggle variant
├── Phase 3: visual-comparator validates
│   ├── Attempt 1: FAIL (toggle not aligned)
│   ├── Phase 2 fix: adjust toggle positioning
│   ├── Attempt 2: WARNING (minor color difference)
│   └── User: accept
└── DONE: Variant ready for commit
```

---

## Session Files Created

```
.claude/sessions/blocks/YYYY-MM-DD-block-name/
├── mocks/                    # User uploads here
│   ├── code.html
│   ├── screen.png
│   └── assets/
├── analysis.json             # From mock-analyst
├── ds-mapping.json           # From mock-analyst
├── block-plan.json           # Block decision
└── progress.md               # Status tracking
```

---

## Escalation

If during discovery Claude determines BLOCKS is not appropriate:

```
Escalation triggers:
├── Multiple blocks needed → "Consider STORY workflow for full page"
├── API integration required → "Consider TASK workflow"
├── Database changes needed → "Consider STORY workflow"
└── No mock available → "BLOCKS requires mock. Use TASK instead?"
```

---

## Error Handling

### No Mock Uploaded

```
If user says "ready" but mocks/ is empty:

"No files found in mocks/ folder.
Please upload at least:
- A screenshot (*.png or *.jpg)
- Optionally, the HTML export (*.html)

Reply 'ready' when files are uploaded."
```

### Visual Validation Fails 3 Times

```
After 3 failed attempts:

"Visual validation failed after 3 attempts.

Issues found:
1. [Specific issue 1]
2. [Specific issue 2]

Options:
[1] Accept current implementation
[2] Continue with manual adjustments
[3] Escalate to TASK workflow for more complex handling"
```

---

## Related Commands

| Command | Purpose |
|---------|---------|
| `/session:start` | Auto-detect workflow |
| `/session:start:task` | Start TASK workflow |
| `/session:start:story` | Start STORY workflow |
| `/session:status` | Check progress |
| `/session:commit` | Prepare commit |

---

## Related Documentation

- `workflows/blocks.md` - Full BLOCKS workflow documentation
- `skills/page-builder-blocks/SKILL.md` - Block patterns
- `skills/mock-analysis/SKILL.md` - Mock parsing
- `skills/design-system/SKILL.md` - Token mapping

---

## Version History

| Version | Changes |
|---------|---------|
| v1.0 | Initial version - BLOCKS workflow command |
| v1.1 | Expanded to 7 questions (added Task Manager, Testing, Documentation) |
