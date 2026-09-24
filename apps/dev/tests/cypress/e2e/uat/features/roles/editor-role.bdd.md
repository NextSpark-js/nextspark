# Editor Role - Permission Restrictions (Format: BDD/Gherkin - Bilingual)

> **Test File:** `editor-role.cy.ts`
> **Format:** Behavior-Driven Development (BDD) with Given/When/Then
> **Languages:** English / Spanish (side-by-side)
> **Total Tests:** 10

---

## Feature: Editor Role Permission Restrictions

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

As an **Editor** (custom role with hierarchy level 5)
I want to **have read-only access to customers**
So that **I can view data without accidentally modifying it**

**Security Focus:** Editor is a custom role more restrictive than Member.
- Can only list/read customers (no create/update/delete)
- Cannot access Sector7 (superadmin only)
- Cannot access Dev Zone (restricted zone)

</td>
<td>

Como **Editor** (rol personalizado con nivel de jerarquia 5)
Quiero **tener acceso de solo lectura a clientes**
Para que **pueda ver datos sin modificarlos accidentalmente**

**Enfoque de Seguridad:** Editor es un rol personalizado mas restrictivo que Member.
- Solo puede listar/ver clientes (sin crear/editar/eliminar)
- No puede acceder a Sector7 (solo superadmin)
- No puede acceder a Dev Zone (zona restringida)

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
Given I am logged in as Editor (diego.ramirez@nextspark.dev)
And the API intercepts are set up
And the application is running on Everpoint Labs team
```

</td>
<td>

```gherkin
Given estoy logueado como Editor (diego.ramirez@nextspark.dev)
And los intercepts de API estan configurados
And la aplicacion esta corriendo en el equipo Everpoint Labs
```

</td>
</tr>
</table>

---

## UI Restrictions - Buttons Hidden `@smoke`

### EDIT_ROLE_001: Editor can view customers list `@smoke`

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Editor can view customers list

Given I am logged in as an Editor
When I navigate to the Customers list page
And the customer list loads successfully
Then the customers table should be visible
And I should see customer data
```

**Verification:** Basic access to read data is allowed.

</td>
<td>

```gherkin
Scenario: Editor puede ver lista de clientes

Given estoy logueado como Editor
When navego a la pagina de lista de Clientes
And la lista de clientes carga exitosamente
Then la tabla de clientes deberia estar visible
And deberia ver datos de clientes
```

**Verificacion:** El acceso basico para leer datos esta permitido.

</td>
</tr>
</table>

---

### EDIT_ROLE_002: Create Customer button not visible for Editor `@smoke`

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Create button is hidden for Editor role

Given I am logged in as an Editor
When I navigate to the Customers list page
And the customer list loads successfully
Then the "Add" button should NOT exist
And there should be no way to access the create form
```

**Security Verification:** Editor has no `customers.create` permission.

</td>
<td>

```gherkin
Scenario: Boton crear esta oculto para rol Editor

Given estoy logueado como Editor
When navego a la pagina de lista de Clientes
And la lista de clientes carga exitosamente
Then el boton "Agregar" NO deberia existir
And no deberia haber forma de acceder al formulario de creacion
```

**Verificacion de Seguridad:** Editor no tiene permiso `customers.create`.

</td>
</tr>
</table>

---

### EDIT_ROLE_003: Edit/Delete buttons not visible for Editor

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Edit and Delete buttons are hidden in list view

Given I am logged in as an Editor
When I navigate to the Customers list page
And the customer list loads successfully
And there are customers in the list
Then edit action buttons should NOT exist in table rows
And delete action buttons should NOT exist in table rows
```

**Note:** Editor only has `customers.list` and `customers.read` permissions.

</td>
<td>

```gherkin
Scenario: Botones editar y eliminar estan ocultos en vista de lista

Given estoy logueado como Editor
When navego a la pagina de lista de Clientes
And la lista de clientes carga exitosamente
And hay clientes en la lista
Then los botones de accion editar NO deberian existir en las filas
And los botones de accion eliminar NO deberian existir en las filas
```

**Nota:** Editor solo tiene permisos `customers.list` y `customers.read`.

</td>
</tr>
</table>

---

### EDIT_ROLE_004: Editor has no row actions menu

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Row actions menu hidden for Editor (no edit/delete permissions)

Given I am logged in as an Editor
When I navigate to the Customers list page
And the customer list loads successfully
And there are customers in the list
Then the row actions menu should NOT exist
Because Editor has no canUpdate or canDelete permissions
```

**Note:** EntityList component only renders the actions menu if user has edit or delete permissions.

</td>
<td>

```gherkin
Scenario: Menu de acciones de fila oculto para Editor (sin permisos edit/delete)

Given estoy logueado como Editor
When navego a la pagina de lista de Clientes
And la lista de clientes carga exitosamente
And hay clientes en la lista
Then el menu de acciones de fila NO deberia existir
Because Editor no tiene permisos canUpdate o canDelete
```

**Nota:** El componente EntityList solo renderiza el menu de acciones si el usuario tiene permisos de editar o eliminar.

</td>
</tr>
</table>

---

## URL Access Restrictions - Permission Denied

### EDIT_ROLE_005: Direct URL to /customers/create shows Permission Denied

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Direct URL access to create is blocked

Given I am logged in as an Editor
When I navigate directly to /dashboard/customers/create
Then I should see a "Permission Denied" component
Or I should be redirected to a permission-denied page
```

**Verification:** Either `[data-cy="permission-denied"]` is visible or URL contains "permission-denied".

</td>
<td>

```gherkin
Scenario: Acceso directo por URL a crear esta bloqueado

Given estoy logueado como Editor
When navego directamente a /dashboard/customers/create
Then deberia ver un componente de "Permiso Denegado"
Or deberia ser redirigido a una pagina de permiso-denegado
```

**Verificacion:** O bien `[data-cy="permission-denied"]` es visible o la URL contiene "permission-denied".

</td>
</tr>
</table>

---

### EDIT_ROLE_006: Direct URL to /customers/[id]/edit shows Permission Denied

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Direct URL access to edit is blocked

Given I am logged in as an Editor
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

Given estoy logueado como Editor
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

## Restricted Zones - Access Denied

### EDIT_ROLE_007: Editor cannot access Sector7

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Sector7 access is blocked for Editor

Given I am logged in as an Editor
When I navigate directly to /sector7
Then I should be redirected to /dashboard
And the URL should include "error=access_denied"
```

**Severity:** Blocker - Sector7 is superadmin-only area.

</td>
<td>

```gherkin
Scenario: Acceso a Sector7 esta bloqueado para Editor

Given estoy logueado como Editor
When navego directamente a /sector7
Then deberia ser redirigido a /dashboard
And la URL deberia incluir "error=access_denied"
```

**Severidad:** Bloqueante - Sector7 es area solo para superadmin.

</td>
</tr>
</table>

---

### EDIT_ROLE_008: Editor cannot access Dev Zone

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Dev Zone access is blocked for Editor

Given I am logged in as an Editor
When I navigate directly to /dev
Then I should be redirected to /dashboard
And the URL should include "error=access_denied"
```

**Severity:** Blocker - Dev Zone is a restricted development area.

</td>
<td>

```gherkin
Scenario: Acceso a Dev Zone esta bloqueado para Editor

Given estoy logueado como Editor
When navego directamente a /dev
Then deberia ser redirigido a /dashboard
And la URL deberia incluir "error=access_denied"
```

**Severidad:** Bloqueante - Dev Zone es un area de desarrollo restringida.

</td>
</tr>
</table>

---

### EDIT_ROLE_009: Editor UI does not show Sector7 button

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Sector7 button is hidden from Editor UI

Given I am logged in as an Editor
When I navigate to /dashboard
Then the Sector7 button should NOT exist
And the admin toolbar should NOT exist
```

</td>
<td>

```gherkin
Scenario: Boton Sector7 esta oculto de la UI de Editor

Given estoy logueado como Editor
When navego a /dashboard
Then el boton Sector7 NO deberia existir
And la barra de herramientas de admin NO deberia existir
```

</td>
</tr>
</table>

---

### EDIT_ROLE_010: Editor UI does not show Dev Zone button

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Dev Zone button is hidden from Editor UI

Given I am logged in as an Editor
When I navigate to /dashboard
Then the Dev Zone button should NOT exist
```

</td>
<td>

```gherkin
Scenario: Boton Dev Zone esta oculto de la UI de Editor

Given estoy logueado como Editor
When navego a /dashboard
Then el boton Dev Zone NO deberia existir
```

</td>
</tr>
</table>

---

## Permission Matrix / Matriz de Permisos

| Entity / Entidad | Operation / Operación | Editor | Member | Owner | Admin |
|------------------|----------------------|:------:|:------:|:-----:|:-----:|
| **Customers** | CREATE | **No** | **No** | Yes | Yes |
| **Customers** | READ | Yes | Yes | Yes | Yes |
| **Customers** | LIST | Yes | Yes | Yes | Yes |
| **Customers** | UPDATE | **No** | **No** | Yes | Yes |
| **Customers** | DELETE | **No** | **No** | Yes | Yes |
| **Sector7** | ACCESS | **No** | **No** | **No** | **No** |
| **Dev Zone** | ACCESS | **No** | **No** | **No** | **No** |

**Note:** Sector7 and Dev Zone require superadmin access, not regular roles.

---

## UI Elements / Elementos UI

### Permission Components

| Element | Selector | Description / Descripción |
|---------|----------|---------------------------|
| Permission Denied | `[data-cy="permission-denied"]` | Permission denied component |
| Add Button | `[data-cy="customers-add"]` | Create button (should not exist) |
| Row Action View | `[data-cy="row-action-view"]` | View option in row menu |
| Row Action Edit | `[data-cy="row-action-edit"]` | Edit option (should not exist) |
| Row Action Delete | `[data-cy="row-action-delete"]` | Delete option (should not exist) |
| Sector7 Button | `[data-cy="sector7-button"]` | Sector7 access button |
| Dev Zone Button | `[data-cy="dev-zone-button"]` | Dev Zone access button |
| Admin Toolbar | `[data-cy="admin-toolbar"]` | Admin-only toolbar |

---

## Role Hierarchy / Jerarquia de Roles

| Role / Rol | Level / Nivel | Description / Descripción |
|------------|:-------------:|---------------------------|
| Owner | 100 | Full access, protected role |
| Admin | 50 | Administrative access |
| Member | 10 | Standard team member |
| **Editor** | **5** | **Custom read-only role** |
| Viewer | 1 | View-only access |

---

## Summary / Resumen

| Test ID | Block | Description / Descripción | Tags |
|---------|-------|---------------------------|------|
| EDIT_ROLE_001 | UI Restrictions | Editor can view list | `@smoke` |
| EDIT_ROLE_002 | UI Restrictions | Create button hidden | `@smoke` |
| EDIT_ROLE_003 | UI Restrictions | Edit/Delete buttons hidden | |
| EDIT_ROLE_004 | UI Restrictions | Row menu only shows View | |
| EDIT_ROLE_005 | URL Access | /create blocked | |
| EDIT_ROLE_006 | URL Access | /edit blocked | |
| EDIT_ROLE_007 | Restricted Zones | Sector7 blocked | |
| EDIT_ROLE_008 | Restricted Zones | Dev Zone blocked | |
| EDIT_ROLE_009 | Restricted Zones | Sector7 button hidden | |
| EDIT_ROLE_010 | Restricted Zones | Dev Zone button hidden | |
