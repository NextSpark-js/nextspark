# Team Switcher UI Tests (Format: BDD/Gherkin - Bilingual)

> **Test File:** `team-switcher.cy.ts`
> **Format:** Behavior-Driven Development (BDD) with Given/When/Then
> **Languages:** English / Spanish (side-by-side)
> **Total Tests:** 25

---

## Feature: Team Switcher Component

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

As a **multi-tenant user**
I want to **switch between teams using the TeamSwitcherCompact component**
So that **I can access different team contexts and manage their data**

**Key Functionality:**
- View teams in dropdown
- Switch between teams
- Data reloads after switch
- Permission changes per team role

</td>
<td>

Como **usuario multi-tenant**
Quiero **cambiar entre equipos usando el componente TeamSwitcherCompact**
Para **acceder a diferentes contextos de equipo y gestionar sus datos**

**Funcionalidad Clave:**
- Ver equipos en dropdown
- Cambiar entre equipos
- Datos se recargan tras cambio
- Permisos cambian según rol del equipo

</td>
</tr>
</table>

### Test Users / Usuarios de Prueba

| User | Email | Teams & Roles |
|------|-------|---------------|
| Carlos (Multi-team) | carlos.mendoza@nextspark.dev | Everpoint (owner), Riverstone (member), Ironvale (admin) |
| Sofia | sofia.lopez@nextspark.dev | Riverstone (owner), Ironvale (admin) |
| Emily | emily.johnson@nextspark.dev | Everpoint (member), Riverstone (admin) |
| James | james.wilson@nextspark.dev | Everpoint (admin), Riverstone (member) |
| Ana (Single-team) | ana.garcia@nextspark.dev | Ironvale Global (owner) |
| Sarah (Viewer) | sarah.davis@nextspark.dev | Ironvale Global (viewer) |

---

## Single/Few Team User

### TEAM_SW_001: User sees their teams in switcher `@smoke`

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: User sees their teams in switcher

Given I am logged in as Ana (single-team user)
And I am on the dashboard
When I open the team switcher dropdown
Then the switcher should be visible
And I should see at least 1 team in the list
```

</td>
<td>

```gherkin
Scenario: Usuario ve sus equipos en el selector

Given estoy logueado como Ana (usuario single-team)
And estoy en el dashboard
When abro el dropdown del selector de equipos
Then el selector deberia estar visible
And deberia ver al menos 1 equipo en la lista
```

</td>
</tr>
</table>

---

### TEAM_SW_002: Manage Teams link is visible and navigates correctly

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Manage Teams link works correctly

Given I am logged in as Ana
And I am on the dashboard
When I open the team switcher
Then the "Manage Teams" link should be visible
And clicking it should navigate to team management
```

</td>
<td>

```gherkin
Scenario: Enlace Gestionar Equipos funciona correctamente

Given estoy logueado como Ana
And estoy en el dashboard
When abro el selector de equipos
Then el enlace "Gestionar Equipos" deberia estar visible
And al hacer clic deberia navegar a gestion de equipos
```

</td>
</tr>
</table>

---

## Multi-Team User

### TEAM_SW_010: Multi-team user sees all teams

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Multi-team user sees all their teams

Given I am logged in as Carlos (multi-team user)
And I am on the dashboard
When I open the team switcher dropdown
Then the switcher should be visible
And I should see at least 2 teams
And "Everpoint Labs" should be in the list
And "Riverstone Ventures" should be in the list
```

</td>
<td>

```gherkin
Scenario: Usuario multi-team ve todos sus equipos

Given estoy logueado como Carlos (usuario multi-team)
And estoy en el dashboard
When abro el dropdown del selector de equipos
Then el selector deberia estar visible
And deberia ver al menos 2 equipos
And "Everpoint Labs" deberia estar en la lista
And "Riverstone Ventures" deberia estar en la lista
```

</td>
</tr>
</table>

---

### TEAM_SW_011: Current team shows checkmark

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Current team is indicated with checkmark

Given I am logged in as Carlos
And my current team is "Everpoint Labs"
When I open the team switcher
Then "Everpoint Labs" should have a checkmark
And "Riverstone Ventures" should NOT have a checkmark
```

</td>
<td>

```gherkin
Scenario: Equipo actual se indica con checkmark

Given estoy logueado como Carlos
And mi equipo actual es "Everpoint Labs"
When abro el selector de equipos
Then "Everpoint Labs" deberia tener un checkmark
And "Riverstone Ventures" NO deberia tener checkmark
```

</td>
</tr>
</table>

---

### TEAM_SW_012: Roles are displayed correctly

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: User roles are displayed for each team

Given I am logged in as Carlos
And I have different roles in different teams
When I open the team switcher
Then "Everpoint Labs" should show "Propietario" role
And "Riverstone Ventures" should show "Miembro" role
```

**Note:** Roles displayed in Spanish (app locale).

</td>
<td>

```gherkin
Scenario: Roles de usuario se muestran para cada equipo

Given estoy logueado como Carlos
And tengo diferentes roles en diferentes equipos
When abro el selector de equipos
Then "Everpoint Labs" deberia mostrar rol "Propietario"
And "Riverstone Ventures" deberia mostrar rol "Miembro"
```

**Nota:** Roles mostrados en español (locale de la app).

</td>
</tr>
</table>

---

### TEAM_SW_013: Can switch teams successfully

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: User can switch between teams

Given I am logged in as Carlos
And my current team is "Everpoint Labs"
When I select "Riverstone Ventures" from the switcher
Then the page should reload
And my current team should be "Riverstone Ventures"
```

</td>
<td>

```gherkin
Scenario: Usuario puede cambiar entre equipos

Given estoy logueado como Carlos
And mi equipo actual es "Everpoint Labs"
When selecciono "Riverstone Ventures" del selector
Then la pagina deberia recargarse
And mi equipo actual deberia ser "Riverstone Ventures"
```

</td>
</tr>
</table>

---

### TEAM_SW_014: Modal appears during switch

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Loading modal appears during team switch

Given I am logged in as Carlos
And I am on the dashboard
When I select a different team from the switcher
Then a switching modal should appear
And the modal should indicate team change in progress
```

</td>
<td>

```gherkin
Scenario: Modal de carga aparece durante cambio de equipo

Given estoy logueado como Carlos
And estoy en el dashboard
When selecciono un equipo diferente del selector
Then deberia aparecer un modal de cambio
And el modal deberia indicar cambio de equipo en progreso
```

</td>
</tr>
</table>

---

## Data Reload After Switch

### TEAM_SW_020: Customers reload after switch

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Customers list reloads with new team data

Given I am logged in as Carlos on "Everpoint Labs"
And I am on the customers page
When I switch to "Riverstone Ventures"
And I navigate to customers page
Then the customers should be for "Riverstone Ventures"
And the team name in switcher should reflect the change
```

</td>
<td>

```gherkin
Scenario: Lista de clientes se recarga con datos del nuevo equipo

Given estoy logueado como Carlos en "Everpoint Labs"
And estoy en la pagina de clientes
When cambio a "Riverstone Ventures"
And navego a la pagina de clientes
Then los clientes deberian ser de "Riverstone Ventures"
And el nombre del equipo en selector deberia reflejar el cambio
```

</td>
</tr>
</table>

---

### TEAM_SW_021: Tasks reload after switch

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Tasks list reloads with new team data

Given I am logged in as Carlos on "Everpoint Labs"
And I am on the tasks page
When I switch to "Riverstone Ventures"
And I navigate to tasks page
Then the tasks should be for "Riverstone Ventures"
And the team name in switcher should reflect the change
```

</td>
<td>

```gherkin
Scenario: Lista de tareas se recarga con datos del nuevo equipo

Given estoy logueado como Carlos en "Everpoint Labs"
And estoy en la pagina de tareas
When cambio a "Riverstone Ventures"
And navego a la pagina de tareas
Then las tareas deberian ser de "Riverstone Ventures"
And el nombre del equipo en selector deberia reflejar el cambio
```

</td>
</tr>
</table>

---

### TEAM_SW_022: Sidebar shows new team name

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Sidebar reflects new team after switch

Given I am logged in as Carlos
And the sidebar shows "Everpoint Labs"
When I switch to "Riverstone Ventures"
Then the sidebar should show "Riverstone Ventures"
```

</td>
<td>

```gherkin
Scenario: Sidebar refleja nuevo equipo tras cambio

Given estoy logueado como Carlos
And el sidebar muestra "Everpoint Labs"
When cambio a "Riverstone Ventures"
Then el sidebar deberia mostrar "Riverstone Ventures"
```

</td>
</tr>
</table>

---

## Permission Changes

### TEAM_SW_030: Owner can create customer

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Owner has create permission for customers

Given I am logged in as Carlos (owner in Everpoint)
And my current team is "Everpoint Labs"
When I navigate to the customers page
Then the page should load successfully
And the "Add" button should be visible
```

</td>
<td>

```gherkin
Scenario: Owner tiene permiso de creacion para clientes

Given estoy logueado como Carlos (owner en Everpoint)
And mi equipo actual es "Everpoint Labs"
When navego a la pagina de clientes
Then la pagina deberia cargar exitosamente
And el boton "Agregar" deberia estar visible
```

</td>
</tr>
</table>

---

### TEAM_SW_031: Owner can edit/delete customer via detail page

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Owner can edit and delete from detail page

Given I am logged in as Carlos (owner in Everpoint)
And I am on the customers page
When I click on a customer row
Then I should navigate to the customer detail page
And the "Edit" button should be visible
And the "Delete" button should be visible
```

</td>
<td>

```gherkin
Scenario: Owner puede editar y eliminar desde pagina de detalle

Given estoy logueado como Carlos (owner en Everpoint)
And estoy en la pagina de clientes
When hago clic en una fila de cliente
Then deberia navegar a la pagina de detalle del cliente
And el boton "Editar" deberia estar visible
And el boton "Eliminar" deberia estar visible
```

</td>
</tr>
</table>

---

### TEAM_SW_032: Member cannot create customer `@security`

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Member cannot create customers

Given I am logged in as Carlos (member in Riverstone)
And I switch to "Riverstone Ventures"
When I navigate to the customers page
Then the page should load successfully
But the "Add" button should NOT exist
```

**Security Verification:**
Create button must be completely hidden, not just disabled.

</td>
<td>

```gherkin
Scenario: Member no puede crear clientes

Given estoy logueado como Carlos (member en Riverstone)
And cambio a "Riverstone Ventures"
When navego a la pagina de clientes
Then la pagina deberia cargar exitosamente
But el boton "Agregar" NO deberia existir
```

**Verificacion de Seguridad:**
El boton crear debe estar completamente oculto, no solo deshabilitado.

</td>
</tr>
</table>

---

### TEAM_SW_033: Member cannot delete customer via detail page `@security`

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Member cannot delete from detail page

Given I am logged in as Carlos (member in Riverstone)
And I switch to "Riverstone Ventures"
And I navigate to the customers page
When I click on a customer row
Then I should navigate to the detail page
But the "Delete" button should NOT exist
```

</td>
<td>

```gherkin
Scenario: Member no puede eliminar desde pagina de detalle

Given estoy logueado como Carlos (member en Riverstone)
And cambio a "Riverstone Ventures"
And navego a la pagina de clientes
When hago clic en una fila de cliente
Then deberia navegar a la pagina de detalle
But el boton "Eliminar" NO deberia existir
```

</td>
</tr>
</table>

---

### TEAM_SW_034: Member blocked from /edit URL `@security`

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Member blocked from direct edit URL access

Given I am logged in as Carlos (member in Riverstone)
And I switch to "Riverstone Ventures"
And I get a customer ID from the list
When I navigate directly to /dashboard/customers/{id}/edit
Then I should see a "Permission Denied" message
```

**Security Verification:**
Direct URL manipulation must be blocked for unauthorized roles.

</td>
<td>

```gherkin
Scenario: Member bloqueado de acceso directo a URL de edicion

Given estoy logueado como Carlos (member en Riverstone)
And cambio a "Riverstone Ventures"
And obtengo un ID de cliente de la lista
When navego directamente a /dashboard/customers/{id}/edit
Then deberia ver un mensaje de "Permiso Denegado"
```

**Verificacion de Seguridad:**
La manipulacion directa de URL debe ser bloqueada para roles no autorizados.

</td>
</tr>
</table>

---

### TEAM_SW_035: Member cannot access create URL `@security`

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Member lacks create permissions

Given I am logged in as Carlos (member in Riverstone)
And I switch to "Riverstone Ventures"
When I navigate to the customers page
Then the "Add" button should NOT exist
And there should be no way to access the create form
```

</td>
<td>

```gherkin
Scenario: Member carece de permisos de creacion

Given estoy logueado como Carlos (member en Riverstone)
And cambio a "Riverstone Ventures"
When navego a la pagina de clientes
Then el boton "Agregar" NO deberia existir
And no deberia haber forma de acceder al formulario de creacion
```

</td>
</tr>
</table>

---

## UI Behavior

### TEAM_SW_040: Dropdown closes on escape key

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Dropdown closes with Escape key

Given I am logged in as Carlos
And I am on the dashboard
When I open the team switcher dropdown
And I press the Escape key
Then the dropdown should close
```

</td>
<td>

```gherkin
Scenario: Dropdown se cierra con tecla Escape

Given estoy logueado como Carlos
And estoy en el dashboard
When abro el dropdown del selector de equipos
And presiono la tecla Escape
Then el dropdown deberia cerrarse
```

</td>
</tr>
</table>

---

### TEAM_SW_041: Team options display team names

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Team names are displayed in dropdown options

Given I am logged in as Carlos
When I open the team switcher dropdown
Then I should see "Everpoint" in the options
And I should see "Riverstone" in the options
```

</td>
<td>

```gherkin
Scenario: Nombres de equipo se muestran en opciones del dropdown

Given estoy logueado como Carlos
When abro el dropdown del selector de equipos
Then deberia ver "Everpoint" en las opciones
And deberia ver "Riverstone" en las opciones
```

</td>
</tr>
</table>

---

### TEAM_SW_042: Switcher hidden when sidebar collapsed

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Team switcher visibility follows sidebar state

Given I am logged in as Carlos
And the sidebar is expanded
And the team switcher is visible
When I collapse the sidebar
Then the team switcher should NOT be visible
When I expand the sidebar again
Then the team switcher should be visible again
```

</td>
<td>

```gherkin
Scenario: Visibilidad del selector sigue estado del sidebar

Given estoy logueado como Carlos
And el sidebar esta expandido
And el selector de equipos esta visible
When colapso el sidebar
Then el selector de equipos NO deberia estar visible
When expando el sidebar nuevamente
Then el selector de equipos deberia estar visible de nuevo
```

</td>
</tr>
</table>

---

## Viewer Role

### TEAM_SW_043: Viewer can only read customers `@security`

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Viewer has read-only access to customers

Given I am logged in as Sarah (viewer in Ironvale)
When I navigate to the customers page
Then I should either see the customer list
Or I should be redirected (access denied)
But if the list is visible, the "Add" button should NOT exist
```

</td>
<td>

```gherkin
Scenario: Viewer tiene acceso solo lectura a clientes

Given estoy logueado como Sarah (viewer en Ironvale)
When navego a la pagina de clientes
Then deberia ver la lista de clientes
Or deberia ser redirigido (acceso denegado)
But si la lista es visible, el boton "Agregar" NO deberia existir
```

</td>
</tr>
</table>

---

### TEAM_SW_044: Viewer can only read tasks `@security`

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Viewer has read-only access to tasks

Given I am logged in as Sarah (viewer in Ironvale)
When I navigate to the tasks page
Then I should either see the tasks list
Or I should be redirected (access denied)
But if the list is visible, the "Add" button should NOT exist
```

</td>
<td>

```gherkin
Scenario: Viewer tiene acceso solo lectura a tareas

Given estoy logueado como Sarah (viewer en Ironvale)
When navego a la pagina de tareas
Then deberia ver la lista de tareas
Or deberia ser redirigido (acceso denegado)
But si la lista es visible, el boton "Agregar" NO deberia existir
```

</td>
</tr>
</table>

---

### TEAM_SW_045: Viewer blocked from create URL `@security`

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Viewer blocked from create URL

Given I am logged in as Sarah (viewer in Ironvale)
When I navigate directly to /dashboard/customers/create
Then I should see "Permission Denied" message
Or I should be redirected away from the create form
And the customer creation form should NOT be visible
```

</td>
<td>

```gherkin
Scenario: Viewer bloqueado de URL de creacion

Given estoy logueado como Sarah (viewer en Ironvale)
When navego directamente a /dashboard/customers/create
Then deberia ver mensaje de "Permiso Denegado"
Or deberia ser redirigido fuera del formulario de creacion
And el formulario de creacion de cliente NO deberia estar visible
```

</td>
</tr>
</table>

---

## Mobile

### TEAM_SW_050: Switcher visible in MobileMoreSheet

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Team switcher is accessible on mobile

Given I am logged in as Carlos
And I am viewing on mobile viewport (iPhone X)
When I open the mobile "More" menu
Then the team switcher should be visible in the sheet
```

</td>
<td>

```gherkin
Scenario: Selector de equipos es accesible en movil

Given estoy logueado como Carlos
And estoy viendo en viewport movil (iPhone X)
When abro el menu "Mas" movil
Then el selector de equipos deberia estar visible en el sheet
```

</td>
</tr>
</table>

---

### TEAM_SW_051: Can switch teams from mobile

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Team switching works on mobile

Given I am logged in as Carlos
And I am viewing on mobile viewport
When I open the mobile "More" menu
And I switch to "Riverstone Ventures"
Then the page should reload
And the switcher should show "Riverstone"
```

</td>
<td>

```gherkin
Scenario: Cambio de equipo funciona en movil

Given estoy logueado como Carlos
And estoy viendo en viewport movil
When abro el menu "Mas" movil
And cambio a "Riverstone Ventures"
Then la pagina deberia recargarse
And el selector deberia mostrar "Riverstone"
```

</td>
</tr>
</table>

---

### TEAM_SW_052: Mobile shows all teams

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: All teams visible on mobile dropdown

Given I am logged in as Carlos
And I am viewing on mobile viewport
When I open the mobile "More" menu
And I open the team dropdown
Then "Everpoint Labs" should be visible
And "Riverstone Ventures" should be visible
```

</td>
<td>

```gherkin
Scenario: Todos los equipos visibles en dropdown movil

Given estoy logueado como Carlos
And estoy viendo en viewport movil
When abro el menu "Mas" movil
And abro el dropdown de equipos
Then "Everpoint Labs" deberia estar visible
And "Riverstone Ventures" deberia estar visible
```

</td>
</tr>
</table>

---

## UI Elements / Elementos UI

### Team Switcher Component

| Element | Selector | Description / Descripción |
|---------|----------|---------------------------|
| Switcher Trigger | `[data-cy="team-switcher-trigger"]` | Main switcher button |
| Dropdown | `[data-cy="team-switcher-dropdown"]` | Dropdown container |
| Team Option | `[data-cy="team-option-{slug}"]` | Individual team option |
| Manage Teams Link | `[data-cy="manage-teams-link"]` | Link to team management |
| Switch Modal | `[data-cy="team-switch-modal"]` | Loading modal during switch |

### Mobile Components

| Element | Selector | Description / Descripción |
|---------|----------|---------------------------|
| More Button | `[data-cy="mobile-more-button"]` | Mobile "More" menu trigger |
| More Sheet | `[data-cy="mobile-more-sheet"]` | Mobile bottom sheet |

### Permission Indicators

| Element | Selector | Description / Descripción |
|---------|----------|---------------------------|
| Add Button | `[data-cy="{entity}-add"]` | Create button (entity-specific) |
| Edit Button | `[data-cy="{entity}-edit-btn"]` | Edit button on detail page |
| Delete Button | `[data-cy="{entity}-delete-btn"]` | Delete button on detail page |
| Permission Denied | `[data-cy="permission-denied"]` | Permission denied message |

---

## Permission Matrix by Role / Matriz de Permisos por Rol

| Operation / Operación | Owner | Admin | Member | Viewer |
|-----------------------|:-----:|:-----:|:------:|:------:|
| View Teams | Yes | Yes | Yes | Yes |
| Switch Teams | Yes | Yes | Yes | Yes |
| Create Customer | Yes | Yes | **No** | **No** |
| Edit Customer | Yes | Yes | **No** | **No** |
| Delete Customer | Yes | Yes | **No** | **No** |
| Access /edit URL | Yes | Yes | **No** | **No** |
| Access /create URL | Yes | Yes | **No** | **No** |

---

## Test Summary / Resumen de Tests

| Test ID | Block | Description / Descripción | Tags |
|---------|-------|---------------------------|------|
| TEAM_SW_001 | Single Team | User sees teams in switcher | `@smoke` |
| TEAM_SW_002 | Single Team | Manage Teams link works | |
| TEAM_SW_010 | Multi-Team | Multi-team user sees all teams | |
| TEAM_SW_011 | Multi-Team | Current team shows checkmark | |
| TEAM_SW_012 | Multi-Team | Roles displayed correctly | |
| TEAM_SW_013 | Multi-Team | Can switch teams successfully | |
| TEAM_SW_014 | Multi-Team | Modal appears during switch | |
| TEAM_SW_020 | Data Reload | Customers reload after switch | |
| TEAM_SW_021 | Data Reload | Tasks reload after switch | |
| TEAM_SW_022 | Data Reload | Sidebar shows new team name | |
| TEAM_SW_030 | Permissions | Owner can create customer | |
| TEAM_SW_031 | Permissions | Owner can edit/delete customer | |
| TEAM_SW_032 | Permissions | Member cannot create customer | `@security` |
| TEAM_SW_033 | Permissions | Member cannot delete customer | `@security` |
| TEAM_SW_034 | Permissions | Member blocked from /edit URL | `@security` |
| TEAM_SW_035 | Permissions | Member cannot access create URL | `@security` |
| TEAM_SW_040 | UI Behavior | Dropdown closes on escape | |
| TEAM_SW_041 | UI Behavior | Team options display names | |
| TEAM_SW_042 | UI Behavior | Switcher hidden when sidebar collapsed | |
| TEAM_SW_043 | Viewer Role | Viewer can only read customers | `@security` |
| TEAM_SW_044 | Viewer Role | Viewer can only read tasks | `@security` |
| TEAM_SW_045 | Viewer Role | Viewer blocked from create URL | `@security` |
| TEAM_SW_050 | Mobile | Switcher visible in MobileMoreSheet | |
| TEAM_SW_051 | Mobile | Can switch teams from mobile | |
| TEAM_SW_052 | Mobile | Mobile shows all teams | |
