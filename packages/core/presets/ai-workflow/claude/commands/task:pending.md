---
description: Document pending items discovered during development for future iterations
---

# Task Pending - Document Deferred Items

You are documenting a pending item discovered during development that will be addressed in a future iteration.

**Session and Pending Description:**
{{{ input }}}

---

## Your Mission

Document pending items properly so they can be addressed in future versions:

1. **Capture the pending item** with full context
2. **Classify priority and category**
3. **Document impact** of not resolving now
4. **Provide recommendations** for future iteration
5. **Update pendings.md** in session folder

---

## Pending Documentation Protocol

### Step 1: Read Session Context

```typescript
const sessionPath = extractSessionPath(input)

// Read current pendings
await Read(`${sessionPath}/pendings.md`)

// Read context for understanding
await Read(`${sessionPath}/clickup_task.md`)
await Read(`${sessionPath}/plan.md`)
await Read(`${sessionPath}/progress.md`)
```

### Step 2: Classify Pending Item

**Ask user about the pending:**

```typescript
await AskUserQuestion({
  questions: [
    {
      header: "Priority",
      question: "What priority is this pending item?",
      options: [
        { label: "Alta", description: "Should be done in next iteration" },
        { label: "Media", description: "Important but can wait" },
        { label: "Baja", description: "Nice to have, low urgency" }
      ],
      multiSelect: false
    },
    {
      header: "Category",
      question: "What category is this pending?",
      options: [
        { label: "Feature", description: "Missing or incomplete feature" },
        { label: "Bug", description: "Known issue not blocking" },
        { label: "Refactor", description: "Code improvement opportunity" },
        { label: "Performance", description: "Optimization needed" },
        { label: "Security", description: "Security enhancement" },
        { label: "UX", description: "User experience improvement" },
        { label: "Documentation", description: "Docs needed" }
      ],
      multiSelect: false
    },
    {
      header: "Reason",
      question: "Why is this being deferred?",
      options: [
        { label: "Tiempo insuficiente", description: "Not enough time in current sprint" },
        { label: "Fuera del alcance actual", description: "Out of scope for this version" },
        { label: "Requiere decisión de producto", description: "Needs PM decision" },
        { label: "Dependencia externa", description: "Blocked by external factor" },
        { label: "Complejidad técnica alta", description: "Too complex for current iteration" }
      ],
      multiSelect: true
    }
  ]
})
```

### Step 3: Document in pendings.md

```typescript
// Get current pending count
const currentPendings = await Read(`${sessionPath}/pendings.md`)
const pendingCount = countExistingPendings(currentPendings) + 1

await Edit({
  file_path: `${sessionPath}/pendings.md`,
  old_string: "No hay pendientes documentados para esta sesión.",
  new_string: `### P${pendingCount}: ${pendingTitle}

**Detectado por:** ${agentName}
**Fecha:** ${date}
**Prioridad:** ${priority}
**Categoría:** ${category}

**Descripción:**
${description}

**Razón para Postergar:**
${reasons.map(r => `- [x] ${r}`).join('\n')}

**Impacto de No Resolverlo:**
- Funcionalidad afectada: ${affectedFunctionality}
- Usuarios afectados: ${affectedUsers}
- Riesgo: ${riskLevel}

**Recomendación para v${version + 1}:**
1. ${recommendation1}
2. ${recommendation2}
3. ${recommendation3}

**Archivos Relacionados:**
${relatedFiles.map(f => `- \`${f.path}\` - ${f.description}`).join('\n')}

**Acceptance Criteria Afectados:**
${affectedACs.map(ac => `- ${ac.id}: ${ac.impact}`).join('\n')}

---

No hay más pendientes documentados para esta sesión.`
})
```

### Step 4: Update Summary

```typescript
await Edit({
  file_path: `${sessionPath}/pendings.md`,
  old_string: `**Total Pendientes:** ${currentCount}
**Prioridad Alta:** ${highCount}
**Prioridad Media:** ${medCount}
**Prioridad Baja:** ${lowCount}`,
  new_string: `**Total Pendientes:** ${currentCount + 1}
**Prioridad Alta:** ${newHighCount}
**Prioridad Media:** ${newMedCount}
**Prioridad Baja:** ${newLowCount}`
})

// Update status
await Edit({
  file_path: `${sessionPath}/pendings.md`,
  old_string: "**Status:** Sin pendientes",
  new_string: "**Status:** Con pendientes"
})
```

### Step 5: Update Context

```typescript
await Edit({
  file_path: `${sessionPath}/context.md`,
  // Add note about new pending
  new_content: `
---

### [YYYY-MM-DD HH:MM] - task:pending

**Estado:** ⚠️ Pendiente Documentado

**Pendiente Agregado:** P${pendingCount} - ${pendingTitle}
**Prioridad:** ${priority}
**Categoría:** ${category}

**Resumen:**
${description}

**Razón:**
${mainReason}

**Impacto:**
${impactSummary}

**Notas:**
- Documentado en pendings.md
- Será abordado en v${version + 1}
`
})
```

---

## Pending Item Template

```markdown
### P[N]: [Título del Pendiente]

**Detectado por:** [agent-name]
**Fecha:** YYYY-MM-DD
**Prioridad:** Alta / Media / Baja
**Categoría:** Feature / Bug / Refactor / Performance / Security / UX / Documentation

**Descripción:**
[Descripción detallada de qué quedó sin resolver]

**Razón para Postergar:**
- [ ] Tiempo insuficiente
- [ ] Fuera del alcance actual
- [ ] Requiere decisión de producto
- [ ] Dependencia externa
- [ ] Complejidad técnica alta
- [ ] Otro: [especificar]

**Impacto de No Resolverlo:**
- Funcionalidad afectada: [descripción]
- Usuarios afectados: [quiénes]
- Riesgo: [bajo/medio/alto]

**Recomendación para v[X+1]:**
1. [Paso recomendado 1]
2. [Paso recomendado 2]
3. [Paso recomendado 3]

**Archivos Relacionados:**
- `path/to/file1.ts` - [descripción]
- `path/to/file2.tsx` - [descripción]

**Acceptance Criteria Afectados:**
- AC[X]: [descripción de cómo afecta]
```

---

## Output Format

```markdown
## Pending Item Documented

**Session:** `.claude/sessions/YYYY-MM-DD-feature-name-v1/`
**Pending ID:** P[N]
**Title:** [Pending Title]

### Summary
- **Priority:** [Alta/Media/Baja]
- **Category:** [Category]
- **Reason:** [Main reason for deferring]

### Impact
- **Affected:** [What's affected]
- **Risk:** [Risk level]

### For Next Version
When creating v2, the PM and Architect will:
1. Read this pendings.md
2. Include this item in v2 requirements
3. Plan appropriate solution

### File Updated
- `pendings.md` - Pending P[N] added
- `context.md` - Entry added
```

---

## Best Practices for Pending Documentation

### DO:
- Be specific about what's pending
- Explain WHY it's being deferred
- Provide clear recommendations
- List affected files and ACs
- Estimate impact honestly

### DON'T:
- Use vague descriptions
- Skip the impact assessment
- Forget to update summary counts
- Leave without recommendations
- Document trivial items as pendings

---

## When to Use This Command

**Use task:pending when:**
- Feature is partially complete but time-boxed
- Edge case discovered but out of scope
- Performance optimization identified but not critical
- UX improvement suggested but not blocking
- Technical debt found during implementation

**DON'T use for:**
- Bugs that block the feature (fix now)
- Core functionality missing (expand scope)
- Security vulnerabilities (fix immediately)
- Items that should be separate features (create new session)

---

**Now document the pending item for the session described above.**
