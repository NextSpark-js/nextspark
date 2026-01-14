# Progreso: [Feature Name]

**Session:** `.claude/sessions/YYYY-MM-DD-feature-name-v1/`
**Version:** v1
**ClickUp Task:** [TASK_ID or "LOCAL_ONLY"]
**Started:** [YYYY-MM-DD]
**Last Updated:** [YYYY-MM-DD HH:MM]

---

## **IMPORTANTE: Este archivo reemplaza los checklists de ClickUp**

- ✅ Todo el progreso se trackea AQUÍ (NO en ClickUp)
- ✅ Los desarrolladores marcan ítems con `[x]` a medida que completan
- ✅ Los gates se actualizan automáticamente por los agentes validadores
- ❌ NO se actualizan checklists en ClickUp

---

## PM Decisions (Phase 1)

**Theme:** [x] Theme existente: `{nombre}` / [ ] Nuevo theme: `{nombre}`
**DB Policy:** [x] Reset permitido / [ ] Migrations incrementales
**Requires Blocks:** [x] No / [ ] Sí

---

## Estado General

**Estado Actual:** [Planning / Foundation / Backend / Blocks / Frontend / QA / Finalization / Done]
**Completado:** [X]% ([Y] de [Z] ítems)

**Agentes Trabajando:**
- [agent-name] - [fase actual]

**Última Actualización:**
- [YYYY-MM-DD HH:MM] - [agent-name] - [breve descripción]

---

## Gates Status

| Gate | Phase | Status | Last Check |
|------|-------|--------|------------|
| theme-validator | 4 | [ ] SKIP / [ ] PASS / [ ] FAIL | - |
| db-validator | 6 | [ ] PENDING / [ ] PASS / [ ] FAIL | - |
| backend-validator | 8 | [ ] PENDING / [ ] PASS / [ ] FAIL | - |
| api-tester | 9 | [ ] PENDING / [ ] PASS / [ ] FAIL | - |
| frontend-validator | 12 | [ ] PENDING / [ ] PASS / [ ] FAIL | - |
| functional-validator | 13 | [ ] PENDING / [ ] PASS / [ ] FAIL | - |
| qa-manual | 14 | [ ] PENDING / [ ] PASS / [ ] FAIL / [ ] RETRY:X | - |
| qa-automation | 15 | [ ] PENDING / [ ] PASS / [ ] FAIL | - |

---

## BLOQUE 1: PLANNING (Completed by /task-plan)

### Phase 1: Product Manager
**Responsable:** product-manager
**Estado:** [x] Completed

- [x] Gather requirements with user
- [x] Determine theme type (new vs existing)
- [x] Determine DB policy (reset vs incremental)
- [x] Determine if blocks are needed
- [x] Create clickup_task.md
- [x] Create requirements.md
- [x] Initialize context.md

### Phase 2: Architecture Supervisor
**Responsable:** architecture-supervisor
**Estado:** [x] Completed

- [x] Read requirements.md and clickup_task.md
- [x] Check for previous versions (pendings.md)
- [x] Create technical plan (plan.md)
- [x] Create this progress.md template
- [x] Create empty tests.md and pendings.md
- [x] Update context.md with technical decisions

---

## BLOQUE 2: FOUNDATION

### Phase 3: Theme Creator [CONDITIONAL]
**Responsable:** theme-creator
**Estado:** [ ] SKIPPED / [ ] Not Started / [ ] In Progress / [ ] Completed
**Condition:** Only if PM Decision = "Nuevo theme"

- [ ] Run pnpm create:theme {theme-name}
- [ ] Configure theme.config.ts (colors, plugins)
- [ ] Configure app.config.ts (teams, features, devKeyring)
- [ ] Configure dashboard.config.ts
- [ ] Configure permissions.config.ts
- [ ] Run node core/scripts/build/registry.mjs
- [ ] Verify theme in THEME_REGISTRY

### Phase 4: Theme Validator [GATE]
**Responsable:** theme-validator
**Estado:** [ ] SKIPPED / [ ] Not Started / [ ] In Progress / [ ] PASSED / [ ] FAILED
**Condition:** Only if Phase 3 executed

**Gate Conditions:**
- [ ] `pnpm build` passes without errors
- [ ] theme.config.ts exists and valid
- [ ] app.config.ts exists and valid
- [ ] dashboard.config.ts exists and valid
- [ ] permissions.config.ts exists and valid
- [ ] Team Mode configured (if enabled)
- [ ] Theme in THEME_REGISTRY

### Phase 5: DB Developer
**Responsable:** db-developer
**Estado:** [ ] Not Started / [ ] In Progress / [ ] Completed

#### 5.1 Migrations
- [ ] Create migration file `migrations/0XX_feature.sql`
- [ ] Define schema with **camelCase** fields (NOT snake_case)
- [ ] Add indexes for performance
- [ ] Add updated_at triggers

#### 5.2 Sample Data
- [ ] Create sample data file `migrations/0XX_feature_sample.sql`
- [ ] Create test users with password hash:
  ```
  3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866
  ```
- [ ] Create users for all Team Mode roles:
  - [ ] owner@test.com (owner)
  - [ ] admin@test.com (admin)
  - [ ] member@test.com (member)
  - [ ] guest@test.com (guest)
- [ ] Configure devKeyring in app.config.ts
- [ ] Create entity sample data (20+ records per entity)
- [ ] Ensure coherent relationships

### Phase 6: DB Validator [GATE]
**Responsable:** db-validator
**Estado:** [ ] Not Started / [ ] In Progress / [ ] PASSED / [ ] FAILED

**Gate Conditions:**
- [ ] Migrations execute successfully
- [ ] All tables exist (verified with db:verify)
- [ ] Sample data exists (20+ per entity)
- [ ] Test users exist with correct password hash
- [ ] Team membership configured (if Team Mode)
- [ ] Foreign keys valid (JOIN queries work)
- [ ] devKeyring configured

---

## BLOQUE 3: BACKEND (TDD)

### Phase 7: Backend Developer
**Responsable:** backend-developer
**Estado:** [ ] Not Started / [ ] In Progress / [ ] Completed

#### 7.1 Tests First (TDD)
- [ ] Create test file `__tests__/api/{entity}.test.ts`
- [ ] Write tests for POST endpoint (201, 400, 401)
- [ ] Write tests for GET endpoint (200, 401, 404)
- [ ] Write tests for PATCH endpoint (200, 400, 401, 404)
- [ ] Write tests for DELETE endpoint (200, 401, 404)

#### 7.2 Implementation
- [ ] Create route handler `app/api/v1/{entity}/route.ts`
- [ ] Implement dual authentication (session + API key)
- [ ] Create Zod validation schemas
- [ ] Implement POST handler
- [ ] Implement GET handler
- [ ] Implement PATCH handler
- [ ] Implement DELETE handler

#### 7.3 Verification
- [ ] All tests pass (green)
- [ ] pnpm build succeeds

### Phase 8: Backend Validator [GATE]
**Responsable:** backend-validator
**Estado:** [ ] Not Started / [ ] In Progress / [ ] PASSED / [ ] FAILED

**Gate Conditions:**
- [ ] `pnpm test -- --testPathPattern=api` passes
- [ ] `pnpm build` succeeds
- [ ] `tsc --noEmit` passes
- [ ] `pnpm lint` passes
- [ ] Dual auth verified in all routes

### Phase 9: API Tester [GATE]
**Responsable:** api-tester
**Estado:** [ ] Not Started / [ ] In Progress / [ ] PASSED / [ ] FAILED

**Gate Conditions:**
- [ ] Cypress API tests pass (100%)
- [ ] Status codes tested (200, 201, 400, 401, 404)
- [ ] Dual auth tested (session + API key)
- [ ] Pagination tested
- [ ] Results documented in tests.md

---

## BLOQUE 4: BLOCKS [CONDITIONAL]

### Phase 10: Block Developer
**Responsable:** block-developer
**Estado:** [ ] SKIPPED / [ ] Not Started / [ ] In Progress / [ ] Completed
**Condition:** Only if PM Decision "Requires Blocks" = Yes

- [ ] Determine active theme
- [ ] Discover existing blocks for patterns
- [ ] Create block files:
  - [ ] config.ts
  - [ ] schema.ts (extends baseBlockSchema)
  - [ ] fields.ts
  - [ ] component.tsx (with data-cy)
  - [ ] index.ts
- [ ] Run `node core/scripts/build/registry.mjs`
- [ ] Verify block in BLOCK_REGISTRY
- [ ] Test block in page builder

---

## BLOQUE 5: FRONTEND

### Phase 11: Frontend Developer
**Responsable:** frontend-developer
**Estado:** [ ] Not Started / [ ] In Progress / [ ] Completed

#### 11.1 UI Components
- [ ] Create component files in `core/components/{feature}/`
- [ ] Define Props interfaces with TypeScript
- [ ] Implement accessibility (ARIA, keyboard nav)
- [ ] Use CSS variables (NO hardcoded colors)
- [ ] Add data-cy attributes for E2E
- [ ] Implement loading and error states
- [ ] Add React.memo where beneficial

#### 11.2 State Management
- [ ] Create TanStack Query hooks for data fetching
- [ ] Implement mutations with cache invalidation
- [ ] Add optimistic updates if applicable
- [ ] NO useEffect for data fetching

#### 11.3 Translations
- [ ] Add keys to `messages/en.json`
- [ ] Add keys to `messages/es.json`
- [ ] Use `useTranslations()` hook
- [ ] NO hardcoded strings

#### 11.4 Verification
- [ ] pnpm build succeeds

### Phase 12: Frontend Validator [GATE]
**Responsable:** frontend-validator
**Estado:** [ ] Not Started / [ ] In Progress / [ ] PASSED / [ ] FAILED

**Gate Conditions:**
- [ ] ALL components have data-cy attributes
- [ ] data-cy naming follows convention
- [ ] NO hardcoded strings
- [ ] Translations exist in EN and ES
- [ ] Translations in correct namespace
- [ ] NO next-intl errors
- [ ] Selectors documented in tests.md

### Phase 13: Functional Validator [GATE]
**Responsable:** functional-validator
**Estado:** [ ] Not Started / [ ] In Progress / [ ] PASSED / [ ] FAILED

**Gate Conditions:**
- [ ] progress.md updated by developers
- [ ] Each AC from clickup_task.md verified in code
- [ ] Playwright spot-checks pass
- [ ] No major gaps between plan and implementation

---

## BLOQUE 6: QA

### Phase 14: QA Manual [GATE + RETRY]
**Responsable:** qa-manual
**Estado:** [ ] Not Started / [ ] In Progress / [ ] PASSED / [ ] FAILED
**Retries:** [0/3]

**Gate Conditions:**
- [ ] Dev server starts without errors
- [ ] All dashboard entity screens load
- [ ] All frontend feature pages load
- [ ] NO console errors
- [ ] NO server errors
- [ ] UI renders correctly

**Retry History:**
| Attempt | Status | Errors | Agent Called |
|---------|--------|--------|--------------|
| 1 | [ ] PASS / [ ] FAIL | - | - |
| 2 | [ ] PASS / [ ] FAIL | - | - |
| 3 | [ ] PASS / [ ] FAIL | - | - |

### Phase 15: QA Automation [GATE]
**Responsable:** qa-automation
**Estado:** [ ] Not Started / [ ] In Progress / [ ] PASSED / [ ] FAILED

**Gate Conditions:**
- [ ] Read selectors from tests.md
- [ ] POMs created/updated
- [ ] UAT tests created for all ACs
- [ ] Tests executed ONE BY ONE
- [ ] 100% pass rate achieved
- [ ] Results documented in tests.md

---

## BLOQUE 7: FINALIZATION

### Phase 16: Code Reviewer
**Responsable:** code-reviewer
**Estado:** [ ] Not Started / [ ] In Progress / [ ] Completed

- [ ] Checkout feature branch
- [ ] Verify .rules/ compliance
- [ ] Security analysis
- [ ] Performance analysis
- [ ] Code quality review
- [ ] Write review in SPANISH
- [ ] Publish to ClickUp (if enabled)

### Phase 17: Unit Test Writer
**Responsable:** unit-test-writer
**Estado:** [ ] Not Started / [ ] In Progress / [ ] Completed

- [ ] Analyze implemented code
- [ ] Create validation schema tests
- [ ] Create business logic tests
- [ ] Create utility function tests
- [ ] Create hook tests
- [ ] Run `pnpm test`
- [ ] Verify 80%+ coverage

### Phase 18: Documentation Writer [OPTIONAL]
**Responsable:** documentation-writer
**Estado:** [ ] SKIPPED / [ ] Not Started / [ ] In Progress / [ ] Completed

- [ ] Create feature documentation
- [ ] Document API endpoints
- [ ] Add usage examples
- [ ] Update relevant .rules/ if needed

### Phase 19: Demo Video Generator [OPTIONAL]
**Responsable:** demo-video-generator (via /doc-demo-feature)
**Estado:** [ ] SKIPPED / [ ] Not Started / [ ] In Progress / [ ] Completed

- [ ] Create Cypress demo script
- [ ] Record demo video
- [ ] Add narration/captions
- [ ] Export to deliverable format

---

## Timeline

| Phase | Agent | Started | Completed | Duration |
|-------|-------|---------|-----------|----------|
| 1 | product-manager | | | |
| 2 | architecture-supervisor | | | |
| 3 | theme-creator | SKIP | SKIP | - |
| 4 | theme-validator | SKIP | SKIP | - |
| 5 | db-developer | | | |
| 6 | db-validator | | | |
| 7 | backend-developer | | | |
| 8 | backend-validator | | | |
| 9 | api-tester | | | |
| 10 | block-developer | SKIP | SKIP | - |
| 11 | frontend-developer | | | |
| 12 | frontend-validator | | | |
| 13 | functional-validator | | | |
| 14 | qa-manual | | | |
| 15 | qa-automation | | | |
| 16 | code-reviewer | | | |
| 17 | unit-test-writer | | | |
| 18 | documentation-writer | SKIP | SKIP | - |
| 19 | demo-video-generator | SKIP | SKIP | - |

---

## Blockers / Issues

[Document any blockers encountered during development]

---

## Decisions During Development

[Document significant decisions that deviated from plan]

---

**Last Updated:** [YYYY-MM-DD HH:MM] by [agent-name]
