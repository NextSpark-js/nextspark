# Workflow Completo de Desarrollo v4.2

Este documento describe el flujo completo de desarrollo desde la creacion de una tarea hasta su aprobacion final, incluyendo todos los agentes involucrados, gates de validacion, y el principio "Fail Fast".

**Version:** 4.2
**Last Updated:** 2025-12-30

---

## Resumen de Cambios v4.1 -> v4.2

| Aspecto | v4.1 | v4.2 |
|---------|------|------|
| Fases | 19 | **19 + Phase 15.5** |
| BDD Documentation | Manual/Opcional | **Automatizada (bdd-docs-writer)** |
| Nuevo Agente | - | **bdd-docs-writer (Phase 15.5)** |
| Nuevo Comando | - | **/bdd:write** |
| Post-QA Flow | qa-automation → code-reviewer | **qa-automation → bdd-docs-writer → code-reviewer** |

---

## Resumen de Cambios v4.0 -> v4.1

| Aspecto | v4.0 | v4.1 |
|---------|------|------|
| @ui-selectors | qa-automation (Phase 15) | **frontend-validator (Phase 12)** |
| Test Planning | Implicit | **Explicit in tests.md (Step 1.5b)** |
| Test Execution | File-by-file | **Batch execution (5 tests per batch)** |
| Pass Threshold | 100% required | **90% with warnings, 100% ideal** |
| Selector Validation | Phase 15 | **Phase 12 (earlier detection)** |

---

## Resumen de Cambios v3.1 -> v4.0

| Aspecto | v3.1 | v4.0 |
|---------|------|------|
| Fases | 9 (+ theme condicional) | 19 (con fases condicionales) |
| Gates de validacion | 1 (QA retry) | 8 gates explicitos |
| Agentes | 12 | 22 (+10 nuevos, incluyendo plugin agents) |
| Decisiones PM | Ninguna especial | 4 obligatorias (dev type, DB, blocks, plugin config) |
| Plugin workflow | No existe | Preset + sandbox + agents + conditional phases |
| Sample data | Manual/opcional | Obligatoria con test users |
| QA Manual | No existe | Nueva fase con retry logic |
| Demo video | No integrado | Opcional al final |
| TDD Backend | No enforzado | Obligatorio (tests primero) |

---

## Diagrama del Workflow Completo (19 Fases + 15.5)

```
+---------------------------------------------------------------------------+
|                    WORKFLOW v4.2 - 19 FASES CON GATES + PHASE 15.5        |
+---------------------------------------------------------------------------+
|                                                                           |
|  +=====================================================================+  |
|  |  BLOQUE 1: PLANNING                                                 |  |
|  +=====================================================================+  |
|  |  1. product-manager: Requirements + Decisiones                      |  |
|  |     - Dev Type: Feature / New Theme / New Plugin / Plugin+Theme / Core Change |  |
|  |     - DB Policy: Reset vs Incremental                               |  |
|  |     - Blocks: Requiere crear/modificar bloques                      |  |
|  |     - Plugin Config: Complexity, Has Entities, Test Theme           |  |
|  |  2. architecture-supervisor: Plan tecnico con 19 fases              |  |
|  +=====================================================================+  |
|                                  |                                        |
|  +===============================v=====================================+  |
|  |  BLOQUE 2: FOUNDATION (condicional)                                 |  |
|  +=====================================================================+  |
|  |  3. plugin-creator (si nuevo plugin)                                |  |
|  |  4. plugin-validator -------------------------------- [GATE]        |  |
|  |     - TypeScript compila                                            |  |
|  |     - Plugin en PLUGIN_REGISTRY                                     |  |
|  |     - Plugin en plugin-sandbox theme                                |  |
|  |  3b. theme-creator (si nuevo theme)                                 |  |
|  |  4b. theme-validator -------------------------------- [GATE]        |  |
|  |     - Build pasa                                                    |  |
|  |     - Config files existen y validos                                |  |
|  |     - Team Mode configurado                                         |  |
|  |  5. db-developer (migrations + sample data + test users)            |  |
|  |  6. db-validator ------------------------------------ [GATE]        |  |
|  |     - Migrations ejecutan                                           |  |
|  |     - Sample data existe (20+ por entidad)                          |  |
|  |     - Test users con devKeyring                                     |  |
|  +=====================================================================+  |
|                                  |                                        |
|  +===============================v=====================================+  |
|  |  BLOQUE 3: BACKEND (TDD)                                            |  |
|  +=====================================================================+  |
|  |  7. backend-developer (tests FIRST + implementation)                |  |
|  |  8. backend-validator ------------------------------- [GATE]        |  |
|  |     - Jest tests pasan                                              |  |
|  |     - Build exitoso                                                 |  |
|  |     - TypeScript sin errores                                        |  |
|  |     - Lint pasa                                                     |  |
|  |  9. api-tester -------------------------------------- [GATE]        |  |
|  |     - Cypress API tests 100%                                        |  |
|  |     - Dual auth verificado                                          |  |
|  |     - Status codes correctos                                        |  |
|  +=====================================================================+  |
|                                  |                                        |
|  +===============================v=====================================+  |
|  |  BLOQUE 4: BLOCKS (condicional)                                     |  |
|  +=====================================================================+  |
|  |  10. block-developer (si PM decision "Requires Blocks" = Yes)       |  |
|  |      - Crear/modificar bloques page builder                         |  |
|  |      - Ejecutar build-registry.mjs                                  |  |
|  +=====================================================================+  |
|                                  |                                        |
|  +===============================v=====================================+  |
|  |  BLOQUE 5: FRONTEND                                                 |  |
|  +=====================================================================+  |
|  |  11. frontend-developer                                             |  |
|  |  12. frontend-validator ----------------------------- [GATE]        |  |
|  |      - data-cy en todos los componentes                             |  |
|  |      - Traducciones completas (EN + ES)                             |  |
|  |      - No hardcoded strings                                         |  |
|  |  13. functional-validator --------------------------- [GATE]        |  |
|  |      - progress.md actualizado                                      |  |
|  |      - AC vs implementacion verificado                              |  |
|  |      - Playwright spot-checks                                       |  |
|  +=====================================================================+  |
|                                  |                                        |
|  +===============================v=====================================+  |
|  |  BLOQUE 6: QA                                                       |  |
|  +=====================================================================+  |
|  |  14. qa-manual -------------------------------------- [GATE + RETRY]|  |
|  |      *** RETRY LOGIC (max 3) ***                                    |  |
|  |      Si error API -> backend-developer -> retry                     |  |
|  |      Si error UI -> frontend-developer -> retry                     |  |
|  |  15. qa-automation ---------------------------------- [GATE]        |  |
|  |      - Cypress UAT tests 90%+ (100% preferred)                      |  |
|  |      - POMs actualizados                                            |  |
|  |  15.5. bdd-docs-writer ------------------------------ [NEW v4.2]    |  |
|  |      - Genera .bdd.md desde tests Cypress                           |  |
|  |      - Gherkin bilingue (EN + ES)                                   |  |
|  +=====================================================================+  |
|                                  |                                        |
|  +===============================v=====================================+  |
|  |  BLOQUE 7: FINALIZATION                                             |  |
|  +=====================================================================+  |
|  |  16. code-reviewer                                                  |  |
|  |  17. unit-test-writer                                               |  |
|  |  18. documentation-writer (OPCIONAL)                                |  |
|  |  19. demo-video-generator (OPCIONAL) -> /doc:demo-feature           |  |
|  +=====================================================================+  |
|                                  |                                        |
|                                  v                                        |
|                        HUMAN APPROVAL & MERGE                             |
|                                                                           |
+---------------------------------------------------------------------------+
```

---

## PM Decisions (OBLIGATORIO en v4.0)

El Product Manager DEBE hacer 4 preguntas obligatorias al inicio de cada tarea.

### AC Classification (OBLIGATORIO)

Cada Acceptance Criteria en `requirements.md` DEBE ser clasificado con uno de estos tags:

| Tag | Descripción | Verificado por |
|-----|-------------|----------------|
| `[AUTO]` | Puede ser verificado con tests automatizados (Cypress API/UAT) | qa-automation (Phase 15) |
| `[MANUAL]` | Requiere verificación manual (visual, UX, navegación) | qa-manual (Phase 14) |
| `[REVIEW]` | Requiere revisión humana (calidad de código, docs) | code-reviewer (Phase 16) |

**Ejemplo en requirements.md:**
```markdown
## Acceptance Criteria (CLASIFICADOS)

### Functional Criteria
- [AUTO] User can create a product with valid data
- [AUTO] System returns 400 for invalid input
- [AUTO] User can edit existing product

### Manual Verification
- [MANUAL] Form layout matches design mockup
- [MANUAL] Loading states display correctly
- [MANUAL] Navigation flow is intuitive

### Review Items
- [REVIEW] Code follows project conventions
- [REVIEW] API documentation is complete
```

**Impacto:**
- qa-automation genera AC Coverage Report mapeando tests a [AUTO] criteria
- qa-manual verifica [MANUAL] criteria durante navegación
- code-reviewer revisa [REVIEW] criteria durante review

---

### 1. Tipo de Desarrollo (Dev Type)

```typescript
await AskUserQuestion({
  questions: [{
    header: "Dev Type",
    question: "Que tipo de desarrollo es esta tarea?",
    options: [
      { label: "Feature", description: "Feature en theme existente (default)" },
      { label: "New Theme", description: "Crear un nuevo theme desde cero" },
      { label: "New Plugin", description: "Crear un plugin reutilizable" },
      { label: "Plugin + Theme", description: "Crear plugin Y nuevo theme para testear" },
      { label: "Core Change", description: "Modificacion al core del framework (requiere scope core: true)" }
    ],
    multiSelect: false
  }]
})
```

**Impacto:**
- `Feature` -> Fases 3, 4, 3b, 4b se SALTAN
- `New Theme` -> Fases 3b, 4b se EJECUTAN (plugin phases skipped)
- `New Plugin` -> Fases 3, 4 se EJECUTAN (theme phases skipped)
- `Plugin + Theme` -> TODAS las fases 3, 4, 3b, 4b se EJECUTAN
- `Core Change` -> Fases 3, 4, 3b, 4b se SALTAN (scope.core = true automaticamente)

### 2. Politica de Base de Datos

```typescript
await AskUserQuestion({
  questions: [{
    header: "DB Policy",
    question: "Cual es la politica de base de datos?",
    options: [
      { label: "Reset permitido", description: "Desarrollo inicial, puedo borrar datos" },
      { label: "Migrations incrementales", description: "Produccion/datos existentes" }
    ],
    multiSelect: false
  }]
})
```

**Impacto:**
- `Reset permitido` -> db-validator ejecuta DROP + migrate
- `Migrations incrementales` -> db-validator solo ejecuta migrate

### 3. Requiere Bloques

```typescript
await AskUserQuestion({
  questions: [{
    header: "Blocks",
    question: "Esta feature requiere crear o modificar bloques del page builder?",
    options: [
      { label: "No", description: "No se necesitan bloques" },
      { label: "Si", description: "Crear o modificar bloques" }
    ],
    multiSelect: false
  }]
})
```

**Impacto:**
- `No` -> Fase 10 se SALTA
- `Si` -> Fase 10 se EJECUTA con block-developer

### 4. Configuracion de Plugin (si Dev Type = New Plugin o Plugin + Theme)

```typescript
// Solo si Dev Type incluye plugin
if (devType === 'New Plugin' || devType === 'Plugin + Theme') {
  await AskUserQuestion({
    questions: [
      {
        header: "Complexity",
        question: "Cual es la complejidad del plugin?",
        options: [
          { label: "Utility", description: "Solo funciones helper, sin UI" },
          { label: "Service (Recomendado)", description: "API + componentes + hooks" },
          { label: "Full-featured", description: "Con entidades propias + migraciones + UI" }
        ],
        multiSelect: false
      },
      {
        header: "Entities",
        question: "El plugin tendra entidades propias (tablas en BD)?",
        options: [
          { label: "No", description: "Plugin sin base de datos propia" },
          { label: "Si", description: "Plugin con entidades y migraciones propias" }
        ],
        multiSelect: false
      }
    ]
  })
}
```

**Impacto de Complexity:**
- `Utility` -> Plugin solo con lib/core.ts, sin UI
- `Service` -> Plugin con API + componentes + hooks
- `Full-featured` -> Plugin con entidades propias en BD

**Test Theme:**
- Todos los plugins usan `plugin-sandbox` theme para testing
- El plugin se registra automaticamente en plugin-sandbox

---

## Plugin Workflow

### Nuevo Sistema de Plugins

El workflow v4.0 introduce un sistema completo para desarrollo de plugins:

**Componentes:**
1. **Plugin Preset** (`core/presets/plugin/`) - Template con estructura completa
2. **Create Script** (`pnpm create:plugin`) - Scaffolding automatizado
3. **Plugin Sandbox** (`contents/themes/plugin-sandbox/`) - Theme dedicado para testing
4. **Plugin Creator Agent** (`plugin-creator`) - Fase 3 condicional
5. **Plugin Validator Agent** (`plugin-validator`) - Gate de validacion

**Creacion de Plugins:**

```bash
# Crear plugin desde preset
pnpm create:plugin my-plugin \
  --description "Plugin description" \
  --complexity service

# Estructura generada:
contents/plugins/my-plugin/
├── plugin.config.ts      # Configuracion con lifecycle hooks
├── lib/core.ts           # Logica principal
├── lib/types.ts          # TypeScript types
├── api/example/route.ts  # API endpoint ejemplo
├── components/           # Componentes React
├── hooks/                # Custom hooks
├── messages/             # Traducciones
└── tests/                # Unit tests
```

**Testing de Plugins:**

```bash
# Iniciar dev server con plugin-sandbox
NEXT_PUBLIC_ACTIVE_THEME=plugin-sandbox pnpm dev

# Build para validar integracion
NEXT_PUBLIC_ACTIVE_THEME=plugin-sandbox pnpm build
```

---

## Las 19 Fases del Workflow

### BLOQUE 1: PLANNING

#### Phase 1: Product Manager
**Agente:** `product-manager`
**Responsabilidades:**
- Recolectar requirements con el usuario
- Hacer las 3 preguntas obligatorias (theme, DB, blocks)
- Crear session folder con estructura completa
- Crear `requirements.md` con decisiones documentadas
- Crear `clickup_task.md` (opcional)
- Inicializar `context.md`

#### Phase 2: Architecture Supervisor
**Agente:** `architecture-supervisor`
**Responsabilidades:**
- Leer requirements.md y clickup_task.md
- Revisar pendings.md de versiones anteriores
- Crear plan tecnico (`plan.md`)
- Crear `progress.md` con template de 19 fases
- Inicializar `tests.md` y `pendings.md`
- Actualizar `context.md`

#### Refinamiento Pre-Ejecucion (Opcional)

Antes de ejecutar `/task:execute`, se puede refinar la sesion usando `/task:refine`:

```
/task:refine .claude/sessions/YYYY-MM-DD-feature-v1
Cambios solicitados: [descripcion de ajustes]
```

**Cuando usar `/task:refine`:**
- Ajustar requirements antes de comenzar desarrollo
- Cambiar decisiones arquitectonicas del plan
- Agregar/remover Acceptance Criteria
- Modificar schema de base de datos planificado

**Nota:** Este comando es solo para sesiones en fase de planning (desarrollo NO iniciado).
Para sesiones donde el desarrollo ya comenzo, usar `/task:scope-change`.

---

### BLOQUE 2: FOUNDATION

#### Phase 3: Theme Creator [CONDICIONAL]
**Agente:** `theme-creator`
**Condicion:** Solo si PM Decision = "Nuevo theme"
**Estado:** SKIP si theme existente

**Responsabilidades:**
- Ejecutar `pnpm create:theme {nombre}`
- Configurar `theme.config.ts`
- Configurar `app.config.ts` (Team Mode, features)
- Configurar `dashboard.config.ts`
- Configurar `permissions.config.ts`
- Ejecutar `node core/scripts/build/registry.mjs`

#### Phase 4: Theme Validator [GATE] [CONDICIONAL]
**Agente:** `theme-validator`
**Condicion:** Solo si Phase 3 ejecuto
**Tipo:** GATE - BLOQUEA si falla

**Gate Conditions:**
- [ ] `pnpm build` pasa sin errores
- [ ] `theme.config.ts` existe y es valido
- [ ] `app.config.ts` existe y es valido
- [ ] `dashboard.config.ts` existe y es valido
- [ ] `permissions.config.ts` existe y es valido
- [ ] Team Mode configurado (si enabled)
- [ ] Theme aparece en THEME_REGISTRY

**Si falla:** Llama a `theme-creator` para fix

#### Phase 5: DB Developer
**Agente:** `db-developer`
**Responsabilidades:**
- Crear migrations con campos **camelCase** (NO snake_case)
- Crear sample data abundante (20+ registros por entidad)
- **CRITICO:** Crear test users con hash estandar:
  ```
  3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866
  ```
  (password: Test1234)
- Crear usuarios por rol: owner, admin, member, guest
- Configurar `devKeyring` en `app.config.ts`

#### Phase 6: DB Validator [GATE]
**Agente:** `db-validator`
**Tipo:** GATE - BLOQUEA si falla

**Gate Conditions:**
- [ ] Migrations ejecutan exitosamente
- [ ] Todas las tablas existen (db:verify)
- [ ] Sample data existe (20+ por entidad)
- [ ] Test users existen con hash correcto
- [ ] Team membership configurado (si Team Mode)
- [ ] Foreign keys validos (JOINs funcionan)
- [ ] devKeyring configurado

**Si falla:** Llama a `db-developer` para fix

---

### BLOQUE 3: BACKEND (TDD)

#### Phase 7: Backend Developer
**Agente:** `backend-developer`
**Enfoque:** TDD (Test-Driven Development)

**Responsabilidades:**
1. **Tests PRIMERO:**
   - Crear `__tests__/api/{entity}.test.ts`
   - Tests para POST (201, 400, 401)
   - Tests para GET (200, 401, 404)
   - Tests para PATCH (200, 400, 401, 404)
   - Tests para DELETE (200, 401, 404)

2. **Implementacion:**
   - Crear route handler con dual auth
   - Crear Zod schemas
   - Implementar CRUD handlers
   - Verificar todos los tests pasan

#### Phase 8: Backend Validator [GATE]
**Agente:** `backend-validator`
**Tipo:** GATE - BLOQUEA si falla

**Gate Conditions:**
- [ ] `pnpm test -- --testPathPattern=api` pasa
- [ ] `pnpm build` exitoso
- [ ] `tsc --noEmit` sin errores
- [ ] `pnpm lint` pasa
- [ ] Dual auth verificado en todas las rutas

**Si falla:** Llama a `backend-developer` para fix

#### Phase 9: API Tester [GATE]
**Agente:** `api-tester`
**Tipo:** GATE - BLOQUEA frontend si falla

**Gate Conditions:**
- [ ] Cypress API tests pasan (100%)
- [ ] Status codes testeados (200, 201, 400, 401, 404)
- [ ] Dual auth testeado (session + API key)
- [ ] Pagination testeado
- [ ] Resultados documentados en `tests.md`

**Retry Logic (v4.0):**
```typescript
const MAX_RETRIES = 3

for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
  const result = await runAPITests()

  if (result.allPassed) break

  // Classify failures and call backend-developer
  for (const bug of result.apiBugs) {
    await launchAgent('backend-developer', {
      task: `[API-TESTER FIX] Fix API bug in ${bug.endpoint}`,
      context: { endpoint, method, expectedStatus, actualStatus, errorMessage }
    })
  }
}
```

**Si 3 retries fallan:** GATE_FAILED, requiere intervención manual

---

### BLOQUE 4: BLOCKS [CONDICIONAL]

#### Phase 10: Block Developer [CONDICIONAL]
**Agente:** `block-developer`
**Condicion:** Solo si PM Decision "Requires Blocks" = Yes
**Estado:** SKIP si no requiere blocks

**Responsabilidades:**
- Determinar theme activo
- Descubrir blocks existentes para patrones
- Crear archivos de block:
  - `config.ts`
  - `schema.ts` (extends baseBlockSchema)
  - `fields.ts`
  - `component.tsx` (con data-cy)
  - `index.ts`
- Ejecutar `node core/scripts/build/registry.mjs`
- Verificar block en BLOCK_REGISTRY
- Probar block en page builder

---

### BLOQUE 5: FRONTEND

#### Phase 11: Frontend Developer
**Agente:** `frontend-developer`

**Responsabilidades:**
- Crear componentes con shadcn/ui
- Implementar state con TanStack Query
- Agregar traducciones (EN + ES)
- Agregar data-cy attributes
- Implementar loading/error states
- Usar CSS variables (no hardcoded colors)
- Verificar `pnpm build` exitoso

#### Phase 12: Frontend Validator [GATE]
**Agente:** `frontend-validator`
**Tipo:** GATE - BLOQUEA si falla

**Gate Conditions:**
- [ ] TODOS los componentes tienen data-cy
- [ ] Nomenclatura data-cy correcta: `{entity}-{component}-{detail}`
- [ ] NO hay strings hardcodeados
- [ ] Traducciones existen en EN y ES
- [ ] Traducciones en namespace correcto
- [ ] NO errores de next-intl
- [ ] Selectores documentados en `tests.md`
- [ ] **NEW (v4.1):** @ui-selectors tests creados (si requiresNewSelectors = yes)
- [ ] **NEW (v4.1):** @ui-selectors tests pasan (sub-gate interno)

**Si falla:** Llama a `frontend-developer` para fix

**NEW: @ui-selectors Sub-Gate (v4.1):**
Si `requiresNewSelectors = yes` en requirements.md:
1. frontend-validator crea tests @ui-selectors
2. Ejecuta `pnpm cy:run --env grepTags="@ui-selectors"`
3. Si FAIL -> fix selectores -> retry (max 3)
4. Si PASS -> documenta en tests.md y continua

#### Phase 13: Functional Validator [GATE]
**Agente:** `functional-validator`
**Tipo:** GATE - BLOQUEA QA si falla

**Gate Conditions:**
- [ ] progress.md actualizado por developers
- [ ] Cada AC de clickup_task.md verificado en codigo
- [ ] Playwright spot-checks pasan
- [ ] No gaps mayores entre plan e implementacion

**Si falla:** Reporta en context.md, llama developer apropiado

---

### BLOQUE 6: QA

#### Phase 14: QA Manual [GATE + RETRY]
**Agente:** `qa-manual`
**Tipo:** GATE con RETRY LOGIC (max 3 intentos)

**Gate Conditions:**
- [ ] Dev server inicia sin errores
- [ ] Todas las pantallas dashboard cargan
- [ ] Todas las paginas frontend cargan
- [ ] NO console errors
- [ ] NO server errors
- [ ] UI renderiza correctamente

**Retry Logic:**
```typescript
const MAX_RETRIES = 3

for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
  const result = await performQACheck()

  if (result.allPassed) break

  for (const error of result.errors) {
    if (error.type === 'api_error' || error.type === 'server_error') {
      await launchAgent('backend-developer', { task: `Fix: ${error.message}` })
    } else {
      await launchAgent('frontend-developer', { task: `Fix: ${error.message}` })
    }
  }
}
```

**Si 3 retries fallan:** Documenta en pendings.md, BLOQUEA qa-automation

#### Phase 15: QA Automation [GATE]
**Agente:** `qa-automation`
**Tipo:** GATE - BLOQUEA finalization si falla

**Gate Conditions:**
- [ ] Lee selectores de tests.md
- [ ] Hereda contexto de qa-manual (errores encontrados/corregidos)
- [ ] **REMOVED (v4.1):** @ui-selectors (ahora en frontend-validator Phase 12)
- [ ] **NEW (v4.1):** Test Plan documentado en tests.md
- [ ] **NEW (v4.1):** Batch execution strategy aplicada (lotes de 5)
- [ ] POMs creados/actualizados (reutiliza existentes)
- [ ] UAT tests creados para [AUTO] ACs
- [ ] Tests ejecutados con Batch-Based Smart Retry Strategy
- [ ] **UPDATED (v4.1):** Pass rate >= 90% (100% preferido)
- [ ] AC Coverage Report generado en tests.md
- [ ] Tags temporales removidos (@in-develop, @scope-*)

**Pass Rate Thresholds (NEW v4.1):**
| Pass Rate | Status | Action |
|-----------|--------|--------|
| 100% | GATE_PASSED | Continuar normalmente |
| 90-99% | GATE_PASSED_WITH_WARNINGS | Continuar, documentar fallos en pendings.md |
| <90% | GATE_FAILED | Retry o escalar |

**Batch Execution (NEW v4.1):**
- Tests se procesan en lotes de 5
- Cada lote se itera con @in-develop hasta pasar
- Final run con @scope-{session} para verificar todo

**Tags Temporales (NO COMMITEAR):**
- `@in-develop` - Tests siendo arreglados activamente
- `@scope-{session}` - Tests del scope de la sesion actual

**IMPORTANTE:** code-reviewer (Phase 16) verifica que NO queden tags temporales.

#### Phase 15.5: BDD Docs Writer [NEW v4.2]
**Agente:** `bdd-docs-writer`
**Tipo:** Documentacion (no es GATE)
**Posicion:** Despues de qa-automation, antes de code-reviewer

**Responsabilidades:**
- Parsear archivos de tests Cypress (.cy.ts)
- Detectar locales del theme desde app.config.ts
- Generar escenarios Gherkin bilingues (EN + ES)
- Crear archivos .bdd.md junto a los .cy.ts
- Seguir convencion de Test IDs: `FEATURE-AREA-NNN`
- Actualizar tests.md con seccion "BDD Documentation"

**Formato de Salida (.bdd.md):**
```markdown
---
feature: Feature Name
priority: high | medium | low
tags: [tag1, tag2]
grepTags: [uat, smoke]
coverage: N
---

# Feature Name

## @test FEATURE-AREA-001: Test Title

### Metadata
- **Priority:** High
- **Type:** E2E
- **Tags:** create, product

```gherkin:en
Scenario: Create a new product

Given I am logged in as admin
When I submit the product form with valid data
Then the product should be created successfully
```

```gherkin:es
Scenario: Crear un nuevo producto

Given estoy logueado como admin
When envio el formulario de producto con datos validos
Then el producto deberia crearse exitosamente
```
```

**Trigger:**
- Automatico: Despues de que qa-automation complete Phase 15
- Manual: `/bdd:write [session-path | test-file]`

**AC Coverage Report (informativo, no bloquea):**
```markdown
## AC Coverage Report
| AC ID | Description | Test Coverage | Status |
|-------|-------------|---------------|--------|
| AC-001 [AUTO] | Create product | UAT-001, API-001 | OK |
| AC-002 [MANUAL] | UI design | - | qa-manual OK |
| AC-003 [REVIEW] | Code quality | - | code-reviewer |
```

---

### BLOQUE 7: FINALIZATION

#### Phase 16: Code Reviewer
**Agente:** `code-reviewer`

**Responsabilidades:**
- Checkout feature branch
- **Layer 0:** Verificar session scope compliance
- **Layer 0.5:** Verificar NO queden tags temporales (`@in-develop`, `@scope-*`)
- **Layer 1:** Verificar cumplimiento de .rules/
- **Layer 2:** Analisis de calidad de código
- **Layer 3:** Analisis de seguridad
- **Layer 4:** Analisis de performance
- Escribir review EN ESPAÑOL
- Publicar en ClickUp (si enabled)

**Layer 0.5 - Verificación Tags Temporales:**
```typescript
// BLOQUEA si encuentra tags temporales no removidos
const remainingTags = await Grep({
  pattern: '@in-develop|@scope-',
  path: 'contents/themes/',
  glob: '*.cy.ts'
})

if (remainingTags.length > 0) {
  throw new Error('TEMPORARY_TAGS_NOT_CLEANED')
}
```

#### Phase 17: Unit Test Writer
**Agente:** `unit-test-writer`

**Responsabilidades:**
- Analizar codigo implementado
- Crear tests de validation schemas
- Crear tests de business logic
- Crear tests de utility functions
- Crear tests de hooks
- Ejecutar `pnpm test`
- Verificar 80%+ coverage

#### Phase 18: Documentation Writer [OPCIONAL]
**Agente:** `documentation-writer`
**Estado:** SKIP por defecto

**Responsabilidades:**
- Crear documentacion de feature
- Documentar API endpoints
- Agregar ejemplos de uso
- Actualizar .rules/ si necesario

#### Phase 19: Demo Video Generator [OPCIONAL]
**Comando:** `/doc:demo-feature`
**Estado:** SKIP por defecto

**Responsabilidades:**
- Crear script de demo con Cypress
- Grabar video de demo
- Agregar narracion/captions
- Exportar a formato entregable

---

## Gates Status Table

| Gate | Phase | Valida | Si Falla |
|------|-------|--------|----------|
| theme-validator | 4 | Build, configs, Team Mode | -> theme-creator |
| db-validator | 6 | Migrations, sample data, test users | -> db-developer |
| backend-validator | 8 | Jest, build, tsc, lint, dual auth | -> backend-developer |
| api-tester | 9 | Cypress API 100%, status codes | -> backend-developer |
| frontend-validator | 12 | data-cy, traducciones, **@ui-selectors (NEW v4.1)** | -> frontend-developer |
| functional-validator | 13 | progress.md, AC vs codigo | -> dev apropiado |
| qa-manual | 14 | Navegacion, errores, UI | -> RETRY (max 3) |
| qa-automation | 15 | **Batch execution**, 90%+ pass rate (NEW v4.1) | -> fix tests / devs |

### @ui-selectors Sub-Gate (Phase 12 - MOVED in v4.1)

**Actualizado en v4.1:** @ui-selectors ahora es responsabilidad de frontend-validator (Phase 12), no qa-automation.

**Razon del cambio:**
- Detecta problemas de selectores mas temprano (Phase 12 vs Phase 15)
- frontend-validator puede corregir selectores directamente
- Reduce back-and-forth entre qa-automation y frontend-developer

```bash
# Comando de ejecucion (ejecutado por frontend-validator)
pnpm cy:run --env grepTags="@ui-selectors"
```

| Condicion | Accion |
|-----------|--------|
| `requiresNewSelectors = yes` | frontend-validator crea y ejecuta @ui-selectors tests |
| `requiresNewSelectors = no` | frontend-validator salta @ui-selectors |
| @ui-selectors PASS | frontend-validator documenta en tests.md, continua |
| @ui-selectors FAIL | frontend-validator fix selectores, retry (max 3) |

### Batch Execution Strategy (NEW v4.1)

qa-automation procesa tests en lotes para mayor eficiencia:

```
+-------------------------------------------------------------------+
|  BATCH EXECUTION FLOW                                             |
+-------------------------------------------------------------------+
|                                                                   |
|  1. PLAN: Documentar todos los tests en tests.md                  |
|  2. BATCH: Agrupar en lotes de 5 (configurable)                   |
|  3. FOR EACH BATCH:                                               |
|     a. TAG: Agregar @in-develop + @scope-{session}                |
|     b. RUN: pnpm cy:run --env grepTags="@in-develop"              |
|     c. FIX: Corregir fallos (test issue o llamar developer)       |
|     d. RETRY: Hasta que el lote pase                              |
|     e. UNTAG: Quitar @in-develop (mantener @scope)                |
|     f. UPDATE: Actualizar status del lote en tests.md             |
|  4. FINAL: Ejecutar todos con @scope-{session}                    |
|  5. EVALUATE: Calcular pass rate                                  |
|  6. CLEANUP: Remover TODOS los tags temporales                    |
|                                                                   |
+-------------------------------------------------------------------+
```

**Configuracion:**
| Setting | Default | Descripcion |
|---------|---------|-------------|
| BATCH_SIZE | 5 | Tests por lote |
| SUCCESS_THRESHOLD | 0.9 | Pass rate minimo (90%) |
| MAX_BATCH_RETRIES | 3 | Reintentos maximos por lote |

---

## ClickUp Interaction Matrix (v4.0)

| Agente | Crear Tarea | Actualizar Estado | Crear Bugs | Comentarios |
|--------|-------------|-------------------|------------|-------------|
| **product-manager** | OPCIONAL | - | - | OPCIONAL |
| **architecture-supervisor** | - | - | - | - |
| **theme-creator** | - | - | - | - |
| **theme-validator** | - | - | - | - |
| **db-developer** | - | - | - | - |
| **db-validator** | - | - | - | - |
| **backend-developer** | - | - | - | - |
| **backend-validator** | - | - | - | - |
| **api-tester** | - | - | - | - |
| **block-developer** | - | - | - | - |
| **frontend-developer** | - | - | - | - |
| **frontend-validator** | - | - | - | - |
| **functional-validator** | - | - | - | - |
| **qa-manual** | - | - | OPCIONAL | OPCIONAL |
| **qa-automation** | - | - | OPCIONAL | OPCIONAL |
| **qa-tester** | - | SI | SI | SI |
| **code-reviewer** | - | - | - | OPCIONAL |
| **unit-test-writer** | - | - | - | - |
| **Humano** | SI | SI | SI | SI |

---

## Comandos Disponibles (v4.0)

### Workflow Principal

| Comando | Descripcion |
|---------|-------------|
| `/task:requirements` | [Step 1] Genera requerimientos interactivo |
| `/task:plan` | [Step 2] PM + Architect workflow |
| `/task:refine` | [Pre-Exec] Refinar sesion antes de comenzar desarrollo |
| `/task:execute` | [Step 3] Ejecuta 19 fases completas |
| `/task:scope-change` | Maneja cambios de alcance durante desarrollo |
| `/task:pending` | Documenta pendientes |

### Base de Datos

| Comando | Descripcion |
|---------|-------------|
| `/db:entity` | [Step 1] Genera migration para entidad |
| `/db:sample` | [Step 2] Genera sample data |
| `/db:fix` | Fix migration errors |

### Testing

| Comando | Descripcion |
|---------|-------------|
| `/test:write` | [Step 1] Escribe Cypress tests |
| `/test:run` | [Step 2] Ejecuta suite de tests |
| `/test:fix` | Fix failing tests |
| `/bdd:write` | [NEW v4.2] Genera documentacion BDD (.bdd.md) desde tests Cypress |

### Bloques

| Comando | Descripcion |
|---------|-------------|
| `/block:create` | Crea nuevo bloque page builder |
| `/block:update` | Modifica bloque existente |
| `/block:list` | Lista bloques disponibles |
| `/block:docs` | Documenta un bloque |
| `/block:validate` | Valida estructura de bloque |

### Fixes y Otros

| Comando | Descripcion |
|---------|-------------|
| `/fix:build` | Fix build errors |
| `/fix:bug` | Fix bug con TDD |
| `/doc:feature` | Documenta feature |
| `/doc:demo-feature` | Genera video demo |
| `/release:version` | Crea release |

---

## Test Users Estandar

**Password:** Test1234

**Hash:**
```
3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866
```

**Usuarios por rol:**
| Email | Rol | Descripcion |
|-------|-----|-------------|
| owner@test.com | owner | Propietario del team |
| admin@test.com | admin | Administrador |
| member@test.com | member | Miembro regular |
| guest@test.com | guest | Invitado con acceso limitado |
| superadmin@nextspark.dev | superadmin | Usuario de tests E2E |

---

## Checklist de Calidad (Antes de "done")

- [ ] Todos los Criterios de Aceptacion cumplidos
- [ ] progress.md con todas las fases [x] completadas
- [ ] Build pasa sin errores: `pnpm build`
- [ ] 8 gates pasados
- [ ] qa-manual: navegacion sin errores
- [ ] qa-automation: 90%+ tests passing (100% preferred)
- [ ] Code review aprobado
- [ ] Unit tests con 80%+ coverage
- [ ] Feature branch merged a main
- [ ] context.md con entradas de todos los agentes

---

## Principios del Workflow v4.0

### 1. Fail Fast
Detectar errores lo mas temprano posible en el ciclo de desarrollo mediante gates de validacion.

### 2. TDD para Backend
Escribir tests ANTES de la implementacion asegura cobertura completa y mejor diseno de API.

### 3. Gates como Puntos de Control
Cada gate es un punto donde el workflow PUEDE detenerse para corregir problemas antes de continuar.

### 4. Retry Logic con Fix Automatico
En lugar de solo reportar errores, qa-manual llama a los developers apropiados para corregir y reintentar.

### 5. Fases Condicionales
No todas las fases aplican a todas las tareas. PM Decisions determinan que fases ejecutar.

### 6. Sample Data Obligatoria
El desarrollo sin datos de prueba produce bugs no detectados. Sample data abundante es mandatorio.

### 7. Demo Video Opcional
Para features de usuario final, se puede generar un video de demo automatizado.

### 8. Session Scope Enforcement
Cada sesion define un scope que controla que areas del codigo los agentes pueden modificar.

### 9. Data-Only Registry Pattern (CRITICAL)
Los registries son archivos AUTO-GENERADOS que SOLO deben contener datos estaticos. Toda logica de negocio debe estar en Services.

### 10. Service Layer for Business Logic
Toda logica de negocio, queries, y transformaciones deben estar encapsuladas en Services, NO en registries ni archivos auto-generados.

---

## Data-Only Registry Pattern (CRITICAL)

**PRINCIPIO FUNDAMENTAL:** Los archivos en `core/lib/registries/` son AUTO-GENERADOS por `core/scripts/build/registry.mjs`. Estos archivos SOLO deben contener:
- Constantes (objetos de configuracion)
- Tipos TypeScript derivados de los datos
- Metadata del registro

**PROHIBIDO en Registries:**
- Funciones con logica de negocio
- Queries a base de datos
- Transformaciones de datos en runtime
- Cualquier codigo que NO sea declarativo

### Patron Correcto

```typescript
// core/lib/registries/entity-types.ts (AUTO-GENERATED)
// ================================================
// 🤖 AUTO-GENERATED FILE - DO NOT EDIT
// Generated at: 2025-12-27T02:30:06.434Z
// Source: core/scripts/build/registry.mjs
// ================================================

// SOLO datos estaticos y tipos
export type EntityName = 'customers' | 'posts' | 'tasks'

export const SEARCH_TYPE_PRIORITIES: Record<SearchResultType, number> = {
  'customers': 14,
  'posts': 15,
  'tasks': 16
} as const

export const ENTITY_METADATA = {
  totalEntities: 3,
  entityNames: ['customers', 'posts', 'tasks'],
  generatedAt: '2025-12-27T02:30:06.434Z',
  source: 'build-registry.mjs'
} as const

// Comentario al final indicando donde estan las funciones:
// ==================== Service Layer ====================
// Query functions have been moved to: @/core/lib/services/entity-type.service
// Import from there instead:
// import { EntityTypeService } from '@/core/lib/services/entity-type.service'
```

```typescript
// core/lib/services/entity-type.service.ts (SERVICE LAYER)
// ================================================
// Este archivo contiene TODA la logica de negocio
// ================================================

import { SEARCH_TYPE_PRIORITIES, ENTITY_METADATA, type EntityName } from '@/core/lib/registries/entity-types'

export class EntityTypeService {
  // Logica de negocio va AQUI, no en el registry
  static isEntityType(type: SearchResultType): type is EntityName {
    return !SYSTEM_TYPES.includes(type as SystemSearchType)
  }

  static getAllNames(): EntityName[] {
    return [...ENTITY_METADATA.entityNames] as EntityName[]
  }

  static getPriority(type: SearchResultType): number {
    return SEARCH_TYPE_PRIORITIES[type] ?? 0
  }
}
```

### Patron PROHIBIDO (Violacion)

```typescript
// ❌ PROHIBIDO - Funciones en archivos auto-generados
// core/lib/registries/entity-types.ts
export function isEntityType(type: string): boolean {
  // Logica de negocio NO debe estar aqui
  return !['task', 'page', 'setting'].includes(type)
}

export function getSearchTypePriority(type: string): number {
  // Queries NO deben estar aqui
  return SEARCH_TYPE_PRIORITIES[type] ?? 0
}
```

### Por Que Este Patron Es Critico

1. **Regeneracion Segura**: Al correr `node core/scripts/build/registry.mjs`, el archivo se regenera completamente. Si hay funciones, se pierden.

2. **Separacion de Responsabilidades**: Registries = Data, Services = Logic

3. **Testing**: Services son facilmente testeables. Registries son solo datos.

4. **Mantenibilidad**: Cambios en logica no requieren modificar scripts de generacion.

5. **Performance**: Registries cargan data pura en build-time. Services ejecutan en runtime.

---

## Service Layer Architecture

**Ubicacion:** `core/lib/services/`

**Convencion de nombres:** `{feature}.service.ts`

### Servicios Existentes (Referencia)

| Servicio | Archivo | Proposito |
|----------|---------|-----------|
| **UserService** | `user.service.ts` | User management, profiles, metadata |
| **MetaService** | `meta.service.ts` | Flexible metadata storage |
| **PlanService** | `plan.service.ts` | Plan queries, registry helpers |
| **SubscriptionService** | `subscription.service.ts` | Subscriptions, features, quotas |
| **UsageService** | `usage.service.ts` | Usage tracking, quotas, trends |
| **InvoiceService** | `invoice.service.ts` | Invoice management, revenue |
| **TeamService** | `team.service.ts` | Team CRUD, slug management |
| **TeamMemberService** | `team-member.service.ts` | Membership, roles, permissions |
| **PermissionService** | `permission.service.ts` | Permission checks |
| **ThemeService** | `theme.service.ts` | Theme configs, entities, routes |
| **EntityTypeService** | `entity-type.service.ts` | Entity type queries |
| **NamespaceService** | `namespace.service.ts` | i18n namespace queries |
| **MiddlewareService** | `middleware.service.ts` | Theme middleware handlers |
| **ScopeService** | `scope.service.ts` | API scopes, restrictions |
| **RouteHandlerService** | `route-handler.service.ts` | Route handlers |
| **BlockService** | `block.service.ts` | Block registry queries |
| **TranslationService** | `translation.service.ts` | Translation registry queries |
| **TemplateService** | `template.service.ts` | Template registry queries |
| **PluginService** | `plugin.service.ts` | Plugin registry queries |

### Patron de Service Layer

```typescript
/**
 * ExampleService - Descripcion del servicio
 *
 * @example
 * import { ExampleService } from '@/core/lib/services'
 * const result = ExampleService.getSomething('id')
 */

import { SOME_REGISTRY } from '@/core/lib/registries/some-registry'

export class ExampleService {
  /**
   * Metodo con documentacion JSDoc
   * @param id - ID del recurso
   * @returns El recurso o null
   */
  static getSomething(id: string): SomeType | null {
    // 1. Validacion de input
    if (!id) throw new Error('ID is required')

    // 2. Logica de negocio
    return SOME_REGISTRY[id] ?? null
  }
}

// Backward compatibility (deprecated)
/** @deprecated Use ExampleService.getSomething() instead */
export const getSomething = ExampleService.getSomething
```

### Cuando Crear un Nuevo Service

1. **Migrando funciones de un registry**: Cuando un registry tiene funciones que deben moverse
2. **Logica de negocio reutilizable**: Cuando multiples partes del codigo necesitan la misma logica
3. **Wrapping de registry**: Cuando necesitas exponer el registry con metodos helper
4. **Data access**: Cuando necesitas queries a base de datos encapsuladas

---

## Gate Validations para Registry/Service Pattern

### backend-validator (Phase 8) - GATE Check

```bash
# Verificar que registries no contienen funciones
grep -rn "export function\|export async function\|export const.*=.*=>" core/lib/registries/*.ts

# Si encuentra algo, GATE FAILS
# Excepciones permitidas: NINGUNA
```

### code-reviewer (Phase 16) - Layer 1 Check

```typescript
// Verificar patron data-only en registries
const violations = await Grep({
  pattern: 'export (async )?function|export const \\w+ = (async )?\\(',
  path: 'core/lib/registries/',
  glob: '*.ts'
})

if (violations.length > 0) {
  throw new Error(`
🚨 DATA-ONLY REGISTRY VIOLATION 🚨

The following registry files contain functions (PROHIBITED):
${violations.map(v => `- ${v.file}:${v.line}: ${v.content}`).join('\n')}

REQUIRED ACTION:
1. Move function logic to corresponding service in core/lib/services/
2. Registry should only export:
   - Constants (data objects)
   - Types derived from data
   - Metadata

Reference: .claude/config/workflow.md > Data-Only Registry Pattern
  `)
}
```

---

## Session Files y Templates

### Ubicacion de Templates

Todos los templates de sesion estan en:
```
.claude/tools/sessions/templates/
├── requirements.md      # Template de requerimientos
├── clickup_task.md      # Template de tarea ClickUp
├── scope.json           # Template de scope (NUEVO)
├── plan.md              # Template de plan tecnico
├── progress.md          # Template de progreso
├── context.md           # Template de coordinacion
├── tests.md             # Template de tests
└── pendings.md          # Template de pendientes
```

### Estructura de Session Folder

Cada feature tiene su propio folder en `.claude/sessions/[session-name]/`:
```
.claude/sessions/YYYY-MM-DD-feature-name-v1/
├── requirements.md      # PM: Requerimientos detallados
├── clickup_task.md      # PM: Business context + ACs
├── scope.json           # PM: Scope de la sesion (NUEVO)
├── plan.md              # AR: Plan tecnico
├── progress.md          # AR: Tracking de progreso
├── context.md           # ALL: Log de coordinacion
├── tests.md             # FV/QA: Selectores y resultados
└── pendings.md          # ALL: Pendientes para futuro
```

### Session Scope System

El scope controla que areas los agentes pueden modificar:

```json
{
  "definedBy": "product-manager",
  "date": "2025-12-15",
  "scope": {
    "core": false,      // true = puede modificar core/, app/, scripts/
    "theme": "default", // string = theme permitido, false = ninguno
    "plugins": false    // array = plugins permitidos, false = ninguno
  },
  "exceptions": []
}
```

**Patrones comunes:**

| Dev Type | Scope |
|----------|-------|
| Feature | `{ core: false, theme: "theme-name", plugins: false }` |
| New Theme | `{ core: false, theme: "new-theme", plugins: false }` |
| New Plugin | `{ core: false, theme: "plugin-sandbox", plugins: ["plugin-name"] }` |
| Core Change | `{ core: true, theme: false, plugins: false }` |

**Ver `.rules/scope.md` para reglas completas de scope enforcement.**

---

**Ultima actualizacion:** 2025-12-30
