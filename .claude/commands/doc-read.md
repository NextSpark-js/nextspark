---
description: "Gain context by reading documentation before working on a task"
---

# Documentation Context Reader

You are preparing to work on a task by reading the project documentation systematically.

**Topic/Area to Learn:**
{{{ input }}}

---

## Your Mission

Gain comprehensive context about this project before working on any task. This is a **READ-ONLY** operation - you will read documentation, compare with code, and report your understanding.

---

## Step 1: Understand Project Context

**CRITICAL:** This is a **CORE BOILERPLATE** used to develop multiple projects.

Key concepts:
- The `core/` directory contains shared, reusable code that should NEVER be modified for specific projects
- All project-specific development happens in **THEMES** located at `contents/themes/{theme-name}/`
- Plugins extend functionality and live in `contents/plugins/`

### Determine Active Theme

```bash
# Read from .env file
grep NEXT_PUBLIC_ACTIVE_THEME .env
```

The active theme determines:
- Which configuration files are loaded
- Which entities are available
- Which UI components and styles are used
- Which tests are executed

**IMPORTANT:** Always work within the active theme's scope UNLESS the user explicitly specifies a different theme.

---

## Step 2: Read Fundamentals (MANDATORY)

**ALWAYS read these files first**, in order:

```
core/docs/01-fundamentals/
├── 01-project-overview.md      # Technology stack, core systems
├── 02-core-lib-organization.md # Directory structure, registries
├── 03-directory-structure.md   # Root level organization
├── 04-architecture-patterns.md # Registry pattern, build-time generation
├── 05-typescript-standards.md  # TypeScript conventions
└── 06-development-workflow.md  # Claude workflow, agents, commands
```

Read these files to understand:
- Technology stack (Next.js 15, React 19, TypeScript, PostgreSQL, Better Auth)
- 8 core systems (Entity, API, Auth, Registry, Theme, Plugin, Billing, Page Builder)
- Registry-based loading pattern (zero runtime I/O, 17,255x performance improvement)
- Directory structure (core vs contents separation)
- Development workflow with 24 specialized agents

---

## Step 3: Read Topic-Specific Documentation

Based on the user's request `{{{ input }}}`, identify and read relevant documentation sections:

### Documentation Directory Map

| Keywords in Request | Documentation to Read |
|---------------------|----------------------|
| auth, login, session, password, oauth, permissions, roles | `core/docs/06-authentication/`, `core/docs/14-permissions/` |
| api, endpoint, route, handler, REST | `core/docs/05-api/` |
| entity, entities, crud, model, schema | `core/docs/04-entities/`, `core/docs/03-registry-system/` |
| theme, theming, config, styling | `core/docs/07-theme-system/` |
| plugin, extension, addon | `core/docs/08-plugin-system/` |
| test, testing, cypress, jest, e2e, unit | `core/docs/12-testing/` |
| frontend, ui, component, react, hook | `core/docs/09-frontend/` |
| database, migration, sql, postgres | `core/docs/10-backend/` |
| team, teams, multi-tenant, member | `core/docs/10-teams/` |
| i18n, translation, locale, language | `core/docs/11-internationalization/` |
| performance, optimization, speed | `core/docs/13-performance/` |
| deploy, deployment, production, vercel | `core/docs/14-deployment/` |
| billing, stripe, subscription, payment | `core/docs/19-billing/` |
| block, blocks, page-builder, builder | `core/docs/18-page-builder/` |
| workflow, claude, agent, command | `core/docs/16-claude-workflow/` |
| registry, registries, auto-generated | `core/docs/03-registry-system/` |
| (general or no specific topic) | `core/docs/01-fundamentals/`, `core/docs/02-getting-started/` |

### Reading Protocol

1. **Identify** the relevant documentation directories based on keywords
2. **List** all files in those directories
3. **Read** files in numerical order (01-, 02-, 03-, etc.)
4. **Note** any cross-references to other documentation sections
5. **Follow** cross-references if they're relevant to the task

---

## Step 4: Compare Documentation vs Code

After reading documentation, **verify accuracy** by reading actual code:

### Verification Checklist

For each documented feature/pattern:

1. **Locate the code** mentioned in the documentation
   ```
   Example: If docs mention "PermissionService.canDoAction()"
   → Read: core/lib/services/permission.service.ts
   ```

2. **Compare** documented behavior with actual implementation:
   - Are function signatures accurate?
   - Are configuration options up to date?
   - Are file paths correct?
   - Are examples still valid?

3. **Check** for recent changes:
   - Look at file modification dates
   - Check if documented features still exist
   - Verify imports and exports match documentation

### Key Code Locations to Verify

| Documentation Topic | Code to Verify |
|--------------------|----------------|
| Authentication | `core/lib/auth/`, `app/lib/auth.ts` |
| Permissions | `core/lib/services/permission.service.ts`, `core/lib/registries/permissions-registry.ts` |
| Entities | `core/lib/entities/`, `contents/themes/{theme}/entities/` |
| API Routes | `app/api/`, `core/lib/api/` |
| Configuration | `core/lib/config/`, `contents/themes/{theme}/config/` |
| Services | `core/lib/services/` |
| Registries | `core/lib/registries/` (auto-generated) |
| Components | `core/components/`, `contents/themes/{theme}/components/` |

---

## Step 5: Report Status

After completing the reading and verification, report ONE of these statuses:

### Status A: Coherent (Ready to Work)

If documentation matches code and you understand the topic:

```
## Context Acquired

I have read and understood the documentation for **{topic}**.

**Documentation Read:**
- core/docs/01-fundamentals/ (6 files)
- core/docs/{relevant-section}/ (X files)

**Code Verified:**
- {list of verified code files}

**Active Theme:** {theme-name}

**Summary:**
{2-3 sentence summary of key concepts learned}

I have the context needed to work on this task.
```

---

### Status B: Ambiguities Found

If there are subtle differences or unclear areas:

```
## Context Acquired with Notes

I have read the documentation for **{topic}** but found some ambiguities.

**Documentation Read:**
- {list of files}

**Ambiguities/Questions:**
1. {Description of ambiguity} - Found in {file}, line ~{N}
2. {Another ambiguity}

**Impact:**
{How this might affect the task}

**Recommendation:**
Please clarify these points before I proceed, or I can proceed with {assumption}.
```

---

### Status C: Documentation Errors Found

If documentation is incorrect or significantly outdated:

```
## Documentation Issues Detected

While reading documentation for **{topic}**, I found errors that should be corrected.

**Issues Found:**

### Issue 1: {Title}
- **Location:** `{file-path}`, line ~{N}
- **Documentation says:** {what docs say}
- **Code actually does:** {what code does}
- **Severity:** {High/Medium/Low}

### Issue 2: {Title}
...

**Recommendation:**
Consider running `/doc-feature` to update the documentation for this area before proceeding.

**Can I still work?**
{Yes/No} - {explanation of whether the task can proceed despite issues}
```

---

## Additional Guidelines

### If No Input Provided

If `{{{ input }}}` is empty or unclear:
1. Read only `core/docs/01-fundamentals/` (general overview)
2. Ask the user what specific area they want to work on
3. Provide a list of available documentation topics

### Theme-Specific Reading

When working on theme-specific features, also read:
- `contents/themes/{active-theme}/config/` - Theme configuration files
- `contents/themes/{active-theme}/README.md` - Theme-specific docs (if exists)
- `contents/themes/{active-theme}/docs/` - Theme documentation (if exists)

### Rules Files

For implementation tasks, also reference relevant rules:
- `.rules/core.md` - Core development rules
- `.rules/testing.md` - Testing requirements
- `.rules/components.md` - UI component standards
- `.rules/api.md` - API development patterns
- `.rules/auth.md` - Authentication patterns

---

## Output Format

```markdown
## Documentation Context Report

**Topic:** {topic from input}
**Active Theme:** {from NEXT_PUBLIC_ACTIVE_THEME}
**Status:** {Coherent / Ambiguities / Errors}

### Documentation Read
- {list of documentation files read}

### Code Verified
- {list of code files checked}

### Key Learnings
{Bullet points of important concepts}

### {Status-specific section from Step 5}

### Ready to Proceed
{Yes/No with explanation}
```
