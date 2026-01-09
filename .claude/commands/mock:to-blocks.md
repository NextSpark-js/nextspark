---
description: "[Mock] Convert mock to page builder blocks with validation loop"
---

# Convert Mock to Blocks

Full workflow to convert a Stitch/Figma mock into NextSpark page builder blocks.
Includes analysis, planning, creation, and visual validation.

**Input:**
{{{ input }}}

---

## Protocol Overview

```
Phase 0: Setup
Phase 1: Parallel Analysis (mock-analyst + ds-analyst)
Phase 2: Block Planning
Phase 3: Human Review
Phase 4: Execution Loop (create, validate, approve)
Phase 5: Summary
```

---

## Phase 0: Setup

### Step 0.1: Parse Input

Extract mock path from input above.

- **If path provided:** Use it
- **If `--resume` flag:** Resume from existing session

```bash
# Check for resume flag
# Example: /mock:to-blocks --resume .claude/sessions/mock-2025-01-09/
```

### Step 0.2: Validate Mock

```bash
# Check mock folder exists
ls -la {mockPath}

# Verify required files
ls {mockPath}/code.html {mockPath}/screen.png
```

If missing, error with helpful message.

### Step 0.3: Determine Theme

```bash
grep "NEXT_PUBLIC_ACTIVE_THEME" .env .env.local 2>/dev/null | head -1 | cut -d'=' -f2
```

Default to "default" if not found.

### Step 0.4: Create Session Folder

```bash
# Create session folder for artifacts
TIMESTAMP=$(date +%Y-%m-%d-%H%M)
SESSION_PATH=".claude/sessions/mock-${TIMESTAMP}"
mkdir -p ${SESSION_PATH}
```

**Confirm:**
```markdown
## Mock-to-Blocks Workflow

**Mock:** {mockPath}
**Theme:** {THEME}
**Session:** {SESSION_PATH}

Starting analysis phase...
```

---

## Phase 1: Parallel Analysis

Launch both agents in parallel for efficiency:

### Agent 1: Mock Structure Analysis

```
Launch Task: mock-analyst agent

**Mode:** STRUCTURE
**Mock Path:** {mockPath}
**Output Path:** {SESSION_PATH}

Analyze the mock HTML structure:
1. Parse HTML and identify sections
2. Classify each section (hero, features, cta, etc.)
3. Inventory components per section
4. Extract Tailwind config if present
5. Generate analysis.json
```

### Agent 2: Design System Analysis

```
Launch Task: ds-analyst agent

**Mock Path:** {mockPath}
**Theme:** {THEME}
**Output Path:** {SESSION_PATH}

Analyze design tokens:
1. Read theme globals.css
2. Extract mock Tailwind config
3. Create token mappings
4. Identify gaps
5. Generate ds-mapping.json
```

**Wait for both to complete.**

**Outputs:**
- `{SESSION_PATH}/analysis.json`
- `{SESSION_PATH}/ds-mapping.json`

---

## Phase 2: Block Planning

```
Launch Task: mock-analyst agent

**Mode:** PLANNING
**Analysis Path:** {SESSION_PATH}/analysis.json
**DS Mapping Path:** {SESSION_PATH}/ds-mapping.json
**Theme:** {THEME}
**Output Path:** {SESSION_PATH}

Create block execution plan:
1. Load existing blocks from theme
2. For each section, apply decision matrix
3. Generate specifications for NEW_BLOCK decisions
4. Map props for USE_EXISTING decisions
5. Generate block-plan.json
```

**Output:** `{SESSION_PATH}/block-plan.json`

---

## Phase 3: Human Review

Present plan summary and ask for approval:

```markdown
## Block Conversion Plan

**Mock:** {mockPath}
**Theme:** {THEME}
**Sections:** {totalSections}

### Execution Plan

| # | Section | Decision | Target Block | Complexity |
|---|---------|----------|--------------|------------|
| 1 | Hero | NEW_BLOCK | hero-terminal | High |
| 2 | Features | USE_EXISTING | features-grid | Low |
| 3 | Comparison | NEW_BLOCK | features-comparison | Medium |
| 4 | CTA | USE_EXISTING | cta-section | Low |
| ... | ... | ... | ... | ... |

### Summary

- **Blocks to create:** {n}
- **Blocks to reuse:** {n}
- **Variants to create:** {n}
- **Estimated effort:** {estimate}

### Design System Compatibility: {score}%

{If gaps exist:}
**Note:** {n} design token gaps identified. Review ds-mapping.json.
```

```typescript
await AskUserQuestion({
  questions: [{
    header: "Plan Approval",
    question: "How would you like to proceed with this plan?",
    options: [
      { label: "Approve All", description: "Execute plan as-is" },
      { label: "Modify Plan", description: "Edit block-plan.json first" },
      { label: "Skip Some", description: "Select which blocks to skip" },
      { label: "Cancel", description: "Cancel workflow" }
    ],
    multiSelect: false
  }]
})
```

**Handle responses:**
- **Approve All:** Continue to Phase 4
- **Modify Plan:** Wait for user to edit, re-read block-plan.json
- **Skip Some:** Ask which to skip, update plan
- **Cancel:** Exit workflow gracefully

---

## Phase 4: Execution Loop

For each block in the approved plan:

```javascript
const MAX_RETRIES = 3
let results = []

for (const block of plan.executionPlan) {
  let retries = 0
  let status = 'pending'

  while (retries < MAX_RETRIES && status !== 'approved') {

    // Step 4.1: Create/Prepare Block
    if (block.decision === 'NEW_BLOCK') {
      // Launch block-developer agent
      await Task({
        agent: 'block-developer',
        prompt: `Create block: ${block.specification.slug}
          Theme: ${theme}
          Specification: ${JSON.stringify(block.specification)}
          DS Mapping: ${SESSION_PATH}/ds-mapping.json`
      })
    }
    // For USE_EXISTING, prepare props mapping document

    // Step 4.2: Build Validation [GATE]
    const buildResult = await Bash('pnpm build')
    if (buildResult.failed) {
      // Launch block-developer to fix build errors
      retries++
      continue
    }

    // Step 4.3: Registry Rebuild
    await Bash('node core/scripts/build/registry.mjs')

    // Step 4.4: Visual Comparison [GATE]
    const comparison = await Task({
      agent: 'visual-comparator',
      prompt: `Compare block: ${block.slug}
        Mock Screenshot: ${block.mockScreenshotPath}
        Theme: ${theme}`
    })

    if (comparison.status === 'FAIL') {
      // Launch block-developer with fix instructions
      retries++
      continue
    }

    // Step 4.5: Human Approval [GATE]
    // Show side-by-side: Mock | Rendered | Diff
    const approval = await AskUserQuestion({
      questions: [{
        header: "Visual Approval",
        question: `Does "${block.slug}" match the mock? (${comparison.similarity}% similarity)`,
        options: [
          { label: "Approve", description: "Block looks good" },
          { label: "Needs Fixes", description: "Specify what to change" },
          { label: "Skip", description: "Move to pendings, continue" }
        ]
      }]
    })

    if (approval === 'Approve') {
      status = 'approved'
      results.push({ block: block.slug, status: 'created' })
    } else if (approval === 'Needs Fixes') {
      // Get fix details from user
      // Launch block-developer
      retries++
    } else if (approval === 'Skip') {
      status = 'skipped'
      results.push({ block: block.slug, status: 'pending', reason: 'skipped' })
      break
    }
  }

  if (retries >= MAX_RETRIES) {
    results.push({
      block: block.slug,
      status: 'pending',
      reason: 'max retries exceeded'
    })
    // Document in pendings.md
  }
}
```

---

## Phase 5: Summary

```markdown
## Mock Conversion Complete

**Mock:** {mockPath}
**Theme:** {THEME}
**Session:** {SESSION_PATH}
**Duration:** {duration}

### Results

| Status | Count | Blocks |
|--------|-------|--------|
| Created | {n} | {list} |
| Reused | {n} | {list} |
| Pending | {n} | {list} |

### Visual Fidelity

| Block | Similarity | Status |
|-------|------------|--------|
| hero-terminal | 94% | PASS |
| features-grid | 91% | PASS |
| features-comparison | 78% | WARNING |
| ... | ... | ... |

**Average:** {avg}%

### Files Generated

- `{SESSION_PATH}/analysis.json`
- `{SESSION_PATH}/ds-mapping.json`
- `{SESSION_PATH}/block-plan.json`
- `{SESSION_PATH}/comparison-results/`

### Pending Items

{For each pending block:}
**{blockSlug}:** {reason}
- Last error: {error}
- Suggestion: {suggestion}

See: `{SESSION_PATH}/pendings.md`

### Next Steps

1. **Review pending blocks** in session folder
2. **Test created blocks** in page editor
3. **Run build:** `pnpm build` for final validation
4. **Create thumbnails:** `public/theme/blocks/{slug}/thumbnail.png`
5. **Commit changes** when satisfied
```

---

## Output Files

| File | Location | Purpose |
|------|----------|---------|
| analysis.json | {SESSION_PATH}/ | Mock structure analysis |
| ds-mapping.json | {SESSION_PATH}/ | Design token mappings |
| block-plan.json | {SESSION_PATH}/ | Execution plan |
| comparison-results/ | {SESSION_PATH}/ | Screenshots and diffs |
| pendings.md | {SESSION_PATH}/ | Blocks that need manual attention |

---

## Usage Examples

```bash
# Basic conversion
/mock:to-blocks _tmp/mocks/stitch/landing-page

# With specific theme
/mock:to-blocks _tmp/mocks/client-design --theme=client-theme

# Resume interrupted session
/mock:to-blocks --resume .claude/sessions/mock-2025-01-09/
```

---

## Related Commands

- `/mock:analyze` - Standalone design system analysis
- `/block:create` - Create a single block manually
- `/block:validate` - Validate existing blocks

---

**Now convert the mock specified above.**
