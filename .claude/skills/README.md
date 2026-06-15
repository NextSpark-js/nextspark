# Claude Code Skills

This directory contains **53 skills** that provide Claude Code with specialized knowledge about this codebase.

---

## Skills Overview

| # | Skill | Description | Category |
|---|-------|-------------|----------|
| 1 | [accessibility](./accessibility/) | Accessibility patterns and WCAG 2.1 AA compliance | Frontend |
| 2 | [anthropics-mcp-builder](./anthropics-mcp-builder/) | Building MCP servers (FastMCP / MCP SDK) | Tooling |
| 3 | [anthropics-skill-creator](./anthropics-skill-creator/) | Create, improve and measure Claude skills | Tooling |
| 4 | [api-bypass-layers](./api-bypass-layers/) | Multi-layer security architecture for admin bypass | Auth |
| 5 | [asana-integration](./asana-integration/) | Asana task management integration | Integration |
| 6 | [better-auth](./better-auth/) | Better Auth: session, OAuth, API keys | Auth |
| 7 | [billing-subscriptions](./billing-subscriptions/) | Stripe billing, subscriptions, usage tracking | Auth |
| 8 | [block-decision-matrix](./block-decision-matrix/) | Decision framework for blocks (new/variant/existing) | Blocks |
| 9 | [clickup-integration](./clickup-integration/) | ClickUp task management integration | Integration |
| 10 | [core-theme-responsibilities](./core-theme-responsibilities/) | **CRITICAL:** Core/Theme/Plugin responsibility assignment | Architecture |
| 11 | [create-plugin](./create-plugin/) | Guide for creating new plugins from preset | Infrastructure |
| 12 | [create-theme](./create-theme/) | Guide for creating new themes from preset | Infrastructure |
| 13 | [cypress-api](./cypress-api/) | Cypress API testing patterns and generators | Testing |
| 14 | [cypress-e2e](./cypress-e2e/) | Cypress E2E/UAT testing patterns | Testing |
| 15 | [cypress-selectors](./cypress-selectors/) | data-cy selector conventions and validation | Testing |
| 16 | [database-migrations](./database-migrations/) | PostgreSQL migration patterns (RLS policy SQL) | Database |
| 17 | [design-system](./design-system/) | Theme-aware design system analysis and token mapping | Frontend |
| 18 | [documentation](./documentation/) | Documentation structure and BDD format | Workflow |
| 19 | [entity-api](./entity-api/) | Entity API endpoints and CRUD patterns | Backend |
| 20 | [entity-system](./entity-system/) | Entity configuration and registry | Backend |
| 21 | [github](./github/) | Git/GitHub branch, commit and PR conventions | Workflow |
| 22 | [i18n-nextintl](./i18n-nextintl/) | next-intl internationalization patterns | Frontend |
| 23 | [impact-analysis](./impact-analysis/) | Impact analysis for code changes | Workflow |
| 24 | [jest-unit](./jest-unit/) | Jest unit testing patterns | Testing |
| 25 | [jira-integration](./jira-integration/) | Jira project management integration | Integration |
| 26 | [media-library](./media-library/) | WordPress-style media management system | Backend |
| 27 | [mock-analysis](./mock-analysis/) | Patterns for analyzing HTML/CSS mocks | Blocks |
| 28 | [monorepo-architecture](./monorepo-architecture/) | Package structure and dependencies | Architecture |
| 29 | [nextjs-api-development](./nextjs-api-development/) | Next.js API routes and dual auth | Backend |
| 30 | [notion-integration](./notion-integration/) | Notion knowledge management integration | Integration |
| 31 | [npm-development-workflow](./npm-development-workflow/) | **CRITICAL:** Dual-mode testing workflow (monorepo + npm) | Architecture |
| 32 | [page-builder-blocks](./page-builder-blocks/) | Page builder block development | Blocks |
| 33 | [permissions-system](./permissions-system/) | RBAC + Features + Quotas permission model | Auth |
| 34 | [plugins](./plugins/) | Plugin development and lifecycle hooks | Infrastructure |
| 35 | [pom-patterns](./pom-patterns/) | Page Object Model testing patterns | Testing |
| 36 | [rate-limiting](./rate-limiting/) | Distributed rate limiting (Redis) for endpoints | Backend |
| 37 | [react-best-practices](./react-best-practices/) | React/Next.js performance optimization | Frontend |
| 38 | [react-patterns](./react-patterns/) | React patterns and TanStack Query | Frontend |
| 39 | [registry-system](./registry-system/) | Auto-generated registries system | Architecture |
| 40 | [rls-enforcement](./rls-enforcement/) | Runtime RLS: service pool, nextspark_app cutover, fail-closed | Database |
| 41 | [scheduled-actions](./scheduled-actions/) | Background task processing, webhooks, cron | Backend |
| 42 | [scope-enforcement](./scope-enforcement/) | Session scope validation (core/theme/plugins) | Workflow |
| 43 | [server-actions](./server-actions/) | Next.js Server Actions for mutations | Backend |
| 44 | [service-layer](./service-layer/) | Service layer architecture patterns | Backend |
| 45 | [session-management](./session-management/) | Claude Code session files and workflow | Workflow |
| 46 | [shadcn-components](./shadcn-components/) | shadcn/ui component patterns | Frontend |
| 47 | [shadcn-theming](./shadcn-theming/) | shadcn/ui theme customization | Frontend |
| 48 | [suspense-loading](./suspense-loading/) | Suspense and loading.tsx patterns | Frontend |
| 49 | [tailwind-theming](./tailwind-theming/) | Tailwind CSS v4 theming system | Frontend |
| 50 | [tanstack-query](./tanstack-query/) | TanStack Query data fetching | Frontend |
| 51 | [test-coverage](./test-coverage/) | Test coverage metrics and registry system | Testing |
| 52 | [web-design-guidelines](./web-design-guidelines/) | Web Interface Guidelines review | Frontend |
| 53 | [zod-validation](./zod-validation/) | Zod schema validation patterns | Backend |

---

## Statistics

- **Total Skills:** 53
- **Categories:** 10

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
| `server-actions` | Next.js Server Actions | Mutations from client components |
| `zod-validation` | Input validation | API/form validation |
| `scheduled-actions` | Background tasks, webhooks | Async processing |
| `rate-limiting` | Distributed rate limiting (Redis) | New/secured endpoints |
| `media-library` | Media management system | File upload/browse/select |

### Database
| Skill | Purpose | When to Use |
|-------|---------|-------------|
| `database-migrations` | PostgreSQL migrations + RLS policy SQL | Creating migrations |
| `rls-enforcement` | Runtime RLS: service pool, nextspark_app cutover, fail-closed | Wiring DB connections / RLS cutover |

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
| `react-best-practices` | React/Next.js performance | Optimizing components |
| `suspense-loading` | Suspense + loading.tsx | Loading states / INP |
| `web-design-guidelines` | Web Interface Guidelines | Reviewing UI/UX |

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
| `github` | Git/GitHub conventions | Branches, commits, PRs |

### Tooling / Meta
| Skill | Purpose | When to Use |
|-------|---------|-------------|
| `anthropics-skill-creator` | Create/improve/measure skills | Authoring or optimizing a skill |
| `anthropics-mcp-builder` | Build MCP servers | Creating an MCP server |

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
4. Update this README (overview table + count + by-category section)
5. Sync to the publishable package: `node packages/ai-workflow/scripts/sync.mjs`

---

## Related

- `.claude/commands/` - Session commands (30 commands)
- `.claude/config/workspace.json` - Workspace configuration
- `workflows/` - QUICK, STANDARD, COMPLETE workflows
- `templates/` - Session file templates
