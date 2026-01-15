# Session Management Skill

Sistema de gestión de sesiones de desarrollo para Claude Code.

## Conceptos Clave

### Tipos de Sesión

| Tipo | T-Shirt | Workflow | Carpeta | Descripción |
|------|---------|----------|---------|-------------|
| **Story** | L - XL | COMPLETE | `stories/` | Features complejos, múltiples iteraciones |
| **Task** | S - M | STANDARD | `tasks/` | Mejoras, bugs medianos |
| **Log** | XS | QUICK | `logs/` | Fixes rápidos, cambios triviales |

### Estructura de Carpetas

```
.claude/sessions/
├── scripts/              # Scripts de gestión
├── templates/            # Templates por tipo
│   ├── story/
│   ├── task/
│   ├── iteration/
│   └── log.md
├── stories/              # Sesiones COMPLETE
├── tasks/                # Sesiones STANDARD
├── logs/                 # Sesiones QUICK
└── archive/              # Sesiones completadas
```

---

## Scripts Disponibles

### session-init.sh

Crea una nueva sesión con toda su estructura.

```bash
# Sintaxis
.claude/skills/session-management/scripts/session-init.sh <type> <name> [tshirt]

# Parámetros
# type:   story | task | log
# name:   nombre descriptivo (sin fecha, se agrega auto)
# tshirt: xs | s | m | l | xl (opcional, default según type)

# Ejemplos
.claude/skills/session-management/scripts/session-init.sh story new-products-entity L
.claude/skills/session-management/scripts/session-init.sh task improve-search M
.claude/skills/session-management/scripts/session-init.sh log fix-typo
```

**Output:**
```
Creating story session: 2026-01-11-new-products-entity

Created: stories/2026-01-11-new-products-entity/
Files: context.md, requirements.md, plan.md, scope.json, pendings.md, tests.md
Iteration: iterations/01-initial/
Current: current/ -> iterations/01-initial/
```

### session-list.sh

Lista sesiones activas con su estado.

```bash
# Sintaxis
.claude/skills/session-management/scripts/session-list.sh [type] [--all]

# Ejemplos
.claude/skills/session-management/scripts/session-list.sh              # Solo activas
.claude/skills/session-management/scripts/session-list.sh stories      # Solo stories activas
.claude/skills/session-management/scripts/session-list.sh --all        # Incluir archivadas
```

**Output:**
```
=== SESSION LIST ===

STORIES
  2026-01-11-new-products-entity [L] iteration-02 (60%)
  2026-01-08-refactor-auth [XL] iteration-01 (30%)
  Total: 2 active

TASKS
  2026-01-10-improve-search [M] (80%)
  Total: 1 active

LOGS
  2026-01-11-fix-typo-login
  Total: 1 active
```

### session-close.sh

Cierra una sesión activa (marca como completada).

```bash
# Sintaxis
.claude/skills/session-management/scripts/session-close.sh <session-path> [summary]

# Ejemplo
.claude/skills/session-management/scripts/session-close.sh stories/2026-01-11-new-products-entity "Feature completed"
```

### session-archive.sh

Mueve una sesión cerrada al archivo.

```bash
# Sintaxis
.claude/skills/session-management/scripts/session-archive.sh <session-path>

# Ejemplo
.claude/skills/session-management/scripts/session-archive.sh stories/2026-01-11-new-products-entity
```

### iteration-init.sh

Crea una nueva iteración dentro de una story.

```bash
# Sintaxis
.claude/skills/session-management/scripts/iteration-init.sh <session-path> <reason> [name]

# Parámetros
# reason: scope-change | blocked | review-feedback | continuation

# Ejemplo
.claude/skills/session-management/scripts/iteration-init.sh stories/2026-01-11-new-products-entity scope-change "add-variants"
```

### iteration-close.sh

Cierra la iteración actual sin crear una nueva.

```bash
# Sintaxis
.claude/skills/session-management/scripts/iteration-close.sh <session-path> <status> [summary]

# Parámetros
# status: completed | blocked | paused

# Ejemplo
.claude/skills/session-management/scripts/iteration-close.sh stories/2026-01-11-new-products-entity completed "All ACs met"
```

---

## Flujos de Uso

### Iniciar Nueva Sesión

1. **Evaluar complejidad** (T-Shirt sizing)
2. **Determinar tipo** de sesión:
   - XS → `log`
   - S-M → `task`
   - L-XL → `story`
3. **Ejecutar script**:
   ```bash
   ./session-init.sh <type> <name> <tshirt>
   ```
4. **Completar templates** generados

### Retomar Sesión Existente

1. **Listar sesiones**:
   ```bash
   ./session-list.sh
   ```
2. **Leer archivos de la sesión**:
   - `context.md` → Contexto general
   - `requirements.md` → Qué hay que hacer
   - `plan.md` → Cómo hacerlo
   - `current/progress.md` → Estado actual
3. **Continuar desarrollo**

### Cambio de Scope

Cuando el alcance cambia significativamente:

1. **Crear nueva iteración**:
   ```bash
   ./iteration-init.sh <session> scope-change "descripción"
   ```
2. **Actualizar** `requirements.md` o `plan.md`
3. **Continuar** desde nueva iteración

### Cerrar Sesión

1. **Verificar** que todos los ACs están cumplidos
2. **Cerrar sesión**:
   ```bash
   ./session-close.sh <session> "summary"
   ```
3. **Archivar** (opcional):
   ```bash
   ./session-archive.sh <session>
   ```

---

## Templates

### Story (COMPLETE)

| Archivo | Propósito | Cambia entre iteraciones? |
|---------|-----------|---------------------------|
| `context.md` | Info permanente del proyecto | No |
| `requirements.md` | ACs, user stories | Sí (git history) |
| `plan.md` | Plan técnico | Sí (git history) |
| `scope.json` | Paths permitidos | Sí |
| `pendings.md` | Pendientes globales | Sí (acumulativo) |
| `tests.md` | Selectores, traducciones | Sí (acumulativo) |

### Task (STANDARD)

| Archivo | Propósito |
|---------|-----------|
| `requirements.md` | Objetivo y ACs |
| `progress.md` | Estado actual |

### Log (QUICK)

| Archivo | Propósito |
|---------|-----------|
| `{date}-{name}.md` | Registro del fix |

---

## Placeholders en Templates

| Placeholder | Descripción | Ejemplo |
|-------------|-------------|---------|
| `{{SESSION_NAME}}` | Nombre sin fecha | new-products-entity |
| `{{SESSION_FULL}}` | Nombre completo | 2026-01-11-new-products-entity |
| `{{DATE}}` | Fecha de creación | 2026-01-11 |
| `{{TSHIRT}}` | T-Shirt size | L |
| `{{ITERATION}}` | Número de iteración | 01 |
| `{{ITERATION_NAME}}` | Nombre de iteración | initial |
| `{{CLICKUP_URL}}` | URL de tarea (manual) | - |

---

## Integración con Comandos

Esta skill es utilizada por los comandos `/session:*`:

- `/session:start` → Usa `session-init.sh`
- `/session:resume` → Usa `session-list.sh` + lectura de archivos
- `/session:status` → Usa `session-list.sh`
- `/session:close` → Usa `session-close.sh`
- `/session:scope-change` → Usa `iteration-init.sh`

---

## Reducción de Tokens

| Operación | Sin Script | Con Script | Reducción |
|-----------|------------|------------|-----------|
| Crear story | ~2350 tokens | ~280 tokens | **88%** |
| Crear task | ~800 tokens | ~150 tokens | **81%** |
| Listar sesiones | ~500 tokens | ~100 tokens | **80%** |
| Nueva iteración | ~1200 tokens | ~200 tokens | **83%** |
