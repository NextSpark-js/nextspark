---
description: "Create a new project template (formerly \"theme\")"
---

# do:create-theme

**Template Name:** {{{ input }}}

---

## MANDATORY: Read Skill First

Read `.claude/skills/create-theme/SKILL.md` completely before proceeding.

There is no theme scaffold command and no theme directory: the project root is the
product source, and a template in `packages/core/templates/projects/<name>/` is copied
there once at project creation. Copy the closest existing template and follow the skill's
workflow.

---

## After Creation

1. Regenerate the host and registries from a project extracted from the template:
   ```bash
   pnpm build:registries
   ```

2. Verify with the checklist in `create-theme/SKILL.md`.
