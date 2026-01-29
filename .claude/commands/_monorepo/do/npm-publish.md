---
description: "Publish packages to npm registry"
---

# do:npm-publish

**Package or Context:** {{{ input }}}

---

## MANDATORY: Read How-To First

Read `.claude/commands/_monorepo/how-to/releases/npm-publish.md` completely before proceeding.

---

## CRITICAL: NEVER use `npm publish` directly

Using `npm publish` **BREAKS packages** — it does NOT resolve `workspace:*` dependencies.
The ONLY correct flow uses the automated scripts.

---

## Quick Reference

### Full Pipeline (3 steps)

```
Step 1: /do:npm-version     →  Define/validate versions (interactive)
Step 2: pnpm pkg:pack       →  Sync templates + build + create .tgz
Step 3: pnpm pkg:publish    →  Validate + publish to npm in order
```

### All 15 Packages

**Core (7):** core, ui, mobile, testing, cli, create-nextspark-app, ai-workflow
**Themes (4):** theme-default, theme-blog, theme-crm, theme-productivity
**Plugins (4):** plugin-ai, plugin-amplitude, plugin-langchain, plugin-social-media-publisher

### Process

1. **Version check**: Execute the `/do:npm-version` flow first (list versions, ask user, bump if needed, commit)
2. **Prerequisites**: Verify `npm whoami`, clean git status
3. **Pack**: Run `pnpm pkg:pack` (syncs templates, builds all, creates .tgz)
4. **Publish**: Run `pnpm pkg:publish` (validates, publishes in dependency order)
5. **Verify**: Check all 15 packages on npm with `npm view`
6. **Test**: Quick smoke test with `npx create-nextspark-app@beta`

### What `pnpm pkg:pack` does automatically

| Step | Action |
|------|--------|
| 1a | Syncs `apps/dev/app/` → `packages/core/templates/app/` |
| 1b | Syncs `.claude/` → `packages/ai-workflow/claude/` |
| 2 | Builds all 15 packages in dependency order |
| 3 | Creates .tgz files with resolved `workspace:*` → real versions |

---

## Follow the How-To

The how-to contains full step-by-step instructions including:
- Why `npm publish` breaks packages
- Complete pack/publish pipeline
- Verification commands for all 15 packages
- Error scenarios and fixes
- Publish order explanation
