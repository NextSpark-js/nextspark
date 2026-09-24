---
feature: Tasks Management - Member Role
priority: high
tags: [tasks, member, permissions, crud-limited]
grepTags: [uat, feat-tasks, role-member, security]
coverage: 5
---

# Tasks Management - Member Role (Limited Access - No Delete)

> Test suite for Member role task permissions. Members can create, read, and update tasks but CANNOT delete them. These tests verify proper CRUD restrictions for the Member role.

## Background

```gherkin:en
Given I am logged in as Member (member@nextspark.dev)
And I have navigated to the Tasks dashboard
And the tasks list has loaded successfully
```

```gherkin:es
Given estoy logueado como Member (member@nextspark.dev)
And he navegado al dashboard de Tareas
And la lista de tareas ha cargado exitosamente
```

---

## @test MEMBER-TASK-CREATE-001: Member can create tasks

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** create, form, permissions

```gherkin:en
Scenario: Member creates a new task

Given I am logged in as a Member
And I am on the Tasks list page
When I click the "Add" button
Then the task creation form should appear

When I enter "Member's New Task" in the Title field
And I enter "Created by team member" in the Description
And I click the "Save" button
Then the form should submit successfully
And I should see the task in the list
```

```gherkin:es
Scenario: Member crea una nueva tarea

Given estoy logueado como Member
And estoy en la pagina de lista de Tareas
When hago clic en el boton "Agregar"
Then deberia aparecer el formulario de creacion

When ingreso "Nueva Tarea del Member" en el campo Titulo
And ingreso "Creado por miembro del equipo" en Descripcion
And hago clic en el boton "Guardar"
Then el formulario deberia enviarse exitosamente
And deberia ver la tarea en la lista
```

### Expected Results
- Add button is visible and clickable for Members
- Task creation form opens correctly
- Form submission creates new task
- New task appears in the list

---

## @test MEMBER-TASK-READ-001: Member can view all tasks

### Metadata
- **Priority:** High
- **Type:** Smoke
- **Tags:** read, list, permissions
- **Grep:** `@smoke`

```gherkin:en
Scenario: Member can see the tasks table

Given I am logged in as a Member
When I navigate to the Tasks dashboard
Then I should see the tasks table
And I should see all team tasks (not just my own)
```

```gherkin:es
Scenario: Member puede ver la tabla de tareas

Given estoy logueado como Member
When navego al dashboard de Tareas
Then deberia ver la tabla de tareas
And deberia ver todas las tareas del equipo (no solo las mias)
```

### Expected Results
- Tasks dashboard is accessible
- Tasks table displays correctly
- All team tasks are visible (not just own tasks)
- Read access is granted to all tasks

---

## @test MEMBER-TASK-READ-002: Member can view task details

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** read, details, navigation

```gherkin:en
Scenario: Member can access task detail page

Given I am logged in as a Member
And I have created a task called "Member Test Task"
When I click on that task in the list
Then I should be navigated to the task detail page
And I should see the task title "Member Test Task"
And I should see the task description
```

```gherkin:es
Scenario: Member puede acceder a pagina de detalle

Given estoy logueado como Member
And he creado una tarea llamada "Tarea de Prueba Member"
When hago clic en esa tarea en la lista
Then deberia ser navegado a la pagina de detalle
And deberia ver el titulo "Tarea de Prueba Member"
And deberia ver la descripcion de la tarea
```

### Expected Results
- Task rows are clickable
- Detail page navigation works
- Task title displays correctly
- Task description is visible

---

## @test MEMBER-TASK-UPDATE-001: Member can edit tasks

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** update, edit, form

```gherkin:en
Scenario: Member can modify task information

Given I am logged in as a Member
And I have created a task called "Original Title"
When I click the "Edit" button on that task
Then the edit form should appear

When I change the Title to "Original Title - Updated"
And I click the "Save" button
Then the changes should be saved
And I should see "Original Title - Updated" in the list
```

```gherkin:es
Scenario: Member puede modificar informacion de tarea

Given estoy logueado como Member
And he creado una tarea llamada "Titulo Original"
When hago clic en el boton "Editar" de esa tarea
Then deberia aparecer el formulario de edicion

When cambio el Titulo a "Titulo Original - Actualizado"
And hago clic en el boton "Guardar"
Then los cambios deberian guardarse
And deberia ver "Titulo Original - Actualizado" en la lista
```

### Expected Results
- Edit button is visible for Members
- Edit form opens with pre-filled data
- Changes can be saved successfully
- Updated data reflects in the list

---

## @test MEMBER-TASK-DELETE-001: Delete button is hidden

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** delete, security, hidden-button
- **Grep:** `@critical` `@security`

```gherkin:en
Scenario: Delete functionality is hidden from Member role

Given I am logged in as a Member
And there is at least one task in the list
When I click on a task to view its details
Then I should see the task information
But I should NOT see a "Delete" button
And there should be no way for me to delete the task
```

```gherkin:es
Scenario: Funcionalidad de eliminar oculta para rol Member

Given estoy logueado como Member
And existe al menos una tarea en la lista
When hago clic en una tarea para ver sus detalles
Then deberia ver la informacion de la tarea
But NO deberia ver un boton "Eliminar"
And no deberia haber forma de eliminar la tarea
```

### Expected Results
- Task information is visible
- Delete button is completely hidden (not just disabled)
- Delete button does not exist in DOM
- Security: No way to delete tasks as Member role
