---
description: "Publish packages to npm registry"
---

# do:npm-publish

**Package or Context:** {{{ input }}}

---

## MANDATORY: Read How-To First

Read `.claude/commands/how-to/releases/npm-publish.md` completely before proceeding.

---

## Quick Reference

### Prerequisites

- Packaged files exist (`/tmp/nextspark-release/*.tgz`)
- npm authenticated (`npm whoami`)
- OTP ready if 2FA enabled

### Publish Order

1. @nextsparkjs/core (no dependencies)
2. @nextsparkjs/cli (depends on core)
3. create-nextspark-app (depends on cli)

### Commands

```bash
# Dry run first
npm publish *.tgz --tag beta --access public --dry-run

# Actual publish
npm publish *.tgz --tag beta --access public --otp=XXXXXX
```

---

## Follow the How-To

The how-to contains step-by-step instructions including:
- Context analysis commands
- Status verification
- Publish execution
- Result verification
