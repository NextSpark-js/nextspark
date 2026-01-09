---
feature: Scheduled Actions DevTools UI
priority: critical
tags: [uat, devtools, feat-scheduled-actions, regression]
grepTags: ["@uat", "@devtools", "@scheduled-actions"]
coverage: 24 tests
---

# Scheduled Actions DevTools UI - UAT Tests

> UAT tests for the `/devtools/scheduled-actions` page. These tests verify the developer experience for monitoring scheduled actions including page load, status display, action details, error handling, filters, and pagination.

## Access Requirements

| Requirement | Value |
|-------------|-------|
| Login Role | Developer or Superadmin |
| Page URL | `/devtools/scheduled-actions` |
| Test User | `developer@nextspark.dev` |

---

## @test SCHED-UAT-001: DevTools scheduled actions page is accessible

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** uat, scheduled-actions, page-load
- **AC:** AC-22

```gherkin:en
Scenario: Developer can access DevTools scheduled actions page

Given I am logged in as a developer
When I visit /devtools/scheduled-actions
Then I should see the scheduled actions page
And the page should be fully loaded
```

```gherkin:es
Scenario: Developer puede acceder a la pagina DevTools de acciones programadas

Given estoy logueado como developer
When visito /devtools/scheduled-actions
Then deberia ver la pagina de acciones programadas
And la pagina deberia estar completamente cargada
```

---

## @test SCHED-UAT-002: Page displays title and description

### Metadata
- **Priority:** Normal
- **Type:** Smoke
- **Tags:** uat, scheduled-actions, page-load
- **AC:** AC-22

```gherkin:en
Scenario: Page shows title and helpful description

Given I am on the scheduled actions page
Then I should see "Scheduled Actions" title
And I should see a description of the feature
```

```gherkin:es
Scenario: Pagina muestra titulo y descripcion util

Given estoy en la pagina de acciones programadas
Then deberia ver el titulo "Scheduled Actions"
And deberia ver una descripcion de la funcionalidad
```

---

## @test SCHED-UAT-010: Table shows status badges for all states

### Metadata
- **Priority:** Critical
- **Type:** Functional
- **Tags:** uat, scheduled-actions, status-display
- **AC:** AC-23

```gherkin:en
Scenario: Status badges are visible for different action states

Given I am on the scheduled actions page
When the table loads
Then I should see status badges with different states
And badges should have distinct visual styles (colors)
```

```gherkin:es
Scenario: Badges de estado son visibles para diferentes estados de accion

Given estoy en la pagina de acciones programadas
When la tabla carga
Then deberia ver badges de estado con diferentes estados
And los badges deberian tener estilos visuales distintos (colores)
```

---

## @test SCHED-UAT-011: Pending status badge is visible

### Metadata
- **Priority:** Normal
- **Type:** Functional
- **Tags:** uat, scheduled-actions, status-pending
- **AC:** AC-23

```gherkin:en
Scenario: Pending actions show pending badge

Given there are pending actions
Then I should see at least one "Pending" status badge
```

```gherkin:es
Scenario: Acciones pendientes muestran badge pending

Given hay acciones pendientes
Then deberia ver al menos un badge de estado "Pending"
```

---

## @test SCHED-UAT-012: Completed status badge is visible when actions complete

### Metadata
- **Priority:** Normal
- **Type:** Functional
- **Tags:** uat, scheduled-actions, status-completed
- **AC:** AC-23

```gherkin:en
Scenario: Completed actions show completed badge

Given there are completed actions
Then I should see at least one "Completed" status badge
```

```gherkin:es
Scenario: Acciones completadas muestran badge completed

Given hay acciones completadas
Then deberia ver al menos un badge de estado "Completed"
```

---

## @test SCHED-UAT-013: Failed status badge is visible for failed actions

### Metadata
- **Priority:** Normal
- **Type:** Functional
- **Tags:** uat, scheduled-actions, status-failed
- **AC:** AC-23

```gherkin:en
Scenario: Failed actions show failed badge with destructive styling

Given there are failed actions
Then I should see at least one "Failed" status badge
And the badge should have destructive (red) styling
```

```gherkin:es
Scenario: Acciones fallidas muestran badge failed con estilo destructivo

Given hay acciones fallidas
Then deberia ver al menos un badge de estado "Failed"
And el badge deberia tener estilo destructivo (rojo)
```

---

## @test SCHED-UAT-020: Table shows all required columns

### Metadata
- **Priority:** Critical
- **Type:** Functional
- **Tags:** uat, scheduled-actions, table-columns
- **AC:** AC-24

```gherkin:en
Scenario: Table displays all required column headers

Given I am on the scheduled actions page
Then I should see column headers for:
  - Type
  - Status
  - Scheduled At
  - Team
  - Payload
  - Error
```

```gherkin:es
Scenario: Tabla muestra todos los encabezados de columna requeridos

Given estoy en la pagina de acciones programadas
Then deberia ver encabezados de columna para:
  - Type
  - Status
  - Scheduled At
  - Team
  - Payload
  - Error
```

---

## @test SCHED-UAT-021: Action type is displayed in table

### Metadata
- **Priority:** Normal
- **Type:** Functional
- **Tags:** uat, scheduled-actions, action-type
- **AC:** AC-24

```gherkin:en
Scenario: Each action shows its type

Given there are actions in the table
Then each row should display the action type
And the type should be in monospace font for readability
```

```gherkin:es
Scenario: Cada accion muestra su tipo

Given hay acciones en la tabla
Then cada fila deberia mostrar el tipo de accion
And el tipo deberia estar en fuente monospace para legibilidad
```

---

## @test SCHED-UAT-022: Scheduled time is formatted and displayed

### Metadata
- **Priority:** Normal
- **Type:** Functional
- **Tags:** uat, scheduled-actions, scheduled-at
- **AC:** AC-24

```gherkin:en
Scenario: Each action shows when it's scheduled to run

Given there are actions in the table
Then each row should display the scheduled time
And the time should be formatted in a readable way
```

```gherkin:es
Scenario: Cada accion muestra cuando esta programada para ejecutarse

Given hay acciones en la tabla
Then cada fila deberia mostrar el tiempo programado
And el tiempo deberia estar formateado de manera legible
```

---

## @test SCHED-UAT-023: Team ID is displayed or shows "Global"

### Metadata
- **Priority:** Normal
- **Type:** Functional
- **Tags:** uat, scheduled-actions, team-context
- **AC:** AC-24

```gherkin:en
Scenario: Each action shows team context

Given there are actions in the table
Then each row should display the team ID
Or show "Global" for system-wide actions (no team context)
```

```gherkin:es
Scenario: Cada accion muestra el contexto de equipo

Given hay acciones en la tabla
Then cada fila deberia mostrar el ID del equipo
O mostrar "Global" para acciones del sistema (sin contexto de equipo)
```

---

## @test SCHED-UAT-024: Payload preview is visible

### Metadata
- **Priority:** Normal
- **Type:** Functional
- **Tags:** uat, scheduled-actions, payload
- **AC:** AC-24

```gherkin:en
Scenario: Each action shows a payload preview

Given there are actions in the table
Then each row should show a preview of the payload
And clicking the row should expand to show full payload
```

```gherkin:es
Scenario: Cada accion muestra una vista previa del payload

Given hay acciones en la tabla
Then cada fila deberia mostrar una vista previa del payload
And hacer clic en la fila deberia expandir para mostrar payload completo
```

---

## @test SCHED-UAT-030: Error column is visible in table

### Metadata
- **Priority:** Critical
- **Type:** Functional
- **Tags:** uat, scheduled-actions, error-display
- **AC:** AC-25

```gherkin:en
Scenario: Table has an error column

Given I am on the scheduled actions page
Then I should see an "Error" column header
```

```gherkin:es
Scenario: Tabla tiene una columna de error

Given estoy en la pagina de acciones programadas
Then deberia ver un encabezado de columna "Error"
```

---

## @test SCHED-UAT-031: Failed actions display error message

### Metadata
- **Priority:** Critical
- **Type:** Functional
- **Tags:** uat, scheduled-actions, error-message
- **AC:** AC-25

```gherkin:en
Scenario: Failed actions show error details

Given there are failed actions in the table
Then each failed action should display its error message
And the error should be visible in the Error column
```

```gherkin:es
Scenario: Acciones fallidas muestran detalles del error

Given hay acciones fallidas en la tabla
Then cada accion fallida deberia mostrar su mensaje de error
And el error deberia ser visible en la columna Error
```

---

## @test SCHED-UAT-032: Error message is expandable for full details

### Metadata
- **Priority:** Normal
- **Type:** Functional
- **Tags:** uat, scheduled-actions, error-expansion
- **AC:** AC-25

```gherkin:en
Scenario: User can expand row to see full error message

Given there is a failed action with an error message
When I click on the row
Then the row should expand
And I should see the full error message
```

```gherkin:es
Scenario: Usuario puede expandir fila para ver mensaje de error completo

Given hay una accion fallida con un mensaje de error
When hago clic en la fila
Then la fila deberia expandirse
And deberia ver el mensaje de error completo
```

---

## @test SCHED-UAT-040: Status filter is visible and functional

### Metadata
- **Priority:** Critical
- **Type:** Functional
- **Tags:** uat, scheduled-actions, filters
- **AC:** AC-26

```gherkin:en
Scenario: User can filter by action status

Given I am on the scheduled actions page
Then I should see a status filter dropdown
And the dropdown should have options: All, Pending, Running, Completed, Failed
```

```gherkin:es
Scenario: Usuario puede filtrar por estado de accion

Given estoy en la pagina de acciones programadas
Then deberia ver un dropdown de filtro de estado
And el dropdown deberia tener opciones: All, Pending, Running, Completed, Failed
```

---

## @test SCHED-UAT-041: Action type filter is visible and functional

### Metadata
- **Priority:** Critical
- **Type:** Functional
- **Tags:** uat, scheduled-actions, filters
- **AC:** AC-26

```gherkin:en
Scenario: User can filter by action type

Given I am on the scheduled actions page
Then I should see an action type filter dropdown
And the dropdown should have "All" plus registered action types
```

```gherkin:es
Scenario: Usuario puede filtrar por tipo de accion

Given estoy en la pagina de acciones programadas
Then deberia ver un dropdown de filtro de tipo de accion
And el dropdown deberia tener "All" mas los tipos de accion registrados
```

---

## @test SCHED-UAT-042: Filtering by status updates the table

### Metadata
- **Priority:** Critical
- **Type:** Functional
- **Tags:** uat, scheduled-actions, filter-status
- **AC:** AC-26

```gherkin:en
Scenario: Filtering by status shows only matching actions

Given I am on the scheduled actions page
And there are actions with different statuses
When I select "Pending" from the status filter
Then the table should only show pending actions
```

```gherkin:es
Scenario: Filtrar por estado muestra solo acciones coincidentes

Given estoy en la pagina de acciones programadas
And hay acciones con diferentes estados
When selecciono "Pending" del filtro de estado
Then la tabla deberia mostrar solo acciones pending
```

---

## @test SCHED-UAT-043: Filtering by action type updates the table

### Metadata
- **Priority:** Critical
- **Type:** Functional
- **Tags:** uat, scheduled-actions, filter-type
- **AC:** AC-26

```gherkin:en
Scenario: Filtering by action type shows only matching actions

Given I am on the scheduled actions page
And there are actions of different types
When I select a specific action type from the filter
Then the table should only show actions of that type
```

```gherkin:es
Scenario: Filtrar por tipo de accion muestra solo acciones coincidentes

Given estoy en la pagina de acciones programadas
And hay acciones de diferentes tipos
When selecciono un tipo de accion especifico del filtro
Then la tabla deberia mostrar solo acciones de ese tipo
```

---

## @test SCHED-UAT-044: Reset button clears all filters

### Metadata
- **Priority:** Normal
- **Type:** Functional
- **Tags:** uat, scheduled-actions, filter-reset
- **AC:** AC-26

```gherkin:en
Scenario: User can reset filters to show all actions

Given I have applied filters (status or action type)
When I click the reset button
Then all filters should be cleared
And the table should show all actions again
```

```gherkin:es
Scenario: Usuario puede resetear filtros para mostrar todas las acciones

Given he aplicado filtros (estado o tipo de accion)
When hago clic en el boton reset
Then todos los filtros deberian limpiarse
And la tabla deberia mostrar todas las acciones de nuevo
```

---

## @test SCHED-UAT-045: Multiple filters can be combined

### Metadata
- **Priority:** Normal
- **Type:** Functional
- **Tags:** uat, scheduled-actions, filter-combined
- **AC:** AC-26

```gherkin:en
Scenario: User can combine status and action type filters

Given I am on the scheduled actions page
When I select a status filter
And I select an action type filter (if available)
Then the table should show actions matching both filters
```

```gherkin:es
Scenario: Usuario puede combinar filtros de estado y tipo de accion

Given estoy en la pagina de acciones programadas
When selecciono un filtro de estado
And selecciono un filtro de tipo de accion (si esta disponible)
Then la tabla deberia mostrar acciones que coincidan con ambos filtros
```

---

## @test SCHED-UAT-050: Empty state is shown when no actions exist

### Metadata
- **Priority:** Normal
- **Type:** Functional
- **Tags:** uat, scheduled-actions, empty-state

```gherkin:en
Scenario: Empty state message when no actions

Given there are no scheduled actions in the database
When I visit the page
Then I should see an empty state message
And the message should explain there are no scheduled actions
```

```gherkin:es
Scenario: Mensaje de estado vacio cuando no hay acciones

Given no hay acciones programadas en la base de datos
When visito la pagina
Then deberia ver un mensaje de estado vacio
And el mensaje deberia explicar que no hay acciones programadas
```

---

## @test SCHED-UAT-060: Pagination controls are visible when needed

### Metadata
- **Priority:** Normal
- **Type:** Functional
- **Tags:** uat, scheduled-actions, pagination

```gherkin:en
Scenario: Pagination appears when there are many actions

Given there are more than 20 actions (default page size)
When I visit the page
Then I should see pagination controls
And I should see Previous and Next buttons
```

```gherkin:es
Scenario: Paginacion aparece cuando hay muchas acciones

Given hay mas de 20 acciones (tamano de pagina por defecto)
When visito la pagina
Then deberia ver controles de paginacion
And deberia ver botones Previous y Next
```

---

## @test SCHED-UAT-061: Next button works when there are more pages

### Metadata
- **Priority:** Normal
- **Type:** Functional
- **Tags:** uat, scheduled-actions, pagination-next

```gherkin:en
Scenario: User can navigate to next page

Given there are multiple pages of actions
When I click the Next button
Then the table should load the next page
And different actions should be displayed
```

```gherkin:es
Scenario: Usuario puede navegar a la siguiente pagina

Given hay multiples paginas de acciones
When hago clic en el boton Next
Then la tabla deberia cargar la siguiente pagina
And diferentes acciones deberian mostrarse
```

---

## @test SCHED-UAT-062: Previous button works when on later pages

### Metadata
- **Priority:** Normal
- **Type:** Functional
- **Tags:** uat, scheduled-actions, pagination-prev

```gherkin:en
Scenario: User can navigate to previous page

Given I am on page 2 or later
When I click the Previous button
Then the table should load the previous page
```

```gherkin:es
Scenario: Usuario puede navegar a la pagina anterior

Given estoy en pagina 2 o posterior
When hago clic en el boton Previous
Then la tabla deberia cargar la pagina anterior
```

---

## Test Summary

| Test ID | Section | Description | Priority | AC |
|---------|---------|-------------|----------|-----|
| SCHED-UAT-001 | Page Load | Page accessible | Critical | AC-22 |
| SCHED-UAT-002 | Page Load | Title and description | Normal | AC-22 |
| SCHED-UAT-010 | Status Display | Status badges visible | Critical | AC-23 |
| SCHED-UAT-011 | Status Display | Pending badge | Normal | AC-23 |
| SCHED-UAT-012 | Status Display | Completed badge | Normal | AC-23 |
| SCHED-UAT-013 | Status Display | Failed badge | Normal | AC-23 |
| SCHED-UAT-020 | Action Details | All columns visible | Critical | AC-24 |
| SCHED-UAT-021 | Action Details | Action type displayed | Normal | AC-24 |
| SCHED-UAT-022 | Action Details | Scheduled time | Normal | AC-24 |
| SCHED-UAT-023 | Action Details | Team ID or Global | Normal | AC-24 |
| SCHED-UAT-024 | Action Details | Payload preview | Normal | AC-24 |
| SCHED-UAT-030 | Error Display | Error column visible | Critical | AC-25 |
| SCHED-UAT-031 | Error Display | Error message shown | Critical | AC-25 |
| SCHED-UAT-032 | Error Display | Expandable error | Normal | AC-25 |
| SCHED-UAT-040 | Filters | Status filter | Critical | AC-26 |
| SCHED-UAT-041 | Filters | Action type filter | Critical | AC-26 |
| SCHED-UAT-042 | Filters | Status filter works | Critical | AC-26 |
| SCHED-UAT-043 | Filters | Type filter works | Critical | AC-26 |
| SCHED-UAT-044 | Filters | Reset button | Normal | AC-26 |
| SCHED-UAT-045 | Filters | Combined filters | Normal | AC-26 |
| SCHED-UAT-050 | Empty State | Empty state message | Normal | - |
| SCHED-UAT-060 | Pagination | Controls visible | Normal | - |
| SCHED-UAT-061 | Pagination | Next button | Normal | - |
| SCHED-UAT-062 | Pagination | Previous button | Normal | - |

---

## Visual Flow

```
[Login as Developer] → [Visit /devtools/scheduled-actions]
                              │
                              ▼
                     ┌────────────────┐
                     │   Page Load    │
                     │  Title + Desc  │
                     └───────┬────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │         Data Table           │
              │ ┌──────┬──────┬────────────┐ │
              │ │ Type │Status│ScheduledAt │ │
              │ ├──────┼──────┼────────────┤ │
              │ │ ...  │ 🟡   │ 2025-12-30 │ │
              │ │ ...  │ 🟢   │ 2025-12-29 │ │
              │ │ ...  │ 🔴   │ 2025-12-28 │ │
              │ └──────┴──────┴────────────┘ │
              └──────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ Filters  │  │  Empty   │  │Pagination│
        │Status/Type│  │  State   │  │ Prev/Next│
        └──────────┘  └──────────┘  └──────────┘
```

## Status Badge Colors

| Status | Color | Badge Variant |
|--------|-------|---------------|
| Pending | Yellow | `warning` |
| Running | Blue | `info` |
| Completed | Green | `success` |
| Failed | Red | `destructive` |
