---
description: "[Pre-Commit] Analyze and catalog uncommitted files for organized commits"
---

# Task Pre-Commit - File Analysis and Commit Organization

You are analyzing uncommitted files to help organize logical commits.

**Session context (optional):**
{{{ input }}}

---

## Your Mission

Analyze all uncommitted files and provide:
1. **File categorization** by purpose and area
2. **Session relevance** - which files belong to current session/branch
3. **Commit suggestions** - logical groupings for atomic commits
4. **Anomaly detection** - files that seem out of scope

---

## Protocol

### Step 1: Gather Git Status

```bash
# Get current branch
git branch --show-current

# Get all uncommitted files (staged and unstaged)
git status --porcelain

# Get recent commits to understand branch context
git log --oneline -10

# If on feature branch, compare with main
git diff --name-only main...HEAD 2>/dev/null || git diff --name-only master...HEAD 2>/dev/null
```

### Step 2: Determine Session Context

```typescript
// If session path provided, read session files
if (input && input.includes('.claude/sessions/')) {
  await Read(`${input}/scope.json`)      // What's in scope
  await Read(`${input}/plan.md`)         // What was planned
  await Read(`${input}/progress.md`)     // What's done
}

// Otherwise, try to detect from branch name
// Branch patterns: feature/xxx, fix/xxx, session/xxx
const branchName = await Bash('git branch --show-current')
```

### Step 3: Categorize Files

For each uncommitted file, determine its category:

```typescript
const CATEGORIES = {
  // Session/Workflow files (usually NOT committed)
  'session': {
    patterns: ['.claude/sessions/**/*'],
    description: 'Session files - typically gitignored',
    commitAdvice: 'DO NOT COMMIT - session files are gitignored'
  },

  // Workflow system changes
  'workflow': {
    patterns: [
      '.claude/agents/**/*',
      '.claude/commands/**/*',
      '.claude/config/workflow.md',
      '.claude/config/agents.example.json',
      '.claude/tools/**/*'
    ],
    description: 'Workflow/AI system changes',
    commitAdvice: 'Separate commit: "feat(workflow): description"'
  },

  // Core system changes
  'core': {
    patterns: [
      'core/**/*',
      'app/api/**/*',
      'app/lib/**/*',
      'middleware.ts'
    ],
    description: 'Core system/framework changes',
    commitAdvice: 'Careful review needed - affects all derived projects'
  },

  // Database changes
  'database': {
    patterns: [
      'migrations/**/*',
      'scripts/*db*',
      'scripts/*migrate*'
    ],
    description: 'Database migrations and scripts',
    commitAdvice: 'Commit together: "feat(db): description"'
  },

  // Theme-specific changes
  'theme': {
    patterns: [
      'contents/themes/**/*'
    ],
    description: 'Theme-specific implementation',
    commitAdvice: 'Group by feature within theme'
  },

  // Plugin changes
  'plugin': {
    patterns: [
      'contents/plugins/**/*'
    ],
    description: 'Plugin implementation',
    commitAdvice: 'Group by plugin'
  },

  // Test changes
  'tests': {
    patterns: [
      '**/tests/**/*',
      '**/*.test.ts',
      '**/*.cy.ts',
      '**/*.spec.ts',
      '**/cypress/**/*'
    ],
    description: 'Test files',
    commitAdvice: 'Can commit with related feature or separately'
  },

  // Documentation
  'docs': {
    patterns: [
      '**/*.md',
      'core/docs/**/*',
      '.rules/**/*'
    ],
    description: 'Documentation',
    commitAdvice: 'Commit with feature or as "docs: description"'
  },

  // Configuration files
  'config': {
    patterns: [
      'package.json',
      'pnpm-lock.yaml',
      'tsconfig*.json',
      'jest.config.*',
      'next.config.*',
      '*.config.ts',
      '*.config.js'
    ],
    description: 'Project configuration',
    commitAdvice: 'Review carefully - may affect build/runtime'
  },

  // Frontend components
  'frontend': {
    patterns: [
      '**/components/**/*',
      '**/app/**/page.tsx',
      '**/app/**/layout.tsx',
      '**/*.css',
      '**/messages/**/*'
    ],
    description: 'Frontend implementation',
    commitAdvice: 'Group by feature'
  },

  // Backend/API
  'backend': {
    patterns: [
      '**/api/**/*',
      '**/lib/**/*',
      '**/hooks/**/*',
      '**/types/**/*'
    ],
    description: 'Backend/API implementation',
    commitAdvice: 'Group by feature or domain'
  },

  // Presets (core project only)
  'presets': {
    patterns: [
      'core/presets/**/*'
    ],
    description: 'Preset templates for derived projects',
    commitAdvice: 'Sync commit: "chore(presets): sync from .claude/"'
  }
}
```

### Step 4: Analyze Session Relevance

For each file, determine if it belongs to:

```typescript
interface FileAnalysis {
  path: string
  status: 'M' | 'A' | 'D' | '?' | 'R'  // Modified, Added, Deleted, Untracked, Renamed
  category: keyof typeof CATEGORIES
  sessionRelevance: 'in-scope' | 'related' | 'out-of-scope' | 'unknown'
  suggestedCommit: number  // Group number for commit suggestion
  notes?: string
}

// Session relevance logic:
// - 'in-scope': File matches session's scope.json paths
// - 'related': File is in same feature area but not explicitly in scope
// - 'out-of-scope': File is unrelated to session work
// - 'unknown': Cannot determine (no session context)
```

### Step 5: Suggest Commit Organization

```typescript
interface CommitSuggestion {
  order: number
  type: 'feat' | 'fix' | 'chore' | 'docs' | 'refactor' | 'test'
  scope: string
  description: string
  files: string[]
  sessionRelevance: 'session' | 'extra' | 'mixed'
  priority: 'high' | 'medium' | 'low'
  notes?: string
}

// Commit organization principles:
// 1. Atomic: Each commit should be a logical unit
// 2. Order: Infrastructure first, then features, then docs
// 3. Separation: Session work separate from "extras"
// 4. Dependencies: If B depends on A, commit A first
```

---

## Output Format

### Summary Report

```markdown
## Pre-Commit Analysis Report

**Branch:** `feature/xxx`
**Session:** `.claude/sessions/xxx/` (or "No session context")
**Total Files:** N uncommitted files

### Quick Stats

| Category | Files | In-Scope | Out-of-Scope |
|----------|-------|----------|--------------|
| Core | N | N | N |
| Theme | N | N | N |
| Tests | N | N | N |
| ... | ... | ... | ... |

---

## File Catalog

### Category: [Category Name]

| Status | File | Session Relevance | Suggested Commit |
|--------|------|-------------------|------------------|
| M | `path/to/file.ts` | in-scope | #1 |
| A | `path/to/new.ts` | out-of-scope | #3 |

[Repeat for each category]

---

## Suggested Commits

### Commit #1 (Session Work - HIGH PRIORITY)
**Type:** feat(feature-name)
**Message:** "feat(products): implement CRUD API endpoints"
**Files:**
- `app/api/v1/products/route.ts`
- `core/lib/entities/products/...`
- `migrations/xxx_products.sql`

**Notes:** Core feature implementation from plan.md

---

### Commit #2 (Session Work - MEDIUM PRIORITY)
**Type:** test(feature-name)
**Message:** "test(products): add Cypress UAT tests"
**Files:**
- `contents/themes/default/tests/cypress/e2e/...`

---

### Commit #3 (Extra Changes - LOW PRIORITY)
**Type:** chore(workflow)
**Message:** "chore(workflow): update agent configurations"
**Files:**
- `.claude/agents/xxx.md`
- `.claude/commands/xxx.md`

**Notes:** These changes appear unrelated to current session. Consider:
- Committing separately
- Moving to a different branch
- Stashing for later

---

## Warnings

### Out-of-Scope Files Detected
The following files don't match the session scope:
- `path/to/file.ts` - Reason: Not in scope.json paths
- `other/file.ts` - Reason: Different feature area

**Recommendation:** Review if these should be:
1. Added to current commit (scope expansion)
2. Committed separately
3. Moved to different branch

### Potential Conflicts
- `migrations/xxx.sql` - Database change may affect other sessions
- `core/lib/xxx.ts` - Core change affects all derived projects

---

## Commands

### To stage session-related files only:
\`\`\`bash
git add path/to/file1.ts path/to/file2.ts ...
\`\`\`

### To create suggested commits:
\`\`\`bash
# Commit #1
git add [files]
git commit -m "feat(products): implement CRUD API endpoints"

# Commit #2
git add [files]
git commit -m "test(products): add Cypress UAT tests"
\`\`\`

### To stash out-of-scope changes:
\`\`\`bash
git stash push -m "WIP: workflow changes" -- .claude/agents/ .claude/commands/
\`\`\`
```

---

## Special Cases

### No Session Context
If no session path provided and cannot detect from branch:

```markdown
**Note:** No session context detected.
All files categorized by type only.
Session relevance marked as "unknown".

To provide session context:
/task:pre-commit .claude/sessions/2025-12-24-feature-name-v1/
```

### Mixed Session/Non-Session Work
If significant out-of-scope changes detected:

```markdown
**Warning:** This branch contains mixed work:
- **Session work:** N files related to [feature]
- **Extra work:** N files unrelated to session

**Recommendations:**
1. Review if extra work should be in scope
2. Consider separate commits for clarity
3. Document scope expansion in context.md if intentional
```

### Gitignored Files
Files in `.gitignore` that appear in analysis:

```markdown
**Info:** The following files are gitignored (will not be committed):
- `.claude/sessions/**/*` - Session working files
- `.claude/config/agents.json` - Contains credentials
- `node_modules/`
- `.env*`
```

---

## Execution

Run git status and begin analysis:

```bash
git status --porcelain
git branch --show-current
```

Then categorize all files and generate the report.
