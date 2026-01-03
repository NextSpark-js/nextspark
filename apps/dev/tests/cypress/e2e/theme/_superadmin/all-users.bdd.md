---
feature: Superadmin All Users Management
priority: high
tags: [sector7, superadmin, users, management]
grepTags: [uat, feat-sector7, superadmin, users]
coverage: 11
---

# Superadmin All Users Management

> Tests for the Admin Panel all users management page. Superadmin can view all users across the platform, see their details, email verification status, app roles, and team memberships.

## @test ADMIN-USERS-001: Users List Access

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** sector7, users, access
- **Grep:** `@smoke`

```gherkin:en
Scenario: Superadmin can access all users list

Given I am logged in as Superadmin (superadmin@nextspark.dev)
When I visit /admin/users
Then the URL should include /admin/users
And I should see "User Management" heading
And the users container should be visible
```

```gherkin:es
Scenario: Superadmin puede acceder a la lista de todos los usuarios

Given estoy logueado como Superadmin (superadmin@nextspark.dev)
When visito /admin/users
Then la URL deberia incluir /admin/users
And deberia ver el heading "User Management"
And el contenedor de usuarios deberia estar visible
```

### Expected Results
- Users page loads correctly
- Header displays correct title

---

## @test ADMIN-USERS-002: Users List Display

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** sector7, users, list
- **Grep:** `@smoke`

```gherkin:en
Scenario: Users are displayed in a list or table

Given I am logged in as Superadmin
When I visit /admin/users
Then the users container should contain a list or table
And each user should be represented as a row
```

```gherkin:es
Scenario: Usuarios se muestran en una lista o tabla

Given estoy logueado como Superadmin
When visito /admin/users
Then el contenedor de usuarios deberia contener una lista o tabla
And cada usuario deberia estar representado como una fila
```

### Expected Results
- Users displayed in organized format
- All users visible

---

## @test ADMIN-USERS-003: View User Details

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** sector7, users, details

```gherkin:en
Scenario: View individual user details

Given I am logged in as Superadmin
And I am on /admin/users
When I click on a user row
Then I should navigate to user details page
And the user details should be visible
```

```gherkin:es
Scenario: Ver detalles de un usuario individual

Given estoy logueado como Superadmin
And estoy en /admin/users
When hago click en una fila de usuario
Then deberia navegar a la pagina de detalles del usuario
And los detalles del usuario deberian estar visibles
```

### Expected Results
- Click navigates to details
- Details page shows user info

---

## @test ADMIN-USERS-004: User Search

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** sector7, users, search

```gherkin:en
Scenario: Filter users by search query

Given I am logged in as Superadmin
And I am on /admin/users
When I type "carlos" in the search field
Then the users list should be filtered
And only matching users should be displayed
```

```gherkin:es
Scenario: Filtrar usuarios por busqueda

Given estoy logueado como Superadmin
And estoy en /admin/users
When escribo "carlos" en el campo de busqueda
Then la lista de usuarios deberia ser filtrada
And solo los usuarios que coinciden deberian mostrarse
```

### Expected Results
- Search filters list
- Real-time filtering

---

## @test ADMIN-USERS-005: User Email Display

### Metadata
- **Priority:** Normal
- **Type:** Regression
- **Tags:** sector7, users, email

```gherkin:en
Scenario: Display email for each user

Given I am logged in as Superadmin
When I visit /admin/users
Then each user row should display user email
And email should contain @ symbol
```

```gherkin:es
Scenario: Mostrar email de cada usuario

Given estoy logueado como Superadmin
When visito /admin/users
Then cada fila de usuario deberia mostrar el email
And el email deberia contener el simbolo @
```

### Expected Results
- Email visible for each user
- Email format is valid

---

## @test ADMIN-USERS-006: User App Role Display

### Metadata
- **Priority:** Normal
- **Type:** Regression
- **Tags:** sector7, users, roles

```gherkin:en
Scenario: Display app role for users with global roles

Given I am logged in as Superadmin
When I visit /admin/users
Then users with app roles (superadmin, developer) should show role indicator
```

```gherkin:es
Scenario: Mostrar app role de usuarios con roles globales

Given estoy logueado como Superadmin
When visito /admin/users
Then los usuarios con app roles (superadmin, developer) deberian mostrar indicador de rol
```

### Expected Results
- App role visible when applicable
- Role indicator distinguishes role types

---

## @test ADMIN-USERS-007: User Verified Status

### Metadata
- **Priority:** Normal
- **Type:** Regression
- **Tags:** sector7, users, verification

```gherkin:en
Scenario: Display email verification status

Given I am logged in as Superadmin
When I visit /admin/users
Then each user should show verification status (verified/unverified)
```

```gherkin:es
Scenario: Mostrar estado de verificacion de email

Given estoy logueado como Superadmin
When visito /admin/users
Then cada usuario deberia mostrar estado de verificacion (verificado/no verificado)
```

### Expected Results
- Verification status visible
- Clear distinction between verified/unverified

---

## @test ADMIN-USERS-008: Navigate Back to Dashboard

### Metadata
- **Priority:** Normal
- **Type:** Regression
- **Tags:** sector7, navigation

```gherkin:en
Scenario: Navigate back to Admin Panel dashboard

Given I am logged in as Superadmin
And I am on /admin/users
When I click on the dashboard nav item
Then I should be on /admin
And the dashboard container should be visible
```

```gherkin:es
Scenario: Navegar de vuelta al dashboard de Admin Panel

Given estoy logueado como Superadmin
And estoy en /admin/users
When hago click en el nav item de dashboard
Then deberia estar en /admin
And el contenedor del dashboard deberia estar visible
```

### Expected Results
- Navigation works
- Dashboard loads

---

## @test ADMIN-USERS-009: User Team Memberships

### Metadata
- **Priority:** Normal
- **Type:** Regression
- **Tags:** sector7, users, teams

```gherkin:en
Scenario: Display team memberships for users

Given I am logged in as Superadmin
When I visit /admin/users
Then each user should show their team membership count or list
```

```gherkin:es
Scenario: Mostrar membresias de teams de usuarios

Given estoy logueado como Superadmin
When visito /admin/users
Then cada usuario deberia mostrar su conteo o lista de membresias de teams
```

### Expected Results
- Team count visible
- Reflects actual memberships

---

## @test ADMIN-USERS-010: User Metadata Box

### Metadata
- **Priority:** Normal
- **Type:** Regression
- **Tags:** admin, users, metadata, detail

```gherkin:en
Scenario: Display user metadata card in user detail view

Given I am logged in as Superadmin
And I am on /admin/users
When I click on a user row to view details
Then the User Metadata card should be visible
And the card title should contain "User Metadata"
```

```gherkin:es
Scenario: Mostrar card de metadata de usuario en vista de detalle

Given estoy logueado como Superadmin
And estoy en /admin/users
When hago click en una fila de usuario para ver detalles
Then el card de User Metadata deberia estar visible
And el titulo del card deberia contener "User Metadata"
```

### Expected Results
- User Metadata card visible in detail view
- Card displays metadata count in title

---

## @test ADMIN-USERS-010b: User Metadata Table or Empty State

### Metadata
- **Priority:** Normal
- **Type:** Regression
- **Tags:** admin, users, metadata, detail

```gherkin:en
Scenario: Display metadata table or empty state

Given I am logged in as Superadmin
And I am viewing a user's detail page
When the User Metadata card loads
Then I should see either a metadata table or an empty state
And if table exists, it should have columns: Key, Value, Type, Public, Searchable
And if empty state exists, it should show "No metadata" message
```

```gherkin:es
Scenario: Mostrar tabla de metadata o estado vacio

Given estoy logueado como Superadmin
And estoy viendo la pagina de detalle de un usuario
When el card de User Metadata carga
Then deberia ver una tabla de metadata o un estado vacio
And si existe la tabla, deberia tener columnas: Key, Value, Type, Public, Searchable
And si existe estado vacio, deberia mostrar mensaje "No metadata"
```

### Expected Results
- Either table or empty state is shown
- Table has correct column headers
- Empty state has appropriate message

---

## UI Elements

| Element | Selector | Description |
|---------|----------|-------------|
| Container | `[data-cy="admin-users-container"]` | Users page container |
| Users List | `[data-cy="admin-users-table"]` | List/table of users |
| User Row | `[data-cy="admin-user-row-{id}"]` | Individual user row |
| User Details | `[data-cy="admin-user-detail"]` | User details view |
| Search | `[data-cy="admin-users-search"]` | Search input |
| User Email | `[data-cy="admin-user-email"]` | User email display |
| App Role | `[data-cy="user-app-role-{roleName}"]` | App role indicator |
| Verified Status | `[data-cy="user-verified-status"]` | Verification status |
| Teams Count | `[data-cy="user-teams-count"]` | Team memberships count |
| Nav Dashboard | `[data-cy="admin-nav-dashboard"]` | Dashboard nav item |
| User Metas Card | `[data-cy="admin-user-metas"]` | User metadata card container |
| User Metas Title | `[data-cy="admin-user-metas-title"]` | User metadata card title |
| User Metas Table | `[data-cy="admin-user-metas-table"]` | User metadata table |
| User Metas Empty | `[data-cy="admin-user-metas-empty"]` | User metadata empty state |
| Meta Row | `[data-cy="admin-user-meta-row-{key}"]` | Individual metadata row |
| Meta Key | `[data-cy="admin-user-meta-key-{key}"]` | Metadata key cell |
| Meta Value | `[data-cy="admin-user-meta-value-{key}"]` | Metadata value cell |
| Meta Type | `[data-cy="admin-user-meta-type-{key}"]` | Metadata type badge |
| Meta Public | `[data-cy="admin-user-meta-public-{key}"]` | Metadata public badge |
| Meta Searchable | `[data-cy="admin-user-meta-searchable-{key}"]` | Metadata searchable badge |

---

## Summary

| Test ID | Block | Description | Tags |
|---------|-------|-------------|------|
| ADMIN-USERS-001 | Access | Users list access | `@smoke` |
| ADMIN-USERS-002 | Display | Users list format | `@smoke` |
| ADMIN-USERS-003 | Details | View user details | |
| ADMIN-USERS-004 | Search | Filter by search | |
| ADMIN-USERS-005 | Display | Email display | |
| ADMIN-USERS-006 | Display | App role display | |
| ADMIN-USERS-007 | Display | Verification status | |
| ADMIN-USERS-008 | Navigation | Back to dashboard | |
| ADMIN-USERS-009 | Display | Team memberships | |
| ADMIN-USERS-010 | Metadata | User metadata card | |
| ADMIN-USERS-010b | Metadata | Metadata table/empty state | |
