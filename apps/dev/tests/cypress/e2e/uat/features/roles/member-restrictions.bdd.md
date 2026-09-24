# Member Role - Permission Restrictions (Format: BDD/Gherkin - Bilingual)

> **Test File:** `member-restrictions.cy.ts`
> **Format:** Behavior-Driven Development (BDD) with Given/When/Then
> **Languages:** English / Spanish (side-by-side)
> **Total Tests:** 8

---

## Feature: Member Role Permission Restrictions

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

As a **Member**
I want to **be restricted from unauthorized actions**
So that **the system enforces proper role-based access control**

**Security Focus:** These tests validate that UI buttons are hidden and direct URL access is blocked for unauthorized operations.

</td>
<td>

Como **Member**
Quiero **estar restringido de acciones no autorizadas**
Para que **el sistema aplique control de acceso basado en roles**

**Enfoque de Seguridad:** Estos tests validan que los botones UI estan ocultos y el acceso directo por URL esta bloqueado para operaciones no autorizadas.

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
Given I am logged in as Member (member@nextspark.dev)
And the API intercepts are set up
And the application is running
```

</td>
<td>

```gherkin
Given estoy logueado como Member (member@nextspark.dev)
And los intercepts de API estan configurados
And la aplicacion esta corriendo
```

</td>
</tr>
</table>

---

## UI Restrictions - Buttons Hidden/Disabled `@smoke`

### PERM_UI_001: Create Customer button not visible for Member `@smoke`

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Create button is hidden for Member role

Given I am logged in as a Member
When I navigate to the Customers list page
And the customer list loads successfully
Then the "Add" button should NOT exist
And there should be no way to access the create form
```

**Security Verification:**
The create button must be completely absent from the DOM.

</td>
<td>

```gherkin
Scenario: Boton crear esta oculto para rol Member

Given estoy logueado como Member
When navego a la pagina de lista de Clientes
And la lista de clientes carga exitosamente
Then el boton "Agregar" NO deberia existir
And no deberia haber forma de acceder al formulario de creacion
```

**Verificacion de Seguridad:**
El boton crear debe estar completamente ausente del DOM.

</td>
</tr>
</table>

---

### PERM_UI_002: Delete Customer buttons not visible for Member

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Delete buttons are hidden in list view

Given I am logged in as a Member
When I navigate to the Customers list page
And the customer list loads successfully
And there are customers in the list
Then delete action buttons should NOT exist in table rows
```

</td>
<td>

```gherkin
Scenario: Botones eliminar estan ocultos en vista de lista

Given estoy logueado como Member
When navego a la pagina de lista de Clientes
And la lista de clientes carga exitosamente
And hay clientes en la lista
Then los botones de accion eliminar NO deberian existir en las filas
```

</td>
</tr>
</table>

---

### PERM_UI_003: Edit Customer buttons not visible for Member

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Edit buttons are hidden in list view

Given I am logged in as a Member
When I navigate to the Customers list page
And the customer list loads successfully
And there are customers in the list
Then edit action buttons should NOT exist in table rows
```

**Note:** Based on real system behavior, Member CANNOT edit customers.

</td>
<td>

```gherkin
Scenario: Botones editar estan ocultos en vista de lista

Given estoy logueado como Member
When navego a la pagina de lista de Clientes
And la lista de clientes carga exitosamente
And hay clientes en la lista
Then los botones de accion editar NO deberian existir en las filas
```

**Nota:** Basado en el comportamiento real del sistema, Member NO puede editar clientes.

</td>
</tr>
</table>

---

## URL Access Restrictions - Permission Denied Component

### PERM_URL_001: Direct URL to /customers/create shows Permission Denied

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Direct URL access to create is blocked

Given I am logged in as a Member
When I navigate directly to /dashboard/customers/create
Then I should see a "Permission Denied" component
Or I should be redirected to a permission-denied page
```

**Verification:**
Either `[data-cy="permission-denied"]` is visible or URL contains "permission-denied".

</td>
<td>

```gherkin
Scenario: Acceso directo por URL a crear esta bloqueado

Given estoy logueado como Member
When navego directamente a /dashboard/customers/create
Then deberia ver un componente de "Permiso Denegado"
Or deberia ser redirigido a una pagina de permiso-denegado
```

**Verificacion:**
O bien `[data-cy="permission-denied"]` es visible o la URL contiene "permission-denied".

</td>
</tr>
</table>

---

### PERM_URL_002: Delete button not visible on customer detail for Member

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Delete button hidden on detail page

Given I am logged in as a Member
And there is at least one customer in the list
When I click on a customer row to view details
Then I should navigate to the customer detail page
And the "Delete" button should NOT exist
```

**Note:** The /delete URL route doesn't exist - delete is done from detail page.

</td>
<td>

```gherkin
Scenario: Boton eliminar oculto en pagina de detalle

Given estoy logueado como Member
And existe al menos un cliente en la lista
When hago clic en una fila de cliente para ver detalles
Then deberia navegar a la pagina de detalle del cliente
And el boton "Eliminar" NO deberia existir
```

**Nota:** La ruta URL /delete no existe - eliminar se hace desde la pagina de detalle.

</td>
</tr>
</table>

---

### PERM_URL_003: Direct URL to /customers/[id]/edit shows Permission Denied

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Direct URL access to edit is blocked

Given I am logged in as a Member
And there is at least one customer in the list
When I extract a customer ID from the list
And I navigate directly to /dashboard/customers/{id}/edit
Then I should see a "Permission Denied" component
Or I should be redirected away from /edit
```

</td>
<td>

```gherkin
Scenario: Acceso directo por URL a editar esta bloqueado

Given estoy logueado como Member
And existe al menos un cliente en la lista
When extraigo un ID de cliente de la lista
And navego directamente a /dashboard/customers/{id}/edit
Then deberia ver un componente de "Permiso Denegado"
Or deberia ser redirigido fuera de /edit
```

</td>
</tr>
</table>

---

### PERM_URL_004: Direct URL to /tasks routes is ALLOWED for Member

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Tasks routes are accessible for Member

Given I am logged in as a Member
When I navigate directly to /dashboard/tasks/create
Then I should NOT see a "Permission Denied" component
And the task creation form should be visible
```

**Note:** Member has full CRUD access to Tasks entity.

</td>
<td>

```gherkin
Scenario: Rutas de tareas son accesibles para Member

Given estoy logueado como Member
When navego directamente a /dashboard/tasks/create
Then NO deberia ver un componente de "Permiso Denegado"
And el formulario de creacion de tareas deberia estar visible
```

**Nota:** Member tiene acceso CRUD completo a la entidad Tasks.

</td>
</tr>
</table>

---

## Permission Messages - User Feedback

### PERM_MSG_001: Permission denied message is user-friendly

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Permission denied shows user-friendly message

Given I am logged in as a Member
When I navigate directly to /dashboard/customers/create
Then I should see a permission denied indication
And the message should contain "permission", "access", or "not allowed"
And the message should be user-friendly (not technical error)
```

</td>
<td>

```gherkin
Scenario: Permiso denegado muestra mensaje amigable

Given estoy logueado como Member
When navego directamente a /dashboard/customers/create
Then deberia ver una indicacion de permiso denegado
And el mensaje deberia contener "permiso", "acceso", o "no permitido"
And el mensaje deberia ser amigable (no error tecnico)
```

</td>
</tr>
</table>

---

## Permission Matrix / Matriz de Permisos

| Entity / Entidad | Operation / Operación | Member | Owner | Admin |
|------------------|----------------------|:------:|:-----:|:-----:|
| **Customers** | CREATE | **No** | Yes | Yes |
| **Customers** | READ | Yes | Yes | Yes |
| **Customers** | UPDATE | **No** | Yes | Yes |
| **Customers** | DELETE | **No** | Yes | Yes |
| **Tasks** | CREATE | Yes | Yes | Yes |
| **Tasks** | READ | Yes | Yes | Yes |
| **Tasks** | UPDATE | Yes | Yes | Yes |
| **Tasks** | DELETE | **No** | Yes | Yes |

---

## UI Elements / Elementos UI

### Permission Components

| Element | Selector | Description / Descripción |
|---------|----------|---------------------------|
| Permission Denied | `[data-cy="permission-denied"]` | Permission denied component |
| Add Button | `[data-cy="customers-add"]` | Create button (should not exist) |
| Delete Button | `[data-cy="customers-delete-btn"]` | Delete button on detail |
| Edit Button | `[data-cy="customers-edit-btn"]` | Edit button on detail |
| Row Actions | `[data-cy^="customers-row-action-"]` | Row action buttons |

---

## Summary / Resumen

| Test ID | Block | Description / Descripción | Tags |
|---------|-------|---------------------------|------|
| PERM_UI_001 | UI Restrictions | Create button hidden | `@smoke` |
| PERM_UI_002 | UI Restrictions | Delete buttons hidden | |
| PERM_UI_003 | UI Restrictions | Edit buttons hidden | |
| PERM_URL_001 | URL Access | /create blocked | |
| PERM_URL_002 | URL Access | Delete hidden on detail | |
| PERM_URL_003 | URL Access | /edit blocked | |
| PERM_URL_004 | URL Access | /tasks allowed | |
| PERM_MSG_001 | Messages | User-friendly message | |
