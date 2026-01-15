# Technical Plan: {{SESSION_NAME}}

**Session:** `.claude/sessions/stories/{{SESSION_FULL}}/`
**Created:** {{DATE}}
**T-Shirt Size:** {{TSHIRT}}

---

## Executive Summary

[2-3 sentences summarizing what will be built and how]

---

## Architecture Decision

### Location Decision
- **Core:** [What goes in core/]
- **Theme:** [What goes in theme/]
- **Plugin:** [What goes in plugins/ - if any]

### Rationale
[Why this distribution was chosen]

---

## Relevant ACs (from requirements.md)

[Extract and list the ACs that will be implemented. Reference for phase sections below.]

- **AC1:** [Description]
- **AC2:** [Description]
- **AC3:** [Description]

---

## Token Optimization

This plan uses phase markers for token optimization. After creating this plan, run:

```bash
./skills/session-management/scripts/split-plan.sh stories/{{SESSION_FULL}}/
```

Each phase section below will be extracted into `phases/phase-XX-name.md` for agent consumption.

---

## Implementation Phases

<!-- PHASE:03:START -->
## Phase 3: DB Entity Developer

### Objective
Create database migrations and entity configuration files.

### Relevant ACs
- AC1: [Extracted from requirements.md]
- AC2: [Only ACs relevant to this phase]

### Prerequisites
- None (first development phase)

### Files to Create/Modify
- `migrations/0XX_{{SESSION_NAME}}.sql` - Main table with indexes
- `migrations/0XX_{{SESSION_NAME}}_sample.sql` - Sample data (20+ records)
- `core/entities/{{entity}}/{{entity}}.config.ts` - Entity configuration
- `core/entities/{{entity}}/{{entity}}.fields.ts` - Field definitions
- `core/entities/{{entity}}/{{entity}}.types.ts` - TypeScript types
- `core/entities/{{entity}}/{{entity}}.service.ts` - Service layer

### Implementation Notes
- Use TIMESTAMPTZ for all date fields
- All field names must use camelCase (NOT snake_case)
- Include RLS policies for team isolation
- Sample data should be varied and realistic
<!-- PHASE:03:END -->

<!-- PHASE:05:START -->
## Phase 5: Backend Developer

### Objective
Implement API routes using TDD approach (tests first).

### Relevant ACs
- ACn: [Extracted from requirements.md]
- ACm: [Only ACs relevant to API endpoints]

### Prerequisites
- Phase 3 complete (migrations executed, entity files exist)
- Tables exist in database

### Files to Create/Modify
- `app/api/v1/{{entity}}/route.ts` - CRUD endpoints
- `core/validation/{{entity}}.ts` - Zod schemas
- `__tests__/api/{{entity}}.test.ts` - Jest tests (TDD)

### Implementation Notes
- Write tests FIRST (RED), then implement (GREEN), then refactor
- Implement dual authentication (session + API key)
- Follow existing API patterns (see similar entities)
- Target: 70%+ coverage
<!-- PHASE:05:END -->

<!-- PHASE:07:START -->
## Phase 7: Mock Analyzer (CONDITIONAL)

### Objective
Analyze design mock and extract tokens for frontend implementation.

### Relevant ACs
- ACs related to UI design, styling, visual consistency

### Prerequisites
- Phase 6 (backend-validator) passed
- Mock file exists at path specified in PM Decisions

### Files to Create/Modify
- `ds-mapping.json` - Token mappings from mock to theme
- `globals.css` (only if FULL mode and gaps found)

### Implementation Notes
- Use mock-analyst agent (generates ds-mapping.json automatically)
- For blocks: STRUCTURE mode for analysis
- For general components: FULL mode
- Document gaps and recommendations
<!-- PHASE:07:END -->

<!-- PHASE:08:START -->
## Phase 8: Frontend Developer

### Objective
Build UI components, state management, and translations.

### Relevant ACs
- ACn: [Extracted from requirements.md]
- ACm: [Only ACs relevant to UI/UX]

### Prerequisites
- Phase 5 complete (API endpoints working)
- Backend validator passed

### Files to Create/Modify
- `core/components/{{feature}}/` - UI components (shadcn/ui)
- `core/hooks/use{{Entity}}.ts` - TanStack Query hooks
- `messages/en.json` - English translations
- `messages/es.json` - Spanish translations

### Implementation Notes
- ZERO hardcoded strings (all text via translations)
- All interactive elements need data-cy selectors using sel()
- Follow compound component patterns
- Mobile-first responsive design
<!-- PHASE:08:END -->

<!-- PHASE:10:START -->
## Phase 10: Code Reviewer

### Objective
Review code quality, architecture patterns, and security.

### Relevant ACs
- All ACs (full feature review)

### Prerequisites
- Frontend validator passed
- All development phases complete

### Files to Review
- All files created in phases 3, 5, 8
- Focus on: patterns, security, performance

### Review Checklist
- [ ] Core/Theme boundaries respected
- [ ] No security vulnerabilities
- [ ] Registry pattern followed
- [ ] Performance concerns addressed
<!-- PHASE:10:END -->

<!-- PHASE:12:START -->
## Phase 12: QA Automation (OPTIONAL)

### Objective
Create Cypress automated tests (API + UAT) if PM Decision requires automation.

### Relevant ACs
- All ACs that can be automated

### Prerequisites
- QA Manual passed (Phase 11)
- All features working visually

### Files to Create/Modify
- `cypress/e2e/{{entity}}/` - UAT tests
- `cypress/e2e/api/{{entity}}.cy.ts` - API tests
- `cypress/support/pom/{{entity}}.pom.ts` - Page Object Model

### Implementation Notes
- Verify all data-cy selectors exist before writing tests
- Reuse existing POMs when possible
- Document results in tests.md
<!-- PHASE:12:END -->

<!-- PHASE:13:START -->
## Phase 13: Documentation Writer (CONDITIONAL)

### Objective
Create documentation based on PM Decisions.

### Relevant ACs
- Documentation-related ACs (if any)

### Prerequisites
- QA phase complete
- Feature fully implemented and tested

### Documentation Layers
Based on PM Decisions, create/update:
- Public docs (`docs/public/`) - If user-facing feature
- Superadmin docs (`docs/superadmin/`) - If admin configuration
- Skills (`.claude/skills/`) - If new patterns/conventions

### Implementation Notes
- Follow existing documentation style
- Include screenshots/examples where helpful
- Update skill if new patterns were introduced
<!-- PHASE:13:END -->

<!-- PHASE:14:START -->
## Phase 14: Unit Test Writer (OPTIONAL)

### Objective
Achieve 100% coverage on critical business logic paths.

### Relevant ACs
- ACs involving business logic, validation, edge cases

### Prerequisites
- All development phases complete
- Code review passed

### Files to Create/Modify
- `__tests__/unit/{{entity}}/` - Unit tests
- Focus on: services, utilities, edge cases

### Implementation Notes
- Analyze coverage report to identify gaps
- Focus on business logic, NOT API tests (already covered)
- Target: 100% coverage on critical paths
<!-- PHASE:14:END -->

---

## Technical Decisions

### Decision 1: [Topic]
**Options considered:**
1. [Option A] - [Pros/Cons]
2. [Option B] - [Pros/Cons]

**Chosen:** [Option X]
**Rationale:** [Why this was chosen]

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| [Risk 1] | [Low/Med/High] | [Low/Med/High] | [How to mitigate] |

---

## Dependencies

### External
- [External API or service needed]

### Internal
- [Existing code/entities required]

---

## Success Criteria

1. [ ] All ACs from requirements.md are met
2. [ ] All tests pass (API + UAT)
3. [ ] Build succeeds without errors
4. [ ] Code review approved

---

## Notes

[Additional context, considerations, or warnings for developers]

---

**Next Step:** Run `split-plan.sh` then execute with `/session:execute`
