---
description: "Increment package versions with semantic versioning"
---

# do:npm-version

**Version Type or Context:** {{{ input }}}

---

## MANDATORY: Read How-To First

Read `.claude/commands/how-to/releases/npm-version.md` completely before proceeding.

---

## Quick Reference

### Version Types

| Type | Example | Use Case |
|------|---------|----------|
| patch | 0.1.0 → 0.1.1 | Bug fixes |
| minor | 0.1.0 → 0.2.0 | New features |
| major | 0.1.0 → 1.0.0 | Breaking changes |
| prerelease | 0.1.0-beta.3 → 0.1.0-beta.4 | Pre-release |

### Commands

```bash
cd packages/core
npm version <type> --no-git-tag-version
```

---

## Follow the How-To

The how-to contains step-by-step instructions including:
- Commit analysis
- Version recommendation
- Execution steps
- Next steps (commit, tag, publish)
