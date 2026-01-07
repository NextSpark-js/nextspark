# Claude Code Skills

This directory contains 31 skills that provide Claude Code with specialized knowledge about this codebase.

## Skills Overview

| # | Skill | Description | Scripts |
|---|-------|-------------|---------|
| 1 | [accessibility](./accessibility/) | Accessibility patterns and WCAG 2.1 AA compliance | - |
| 2 | [better-auth](./better-auth/) | Better Auth integration: session, OAuth, API keys | - |
| 3 | [billing-subscriptions](./billing-subscriptions/) | Stripe billing, subscriptions, usage tracking | - |
| 4 | [create-plugin](./create-plugin/) | Guide for creating new plugins from preset [NEW v4.3] | - |
| 5 | [create-theme](./create-theme/) | Guide for creating new themes from preset [NEW v4.3] | - |
| 6 | [core-theme-responsibilities](./core-theme-responsibilities/) | **CRITICAL:** Core/Theme/Plugin responsibility assignment [NEW v4.3] | - |
| 7 | [cypress-api](./cypress-api/) | Cypress API testing patterns and generators | `generate-api-controller.py`, `generate-api-test.py` |
| 8 | [cypress-e2e](./cypress-e2e/) | Cypress E2E testing patterns | `extract-selectors.py`, `generate-uat-test.py` |
| 9 | [cypress-selectors](./cypress-selectors/) | data-cy selector conventions and validation | `extract-missing.py`, `generate-block-selectors.py`, `validate-selectors.py` |
| 10 | [database-migrations](./database-migrations/) | PostgreSQL migration patterns | `generate-sample-data.py`, `validate-migration.py` |
| 11 | [documentation](./documentation/) | Documentation structure and BDD format | - |
| 12 | [entity-api](./entity-api/) | Entity API endpoints and CRUD patterns | - |
| 13 | [entity-system](./entity-system/) | Entity configuration and registry | `generate-child-migration.py`, `generate-metas-migration.py`, `generate-migration.py`, `generate-sample-data.py`, `scaffold-entity.py` |
| 14 | [i18n-nextintl](./i18n-nextintl/) | next-intl internationalization patterns | `add-translation.py`, `extract-hardcoded.py`, `validate-translations.py` |
| 15 | [jest-unit](./jest-unit/) | Jest unit testing patterns | - |
| 16 | [nextjs-api-development](./nextjs-api-development/) | Next.js API routes and dual auth | `generate-crud-tests.py`, `scaffold-endpoint.py`, `validate-api.py` |
| 17 | [npm-development-workflow](./npm-development-workflow/) | **CRITICAL:** Dual-mode testing workflow (monorepo + npm) [NEW] | - |
| 18 | [page-builder-blocks](./page-builder-blocks/) | Page builder block development | `scaffold-block.py` |
| 19 | [permissions-system](./permissions-system/) | RBAC + Features + Quotas permission model | - |
| 20 | [plugins](./plugins/) | Plugin development and lifecycle hooks | `scaffold-plugin.py` |
| 21 | [pom-patterns](./pom-patterns/) | Page Object Model testing patterns | `generate-pom.py` |
| 22 | [react-patterns](./react-patterns/) | React patterns and TanStack Query | - |
| 23 | [registry-system](./registry-system/) | Auto-generated registries system | - |
| 24 | [scheduled-actions](./scheduled-actions/) | Background task processing, webhooks, cron | - |
| 25 | [scope-enforcement](./scope-enforcement/) | Session scope validation (core/theme/plugins) | `validate-scope.py` |
| 26 | [service-layer](./service-layer/) | Service layer architecture patterns | - |
| 27 | [session-management](./session-management/) | Claude Code session files and workflow | `create-session.py` |
| 28 | [shadcn-components](./shadcn-components/) | shadcn/ui component patterns | - |
| 29 | [tailwind-theming](./tailwind-theming/) | Tailwind CSS v4 theming system | - |
| 30 | [tanstack-query](./tanstack-query/) | TanStack Query data fetching | - |
| 31 | [zod-validation](./zod-validation/) | Zod schema validation patterns | - |

## Statistics

- **Total Skills:** 31
- **Skills with Scripts:** 13
- **Total Scripts:** 25

## Skill Structure

Each skill follows this structure:

```
.claude/skills/{skill-name}/
├── SKILL.md           # Main documentation (required)
└── scripts/           # Automation scripts (optional)
    └── *.py
```

## SKILL.md Format

```yaml
---
name: skill-name
description: |
  Brief description of what this skill covers.
  When to use this skill.
allowed-tools: Read, Glob, Grep, Bash
version: 1.0.0
---

# Skill Name

## Architecture Overview
[Visual diagram of the system]

## When to Use This Skill
[Trigger conditions]

## [Main Sections]
[Detailed patterns and examples]

## Anti-Patterns
[What NOT to do]

## Checklist
[Verification steps]

## Related Skills
[Links to related skills]
```

## Skills by Category

### API & Backend
- `nextjs-api-development` - API routes, dual auth
- `entity-api` - Entity CRUD endpoints
- `service-layer` - Service architecture
- `zod-validation` - Input validation
- `scheduled-actions` - Background tasks, webhooks

### Database
- `database-migrations` - PostgreSQL migrations
- `entity-system` - Entity configuration

### Frontend
- `react-patterns` - React best practices
- `shadcn-components` - UI components
- `tailwind-theming` - CSS theming
- `tanstack-query` - Data fetching
- `page-builder-blocks` - Block development
- `accessibility` - WCAG compliance

### Testing
- `cypress-e2e` - E2E tests
- `cypress-api` - API tests
- `cypress-selectors` - data-cy selectors
- `pom-patterns` - Page Object Model
- `jest-unit` - Unit tests

### Authentication & Authorization
- `better-auth` - Authentication
- `permissions-system` - RBAC permissions
- `billing-subscriptions` - Subscriptions

### Architecture (CRITICAL)
- `core-theme-responsibilities` - **Core/Theme/Plugin responsibilities** [NEW v4.3]
- `npm-development-workflow` - **Dual-mode testing workflow (monorepo + npm)** [NEW]
- `registry-system` - Auto-registries (data-only)
- `scope-enforcement` - Scope validation
- `monorepo-architecture` - Package structure and dependencies

### Infrastructure
- `plugins` - Plugin development
- `create-plugin` - Plugin scaffolding [NEW v4.3]
- `create-theme` - Theme scaffolding [NEW v4.3]
- `i18n-nextintl` - Internationalization
- `documentation` - Docs structure

### Workflow
- `session-management` - Session files

## Using Scripts

All scripts are Python 3 and can be run from the project root:

```bash
# Example: Create a new plugin
python .claude/skills/plugins/scripts/scaffold-plugin.py --name "my-plugin" --type service

# Example: Validate scope
python .claude/skills/scope-enforcement/scripts/validate-scope.py \
  --session ".claude/sessions/2025-12-30-feature-v1" \
  --files "core/lib/x.ts"

# Example: Create a session
python .claude/skills/session-management/scripts/create-session.py \
  --name "feature-name"
```

## Adding New Skills

1. Create directory: `.claude/skills/{skill-name}/`
2. Create `SKILL.md` with proper frontmatter
3. Add scripts in `scripts/` if needed
4. Update this README

## Related

- `.claude/agents/` - Specialized agents (23 in v4.3)
- `.claude/commands/` - Slash commands
- `.claude/config/workflow.md` - Workflow v4.3 (17 phases + 5.5 + 14.5)
- `.rules/` - Development rules
