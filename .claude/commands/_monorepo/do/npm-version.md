---
description: "Increment package versions with semantic versioning"
---

# do:npm-version

**Version Type or Context:** {{{ input }}}

---

## MANDATORY: Read How-To First

Read `.claude/commands/_monorepo/how-to/releases/npm-version.md` completely before proceeding.

---

## Quick Reference

### All 15 Packages

**Core (7):** core, ui, mobile, testing, cli, create-nextspark-app, ai-workflow
**Themes (4):** theme-default, theme-blog, theme-crm, theme-productivity
**Plugins (4):** plugin-ai, plugin-amplitude, plugin-langchain, plugin-social-media-publisher

### Process

1. **List versions**: Read ALL 15 package.json files and display current versions
2. **Ask user**: Use `AskUserQuestion` with these options:
   - Beta bump (all aligned) — increment pre-release on all 15
   - Release (all aligned) — patch/minor/major on all 15
   - Release (only modified) — bump only changed packages (warns about desync)
   - Versions are ready — validate only, no changes
3. **Execute**: Update all relevant package.json files
4. **Verify**: Show before/after comparison
5. **Commit**: `chore: bump all packages to <version>`

### Version Types

| Type | Example | Use Case |
|------|---------|----------|
| prerelease | 0.1.0-beta.85 → 0.1.0-beta.86 | Continue beta |
| patch | 0.1.0-beta.85 → 0.1.1 | Graduate stable (bug fixes) |
| minor | 0.1.0-beta.85 → 0.2.0 | Graduate stable (features) |
| major | 0.1.0-beta.85 → 1.0.0 | Breaking changes |

---

## Follow the How-To

The how-to contains full step-by-step instructions including:
- Complete package registry with paths
- Interactive question flow
- Modified package detection
- Commit analysis for release bumps
- Verification commands
