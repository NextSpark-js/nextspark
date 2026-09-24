---
feature: Editor Custom Role Permissions
priority: high
tags: [auth, custom-role, editor, permissions, security, theme]
grepTags: [uat, feat-auth, custom-role, editor]
coverage: 8
---

# Editor Custom Role Permissions

> Tests for Editor custom role permissions. Editor is a theme-defined custom role with view-only access to entities. Cannot create, update, or delete. Cannot access Sector7 or Dev Zone.

## @test EDITOR-PERM-001: Editor Dashboard Access

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** editor, dashboard
- **Grep:** `@smoke`

```gherkin:en
Scenario: Editor can access dashboard

Given I am logged in as Editor (diego.ramirez@nextspark.dev)
When I visit /dashboard
Then the dashboard container should be visible
```

```gherkin:es
Scenario: Editor puede acceder al dashboard

Given estoy logueado como Editor (diego.ramirez@nextspark.dev)
When visito /dashboard
Then el contenedor del dashboard deberia estar visible
```

### Expected Results
- Dashboard loads correctly
- Limited navigation based on permissions

---

## @test EDITOR-PERM-002: Editor View-Only Customer Access

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** editor, customers, view-only
- **Grep:** `@smoke`

```gherkin:en
Scenario: Editor has view-only access to customers list

Given I am logged in as Editor (diego.ramirez@nextspark.dev)
When I visit /customers
Then the entity list should be visible
And the create button should NOT exist
```

```gherkin:es
Scenario: Editor tiene acceso solo lectura a lista de customers

Given estoy logueado como Editor (diego.ramirez@nextspark.dev)
When visito /customers
Then la lista de entidades deberia estar visible
And el boton de crear NO deberia existir
```

### Expected Results
- Can view customer list
- No create button
- Read-only experience

---

## @test EDITOR-PERM-003: Editor Cannot Edit Customers

### Metadata
- **Priority:** High
- **Type:** Security
- **Tags:** editor, customers, no-edit

```gherkin:en
Scenario: Editor cannot see edit buttons on customers

Given I am logged in as Editor (diego.ramirez@nextspark.dev)
When I visit /customers
Then the entity list should be visible
And edit buttons should not exist on items
And delete buttons should not exist on items
```

```gherkin:es
Scenario: Editor no puede ver botones de editar en customers

Given estoy logueado como Editor (diego.ramirez@nextspark.dev)
When visito /customers
Then la lista de entidades deberia estar visible
And los botones de editar no deberian existir en items
And los botones de eliminar no deberian existir en items
```

### Expected Results
- No edit action buttons
- No delete action buttons
- Pure read-only interface

---

## @test EDITOR-PERM-004: Editor Tasks Access

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** editor, tasks, read-only

```gherkin:en
Scenario: Editor has read-only access to tasks

Given I am logged in as Editor (diego.ramirez@nextspark.dev)
When I visit /tasks
Then the entity list should be visible
And the create button should NOT exist
```

```gherkin:es
Scenario: Editor tiene acceso solo lectura a tasks

Given estoy logueado como Editor (diego.ramirez@nextspark.dev)
When visito /tasks
Then la lista de entidades deberia estar visible
And el boton de crear NO deberia existir
```

### Expected Results
- Can view task list
- No create functionality

---

## @test EDITOR-PERM-005: Editor Settings Access

### Metadata
- **Priority:** Normal
- **Type:** Regression
- **Tags:** editor, settings

```gherkin:en
Scenario: Editor has profile-only settings access

Given I am logged in as Editor (diego.ramirez@nextspark.dev)
When I visit /settings
Then I should see profile tab or be redirected
```

```gherkin:es
Scenario: Editor tiene acceso solo a perfil en settings

Given estoy logueado como Editor (diego.ramirez@nextspark.dev)
When visito /settings
Then deberia ver pestana de perfil o ser redirigido
```

### Expected Results
- Profile settings accessible
- No team settings access

---

## @test EDITOR-PERM-006: Editor Cannot Access Sector7

### Metadata
- **Priority:** High
- **Type:** Security
- **Tags:** editor, sector7, blocked

```gherkin:en
Scenario: Editor is blocked from Sector7

Given I am logged in as Editor (diego.ramirez@nextspark.dev)
When I attempt to visit /sector7
Then I should be redirected away from /sector7
```

```gherkin:es
Scenario: Editor no puede acceder a Sector7

Given estoy logueado como Editor (diego.ramirez@nextspark.dev)
When intento visitar /sector7
Then deberia ser redirigido fuera de /sector7
```

### Expected Results
- Access denied
- Redirect to dashboard

---

## @test EDITOR-PERM-007: Editor Cannot Access Dev Zone

### Metadata
- **Priority:** High
- **Type:** Security
- **Tags:** editor, dev-zone, blocked

```gherkin:en
Scenario: Editor is blocked from Dev Zone

Given I am logged in as Editor (diego.ramirez@nextspark.dev)
When I attempt to visit /dev
Then I should be redirected away from /dev
```

```gherkin:es
Scenario: Editor no puede acceder a Dev Zone

Given estoy logueado como Editor (diego.ramirez@nextspark.dev)
When intento visitar /dev
Then deberia ser redirigido fuera de /dev
```

### Expected Results
- Access denied
- Redirect to dashboard

---

## @test EDITOR-PERM-008: Editor Logout Flow

### Metadata
- **Priority:** Normal
- **Type:** Regression
- **Tags:** editor, logout

```gherkin:en
Scenario: Editor can logout successfully

Given I am logged in as Editor (diego.ramirez@nextspark.dev)
And I am on the dashboard
When I click on user menu
And I click on Sign Out
Then I should be redirected to /login
```

```gherkin:es
Scenario: Editor puede cerrar sesion correctamente

Given estoy logueado como Editor (diego.ramirez@nextspark.dev)
And estoy en el dashboard
When hago click en el menu de usuario
And hago click en Sign Out
Then deberia ser redirigido a /login
```

### Expected Results
- Logout works correctly
- Redirect to login page

---

## UI Elements

| Element | Selector | Description |
|---------|----------|-------------|
| Dashboard Container | `[data-cy="dashboard-container"]` | Main dashboard container |
| Create Button | `[data-cy="entity-create-button"]` | Entity create button (should not exist) |
| Entity List | `[data-cy="entity-list-container"]` | Entity list container |
| Row Edit | `[data-cy="entity-row-edit"]` | Row edit button (should not exist) |
| Row Delete | `[data-cy="entity-row-delete"]` | Row delete button (should not exist) |
| Settings Container | `[data-cy="settings-container"]` | Settings page container |
| Profile Tab | `[data-cy="settings-tab-profile"]` | Profile settings tab |
| User Menu | `[data-cy="topnav-user-menu-trigger"]` | User menu trigger |
| Sign Out | `[data-cy="topnav-menu-signOut"]` | Sign out button |

---

## Summary

| Test ID | Block | Description | Tags |
|---------|-------|-------------|------|
| EDITOR-PERM-001 | Access | Dashboard access | `@smoke` |
| EDITOR-PERM-002 | View-Only | View-only customers | `@smoke` |
| EDITOR-PERM-003 | Blocked | Cannot edit customers | |
| EDITOR-PERM-004 | View-Only | Read-only tasks | |
| EDITOR-PERM-005 | Access | Profile-only settings | |
| EDITOR-PERM-006 | Blocked | Sector7 blocked | |
| EDITOR-PERM-007 | Blocked | Dev Zone blocked | |
| EDITOR-PERM-008 | Logout | Logout flow | |
