# STORY Workflow v1.0

**T-Shirt Size:** L - XL
**Session:** `stories/`
**Subagents:** Specialized per phase (8-10)
**Duration:** 1-5 hours
**Token Estimate:** 120-350k

---

## Overview

The STORY workflow is designed for complex features that require database changes, full CRUD implementation, multiple validation gates, and comprehensive documentation. It provides maximum structure and quality assurance.

---

## Initial Questions (All 7)

Before launching any subagent, Claude asks **all 7 questions** to gather complete context:

```
┌─────────────────────────────────────────────────────────────────┐
│  STORY DISCOVERY (Claude asks directly)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. TASK MANAGER                                                │
│     Is there an existing task in a project management system?   │
│     - No                                                        │
│     - Yes, ClickUp (request task_id)                            │
│     - Yes, Jira (request task_id)                               │
│     - Yes, Linear (request task_id)                             │
│     - Yes, Asana (request task_id)                              │
│                                                                 │
│  2. DATABASE POLICY                                             │
│     How should the database be handled?                         │
│     - Reset allowed (dev/staging)                               │
│     - Incremental migrations only (production)                  │
│                                                                 │
│  3. ENTITY TYPE                                                 │
│     What type of entity change?                                 │
│     - New entity                                                │
│     - Modify existing entity (request name)                     │
│     - No entity changes                                         │
│                                                                 │
│  4. BLOCKS                                                      │
│     Are blocks needed?                                          │
│     - No blocks needed                                          │
│     - Simple blocks (frontend-developer creates)                │
│     - Complex blocks (use BLOCKS workflow)                      │
│                                                                 │
│  5. MOCK                                                        │
│     Do you have a design mock?                                  │
│     - No                                                        │
│     - Yes, I have a mock                                        │
│       IF YES, ask conditional questions:                        │
│       ├── 5a. Mock is for:                                      │
│       │   [1] Page builder blocks (default if Q4 = blocks)      │
│       │   [2] Complete screens/pages                            │
│       │   [3] Specific components                               │
│       ├── 5b. Mock was created in:                              │
│       │   [1] Stitch                                            │
│       │   [2] UXPilot                                           │
│       │   [3] Figma                                             │
│       │   [4] Other                                             │
│       └── 5c. Number of sections/blocks:                        │
│           [1] Single block/component                            │
│           [2] Multiple (2-4)                                    │
│           [3] Full page (5+)
│                                                                 │
│  6. TESTING                                                     │
│     What testing is needed?                                     │
│     - Modify existing tests (request which ones)                │
│     - Create new tests (request description)                    │
│     - Cypress automation required?                              │
│       - Yes                                                     │
│       - No, manual tests only                                   │
│                                                                 │
│  7. DOCUMENTATION                                               │
│     What documentation is needed?                               │
│     - Public docs (end users)                                   │
│     - Superadmin docs (administrators)                          │
│     - Skills update (technical patterns)                        │
│     - No documentation                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key difference from TASK:** After Claude asks questions, Claude launches `product-manager` subagent with the discovery context. PM uses this context to create detailed requirements.md.

---

## When to Use

### Criteria (ANY applies)

| Criterion | Threshold |
|-----------|-----------|
| **Files affected** | 15+ files |
| **Layers touched** | 3 (DB + API + UI) |
| **New tests needed** | Comprehensive |
| **Business risk** | Medium to High |
| **Database changes** | Migrations required |
| **Documentation** | Required |

### Examples

| Task | T-Shirt | Why STORY |
|------|---------|--------------|
| New entity with full CRUD | L-XL | DB + API + UI + Tests |
| Notification system | L | Multiple components, async |
| Auth module refactor | XL | High risk, many files |
| Billing/subscriptions feature | XL | High risk, external APIs |
| Architecture migration | XL | Many files, breaking changes |

---

## When NOT to Use

**Use TWEAK instead if:**
- 1-3 files only
- No planning needed
- Zero business risk
- Simple fix or typo

**Use TASK instead if:**
- 4-15 files affected
- No database changes
- Low to medium risk
- Light planning sufficient
- Feature with 1-2 layers only

---

## Context Awareness

**CRITICAL:** Before starting any STORY workflow, read `.claude/config/context.json` to understand the environment.

### Context Detection

```typescript
const context = await Read('.claude/config/context.json')

if (context.context === 'monorepo') {
  // Full 15-phase workflow with core access
} else if (context.context === 'consumer') {
  // Full 15-phase workflow but core-restricted
}
```

### Scope Declaration (Phase 2: architecture-supervisor)

The architect MUST validate context before planning:

```markdown
## Context Validation

**Detected Context:** [monorepo/consumer]
**Context File:** .claude/config/context.json

### Scope Impact

| Planned Area | Allowed? | Alternative (if blocked) |
|--------------|----------|--------------------------|
| core/entities/ | [Yes/No] | theme entities |
| core/services/ | [Yes/No] | theme services |
| core/migrations/ | [Yes/No] | theme migrations |
```

### Monorepo STORY

When `context.context === "monorepo"`:
- **FULL** 15-phase workflow with core access
- **CAN** create new core entities in `core/entities/`
- **CAN** create core migrations in `core/migrations/`
- **CAN** modify core architecture and shared utilities
- **CAN** add core services in `core/services/`
- Focus on creating reusable, abstract features for the platform

### Consumer STORY

When `context.context === "consumer"`:
- **FULL** 15-phase workflow but **CORE-RESTRICTED**
- **Phase 3 (db-developer):** Use theme migrations only (`migrations/`)
- **Phase 5 (backend-developer):** Create in theme/plugins only
- **FORBIDDEN:** Never create/modify files in `core/` (read-only in node_modules)

If feature **REQUIRES** core changes:
1. Document as "Core Dependency" in requirements.md
2. Pause workflow
3. Request user decision: wait for core update OR implement workaround

### PM Decisions Extension (Add to requirements.md)

```markdown
### Context Awareness
- [ ] Monorepo (full core access)
- [ ] Consumer (core read-only)

### Core Dependencies (Consumer only)
- [ ] No core changes needed
- [ ] Core enhancement needed: ____________
  - Action: [ ] Wait for core update / [ ] Implement workaround
```

### Path Validation (All Developer Phases)

Before any file operation:
```typescript
const context = await Read('.claude/config/context.json')
const targetPath = 'core/entities/newEntity.config.ts'

if (context.context === 'consumer' && targetPath.startsWith('core/')) {
  // STOP - Cannot modify core in consumer context
  return `
    ❌ Cannot create ${targetPath} in consumer context.

    This file is in core/, which is read-only in your project.

    Alternatives:
    1. Create theme-specific entity in entities/
    2. Create plugin entity in plugins/{plugin}/entities/
    3. Document as "Core Enhancement Request" for upstream
  `
}
```

---

## Flow (15 Phases)

```
┌─────────────────────────────────────────────────────────────────┐
│  STORY WORKFLOW v1.0 - 15 PHASES                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  BLOCK 0: DISCOVERY + MOCK ANALYSIS (1-3)                       │
│  ──────────────────────────────────────────                     │
│  Phase 0: Claude (orchestrator) → Asks 7 questions              │
│  Phase 0.5: Mock Upload Pause  [CONDITIONAL: si hay mock]       │
│  Phase 0.6: mock-analyst       [CONDITIONAL: si hay mock]       │
│                                                                 │
│  BLOCK 1: PLANNING (2)                                          │
│  ─────────────────────                                          │
│  Phase 1: product-manager      → requirements.md (with context) │
│  Phase 2: architecture-supervisor → plan.md, progress.md        │
│                                                                 │
│  BLOCK 2: FOUNDATION (2)                                       │
│  ─────────────────────────                                      │
│  Phase 3: db-entity-developer  → migrations + entity files      │
│  Phase 4: db-entity-validator  [GATE]                           │
│                                                                 │
│  BLOCK 3: BACKEND TDD (2)                                      │
│  ─────────────────────────                                      │
│  Phase 5: backend-developer    → API routes (TDD completo)      │
│  Phase 6: backend-validator    [GATE]                           │
│                                                                 │
│  BLOCK 4: DESIGN (legacy - merged into Block 0)                 │
│  ───────────────────────────────────────────────                │
│  Phase 7: [REMOVED - mock-analyst now in Phase 0.6]             │
│                                                                 │
│  BLOCK 5: FRONTEND (2)                                         │
│  ───────────────────────                                        │
│  Phase 8: frontend-developer   → UI + bloques simples           │
│  Phase 9: frontend-validator   [GATE]                           │
│                                                                 │
│  BLOCK 6: CODE REVIEW (1)                                      │
│  ─────────────────────────                                      │
│  Phase 10: code-reviewer       → architecture + security        │
│                                                                 │
│  BLOCK 7: QA (2)                                               │
│  ───────────────                                                │
│  Phase 11: qa-manual           [ORCHESTRATOR]                   │
│  Phase 12: qa-automation       [OPTIONAL: si PM lo requiere]    │
│                                                                 │
│  BLOCK 8: FINALIZATION (2)                                     │
│  ─────────────────────────                                      │
│  Phase 13: documentation-writer [CONDITIONAL]                   │
│  Phase 14: unit-test-writer    [OPTIONAL: coverage 100%]        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Changes from v5.2

| Change | Reason |
|--------|-------|
| **New:** Phase 0 DISCOVERY (Claude asks questions) | Consistent question experience across all workflows |
| **Changed:** PM no longer asks questions | Claude asks in Phase 0, PM receives context |
| **New:** Phase 0.6 mock-analyst [CONDITIONAL] | Design token analysis when mock available |
| **Expanded:** PM Decisions with Task Manager | Integration with ClickUp/Jira/Asana/Linear |
| **Expanded:** PM Decisions with Testing | Control over which tests to create |
| **Expanded:** PM Decisions with Mock | Enables design system analysis |
| **Changed:** qa-automation from GATE to OPTIONAL | Automated testing based on need |

**Result:** 13 phases → 15 phases, 5 gates → 4 mandatory gates

---

## Changes from v4.0

| Change | Reason |
|--------|-------|
| **New:** Phase 0 DISCOVERY | Claude asks questions consistently |
| **Removed:** theme-creator | Separate workflow |
| **Merged:** db-developer + entity config | DB/Entity coherence |
| **Merged:** api-tester into backend-validator | Reduce redundant gates |
| **Merged:** functional-validator into frontend-validator | Reduce redundant gates |
| **Moved:** code-reviewer BEFORE QA | Avoid rework post-QA |
| **Removed:** block-developer | Frontend handles or separate workflow |
| **Converted:** qa-manual from subagent to ORCHESTRATOR | Full context, fewer issues |
| **Moved:** unit-test-writer to FINALIZATION as optional | 100% coverage when needed |
| **Expanded:** documentation-writer with 3 doc layers | Public, superadmin, skills |
| **New:** mock-analyst (Phase 0.6) for design tokens | Mock analysis |
| **New:** Expanded PM Decisions | Task Manager, Mocks, Testing |

**Result:** 19 phases → 15 phases, 8 gates → 4 mandatory gates

---

## Characteristics

| Aspecto | v4.0 | v1.0 |
|---------|------|------|
| **Total phases** | 19 | 15 (including Phase 0) |
| **Mandatory gates** | 8 | 4 |
| **Subagents** | 15+ | 8-10 |
| **Phase types** | 1 (subagent) | 5 (orchestrator, subagent, gate, conditional, optional) |
| **Who asks questions** | PM subagent | Claude (orchestrator) |
| **Typical duration** | 2-8 hours | 1-5 hours |
| **Token estimate** | 200-500k | 120-350k |

---

## Tipos de Fases

| Tipo | Símbolo | Descripción | Quién ejecuta |
|------|---------|-------------|---------------|
| **SUBAGENT** | (ninguno) | Agente especializado | Subagente dedicado |
| **GATE** | [GATE] | Validación que debe pasar | Subagente validador |
| **ORCHESTRATOR** | [ORCHESTRATOR] | Fase con contexto completo | Orquestador principal |
| **CONDITIONAL** | [CONDITIONAL] | Se ejecuta según PM Decisions | Subagente dedicado |
| **OPTIONAL** | [OPTIONAL] | Se ejecuta si se solicita | Subagente dedicado |

---

## Workflows Separados (No incluidos aquí)

| Workflow | Comando | Uso |
|----------|---------|-----|
| Theme creation | `/session:theme:create` | Crear nuevo theme |
| Plugin creation | `/session:plugin:create` | Crear nuevo plugin |
| Block creation | `/session:block:create` | Bloques complejos |

**Nota:** STORY asume que el theme ya existe.

---

## PM Decisions (OBLIGATORIO en requirements.md)

```markdown
## PM Decisions

### Task Manager
- [ ] No task manager
- [ ] ClickUp: task_id=____________
- [ ] Jira: task_id=____________
- [ ] Linear: task_id=____________
- [ ] Asana: task_id=____________

### Database Policy
- [ ] Reset allowed (dev/staging)
- [ ] Incremental migrations only (production)

### Entity Type
- [ ] New entity required
- [ ] Modify existing entity: ____________
- [ ] No entity changes

### Blocks
- [ ] No blocks needed
- [ ] Simple blocks (frontend-developer creates)
- [ ] Complex blocks (use BLOCKS workflow)

### Mock
- [ ] No mock disponible
- [ ] Mock disponible: path=____________
  - [ ] Para bloques (page builder)
  - [ ] Para componentes generales

### Testing
- [ ] Modificar tests existentes: ____________
- [ ] Crear nuevos tests: ____________
- [ ] Automatización Cypress requerida
- [ ] Solo tests manuales

### Documentation
- [ ] Public docs (user-facing)
- [ ] Superadmin docs (internal admin)
- [ ] Skills update (technical patterns)
- [ ] No documentation needed
```

---

## Discovery to PM Handoff (Phase 0 → Phase 1)

Claude asks all 7 questions in Phase 0, then passes the discovery context to the product-manager in Phase 1:

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 0: DISCOVERY (Claude)                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Claude asks user the 7 questions (see Initial Questions above) │
│  Claude collects all answers                                    │
│  Claude creates discovery context object                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1: PRODUCT-MANAGER (receives context)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PM receives discovery context:                                 │
│  {                                                              │
│    taskManager: { type: "clickup", taskId: "abc123" },          │
│    databasePolicy: "reset_allowed",                             │
│    entityType: { type: "new", name: "products" },               │
│    blocks: "simple",                                            │
│    mock: { path: "_tmp/mocks/products", for: "blocks" },        │
│    testing: { type: "create", automation: true },               │
│    documentation: ["superadmin", "skills"]                      │
│  }                                                              │
│                                                                 │
│  PM uses context to:                                            │
│  ├── Fetch external task (if taskManager provided)              │
│  ├── Create requirements.md with correct PM Decisions           │
│  ├── Define ACs based on entity type                            │
│  └── Set up session structure                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Benefits of this approach:**
- Consistent question experience across all workflows (Claude always asks)
- PM has full context before starting work
- If external task exists, PM can fetch and incorporate it
- No redundant questioning

---

## Session Files

```
stories/YYYY-MM-DD-name/
├── context.md              # Permanent info + agent log
├── requirements.md         # ACs, user stories, PM Decisions
├── plan.md                 # Detailed technical plan (with phase markers)
├── scope.json              # Allowed paths
├── pendings.md             # Global pending items
├── tests.md                # Selectors, translations, results
│
├── mocks/                  # [CONDITIONAL: if mock selected]
│   ├── code.html           # User uploads
│   ├── screen.png          # User uploads
│   ├── analysis.json       # From mock-analyst (Phase 0.6)
│   └── ds-mapping.json     # From mock-analyst (Phase 0.6)
│
├── phases/                 # Auto-generated phase files (token optimization)
│   ├── phase-03-db-entity.md
│   ├── phase-05-backend.md
│   ├── phase-08-frontend.md
│   └── ...                 # One file per developer phase
│
├── iterations/
│   ├── 01-initial/
│   │   ├── progress.md
│   │   ├── changes.md
│   │   └── closed.json
│   └── 02-scope-change/
│       ├── scope-change.md
│       ├── progress.md
│       └── changes.md
│
└── current/
    ├── progress.md → iterations/XX/progress.md
    └── changes.md → iterations/XX/changes.md
```

**Token Optimization:** The `phases/` directory contains pre-split phase files generated by `split-plan.sh`. Each developer agent reads only their specific phase file (~800 tokens) instead of the full plan.md (~2,800 tokens). See `_docs/workflows-optimizations.md` for details.

---

## Validation Gates

| Gate | Phase | What it validates | Required |
|------|-------|-------------------|----------|
| `db-entity-validator` | 4 | Migrations, sample data, entity files | Yes |
| `backend-validator` | 6 | Jest tests, build, lint, Cypress API | Yes |
| `frontend-validator` | 9 | data-cy, translations, ACs coherence | Yes |
| `qa-automation` | 12 | Cypress UAT tests | **No** (PM Decision) |

**Note:** qa-manual is no longer a separate GATE, it's an ORCHESTRATOR phase that can block if it finds critical errors.

---

## Subagents by Phase

| Phase | Type | Agent/Executor | Responsibility |
|------|------|-----------------|-----------------|
| 0 | ORCHESTRATOR | *Claude* | Ask 7 questions, collect discovery context |
| 1 | SUBAGENT | product-manager | Requirements with context, ACs, PM Decisions |
| 2 | SUBAGENT | architecture-supervisor | Technical plan, progress template |
| 3 | SUBAGENT | db-entity-developer | Migrations + Entity files |
| 4 | GATE | db-entity-validator | Validate DB + Entity |
| 5 | SUBAGENT | backend-developer | API routes (full TDD) |
| 6 | GATE | backend-validator | Jest + Build + API tests |
| 7 | DEPRECATED | ~~mock-analyst~~ | Moved to Phase 0.6 |
| 8 | SUBAGENT | frontend-developer | UI components + simple blocks |
| 9 | GATE | frontend-validator | data-cy + i18n + ACs |
| 10 | SUBAGENT | code-reviewer | Architecture + Security review |
| 11 | ORCHESTRATOR | *orchestrator* | QA Manual with Playwright |
| 12 | OPTIONAL | qa-automation | Cypress UAT tests |
| 13 | CONDITIONAL | documentation-writer | Docs: public, superadmin, skills |
| 14 | OPTIONAL | unit-test-writer | Coverage 100% |

---

## Block Details

### BLOQUE 0: DISCOVERY + MOCK ANALYSIS

**Phase 0: Claude (Orchestrator)**
```
Responsabilidades:
├── Hacer las 7 preguntas al usuario
│   ├── Q4: Blocks → Entender si hay bloques
│   └── Q5: Mock → Si Yes, hacer preguntas condicionales 5a, 5b, 5c
│       └── Si Q4 = blocks → 5a defaults to "blocks"
├── Recopilar todas las respuestas
├── Crear objeto de contexto discovery
├── Evaluar si el workflow STORY es correcto
│   └── Si es demasiado simple → Recomendar TASK
└── Si hay mock → Continuar con Phase 0.5
    Si no hay mock → Lanzar product-manager con contexto
```

**Phase 0.5: Mock Upload Pause** [CONDITIONAL: si hay mock]
```
⚠️ SE EJECUTA SI: Discovery answer "Mock" = Yes

Responsabilidades:
├── Crear carpeta session con mocks/ subfolder
├── Mostrar instrucciones de upload:
│   ┌─────────────────────────────────────────────────────┐
│   │  📁 MOCK UPLOAD REQUIRED                            │
│   │                                                     │
│   │  Please upload your mock files to:                  │
│   │  .claude/sessions/stories/YYYY-MM-DD-name/mocks/    │
│   │                                                     │
│   │  Expected files (auto-detected):                    │
│   │  - HTML: code.html, index.html, *.html              │
│   │  - Screenshot: screen.png, *.png, *.jpg             │
│   │  - Optional: assets/, tailwind.config.js            │
│   │                                                     │
│   │  Reply "ready" when files are uploaded.             │
│   └─────────────────────────────────────────────────────┘
├── Esperar confirmación del usuario ("ready")
└── Validar que los archivos existen
```

**Phase 0.6: mock-analyst** [CONDITIONAL: si hay mock]
```
⚠️ SE EJECUTA SI: Phase 0.5 completado exitosamente

Responsabilidades:
├── Detectar archivos en mocks/ (*.html, *.png, *.jpg, *.pdf)
├── Analizar HTML/CSS del mock (si disponible)
├── Extraer tokens de diseño del Tailwind config
├── Mapear a tokens del theme activo
├── Identificar gaps (tokens faltantes)
└── Generar outputs:
    ├── analysis.json (estructura del mock)
    └── ds-mapping.json (mapeo de tokens)

Output → PM recibe mock analysis como parte del contexto
```

### BLOQUE 1: PLANNING

**Phase 1: product-manager**
```
Responsabilidades (CON CONTEXTO de Phase 0):
├── Recibir discovery context de Claude
├── Si hay Task Manager en contexto:
│   ├── Usar task_id del contexto
│   ├── Leer tarea existente (contexto)
│   └── Sincronizar ACs con la tarea
├── Crear requirements.md con ACs detallados
├── Rellenar PM Decisions con datos del contexto
└── Crear clickup_task.md (si aplica)

⚠️ NO hace preguntas - ya tiene el contexto de Phase 0
```

**Phase 2: architecture-supervisor**
- Lee requirements y PM Decisions
- Crea `plan.md` con plan técnico detallado
  - **CRITICAL:** Must include phase markers for token optimization
  - Format: `<!-- PHASE:XX:START -->` and `<!-- PHASE:XX:END -->`
  - Each phase section ~800 tokens, self-contained
  - ACs extracted per phase (not "see requirements.md")
- Crea `progress.md` template con todas las fases
- Define scope en `scope.json`
- Si hay Mock → Incluye Phase 7 en plan
- **After plan.md:** Run `split-plan.sh` to create phase files

---

### BLOCK 2: FOUNDATION

**Phase 3: db-entity-developer**
```
Context (Token Optimized):
├── Read phases/phase-03-db-entity.md (~800 tokens)
│   └── Contains: Objective, Relevant ACs, Files to create
├── Read progress.md (~200 tokens)
└── Total: ~1,000 tokens (vs ~7,800 without optimization)

Responsabilidades:
├── 3.1 Database Layer
│   ├── Migration file (SQL con TIMESTAMPTZ)
│   ├── Sample data (abundante y realista)
│   └── Test users en devKeyring
│
└── 3.2 Entity Layer
    ├── entity.config.ts (5 sections)
    ├── entity.fields.ts (NO system fields)
    ├── entity.types.ts
    ├── entity.service.ts (static class, RLS)
    └── entity.messages/ (en.json, es.json)
```

**Phase 4: db-entity-validator** [GATE]
- ✓ Migrations ejecutan sin error
- ✓ Tablas existen con schema correcto
- ✓ Sample data insertada
- ✓ Test users pueden autenticarse
- ✓ Entity files existen (4-5 archivos)
- ✓ Types coinciden con migration
- ✓ Service methods funcionan

---

### BLOCK 3: BACKEND TDD

**Phase 5: backend-developer**
```
Context (Token Optimized):
├── Read phases/phase-05-backend.md (~800 tokens)
│   └── Contains: Objective, Relevant ACs, Files to create
├── Read progress.md (~200 tokens)
└── Total: ~1,000 tokens (vs ~7,800 without optimization)

TDD Completo:
1. Escribir tests PRIMERO (RED)
2. Implementar código (GREEN)
3. Refactorizar (REFACTOR)

Entregables:
├── __tests__/api/[entity].test.ts
├── app/api/v1/[entity]/route.ts
├── Dual auth (session + API key)
├── Zod validation schemas
├── Response format con metadata
└── Target: 70%+ coverage
```

**Phase 6: backend-validator** [GATE]
- ✓ Jest tests pasan (100%)
- ✓ `pnpm build` sin errores
- ✓ `tsc --noEmit` sin errores
- ✓ `pnpm lint` sin errores
- ✓ Cypress API tests pasan (si hay endpoints nuevos)
- ✓ Data-only registry pattern verificado

---

### BLOCK 4: DESIGN [DEPRECATED]

**Phase 7: [REMOVED - Moved to Phase 0.6]**

```
⚠️ ESTA FASE SE MOVIÓ A PHASE 0.6 EN BLOCK 0

Razón del cambio:
├── Mock analysis debe ocurrir ANTES de PM
├── PM necesita ver el análisis para escribir mejores ACs
├── Arc necesita saber qué bloques crear
└── Frontend-developer sigue leyendo ds-mapping.json

El mock analysis ahora:
├── Se ejecuta inmediatamente después de Discovery
├── Genera analysis.json + ds-mapping.json en mocks/
└── PM y Arc reciben el análisis como parte del contexto
```

**Integración con frontend-developer (sin cambios):**
```
El frontend-developer:
1. Lee mocks/ds-mapping.json (si existe)
2. Usa los mappings para aplicar tokens correctos
3. Reporta si encuentra valores no mapeados
```

---

### BLOCK 5: FRONTEND

**Phase 8: frontend-developer**
```
Context (Token Optimized):
├── Read phases/phase-08-frontend.md (~800 tokens)
│   └── Contains: Objective, Relevant ACs, Files to create
├── Read progress.md (~200 tokens)
└── Total: ~1,000 tokens (vs ~7,800 without optimization)

Responsabilidades:
├── UI Components (shadcn/ui, compound patterns)
├── State Management (TanStack Query)
├── Translations (ZERO hardcoded strings)
├── data-cy selectors (con sel() function)
├── Accessibility (ARIA, keyboard nav)
├── Bloques simples (si PM Decision permite)
├── Responsive design (mobile-first)
│
└── Si hay ds-mapping.json:
    ├── Usar tokens mapeados
    ├── Reportar gaps encontrados
    └── Seguir guía de colores/spacing
```

**Phase 9: frontend-validator** [GATE]
- ✓ Todos los data-cy usan `sel()` function
- ✓ ZERO hardcoded strings (todo usa translations)
- ✓ `pnpm build` sin errores
- ✓ ACs coherentes con implementación
- ✓ Selectores documentados en tests.md
- ✓ Si hay mock: valores usan tokens del mapping

---

### BLOCK 6: CODE REVIEW

**Phase 10: code-reviewer**
```
Context (Token Optimized):
├── Read phases/phase-10-code-reviewer.md (~800 tokens)
│   └── Contains: Objective, Files to review, Checklist
├── Read progress.md (~200 tokens)
└── Total: ~1,000 tokens (vs ~7,800 without optimization)

Review antes de QA:
├── Architecture patterns correctos
├── Security vulnerabilities
├── Performance concerns
├── Code quality y best practices
├── Core/Theme boundaries respetados
└── Registry pattern violations
```

Si encuentra issues críticos → Llama al developer para fix.

---

### BLOCK 7: QA

**Phase 11: qa-manual** [ORCHESTRATOR]

```
⚠️ EJECUTADO POR EL ORQUESTADOR (no subagente)

El orquestador tiene contexto completo de la sesión:
- Ya leyó requirements.md (conoce los ACs)
- Ya leyó plan.md (conoce la arquitectura)
- Ya leyó progress.md (sabe qué se implementó)

Ejecución:
1. Iniciar dev server (si no está corriendo)
2. Abrir browser con Playwright
3. Para cada AC en requirements.md:
   ├── Navegar a la pantalla correspondiente
   ├── Verificar funcionamiento visual
   ├── Probar interacciones principales
   └── Marcar como ✓ o ✗
4. Revisar consola del browser por errores
5. Revisar network por errores 500
6. Si encuentra issues:
   ├── Documentar en context.md
   ├── Llamar al developer apropiado (backend/frontend)
   ├── Esperar fix
   └── Retry (max 3 intentos)
7. Si todo OK → Continuar (qa-automation si PM lo requiere)

Ventajas vs subagente:
✓ Contexto completo sin re-lectura
✓ Mejor criterio sobre qué es crítico
✓ Menos problemas de herramientas
✓ Decisiones más inteligentes
```

**Phase 12: qa-automation** [OPTIONAL]

```
⚠️ SE EJECUTA SI: PM Decision "Testing" incluye "Automatización Cypress requerida"

Responsabilidades:
├── Heredar contexto de qa-manual (misma sesión)
├── Verificar selectores antes de ejecutar
├── Crear/actualizar Cypress tests (API + UAT)
├── Ejecutar suite completa
└── Documentar resultados en tests.md

Si PM Decision es "Solo tests manuales":
└── Esta fase se SALTA
```

---

### BLOCK 8: FINALIZATION

**Phase 13: documentation-writer** [CONDITIONAL]

```
⚠️ SE EJECUTA SI PM Decision indica documentación necesaria

RESPONSABILIDADES EXPANDIDAS:
El agente debe analizar qué documentación crear/actualizar
basándose en los cambios realizados.
```

#### Tres Capas de Documentación

| Capa | Ubicación | Audiencia | Lenguaje |
|------|-----------|-----------|----------|
| **Public** | `docs/public/` | Usuarios finales | Simple, no técnico |
| **Superadmin** | `docs/superadmin/` | Administradores | Semi-técnico, operacional |
| **Skills** | `.claude/skills/` | Claude/Desarrolladores | Técnico, patrones |

#### Matriz de Decisión

```
Tipo de Cambio              │ Public │ Superadmin │ Skills
────────────────────────────┼────────┼────────────┼────────
Nueva entidad + CRUD        │   ○    │     ●      │   ●
Nuevo API endpoint          │   ○    │     ●      │   ○
Nuevo componente UI         │   ○    │     ○      │   ○
Nueva arquitectura/patrón   │   ✗    │     ○      │   ●
Cambio de configuración     │   ✗    │     ●      │   ○
Nuevo plugin                │   ○    │     ●      │   ●
Nueva convención/patrón     │   ✗    │     ✗      │   ●

● = Requerido
○ = Si aplica
✗ = No necesario
```

#### Detalle por Capa

**Public Docs** (`docs/public/`)
```
Cuándo crear/actualizar:
- Feature visible para usuarios finales
- Nuevo flujo de usuario
- Cambio en UI existente

Contenido:
├── Guías de usuario (how-to)
├── FAQs
├── Screenshots/GIFs
└── Ejemplos de uso

Estilo:
- Lenguaje simple y accesible
- Evitar jerga técnica
- Paso a paso con imágenes
```

**Superadmin Docs** (`docs/superadmin/`)
```
Cuándo crear/actualizar:
- Nueva entidad administrable
- Nuevas opciones de configuración
- Cambios en permisos/roles
- Nuevos flujos de administración

Contenido:
├── Guías de configuración
├── Troubleshooting
├── Opciones disponibles
├── Permisos necesarios
└── Ejemplos de configuración

Estilo:
- Semi-técnico pero comprensible
- Enfocado en operaciones
- Sin código, pero con ejemplos de config
```

**Skills** (`.claude/skills/`)
```
Cuándo crear/actualizar:
- Nuevo patrón arquitectural
- Nueva convención de código
- Patrón que se reutilizará
- Conocimiento técnico que Claude necesita recordar

Contenido:
├── SKILL.md principal
├── Estructura de archivos
├── Patrones y convenciones
├── Ejemplos de código
├── Anti-patterns
└── Referencias a otros skills

Criterios para crear/actualizar skill:
□ ¿Es un patrón que se reutilizará?
□ ¿Claude necesita recordar esto para futuras tareas?
□ ¿Un developer necesitaría entender esto?
□ ¿Cambia cómo se hace algo en el proyecto?

Si ≥2 respuestas son SÍ → Crear/actualizar skill
```

#### Flujo del documentation-writer

```
1. ANÁLISIS
   ├── Leer changes.md (qué archivos cambiaron)
   ├── Leer requirements.md (qué feature es)
   ├── Leer PM Decisions (qué docs se pidieron)
   └── Identificar tipo de cambios

2. DECISIÓN
   ├── Aplicar matriz de decisión
   ├── Determinar qué capas necesitan docs
   └── Priorizar: Skills > Superadmin > Public

3. EJECUCIÓN
   Para cada capa necesaria:
   ├── Verificar si existe documentación previa
   ├── Si existe → Actualizar
   ├── Si no existe → Crear
   └── Seguir estilo de la capa

4. VALIDACIÓN
   ├── Links funcionan
   ├── Ejemplos son correctos
   ├── Código compila (en skills)
   └── Consistencia con docs existentes
```

**Phase 14: unit-test-writer** [OPTIONAL]

```
SE EJECUTA SI:
- Coverage actual < 80%
- PM solicita coverage 100%
- Hay business logic compleja sin tests

Responsabilidades:
├── Analizar coverage report
├── Identificar gaps
├── Escribir tests para:
│   ├── Services (business logic)
│   ├── Utilities
│   ├── Edge cases
│   └── Error handling
└── Target: 100% coverage en critical paths

NO hace:
- Re-escribir tests de backend-developer
- Tests de API (ya cubiertos)
- Tests E2E (eso es qa-automation)
```

---

## Iterations

### When to Create a New Iteration

1. **Scope Change:** El alcance cambió significativamente
2. **Major Blocker:** Blocker que requiere replantear
3. **Review Feedback:** Code review requiere cambios sustanciales
4. **Pausa Larga:** Se pausó el trabajo por días

### Command

```bash
./iteration-init.sh stories/YYYY-MM-DD-name scope-change "add-variants"
```

---

## Commands

```
/session:start:story <description>
```

Or automatic evaluation:
```
/session:start complex-feature-description
```

---

## Flow Diagram

```
START
  │
  ▼
┌─────────────────┐
│ BLOQUE 0:       │
│ DISCOVERY       │
│ (0, 0.5, 0.6)   │
│ Claude asks 7   │
│ questions       │
└────────┬────────┘
         │
         ▼
    ┌────────────────────┐
    │ Mock selected?     │
    │ (Discovery Q4)     │
    └─────┬──────────────┘
          │
      ┌───┴───┐
      │       │
     YES      NO
      │       │
      ▼       │
┌─────────────┐│
│ Phase 0.5:  ││
│ Mock Upload ││
│ Pause       ││
└──────┬──────┘│
       │       │
       ▼       │
┌─────────────┐│
│ Phase 0.6:  ││
│ mock-analyst││
└──────┬──────┘│
       │       │
       └───┬───┘
           │
           ▼
┌─────────────────┐
│ BLOQUE 1:       │
│ PLANNING        │
│ (1-2) PM + Arc  │
│ receives context│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ BLOQUE 2:       │
│ FOUNDATION      │
│ (3-4)           │
└────────┬────────┘
         │
         ▼
    ┌────────────┐
    │ GATE: db-  │──NO──► Fix db-entity-developer
    │ entity-    │        │
    │ validator  │◄───────┘
    └─────┬──────┘
          │YES
          ▼
┌─────────────────┐
│ BLOQUE 3:       │
│ BACKEND TDD     │
│ (5-6)           │
└────────┬────────┘
         │
         ▼
    ┌────────────┐
    │ GATE:      │──NO──► Fix backend-developer
    │ backend-   │        │
    │ validator  │◄───────┘
    └─────┬──────┘
          │YES
          ▼
┌─────────────────┐
│ BLOQUE 5:       │
│ FRONTEND        │
│ (8-9)           │
└────────┬────────┘
         │
         ▼
    ┌────────────┐
    │ GATE:      │──NO──► Fix frontend-developer
    │ frontend-  │        │
    │ validator  │◄───────┘
    └─────┬──────┘
          │YES
          ▼
┌─────────────────┐
│ BLOQUE 6:       │
│ CODE REVIEW     │──Issues──► Fix developer
│ (10)            │            │
└────────┬────────┘◄───────────┘
         │OK
         ▼
┌─────────────────┐
│ BLOQUE 7:       │
│ QA              │
│ (11-12)         │
└────────┬────────┘
         │
         ▼
    ┌─────────────────────┐
    │ QA MANUAL           │
    │ (Orquestador)       │──Errors──► Fix developer
    │                     │            │
    └──────────┬──────────┘◄───────────┘
               │OK
               ▼
    ┌────────────────────┐
    │ Cypress requerido? │
    │ (PM Decision)      │
    └─────┬──────────────┘
          │
      ┌───┴───┐
      │       │
     YES      NO
      │       │
      ▼       │
┌─────────────┐│
│ qa-auto     ││
│ [OPTIONAL]  ││
└──────┬──────┘│
       │       │
       └───┬───┘
           │
           ▼
┌─────────────────┐
│ BLOQUE 8:       │
│ FINALIZATION    │
│ (13-14)         │
└────────┬────────┘
         │
         ├──► [CONDITIONAL] documentation-writer
         │    ├── Public docs
         │    ├── Superadmin docs
         │    └── Skills
         │
         └──► [OPTIONAL] unit-test-writer
              └── Coverage 100%
         │
         ▼
       DONE
```

---

## Evolution Summary

```
v4.0 (Original)     v1.0 (Current)
─────────────────────────────────────
19 phases       →   15 phases (-21%)
8 gates         →   4 mandatory (-50%)
15+ subagents   →   8-10 subagents
1 phase type    →   5 phase types
PM asks Qs      →   Claude asks Qs (consistent)
No Task Manager →   ClickUp/Jira/Linear/Asana
No Mocks        →   Mock analysis with mock-analyst
Basic docs      →   3 doc layers
QA subagent     →   QA orchestrator
Fixed testing   →   Configurable testing
```

---

## Related Documentation

- `workflows/tweak.md` - For simple adjustments (XS-S)
- `workflows/task.md` - For medium complexity (S-M-L)
- `commands/session-start.md` - Start command details
- `commands/session-execute.md` - Execution details
- `skills/README.md` - All available skills

---

## Version History

| Version | Changes |
|---------|---------|
| v1.0 | First public version: 15 phases, English documentation |
| v1.1 | Mock analysis moved to Phase 0.6, Block 4 deprecated |
| v5.2 | Added mock-analyst phase (legacy) |
| v4.0 | Original 19-phase workflow |
