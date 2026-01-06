---
description: "Create a new plugin with scaffold + validation (standalone, outside workflow)"
---

# Create New Plugin

**Input:** {{{ input }}}

---

## Overview

This command creates a new plugin from the preset template and validates it's ready for use. This is a **standalone command** executed outside the main workflow.

**Required Skill:** Read `.claude/skills/create-plugin/SKILL.md` before proceeding.

---

## Protocol

### Step 1: Parse Input

Extract from input:
- **Plugin name** (required) - will be kebab-case slug
- **Display name** (optional)
- **Description** (optional)
- **Complexity** (optional - utility | service | full)

If complexity not provided, ask:

```typescript
await AskUserQuestion({
  questions: [{
    header: "Complexity",
    question: "What is the complexity level of this plugin?",
    options: [
      { label: "Utility", description: "Functions only, no UI components" },
      { label: "Service (Recommended)", description: "API + components + hooks" },
      { label: "Full-featured", description: "Entities + migrations + API + UI" }
    ],
    multiSelect: false
  }]
})
```

### Step 2: Verify Plugin Doesn't Exist

```bash
ls -la contents/plugins/{plugin-slug}/ 2>/dev/null
```

If exists, ask user:
- Use existing plugin
- Choose different name
- Abort

### Step 3: Execute Scaffold

```bash
# Create plugin from preset
pnpm create:plugin {plugin-slug} --complexity {complexity}
```

### Step 4: Customize Plugin Config

Edit `contents/plugins/{plugin-slug}/plugin.config.ts`:
- Set `displayName` if provided
- Set `description` if provided
- Configure lifecycle hooks as needed

### Step 5: Register in plugin-sandbox Theme

Edit `contents/themes/plugin-sandbox/config/theme.config.ts`:

```typescript
plugins: [
  'existing-plugin',
  '{plugin-slug}',  // Add new plugin
]
```

### Step 6: Validate Plugin (inline)

Execute all validations that plugin-validator would do:

```bash
# 1. Run registry generation
node core/scripts/build/registry.mjs

# 2. Check TypeScript
pnpm tsc --noEmit

# 3. Run full build with plugin-sandbox theme
NEXT_PUBLIC_ACTIVE_THEME=plugin-sandbox pnpm build
```

**Validation Checklist:**
- [ ] `plugin.config.ts` exists and valid
- [ ] `lib/core.ts` exists
- [ ] `lib/types.ts` exists
- [ ] `.env.example` exists and documented
- [ ] Plugin registered in plugin-sandbox theme
- [ ] Registry generation succeeds
- [ ] TypeScript compiles
- [ ] Build passes

### Step 7: Verify Registry

```bash
# Check plugin appears in registry
grep "{plugin-slug}" core/lib/registries/plugin-registry.ts
```

### Step 8: Report Results

If validation passes:

```markdown
## Plugin Created: {plugin-name}

**Location:** `contents/plugins/{slug}/`
**Complexity:** {complexity}
**Test Theme:** plugin-sandbox

### Files Created
- [x] plugin.config.ts - Configuration and lifecycle hooks
- [x] lib/core.ts - Core plugin logic
- [x] lib/types.ts - TypeScript types
- [x] .env.example - Environment variables
- [x] README.md - Documentation

### Validation Passed
- [x] Registered in plugin-sandbox theme
- [x] Appears in PLUGIN_REGISTRY
- [x] TypeScript compiles
- [x] Build passes

### Next Steps
1. Copy `.env.example` variables to `.env`
2. Implement core logic in `lib/core.ts`
3. Add API endpoints if needed
4. Test: `NEXT_PUBLIC_ACTIVE_THEME=plugin-sandbox pnpm dev`
```

If validation fails:

```markdown
## Plugin Creation Failed

**Error:** [specific error message]

### Failed Checks
- [ ] [List failed validations]

### Fix Required
[Instructions to fix the issue]

### Retry
After fixing, run: `/create:plugin {name}` again
```

---

## Quick Reference

```bash
# Create plugin
pnpm create:plugin my-plugin --complexity service

# Build with plugin-sandbox
NEXT_PUBLIC_ACTIVE_THEME=plugin-sandbox pnpm build

# Dev with plugin-sandbox
NEXT_PUBLIC_ACTIVE_THEME=plugin-sandbox pnpm dev
```

---

## Complexity Reference

| Level | Creates | Use When |
|-------|---------|----------|
| `utility` | lib/, types | Simple helper functions |
| `service` | lib/, api/, components/, hooks/ | Most plugins |
| `full` | lib/, api/, components/, entities/, migrations/ | Database tables |
