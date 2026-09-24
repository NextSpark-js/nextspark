# Sector7 - Team Roles Matrix (Format: BDD/Gherkin - Bilingual)

> **Test File:** `team-roles-matrix.cy.ts`
> **Format:** Behavior-Driven Development (BDD) with Given/When/Then
> **Languages:** English / Spanish (side-by-side)
> **Total Tests:** 9

---

## Feature: Sector7 Team Roles Permissions Matrix

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

As a **SuperAdmin**
I want to **view the consolidated permissions matrix for all team roles**
So that **I can verify role configurations and permission assignments**

**Scope:** Sector7 admin panel - Team Roles page
**Access:** SuperAdmin only

The matrix displays:
- All team roles with hierarchy levels
- Permissions grouped by category
- Visual indicators for granted permissions
- Dangerous permissions highlighted

</td>
<td>

Como **SuperAdmin**
Quiero **ver la matriz consolidada de permisos para todos los roles de equipo**
Para que **pueda verificar configuraciones de roles y asignaciones de permisos**

**Alcance:** Panel admin Sector7 - Pagina Team Roles
**Acceso:** Solo SuperAdmin

La matriz muestra:
- Todos los roles de equipo con niveles de jerarquia
- Permisos agrupados por categoria
- Indicadores visuales para permisos otorgados
- Permisos peligrosos destacados

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
Given I am logged in as SuperAdmin (superadmin@nextspark.dev)
And I have access to Sector7 admin panel
And the application is running
```

</td>
<td>

```gherkin
Given estoy logueado como SuperAdmin (superadmin@nextspark.dev)
And tengo acceso al panel admin de Sector7
And la aplicacion esta corriendo
```

</td>
</tr>
</table>

---

## Role Hierarchy Display `@smoke`

### S7_MATRIX_001: Matrix displays all 5 team roles `@smoke`

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: All team roles are displayed in the matrix

Given I am logged in as SuperAdmin
When I navigate to /sector7/team-roles
Then I should see role cards for:
  | Role   |
  | owner  |
  | admin  |
  | member |
  | editor |
  | viewer |
```

</td>
<td>

```gherkin
Scenario: Todos los roles de equipo se muestran en la matriz

Given estoy logueado como SuperAdmin
When navego a /sector7/team-roles
Then deberia ver tarjetas de rol para:
  | Rol    |
  | owner  |
  | admin  |
  | member |
  | editor |
  | viewer |
```

</td>
</tr>
</table>

---

### S7_MATRIX_002: Roles show correct hierarchy levels

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Role cards display correct hierarchy levels

Given I am logged in as SuperAdmin
When I navigate to /sector7/team-roles
Then I should see the following hierarchy levels:
  | Role   | Level |
  | owner  | 100   |
  | admin  | 50    |
  | member | 10    |
  | editor | 5     |
  | viewer | 1     |
```

**Note:** Hierarchy determines permission inheritance and role comparison.

</td>
<td>

```gherkin
Scenario: Tarjetas de rol muestran niveles de jerarquia correctos

Given estoy logueado como SuperAdmin
When navego a /sector7/team-roles
Then deberia ver los siguientes niveles de jerarquia:
  | Rol    | Nivel |
  | owner  | 100   |
  | admin  | 50    |
  | member | 10    |
  | editor | 5     |
  | viewer | 1     |
```

**Nota:** La jerarquia determina herencia de permisos y comparacion de roles.

</td>
</tr>
</table>

---

## Permissions by Category

### S7_MATRIX_003: Permissions are grouped by category

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Matrix groups permissions by category

Given I am logged in as SuperAdmin
When I view the permissions matrix
Then I should see category headers including:
  | Category  |
  | Team      |
  | Customers |
  | Pages     |
  | Posts     |
  | Tasks     |
  | Teams     |
  | Users     |
```

</td>
<td>

```gherkin
Scenario: Matriz agrupa permisos por categoria

Given estoy logueado como SuperAdmin
When veo la matriz de permisos
Then deberia ver encabezados de categoria incluyendo:
  | Categoria |
  | Team      |
  | Customers |
  | Pages     |
  | Posts     |
  | Tasks     |
  | Teams     |
  | Users     |
```

</td>
</tr>
</table>

---

## Owner Permissions `@smoke`

### S7_MATRIX_004: Owner has all permissions `@smoke`

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Owner role has all permissions

Given I am logged in as SuperAdmin
When I view the permissions matrix
And I check the Owner column
Then all permission rows should have a green checkmark for Owner
And Owner should have access to all operations
```

**Note:** Owner is the protected role with full access.

</td>
<td>

```gherkin
Scenario: Rol Owner tiene todos los permisos

Given estoy logueado como SuperAdmin
When veo la matriz de permisos
And verifico la columna Owner
Then todas las filas de permisos deberian tener marca verde para Owner
And Owner deberia tener acceso a todas las operaciones
```

**Nota:** Owner es el rol protegido con acceso completo.

</td>
</tr>
</table>

---

## Editor Permissions

### S7_MATRIX_005: Editor has only team view permissions

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Editor has only basic team view permissions

Given I am logged in as SuperAdmin
When I view the permissions matrix
And I check the Editor column for team permissions
Then I should see Editor has only 2 permissions:
  | Permission        | Access |
  | team.view         | Yes    |
  | team.members.view | Yes    |
And Editor should NOT have:
  | Permission           | Access |
  | teams.invite         | No     |
  | teams.remove_member  | No     |
```

**Note:** Editor is a custom role with minimal permissions (hierarchy level 5).

</td>
<td>

```gherkin
Scenario: Editor tiene solo permisos basicos de visualizacion de equipo

Given estoy logueado como SuperAdmin
When veo la matriz de permisos
And verifico la columna Editor para permisos de equipo
Then deberia ver que Editor tiene solo 2 permisos:
  | Permiso           | Acceso |
  | team.view         | Si     |
  | team.members.view | Si     |
And Editor NO deberia tener:
  | Permiso              | Acceso |
  | teams.invite         | No     |
  | teams.remove_member  | No     |
```

**Nota:** Editor es un rol personalizado con permisos minimos (nivel jerarquia 5).

</td>
</tr>
</table>

---

### S7_MATRIX_006: Editor cannot access dangerous operations

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Editor has no team management permissions

Given I am logged in as SuperAdmin
When I view the permissions matrix
Then the Editor column should show X (no access) for:
  | Permission           |
  | teams.invite         |
  | teams.remove_member  |
```

**Severity:** Blocker - security-critical validation

</td>
<td>

```gherkin
Scenario: Editor no tiene permisos de gestion de equipo

Given estoy logueado como SuperAdmin
When veo la matriz de permisos
Then la columna Editor deberia mostrar X (sin acceso) para:
  | Permiso              |
  | teams.invite         |
  | teams.remove_member  |
```

**Severidad:** Bloqueante - validacion critica de seguridad

</td>
</tr>
</table>

---

## Dangerous Permissions

### S7_MATRIX_007: Dangerous permissions are highlighted

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Dangerous operations are marked with badge

Given I am logged in as SuperAdmin
When I view the permissions matrix
Then the "teams.remove_member" permission should have a "dangerous" badge
And dangerous permissions should be displayed in red
```

**Note:** The dangerous badge identifies high-risk operations.

</td>
<td>

```gherkin
Scenario: Operaciones peligrosas estan marcadas con etiqueta

Given estoy logueado como SuperAdmin
When veo la matriz de permisos
Then el permiso "teams.remove_member" deberia tener etiqueta "dangerous"
And los permisos peligrosos deberian mostrarse en rojo
```

**Nota:** La etiqueta dangerous identifica operaciones de alto riesgo.

</td>
</tr>
</table>

---

## Stats Cards

### S7_MATRIX_008: Stats cards show correct counts

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Page displays accurate statistics

Given I am logged in as SuperAdmin
When I navigate to /sector7/team-roles
Then I should see stats cards showing:
  | Stat            | Value |
  | Available Roles | 5     |
  | Protected Role  | owner |
```

</td>
<td>

```gherkin
Scenario: Pagina muestra estadisticas precisas

Given estoy logueado como SuperAdmin
When navego a /sector7/team-roles
Then deberia ver tarjetas de estadisticas mostrando:
  | Estadistica     | Valor |
  | Available Roles | 5     |
  | Protected Role  | owner |
```

</td>
</tr>
</table>

---

## Permission Counts per Role

### S7_MATRIX_009: Role cards show permission counts

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Role cards display permission count summary

Given I am logged in as SuperAdmin
When I view the role hierarchy section
Then each role card should display "X permissions"
And Owner should have the most permissions
And Viewer should have the least permissions
And Editor should have fewer permissions than Member
```

</td>
<td>

```gherkin
Scenario: Tarjetas de rol muestran resumen de cantidad de permisos

Given estoy logueado como SuperAdmin
When veo la seccion de jerarquia de roles
Then cada tarjeta de rol deberia mostrar "X permissions"
And Owner deberia tener mas permisos
And Viewer deberia tener menos permisos
And Editor deberia tener menos permisos que Member
```

</td>
</tr>
</table>

---

## Role Hierarchy Matrix / Matriz de Jerarquia de Roles

| Role / Rol | Level / Nivel | Total Permissions | Description / Descripción |
|------------|:-------------:|:-----------------:|---------------------------|
| Owner | 100 | 46 | Protected role, full access |
| Admin | 50 | 43 | Administrative access |
| Member | 10 | 16 | Standard team member |
| **Editor** | **5** | **2** | **Custom role with team.view + team.members.view only** |
| Viewer | 1 | 6 | View-only access |

---

## UI Elements / Elementos UI

### Sector7 Team Roles Page

| Element | Selector | Description / Descripción |
|---------|----------|---------------------------|
| Role Card | `[data-cy="role-card-{role}"]` | Individual role card |
| Permission Row | `[data-cy="permission-row-{permission}"]` | Permission row in matrix |
| Category Header | `.bg-muted\/50` | Category section header |
| Checkmark | `.text-green-600` | Permission granted indicator |
| X Mark | `.text-red-400\/60` | Permission denied indicator |
| Dangerous Badge | `.destructive` | Dangerous permission badge |
| Stats Card | `.border .text-2xl` | Statistics display cards |

---

## Summary / Resumen

| Test ID | Block | Description / Descripción | Tags |
|---------|-------|---------------------------|------|
| S7_MATRIX_001 | Role Hierarchy | All 5 roles displayed | `@smoke` |
| S7_MATRIX_002 | Role Hierarchy | Correct hierarchy levels | |
| S7_MATRIX_003 | Categories | Permissions grouped | |
| S7_MATRIX_004 | Owner Permissions | Owner has all permissions | `@smoke` |
| S7_MATRIX_005 | Editor Permissions | Editor has only team view permissions (2) | |
| S7_MATRIX_006 | Editor Permissions | Editor cannot access team management | |
| S7_MATRIX_007 | Dangerous | teams.remove_member highlighted | |
| S7_MATRIX_008 | Stats | Correct counts displayed | |
| S7_MATRIX_009 | Counts | Permission counts per role | |
