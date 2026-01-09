---
feature: Superadmin UI Selectors Validation
priority: high
tags: [selectors, superadmin, ui-validation, admin-panel]
grepTags: [ui-selectors, superadmin, SEL_SADM_001, SEL_SADM_002, SEL_SADM_003, SEL_SADM_004, SEL_SADM_005, SEL_SADM_006]
coverage: 6
---

# Superadmin UI Selectors Validation

> Validates that superadmin area selectors exist in the DOM. This is a lightweight test that ONLY checks selector presence, not functionality. Runs as Phase 12 sub-gate before functional tests.

## @test SEL_SADM_001: Superadmin Dashboard Selectors

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** superadmin, dashboard, container
- **Grep:** `@ui-selectors` `@SEL_SADM_001`
- **Status:** Active

```gherkin:en
Scenario: Superadmin dashboard has required selectors

Given I am logged in as superadmin
And I navigate to the superadmin dashboard
Then I should find the superadmin container
And I should find the dashboard container
```

```gherkin:es
Scenario: El dashboard de superadmin tiene los selectores requeridos

Given estoy logueado como superadmin
And navego al dashboard de superadmin
Then deberia encontrar el contenedor de superadmin
And deberia encontrar el contenedor del dashboard
```

### Expected Results
- `superadmin.container` selector exists (superadmin-container)
- `superadmin.dashboard.container` selector exists (superadmin-dashboard)

---

## @test SEL_SADM_002: Superadmin Navigation Selectors

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** superadmin, navigation, sidebar
- **Grep:** `@ui-selectors` `@SEL_SADM_002`
- **Status:** Active

```gherkin:en
Scenario: Superadmin navigation has all required links

Given I am logged in as superadmin
And I navigate to the superadmin area
Then I should find the dashboard nav link
And I should find the users nav link
And I should find the teams nav link
And I should find the team-roles nav link
And I should find the subscriptions nav link
And I should find the exit to dashboard link
```

```gherkin:es
Scenario: La navegacion de superadmin tiene todos los links requeridos

Given estoy logueado como superadmin
And navego al area de superadmin
Then deberia encontrar el link de navegacion a dashboard
And deberia encontrar el link de navegacion a users
And deberia encontrar el link de navegacion a teams
And deberia encontrar el link de navegacion a team-roles
And deberia encontrar el link de navegacion a subscriptions
And deberia encontrar el link de salir al dashboard
```

### Expected Results
- `superadmin.navigation.dashboard` selector exists (superadmin-nav-dashboard)
- `superadmin.navigation.users` selector exists (superadmin-nav-users)
- `superadmin.navigation.teams` selector exists (superadmin-nav-teams)
- `superadmin.navigation.teamRoles` selector exists (superadmin-nav-team-roles)
- `superadmin.navigation.subscriptions` selector exists (superadmin-nav-subscriptions)
- `superadmin.navigation.exitToDashboard` selector exists (superadmin-sidebar-exit-to-dashboard)

---

## @test SEL_SADM_003: Superadmin Users Page Selectors

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** superadmin, users, management
- **Grep:** `@ui-selectors` `@SEL_SADM_003`
- **Status:** Active

```gherkin:en
Scenario: Superadmin users page has required selectors

Given I am logged in as superadmin
And I navigate to the superadmin users page
Then I should find the users container
And I should find the users table
And I should find the users search input
```

```gherkin:es
Scenario: La pagina de usuarios de superadmin tiene los selectores requeridos

Given estoy logueado como superadmin
And navego a la pagina de usuarios de superadmin
Then deberia encontrar el contenedor de usuarios
And deberia encontrar la tabla de usuarios
And deberia encontrar el input de busqueda de usuarios
```

### Expected Results
- `superadmin.users.container` selector exists (superadmin-users-container)
- `superadmin.users.table` selector exists (superadmin-users-table)
- `superadmin.users.search` selector exists (superadmin-users-search)

---

## @test SEL_SADM_004: Superadmin Teams Page Selectors

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** superadmin, teams, management
- **Grep:** `@ui-selectors` `@SEL_SADM_004`
- **Status:** Active

```gherkin:en
Scenario: Superadmin teams page has required selectors

Given I am logged in as superadmin
And I navigate to the superadmin teams page
Then I should find the teams container
And I should find the teams table
And I should find the teams search input
```

```gherkin:es
Scenario: La pagina de equipos de superadmin tiene los selectores requeridos

Given estoy logueado como superadmin
And navego a la pagina de equipos de superadmin
Then deberia encontrar el contenedor de equipos
And deberia encontrar la tabla de equipos
And deberia encontrar el input de busqueda de equipos
```

### Expected Results
- `superadmin.teams.container` selector exists (superadmin-teams-container)
- `superadmin.teams.table` selector exists (superadmin-teams-table)
- `superadmin.teams.search` selector exists (superadmin-teams-search)

---

## @test SEL_SADM_005: Superadmin Subscriptions Page Selectors

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** superadmin, subscriptions, billing
- **Grep:** `@ui-selectors` `@SEL_SADM_005`
- **Status:** Active

```gherkin:en
Scenario: Superadmin subscriptions page has required selectors

Given I am logged in as superadmin
And I navigate to the superadmin subscriptions page
Then I should find the subscriptions container
And I should find the MRR stat card
And I should find the plan distribution section
And I should find the active count stat card
```

```gherkin:es
Scenario: La pagina de suscripciones de superadmin tiene los selectores requeridos

Given estoy logueado como superadmin
And navego a la pagina de suscripciones de superadmin
Then deberia encontrar el contenedor de suscripciones
And deberia encontrar la tarjeta de estadisticas MRR
And deberia encontrar la seccion de distribucion de planes
And deberia encontrar la tarjeta de conteo activo
```

### Expected Results
- `superadmin.subscriptions.container` selector exists (superadmin-subscriptions-container)
- `superadmin.subscriptions.mrr` selector exists (superadmin-subscriptions-mrr)
- `superadmin.subscriptions.planDistribution` selector exists (superadmin-subscriptions-plan-distribution)
- `superadmin.subscriptions.activeCount` selector exists (superadmin-subscriptions-active-count)

---

## @test SEL_SADM_006: Dynamic Selectors (Pattern Validation)

### Metadata
- **Priority:** Medium
- **Type:** Selector Validation
- **Tags:** superadmin, dynamic, patterns
- **Grep:** `@ui-selectors` `@SEL_SADM_006`
- **Status:** Active

```gherkin:en
Scenario: Dynamic selectors return valid patterns

Given I am logged in as superadmin
And I navigate to the superadmin users page
Then the userRow selector should return a valid pattern
And the userView selector should return a valid pattern
And the teamRow selector should return a valid pattern
And the subscriptionsPlanCount selector should return a valid pattern
```

```gherkin:es
Scenario: Los selectores dinamicos retornan patrones validos

Given estoy logueado como superadmin
And navego a la pagina de usuarios de superadmin
Then el selector userRow deberia retornar un patron valido
And el selector userView deberia retornar un patron valido
And el selector teamRow deberia retornar un patron valido
And el selector subscriptionsPlanCount deberia retornar un patron valido
```

### Expected Results
- `superadmin.users.row` pattern includes 'superadmin-user-row'
- `superadmin.users.viewButton` pattern includes 'superadmin-user-view'
- `superadmin.teams.row` pattern includes 'superadmin-team-row'
- `superadmin.subscriptions.planCount` pattern includes 'superadmin-subscriptions-plan-count'

### Notes
These tests validate that dynamic selector functions (those that accept parameters like `id` or `plan`) return correctly formatted selector strings. They do not test actual DOM elements.

---

## Related Components

| Component | File | Selectors |
|-----------|------|-----------|
| SuperadminLayout | `packages/core/templates/app/superadmin/layout.tsx` | superadmin-container |
| SuperadminSidebar | `packages/core/src/components/superadmin/layouts/SuperadminSidebar.tsx` | superadmin-nav-* |
| SuperadminDashboard | `packages/core/templates/app/superadmin/page.tsx` | superadmin-dashboard |
| UsersPage | `packages/core/templates/app/superadmin/users/page.tsx` | superadmin-users-* |
| TeamsPage | `packages/core/templates/app/superadmin/teams/page.tsx` | superadmin-teams-* |
| SubscriptionsPage | `packages/core/templates/app/superadmin/subscriptions/page.tsx` | superadmin-subscriptions-* |
| UsersTable | `packages/core/src/components/users/tables/UsersTable.tsx` | superadmin-users-table, superadmin-user-row-{id} |
| TeamsTable | `packages/core/src/components/superadmin/tables/TeamsTable.tsx` | superadmin-teams-table, superadmin-team-row-{id} |

## Related POMs

| POM | File | Usage |
|-----|------|-------|
| SuperadminPOM | `themes/default/tests/cypress/src/features/SuperadminPOM.ts` | Superadmin area interactions and selectors |
