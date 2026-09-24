---
feature: Tasks CRUD UAT Tests
priority: high
tags: [uat, tasks, crud, entity]
grepTags: [uat, tasks, crud, TASKS_CRUD_001, TASKS_CRUD_002, TASKS_CRUD_003, TASKS_CRUD_004, TASKS_CRUD_005, TASKS_CRUD_006]
coverage: 6
---

# Tasks CRUD UAT Tests

> Complete CRUD test suite for the Tasks entity. Demonstrates login using session helpers, creating, reading, updating, and deleting tasks, filtering and searching tasks, and using POM pattern for maintainability.

## @test TASKS_CRUD_001: Create Task

### Metadata
- **Priority:** High
- **Type:** UAT
- **Tags:** create, task, form
- **Grep:** `@uat` `@tasks` `@TASKS_CRUD_001`
- **Status:** Active - 3 tests

```gherkin:en
Scenario: Create a new task with minimal data

Given I am logged in as owner
And I am on the tasks list page
When I click the add button
And I fill the title field with a unique task name
And I submit the form
Then I should be redirected to the tasks list
And the new task should appear in the list
```

```gherkin:es
Scenario: Crear una nueva tarea con datos minimos

Given estoy logueado como owner
And estoy en la pagina de lista de tareas
When hago clic en el boton agregar
And lleno el campo titulo con un nombre unico de tarea
And envio el formulario
Then deberia ser redirigido a la lista de tareas
And la nueva tarea deberia aparecer en la lista
```

### Expected Results
- Task is created successfully
- User is redirected to list
- New task appears in list with correct title

---

## @test TASKS_CRUD_002: Read/View Task

### Metadata
- **Priority:** High
- **Type:** UAT
- **Tags:** read, view, task, detail
- **Grep:** `@uat` `@tasks` `@TASKS_CRUD_002`
- **Status:** Active - 3 tests

```gherkin:en
Scenario: View task in list and detail page

Given I am logged in as owner
And a test task exists via API
When I navigate to the tasks list
Then the task should be visible in the list
When I click on the task row
Then I should be on the task detail page
And the task details should be displayed correctly
```

```gherkin:es
Scenario: Ver tarea en lista y pagina de detalle

Given estoy logueado como owner
And existe una tarea de prueba via API
When navego a la lista de tareas
Then la tarea deberia ser visible en la lista
When hago clic en la fila de la tarea
Then deberia estar en la pagina de detalle de la tarea
And los detalles de la tarea deberian mostrarse correctamente
```

### Expected Results
- Task appears in list
- Navigation to detail page works
- Task details are displayed correctly

---

## @test TASKS_CRUD_003: Update Task

### Metadata
- **Priority:** High
- **Type:** UAT
- **Tags:** update, edit, task, form
- **Grep:** `@uat` `@tasks` `@TASKS_CRUD_003`
- **Status:** Active - 3 tests

```gherkin:en
Scenario: Update task title, status, and priority

Given I am logged in as owner
And a test task exists via API
When I navigate to the task edit page
And I change the title to a new value
And I submit the form
Then the task list should show the updated title
When I navigate to edit and change the status
Then the task should reflect the new status
When I navigate to edit and change the priority
Then the task should reflect the new priority
```

```gherkin:es
Scenario: Actualizar titulo, estado y prioridad de tarea

Given estoy logueado como owner
And existe una tarea de prueba via API
When navego a la pagina de edicion de la tarea
And cambio el titulo a un nuevo valor
And envio el formulario
Then la lista de tareas deberia mostrar el titulo actualizado
When navego a editar y cambio el estado
Then la tarea deberia reflejar el nuevo estado
When navego a editar y cambio la prioridad
Then la tarea deberia reflejar la nueva prioridad
```

### Expected Results
- Title updates correctly
- Status updates correctly
- Priority updates correctly

---

## @test TASKS_CRUD_004: Delete Task

### Metadata
- **Priority:** High
- **Type:** UAT
- **Tags:** delete, task, confirm
- **Grep:** `@uat` `@tasks` `@TASKS_CRUD_004`
- **Status:** Active - 2 tests

```gherkin:en
Scenario: Delete task from detail page

Given I am logged in as owner
And a test task exists via API
When I navigate to the task detail page
And I click the delete button
And I confirm the deletion
Then I should be redirected to the tasks list
And the task should no longer appear in the list

Scenario: Cancel delete operation

Given I am logged in as owner
And a test task exists via API
When I navigate to the task detail page
And I click the delete button
And I cancel the deletion
Then I should still be on the detail page
And the task should still exist
```

```gherkin:es
Scenario: Eliminar tarea desde pagina de detalle

Given estoy logueado como owner
And existe una tarea de prueba via API
When navego a la pagina de detalle de la tarea
And hago clic en el boton eliminar
And confirmo la eliminacion
Then deberia ser redirigido a la lista de tareas
And la tarea ya no deberia aparecer en la lista

Scenario: Cancelar operacion de eliminacion

Given estoy logueado como owner
And existe una tarea de prueba via API
When navego a la pagina de detalle de la tarea
And hago clic en el boton eliminar
And cancelo la eliminacion
Then deberia seguir en la pagina de detalle
And la tarea deberia seguir existiendo
```

### Expected Results
- Delete with confirmation removes task
- Cancel delete preserves task

---

## @test TASKS_CRUD_005: Filter Tasks

### Metadata
- **Priority:** Medium
- **Type:** UAT
- **Tags:** filter, tasks, status, priority
- **Grep:** `@uat` `@tasks` `@TASKS_CRUD_005`
- **Status:** Active - 3 tests

```gherkin:en
Scenario: Filter tasks by status and priority

Given I am logged in as owner
And multiple tasks exist with different statuses and priorities
When I filter by status "todo"
Then only tasks with status "todo" should be visible
When I filter by priority "high"
Then only tasks with priority "high" should be visible
When I clear the filters
Then all tasks should be visible again
```

```gherkin:es
Scenario: Filtrar tareas por estado y prioridad

Given estoy logueado como owner
And existen multiples tareas con diferentes estados y prioridades
When filtro por estado "todo"
Then solo las tareas con estado "todo" deberian ser visibles
When filtro por prioridad "high"
Then solo las tareas con prioridad "high" deberian ser visibles
When limpio los filtros
Then todas las tareas deberian ser visibles nuevamente
```

### Expected Results
- Status filter works correctly
- Priority filter works correctly
- Clearing filters shows all tasks

---

## @test TASKS_CRUD_006: Search Tasks

### Metadata
- **Priority:** Medium
- **Type:** UAT
- **Tags:** search, tasks, title
- **Grep:** `@uat` `@tasks` `@TASKS_CRUD_006`
- **Status:** Active - 3 tests

```gherkin:en
Scenario: Search tasks by title

Given I am logged in as owner
And tasks exist with various titles
When I search for a specific term
Then only matching tasks should be visible
When I search for a non-existent term
Then no tasks should be visible
When I clear the search
Then all tasks should be visible again
```

```gherkin:es
Scenario: Buscar tareas por titulo

Given estoy logueado como owner
And existen tareas con varios titulos
When busco un termino especifico
Then solo las tareas coincidentes deberian ser visibles
When busco un termino que no existe
Then no deberian verse tareas
When limpio la busqueda
Then todas las tareas deberian ser visibles nuevamente
```

### Expected Results
- Search finds matching tasks
- Search shows empty for no matches
- Clearing search shows all tasks
