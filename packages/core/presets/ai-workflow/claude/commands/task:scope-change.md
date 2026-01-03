---
description: "Handle scope changes during development - Update ClickUp task and trigger code review"
---

# Scope Change - Mid-Development Requirement Changes

You are handling a scope change for a feature that is **already in development**.

**Session Path and Scope Change Request:**
{{{ input }}}

---

## Your Mission

Handle scope changes for sessions where **development has already begun**. This requires:

1. **Deep analysis** of requested changes vs current progress
2. **Identify rework** that may be needed
3. **Clarify ambiguities** with the user before proceeding
4. **Update documents** using PM and Architect agents
5. **Document impact** on existing work

**Key Difference from task:refine:**
- `task:refine` - Session NOT started (planning phase only)
- `task:scope-change` - Session IN PROGRESS (development has begun)

---

## Process Overview

```
1. Detect session path and verify development has started
2. Read ALL session files including progress
3. Analyze scope change request vs current progress
4. Identify rework implications
5. Ask user to clarify ambiguities and confirm rework
6. Launch PM + Architect agents to update documents
7. Update progress.md to mark affected items for rework
8. Trigger code review if significant code exists
```

---

## Step 1: Verify Session is In Progress

```typescript
const sessionPath = extractSessionPath(input)

// Read progress to verify development has started
const progress = await Read(`${sessionPath}/progress.md`)

// Check for completed development items (not just planning)
const developmentPhases = [
  'Phase 5: DB Developer',
  'Phase 7: Backend Developer',
  'Phase 10: Block Developer',
  'Phase 11: Frontend Developer'
]

const hasStartedDevelopment = developmentPhases.some(phase => {
  const phaseSection = extractSection(progress, phase)
  return phaseSection.includes('[x]') // Has completed items
})

if (!hasStartedDevelopment) {
  // REDIRECT TO REFINE
  console.log(`
⚠️ **Development has NOT started on this session yet.**

Use \`/task:refine\` instead to refine requirements before development begins.
This command (\`/task:scope-change\`) is for sessions where development is already in progress.
  `)
  return
}

console.log(`✅ Session verified: Development is in progress.`)
```

---

## Step 2: Read ALL Session Files

```typescript
// Read everything to understand full context
const requirements = await Read(`${sessionPath}/requirements.md`)
const clickupTask = await Read(`${sessionPath}/clickup_task.md`)
const plan = await Read(`${sessionPath}/plan.md`)
const progress = await Read(`${sessionPath}/progress.md`)
const context = await Read(`${sessionPath}/context.md`)
const tests = await Read(`${sessionPath}/tests.md`)
const pendings = await Read(`${sessionPath}/pendings.md`)
```

---

## Step 3: Analyze Progress State

**Extract what has been completed:**

```typescript
const completedItems = {
  migrations: extractCompletedItems(progress, 'DB Developer'),
  backend: extractCompletedItems(progress, 'Backend Developer'),
  blocks: extractCompletedItems(progress, 'Block Developer'),
  frontend: extractCompletedItems(progress, 'Frontend Developer'),
  tests: extractCompletedItems(progress, 'API Tester'),
  gates: extractGateStatus(progress)
}

// Determine current phase
const currentPhase = determineCurrentPhase(progress)

console.log(`
## Current Progress Analysis

**Current Phase:** ${currentPhase}
**Completed Development:**
- Migrations: ${completedItems.migrations.length} items
- Backend API: ${completedItems.backend.length} items
- Blocks: ${completedItems.blocks.length} items
- Frontend: ${completedItems.frontend.length} items
- Tests: ${completedItems.tests.length} items

**Gate Status:**
${completedItems.gates.map(g => `- ${g.name}: ${g.status}`).join('\n')}
`)
```

---

## Step 4: Deep Reasoning About Scope Change Impact

**Before any changes, analyze the impact thoroughly:**

```typescript
// Parse scope change request
const scopeChangeRequest = extractScopeChangeFromInput(input)

// Analyze impact on each completed area
const impactAnalysis = {
  migrations: analyzeImpactOnMigrations(scopeChangeRequest, completedItems.migrations),
  backend: analyzeImpactOnBackend(scopeChangeRequest, completedItems.backend),
  frontend: analyzeImpactOnFrontend(scopeChangeRequest, completedItems.frontend),
  tests: analyzeImpactOnTests(scopeChangeRequest, completedItems.tests)
}

// Determine rework needed
const reworkNeeded = {
  dropTables: impactAnalysis.migrations.requiresDropTable,
  modifyTables: impactAnalysis.migrations.requiresAlterTable,
  rewriteAPIs: impactAnalysis.backend.apisToRewrite,
  modifyAPIs: impactAnalysis.backend.apisToModify,
  rewriteComponents: impactAnalysis.frontend.componentsToRewrite,
  modifyComponents: impactAnalysis.frontend.componentsToModify,
  rewriteTests: impactAnalysis.tests.testsToRewrite
}
```

---

## Step 5: Present Rework Analysis to User

**CRITICAL: Ask user to confirm before proceeding:**

```typescript
console.log(`
## Scope Change Impact Analysis

**Requested Change:**
${scopeChangeRequest}

**Current Progress That May Be Affected:**

### Database (Migrations)
${reworkNeeded.dropTables.length > 0 ? `
⚠️ **Tables to DROP and recreate:**
${reworkNeeded.dropTables.map(t => `- ${t}`).join('\n')}
` : '✅ No table drops needed'}

${reworkNeeded.modifyTables.length > 0 ? `
📝 **Tables to ALTER:**
${reworkNeeded.modifyTables.map(t => `- ${t}`).join('\n')}
` : ''}

### Backend APIs
${reworkNeeded.rewriteAPIs.length > 0 ? `
⚠️ **APIs to REWRITE:**
${reworkNeeded.rewriteAPIs.map(a => `- ${a}`).join('\n')}
` : '✅ No API rewrites needed'}

${reworkNeeded.modifyAPIs.length > 0 ? `
📝 **APIs to MODIFY:**
${reworkNeeded.modifyAPIs.map(a => `- ${a}`).join('\n')}
` : ''}

### Frontend
${reworkNeeded.rewriteComponents.length > 0 ? `
⚠️ **Components to REWRITE:**
${reworkNeeded.rewriteComponents.map(c => `- ${c}`).join('\n')}
` : '✅ No component rewrites needed'}

### Tests
${reworkNeeded.rewriteTests.length > 0 ? `
⚠️ **Tests to UPDATE:**
${reworkNeeded.rewriteTests.map(t => `- ${t}`).join('\n')}
` : ''}
`)

// Ask user to confirm
await AskUserQuestion({
  questions: [
    {
      header: "Confirm Rework",
      question: "Based on the analysis above, do you want to proceed with this scope change?",
      options: [
        { label: "Yes, proceed", description: "Accept the rework and update session documents" },
        { label: "Modify request", description: "I want to adjust my scope change request" },
        { label: "Cancel", description: "Keep current scope, don't make changes" }
      ],
      multiSelect: false
    }
  ]
})
```

---

## Step 6: Clarify Ambiguities

**If scope change has multiple interpretations, ask:**

```typescript
// Identify ambiguities in the request
const ambiguities = identifyAmbiguities(scopeChangeRequest, requirements, plan)

if (ambiguities.length > 0) {
  for (const ambiguity of ambiguities) {
    await AskUserQuestion({
      questions: [{
        header: ambiguity.category,
        question: ambiguity.question,
        options: ambiguity.options,
        multiSelect: false
      }]
    })
  }
}

// Example ambiguities to check:
// - "Does this change affect existing data?"
// - "Should existing records be migrated?"
// - "Is this a breaking change for the API?"
// - "Should we maintain backwards compatibility?"
```

---

## Step 7: Launch PM Agent for Requirements Update

```typescript
await Task({
  subagent_type: 'product-manager',
  prompt: `
## Scope Change - Requirements Update

**Session:** \`${sessionPath}\`
**Estado:** Desarrollo en progreso (${currentPhase})

### Contexto

El usuario ha solicitado un cambio de alcance **durante el desarrollo**. Esto requiere actualizar los requirements considerando el trabajo ya realizado.

### Cambio Solicitado

${scopeChangeRequest}

### Análisis de Impacto (ya validado con usuario)

**Rework Confirmado:**
- Migrations: ${JSON.stringify(reworkNeeded.dropTables)}
- APIs: ${JSON.stringify(reworkNeeded.rewriteAPIs)}
- Components: ${JSON.stringify(reworkNeeded.rewriteComponents)}

### Tu Tarea (Product Manager)

1. **Lee los documentos actuales:**
   - \`${sessionPath}/requirements.md\`
   - \`${sessionPath}/clickup_task.md\`

2. **Actualiza requirements.md:**
   - Agregar sección "## Scope Change Log"
   - Documentar el cambio y su impacto
   - Actualizar Acceptance Criteria afectados
   - Marcar ACs removidos como deprecated (no borrar)
   - Agregar nuevos ACs con clasificación [AUTO]/[MANUAL]/[REVIEW]

3. **Actualiza clickup_task.md:**
   - Agregar sección de cambio de alcance
   - Actualizar criterios de aceptación

4. **Si ClickUp está habilitado:**
   - Usar mcp__clickup__* para actualizar la tarea
   - Agregar comentario notificando el cambio

5. **Documenta impacto:**
   - Qué trabajo completado se mantiene
   - Qué trabajo completado necesita rehacerse
   - Qué trabajo pendiente cambia

6. **Actualiza context.md con entrada:**
   \`\`\`
   ### ${timestamp} - scope-change (PM)

   **Estado:** ⚠️ Scope Change - Requirements Updated

   **Cambio:** ${scopeChangeRequest}
   **Impacto:** ${impactLevel}

   **ACs Afectados:**
   - Modified: [lista]
   - Added: [lista]
   - Deprecated: [lista]

   **Rework Requerido:**
   - [lista de items que deben rehacerse]
   \`\`\`
`
})
```

---

## Step 8: Launch Architect Agent for Plan Update

```typescript
await Task({
  subagent_type: 'architecture-supervisor',
  prompt: `
## Scope Change - Technical Plan Update

**Session:** \`${sessionPath}\`
**Estado:** Desarrollo en progreso (${currentPhase})

### Contexto

El Product Manager acaba de actualizar los requirements por un scope change.
Necesitas actualizar el plan técnico y el progress tracking.

### Cambio Solicitado

${scopeChangeRequest}

### Rework Confirmado por Usuario

- **Migrations:** ${JSON.stringify(reworkNeeded)}
- **APIs:** ${JSON.stringify(reworkNeeded.rewriteAPIs)}
- **Frontend:** ${JSON.stringify(reworkNeeded.rewriteComponents)}

### Tu Tarea (Architecture Supervisor)

1. **Lee los documentos actualizados:**
   - \`${sessionPath}/requirements.md\` (actualizado por PM)
   - \`${sessionPath}/plan.md\`
   - \`${sessionPath}/progress.md\`

2. **Actualiza plan.md:**
   - Agregar sección "## Scope Change Impact"
   - Documentar cambios técnicos necesarios
   - Actualizar schema de migraciones si aplica
   - Actualizar diseño de API si aplica
   - Actualizar diseño de componentes si aplica
   - Incrementar versión del plan (ej: v1.1 → v1.2)

3. **Actualiza progress.md (CRÍTICO):**
   - **Marcar items completados que necesitan rehacerse como [ ]**
   - Agregar nota junto a cada item: "[REWORK: scope change]"
   - Agregar nuevos checkboxes para nuevas tareas
   - Mantener el historial de qué se había completado

   Ejemplo:
   \`\`\`markdown
   - [ ] Create migration file (REWORK: scope change - was [x])
   - [x] Define posts schema (unaffected)
   - [ ] Create taxonomies schema (NEW: scope change)
   \`\`\`

4. **Decide sobre código existente:**
   - ¿Se puede reutilizar algo?
   - ¿Qué debe borrarse?
   - ¿Qué debe modificarse?

5. **Si hay código significativo afectado:**
   - Recomendar trigger de code-reviewer
   - Documentar qué revisar

6. **Actualiza context.md con entrada:**
   \`\`\`
   ### ${timestamp} - scope-change (Architect)

   **Estado:** ⚠️ Scope Change - Plan Updated

   **Cambios Técnicos:**
   - [lista de cambios al plan]

   **Items Marcados para Rework:**
   - [lista de items en progress.md]

   **Decisiones Técnicas:**
   - [nuevas decisiones si las hay]

   **Recomendación:**
   - ${triggerCodeReview ? 'Trigger code-reviewer' : 'No code review needed'}
   \`\`\`
`
})
```

---

## Step 9: Trigger Code Review (if needed)

```typescript
// Determine if code review is needed
const significantCodeExists =
  completedItems.backend.length > 2 ||
  completedItems.frontend.length > 2

const significantRework =
  reworkNeeded.rewriteAPIs.length > 0 ||
  reworkNeeded.rewriteComponents.length > 0

if (significantCodeExists && significantRework) {
  await Task({
    subagent_type: 'code-reviewer',
    prompt: `
## Post-Scope-Change Code Review

**Session:** \`${sessionPath}\`

### Contexto

Se ha aplicado un scope change a esta sesión. Se requiere review del código existente para:

1. Identificar código que debe modificarse
2. Identificar código que puede reutilizarse
3. Identificar código que debe eliminarse
4. Validar que no quedan referencias rotas

### Cambio de Alcance

${scopeChangeRequest}

### Código Existente a Revisar

**Backend:**
${completedItems.backend.map(b => `- ${b}`).join('\n')}

**Frontend:**
${completedItems.frontend.map(f => `- ${f}`).join('\n')}

### Tu Tarea

1. Revisar el código afectado
2. Documentar hallazgos en context.md
3. Crear lista de acciones para developers
4. Identificar tech debt introducido por el cambio
`
  })
}
```

---

## Output Format

```markdown
## Scope Change Processed

**Session:** \`${sessionPath}\`
**Estado Previo:** ${currentPhase}
**Tipo de Cambio:** ${changeType}
**Impacto:** ${impactLevel}

### Cambio Aplicado

${scopeChangeRequest}

### Rework Requerido

| Área | Items Afectados | Acción |
|------|-----------------|--------|
| Migrations | ${reworkNeeded.migrations} | ${migrationAction} |
| Backend APIs | ${reworkNeeded.apis} | ${apiAction} |
| Frontend | ${reworkNeeded.frontend} | ${frontendAction} |
| Tests | ${reworkNeeded.tests} | ${testAction} |

### Archivos Actualizados

- \`requirements.md\` - ✅ ACs actualizados, scope change log agregado
- \`clickup_task.md\` - ✅ Criterios actualizados
- \`plan.md\` - ✅ Plan técnico actualizado (v${newVersion})
- \`progress.md\` - ✅ Items marcados para rework
- \`context.md\` - ✅ Entradas de PM y Architect agregadas

### Code Review

${triggeredCodeReview
  ? '✅ Code review triggered - ver context.md para hallazgos'
  : '⏭️ No code review necesario'}

### Próximos Pasos

1. ${nextStep1}
2. ${nextStep2}
3. ${nextStep3}

### Agentes Utilizados

- product-manager: Actualizó requirements y ACs
- architecture-supervisor: Actualizó plan y progress
${triggeredCodeReview ? '- code-reviewer: Revisó código afectado' : ''}
```

---

## When to Create New Version (v2)

**Redirect to new session when:**

- Impact is "Complete pivot" (>50% rework)
- Fundamental architecture change
- User explicitly requests fresh start
- Scope change is actually a new feature

```typescript
if (impactLevel === 'complete' || reworkPercentage > 50) {
  console.log(`
⚠️ **Este cambio es demasiado grande para un scope change.**

Se recomienda crear una nueva versión de la sesión:

1. Ejecutar \`/task:requirements\` con los nuevos requirements
2. Usar nombre: \`${sessionBaseName}-v2\`
3. Referenciar \`${sessionPath}/pendings.md\` en la nueva sesión
4. Documentar lecciones aprendidas de v1
  `)
}
```

---

## Key Principles

1. **Deep Analysis First:** Always analyze impact before making changes
2. **User Confirmation:** Never proceed without user confirming rework
3. **Clarify Ambiguities:** Ask when scope change has multiple interpretations
4. **Preserve History:** Don't delete completed items, mark them for rework
5. **Version Plans:** Increment plan version on every scope change
6. **Document Everything:** Every scope change must be logged in context.md
7. **Code Review:** Trigger review when significant code is affected

---

**Now process the scope change for the session described above.**
