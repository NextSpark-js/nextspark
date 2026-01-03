---
description: "Generate a demo video for a feature using Cypress with narration"
---

# Demo Feature Video - Documentation Generator

Generate a documentation video demonstrating a feature using Cypress automated tests with narration support.

**User Request:**
{{{ input }}}

---

## Overview

This command creates demonstration videos that show how features work. The videos include:
- Visual demonstration of the feature
- Subtitle markers (via `cy.log()`) that can be used for voice-over
- Proper pacing for viewers to follow along
- Highlight effects on important elements

---

## Phase 1: Detect Context

### Check for Active Session

First, check if there's an active development session:

```typescript
// Look for recent sessions
const sessions = await Glob('.claude/sessions/*/plan.md')

if (sessions.length > 0) {
  // Find most recent session
  const recentSession = sessions.sort().reverse()[0]
  const sessionPath = recentSession.replace('/plan.md', '')
  const sessionName = sessionPath.split('/').pop()

  // Read session files
  const planContent = await Read(`${sessionPath}/plan.md`)
  const clickupContent = await Read(`${sessionPath}/clickup_task.md`)

  // Ask user if they want to demo this feature
  const useSession = await AskUserQuestion({
    question: `Detecté una sesión activa: ${sessionName}. ¿Quieres crear un demo de este feature?`,
    options: [
      { label: 'Sí, usar esta sesión', description: 'Crear demo basado en el plan y ACs de la sesión' },
      { label: 'No, otro feature', description: 'Especificar manualmente qué documentar' }
    ]
  })
}
```

### If No Session or User Chooses Custom

Ask for feature details:

```typescript
const featureDescription = await AskUserQuestion({
  question: '¿Qué feature quieres documentar en video?',
  // Free text input
})
```

---

## Phase 2: Define Scope

### Duration Target

```typescript
const duration = await AskUserQuestion({
  question: '¿Qué duración target tiene el video?',
  options: [
    { label: '1-1:30 min', description: 'Demo muy rápido, solo lo esencial' },
    { label: '1:30-2 min', description: 'Demo conciso con explicaciones básicas (Recomendado)' },
    { label: '2-3 min', description: 'Demo detallado con contexto' },
    { label: '3-5 min', description: 'Tutorial completo con múltiples aspectos' }
  ]
})
```

### Target Audience

```typescript
const audience = await AskUserQuestion({
  question: '¿Quién es la audiencia del video?',
  options: [
    { label: 'Usuario final', description: 'Enfoque en UI y flujos de trabajo' },
    { label: 'Administrador', description: 'Incluye configuración y permisos' },
    { label: 'Desarrollador', description: 'Incluye aspectos técnicos y API' }
  ]
})
```

### Aspects to Cover

```typescript
const aspects = await AskUserQuestion({
  question: '¿Qué aspectos cubrir? (selecciona múltiples)',
  multiSelect: true,
  options: [
    { label: 'Flujo principal', description: 'El caso de uso más común' },
    { label: 'Permisos/Roles', description: 'Diferencias según rol del usuario' },
    { label: 'Configuración', description: 'Settings y opciones' },
    { label: 'Edge cases', description: 'Validaciones y errores' }
  ]
})
```

### Language

```typescript
const language = await AskUserQuestion({
  question: '¿En qué idioma serán los subtítulos?',
  options: [
    { label: 'Español', description: 'Subtítulos en español (Recomendado)' },
    { label: 'English', description: 'Subtitles in English' }
  ]
})
```

---

## Phase 3: Analyze Feature

Based on scope, analyze the feature to document:

### If Using Session

1. Read `plan.md` for technical details
2. Read `clickup_task.md` for acceptance criteria
3. Read `tests.md` for available `data-cy` selectors
4. Identify key user flows
5. Identify users/roles to demonstrate
6. List pages/routes involved

### If Custom Feature

1. Search codebase for feature components
2. Find relevant routes in `app/`
3. Find relevant `data-cy` selectors
4. Identify available test users in DevKeyring
5. Determine permission differences if applicable

---

## Phase 4: Generate Narration Proposal

Based on the analysis, generate a narration script:

### Structure

```markdown
# Demo: {Feature Name}

**Duración Target:** {duration}
**Audiencia:** {audience}
**Idioma:** {language}

---

## Capítulo 1: Introducción
- Bienvenida y contexto del feature
- Qué aprenderá el espectador

## Capítulo 2: {Main Flow}
- Paso a paso del flujo principal
- Explicación de cada acción

## Capítulo 3: {Additional Aspect}
- Según lo seleccionado (permisos, config, etc.)

## Capítulo N: Conclusión
- Resumen de lo demostrado
- Próximos pasos o features relacionados

---

## Narración Completa

### Capítulo 1: Introducción

1. "Bienvenido al demo de {Feature}. Hoy aprenderás cómo..."
   - Acción: Ninguna (intro)
   - Duración estimada: ~X segundos

2. "{User} es un usuario con rol {role}. Veamos cómo funciona."
   - Acción: Login
   - Duración estimada: ~X segundos

### Capítulo 2: {Main Flow}

3. "Navegamos a la sección de {section}..."
   - Acción: cy.visit('/dashboard/{section}')
   - Duración estimada: ~X segundos

...

---

## Datos Técnicos

**Usuario de prueba:** {email}
**Rutas involucradas:** {routes}
**Selectores clave:**
- {selector1}: {descripción}
- {selector2}: {descripción}

---

## Cálculo de Tiempos

| Concepto | Cantidad | Tiempo |
|----------|----------|--------|
| Palabras totales | {N} | {X}ms |
| Capítulos | {N} | {X}ms |
| Page loads | {N} | {X}ms |
| Highlights | {N} | {X}ms |
| Comandos Cypress | {N} | - |
| **commandDelay calculado** | - | {X}ms |
| **Duración estimada** | - | {X:XX} |
```

---

## Phase 5: Present and Approve

### Show Narration to User

Present the complete narration proposal with:
- Chapter structure
- Each narration text
- Estimated duration
- Technical details

### Ask for Approval

```typescript
const approval = await AskUserQuestion({
  question: '¿Apruebas esta narración para generar el video?',
  options: [
    { label: 'Aprobar y generar', description: 'Lanzar agente para crear el test de Cypress' },
    { label: 'Ajustar narración', description: 'Modificar textos o estructura antes de generar' },
    { label: 'Cambiar scope', description: 'Volver a definir qué aspectos cubrir' },
    { label: 'Cancelar', description: 'No generar video' }
  ]
})
```

### If Adjustments Needed

Allow user to specify changes:
- Add/remove narrations
- Change wording
- Adjust chapter structure
- Modify duration target

Loop back to present updated narration until approved.

---

## Phase 6: Launch Agent

Once narration is approved, launch the `demo-video-generator` agent:

```typescript
await launchAgent('demo-video-generator', {
  task: `Generate demo video for: ${featureName}`,
  prompt: `
## Approved Narration

${approvedNarrationMarkdown}

## Configuration

- Feature Name: ${featureName}
- Feature Slug: ${featureSlug}
- Target Duration: ${targetDuration}
- Language: ${language}
- Audience: ${audience}

## Technical Context

- Test User: ${testUser}
- Routes: ${routes.join(', ')}
- Selectors:
${selectors.map(s => `  - ${s.name}: ${s.selector}`).join('\n')}

## Timing Calculation

- Total Words: ${totalWords}
- Estimated Narration Time: ${narrationTimeMs}ms
- Estimated Action Time: ${actionTimeMs}ms
- Cypress Commands: ~${numCommands}
- Calculated commandDelay: ${commandDelay}ms
- Expected Duration: ${expectedDuration}

## Instructions

1. Create the Cypress test file at:
   contents/themes/default/tests/cypress/e2e/docs/tutorials/${featureSlug}.doc.cy.ts

2. Create the narration JSON at:
   contents/themes/default/tests/cypress/e2e/docs/tutorials/${featureSlug}.narration.json

3. Create the narration MD at:
   contents/themes/default/tests/cypress/e2e/docs/tutorials/${featureSlug}.narration.md

4. Use the CALCULATED commandDelay and narration times

5. Run the test and report:
   - Test success/failure
   - Video file location
   - Actual duration vs target
   - Any issues encountered
`
})
```

---

## Phase 7: Report Results

After agent completes, report to user:

```markdown
## ✅ Demo Video Generated

### Files Created

📹 **Video:** `cypress/videos/docs/tutorials/${featureSlug}.doc.cy.ts.mp4`
📝 **Test:** `cypress/e2e/docs/tutorials/${featureSlug}.doc.cy.ts`
📋 **Narration JSON:** `cypress/e2e/docs/tutorials/${featureSlug}.narration.json`
📄 **Narration MD:** `cypress/e2e/docs/tutorials/${featureSlug}.narration.md`

### Timing Results

| Metric | Value |
|--------|-------|
| Target Duration | ${targetDuration} |
| Actual Duration | ${actualDuration} |
| Difference | ${difference} |
| Status | ✅ Within target / ⚠️ Over target |

### Next Steps

1. **Review video:** Open the MP4 file to verify content
2. **Add voice-over:** Use the narration.md script for recording
3. **Generate subtitles:** Use narration.json for SRT generation
4. **Post-process:** Add AI voice-over with ElevenLabs/Google TTS

### Run Again

To regenerate the video:
\`\`\`bash
NEXT_PUBLIC_ACTIVE_THEME=default pnpm cy:run --spec "**/docs/tutorials/${featureSlug}.doc.cy.ts"
\`\`\`
```

---

## Error Handling

### Test Fails

If the Cypress test fails:
1. Report the error
2. Suggest reviewing selectors
3. Offer to regenerate with fixes

### Duration Off Target

If video duration is significantly off:
1. Report the difference
2. Explain what caused it (page loads, etc.)
3. Suggest adjustments for next iteration

### Missing Selectors

If required `data-cy` selectors don't exist:
1. List missing selectors
2. Suggest running frontend-validator first
3. Or manually add selectors before regenerating

---

## Examples

### Example 1: Demo from Active Session

```
User: /doc:demo-feature

Command: Detecté sesión activa: 2025-12-13-teams-permissions-v1
         ¿Quieres crear un demo de este feature?

User: Sí, usar esta sesión

Command: ¿Duración target?

User: 1:30-2 min

Command: ¿Audiencia?

User: Usuario final

Command: ¿Aspectos a cubrir?

User: Flujo principal, Permisos/Roles

Command: [Genera propuesta de narración]
         [Presenta para aprobación]

User: Aprobar y generar

Command: [Lanza demo-video-generator]
         [Reporta resultados]
```

### Example 2: Custom Feature Demo

```
User: /doc:demo-feature crear demo del sistema de facturación

Command: No detecté sesión activa.
         ¿Qué duración target?

User: 2-3 min

Command: ¿Audiencia?

User: Administrador

Command: [Analiza el feature de facturación]
         [Genera propuesta de narración]
         [Presenta para aprobación]

User: Ajustar narración - quiero más énfasis en los reportes

Command: [Ajusta narración]
         [Presenta nueva versión]

User: Aprobar y generar

Command: [Lanza demo-video-generator]
         [Reporta resultados]
```

---

## Reference Documentation

- **Cypress Demo System:** `contents/themes/default/tests/cypress/e2e/docs/README.md`
- **Example Test:** `contents/themes/default/tests/cypress/e2e/docs/tutorials/teams-system.doc.cy.ts`
- **Agent Instructions:** `.claude/agents/demo-video-generator.md`

---

## Notes

- Videos are generated WITHOUT audio (subtitles only via cy.log)
- For voice-over, use the .narration.md file as script
- The narration.json can be used to generate SRT subtitles
- AI voice-over services (ElevenLabs, etc.) can use the JSON timestamps
- Keep demos under 5 minutes; split longer tutorials

---

*Command version: 1.0*
*Last updated: 2025-12-13*
