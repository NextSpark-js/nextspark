# Owner Role - Full CRUD Permissions (Format: BDD/Gherkin - Bilingual)

> **Test File:** `owner-full-crud.cy.ts`
> **Format:** Behavior-Driven Development (BDD) with Given/When/Then
> **Languages:** English / Spanish (side-by-side)
> **Total Tests:** 10

---

## Feature: Owner Role Full CRUD Permissions

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

As an **Owner** (protected role with hierarchy level 100)
I want to **have full CRUD access to all entities**
So that **I can manage all data in my team**

**Verification Focus:** These tests confirm that the extensible roles system does not break existing Owner capabilities.
- Owner should see all CRUD buttons
- Owner should be able to perform all operations
- Owner should access all routes without restrictions

</td>
<td>

Como **Owner** (rol protegido con nivel de jerarquia 100)
Quiero **tener acceso CRUD completo a todas las entidades**
Para que **pueda gestionar todos los datos de mi equipo**

**Enfoque de Verificacion:** Estos tests confirman que el sistema de roles extensibles no rompe las capacidades existentes del Owner.
- Owner deberia ver todos los botones CRUD
- Owner deberia poder realizar todas las operaciones
- Owner deberia acceder a todas las rutas sin restricciones

</td>
</tr>
</table>

### Background

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Given I am logged in as Owner (carlos.mendoza@nextspark.dev)
And the API intercepts are set up
And the application is running on Everpoint Labs team
```

</td>
<td>

```gherkin
Given estoy logueado como Owner (carlos.mendoza@nextspark.dev)
And los intercepts de API estan configurados
And la aplicacion esta corriendo en el equipo Everpoint Labs
```

</td>
</tr>
</table>

---

## UI Access - All Buttons Visible `@smoke`

### OWNER_CRUD_001: Owner sees Add button on customers list `@smoke`

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Add button is visible for Owner role

Given I am logged in as an Owner
When I navigate to the Customers list page
And the customer list loads successfully
Then the "Add" button should be visible
```

</td>
<td>

```gherkin
Scenario: Boton Agregar esta visible para rol Owner

Given estoy logueado como Owner
When navego a la pagina de lista de Clientes
And la lista de clientes carga exitosamente
Then el boton "Agregar" deberia estar visible
```

</td>
</tr>
</table>

---

### OWNER_CRUD_002: Owner sees row actions menu on customer rows `@smoke`

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Row actions menu is visible for Owner

Given I am logged in as an Owner
When I navigate to the Customers list page
And the customer list loads successfully
And there are customers in the list
Then the row actions menu trigger should be visible on each row
```

**Note:** Owner has edit/delete permissions, so the menu is rendered.

</td>
<td>

```gherkin
Scenario: Menu de acciones de fila esta visible para Owner

Given estoy logueado como Owner
When navego a la pagina de lista de Clientes
And la lista de clientes carga exitosamente
And hay clientes en la lista
Then el trigger del menu de acciones deberia estar visible en cada fila
```

**Nota:** Owner tiene permisos de editar/eliminar, por lo que se renderiza el menu.

</td>
</tr>
</table>

---

### OWNER_CRUD_003: Owner sees Edit and Delete options in row menu

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Row menu shows Edit and Delete for Owner

Given I am logged in as an Owner
When I navigate to the Customers list page
And the customer list loads successfully
And I click on a row's actions menu
Then the "Edit" option should be visible
And the "Delete" option should be visible
```

</td>
<td>

```gherkin
Scenario: Menu de fila muestra Editar y Eliminar para Owner

Given estoy logueado como Owner
When navego a la pagina de lista de Clientes
And la lista de clientes carga exitosamente
And hago clic en el menu de acciones de una fila
Then la opcion "Editar" deberia estar visible
And la opcion "Eliminar" deberia estar visible
```

</td>
</tr>
</table>

---

## CRUD Operations - Full Access

### OWNER_CRUD_004: Owner can access customer create form

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Owner can navigate to create form

Given I am logged in as an Owner
When I navigate to the Customers list page
And I click the "Add" button
Then I should be navigated to the create form
And the form should be visible and functional
```

</td>
<td>

```gherkin
Scenario: Owner puede navegar al formulario de crear

Given estoy logueado como Owner
When navego a la pagina de lista de Clientes
And hago clic en el boton "Agregar"
Then deberia navegar al formulario de creacion
And el formulario deberia estar visible y funcional
```

</td>
</tr>
</table>

---

### OWNER_CRUD_005: Owner can access create form and see submit button

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Owner can see all form elements on create page

Given I am logged in as an Owner
When I navigate to the create customer form
Then I should see the form fields (name, account)
And I should see the submit button
```

**Verification:** Confirms Owner has full UI access to create functionality.

</td>
<td>

```gherkin
Scenario: Owner puede ver todos los elementos del formulario en crear

Given estoy logueado como Owner
When navego al formulario de crear cliente
Then deberia ver los campos del formulario (name, account)
And deberia ver el boton de enviar
```

**Verificacion:** Confirma que Owner tiene acceso UI completo a la funcionalidad de crear.

</td>
</tr>
</table>

---

### OWNER_CRUD_006: Owner can access customer edit form

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Owner can navigate to edit form

Given I am logged in as an Owner
When I navigate to the Customers list page
And there is at least one customer in the list
And I click the Edit button on a customer row
Then I should be navigated to the edit form
And the form should be pre-filled with customer data
```

</td>
<td>

```gherkin
Scenario: Owner puede navegar al formulario de editar

Given estoy logueado como Owner
When navego a la pagina de lista de Clientes
And existe al menos un cliente en la lista
And hago clic en el boton Editar de una fila de cliente
Then deberia navegar al formulario de edicion
And el formulario deberia estar pre-llenado con datos del cliente
```

</td>
</tr>
</table>

---

### OWNER_CRUD_007: Owner can access edit form with submit capability

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Owner can see all form elements on edit page

Given I am logged in as an Owner
And there is at least one customer in the list
When I click Edit in the row menu
And the edit form loads
Then I should see the form fields
And I should see the submit button
```

**Verification:** Confirms Owner has full UI access to edit functionality.

</td>
<td>

```gherkin
Scenario: Owner puede ver todos los elementos del formulario en editar

Given estoy logueado como Owner
And existe al menos un cliente en la lista
When hago clic en Editar en el menu de fila
And el formulario de edicion carga
Then deberia ver los campos del formulario
And deberia ver el boton de enviar
```

**Verificacion:** Confirma que Owner tiene acceso UI completo a la funcionalidad de editar.

</td>
</tr>
</table>

---

### OWNER_CRUD_008: Owner can see Delete option in row menu

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Owner can see Delete option in row menu

Given I am logged in as an Owner
When I navigate to the Customers list page
And there is at least one customer in the list
And I click on a row's actions menu
Then the "Delete" option should be visible
```

**Verification:** Confirms Owner has delete permission visibility.

</td>
<td>

```gherkin
Scenario: Owner puede ver opcion Eliminar en menu de fila

Given estoy logueado como Owner
When navego a la pagina de lista de Clientes
And existe al menos un cliente en la lista
And hago clic en el menu de acciones de una fila
Then la opcion "Eliminar" deberia estar visible
```

**Verificacion:** Confirma que Owner tiene visibilidad del permiso de eliminar.

</td>
</tr>
</table>

---

## Direct URL Access - Full Access

### OWNER_CRUD_009: Owner can access /customers/create via URL

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Owner can access create route directly

Given I am logged in as an Owner
When I navigate directly to /dashboard/customers/create
Then I should NOT see a "Permission Denied" component
And the create form should be visible
```

</td>
<td>

```gherkin
Scenario: Owner puede acceder a ruta crear directamente

Given estoy logueado como Owner
When navego directamente a /dashboard/customers/create
Then NO deberia ver un componente de "Permiso Denegado"
And el formulario de creacion deberia estar visible
```

</td>
</tr>
</table>

---

### OWNER_CRUD_010: Owner can access /customers/[id]/edit via URL

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Owner can access edit route directly

Given I am logged in as an Owner
And there is at least one customer in the list
When I extract a customer ID from the list
And I navigate directly to /dashboard/customers/{id}/edit
Then I should NOT see a "Permission Denied" component
And the edit form should be visible with customer data
```

</td>
<td>

```gherkin
Scenario: Owner puede acceder a ruta editar directamente

Given estoy logueado como Owner
And existe al menos un cliente en la lista
When extraigo un ID de cliente de la lista
And navego directamente a /dashboard/customers/{id}/edit
Then NO deberia ver un componente de "Permiso Denegado"
And el formulario de edicion deberia estar visible con datos del cliente
```

</td>
</tr>
</table>

---

## Permission Matrix / Matriz de Permisos

| Entity / Entidad | Operation / Operación | Owner | Admin | Member | Editor | Viewer |
|------------------|----------------------|:-----:|:-----:|:------:|:------:|:------:|
| **Customers** | CREATE | **Yes** | Yes | No | No | No |
| **Customers** | READ | **Yes** | Yes | Yes | Yes | Yes |
| **Customers** | LIST | **Yes** | Yes | Yes | Yes | Yes |
| **Customers** | UPDATE | **Yes** | Yes | No | No | No |
| **Customers** | DELETE | **Yes** | Yes | No | No | No |

---

## UI Elements / Elementos UI

### Permission Components

| Element | Selector | Description / Descripción |
|---------|----------|---------------------------|
| Add Button | `[data-cy="customers-add"]` | Create button (must exist for Owner) |
| Edit Button | `[data-cy^="customers-row-action-edit"]` | Edit button on rows |
| Delete Button | `[data-cy="row-action-delete"]` | Delete option in menu |
| View Button | `[data-cy="row-action-view"]` | View option in menu |
| Form | `[data-cy="customers-form"]` | Entity form |
| Permission Denied | `[data-cy="permission-denied"]` | Should NOT exist for Owner |

---

## Summary / Resumen

| Test ID | Block | Description / Descripción | Tags |
|---------|-------|---------------------------|------|
| OWNER_CRUD_001 | UI Access | Add button visible | `@smoke` |
| OWNER_CRUD_002 | UI Access | Row actions menu visible | `@smoke` |
| OWNER_CRUD_003 | UI Access | Edit/Delete in menu | |
| OWNER_CRUD_004 | CRUD Operations | Access create form | |
| OWNER_CRUD_005 | CRUD Operations | Create form with submit | |
| OWNER_CRUD_006 | CRUD Operations | Access edit form | |
| OWNER_CRUD_007 | CRUD Operations | Edit form with submit | |
| OWNER_CRUD_008 | CRUD Operations | Delete option visible | |
| OWNER_CRUD_009 | URL Access | Direct /create access | |
| OWNER_CRUD_010 | URL Access | Direct /edit access | |
