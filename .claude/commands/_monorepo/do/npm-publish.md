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

### All 12 Packages

**Core (7):** core, ui, mobile, testing, cli, create-nextspark-app, ai-workflow
**Project templates:** bundled inside `@nextsparkjs/core`; not published separately
**Plugins (5):** plugin-ai, plugin-amplitude, plugin-langchain, plugin-social-media-publisher, plugin-walkme

### Process

1. **Version check**: Execute the `/do:npm-version` flow first (list versions, ask user, bump if needed, commit)
2. **Prerequisites**: Verify `npm whoami`, clean git status
3. **Pack**: Run `pnpm pkg:pack` (syncs templates, builds all, creates .tgz)
4. **Publish**: Run `pnpm pkg:publish` (validates, publishes in dependency order)
5. **Verify**: Check all 12 packages on npm
6. **Test**: Quick smoke test with `pnpm dlx create-nextspark-app@beta`

### What `pnpm pkg:pack` does automatically

| Step | Action |
|------|--------|
| 1a | Syncs `apps/dev/src/app/` → `packages/core/templates/app/` |
| 1b | Syncs `.claude/` → `packages/ai-workflow/claude/` |
| 2 | Builds all 12 publishable packages in dependency order |
| 3 | Creates .tgz files with resolved `workspace:*` → real versions |

---

## Follow the How-To

The how-to contains full step-by-step instructions including:
- Why `npm publish` breaks packages
- Complete pack/publish pipeline
- Verification commands for all 16 packages
- Error scenarios and fixes
- Publish order explanation
