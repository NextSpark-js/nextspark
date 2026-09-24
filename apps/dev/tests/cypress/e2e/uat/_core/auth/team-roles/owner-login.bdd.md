---
feature: Owner Team Role Permissions
priority: critical
tags: [auth, team-role, owner, permissions, security]
grepTags: [uat, feat-auth, team-role, owner]
coverage: 6
---

# Owner Team Role Permissions

> Tests for Owner team role permissions and access control. Owner is the highest team-based role with full CRUD access to all entities, team settings, and billing. Does not have access to app-role areas like /dev or /sector7.

## @test OWNER-PERM-001: Owner Dashboard Access

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** owner, dashboard, navigation
- **Grep:** `@smoke`

```gherkin:en
Scenario: Owner can access dashboard with full navigation

Given I am logged in as Owner (carlos.mendoza@nextspark.dev)
When I visit /dashboard
Then the dashboard container should be visible
And I should see navigation for customers
And I should see navigation for tasks
```

```gherkin:es
Scenario: Owner puede acceder al dashboard con navegacion completa

Given estoy logueado como Owner (carlos.mendoza@nextspark.dev)
When visito /dashboard
Then el contenedor del dashboard deberia estar visible
And deberia ver navegacion a customers
And deberia ver navegacion a tasks
```

### Expected Results
- Dashboard loads correctly
- All navigation items visible
- No restrictions on sidebar

---

## @test OWNER-PERM-002: Owner Full Entity Access

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** owner, customers, crud
- **Grep:** `@smoke`

```gherkin:en
Scenario: Owner has full CRUD access to customers

Given I am logged in as Owner (carlos.mendoza@nextspark.dev)
When I visit /customers
Then the create button should be visible
And the entity list should be visible
```

```gherkin:es
Scenario: Owner tiene acceso CRUD completo a customers

Given estoy logueado como Owner (carlos.mendoza@nextspark.dev)
When visito /customers
Then el boton de crear deberia estar visible
And la lista de entidades deberia estar visible
```

### Expected Results
- Create button is visible (can create)
- List is visible (can read)
- Edit/Delete buttons available on items

---

## @test OWNER-PERM-003: Owner Team Settings Access

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** owner, settings, team

```gherkin:en
Scenario: Owner can access team settings

Given I am logged in as Owner (carlos.mendoza@nextspark.dev)
When I visit /settings
Then the settings container should be visible
And the team settings tab should be visible
```

```gherkin:es
Scenario: Owner puede acceder a configuracion de equipo

Given estoy logueado como Owner (carlos.mendoza@nextspark.dev)
When visito /settings
Then el contenedor de settings deberia estar visible
And la pestana de team settings deberia estar visible
```

### Expected Results
- Settings page loads
- Team settings tab accessible
- Can manage team configuration

---

## @test OWNER-PERM-004: Owner Billing Access

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** owner, billing

```gherkin:en
Scenario: Owner can access billing

Given I am logged in as Owner (carlos.mendoza@nextspark.dev)
When I visit /billing
Then the billing container should be visible
```

```gherkin:es
Scenario: Owner puede acceder a billing

Given estoy logueado como Owner (carlos.mendoza@nextspark.dev)
When visito /billing
Then el contenedor de billing deberia estar visible
```

### Expected Results
- Billing page loads
- Plan information visible
- Upgrade options available

---

## @test OWNER-PERM-005: Owner Cannot Access Sector7

### Metadata
- **Priority:** High
- **Type:** Security
- **Tags:** owner, sector7, blocked

```gherkin:en
Scenario: Owner is blocked from Sector7

Given I am logged in as Owner (carlos.mendoza@nextspark.dev)
When I attempt to visit /sector7
Then I should be redirected away from /sector7
And the URL should include /dashboard or error=access_denied
```

```gherkin:es
Scenario: Owner no puede acceder a Sector7

Given estoy logueado como Owner (carlos.mendoza@nextspark.dev)
When intento visitar /sector7
Then deberia ser redirigido fuera de /sector7
And la URL deberia incluir /dashboard o error=access_denied
```

### Expected Results
- Access denied to Sector7
- Redirect to dashboard with error
- Security control working

---

## @test OWNER-PERM-006: Owner Cannot Access Dev Zone

### Metadata
- **Priority:** High
- **Type:** Security
- **Tags:** owner, dev-zone, blocked

```gherkin:en
Scenario: Owner is blocked from Dev Zone

Given I am logged in as Owner (carlos.mendoza@nextspark.dev)
When I attempt to visit /dev
Then I should be redirected away from /dev
And the URL should include /dashboard or error=access_denied
```

```gherkin:es
Scenario: Owner no puede acceder a Dev Zone

Given estoy logueado como Owner (carlos.mendoza@nextspark.dev)
When intento visitar /dev
Then deberia ser redirigido fuera de /dev
And la URL deberia incluir /dashboard o error=access_denied
```

### Expected Results
- Access denied to Dev Zone
- Redirect to dashboard with error
- Security control working

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
| Team Settings Tab | `[data-cy="settings-tab-team"]` | Team settings tab |
| Billing Container | `[data-cy="billing-container"]` | Billing page container |

---

## Summary

| Test ID | Block | Description | Tags |
|---------|-------|-------------|------|
| OWNER-PERM-001 | Access | Dashboard with full navigation | `@smoke` |
| OWNER-PERM-002 | Access | Full CRUD access to customers | `@smoke` |
| OWNER-PERM-003 | Access | Team settings access | |
| OWNER-PERM-004 | Access | Billing access | |
| OWNER-PERM-005 | Blocked | Cannot access Sector7 | |
| OWNER-PERM-006 | Blocked | Cannot access Dev Zone | |
