# Sessions (v4.0)

> **Version 4.0** - 8 session files with versioning system.

## Introduction

Sessions are **organized folders** that contain all artifacts for a feature's development lifecycle. Each session provides complete history, progress tracking, and agent coordination in one location.

> **Note:** The 8-file structure is the default. You can use as few as 3 files for simple projects or extend to 10+ for complex needs. See [Customization](./10-customization.md) for adapting sessions to your workflow.

**Key Changes in v4.0:**
- **8 Files** (up from 4) - More specialized files for different concerns
- **Versioning System** - `v1`, `v2`, etc. for iterations
- **AC Classification** - Requirements tagged with [AUTO]/[MANUAL]/[REVIEW]
- **scope.json** - Explicit permissions for what agents can modify
- **tests.md** - Centralized test documentation and AC coverage

---

## Session Structure

```text
.claude/sessions/2025-12-15-products-crud-v1/
├── requirements.md    # PM: Requirements with AC classification
├── clickup_task.md    # PM: ClickUp task context (optional)
├── scope.json         # PM: Modification permissions
├── plan.md            # Architect: Technical implementation plan
├── progress.md        # All: Phase completion tracking
├── context.md         # All: Agent coordination log
├── tests.md           # Validators+QA: Test docs and coverage
└── pendings.md        # Any: Future iteration items
```

---

## Naming Convention

**Format:** `YYYY-MM-DD-feature-name-v[N]`

| Component | Description | Example |
|-----------|-------------|---------|
| `YYYY-MM-DD` | Session creation date | `2025-12-15` |
| `feature-name` | Kebab-case description | `products-crud` |
| `v[N]` | Version number | `v1`, `v2` |

### Examples

```text
2025-12-15-products-crud-v1
2025-12-16-user-authentication-v1
2025-12-17-products-crud-v2        # Second iteration
2025-12-18-analytics-plugin-v1
```

### Versioning Rules

- **v1** - First implementation attempt
- **v2+** - Subsequent iterations (improvements, bug fixes)
- Reference previous version's `pendings.md` when starting new version
- Each version is a separate folder

---

## The 8 Session Files

### 1. requirements.md

**Created by:** Product Manager (Phase 1)
**Purpose:** Detailed requirements with classified acceptance criteria

**Key Sections:**
- Business Context (problem, users, value)
- User Stories (primary + additional)
- Acceptance Criteria with [AUTO]/[MANUAL]/[REVIEW] tags
- UI/UX Requirements
- Technical Constraints
- Data Requirements
- Out of Scope
- Open Questions

**Example:**

```markdown
# Feature Requirements: Products CRUD

**Session:** `.claude/sessions/2025-12-15-products-crud-v1/`
**Created:** 2025-12-15
**Version:** v1

---

## Business Context

### Problem Statement
Users cannot manage their product catalog through the dashboard.

### Target Users
- Store administrators
- Product managers

### Business Value
Core functionality for e-commerce management.

---

## Acceptance Criteria (CLASSIFIED)

### Functional Criteria
- [AUTO] User can create a product with valid data
- [AUTO] System returns 400 for invalid input
- [AUTO] User can edit existing product
- [AUTO] User can delete product with confirmation
- [AUTO] Products list supports pagination

### Manual Verification
- [MANUAL] Form layout matches design mockup
- [MANUAL] Loading states display correctly
- [MANUAL] Delete confirmation is user-friendly

### Review Items
- [REVIEW] Code follows project conventions
- [REVIEW] API documentation is complete

---

## Out of Scope

- Product variants (v2)
- Bulk import/export (future)
- Image gallery (future)
```

**Template:** `.claude/tools/sessions/templates/requirements.md`

---

### 2. clickup_task.md

**Created by:** Product Manager (Phase 1)
**Purpose:** ClickUp task context and business metadata
**Note:** Optional - only if using ClickUp integration

**Key Sections:**
- Task ID and URL
- Business context
- Priority and timeline
- Related tasks
- Stakeholders

**Example:**

```markdown
# ClickUp Task: Products CRUD

**Task ID:** 86abc123
**URL:** https://app.clickup.com/t/86abc123
**Status:** In Progress
**Priority:** High

---

## Business Context

### Why This Task
Core functionality needed for MVP launch.

### Success Metrics
- 100% AC coverage
- < 2s form submission
- Zero security vulnerabilities

### Stakeholders
- Product: @john
- Engineering: @jane
- QA: @bob
```

**Template:** `.claude/tools/sessions/templates/clickup_task.md`

---

### 3. scope.json

**Created by:** Product Manager (Phase 1)
**Purpose:** Define what areas agents can modify

**Structure:**

```json
{
  "definedBy": "product-manager",
  "date": "2025-12-15",
  "scope": {
    "core": false,
    "theme": "default",
    "plugins": false
  },
  "exceptions": []
}
```

**Scope Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `core` | boolean | Allow modifications to `core/`, `app/`, `scripts/` |
| `theme` | string/false | Theme name agents can modify, or `false` |
| `plugins` | array/false | Plugin names agents can modify, or `false` |
| `exceptions` | array | Specific paths allowed/disallowed |

**Common Configurations:**

```json
// Feature in existing theme (default)
{
  "scope": {
    "core": false,
    "theme": "default",
    "plugins": false
  }
}

// New plugin development
{
  "scope": {
    "core": false,
    "theme": "plugin-sandbox",
    "plugins": ["my-new-plugin"]
  }
}

// Core framework change
{
  "scope": {
    "core": true,
    "theme": false,
    "plugins": false
  }
}

// Full access (rare)
{
  "scope": {
    "core": true,
    "theme": "default",
    "plugins": ["analytics", "payment"]
  }
}
```

**Template:** `.claude/tools/sessions/templates/scope.json`

---

### 4. plan.md

**Created by:** Architecture Supervisor (Phase 2)
**Purpose:** Complete technical implementation plan

**Key Sections:**
- Technical Summary
- 19 Phases breakdown (which ones apply)
- Database schema (if applicable)
- API endpoints
- Component structure
- Testing strategy
- Technical notes

**Example:**

```markdown
# Technical Plan: Products CRUD

**Session:** `.claude/sessions/2025-12-15-products-crud-v1/`
**Version:** v1

---

## Technical Summary

**Approach:** RESTful API with React dashboard components
**Database:** New `products` table with metadata
**Frontend:** shadcn/ui data table with forms
**Testing:** API + UAT Cypress tests

---

## Phase Execution

### Active Phases
- Phase 1: PM ✅
- Phase 2: Architecture ✅
- Phase 5: DB Developer
- Phase 6: DB Validator [GATE]
- Phase 7: Backend Developer
- Phase 8: Backend Validator [GATE]
- Phase 9: API Tester [GATE]
- Phase 11: Frontend Developer
- Phase 12: Frontend Validator [GATE]
- Phase 13: Functional Validator [GATE]
- Phase 14: QA Manual [GATE]
- Phase 15: QA Automation [GATE]
- Phase 16: Code Reviewer
- Phase 17: Unit Test Writer

### Skipped Phases
- Phase 3, 4: No plugin (Dev Type = Feature)
- Phase 3b, 4b: No new theme
- Phase 10: No blocks needed
- Phase 18, 19: Optional (not requested)

---

## Database Schema

### products table
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, default uuid_generate_v4() |
| name | varchar(255) | NOT NULL |
| description | text | |
| price | decimal(10,2) | NOT NULL |
| team_id | uuid | FK → teams(id) |
| created_by | uuid | FK → users(id) |
| created_at | timestamp | DEFAULT now() |
| updated_at | timestamp | DEFAULT now() |

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/products | List products (paginated) |
| GET | /api/v1/products/:id | Get single product |
| POST | /api/v1/products | Create product |
| PUT | /api/v1/products/:id | Update product |
| DELETE | /api/v1/products/:id | Delete product |
```

**Template:** `.claude/tools/sessions/templates/plan.md`

---

### 5. progress.md

**Created by:** Architecture Supervisor (Phase 2)
**Updated by:** All agents
**Purpose:** Track completion of all 19 phases

**Key Sections:**
- Session metadata
- Phase status (19 phases)
- Timeline
- Blockers

**Example:**

```markdown
# Progress: Products CRUD

**Session:** `2025-12-15-products-crud-v1`
**Started:** 2025-12-15 09:00
**Status:** In Progress

---

## Phase Status

### BLOCK 1: Planning
- [x] Phase 1: PM Requirements ✅ (2025-12-15 09:30)
- [x] Phase 2: Architecture Plan ✅ (2025-12-15 10:00)

### BLOCK 2: Foundation
- [ ] Phase 3: Plugin Creator (SKIP - Feature)
- [ ] Phase 4: Plugin Validator (SKIP - Feature)
- [ ] Phase 3b: Theme Creator (SKIP - Feature)
- [ ] Phase 4b: Theme Validator (SKIP - Feature)
- [x] Phase 5: DB Developer ✅ (2025-12-15 11:00)
- [x] Phase 6: DB Validator [GATE] ✅ (2025-12-15 11:15)

### BLOCK 3: Backend
- [x] Phase 7: Backend Developer ✅ (2025-12-15 13:00)
- [x] Phase 8: Backend Validator [GATE] ✅ (2025-12-15 13:15)
- [ ] Phase 9: API Tester [GATE] 🔄 IN PROGRESS

### BLOCK 4: Blocks
- [ ] Phase 10: Block Developer (SKIP - No blocks)

### BLOCK 5: Frontend
- [ ] Phase 11: Frontend Developer
- [ ] Phase 12: Frontend Validator [GATE]
- [ ] Phase 13: Functional Validator [GATE]

### BLOCK 6: QA
- [ ] Phase 14: QA Manual [GATE]
- [ ] Phase 15: QA Automation [GATE]

### BLOCK 7: Finalization
- [ ] Phase 16: Code Reviewer
- [ ] Phase 17: Unit Test Writer
- [ ] Phase 18: Documentation (OPTIONAL)
- [ ] Phase 19: Demo Video (OPTIONAL)

---

## Timeline

| Time | Phase | Agent | Duration |
|------|-------|-------|----------|
| 09:00 | 1 | product-manager | 30m |
| 09:30 | 2 | architecture-supervisor | 30m |
| 10:00 | 5 | db-developer | 1h |
| 11:00 | 6 | db-validator | 15m |
| 11:15 | 7 | backend-developer | 1h45m |
| 13:00 | 8 | backend-validator | 15m |
| 13:15 | 9 | api-tester | ... |

---

## Blockers

None currently.
```

**Template:** `.claude/tools/sessions/templates/progress.md`

---

### 6. context.md

**Created by:** Product Manager (Phase 1)
**Updated by:** ALL agents
**Purpose:** Agent-to-agent coordination and decision log

**Key Sections:**
- Timestamped entries from each agent
- Work summaries
- Decisions made
- Challenges encountered
- Next step guidance

**Example:**

```markdown
# Context Log: Products CRUD

---

## [2025-12-15 09:00] Product Manager

**Status:** ✅ Completed

**Work Summary:**
- Created requirements.md with 10 ACs
- Classified ACs: 6 [AUTO], 3 [MANUAL], 1 [REVIEW]
- Defined scope: Feature in default theme
- Created scope.json

**Decisions:**
- Team Mode: Enabled (products scoped to teams)
- DB Policy: Reset Allowed (dev environment)
- Requires Blocks: No

**Next Step:** Architecture supervisor creates technical plan

---

## [2025-12-15 10:00] Architecture Supervisor

**Status:** ✅ Completed

**Work Summary:**
- Created comprehensive plan.md
- Identified 14 active phases (5 skipped)
- Designed database schema
- Defined API endpoints

**Technical Decisions:**
- Using Zod for validation (client + server)
- Soft delete for products (is_deleted flag)
- Pagination: 20 items per page

**Next Step:** DB Developer creates migrations

---

## [2025-12-15 14:00] QA Manual

**Status:** ✅ Completed

**Work Summary:**
- Navigated all dashboard screens
- Verified [MANUAL] ACs
- No console errors found
- No server errors found

**Issues Found:**
None

**[MANUAL] AC Verification:**
- [x] Form layout matches mockup
- [x] Loading states display correctly
- [x] Delete confirmation is user-friendly

**Next Step:** QA Automation can begin UAT tests
```

**Template:** `.claude/tools/sessions/templates/context.md`

---

### 7. tests.md

**Created by:** Validators and QA agents
**Purpose:** Test documentation, selectors, and AC coverage

**Key Sections:**
- Test Results (qa-automation)
- data-cy Selectors (frontend-validator)
- Translation Keys (frontend-validator)
- AC Coverage Report (qa-automation)

**Example:**

```markdown
# Tests: Products CRUD

**Session:** `2025-12-15-products-crud-v1`
**Last Updated:** 2025-12-15 16:00

---

## Test Results

### Latest Test Run
**Date:** 2025-12-15 16:00
**Status:** Passed
**Total Tests:** 24
**Passed:** 24
**Failed:** 0

### API Tests
| Test | Description | Status |
|------|-------------|--------|
| products-api-001 | GET /products returns list | ✅ |
| products-api-002 | POST /products creates | ✅ |
| products-api-003 | PUT /products/:id updates | ✅ |
| products-api-004 | DELETE /products/:id deletes | ✅ |
| products-api-005 | 400 on invalid data | ✅ |
| products-api-006 | 401 without auth | ✅ |

### UAT Tests
| Test | Description | Status |
|------|-------------|--------|
| products-uat-001 | Create product flow | ✅ |
| products-uat-002 | Edit product flow | ✅ |
| products-uat-003 | Delete with confirmation | ✅ |
| products-uat-004 | Pagination works | ✅ |

---

## data-cy Selectors

### Products List
| Element | Selector | Usage |
|---------|----------|-------|
| List container | `products-list` | Main wrapper |
| Create button | `products-list-create-btn` | Opens form |
| Table row | `products-list-row-{id}` | Row by ID |
| Edit button | `products-row-{id}-edit-btn` | Edit action |
| Delete button | `products-row-{id}-delete-btn` | Delete action |

### Products Form
| Element | Selector | Usage |
|---------|----------|-------|
| Form | `products-form` | Form wrapper |
| Name field | `products-form-name` | Input |
| Price field | `products-form-price` | Input |
| Submit | `products-form-submit-btn` | Submit |
| Cancel | `products-form-cancel-btn` | Cancel |

---

## AC Coverage Report

| AC ID | Type | Description | Test | Status |
|-------|------|-------------|------|--------|
| AC-001 | [AUTO] | Create product | products-uat-001 | ✅ |
| AC-002 | [AUTO] | 400 on invalid | products-api-005 | ✅ |
| AC-003 | [AUTO] | Edit product | products-uat-002 | ✅ |
| AC-004 | [AUTO] | Delete product | products-uat-003 | ✅ |
| AC-005 | [AUTO] | Pagination | products-uat-004 | ✅ |
| AC-006 | [MANUAL] | Form layout | - | qa-manual ✅ |
| AC-007 | [MANUAL] | Loading states | - | qa-manual ✅ |
| AC-008 | [MANUAL] | Delete UX | - | qa-manual ✅ |
| AC-009 | [REVIEW] | Code quality | - | code-reviewer |

**Coverage:** 5/5 [AUTO] ACs covered (100%)
```

**Template:** `.claude/tools/sessions/templates/tests.md`

---

### 8. pendings.md

**Created by:** Any agent that identifies future work
**Purpose:** Document items for future iterations

**Key Sections:**
- Summary counts
- Pending items with priority and category
- Recommendations for next version
- Session history

**Example:**

```markdown
# Pendientes: Products CRUD

**Session:** `2025-12-15-products-crud-v1`
**Version:** v1
**Status:** 2 pendientes

---

## Resumen

**Total Pendientes:** 2
**Prioridad Alta:** 0
**Prioridad Media:** 1
**Prioridad Baja:** 1

---

## Pendientes para Futuras Iteraciones

### P1: Implementar bulk import

**Detectado por:** product-manager
**Fecha:** 2025-12-15
**Prioridad:** Media
**Categoría:** Feature

**Descripción:**
Users requested ability to import products from CSV.

**Razón para Postergar:**
- [x] Fuera del alcance actual

**Recomendación para v2:**
1. Design CSV format specification
2. Create import API endpoint
3. Add progress tracking for large imports
4. Implement validation with error report

**Archivos Relacionados:**
- `app/api/v1/products/import/route.ts` - New endpoint
- `app/dashboard/products/ImportModal.tsx` - UI component

---

### P2: Add product images

**Detectado por:** frontend-developer
**Fecha:** 2025-12-15
**Prioridad:** Baja
**Categoría:** Feature

**Descripción:**
Product cards would benefit from image thumbnails.

**Razón para Postergar:**
- [x] Tiempo insuficiente
- [x] Requiere diseño de storage strategy

**Recomendación para v2:**
1. Choose storage (S3, Cloudinary, etc.)
2. Add image field to products table
3. Create upload component
4. Add image optimization

---

## Historial de Sesiones

| Versión | Fecha | Pendientes Resueltos | Nuevos Pendientes |
|---------|-------|---------------------|-------------------|
| v1 | 2025-12-15 | N/A (primera versión) | 2 |
```

**Template:** `.claude/tools/sessions/templates/pendings.md`

---

## Agent Responsibilities by File

| File | Created By | Updated By |
|------|------------|------------|
| requirements.md | product-manager | product-manager (scope changes) |
| clickup_task.md | product-manager | product-manager |
| scope.json | product-manager | - |
| plan.md | architecture-supervisor | architecture-supervisor |
| progress.md | architecture-supervisor | All agents |
| context.md | product-manager | All agents |
| tests.md | frontend-validator | qa-automation, validators |
| pendings.md | Any agent | Any agent |

---

## Session Lifecycle

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                        SESSION LIFECYCLE                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. CREATION (Phase 1: PM)                                              │
│     ├─ Create folder: 2025-12-15-feature-v1/                            │
│     ├─ Create requirements.md (with AC classification)                  │
│     ├─ Create clickup_task.md (optional)                                │
│     ├─ Create scope.json (permissions)                                  │
│     └─ Initialize context.md                                            │
│                                                                          │
│  2. PLANNING (Phase 2: Architect)                                       │
│     ├─ Create plan.md (19-phase plan)                                   │
│     ├─ Create progress.md (tracking template)                           │
│     ├─ Initialize tests.md                                              │
│     ├─ Initialize pendings.md                                           │
│     └─ Update context.md                                                │
│                                                                          │
│  3. DEVELOPMENT (Phases 3-13)                                           │
│     ├─ Update progress.md (mark phases complete)                        │
│     ├─ Update context.md (decisions, challenges)                        │
│     ├─ Update tests.md (selectors, translations)                        │
│     └─ Add to pendings.md (if items deferred)                           │
│                                                                          │
│  4. QA (Phases 14-15)                                                   │
│     ├─ Update progress.md                                               │
│     ├─ Update context.md (test results)                                 │
│     ├─ Update tests.md (AC coverage report)                             │
│     └─ Update pendings.md (failed tests deferred)                       │
│                                                                          │
│  5. FINALIZATION (Phases 16-19)                                         │
│     ├─ Update progress.md (final phases)                                │
│     ├─ Update context.md (review results)                               │
│     └─ Finalize pendings.md                                             │
│                                                                          │
│  6. COMPLETE                                                            │
│     ├─ All phases marked in progress.md                                 │
│     ├─ AC coverage report in tests.md                                   │
│     ├─ Pendings documented for v2                                       │
│     └─ Ready for human merge                                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Creating a New Session

### Method 1: Using /task:requirements Command (Recommended)

```bash
/task:requirements Add products CRUD functionality
```

This automatically:
1. Launches PM to gather requirements
2. Creates session folder with naming convention
3. Creates requirements.md, scope.json, context.md

### Method 2: Manual Creation

```bash
# Create session folder
mkdir .claude/sessions/2025-12-15-products-crud-v1

# Copy templates
cp .claude/tools/sessions/templates/requirements.md \
   .claude/sessions/2025-12-15-products-crud-v1/
cp .claude/tools/sessions/templates/scope.json \
   .claude/sessions/2025-12-15-products-crud-v1/
# ... copy other templates
```

---

## Versioning System

### When to Create v2

- Previous version completed but has pending items
- Bug fixes needed on completed feature
- Feature enhancements requested
- Significant scope changes during development

### Starting v2 from v1

```bash
# 1. Create new session folder
mkdir .claude/sessions/2025-12-17-products-crud-v2

# 2. Reference v1 pendings
# In requirements.md:
# **Previous Version:** 2025-12-15-products-crud-v1
# **Addressing Pendings:** P1 (bulk import), P2 (images)

# 3. Run /task:requirements to gather new requirements
/task:requirements Continue products-crud from v1 pendings
```

### Version Tracking in pendings.md

```markdown
## Historial de Sesiones

| Versión | Fecha | Pendientes Resueltos | Nuevos Pendientes |
|---------|-------|---------------------|-------------------|
| v1 | 2025-12-15 | N/A | 2 (P1, P2) |
| v2 | 2025-12-17 | 2 (P1, P2) | 1 (P3) |
```

---

## Templates Location

All templates are in `.claude/tools/sessions/templates/`:

```text
.claude/tools/sessions/templates/
├── requirements.md    # PM requirements template
├── clickup_task.md    # ClickUp task template
├── scope.json         # Scope configuration template
├── plan.md            # Technical plan template
├── progress.md        # Progress tracking template
├── context.md         # Context log template
├── tests.md           # Test documentation template
└── pendings.md        # Pendings template
```

---

## Best Practices

### Session Organization

**DO:**
- Create session at start of feature
- Use correct naming convention
- Classify all ACs in requirements.md
- Update files as you progress
- Document decisions in context.md

**DON'T:**
- Skip session creation
- Mix features in one session
- Forget AC classification
- Batch updates at end
- Leave context gaps

### File Maintenance

**DO:**
- Update progress.md immediately after each phase
- Add context.md entry for significant decisions
- Document all selectors in tests.md
- Record pendings as they're identified

**DON'T:**
- Update progress.md after feature complete
- Write lengthy context.md entries
- Skip selector documentation
- Defer pending documentation

---

## Next Steps

- **[Commands](./06-commands.md)** - Session workflow commands
- **[Workflow Phases](./04-workflow-phases.md)** - How phases use sessions
- **[PM Decisions](./09-pm-decisions.md)** - How decisions populate scope.json
- **[Quality Gates](./07-quality-gates.md)** - How gates update tests.md
