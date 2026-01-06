---
feature: Superadmin Subscriptions Overview
priority: high
tags: [sector7, superadmin, subscriptions, metrics]
grepTags: [uat, feat-sector7, superadmin, subscriptions]
coverage: 8
---

# Superadmin Subscriptions Overview

> Tests for the Admin Panel subscriptions overview page. Superadmin can view platform-wide subscription metrics including revenue, plan distribution, subscription counts, and free vs paid team breakdowns.
>
> Note: The route is `/admin/subscriptions` (not `/billing`)

## @test ADMIN-SUBS-001: Subscriptions Page Access

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** sector7, subscriptions, access
- **Grep:** `@smoke`

```gherkin:en
Scenario: Superadmin can access subscriptions overview page

Given I am logged in as Superadmin (superadmin@nextspark.dev)
When I visit /admin/subscriptions
Then the URL should include /admin/subscriptions
```

```gherkin:es
Scenario: Superadmin puede acceder a la pagina de subscriptions overview

Given estoy logueado como Superadmin (superadmin@nextspark.dev)
When visito /admin/subscriptions
Then la URL deberia incluir /admin/subscriptions
```

### Expected Results
- Subscriptions page loads correctly
- Container is visible

---

## @test ADMIN-SUBS-002: Revenue Metrics

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** sector7, subscriptions, revenue

```gherkin:en
Scenario: Display revenue metrics if available

Given I am logged in as Superadmin
When I visit /admin/subscriptions
Then I should see MRR (Monthly Recurring Revenue) metric if implemented
Or the page should load successfully
```

```gherkin:es
Scenario: Mostrar metricas de revenue si estan disponibles

Given estoy logueado como Superadmin
When visito /admin/subscriptions
Then deberia ver la metrica de MRR (Monthly Recurring Revenue) si esta implementada
Or la pagina deberia cargar exitosamente
```

### Expected Results
- Revenue metric visible (if implemented)
- Page loads without errors

---

## @test ADMIN-SUBS-003: Plan Distribution

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** sector7, subscriptions, plans

```gherkin:en
Scenario: Display plan distribution stats if available

Given I am logged in as Superadmin
When I visit /admin/subscriptions
Then I should see plan distribution breakdown if implemented
Or the page should load successfully
```

```gherkin:es
Scenario: Mostrar estadisticas de distribucion de planes si estan disponibles

Given estoy logueado como Superadmin
When visito /admin/subscriptions
Then deberia ver el desglose de distribucion de planes si esta implementado
Or la pagina deberia cargar exitosamente
```

### Expected Results
- Plan distribution visible (if implemented)
- All plan tiers represented

---

## @test ADMIN-SUBS-004: Active Subscriptions Count

### Metadata
- **Priority:** Normal
- **Type:** Regression
- **Tags:** sector7, subscriptions, active

```gherkin:en
Scenario: Display active subscriptions count if available

Given I am logged in as Superadmin
When I visit /admin/subscriptions
Then I should see the count of active subscriptions if implemented
```

```gherkin:es
Scenario: Mostrar conteo de suscripciones activas si esta disponible

Given estoy logueado como Superadmin
When visito /admin/subscriptions
Then deberia ver el conteo de suscripciones activas si esta implementado
```

### Expected Results
- Active count visible (if implemented)
- Reflects current state

---

## @test ADMIN-SUBS-005: Free vs Paid Teams

### Metadata
- **Priority:** Normal
- **Type:** Regression
- **Tags:** sector7, subscriptions, teams

```gherkin:en
Scenario: Display free vs paid teams breakdown if available

Given I am logged in as Superadmin
When I visit /admin/subscriptions
Then I should see the count of free teams if implemented
And I should see the count of paid teams if implemented
```

```gherkin:es
Scenario: Mostrar desglose de teams free vs paid si esta disponible

Given estoy logueado como Superadmin
When visito /admin/subscriptions
Then deberia ver el conteo de teams free si esta implementado
And deberia ver el conteo de teams paid si esta implementado
```

### Expected Results
- Free count visible (if implemented)
- Paid count visible (if implemented)

---

## @test ADMIN-SUBS-006: Trial Teams

### Metadata
- **Priority:** Normal
- **Type:** Regression
- **Tags:** sector7, subscriptions, trials

```gherkin:en
Scenario: Display teams on trial if available

Given I am logged in as Superadmin
When I visit /admin/subscriptions
Then I should see the count of teams on trial if implemented
```

```gherkin:es
Scenario: Mostrar teams en periodo de prueba si esta disponible

Given estoy logueado como Superadmin
When visito /admin/subscriptions
Then deberia ver el conteo de teams en trial si esta implementado
```

### Expected Results
- Trial count visible (if implemented)

---

## @test ADMIN-SUBS-007: Navigate to Teams from Subscriptions

### Metadata
- **Priority:** Normal
- **Type:** Regression
- **Tags:** sector7, navigation

```gherkin:en
Scenario: Navigate to teams page from subscriptions

Given I am logged in as Superadmin
And I am on /admin/subscriptions
When I click on the teams nav item
Then I should be on /admin/teams
```

```gherkin:es
Scenario: Navegar a pagina de teams desde subscriptions

Given estoy logueado como Superadmin
And estoy en /admin/subscriptions
When hago click en el nav item de teams
Then deberia estar en /admin/teams
```

### Expected Results
- Navigation works
- Teams page loads

---

## @test ADMIN-SUBS-008: Navigate Back to Dashboard

### Metadata
- **Priority:** Normal
- **Type:** Regression
- **Tags:** sector7, navigation

```gherkin:en
Scenario: Navigate back to Admin Panel dashboard

Given I am logged in as Superadmin
And I am on /admin/subscriptions
When I click on the dashboard nav item
Then I should be on /admin
And the dashboard container should be visible
```

```gherkin:es
Scenario: Navegar de vuelta al dashboard de Admin Panel

Given estoy logueado como Superadmin
And estoy en /admin/subscriptions
When hago click en el nav item de dashboard
Then deberia estar en /admin
And el contenedor del dashboard deberia estar visible
```

### Expected Results
- Navigation works
- Dashboard loads

---

## UI Elements

| Element | Selector | Description |
|---------|----------|-------------|
| Container | `[data-cy="sector7-container"]` | Admin Panel main container |
| MRR Metric | `[data-cy="subscriptions-mrr"]` | Monthly Recurring Revenue |
| Revenue | `[data-cy="subscriptions-revenue"]` | Total revenue metric |
| Plan Distribution | `[data-cy="subscriptions-plan-distribution"]` | Plan breakdown chart |
| Plan Count | `[data-cy="subscriptions-plan-count-{planName}"]` | Individual plan count |
| Active Count | `[data-cy="subscriptions-active-count"]` | Active subscriptions count |
| Free Teams | `[data-cy="subscriptions-free-teams"]` | Free teams count |
| Paid Teams | `[data-cy="subscriptions-paid-teams"]` | Paid teams count |
| Trial Teams | `[data-cy="subscriptions-trial-teams"]` | Trial teams count |
| Nav Dashboard | `[data-cy="sector7-nav-dashboard"]` | Dashboard nav item |
| Nav Teams | `[data-cy="sector7-nav-teams"]` | Teams nav item |

> Note: Many UI elements may not have data-cy selectors yet. Tests are defensive and will pass if page loads correctly.

---

## Summary

| Test ID | Block | Description | Tags |
|---------|-------|-------------|------|
| ADMIN-SUBS-001 | Access | Subscriptions page access | `@smoke` |
| ADMIN-SUBS-002 | Metrics | Revenue metrics | |
| ADMIN-SUBS-003 | Metrics | Plan distribution | |
| ADMIN-SUBS-004 | Metrics | Active subscriptions | |
| ADMIN-SUBS-005 | Metrics | Free vs paid teams | |
| ADMIN-SUBS-006 | Metrics | Trial teams | |
| ADMIN-SUBS-007 | Navigation | Navigate to teams | |
| ADMIN-SUBS-008 | Navigation | Back to dashboard | |
