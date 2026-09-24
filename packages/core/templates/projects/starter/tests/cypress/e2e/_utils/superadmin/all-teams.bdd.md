---
feature: Superadmin All Teams Management
priority: high
tags: [sector7, superadmin, teams, management]
grepTags: [uat, feat-sector7, superadmin, teams]
coverage: 7
---

# Superadmin All Teams Management

> Tests for the Admin Panel all teams management page. Superadmin can view all teams across the platform, see their details, member counts, and billing plans.

## @test ADMIN-TEAMS-001: Teams List Access

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** sector7, teams, access
- **Grep:** `@smoke`

```gherkin:en
Scenario: Superadmin can access all teams list

Given I am logged in as Superadmin (superadmin@nextspark.dev)
When I visit /admin/teams
Then the URL should include /admin/teams
And I should see "Team Management" heading
And the teams container should be visible
```

```gherkin:es
Scenario: Superadmin puede acceder a la lista de todos los teams

Given estoy logueado como Superadmin (superadmin@nextspark.dev)
When visito /admin/teams
Then la URL deberia incluir /admin/teams
And deberia ver el heading "Team Management"
And el contenedor de teams deberia estar visible
```

### Expected Results
- Teams page loads correctly
- Header displays correct title

---

## @test ADMIN-TEAMS-002: Teams List Display

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** sector7, teams, list
- **Grep:** `@smoke`

```gherkin:en
Scenario: Teams are displayed in a list or table

Given I am logged in as Superadmin
When I visit /admin/teams
Then the teams container should contain a list or table
And each team should be represented as a row
```

```gherkin:es
Scenario: Teams se muestran en una lista o tabla

Given estoy logueado como Superadmin
When visito /admin/teams
Then el contenedor de teams deberia contener una lista o tabla
And cada team deberia estar representado como una fila
```

### Expected Results
- Teams displayed in organized format
- All teams visible

---

## @test ADMIN-TEAMS-003: View Team Details

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** sector7, teams, details

```gherkin:en
Scenario: View individual team details

Given I am logged in as Superadmin
And I am on /admin/teams
When I click on a team row
Then I should navigate to team details page
And the team details should be visible
```

```gherkin:es
Scenario: Ver detalles de un team individual

Given estoy logueado como Superadmin
And estoy en /admin/teams
When hago click en una fila de team
Then deberia navegar a la pagina de detalles del team
And los detalles del team deberian estar visibles
```

### Expected Results
- Click navigates to details
- Details page shows team info

---

## @test ADMIN-TEAMS-004: Team Search

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** sector7, teams, search

```gherkin:en
Scenario: Filter teams by search query

Given I am logged in as Superadmin
And I am on /admin/teams
When I type "Test" in the search field
Then the teams list should be filtered
And only matching teams should be displayed
```

```gherkin:es
Scenario: Filtrar teams por busqueda

Given estoy logueado como Superadmin
And estoy en /admin/teams
When escribo "Test" en el campo de busqueda
Then la lista de teams deberia ser filtrada
And solo los teams que coinciden deberian mostrarse
```

### Expected Results
- Search filters list
- Real-time filtering

---

## @test ADMIN-TEAMS-005: Team Member Count

### Metadata
- **Priority:** Normal
- **Type:** Regression
- **Tags:** sector7, teams, members

```gherkin:en
Scenario: Display member count for each team

Given I am logged in as Superadmin
When I visit /admin/teams
Then each team row should display member count
```

```gherkin:es
Scenario: Mostrar conteo de miembros de cada team

Given estoy logueado como Superadmin
When visito /admin/teams
Then cada fila de team deberia mostrar el conteo de miembros
```

### Expected Results
- Member count visible
- Count reflects actual members

---

## @test ADMIN-TEAMS-006: Navigate Back to Dashboard

### Metadata
- **Priority:** Normal
- **Type:** Regression
- **Tags:** sector7, navigation

```gherkin:en
Scenario: Navigate back to Admin Panel dashboard

Given I am logged in as Superadmin
And I am on /admin/teams
When I click on the dashboard nav item
Then I should be on /admin
And the dashboard container should be visible
```

```gherkin:es
Scenario: Navegar de vuelta al dashboard de Admin Panel

Given estoy logueado como Superadmin
And estoy en /admin/teams
When hago click en el nav item de dashboard
Then deberia estar en /admin
And el contenedor del dashboard deberia estar visible
```

### Expected Results
- Navigation works
- Dashboard loads

---

## @test ADMIN-TEAMS-007: Team Plan Display

### Metadata
- **Priority:** Normal
- **Type:** Regression
- **Tags:** sector7, teams, billing

```gherkin:en
Scenario: Display billing plan for each team

Given I am logged in as Superadmin
When I visit /admin/teams
Then each team should display their billing plan (Free, Starter, Pro, Business)
```

```gherkin:es
Scenario: Mostrar plan de facturacion de cada team

Given estoy logueado como Superadmin
When visito /admin/teams
Then cada team deberia mostrar su plan de facturacion (Free, Starter, Pro, Business)
```

### Expected Results
- Plan visible for each team
- Plan reflects actual subscription

---

## UI Elements

| Element | Selector | Description |
|---------|----------|-------------|
| Container | `[data-cy="sector7-teams-container"]` | Teams page container |
| Teams List | `[data-cy="sector7-teams-list"]` | List/table of teams |
| Team Row | `[data-cy="sector7-team-row-{id}"]` | Individual team row |
| Team Details | `[data-cy="sector7-team-details"]` | Team details view |
| Search | `[data-cy="sector7-teams-search"]` | Search input |
| Member Count | `[data-cy="team-member-count"]` | Member count display |
| Team Plan | `[data-cy="team-plan-{planName}"]` | Plan indicator |
| Nav Dashboard | `[data-cy="sector7-nav-dashboard"]` | Dashboard nav item |

---

## Summary

| Test ID | Block | Description | Tags |
|---------|-------|-------------|------|
| ADMIN-TEAMS-001 | Access | Teams list access | `@smoke` |
| ADMIN-TEAMS-002 | Display | Teams list format | `@smoke` |
| ADMIN-TEAMS-003 | Details | View team details | |
| ADMIN-TEAMS-004 | Search | Filter by search | |
| ADMIN-TEAMS-005 | Display | Member count | |
| ADMIN-TEAMS-006 | Navigation | Back to dashboard | |
| ADMIN-TEAMS-007 | Display | Billing plan | |
