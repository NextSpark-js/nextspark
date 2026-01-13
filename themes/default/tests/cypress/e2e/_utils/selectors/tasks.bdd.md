---
feature: Tasks Entity UI Selectors Validation
priority: high
tags: [selectors, tasks, entities, ui-validation]
grepTags: [ui-selectors, entities, tasks, entities-list, SEL_TASK_PAGE_001, SEL_TASK_LIST_001, SEL_TASK_LIST_002, SEL_TASK_LIST_003, SEL_TASK_LIST_004, SEL_TASK_LIST_005, SEL_TASK_LIST_006, SEL_TASK_LIST_007, SEL_TASK_HEADER_001, SEL_TASK_DETAIL_001, SEL_TASK_FORM_001]
coverage: 11
---

# Tasks Entity UI Selectors Validation

> Validates that all entity selectors exist in the DOM. Organized by the 6 first-level keys in ENTITIES_SELECTORS: PAGE, LIST, HEADER, DETAIL, FORM, CHILD.

**IMPORTANT:** Uses `TasksPOM` which extends `DashboardEntityPOM`. All dynamic selectors use entity slug `tasks`. Follows ENTITIES_SELECTORS structure from `entities.selectors.ts`.

**Login:** Uses Carlos Mendoza (owner) via `loginAsDefaultOwner()` - requires team context for entity API calls.

**Structure (matches entities.selectors.ts):**
1. PAGE - Page-level container
2. LIST - List view (search, filters, table, pagination, bulk, confirm)
3. HEADER - Entity detail header (view/edit/create modes)
4. DETAIL - Detail view container
5. FORM - Form container, fields, and actions
6. CHILD - Child entity management (not applicable for tasks)

---

## @test SEL_TASK_PAGE_001: Page Container

### Metadata
- **Priority:** Medium
- **Type:** Selector Validation
- **Tags:** tasks, page, container
- **Grep:** `@ui-selectors` `@SEL_TASK_PAGE_001`
- **Status:** Skipped (not implemented in EntityList)

```gherkin:en
Scenario: Tasks page has page container selector

Given I am logged in as owner (Carlos Mendoza)
And I navigate to /dashboard/tasks
When the list page loads
Then I should find the page container element
```

```gherkin:es
Scenario: La pagina de tasks tiene selector de contenedor de pagina

Given estoy logueado como owner (Carlos Mendoza)
And navego a /dashboard/tasks
When la pagina de lista carga
Then deberia encontrar el elemento contenedor de pagina
```

### Expected Results
| Selector Path | POM Accessor | data-cy Value | Status |
|---------------|--------------|---------------|--------|
| entities.page.container | tasks.selectors.page | tasks-page | **NOT IMPLEMENTED** |

### Notes
Page container selector not currently implemented in EntityList component. The page container would wrap the entire entity list view.

---

## @test SEL_TASK_LIST_001: Search Selectors

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** tasks, list, search
- **Grep:** `@ui-selectors` `@entities-list` `@SEL_TASK_LIST_001`
- **Status:** Active (1 passing, 2 skipped)

```gherkin:en
Scenario: Tasks list has search selectors

Given I am logged in as owner (Carlos Mendoza)
And I navigate to /dashboard/tasks
When the list page loads
Then I should find the search input
And I should find the search container (not implemented)
And I should find the search clear button (not implemented)
```

```gherkin:es
Scenario: La lista de tasks tiene selectores de busqueda

Given estoy logueado como owner (Carlos Mendoza)
And navego a /dashboard/tasks
When la pagina de lista carga
Then deberia encontrar el input de busqueda
And deberia encontrar el contenedor de busqueda (no implementado)
And deberia encontrar el boton de limpiar busqueda (no implementado)
```

### Expected Results
| Selector Path | POM Accessor | data-cy Value | Status |
|---------------|--------------|---------------|--------|
| entities.list.search.input | tasks.selectors.search | tasks-search-input | Implemented |
| entities.list.search.container | tasks.selectors.searchContainer | tasks-search | **NOT IMPLEMENTED** |
| entities.list.search.clear | tasks.selectors.searchClear | tasks-search-clear | **NOT IMPLEMENTED** |

---

## @test SEL_TASK_LIST_002: Table Structure Selectors

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** tasks, list, table
- **Grep:** `@ui-selectors` `@entities-list` `@SEL_TASK_LIST_002`
- **Status:** Active (4 passing, 1 skipped)

```gherkin:en
Scenario: Tasks list has table structure selectors

Given I am logged in as owner (Carlos Mendoza)
And I navigate to /dashboard/tasks
When the list page loads
Then I should find the table container
And I should find the table element
And I should find the add button
And I should find the select all checkbox
And I should find the selection count (only when items selected)
```

```gherkin:es
Scenario: La lista de tasks tiene selectores de estructura de tabla

Given estoy logueado como owner (Carlos Mendoza)
And navego a /dashboard/tasks
When la pagina de lista carga
Then deberia encontrar el contenedor de tabla
And deberia encontrar el elemento de tabla
And deberia encontrar el boton de agregar
And deberia encontrar el checkbox de seleccionar todo
And deberia encontrar el conteo de seleccion (solo cuando hay items seleccionados)
```

### Expected Results
| Selector Path | POM Accessor | data-cy Value | Status |
|---------------|--------------|---------------|--------|
| entities.list.table.container | tasks.selectors.tableContainer | tasks-table-container | Implemented |
| entities.list.table.element | tasks.selectors.table | tasks-table | Implemented |
| entities.list.addButton | tasks.selectors.addButton | tasks-add | Implemented |
| entities.list.table.selectAll | tasks.selectors.selectAll | tasks-select-all | Implemented |
| entities.list.selectionCount | tasks.selectors.selectionCount | tasks-selection-count | **Only visible when items selected** |

---

## @test SEL_TASK_LIST_003: Row Dynamic Selectors

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** tasks, list, rows, dynamic
- **Grep:** `@ui-selectors` `@entities-list` `@SEL_TASK_LIST_003`
- **Status:** Active (3 passing, 0 skipped)

```gherkin:en
Scenario: Tasks rows have dynamic selectors with ID

Given I am logged in as owner (Carlos Mendoza)
And I navigate to /dashboard/tasks
When the list page loads with at least one task
Then I should find row elements with rowGeneric pattern
And I should extract the row ID from data-cy attribute
And I should find the row element with dynamic selector
And I should find the row select checkbox with dynamic ID
And I should find the row menu with dynamic ID
When I open the row menu
Then I should find row action selectors (view, edit, delete)
```

```gherkin:es
Scenario: Las filas de tasks tienen selectores dinamicos con ID

Given estoy logueado como owner (Carlos Mendoza)
And navego a /dashboard/tasks
When la pagina de lista carga con al menos una tarea
Then deberia encontrar elementos de fila con patron rowGeneric
And deberia extraer el ID de fila del atributo data-cy
And deberia encontrar el elemento de fila con selector dinamico
And deberia encontrar el checkbox de seleccion de fila con ID dinamico
And deberia encontrar el menu de fila con ID dinamico
When abro el menu de fila
Then deberia encontrar selectores de accion de fila (ver, editar, eliminar)
```

### Expected Results
| Selector Path | POM Accessor | data-cy Value | Status |
|---------------|--------------|---------------|--------|
| entities.list.table.row (generic) | tasks.selectors.rowGeneric | tasks-row-* | Implemented |
| entities.list.table.row.element | tasks.selectors.row(id) | tasks-row-{id} | Implemented |
| entities.list.table.row.checkbox | tasks.selectors.rowSelect(id) | tasks-row-select-{id} | Implemented |
| entities.list.table.row.menu | tasks.selectors.rowMenu(id) | tasks-row-menu-{id} | Implemented |
| entities.list.table.row.action | tasks.selectors.rowAction(action, id) | tasks-action-{action}-{id} | Implemented |

---

## @test SEL_TASK_LIST_004: Pagination Selectors

### Metadata
- **Priority:** Medium
- **Type:** Selector Validation
- **Tags:** tasks, list, pagination
- **Grep:** `@ui-selectors` `@entities-list` `@SEL_TASK_LIST_004`
- **Status:** Active (4 passing, 0 skipped)

```gherkin:en
Scenario: Tasks list has pagination selectors

Given I am logged in as owner (Carlos Mendoza)
And I navigate to /dashboard/tasks
When the list page loads
Then I should find the pagination container
And I should find the page info
And I should find the page size selector
And I should find pagination navigation controls (first, prev, next, last)
When I open the page size dropdown
Then I should find page size options (10, 20)
```

```gherkin:es
Scenario: La lista de tasks tiene selectores de paginacion

Given estoy logueado como owner (Carlos Mendoza)
And navego a /dashboard/tasks
When la pagina de lista carga
Then deberia encontrar el contenedor de paginacion
And deberia encontrar la info de pagina
And deberia encontrar el selector de tamano de pagina
And deberia encontrar controles de navegacion de paginacion (primero, anterior, siguiente, ultimo)
When abro el dropdown de tamano de pagina
Then deberia encontrar opciones de tamano de pagina (10, 20)
```

### Expected Results
| Selector Path | POM Accessor | data-cy Value | Status |
|---------------|--------------|---------------|--------|
| entities.list.pagination.container | tasks.selectors.pagination | tasks-pagination | Implemented |
| entities.list.pagination.info | tasks.selectors.pageInfo | tasks-page-info | Implemented |
| entities.list.pagination.pageSize | tasks.selectors.pageSize | tasks-page-size | Implemented |
| entities.list.pagination.first | tasks.selectors.pageFirst | tasks-page-first | Implemented |
| entities.list.pagination.prev | tasks.selectors.pagePrev | tasks-page-prev | Implemented |
| entities.list.pagination.next | tasks.selectors.pageNext | tasks-page-next | Implemented |
| entities.list.pagination.last | tasks.selectors.pageLast | tasks-page-last | Implemented |
| entities.list.pagination.pageSizeOption | tasks.selectors.pageSizeOption(size) | tasks-page-size-{size} | Implemented |

---

## @test SEL_TASK_LIST_005: Filter Selectors

### Metadata
- **Priority:** Medium
- **Type:** Selector Validation
- **Tags:** tasks, list, filters
- **Grep:** `@ui-selectors` `@entities-list` `@SEL_TASK_LIST_005`
- **Status:** Active (4 passing, 1 skipped)

```gherkin:en
Scenario: Tasks list has filter selectors

Given I am logged in as owner (Carlos Mendoza)
And I navigate to /dashboard/tasks
When the list page loads
Then I should find the status filter trigger
And I should find the priority filter trigger
When I open the status filter
Then I should find the filter content
And I should find filter options
And I should find clear all filters button (not implemented)
```

```gherkin:es
Scenario: La lista de tasks tiene selectores de filtro

Given estoy logueado como owner (Carlos Mendoza)
And navego a /dashboard/tasks
When la pagina de lista carga
Then deberia encontrar el trigger del filtro de status
And deberia encontrar el trigger del filtro de prioridad
When abro el filtro de status
Then deberia encontrar el contenido del filtro
And deberia encontrar opciones de filtro
And deberia encontrar boton de limpiar todos los filtros (no implementado)
```

### Expected Results
| Selector Path | POM Accessor | data-cy Value | Status |
|---------------|--------------|---------------|--------|
| entities.list.filters.trigger | tasks.selectors.filterTrigger(field) | tasks-filter-{field} | Implemented |
| entities.list.filters.content | tasks.selectors.filterContent(field) | tasks-filter-{field}-content | Implemented |
| entities.list.filters.option | tasks.selectors.filterOption(field, value) | tasks-filter-{field}-{value} | Implemented |
| entities.list.filters.clearAll | tasks.selectors.filterClearAll | tasks-filter-clear-all | **NOT IMPLEMENTED** |

---

## @test SEL_TASK_LIST_006: Bulk Action Selectors

### Metadata
- **Priority:** Medium
- **Type:** Selector Validation
- **Tags:** tasks, list, bulk, actions
- **Grep:** `@ui-selectors` `@entities-list` `@SEL_TASK_LIST_006`
- **Status:** Active (2 passing, 1 skipped)

```gherkin:en
Scenario: Bulk action bar appears after selecting rows

Given I am logged in as owner (Carlos Mendoza)
And I navigate to /dashboard/tasks
When I select a row using the row checkbox
Then the bulk action bar should be visible
And I should find the bulk count indicator
And I should find the bulk delete button
And I should find the bulk clear button
And I should find the bulk status button (not enabled)
When I click bulk delete
Then I should find the bulk delete dialog
And I should find bulk delete cancel button
And I should find bulk delete confirm button
```

```gherkin:es
Scenario: La barra de acciones masivas aparece despues de seleccionar filas

Given estoy logueado como owner (Carlos Mendoza)
And navego a /dashboard/tasks
When selecciono una fila usando el checkbox de fila
Then la barra de acciones masivas deberia ser visible
And deberia encontrar el indicador de conteo masivo
And deberia encontrar el boton de eliminar masivo
And deberia encontrar el boton de limpiar seleccion
And deberia encontrar el boton de status masivo (no habilitado)
When hago click en eliminar masivo
Then deberia encontrar el dialogo de eliminar masivo
And deberia encontrar el boton de cancelar eliminar masivo
And deberia encontrar el boton de confirmar eliminar masivo
```

### Expected Results
| Selector Path | POM Accessor | data-cy Value | Status |
|---------------|--------------|---------------|--------|
| entities.list.bulk.bar | tasks.selectors.bulkBar | tasks-bulk-bar | Implemented |
| entities.list.bulk.count | tasks.selectors.bulkCount | tasks-bulk-count | Implemented |
| entities.list.bulk.deleteButton | tasks.selectors.bulkDelete | tasks-bulk-delete | Implemented |
| entities.list.bulk.clearButton | tasks.selectors.bulkClear | tasks-bulk-clear | Implemented |
| entities.list.bulk.statusButton | tasks.selectors.bulkStatus | tasks-bulk-status | **enableChangeStatus not enabled** |
| entities.list.bulk.deleteDialog | tasks.selectors.bulkDeleteDialog | tasks-bulk-delete-dialog | Implemented |
| entities.list.bulk.deleteCancel | tasks.selectors.bulkDeleteCancel | tasks-bulk-delete-cancel | Implemented |
| entities.list.bulk.deleteConfirm | tasks.selectors.bulkDeleteConfirm | tasks-bulk-delete-confirm | Implemented |

---

## @test SEL_TASK_LIST_007: Confirm Dialog Selectors

### Metadata
- **Priority:** Medium
- **Type:** Selector Validation
- **Tags:** tasks, list, confirm, dialog
- **Grep:** `@ui-selectors` `@entities-list` `@SEL_TASK_LIST_007`
- **Status:** Active (1 passing, 0 skipped)

```gherkin:en
Scenario: Confirm dialog appears for row delete action

Given I am logged in as owner (Carlos Mendoza)
And I navigate to /dashboard/tasks
When I open the row menu for a task
And I click the delete action
Then the confirm dialog should be visible
And I should find the cancel button
And I should find the confirm action button
When I click cancel
Then the dialog should close
```

```gherkin:es
Scenario: El dialogo de confirmacion aparece para la accion de eliminar fila

Given estoy logueado como owner (Carlos Mendoza)
And navego a /dashboard/tasks
When abro el menu de fila para una tarea
And hago click en la accion de eliminar
Then el dialogo de confirmacion deberia ser visible
And deberia encontrar el boton de cancelar
And deberia encontrar el boton de confirmar accion
When hago click en cancelar
Then el dialogo deberia cerrarse
```

### Expected Results
| Selector Path | POM Accessor | data-cy Value | Status |
|---------------|--------------|---------------|--------|
| entities.list.confirm.dialog | tasks.selectors.confirmDialog | tasks-confirm-dialog | Implemented |
| entities.list.confirm.cancel | tasks.selectors.confirmCancel | tasks-confirm-cancel | Implemented |
| entities.list.confirm.action | tasks.selectors.confirmAction | tasks-confirm-action | Implemented |

---

## @test SEL_TASK_HEADER_001: Header Selectors (all modes)

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** tasks, header, modes
- **Grep:** `@ui-selectors` `@SEL_TASK_HEADER_001`
- **Status:** Active (5 passing, 1 skipped)

```gherkin:en
Scenario: Create mode header has selectors

Given I am logged in as owner (Carlos Mendoza)
And I navigate to /dashboard/tasks/new
When the create form loads
Then I should find the create header
And I should find the back button
And I should find header title (not implemented in create mode)

Scenario: View mode header has selectors

Given I am logged in as owner (Carlos Mendoza)
And I navigate to a task detail page
When the detail page loads
Then I should find the view header
And I should find the back button
And I should find the edit button
And I should find the delete button
When I click delete
Then I should find the delete dialog
And I should find delete confirm button
And I should find delete cancel button

Scenario: Edit mode header has selectors

Given I am logged in as owner (Carlos Mendoza)
And I navigate to edit a task
When the edit form loads
Then I should find the edit header
And I should find the back button
```

```gherkin:es
Scenario: El header de modo crear tiene selectores

Given estoy logueado como owner (Carlos Mendoza)
And navego a /dashboard/tasks/new
When el formulario de creacion carga
Then deberia encontrar el header de crear
And deberia encontrar el boton de volver
And deberia encontrar el titulo del header (no implementado en modo crear)

Scenario: El header de modo ver tiene selectores

Given estoy logueado como owner (Carlos Mendoza)
And navego a una pagina de detalle de tarea
When la pagina de detalle carga
Then deberia encontrar el header de ver
And deberia encontrar el boton de volver
And deberia encontrar el boton de editar
And deberia encontrar el boton de eliminar
When hago click en eliminar
Then deberia encontrar el dialogo de eliminar
And deberia encontrar el boton de confirmar eliminar
And deberia encontrar el boton de cancelar eliminar

Scenario: El header de modo editar tiene selectores

Given estoy logueado como owner (Carlos Mendoza)
And navego a editar una tarea
When el formulario de edicion carga
Then deberia encontrar el header de editar
And deberia encontrar el boton de volver
```

### Expected Results
| Selector Path | POM Accessor | data-cy Value | Status |
|---------------|--------------|---------------|--------|
| entities.header.container (create) | tasks.selectors.createHeader | tasks-create-header | Implemented |
| entities.header.container (view) | tasks.selectors.viewHeader | tasks-view-header | Implemented |
| entities.header.container (edit) | tasks.selectors.editHeader | tasks-edit-header | Implemented |
| entities.header.backButton | tasks.selectors.backButton | tasks-back | Implemented |
| entities.header.title | tasks.selectors.title | tasks-header-title | **NOT IMPLEMENTED** |
| entities.header.editButton | tasks.selectors.editButton | tasks-edit-btn | Implemented |
| entities.header.deleteButton | tasks.selectors.deleteButton | tasks-delete-btn | Implemented |
| entities.header.deleteDialog | tasks.selectors.deleteDialog | tasks-delete-dialog | Implemented |
| entities.header.deleteConfirm | tasks.selectors.deleteConfirm | tasks-delete-confirm | Implemented |
| entities.header.deleteCancel | tasks.selectors.deleteCancel | tasks-delete-cancel | Implemented |

---

## @test SEL_TASK_DETAIL_001: Detail Container

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** tasks, detail, container
- **Grep:** `@ui-selectors` `@SEL_TASK_DETAIL_001`
- **Status:** Active (1 passing, 0 skipped)

```gherkin:en
Scenario: Task detail page has container selector

Given I am logged in as owner (Carlos Mendoza)
And I navigate to /dashboard/tasks
When I get a task ID from the list
And I navigate to the task detail page
Then I should find the detail container
```

```gherkin:es
Scenario: La pagina de detalle de tarea tiene selector de contenedor

Given estoy logueado como owner (Carlos Mendoza)
And navego a /dashboard/tasks
When obtengo un ID de tarea de la lista
And navego a la pagina de detalle de la tarea
Then deberia encontrar el contenedor de detalle
```

### Expected Results
| Selector Path | POM Accessor | data-cy Value | Status |
|---------------|--------------|---------------|--------|
| entities.detail.container | tasks.selectors.detail | tasks-detail | Implemented |

---

## @test SEL_TASK_FORM_001: Form Selectors

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** tasks, form, fields
- **Grep:** `@ui-selectors` `@SEL_TASK_FORM_001`
- **Status:** Active (6 passing, 0 skipped)

```gherkin:en
Scenario: Task form has all required selectors

Given I am logged in as owner (Carlos Mendoza)
And I navigate to /dashboard/tasks/new
When the create form loads
Then I should find the form container
And I should find the submit button
And I should find the title field
And I should find the description field
And I should find the status field
And I should find the priority field
```

```gherkin:es
Scenario: El formulario de tarea tiene todos los selectores requeridos

Given estoy logueado como owner (Carlos Mendoza)
And navego a /dashboard/tasks/new
When el formulario de creacion carga
Then deberia encontrar el contenedor del formulario
And deberia encontrar el boton de submit
And deberia encontrar el campo de titulo
And deberia encontrar el campo de descripcion
And deberia encontrar el campo de status
And deberia encontrar el campo de prioridad
```

### Expected Results
| Selector Path | POM Accessor | data-cy Value | Status |
|---------------|--------------|---------------|--------|
| entities.form.container | tasks.selectors.form | tasks-form | Implemented |
| entities.form.submitButton | tasks.selectors.submitButton | tasks-form-submit | Implemented |
| entities.form.field (title) | tasks.selectors.field('title') | tasks-field-title | Implemented |
| entities.form.field (description) | tasks.selectors.field('description') | tasks-field-description | Implemented |
| entities.form.field (status) | tasks.selectors.field('status') | tasks-field-status | Implemented |
| entities.form.field (priority) | tasks.selectors.field('priority') | tasks-field-priority | Implemented |

---

## Related Components

| Component | File | Selectors |
|-----------|------|-----------|
| EntityTable | `packages/core/src/components/entities/EntityTable.tsx` | table-container, search, add, pagination, rows |
| EntityForm | `packages/core/src/components/entities/EntityForm.tsx` | form, submit, fields |
| EntityDetail | `packages/core/src/components/entities/EntityDetail.tsx` | detail, header, actions |
| BulkActionsBar | `packages/core/src/components/entities/BulkActionsBar.tsx` | bulk-bar, count, delete, clear |
| ConfirmDialog | `packages/core/src/components/entities/ConfirmDialog.tsx` | dialog, confirm, cancel |
| EntityHeader | `packages/core/src/components/entities/EntityHeader.tsx` | header (create/view/edit), back, actions |

## Related POMs

| POM | File | Usage |
|-----|------|-------|
| TasksPOM | `themes/default/tests/cypress/src/entities/TasksPOM.ts` | Entity-specific selectors and methods |
| DashboardEntityPOM | `themes/default/tests/cypress/src/core/DashboardEntityPOM.ts` | Base entity POM with dynamic selectors |
