---
description: "Create a new theme with scaffold + validation (standalone, outside workflow)"
---

# Create New Theme

**Input:** {{{ input }}}

---

## Overview

This command creates a new theme from the preset template and validates it's ready for use. This is a **standalone command** executed outside the main workflow.

**Required Skill:** Read `.claude/skills/create-theme/SKILL.md` before proceeding.

---

## Protocol

### Step 1: Parse Input

Extract from input:
- **Theme name** (required) - will be kebab-case slug
- **Display name** (optional - defaults to title-cased name)
- **Description** (optional)

If name not provided, ask:

```typescript
await AskUserQuestion({
  questions: [{
    header: "Theme Name",
    question: "What should the theme be called? (kebab-case, e.g., 'my-app')",
    options: [
      { label: "Provide name", description: "I'll enter a custom name" }
    ],
    multiSelect: false
  }]
})
```

### Step 2: Verify Theme Doesn't Exist

```bash
ls -la contents/themes/{theme-slug}/ 2>/dev/null
```

If exists, ask user:
- Use existing theme
- Choose different name
- Abort

### Step 3: Execute Scaffold

```bash
# Create theme from preset
pnpm create:theme {theme-slug}
```

### Step 4: Customize Theme Config

Edit `contents/themes/{theme-slug}/config/theme.config.ts`:
- Set `displayName` if provided
- Set `description` if provided
- Configure initial colors if specified

### Step 5: Validate Theme (inline)

Execute all validations that theme-validator would do:

```bash
# 1. Run registry generation
node core/scripts/build/registry.mjs

# 2. Check TypeScript
pnpm tsc --noEmit

# 3. Run full build with theme
NEXT_PUBLIC_ACTIVE_THEME={theme-slug} pnpm build
```

**Validation Checklist:**
- [ ] `theme.config.ts` exists and valid
- [ ] `app.config.ts` exists and valid
- [ ] `dashboard.config.ts` exists and valid
- [ ] `permissions.config.ts` exists and valid
- [ ] Registry generation succeeds
- [ ] TypeScript compiles
- [ ] Build passes

### Step 6: Report Results

If validation passes:

```markdown
## Theme Created: {theme-name}

**Location:** `contents/themes/{slug}/`

### Files Created
- [x] config/theme.config.ts
- [x] config/app.config.ts
- [x] config/dashboard.config.ts
- [x] config/permissions.config.ts
- [x] messages/en.json
- [x] messages/es.json

### Validation Passed
- [x] Registry generation succeeded
- [x] TypeScript compiles
- [x] Build passes

### Next Steps
1. Configure `config/app.config.ts` for your app
2. Set up Team Mode if needed in `app.config.ts`
3. Add navigation in `dashboard.config.ts`
4. Define permissions in `permissions.config.ts`
5. Start development: `NEXT_PUBLIC_ACTIVE_THEME={slug} pnpm dev`
```

If validation fails:

```markdown
## Theme Creation Failed

**Error:** [specific error message]

### Failed Checks
- [ ] [List failed validations]

### Fix Required
[Instructions to fix the issue]

### Retry
After fixing, run: `/create:theme {name}` again
```

---

## Quick Reference

```bash
# Create theme
pnpm create:theme my-app

# Build with theme
NEXT_PUBLIC_ACTIVE_THEME=my-app pnpm build

# Dev with theme
NEXT_PUBLIC_ACTIVE_THEME=my-app pnpm dev
```
