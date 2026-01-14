# Workflow Completo de Desarrollo v4.0

Este documento describe el flujo completo de desarrollo desde la creacion de una tarea hasta su aprobacion final, incluyendo todos los agentes involucrados, gates de validacion, y el principio "Fail Fast".

**Version:** 4.0
**Last Updated:** 2025-12-14

---

## Resumen de Cambios v3.1 -> v4.0

| Aspecto | v3.1 | v4.0 |
|---------|------|------|
| Fases | 9 (+ theme condicional) | 19 (con fases condicionales) |
| Gates de validacion | 1 (QA retry) | 8 gates explicitos |
| Agentes | 12 | 18 (+6 nuevos) |
| Decisiones PM | Ninguna especial | 3 obligatorias (theme, DB, blocks) |
| Sample data | Manual/opcional | Obligatoria con test users |
| QA Manual | No existe | Nueva fase con retry logic |
| Demo video | No integrado | Opcional al final |
| TDD Backend | No enforzado | Obligatorio (tests primero) |

---

## Diagrama del Workflow Completo (19 Fases)

```
+---------------------------------------------------------------------------+
|                    WORKFLOW v4.0 - 19 FASES CON GATES                     |
+---------------------------------------------------------------------------+
|                                                                           |
|  +=====================================================================+  |
|  |  BLOQUE 1: PLANNING                                                 |  |
|  +=====================================================================+  |
|  |  1. product-manager: Requirements + Decisiones                      |  |
|  |     - Theme: Nuevo vs Existente                                     |  |
|  |     - DB Policy: Reset vs Incremental                               |  |
|  |     - Blocks: Requiere crear/modificar bloques                      |  |
|  |  2. architecture-supervisor: Plan tecnico con 19 fases              |  |
|  +=====================================================================+  |
|                                  |                                        |
|  +===============================v=====================================+  |
|  |  BLOQUE 2: FOUNDATION (condicional)                                 |  |
|  +=====================================================================+  |
|  |  3. theme-creator (si nuevo theme)                                  |  |
|  |  4. theme-validator --------------------------------- [GATE]        |  |
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
|  |      - Cypress UAT tests 100%                                       |  |
|  |      - POMs actualizados                                            |  |
|  +=====================================================================+  |
|                                  |                                        |
|  +===============================v=====================================+  |
|  |  BLOQUE 7: FINALIZATION                                             |  |
|  +=====================================================================+  |
|  |  16. code-reviewer                                                  |  |
|  |  17. unit-test-writer                                               |  |
|  |  18. documentation-writer (OPCIONAL)                                |  |
|  |  19. demo-video-generator (OPCIONAL) -> /doc-demo-feature           |  |
|  +=====================================================================+  |
|                                  |                                        |
|                                  v                                        |
|                        HUMAN APPROVAL & MERGE                             |
|                                                                           |
+---------------------------------------------------------------------------+
```

### Refinamiento Pre-Ejecucion (Opcional)

Despues del planning (Fases 1-2) y antes de `/task-execute`, se puede refinar la sesion con `/task-refine`:

- Ajustar requirements o plan antes de comenzar desarrollo
- Solo para sesiones en fase de planning (desarrollo NO iniciado)
- Para sesiones en desarrollo, usar `/task-scope-change`

---

## PM Decisions (OBLIGATORIO en v4.0)

El Product Manager DEBE hacer 3 preguntas obligatorias al inicio de cada tarea:

### 1. Tipo de Theme

```typescript
await AskUserQuestion({
  questions: [{
    header: "Theme",
    question: "Cual es la estrategia de theme para esta feature?",
    options: [
      { label: "Theme existente", description: "Usar un theme ya creado" },
      { label: "Nuevo theme", description: "Crear un theme nuevo" }
    ],
    multiSelect: false
  }]
})
```

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

---

## Gates Status Table

| Gate | Phase | Valida | Si Falla |
|------|-------|--------|----------|
| theme-validator | 4 | Build, configs, Team Mode | -> theme-creator |
| db-validator | 6 | Migrations, sample data, test users | -> db-developer |
| backend-validator | 8 | Jest, build, tsc, lint, dual auth | -> backend-developer |
| api-tester | 9 | Cypress API 100%, status codes | -> backend-developer |
| frontend-validator | 12 | data-cy, traducciones, no hardcoded | -> frontend-developer |
| functional-validator | 13 | progress.md, AC vs codigo | -> dev apropiado |
| qa-manual | 14 | Navegacion, errores, UI | -> RETRY (max 3) |
| qa-automation | 15 | Cypress UAT 100%, POMs | -> fix tests o dev |

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
| superadmin@cypress.com | superadmin | Usuario de tests E2E |

---

## Comandos Disponibles (v4.0)

### Workflow Principal

| Comando | Descripcion |
|---------|-------------|
| `/task-requirements` | [Step 1] Genera requerimientos interactivo |
| `/task-plan` | [Step 2] PM + Architect workflow |
| `/task-refine` | [Pre-Exec] Refinar sesion antes de comenzar desarrollo |
| `/task-execute` | [Step 3] Ejecuta 19 fases completas |
| `/task-scope-change` | Maneja cambios de alcance durante desarrollo |
| `/task-pending` | Documenta pendientes |

### Base de Datos

| Comando | Descripcion |
|---------|-------------|
| `/db-entity` | Genera migration para entidad |
| `/db-sample` | Genera sample data |
| `/db-fix` | Fix migration errors |

### Testing

| Comando | Descripcion |
|---------|-------------|
| `/test-write` | Escribe Cypress tests |
| `/test-run` | Ejecuta suite de tests |
| `/test-fix` | Fix failing tests |

### Bloques

| Comando | Descripcion |
|---------|-------------|
| `/block-create` | Crea nuevo bloque page builder |
| `/block-update` | Modifica bloque existente |
| `/block-list` | Lista bloques disponibles |
| `/block-docs` | Documenta un bloque |
| `/block-validate` | Valida estructura de bloque |

### Fixes y Otros

| Comando | Descripcion |
|---------|-------------|
| `/fix-build` | Fix build errors |
| `/fix-bug` | Fix bug con TDD |
| `/doc-feature` | Documenta feature |
| `/doc-demo-feature` | Genera video demo |
| `/release-version` | Crea release |

---

**Ultima actualizacion:** 2025-12-14
