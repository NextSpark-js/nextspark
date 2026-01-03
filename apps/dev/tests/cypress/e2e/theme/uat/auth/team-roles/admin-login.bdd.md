---
feature: Admin Team Role Permissions
priority: critical
tags: [auth, team-role, admin, permissions, security]
grepTags: [uat, feat-auth, team-role, admin]
coverage: 6
---

# Admin Team Role Permissions

> Tests for Admin team role permissions and access control. Admin has full CRUD access to entities but limited team settings and no billing management. Cannot access app-role areas.

## @test ADMIN-PERM-001: Admin Dashboard Access

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** admin, dashboard, navigation
- **Grep:** `@smoke`

```gherkin:en
Scenario: Admin can access dashboard with full navigation

Given I am logged in as Admin (james.wilson@nextspark.dev)
When I visit /dashboard
Then the dashboard container should be visible
And I should see navigation for customers
And I should see navigation for tasks
```

```gherkin:es
Scenario: Admin puede acceder al dashboard con navegacion completa

Given estoy logueado como Admin (james.wilson@nextspark.dev)
When visito /dashboard
Then el contenedor del dashboard deberia estar visible
And deberia ver navegacion a customers
And deberia ver navegacion a tasks
```

### Expected Results
- Dashboard loads correctly
- Navigation items visible
- No entity restrictions

---

## @test ADMIN-PERM-002: Admin Full Entity Access

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** admin, customers, crud
- **Grep:** `@smoke`

```gherkin:en
Scenario: Admin has full CRUD access to customers

Given I am logged in as Admin (james.wilson@nextspark.dev)
When I visit /customers
Then the create button should be visible
And the entity list should be visible
```

```gherkin:es
Scenario: Admin tiene acceso CRUD completo a customers

Given estoy logueado como Admin (james.wilson@nextspark.dev)
When visito /customers
Then el boton de crear deberia estar visible
And la lista de entidades deberia estar visible
```

### Expected Results
- Full CRUD access to entities
- Create button visible
- Edit/Delete available

---

## @test ADMIN-PERM-003: Admin Settings Access

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** admin, settings

```gherkin:en
Scenario: Admin can access settings with limited options

Given I am logged in as Admin (james.wilson@nextspark.dev)
When I visit /settings
Then the settings container should be visible
And the profile tab should be visible
```

```gherkin:es
Scenario: Admin puede acceder a settings con opciones limitadas

Given estoy logueado como Admin (james.wilson@nextspark.dev)
When visito /settings
Then el contenedor de settings deberia estar visible
And la pestana de perfil deberia estar visible
```

### Expected Results
- Settings accessible
- Profile management available
- Some team settings may be restricted

---

## @test ADMIN-PERM-004: Admin Billing Restricted Access

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** admin, billing, restricted

```gherkin:en
Scenario: Admin has view-only or no access to billing

Given I am logged in as Admin (james.wilson@nextspark.dev)
When I visit /billing
Then I should have view-only access or be redirected
```

```gherkin:es
Scenario: Admin tiene acceso solo lectura o sin acceso a billing

Given estoy logueado como Admin (james.wilson@nextspark.dev)
When visito /billing
Then deberia tener acceso solo lectura o ser redirigido
```

### Expected Results
- Either view-only billing access
- Or redirect to dashboard
- No upgrade/payment buttons if accessible

---

## @test ADMIN-PERM-005: Admin Cannot Access Sector7

### Metadata
- **Priority:** High
- **Type:** Security
- **Tags:** admin, sector7, blocked

```gherkin:en
Scenario: Admin is blocked from Sector7

Given I am logged in as Admin (james.wilson@nextspark.dev)
When I attempt to visit /sector7
Then I should be redirected away from /sector7
```

```gherkin:es
Scenario: Admin no puede acceder a Sector7

Given estoy logueado como Admin (james.wilson@nextspark.dev)
When intento visitar /sector7
Then deberia ser redirigido fuera de /sector7
```

### Expected Results
- Access denied to Sector7
- Redirect to dashboard

---

## @test ADMIN-PERM-006: Admin Cannot Access Dev Zone

### Metadata
- **Priority:** High
- **Type:** Security
- **Tags:** admin, dev-zone, blocked

```gherkin:en
Scenario: Admin is blocked from Dev Zone

Given I am logged in as Admin (james.wilson@nextspark.dev)
When I attempt to visit /dev
Then I should be redirected away from /dev
```

```gherkin:es
Scenario: Admin no puede acceder a Dev Zone

Given estoy logueado como Admin (james.wilson@nextspark.dev)
When intento visitar /dev
Then deberia ser redirigido fuera de /dev
```

### Expected Results
- Access denied to Dev Zone
- Redirect to dashboard

---

## UI Elements

| Element | Selector | Description |
|---------|----------|-------------|
| Dashboard Container | `[data-cy="dashboard-container"]` | Main dashboard container |
| Customers Nav | `[data-cy="sidebar-nav-customers"]` | Customers navigation item |
| Tasks Nav | `[data-cy="sidebar-nav-tasks"]` | Tasks navigation item |
| Create Button | `[data-cy="entity-create-button"]` | Entity create button |
| Entity List | `[data-cy="entity-list-container"]` | Entity list container |
| Settings Container | `[data-cy="settings-container"]` | Settings page container |
| Profile Tab | `[data-cy="settings-tab-profile"]` | Profile settings tab |
| Billing Container | `[data-cy="billing-container"]` | Billing page container |

---

## Summary

| Test ID | Block | Description | Tags |
|---------|-------|-------------|------|
| ADMIN-PERM-001 | Access | Dashboard with navigation | `@smoke` |
| ADMIN-PERM-002 | Access | Full CRUD to customers | `@smoke` |
| ADMIN-PERM-003 | Access | Settings with limits | |
| ADMIN-PERM-004 | Restricted | View-only billing | |
| ADMIN-PERM-005 | Blocked | Cannot access Sector7 | |
| ADMIN-PERM-006 | Blocked | Cannot access Dev Zone | |
