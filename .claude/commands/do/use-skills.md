---
description: "Read and apply relevant skills for the requested task"
---

# do:use-skills

**Task:** {{{ input }}}

---

## Protocol

This command enforces the use of skills for any development task.

### Step 1: Read Skills Index

**MANDATORY:** Read `.claude/skills/README.md` to understand all available skills.

The README contains:
- Complete list of 44+ skills
- Categories and descriptions
- Mapping of tasks → skills

### Step 2: Identify Relevant Skills

Based on the task keywords, identify which skills apply:

| Task Keywords | Relevant Skills |
|---------------|-----------------|
| entity, crud, model | `entity-system` |
| migration, sql, database | `database-migrations` |
| api, endpoint, route | `nextjs-api-development`, `entity-api` |
| scheduled, background, webhook | `scheduled-actions` |
| theme, styling, css | `create-theme`, `tailwind-theming` |
| plugin, extension | `create-plugin`, `plugins` |
| block, page-builder | `page-builder-blocks`, `block-decision-matrix` |
| test, cypress, e2e | `cypress-e2e`, `cypress-api`, `pom-patterns` |
| auth, login, session | `better-auth`, `permissions-system` |
| component, ui | `shadcn-components`, `react-patterns` |
| i18n, translation | `i18n-nextintl` |

### Step 3: Read Each Relevant Skill

For each identified skill, read the complete SKILL.md:

```
.claude/skills/{skill-name}/SKILL.md
```

### Step 4: Check for Scripts

Many skills include automation scripts:

```bash
ls .claude/skills/{skill-name}/scripts/
```

Use scripts when available to automate tasks.

### Step 5: Apply Patterns

Execute the task following:
- Conventions documented in the skill
- Code patterns and templates
- Directory structure requirements

### Step 6: Validate

Use the skill's checklist (usually at the end of SKILL.md) to verify compliance.

---

## Example Usage

**Task:** "Create a new products entity"

1. Read `.claude/skills/README.md`
2. Identify: `entity-system`, `database-migrations`
3. Read both SKILL.md files
4. Check for scripts in `entity-system/scripts/`
5. Execute following documented patterns
6. Validate using checklists

---

## Important

- **ALWAYS** read the skill before implementing
- **NEVER** skip the checklist validation
- Skills contain project-specific conventions that must be followed
