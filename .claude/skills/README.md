# Claude Code Skills

This directory contains **44 skills** that provide Claude Code with specialized knowledge about this codebase.

---

## Skills Overview

| # | Skill | Description | Category |
|---|-------|-------------|----------|
| 1 | [accessibility](./accessibility/) | Accessibility patterns and WCAG 2.1 AA compliance | Frontend |
| 2 | [api-bypass-layers](./api-bypass-layers/) | Multi-layer security architecture for admin bypass | Auth |
| 3 | [asana-integration](./asana-integration/) | Asana task management integration **[NEW v1.0]** | Integration |
| 4 | [better-auth](./better-auth/) | Better Auth: session, OAuth, API keys | Auth |
| 5 | [billing-subscriptions](./billing-subscriptions/) | Stripe billing, subscriptions, usage tracking | Auth |
| 6 | [block-decision-matrix](./block-decision-matrix/) | Decision framework for blocks (new/variant/existing) | Blocks |
| 7 | [clickup-integration](./clickup-integration/) | ClickUp task management integration **[NEW v1.0]** | Integration |
| 8 | [core-theme-responsibilities](./core-theme-responsibilities/) | **CRITICAL:** Core/Theme/Plugin responsibility assignment | Architecture |
| 9 | [create-plugin](./create-plugin/) | Guide for creating new plugins from preset | Infrastructure |
| 10 | [create-theme](./create-theme/) | Guide for creating new themes from preset | Infrastructure |
| 11 | [cypress-api](./cypress-api/) | Cypress API testing patterns and generators | Testing |
| 12 | [cypress-e2e](./cypress-e2e/) | Cypress E2E/UAT testing patterns | Testing |
| 13 | [cypress-selectors](./cypress-selectors/) | data-cy selector conventions and validation | Testing |
| 14 | [database-migrations](./database-migrations/) | PostgreSQL migration patterns with RLS | Database |
| 15 | [design-system](./design-system/) | Theme-aware design system analysis and token mapping | Frontend |
| 16 | [documentation](./documentation/) | Documentation structure and BDD format | Workflow |
| 17 | [entity-api](./entity-api/) | Entity API endpoints and CRUD patterns | Backend |
| 18 | [entity-system](./entity-system/) | Entity configuration and registry | Backend |
| 19 | [i18n-nextintl](./i18n-nextintl/) | next-intl internationalization patterns | Frontend |
| 20 | [impact-analysis](./impact-analysis/) | Impact analysis for code changes | Workflow |
| 21 | [jest-unit](./jest-unit/) | Jest unit testing patterns | Testing |
| 22 | [jira-integration](./jira-integration/) | Jira project management integration **[NEW v1.0]** | Integration |
| 23 | [mock-analysis](./mock-analysis/) | Patterns for analyzing HTML/CSS mocks | Blocks |
| 24 | [monorepo-architecture](./monorepo-architecture/) | Package structure and dependencies | Architecture |
| 25 | [nextjs-api-development](./nextjs-api-development/) | Next.js API routes and dual auth | Backend |
| 26 | [notion-integration](./notion-integration/) | Notion knowledge management integration **[NEW v1.0]** | Integration |
| 27 | [npm-development-workflow](./npm-development-workflow/) | **CRITICAL:** Dual-mode testing workflow (monorepo + npm) | Architecture |
| 28 | [page-builder-blocks](./page-builder-blocks/) | Page builder block development | Blocks |
| 29 | [permissions-system](./permissions-system/) | RBAC + Features + Quotas permission model | Auth |
| 30 | [plugins](./plugins/) | Plugin development and lifecycle hooks | Infrastructure |
| 31 | [pom-patterns](./pom-patterns/) | Page Object Model testing patterns | Testing |
| 32 | [react-patterns](./react-patterns/) | React patterns and TanStack Query | Frontend |
| 33 | [registry-system](./registry-system/) | Auto-generated registries system | Architecture |
| 34 | [scheduled-actions](./scheduled-actions/) | Background task processing, webhooks, cron | Backend |
| 35 | [scope-enforcement](./scope-enforcement/) | Session scope validation (core/theme/plugins) | Workflow |
| 36 | [service-layer](./service-layer/) | Service layer architecture patterns | Backend |
| 37 | [session-management](./session-management/) | Claude Code session files and workflow | Workflow |
| 38 | [shadcn-components](./shadcn-components/) | shadcn/ui component patterns | Frontend |
| 39 | [shadcn-theming](./shadcn-theming/) | shadcn/ui theme customization | Frontend |
| 40 | [tailwind-theming](./tailwind-theming/) | Tailwind CSS v4 theming system | Frontend |
| 41 | [tanstack-query](./tanstack-query/) | TanStack Query data fetching | Frontend |
| 42 | [test-coverage](./test-coverage/) | Test coverage metrics and registry system | Testing |
| 43 | [zod-validation](./zod-validation/) | Zod schema validation patterns | Backend |

---

## Statistics

- **Total Skills:** 44
- **Categories:** 9

---

## Skills by Category

### Architecture (CRITICAL - Read First)
| Skill | Purpose | When to Use |
|-------|---------|-------------|
| `core-theme-responsibilities` | Core/Theme/Plugin responsibilities | Before ANY technical planning |
| `npm-development-workflow` | Dual-mode testing (monorepo + npm) | Before publishing packages |
| `monorepo-architecture` | Package structure and dependencies | Understanding project structure |
| `registry-system` | Auto-registries (data-only pattern) | Working with registries |

### Backend & API
| Skill | Purpose | When to Use |
|-------|---------|-------------|
| `nextjs-api-development` | API routes, dual auth | Creating API endpoints |
| `entity-api` | Entity CRUD endpoints | Working with entity APIs |
| `entity-system` | Entity configuration | Creating/modifying entities |
| `service-layer` | Service architecture | Implementing business logic |
| `zod-validation` | Input validation | API/form validation |
| `scheduled-actions` | Background tasks, webhooks | Async processing |

### Database
| Skill | Purpose | When to Use |
|-------|---------|-------------|
| `database-migrations` | PostgreSQL migrations with RLS | Creating migrations |

### Frontend
| Skill | Purpose | When to Use |
|-------|---------|-------------|
| `react-patterns` | React best practices | Building components |
| `shadcn-components` | UI components | Using shadcn/ui |
| `shadcn-theming` | Theme customization | Customizing design system |
| `tailwind-theming` | CSS theming | Working with Tailwind |
| `tanstack-query` | Data fetching | API state management |
| `i18n-nextintl` | Internationalization | Adding translations |
| `accessibility` | WCAG compliance | Ensuring a11y |
| `design-system` | Token mapping | Analyzing mocks |

### Testing
| Skill | Purpose | When to Use |
|-------|---------|-------------|
| `cypress-e2e` | E2E/UAT tests | Writing UAT tests |
| `cypress-api` | API tests | Writing API tests |
| `cypress-selectors` | data-cy selectors | Managing selectors |
| `pom-patterns` | Page Object Model | Creating POMs |
| `jest-unit` | Unit tests | Writing unit tests |
| `test-coverage` | Coverage metrics | Analyzing coverage |

### Authentication & Authorization
| Skill | Purpose | When to Use |
|-------|---------|-------------|
| `api-bypass-layers` | Multi-layer security bypass | Admin/dev features |
| `better-auth` | Authentication | Auth implementation |
| `permissions-system` | RBAC permissions | Access control |
| `billing-subscriptions` | Subscriptions | Billing features |

### Blocks & Mocks
| Skill | Purpose | When to Use |
|-------|---------|-------------|
| `page-builder-blocks` | Block development | Creating blocks |
| `block-decision-matrix` | New vs variant decision | Planning blocks |
| `mock-analysis` | Mock parsing | Converting mocks |

### Task Manager Integrations
| Skill | Purpose | When to Use |
|-------|---------|-------------|
| `clickup-integration` | ClickUp API & MCP | ClickUp integration |
| `jira-integration` | Jira REST API & JQL | Jira integration |
| `asana-integration` | Asana API & webhooks | Asana integration |
| `notion-integration` | Notion API & databases | Notion integration |

### Infrastructure
| Skill | Purpose | When to Use |
|-------|---------|-------------|
| `plugins` | Plugin development | Creating plugins |
| `create-plugin` | Plugin scaffolding | New plugin from preset |
| `create-theme` | Theme scaffolding | New theme from preset |

### Workflow & Session
| Skill | Purpose | When to Use |
|-------|---------|-------------|
| `session-management` | Session files | Managing sessions |
| `scope-enforcement` | Scope validation | Validating file access |
| `impact-analysis` | Change analysis | Planning changes |
| `documentation` | Docs structure | Writing documentation |

---

## Command → Skill Mapping

Commands should load relevant skills for context:

| Command | Required Skills |
|---------|----------------|
| `/session:db:entity` | `database-migrations`, `entity-system` |
| `/session:db:sample` | `database-migrations` |
| `/session:block:create` | `page-builder-blocks`, `block-decision-matrix` |
| `/session:block:update` | `page-builder-blocks` |
| `/session:test:write` | `cypress-api`, `cypress-e2e`, `cypress-selectors`, `pom-patterns` |
| `/session:test:run` | `cypress-api`, `cypress-e2e` |
| `/session:execute` | Based on current phase |
| `/session:review` | `service-layer`, `react-patterns`, `zod-validation` |

---

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

---

## Adding New Skills

1. Create directory: `.claude/skills/{skill-name}/`
2. Create `SKILL.md` with proper frontmatter
3. Add scripts in `scripts/` if needed
4. Update this README

---

## Related

- `.claude/commands/` - Session commands (30 commands)
- `.claude/config/workspace.json` - Workspace configuration
- `workflows/` - QUICK, STANDARD, COMPLETE workflows
- `templates/` - Session file templates
