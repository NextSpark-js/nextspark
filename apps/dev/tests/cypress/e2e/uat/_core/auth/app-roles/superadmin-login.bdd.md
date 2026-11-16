---
feature: SuperAdmin Authentication Flow
priority: critical
tags: [authentication, superadmin, superadmin, security]
grepTags: [uat, feat-auth, security, regression]
coverage: 1
---

# SuperAdmin Authentication Flow

> Complete authentication flow for SuperAdmin users including Superadmin access, user/team management navigation, and logout.

## @test SUPERADMIN_001: SuperAdmin complete login and Superadmin flow

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** auth, superadmin, security
- **Grep:** `@smoke`, `@security`

```gherkin:en
Scenario: SuperAdmin complete flow - login, Superadmin access, navigate tables, logout

Given I am logged in as SuperAdmin (superadmin@nextspark.dev)
And I am on the dashboard

# Superadmin Access
When I verify the Superadmin icon is visible in TopNavbar
And I click the Superadmin icon
Then the URL should include /superadmin
And "Super Administrator Control Panel" should be visible

# Users Management
When I click the Users navigation link
Then the URL should include /superadmin/users
And "User Management" should be visible
And a table should be visible

# Teams Management
When I click the Teams navigation link
Then the URL should include /superadmin/teams
And "Team Management" should be visible
And a table should be visible

# Exit Superadmin
When I click the "Exit to Dashboard" button
Then the URL should include /dashboard
And the URL should not include /superadmin

# Logout
When I click the user menu trigger
And I click the Sign Out option
Then I should be redirected to /login
```

```gherkin:es
Scenario: Flujo completo SuperAdmin - login, acceso Superadmin, navegar tablas, logout

Given estoy logueado como SuperAdmin (superadmin@nextspark.dev)
And estoy en el dashboard

# Acceso a Superadmin
When verifico que el icono de Superadmin esta visible en TopNavbar
And hago clic en el icono de Superadmin
Then la URL deberia incluir /superadmin
And "Super Administrator Control Panel" deberia estar visible

# Gestion de Usuarios
When hago clic en el enlace de navegacion Users
Then la URL deberia incluir /superadmin/users
And "User Management" deberia estar visible
And una tabla deberia estar visible

# Gestion de Equipos
When hago clic en el enlace de navegacion Teams
Then la URL deberia incluir /superadmin/teams
And "Team Management" deberia estar visible
And una tabla deberia estar visible

# Salir de Superadmin
When hago clic en el boton "Exit to Dashboard"
Then la URL deberia incluir /dashboard
And la URL no deberia incluir /superadmin

# Cerrar Sesion
When hago clic en el trigger del menu de usuario
And hago clic en la opcion Sign Out
Then deberia ser redirigido a /login
```

### Expected Results
- SuperAdmin can access dashboard after login
- Superadmin icon visible in TopNavbar (superadmin only)
- Superadmin control panel accessible
- Users and Teams management tables visible
- Exit to dashboard works correctly
- Logout redirects to login page

---

## UI Elements

| Element | Selector | Description |
|---------|----------|-------------|
| Superadmin Icon | `[data-cy="topnav-superadmin"]` | Superadmin access (SuperAdmin/Developer only) |
| Users Nav | `[data-cy="superadmin-nav-users"]` | Navigate to Users management |
| Teams Nav | `[data-cy="superadmin-nav-teams"]` | Navigate to Teams management |
| Exit Button | `[data-cy="superadmin-sidebar-exit-to-dashboard"]` | Exit Superadmin to dashboard |
| User Menu | `[data-cy="topnav-user-menu-trigger"]` | User dropdown menu trigger |
| Sign Out | `[data-cy="topnav-menu-signOut"]` | Logout option |

---

## Summary

| Test ID | Block | Description | Tags |
|---------|-------|-------------|------|
| SUPERADMIN_001 | Complete Flow | Login, Superadmin access, Users/Teams navigation, Logout | `@smoke`, `@security`, `@critical` |
