---
description: "Create a new core version release"
---

# do:release-version

**Release Type or Version:** {{{ input }}}

---

## MANDATORY: Read How-To First

Read `.claude/commands/_monorepo/how-to/releases/release-version.md` completely before proceeding.

---

## Quick Reference

### Prerequisites

- Clean git working directory
- On main/master branch
- `packages/core/package.json` exists (it holds the current version)

### Semantic Versioning

| Type | When to Use |
|------|-------------|
| MAJOR | Breaking changes |
| MINOR | New features (backwards compatible) |
| PATCH | Bug fixes |

### Release Commands

```bash
# Bump every package version
scripts/packages/version.sh <major|minor|patch|beta>
# beta keeps a beta release in its channel (0.1.0-beta.N -> 0.1.0-beta.N+1); patch would give 0.1.0, the stable release

# Commit and tag
git add packages/*/package.json plugins/*/package.json
git commit -m "chore: release vX.Y.Z"
git tag -a vX.Y.Z -m "Release vX.Y.Z"

# Push
git push origin main --tags
```

---

## Follow the How-To

The how-to contains step-by-step instructions including:
- Change analysis
- Version determination
- Release execution
- GitHub release creation
