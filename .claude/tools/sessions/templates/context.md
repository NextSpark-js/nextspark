# Contexto y Coordinación: [Feature Name]

**Session:** `.claude/sessions/YYYY-MM-DD-feature-name-v1/`
**Version:** v1
**ClickUp Task:** [TASK_ID or "LOCAL_ONLY"]
**Created:** [YYYY-MM-DD]

---

## **Propósito de Este Archivo**

Este archivo sirve como **nexo de comunicación entre agentes**. Cada agente que complete su trabajo DEBE agregar un mensaje aquí con:

1. **Nombre del agente**
2. **Fecha y hora**
3. **Resumen de trabajo realizado**
4. **Estado** (Completado / Completado con pendientes / Bloqueado)
5. **Notas para el siguiente agente**

---

## **Estados Válidos**

- **✅ Completado:** La tarea se completó exitosamente, siguiente agente puede proceder
- **⚠️ Completado con pendientes:** La tarea se completó pero hay mejoras o acciones pendientes (no bloqueantes)
- **🚫 Bloqueado:** La tarea no pudo completarse, siguiente agente NO puede proceder hasta resolver

---

## **Log de Coordinación**

### [YYYY-MM-DD HH:MM] - product-manager

**Estado:** ✅ Completado

**Trabajo Realizado:**
- Creada tarea en ClickUp (ID: [TASK_ID]) - O modo LOCAL_ONLY si no usa ClickUp
- Definido contexto de negocio y criterios de aceptación
- Creado session folder: `.claude/sessions/YYYY-MM-DD-feature-name-v1/`
- Creados archivos: `requirements.md`, `clickup_task.md`, `context.md`
- Asignado a: [User Name] (ID: [USER_ID])

**Próximo Paso:**
- architecture-supervisor debe leer `requirements.md` y `clickup_task.md` y crear plan técnico detallado

**Notas:**
- Prioridad: [normal/high/urgent/low]
- [Cualquier nota adicional sobre el contexto de negocio]

---

### [YYYY-MM-DD HH:MM] - architecture-supervisor

**Estado:** ✅ Completado

**Trabajo Realizado:**
- Leído contexto de negocio de `requirements.md` y `clickup_task.md`
- Creado plan técnico detallado en `plan.md`
- Creado template de progreso en `progress.md`
- Creado archivo de tests vacío en `tests.md`
- Creado archivo de pendientes vacío en `pendings.md`
- Analizado dependencias y bloqueadores potenciales
- Definido fases: Backend → Frontend → Integration → Validation → QA → Review → Unit Tests

**Decisiones Técnicas:**
- [Decisión técnica importante #1 y razón]
- [Decisión técnica importante #2 y razón]

**Próximo Paso:**
- backend-developer puede comenzar Fase 1 siguiendo `plan.md`
- frontend-developer puede trabajar en paralelo en Fase 2 (si no hay dependencias)

**Notas:**
- Feature branch sugerida: `feature/[feature-name]`
- [Cualquier consideración técnica importante]

---

### [YYYY-MM-DD HH:MM] - backend-developer

**Estado:** ✅ Completado / ⚠️ Completado con pendientes / 🚫 Bloqueado

**Trabajo Realizado:**
- [Lista de ítems completados de la Fase 1 del plan]
- Migración ejecutada: `migrations/YYYYMMDD_feature_name.sql`
- API endpoints implementados: POST, GET, PATCH, DELETE /api/v1/[resource]
- Tests de backend: [X] unit tests, [Y] integration tests
- Build validado: `pnpm build` ✅

**Progreso:**
- Marcado [X] de [Y] ítems en `progress.md`
- Coverage: [X]% (target: 90%+)

**Decisiones Durante Desarrollo:**
- [Si se desvió del plan, explicar por qué]
- [Decisiones de implementación significativas]

**Próximo Paso:**
- frontend-developer puede continuar/comenzar Fase 2
- [O si bloqueado, explicar qué necesita resolverse]

**Notas:**
- [Cualquier nota relevante sobre la implementación]
- [Advertencias o consideraciones para el siguiente agente]

---

### [YYYY-MM-DD HH:MM] - frontend-developer

**Estado:** ✅ Completado / ⚠️ Completado con pendientes / 🚫 Bloqueado

**Trabajo Realizado:**
- [Lista de ítems completados de la Fase 2 del plan]
- Componentes creados: [lista de componentes]
- State management implementado con TanStack Query
- Traducciones agregadas (en + es)
- Tests de frontend: [X] component tests, [Y] E2E tests
- Build validado: `pnpm build` ✅

**Progreso:**
- Marcado [X] de [Y] ítems en `progress.md`
- Coverage: [X]% (target: 80%+)

**Decisiones Durante Desarrollo:**
- [Decisiones de implementación UI/UX]
- [Cambios respecto al plan original]

**Próximo Paso:**
- Fase 3: Integración - validar que backend + frontend funcionan end-to-end
- Luego: frontend-validator para validación de data-cy y traducciones

**Notas:**
- [Notas sobre UX/UI]
- [Consideraciones de accessibility]

---

### [YYYY-MM-DD HH:MM] - backend-developer + frontend-developer

**Estado:** ✅ Completado / ⚠️ Completado con pendientes / 🚫 Bloqueado

**Trabajo Realizado (Integración - Fase 3):**
- Backend + Frontend integrados y funcionando end-to-end
- Auth flow validado (session + API key)
- Error handling validado
- Performance validada (bundle size, queries DB)
- Security validada (XSS, SQL injection, CSRF)
- Build completa sin errores: `pnpm build` ✅

**Progreso:**
- Marcado [X] de [Y] ítems en `progress.md` (Fase 3)

**Issues Resueltas Durante Integración:**
- [Issue #1 encontrado y cómo se resolvió]
- [Issue #2 encontrado y cómo se resolvió]

**Próximo Paso:**
- frontend-validator puede comenzar Fase 4: Frontend Validation
- Validará data-cy selectors, traducciones, y strings hardcodeados

**Notas:**
- Dev server funcionando en `http://localhost:5173`
- [Cualquier nota relevante para validación]

---

### [YYYY-MM-DD HH:MM] - frontend-validator

**Estado:** ✅ Completado / ⚠️ Completado con pendientes / 🚫 Bloqueado

**Trabajo Realizado:**
- Verificado data-cy en TODOS los componentes del feature
- Validada nomenclatura: `{entity}-{component}-{detail}`
- Documentado selectores en `tests.md` para qa-automation
- Verificado NO hay strings hardcodeados
- Validadas traducciones en theme/plugin correcto
- Verificado namespace NO colisiona con core
- Iniciado Playwright y navegado pantallas
- Verificado NO hay errores de next-intl en consola

**Correcciones Realizadas:**
- [Lista de data-cy agregados/corregidos]
- [Lista de traducciones agregadas/corregidas]
- [Lista de strings hardcodeados corregidos]

**Documentación en tests.md:**
- [X] componentes documentados con selectores data-cy
- [X] table de selectores lista para qa-automation

**Próximo Paso:**
- functional-validator puede comenzar Fase 5: Functional Validation
- Verificará coherencia AC vs implementación

**Notas:**
- [Cualquier nota sobre estándares de frontend]
- [Patrones de data-cy utilizados]

---

### [YYYY-MM-DD HH:MM] - functional-validator

**Estado:** ✅ Completado / ⚠️ Completado con pendientes / 🚫 Bloqueado

**Trabajo Realizado:**
- Verificado que progress.md fue actualizado por developers
- Leído cada AC de clickup_task.md
- Inspeccionado código para verificar implementación de cada AC
- Ejecutado spot-checks funcionales con Playwright
- Corregido issues menores directamente

**Validación de Criterios de Aceptación:**
- AC1: ✅/❌ [Descripción breve]
- AC2: ✅/❌ [Descripción breve]
- AC3: ✅/❌ [Descripción breve]

**Correcciones Realizadas:**
- [Lista de issues menores corregidos]

**Issues Mayores (Requieren Developer):**
- [Si hay issues mayores que no se pudieron corregir]

**Próximo Paso:**
- qa-automation puede comenzar Fase 6: QA Automation
- Leerá tests.md para selectores data-cy documentados

**Notas:**
- [Notas sobre coherencia de implementación]
- [Observaciones sobre calidad]

---

### [YYYY-MM-DD HH:MM] - qa-automation

**Estado:** ✅ Completado / ⚠️ Completado con pendientes / 🚫 Bloqueado

**Trabajo Realizado:**
- Leído tests.md para obtener selectores data-cy
- Analizados tests a crear/modificar/eliminar
- Creados API tests con BaseAPIController
- Creados UAT tests con POMs
- Ejecutados tests UNO POR UNO
- Loop fix-retry hasta 100% pass

**Resultados de Tests:**
- **API Tests:** [X] passed, [Y] failed
- **UAT Tests:** [X] passed, [Y] failed
- **Total Coverage:** [X]%

**Tests Creados/Modificados:**
- `cypress/e2e/api/[feature].cy.ts` - [X] tests
- `cypress/e2e/uat/[feature].cy.ts` - [X] tests
- `cypress/support/pom/[Feature]Page.ts` - POM creado/actualizado

**Resultado QA Automation:**
- ✅ **TODOS LOS TESTS PASAN** - 100% pass rate
- ⚠️ **PASÓ CON CORRECCIONES** - Tests corregidos durante ejecución
- 🚫 **FEATURE BROKEN** - Requiere intervención de developer

**Documentación en tests.md:**
- Resultados escritos en sección superior de tests.md
- Coverage documentado
- Issues encontrados y resueltos documentados

**Próximo Paso:**
- [Si OK] code-reviewer puede comenzar Fase 7: Code Review
- [Si feature broken] backend/frontend developer debe corregir

**Notas:**
- [Screenshots de tests si relevante]
- [Notas sobre patrones de testing usados]

---

### [YYYY-MM-DD HH:MM] - code-reviewer

**Estado:** ✅ Completado / ⚠️ Completado con pendientes / 🚫 Bloqueado

**Trabajo Realizado:**
- Leída tarea completa de ClickUp
- Checkout feature branch: `feature/[feature-name]`
- Revisados [X] archivos modificados
- Verificado cumplimiento de .rules/ del proyecto
- Analizada seguridad (dual auth, validación, sanitización)
- Evaluada performance (bundle size, React optimization, DB queries)
- Revisada calidad de código (TypeScript, patrones, tests)

**Resultado Code Review:**
- ✅ **APROBADO** - Listo para merge
- ⚠️ **APROBADO CON SUGERENCIAS OPCIONALES** - Puede hacer merge, sugerencias opcionales
- 🚨 **CAMBIOS REQUERIDOS** - Debe corregir problemas críticos antes de merge

**Problemas Críticos:**
[Si hay problemas críticos, listar. Si no, escribir "Ninguno"]
- **Issue #1:** [Descripción] - Ubicación: `file.ts:line` - [Solución requerida]

**Sugerencias Opcionales:**
- **Sugerencia #1:** [Performance optimization] - Impact: [HIGH/MEDIUM/LOW]
- **Sugerencia #2:** [Best practice] - Impact: [HIGH/MEDIUM/LOW]

**Lo Que Se Hizo Bien:**
- [Observación positiva #1]
- [Observación positiva #2]

**Acción Tomada en ClickUp:**
- Publicado review completo como comentario en ClickUp (EN ESPAÑOL)
- Notificado @[usuario-asignado] con resumen y próximos pasos
- Tarea permanece en "qa" (code-reviewer NO cambia estado)

**Próximo Paso:**
- [Si aprobado] unit-test-writer puede comenzar Fase 8: Unit Testing
- [Si cambios requeridos] Humano decide: volver a desarrollo o implementar sugerencias

**Notas:**
- Review completo disponible en comentario de ClickUp (si no es LOCAL_ONLY)
- [Notas adicionales sobre el code review]

---

### [YYYY-MM-DD HH:MM] - unit-test-writer

**Estado:** ✅ Completado / ⚠️ Completado con pendientes / 🚫 Bloqueado

**Trabajo Realizado:**
- Analizado código implementado en Fase 1-4
- Identificada lógica de negocio que requiere unit tests
- Identificados validation schemas que requieren tests
- Creados unit tests para backend (Zod schemas, business logic)
- Creados unit tests para frontend (hooks, utilities)
- Ejecutados tests hasta 100% pass

**Resultados de Tests:**
- **Backend Unit Tests:** [X] passed, [Y] failed
- **Frontend Unit Tests:** [X] passed, [Y] failed
- **Coverage:** [X]% (target: 80%+)

**Tests Creados:**
- `__tests__/api/[feature].test.ts` - [X] tests
- `__tests__/validation/[feature].test.ts` - [X] tests
- `__tests__/hooks/[feature].test.ts` - [X] tests

**Próximo Paso:**
- [Si OK] Humano valida y procede con merge
- [Si coverage insuficiente] Agregar más tests

**Notas:**
- [Notas sobre testing patterns usados]
- [Coverage report disponible en...]

---

### [YYYY-MM-DD HH:MM] - [siguiente-agente]

**Estado:** [Estado]

**Trabajo Realizado:**
[Descripción]

**Próximo Paso:**
[Descripción]

**Notas:**
[Notas]

---

## **Resumen del Workflow Completo**

```
1. product-manager → Crea requirements + tarea (ClickUp opcional)
   ↓
2. architecture-supervisor → Crea plan técnico + session files
   ↓
3. backend-developer → Implementa Fase 1 (DB + API)
   ↓
4. frontend-developer → Implementa Fase 2 (UI + State)
   ↓
5. backend + frontend → Integración Fase 3
   ↓
6. frontend-validator → Fase 4 (data-cy, traducciones, no hardcoded)
   ├─ Escribe selectores en tests.md
   └─ Corrige problemas directamente
   ↓
7. functional-validator → Fase 5 (coherencia AC vs implementación)
   ├─ Corrige issues menores
   └─ Reporta issues mayores
   ↓
8. qa-automation → Fase 6 (API tests + UAT tests)
   ├─ Lee selectores de tests.md
   ├─ Loop fix-retry hasta 100% pass
   ├─ Si feature broken → Vuelta a desarrollo
   └─ Si OK → Continuar
   ↓
9. code-reviewer → Fase 7 (code review)
   ├─ Si cambios críticos → Humano decide
   └─ Si OK → Continuar
   ↓
10. unit-test-writer → Fase 8 (Jest unit tests)
    ├─ 80%+ coverage
    └─ Documenta resultados
    ↓
11. Humano → Merge + Deploy + Marca "done" (si usa ClickUp)
```

---

## **Convenciones de Este Archivo**

1. **Cada agente DEBE agregar su entrada al terminar**
2. **Formato: `### [YYYY-MM-DD HH:MM] - [agent-name]`**
3. **Siempre incluir estado: ✅ Completado / ⚠️ Con pendientes / 🚫 Bloqueado**
4. **Ser específico sobre trabajo realizado (no vago)**
5. **Documentar decisiones significativas**
6. **Ser claro sobre próximos pasos para el siguiente agente**
7. **Agregar notas relevantes/advertencias**

---

**Última actualización:** [YYYY-MM-DD HH:MM] por [agent-name]
