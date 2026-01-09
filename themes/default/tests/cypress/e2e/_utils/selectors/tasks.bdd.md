---
feature: Tasks Entity UI Selectors Validation
priority: high
tags: [selectors, tasks, entities, ui-validation]
grepTags: [ui-selectors, tasks, SEL_TASK_001, SEL_TASK_002, SEL_TASK_003, SEL_TASK_004, SEL_TASK_005, SEL_TASK_006, SEL_TASK_007]
coverage: 7
---

# Tasks Entity UI Selectors Validation

> Validates that Tasks entity component selectors exist in the DOM. This test validates the POM architecture with dynamic selectors works correctly for entity CRUD operations. Only checks selector presence, not full CRUD functionality.

**IMPORTANT:** Uses `TasksPOM` which extends `DashboardEntityPOM`. All dynamic selectors use entity slug `tasks`.

**Login:** Uses Carlos Mendoza (owner) via `loginAsDefaultOwner()` - requires team context for entity API calls.

## @test SEL_TASK_001: List Page Selectors

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** tasks, list, table, pagination
- **Grep:** `@ui-selectors` `@SEL_TASK_001`
- **Status:** Active (10 passing, 0 skipped)

```gherkin:en
Scenario: Tasks list page has all required selectors

Given I am logged in as owner (Carlos Mendoza)
And I navigate to /dashboard/tasks
When the list page loads
Then I should find the table container element
And I should find the add button
And I should find the search input
And I should find the search container
And I should find the select all checkbox
And I should find the pagination container
And I should find pagination controls (first, prev, next, last)
And I should find the page size selector
And I should find the page info
And I should find at least one row with dynamic selector
```

```gherkin:es
Scenario: Pagina de lista de tasks tiene todos los selectores requeridos

Given estoy logueado como owner (Carlos Mendoza)
And navego a /dashboard/tasks
When la pagina de lista carga
Then deberia encontrar el elemento contenedor de tabla
And deberia encontrar el boton de agregar
And deberia encontrar el input de busqueda
And deberia encontrar el contenedor de busqueda
And deberia encontrar el checkbox de seleccionar todo
And deberia encontrar el contenedor de paginacion
And deberia encontrar controles de paginacion (primero, anterior, siguiente, ultimo)
And deberia encontrar el selector de tamano de pagina
And deberia encontrar la info de pagina
And deberia encontrar al menos una fila con selector dinamico
```

### Expected Results
- `tasks-table-container` selector exists ✅
- `tasks-add` selector exists ✅
- `tasks-search` selector exists ✅
- `tasks-search-container` selector exists ✅
- `tasks-select-all` selector exists ✅
- `tasks-pagination` selector exists ✅
- `tasks-page-first/prev/next/last` selectors exist ✅
- `tasks-page-size` selector exists ✅
- `tasks-page-info` selector exists ✅
- `tasks-row-{id}` dynamic selectors exist ✅

---

## @test SEL_TASK_002: Filter Selectors

### Metadata
- **Priority:** Medium
- **Type:** Selector Validation
- **Tags:** tasks, filters, status, priority
- **Grep:** `@ui-selectors` `@SEL_TASK_002`
- **Status:** Active (3 passing, 0 skipped)

```gherkin:en
Scenario: Tasks list has filter selectors

Given I am logged in as owner (Carlos Mendoza)
And I navigate to /dashboard/tasks
When the list page loads
Then I should find the status filter trigger
And I should find the priority filter trigger
When I open the status filter
Then I should find the filter options content
```

```gherkin:es
Scenario: Lista de tasks tiene selectores de filtro

Given estoy logueado como owner (Carlos Mendoza)
And navego a /dashboard/tasks
When la pagina de lista carga
Then deberia encontrar el trigger del filtro de status
And deberia encontrar el trigger del filtro de prioridad
When abro el filtro de status
Then deberia encontrar el contenido de opciones del filtro
```

### Expected Results
- `tasks-filter-status-trigger` selector exists ✅
- `tasks-filter-priority-trigger` selector exists ✅
- `tasks-filter-status-content` selector visible when opened ✅

---

## @test SEL_TASK_003: Row Dynamic Selectors

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** tasks, rows, dynamic
- **Grep:** `@ui-selectors` `@SEL_TASK_003`
- **Status:** Active (1 passing, 0 skipped)

```gherkin:en
Scenario: Tasks rows have dynamic selectors with ID

Given I am logged in as owner (Carlos Mendoza)
And I navigate to /dashboard/tasks
When the list page loads with at least one task
Then I should extract the row ID from data-cy attribute
And I should find the row element with dynamic selector
And I should find the row select checkbox with dynamic ID
And I should find the row menu with dynamic ID
```

```gherkin:es
Scenario: Filas de tasks tienen selectores dinamicos con ID

Given estoy logueado como owner (Carlos Mendoza)
And navego a /dashboard/tasks
When la pagina de lista carga con al menos una tarea
Then deberia extraer el ID de fila del atributo data-cy
And deberia encontrar el elemento de fila con selector dinamico
And deberia encontrar el checkbox de seleccion de fila con ID dinamico
And deberia encontrar el menu de fila con ID dinamico
```

### Expected Results
- `tasks-row-{id}` dynamic selector works ✅
- `tasks-row-select-{id}` dynamic selector works ✅
- `tasks-row-menu-{id}` dynamic selector works ✅

---

## @test SEL_TASK_004: Create Page Selectors

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** tasks, create, form, fields
- **Grep:** `@ui-selectors` `@SEL_TASK_004`
- **Status:** Active (8 passing, 0 skipped)

```gherkin:en
Scenario: Tasks create page has form selectors

Given I am logged in as owner (Carlos Mendoza)
And I navigate to /dashboard/tasks/new
When the create form loads
Then I should find the form container
And I should find the submit button
And I should find the create header
And I should find the back button
And I should find the title field
And I should find the description field
And I should find the status field
And I should find the priority field
```

```gherkin:es
Scenario: Pagina de creacion de tasks tiene selectores de formulario

Given estoy logueado como owner (Carlos Mendoza)
And navego a /dashboard/tasks/new
When el formulario de creacion carga
Then deberia encontrar el contenedor del formulario
And deberia encontrar el boton de submit
And deberia encontrar el header de creacion
And deberia encontrar el boton de volver
And deberia encontrar el campo de titulo
And deberia encontrar el campo de descripcion
And deberia encontrar el campo de status
And deberia encontrar el campo de prioridad
```

### Expected Results
- `tasks-form` selector exists ✅
- `tasks-form-submit` selector exists ✅
- `tasks-create-header` selector exists ✅
- `tasks-back` selector exists ✅
- `tasks-field-title` selector exists ✅
- `tasks-field-description` selector exists ✅
- `tasks-field-status` selector exists ✅
- `tasks-field-priority` selector exists ✅

---

## @test SEL_TASK_005: Detail Page Selectors

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** tasks, detail, view, actions
- **Grep:** `@ui-selectors` `@SEL_TASK_005`
- **Status:** Active (1 passing, 0 skipped)

```gherkin:en
Scenario: Tasks detail page has view selectors

Given I am logged in as owner (Carlos Mendoza)
And I navigate to /dashboard/tasks
When I get a task ID from the list
And I navigate to the task detail page
Then I should find the view header
And I should find the edit button
And I should find the delete button
And I should find the back button
```

```gherkin:es
Scenario: Pagina de detalle de tasks tiene selectores de vista

Given estoy logueado como owner (Carlos Mendoza)
And navego a /dashboard/tasks
When obtengo un ID de tarea de la lista
And navego a la pagina de detalle de la tarea
Then deberia encontrar el header de vista
And deberia encontrar el boton de editar
And deberia encontrar el boton de eliminar
And deberia encontrar el boton de volver
```

### Expected Results
- `tasks-view-header` selector exists ✅
- `tasks-edit-btn` selector exists ✅
- `tasks-delete-btn` selector exists ✅
- `tasks-back` selector exists ✅

---

## @test SEL_TASK_006: Bulk Actions Selectors

### Metadata
- **Priority:** Medium
- **Type:** Selector Validation
- **Tags:** tasks, bulk, actions, selection
- **Grep:** `@ui-selectors` `@SEL_TASK_006`
- **Status:** Active (1 passing, 0 skipped)

```gherkin:en
Scenario: Bulk action bar appears after selecting rows

Given I am logged in as owner (Carlos Mendoza)
And I navigate to /dashboard/tasks
When I select a row using the row checkbox
Then the bulk action bar should be visible
And I should find the bulk count indicator
And I should find the bulk delete button
And I should find the bulk clear button
```

```gherkin:es
Scenario: Barra de acciones masivas aparece despues de seleccionar filas

Given estoy logueado como owner (Carlos Mendoza)
And navego a /dashboard/tasks
When selecciono una fila usando el checkbox de fila
Then la barra de acciones masivas deberia ser visible
And deberia encontrar el indicador de conteo masivo
And deberia encontrar el boton de eliminar masivo
And deberia encontrar el boton de limpiar seleccion
```

### Expected Results
- `tasks-bulk-bar` visible when rows selected ✅
- `tasks-bulk-count` selector exists ✅
- `tasks-bulk-delete` selector exists ✅
- `tasks-bulk-clear` selector exists ✅

### Notes
`bulkStatus` not tested - `enableChangeStatus` not enabled in EntityListWrapper.

---

## @test SEL_TASK_007: Delete Dialog Selectors

### Metadata
- **Priority:** Medium
- **Type:** Selector Validation
- **Tags:** tasks, delete, dialog, confirmation
- **Grep:** `@ui-selectors` `@SEL_TASK_007`
- **Status:** Active (1 passing, 0 skipped)

```gherkin:en
Scenario: Delete dialog has confirmation selectors

Given I am logged in as owner (Carlos Mendoza)
And I navigate to a task detail page
When I click the delete button
Then the delete dialog should be visible
And I should find the confirm delete button
And I should find the cancel button
When I click cancel
Then the dialog should close
```

```gherkin:es
Scenario: Dialogo de eliminacion tiene selectores de confirmacion

Given estoy logueado como owner (Carlos Mendoza)
And navego a una pagina de detalle de tarea
When hago click en el boton de eliminar
Then el dialogo de eliminacion deberia ser visible
And deberia encontrar el boton de confirmar eliminacion
And deberia encontrar el boton de cancelar
When hago click en cancelar
Then el dialogo deberia cerrarse
```

### Expected Results
- `tasks-delete-dialog` visible when delete clicked ✅
- `tasks-delete-confirm` selector exists ✅
- `tasks-delete-cancel` selector exists ✅

---

## Related Components

| Component | File | Selectors |
|-----------|------|-----------|
| EntityTable | `packages/core/src/components/entities/EntityTable.tsx` | table-container, search, add, pagination, rows |
| EntityForm | `packages/core/src/components/entities/EntityForm.tsx` | form, submit, fields |
| EntityDetail | `packages/core/src/components/entities/EntityDetail.tsx` | detail, header, actions |
| BulkActionsBar | `packages/core/src/components/entities/BulkActionsBar.tsx` | bulk-bar, count, delete, clear |
| DeleteDialog | `packages/core/src/components/entities/DeleteDialog.tsx` | dialog, confirm, cancel |

## Related POMs

| POM | File | Usage |
|-----|------|-------|
| TasksPOM | `themes/default/tests/cypress/src/entities/TasksPOM.ts` | Entity-specific selectors and methods |
| DashboardEntityPOM | `themes/default/tests/cypress/src/core/DashboardEntityPOM.ts` | Base entity POM with dynamic selectors |
