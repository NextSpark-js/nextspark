---
feature: Superadmin Dashboard (Admin Panel)
priority: critical
tags: [superadmin, dashboard, navigation]
grepTags: [uat, feat-superadmin, superadmin, dashboard]
coverage: 6
---

# Superadmin Dashboard (Admin Panel)

> Tests for the Admin Panel superadmin dashboard including access control, navigation menu, quick stats display, and navigation to management pages.

## @test ADMIN-DASH-001: Dashboard Access

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** superadmin, dashboard, access
- **Grep:** `@smoke`

```gherkin:en
Scenario: Superadmin can access Admin Panel dashboard

Given I am logged in as Superadmin (superadmin@nextspark.dev)
When I visit /admin
Then the URL should include /admin
And the superadmin container should be visible
And the header should display "Super Administrator Control Panel"
```

```gherkin:es
Scenario: Superadmin puede acceder al dashboard de Admin Panel

Given estoy logueado como Superadmin (superadmin@nextspark.dev)
When visito /admin
Then la URL deberia incluir /admin
And el contenedor de superadmin deberia estar visible
And el header deberia mostrar "Super Administrator Control Panel"
```

### Expected Results
- Dashboard loads correctly
- Header displays correct title
- No access denied errors

---

## @test ADMIN-DASH-002: Navigation Menu

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** superadmin, navigation, menu
- **Grep:** `@smoke`

```gherkin:en
Scenario: Dashboard displays all navigation items

Given I am logged in as Superadmin
When I visit /admin
Then the dashboard nav item should be visible
And the users nav item should be visible
And the teams nav item should be visible
```

```gherkin:es
Scenario: Dashboard muestra todos los items de navegacion

Given estoy logueado como Superadmin
When visito /admin
Then el nav item de dashboard deberia estar visible
And el nav item de users deberia estar visible
And el nav item de teams deberia estar visible
```

### Expected Results
- All navigation items visible
- Navigation items are clickable

---

## @test ADMIN-DASH-003: Quick Stats Display

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** superadmin, stats, dashboard

```gherkin:en
Scenario: Dashboard displays system statistics

Given I am logged in as Superadmin
When I visit /admin
Then the superadmin container should be visible
And I should see stats cards (users count, teams count) if available
```

```gherkin:es
Scenario: Dashboard muestra estadisticas del sistema

Given estoy logueado como Superadmin
When visito /admin
Then el contenedor de superadmin deberia estar visible
And deberia ver cards de estadisticas (conteo de usuarios, teams) si estan disponibles
```

### Expected Results
- Stats section displays or gracefully handles absence
- Data reflects current system state

---

## @test ADMIN-DASH-004: Navigation to Users

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** superadmin, navigation, users

```gherkin:en
Scenario: Navigate to Users management from dashboard

Given I am logged in as Superadmin
And I am on /admin
When I click on the Users nav item
Then the URL should include /admin/users
And I should see "User Management" heading
```

```gherkin:es
Scenario: Navegar a gestion de Users desde dashboard

Given estoy logueado como Superadmin
And estoy en /admin
When hago click en el nav item de Users
Then la URL deberia incluir /admin/users
And deberia ver el heading "User Management"
```

### Expected Results
- Navigation works correctly
- Users page loads

---

## @test ADMIN-DASH-005: Navigation to Teams

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** superadmin, navigation, teams

```gherkin:en
Scenario: Navigate to Teams management from dashboard

Given I am logged in as Superadmin
And I am on /admin
When I click on the Teams nav item
Then the URL should include /admin/teams
And I should see "Team Management" heading
```

```gherkin:es
Scenario: Navegar a gestion de Teams desde dashboard

Given estoy logueado como Superadmin
And estoy en /admin
When hago click en el nav item de Teams
Then la URL deberia incluir /admin/teams
And deberia ver el heading "Team Management"
```

### Expected Results
- Navigation works correctly
- Teams page loads

---

## @test ADMIN-DASH-006: Exit to Main Dashboard

### Metadata
- **Priority:** Normal
- **Type:** Regression
- **Tags:** superadmin, navigation, exit

```gherkin:en
Scenario: Exit Admin Panel to main dashboard

Given I am logged in as Superadmin
And I am on /admin
When I click on the exit to dashboard button
Then the URL should include /dashboard
And the URL should not include /admin
```

```gherkin:es
Scenario: Salir de Admin Panel al dashboard principal

Given estoy logueado como Superadmin
And estoy en /admin
When hago click en el boton de salir al dashboard
Then la URL deberia incluir /dashboard
And la URL no deberia incluir /admin
```

### Expected Results
- Exit button works
- Returns to main dashboard

---

## UI Elements

| Element | Selector | Description |
|---------|----------|-------------|
| Container | `[data-cy="superadmin-container"]` | Main Admin Panel container |
| Nav Dashboard | `[data-cy="superadmin-nav-dashboard"]` | Dashboard nav item |
| Nav Users | `[data-cy="superadmin-nav-users"]` | Users nav item |
| Nav Teams | `[data-cy="superadmin-nav-teams"]` | Teams nav item |
| Stats Users | `[data-cy="superadmin-metric-{name}"]` | Users count stat |
| Stats Teams | `[data-cy="superadmin-metric-{name}"]` | Teams count stat |
| Exit Button | `[data-cy="superadmin-sidebar-exit"]` | Exit to dashboard button |

---

## Summary

| Test ID | Block | Description | Tags |
|---------|-------|-------------|------|
| ADMIN-DASH-001 | Access | Dashboard access | `@smoke` |
| ADMIN-DASH-002 | Navigation | Navigation menu items | `@smoke` |
| ADMIN-DASH-003 | Stats | Quick stats display | |
| ADMIN-DASH-004 | Navigation | Navigate to Users | |
| ADMIN-DASH-005 | Navigation | Navigate to Teams | |
| ADMIN-DASH-006 | Navigation | Exit to main dashboard | |
