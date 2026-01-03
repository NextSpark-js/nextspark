---
description: "[Pre-Execution] Refine session requirements and/or plan before development starts"
---

# Task Refine - Pre-Development Session Refinement

You are refining a session that has been created but NOT yet started (development has not begun).

**Session Path and Refinement Request:**
{{{ input }}}

---

## Your Mission

Refine session documents based on user feedback **BEFORE** development begins. This command is for sessions in the planning phase only.

**Key Difference from scope-change:**
- `task:refine` - Session NOT started (planning phase only)
- `task:scope-change` - Session IN PROGRESS (development has begun)

---

## Process Overview

```
1. Detect session path from input
2. Read session files to understand current state
3. Determine which agents to launch (PM only, or PM + Architect)
4. Launch agents to refine documents
5. Update session files with refinements
6. Get user confirmation
```

---

## Step 1: Detect Session Path

```typescript
// Extract session path from input
// User might provide:
// - Full path: .claude/sessions/2025-12-16-posts-system-v1/
// - Just session name: 2025-12-16-posts-system-v1
// - Or it might be in context from previous conversation

const sessionPath = extractSessionPath(input)

// If no session path found, check for most recent session
if (!sessionPath) {
  const sessions = await Glob('.claude/sessions/*/')
  const mostRecent = sessions.sort().pop()
  // Ask user to confirm
}
```

---

## Step 2: Analyze Current Session State

**Read existing session files:**

```typescript
// Check what files exist
const hasRequirements = await fileExists(`${sessionPath}/requirements.md`)
const hasPlan = await fileExists(`${sessionPath}/plan.md`)
const hasProgress = await fileExists(`${sessionPath}/progress.md`)
const hasContext = await fileExists(`${sessionPath}/context.md`)

// Determine session state
let sessionState: 'requirements-only' | 'planned' | 'started'

if (hasProgress) {
  // Check if any development items are completed
  const progress = await Read(`${sessionPath}/progress.md`)
  const hasCompletedDevItems = checkForCompletedDevelopmentItems(progress)

  if (hasCompletedDevItems) {
    sessionState = 'started'
    // REDIRECT TO SCOPE-CHANGE
    console.log(`
⚠️ **Development has already started on this session.**

Use \`/task:scope-change\` instead to handle mid-development changes.
This command (\`/task:refine\`) is only for sessions that haven't started development yet.
    `)
    return
  }
}

sessionState = hasPlan ? 'planned' : 'requirements-only'
```

---

## Step 3: Read Current Documents

```typescript
// Always read requirements
const requirements = await Read(`${sessionPath}/requirements.md`)

// Read plan if exists
let plan = null
if (hasPlan) {
  plan = await Read(`${sessionPath}/plan.md`)
}

// Read context if exists
let context = null
if (hasContext) {
  context = await Read(`${sessionPath}/context.md`)
}
```

---

## Step 4: Understand Refinement Request

**Extract the refinement request from user input:**

The user's input contains:
1. Session path (explicit or implicit)
2. What they want to change/refine

Parse the refinement request and classify it:

```typescript
const refinementTypes = {
  'requirements': // Changes to ACs, user stories, scope
  'architecture': // Changes to technical approach, schema, API design
  'scope': // Changes to what's in/out of scope
  'both': // Changes that affect both requirements and technical plan
}
```

---

## Step 5: Determine Agents to Launch

```typescript
// Decision matrix
if (sessionState === 'requirements-only') {
  // Only PM agent needed - plan doesn't exist yet
  agentsToLaunch = ['product-manager']

} else if (sessionState === 'planned') {
  // Both agents needed - refine requirements AND update plan
  agentsToLaunch = ['product-manager', 'architecture-supervisor']
}
```

---

## Step 6: Launch Product Manager Agent

**ALWAYS launch PM first to refine requirements:**

```typescript
await Task({
  subagent_type: 'product-manager',
  prompt: `
## Refinamiento de Requirements: ${sessionName}

**Session Path:** \`${sessionPath}\`
**Estado de Sesión:** ${sessionState}

### Contexto

El usuario ha solicitado refinar los requirements de esta sesión ANTES de comenzar el desarrollo.

### Solicitud de Refinamiento

${userRefinementRequest}

### Tu Tarea (Product Manager)

1. **Lee los requirements actuales:**
   - \`${sessionPath}/requirements.md\`
   - \`${sessionPath}/clickup_task.md\` (si existe)

2. **Analiza la solicitud de refinamiento:**
   - ¿Qué cambios específicos se piden?
   - ¿Afecta los Acceptance Criteria?
   - ¿Afecta el scope (in/out)?
   - ¿Afecta el schema de datos?
   - ¿Hay ambigüedades que necesitan clarificación?

3. **Si hay ambigüedades, usa AskUserQuestion:**
   - Clarifica cualquier punto que pueda interpretarse de múltiples formas
   - Confirma decisiones importantes antes de aplicarlas

4. **Actualiza los documentos:**
   - \`requirements.md\` - Actualizar ACs, scope, schema según corresponda
   - \`clickup_task.md\` - Actualizar criterios si existe
   - \`context.md\` - Agregar entrada de refinamiento

5. **Documenta el refinamiento:**
   - Agrega sección "## Refinement Log" en requirements.md
   - Lista los cambios realizados
   - Fecha y razón del refinamiento

6. **Output esperado:**
   - Lista de cambios realizados
   - Archivos actualizados
   - Recomendación para siguiente paso
`
})
```

---

## Step 7: Launch Architecture Supervisor (if plan exists)

**Only if session has a plan.md:**

```typescript
if (sessionState === 'planned') {
  await Task({
    subagent_type: 'architecture-supervisor',
    prompt: `
## Refinamiento de Plan Técnico: ${sessionName}

**Session Path:** \`${sessionPath}\`
**Estado:** Plan ya existe, refinando basado en cambios de requirements

### Contexto

El Product Manager acaba de refinar los requirements de esta sesión.
Necesitas actualizar el plan técnico para reflejar los cambios.

### Solicitud de Refinamiento Original

${userRefinementRequest}

### Tu Tarea (Architecture Supervisor)

1. **Lee los documentos actualizados:**
   - \`${sessionPath}/requirements.md\` (recién actualizado por PM)
   - \`${sessionPath}/plan.md\` (plan actual a refinar)
   - \`${sessionPath}/progress.md\` (template de progreso)

2. **Identifica impactos técnicos:**
   - ¿Cambia el schema de base de datos?
   - ¿Cambia la estructura de API?
   - ¿Cambia la arquitectura de componentes?
   - ¿Hay nuevas decisiones técnicas que tomar?

3. **Si hay decisiones técnicas ambiguas:**
   - Evalúa las opciones disponibles
   - Usa AskUserQuestion para confirmar con el usuario
   - Documenta la decisión y justificación

4. **Actualiza los documentos:**
   - \`plan.md\` - Actualizar fases, migraciones, APIs, componentes
   - \`progress.md\` - Actualizar checkboxes si hay nuevas tareas
   - \`context.md\` - Agregar entrada de refinamiento técnico

5. **Versiona el plan:**
   - Incrementar versión en plan.md (ej: v1.0 → v1.1)
   - Documentar cambios en sección "## Refinement History"

6. **Output esperado:**
   - Lista de cambios técnicos
   - Nuevas decisiones arquitectónicas (si las hay)
   - Archivos actualizados
`
  })
}
```

---

## Step 8: Update Context File

**Add refinement entry to context.md:**

```typescript
const contextEntry = `
---

### ${timestamp} - task:refine

**Estado:** ✅ Refinamiento Completado

**Solicitado por:** Usuario
**Tipo de Refinamiento:** ${refinementType}

**Cambios Solicitados:**
${userRefinementRequest}

**Archivos Actualizados:**
- requirements.md - ${requirementsChanges}
- ${hasPlan ? 'plan.md - ' + planChanges : 'plan.md - No existe aún'}
- ${hasProgress ? 'progress.md - ' + progressChanges : 'progress.md - No existe aún'}

**Agentes Involucrados:**
- product-manager: Refinó requirements
${hasPlan ? '- architecture-supervisor: Actualizó plan técnico' : ''}

**Próximo Paso:**
${hasPlan ? '- Listo para /task:execute' : '- Ejecutar /task:plan para crear plan técnico'}

**Notas:**
- Sesión aún NO iniciada (pre-development)
- Sin rework requerido (desarrollo no ha comenzado)
`

await appendToFile(`${sessionPath}/context.md`, contextEntry)
```

---

## Output Format

```markdown
## Refinamiento Completado

**Session:** \`${sessionPath}\`
**Estado de Sesión:** ${sessionState}
**Agentes Utilizados:** ${agentsUsed.join(', ')}

### Cambios Realizados

**Requirements:**
- [Lista de cambios en requirements]

**Plan Técnico:** ${hasPlan ? '[Lista de cambios en plan]' : 'N/A - Plan aún no existe'}

### Archivos Actualizados
- \`requirements.md\` - ✅ Actualizado
- \`clickup_task.md\` - ${hasClickup ? '✅ Actualizado' : '⏭️ N/A'}
- \`plan.md\` - ${hasPlan ? '✅ Actualizado' : '⏭️ No existe aún'}
- \`progress.md\` - ${hasProgress ? '✅ Actualizado' : '⏭️ No existe aún'}
- \`context.md\` - ✅ Entrada agregada

### Próximo Paso

${hasPlan
  ? 'La sesión está lista para ejecutar. Run `/task:execute` to begin development.'
  : 'Los requirements están refinados. Run `/task:plan` to create the technical plan.'
}
```

---

## When NOT to Use This Command

**Use `/task:scope-change` instead when:**
- Development has already started (Phase 5+ in progress.md)
- Code has been written
- Migrations have been executed
- API endpoints exist

**Use `/task:requirements` instead when:**
- Starting a completely new feature
- No session exists yet

---

## Key Principles

1. **Pre-Development Only:** This command is for planning phase refinements
2. **No Rework Analysis:** Since development hasn't started, no need to analyze rework
3. **Clarify Ambiguities:** Always ask user when refinement request is unclear
4. **Preserve Context:** Document all refinements in context.md
5. **Version Plans:** Increment plan version when updating (v1.0 → v1.1)
6. **Agent Selection:** PM always, Architect only if plan exists

---

## Examples

### Example 1: Refine Requirements Only

```
User: /task:refine 2025-12-16-posts-system-v1
      Quiero cambiar el schema de categorías a un sistema de taxonomías genéricas

→ Session has requirements.md but no plan.md
→ Launch: product-manager only
→ PM updates requirements with new schema
→ Next step: /task:plan
```

### Example 2: Refine Requirements + Plan

```
User: /task:refine 2025-12-16-posts-system-v1
      Quiero cambiar el schema de categorías a un sistema de taxonomías genéricas

→ Session has both requirements.md and plan.md
→ Launch: product-manager (first), then architecture-supervisor
→ PM updates requirements, Architect updates plan
→ Next step: /task:execute
```

---

**Now process the refinement request for the session described above.**
