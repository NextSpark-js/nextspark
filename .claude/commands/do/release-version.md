---
description: "Create a new core version release"
---

# do:release-version

**Release Type or Version:** {{{ input }}}

---

## MANDATORY: Read How-To First

Read `.claude/commands/how-to/releases/release-version.md` completely before proceeding.

---

## Quick Reference

### Prerequisites

- Clean git working directory
- On main/master branch
- `core.version.json` exists

### Semantic Versioning

| Type | When to Use |
|------|-------------|
| MAJOR | Breaking changes |
| MINOR | New features (backwards compatible) |
| PATCH | Bug fixes |

### Release Commands

```bash
# Update version file
echo '{ "version": "X.Y.Z" }' > core.version.json

# Commit and tag
git add core.version.json
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
