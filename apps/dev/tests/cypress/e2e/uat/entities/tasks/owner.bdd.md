# Tasks UI - Owner Role (Format: BDD/Gherkin - Bilingual)

> **Test File:** `tasks-owner.cy.ts`
> **Format:** Behavior-Driven Development (BDD) with Given/When/Then
> **Languages:** English / Spanish (side-by-side)
> **Total Tests:** 6

---

## Feature: Tasks Management - Owner Role (Full CRUD Access)

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Espanol</th>
</tr>
<tr>
<td>

As an **Owner**
I want to **manage tasks through the dashboard UI**
So that **I can create, read, update, and delete tasks for my team**

</td>
<td>

Como **Owner**
Quiero **gestionar tareas a traves del dashboard**
Para **crear, leer, actualizar y eliminar tareas de mi equipo**

</td>
</tr>
</table>

### Background

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Espanol</th>
</tr>
<tr>
<td>

```gherkin
Given I am logged in as Owner (owner@nextspark.dev)
And I have navigated to the Tasks dashboard
And the tasks list has loaded successfully
```

</td>
<td>

```gherkin
Given estoy logueado como Owner (owner@nextspark.dev)
And he navegado al dashboard de Tareas
And la lista de tareas ha cargado exitosamente
```

</td>
</tr>
</table>

---

## CREATE - Owner can create tasks `@smoke`

### OWNER_TASK_CREATE_001: Create new task with title only `@smoke` `@critical`

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Espanol</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Owner creates a simple task

Given I am logged in as an Owner
And I am on the Tasks list page
When I click the "Add" button
Then the task creation form should appear

When I enter "New Project Task" in the Title field
And I click the "Save" button
Then the form should submit successfully
And I should see a success message
And I should be redirected to the tasks list
And I should see "New Project Task" in the task list
```

</td>
<td>

```gherkin
Scenario: Owner crea una tarea simple

Given estoy logueado como Owner
And estoy en la pagina de lista de Tareas
When hago clic en el boton "Agregar"
Then deberia aparecer el formulario de creacion

When ingreso "Nueva Tarea del Proyecto" en el campo Titulo
And hago clic en el boton "Guardar"
Then el formulario deberia enviarse exitosamente
And deberia ver un mensaje de exito
And deberia ser redirigido a la lista de tareas
And deberia ver "Nueva Tarea del Proyecto" en la lista
```

</td>
</tr>
</table>

**Visual Flow / Flujo Visual:**
```
[Tasks List] → [Click Add] → [Form Modal] → [Fill Title] → [Save] → [List with new task]
[Lista Tareas] → [Clic Agregar] → [Modal Form] → [Llenar Titulo] → [Guardar] → [Lista con tarea]
```

---

### OWNER_TASK_CREATE_002: Create task with all fields

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Espanol</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Owner creates a task with complete information

Given I am logged in as an Owner
And I am on the Tasks list page
When I click the "Add" button
Then the task creation form should appear

When I fill in the following fields:
  | Field       | Value                            |
  | Title       | "Complete Project Documentation" |
  | Description | "Write all technical docs"       |
And I click the "Save" button
Then the form should submit successfully
And the task should be created with all provided values
And I should see the task in the list
```

</td>
<td>

```gherkin
Scenario: Owner crea una tarea con informacion completa

Given estoy logueado como Owner
And estoy en la pagina de lista de Tareas
When hago clic en el boton "Agregar"
Then deberia aparecer el formulario de creacion

When completo los siguientes campos:
  | Campo       | Valor                                |
  | Titulo      | "Completar Documentacion Proyecto"   |
  | Descripcion | "Escribir toda la documentacion tec" |
And hago clic en el boton "Guardar"
Then el formulario deberia enviarse exitosamente
And la tarea deberia crearse con todos los valores
And deberia ver la tarea en la lista
```

</td>
</tr>
</table>

---

## READ - Owner can read tasks `@smoke`

### OWNER_TASK_READ_001: View task list `@smoke` `@critical`

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Espanol</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Owner can view the tasks table

Given I am logged in as an Owner
When I navigate to the Tasks dashboard
Then I should see the tasks table
And the table should display task titles
And the table should show task information columns
```

**Expected Table Columns:**
- Title
- Status
- Priority
- Created Date
- Actions

</td>
<td>

```gherkin
Scenario: Owner puede ver la tabla de tareas

Given estoy logueado como Owner
When navego al dashboard de Tareas
Then deberia ver la tabla de tareas
And la tabla deberia mostrar titulos de tareas
And la tabla deberia mostrar columnas de informacion
```

**Columnas Esperadas:**
- Titulo
- Estado
- Prioridad
- Fecha de Creacion
- Acciones

</td>
</tr>
</table>

---

### OWNER_TASK_READ_002: View task details

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Espanol</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Owner can view individual task details

Given I am logged in as an Owner
And there is at least one task in the list
When I click on a task row
Then I should be navigated to the task detail page
And the URL should contain the task ID
And I should see the complete task information
```

**Detail Page Elements:**
- Task title (heading)
- Description (if present)
- Status badge
- Priority indicator
- Created/Updated timestamps
- Edit button
- Delete button

</td>
<td>

```gherkin
Scenario: Owner puede ver detalles de una tarea

Given estoy logueado como Owner
And existe al menos una tarea en la lista
When hago clic en una fila de tarea
Then deberia ser navegado a la pagina de detalle
And la URL deberia contener el ID de la tarea
And deberia ver la informacion completa de la tarea
```

**Elementos de la Pagina de Detalle:**
- Titulo de la tarea (encabezado)
- Descripcion (si existe)
- Badge de estado
- Indicador de prioridad
- Timestamps de creacion/actualizacion
- Boton Editar
- Boton Eliminar

</td>
</tr>
</table>

---

## UPDATE - Owner can update tasks

### OWNER_TASK_UPDATE_001: Edit existing task

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Espanol</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Owner can modify task information

Given I am logged in as an Owner
And there is at least one task in the list
When I click the "Edit" button on a task row
Then the task edit form should appear
And the form should be pre-filled with current task data

When I change the Title to "Updated Task Title"
And I click the "Save" button
Then the changes should be saved successfully
And I should be redirected to the tasks list
And I should see "Updated Task Title" in the list
```

</td>
<td>

```gherkin
Scenario: Owner puede modificar informacion de tarea

Given estoy logueado como Owner
And existe al menos una tarea en la lista
When hago clic en el boton "Editar" de una fila
Then deberia aparecer el formulario de edicion
And el formulario deberia estar pre-llenado con datos actuales

When cambio el Titulo a "Titulo de Tarea Actualizado"
And hago clic en el boton "Guardar"
Then los cambios deberian guardarse exitosamente
And deberia ser redirigido a la lista de tareas
And deberia ver "Titulo de Tarea Actualizado" en la lista
```

</td>
</tr>
</table>

---

## DELETE - Owner can delete tasks

### OWNER_TASK_DELETE_001: Delete existing task `@critical`

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Espanol</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Owner can permanently delete a task

Given I am logged in as an Owner
And I have created a task called "Task to Delete"
When I click on the task to view details
And I click the "Delete" button
Then a confirmation dialog should appear

When I confirm the deletion
Then a second confirmation dialog should appear
When I confirm again
Then the task should be deleted
And I should be redirected to the tasks list
And "Task to Delete" should no longer appear in the list
```

</td>
<td>

```gherkin
Scenario: Owner puede eliminar permanentemente una tarea

Given estoy logueado como Owner
And he creado una tarea llamada "Tarea a Eliminar"
When hago clic en la tarea para ver detalles
And hago clic en el boton "Eliminar"
Then deberia aparecer un dialogo de confirmacion

When confirmo la eliminacion
Then deberia aparecer un segundo dialogo de confirmacion
When confirmo nuevamente
Then la tarea deberia ser eliminada
And deberia ser redirigido a la lista de tareas
And "Tarea a Eliminar" ya no deberia aparecer en la lista
```

</td>
</tr>
</table>

**Deletion Flow (2-step confirmation) / Flujo de Eliminacion (confirmacion de 2 pasos):**
```
[Detail Page] → [Delete Button] → [Confirm Dialog 1] → [Confirm Dialog 2] → [Task Deleted]
[Pag Detalle] → [Boton Eliminar] → [Dialogo Conf 1] → [Dialogo Conf 2] → [Tarea Eliminada]
```

> **Note / Nota:** The double confirmation is a safety feature to prevent accidental deletions. / La doble confirmacion es una medida de seguridad para prevenir eliminaciones accidentales.

---

## Summary / Resumen

| Test ID | Operation | Description / Descripcion | Tags |
|---------|-----------|---------------------------|------|
| OWNER_TASK_CREATE_001 | CREATE | Create task with title / Crear tarea con titulo | `@smoke` `@critical` |
| OWNER_TASK_CREATE_002 | CREATE | Create task with all fields / Crear con todos los campos | |
| OWNER_TASK_READ_001 | READ | View task list / Ver lista de tareas | `@smoke` `@critical` |
| OWNER_TASK_READ_002 | READ | View task details / Ver detalles de tarea | |
| OWNER_TASK_UPDATE_001 | UPDATE | Edit existing task / Editar tarea existente | |
| OWNER_TASK_DELETE_001 | DELETE | Delete task / Eliminar tarea | `@critical` |
