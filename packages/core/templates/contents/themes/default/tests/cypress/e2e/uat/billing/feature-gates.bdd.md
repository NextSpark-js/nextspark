---
feature: Feature Gates UAT
priority: high
tags: [billing, uat, feature-gates, fake-door]
grepTags: [uat, billing, feature-gates]
coverage: 12
---

# Feature Gates - UAT Tests

> Browser-based tests that validate feature access control based on subscription plans (Free, Pro, Enterprise). These "fake door" feature pages test plan-based gating.

## Features Under Test

| Feature | Feature Slug | Free | Pro | Enterprise |
|---------|--------------|------|-----|------------|
| Advanced Analytics | `advanced_analytics` | ❌ | ✅ | ✅ |
| Webhooks | `webhooks` | ❌ | ✅ | ✅ |
| Task Automation | `task_automation` | ❌ | ✅ | ✅ |

---

## @test FEAT-UAT-001: Free plan user sees placeholder for Advanced Analytics

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** free-plan, feature-gate, analytics
- **Grep:** `@smoke`

```gherkin:en
Scenario: Free plan user cannot access Advanced Analytics

Given I am logged in as Carlos (Free plan team)
When I visit /dashboard/features/analytics
Then I should see the feature placeholder
And I should see the upgrade button
And I should NOT see the analytics content
```

```gherkin:es
Scenario: Usuario Free no puede acceder a Analytics Avanzados

Given estoy logueado como Carlos (team con plan Free)
When visito /dashboard/features/analytics
Then deberia ver el placeholder de la funcion
And deberia ver el boton de upgrade
And NO deberia ver el contenido de analytics
```

### Expected Results
- Feature placeholder is visible with `[data-cy="feature-placeholder-advanced_analytics"]`
- Upgrade button is visible with `[data-cy="placeholder-upgrade-btn"]`
- Analytics content NOT visible

---

## @test FEAT-UAT-002: Free plan user sees placeholder for Webhooks

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** free-plan, feature-gate, webhooks
- **Grep:** `@smoke`

```gherkin:en
Scenario: Free plan user cannot access Webhooks

Given I am logged in as Carlos (Free plan team)
When I visit /dashboard/features/webhooks
Then I should see the feature placeholder
And I should see the upgrade button
And I should NOT see the webhooks content
```

```gherkin:es
Scenario: Usuario Free no puede acceder a Webhooks

Given estoy logueado como Carlos (team con plan Free)
When visito /dashboard/features/webhooks
Then deberia ver el placeholder de la funcion
And deberia ver el boton de upgrade
And NO deberia ver el contenido de webhooks
```

### Expected Results
- Feature placeholder is visible with `[data-cy="feature-placeholder-webhooks"]`
- Upgrade button visible
- Webhooks content NOT visible

---

## @test FEAT-UAT-003: Free plan user sees placeholder for Task Automation

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** free-plan, feature-gate, automation
- **Grep:** `@smoke`

```gherkin:en
Scenario: Free plan user cannot access Task Automation

Given I am logged in as Carlos (Free plan team)
When I visit /dashboard/features/automation
Then I should see the feature placeholder
And I should see the upgrade button
And I should NOT see the automation content
```

```gherkin:es
Scenario: Usuario Free no puede acceder a Automatizacion de Tareas

Given estoy logueado como Carlos (team con plan Free)
When visito /dashboard/features/automation
Then deberia ver el placeholder de la funcion
And deberia ver el boton de upgrade
And NO deberia ver el contenido de automatizacion
```

### Expected Results
- Feature placeholder is visible with `[data-cy="feature-placeholder-task_automation"]`
- Upgrade button visible
- Automation content NOT visible

---

## @test FEAT-UAT-010: Pro plan user can access Advanced Analytics

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** pro-plan, feature-gate, analytics
- **Grep:** `@smoke`

```gherkin:en
Scenario: Pro plan user can access Advanced Analytics

Given I am logged in as Carlos (Pro plan team - Everpoint)
When I visit /dashboard/features/analytics
Then I should see the analytics content
And I should NOT see the feature placeholder
```

```gherkin:es
Scenario: Usuario Pro puede acceder a Analytics Avanzados

Given estoy logueado como Carlos (team Pro - Everpoint)
When visito /dashboard/features/analytics
Then deberia ver el contenido de analytics
And NO deberia ver el placeholder de la funcion
```

### Expected Results
- Analytics content visible with `[data-cy="analytics-content"]`
- Feature placeholder NOT visible

---

## @test FEAT-UAT-011: Pro plan user can access Webhooks

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** pro-plan, feature-gate, webhooks
- **Grep:** `@smoke`

```gherkin:en
Scenario: Pro plan user can access Webhooks

Given I am logged in as Carlos (Pro plan team - Everpoint)
When I visit /dashboard/features/webhooks
Then I should see the webhooks content
And I should NOT see the feature placeholder
```

```gherkin:es
Scenario: Usuario Pro puede acceder a Webhooks

Given estoy logueado como Carlos (team Pro - Everpoint)
When visito /dashboard/features/webhooks
Then deberia ver el contenido de webhooks
And NO deberia ver el placeholder de la funcion
```

### Expected Results
- Webhooks content visible with `[data-cy="webhooks-content"]`
- Feature placeholder NOT visible

---

## @test FEAT-UAT-012: Pro plan user can access Task Automation

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** pro-plan, feature-gate, automation
- **Grep:** `@smoke`

```gherkin:en
Scenario: Pro plan user can access Task Automation

Given I am logged in as Carlos (Pro plan team - Everpoint)
When I visit /dashboard/features/automation
Then I should see the automation content
And I should NOT see the feature placeholder
```

```gherkin:es
Scenario: Usuario Pro puede acceder a Automatizacion de Tareas

Given estoy logueado como Carlos (team Pro - Everpoint)
When visito /dashboard/features/automation
Then deberia ver el contenido de automatizacion
And NO deberia ver el placeholder de la funcion
```

### Expected Results
- Automation content visible with `[data-cy="automation-content"]`
- Feature placeholder NOT visible

---

## @test FEAT-UAT-020: Enterprise plan user can access all features

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** enterprise-plan, feature-gate
- **Grep:** `@smoke`

```gherkin:en
Scenario: Enterprise plan user can access all features

Given I am logged in as Ana (Enterprise plan team - Ironvale)
When I visit each feature page
Then I should see the feature content for all features
And I should NOT see any feature placeholders
```

```gherkin:es
Scenario: Usuario Enterprise puede acceder a todas las funciones

Given estoy logueado como Ana (team Enterprise - Ironvale)
When visito cada pagina de funcion
Then deberia ver el contenido de todas las funciones
And NO deberia ver ningun placeholder
```

### Expected Results
- All feature pages show content, not placeholders

---

## @test FEAT-UAT-030: Placeholder upgrade button navigates to pricing

### Metadata
- **Priority:** Normal
- **Type:** Regression
- **Tags:** navigation, upgrade, placeholder
- **Grep:** `@regression`

```gherkin:en
Scenario: Placeholder upgrade button works

Given I am logged in as Carlos (Free plan team)
And I am on a blocked feature page
When I click the upgrade button in the placeholder
Then I should be redirected to the pricing page
```

```gherkin:es
Scenario: Boton de upgrade en placeholder funciona

Given estoy logueado como Carlos (team con plan Free)
And estoy en una pagina de funcion bloqueada
When hago clic en el boton de upgrade del placeholder
Then deberia ser redirigido a la pagina de pricing
```

### Expected Results
- URL changes to include `/pricing` or `/settings/pricing`
- Pricing page loads

---

## @test FEAT-UAT-031: Feature page shows benefits list

### Metadata
- **Priority:** Normal
- **Type:** Regression
- **Tags:** placeholder, benefits
- **Grep:** `@regression`

```gherkin:en
Scenario: Placeholder shows feature benefits

Given I am logged in as Carlos (Free plan team)
When I visit a blocked feature page
Then I should see the benefits list for that feature
```

```gherkin:es
Scenario: Placeholder muestra beneficios de la funcion

Given estoy logueado como Carlos (team con plan Free)
When visito una pagina de funcion bloqueada
Then deberia ver la lista de beneficios de esa funcion
```

### Expected Results
- Benefits container is visible with `[data-cy="placeholder-benefits"]`
- List items are displayed

---

## @test FEAT-UAT-032: Feature page shows placeholder title

### Metadata
- **Priority:** Normal
- **Type:** Regression
- **Tags:** placeholder, title
- **Grep:** `@regression`

```gherkin:en
Scenario: Placeholder shows feature title

Given I am logged in as Carlos (Free plan team)
When I visit a blocked feature page
Then I should see the feature title in the placeholder
```

```gherkin:es
Scenario: Placeholder muestra titulo de la funcion

Given estoy logueado como Carlos (team con plan Free)
When visito una pagina de funcion bloqueada
Then deberia ver el titulo de la funcion en el placeholder
```

### Expected Results
- Title is visible with `[data-cy="placeholder-title"]`

---

## @test FEAT-UAT-033: Feature page shows placeholder description

### Metadata
- **Priority:** Normal
- **Type:** Regression
- **Tags:** placeholder, description
- **Grep:** `@regression`

```gherkin:en
Scenario: Placeholder shows feature description

Given I am logged in as Carlos (Free plan team)
When I visit a blocked feature page
Then I should see the feature description in the placeholder
```

```gherkin:es
Scenario: Placeholder muestra descripcion de la funcion

Given estoy logueado como Carlos (team con plan Free)
When visito una pagina de funcion bloqueada
Then deberia ver la descripcion de la funcion en el placeholder
```

### Expected Results
- Description is visible with `[data-cy="placeholder-description"]`

---

## UI Elements

| Element | Selector | Description |
|---------|----------|-------------|
| Analytics Page | `[data-cy="feature-analytics-page"]` | Analytics feature page container |
| Webhooks Page | `[data-cy="feature-webhooks-page"]` | Webhooks feature page container |
| Automation Page | `[data-cy="feature-automation-page"]` | Automation feature page container |
| Analytics Placeholder | `[data-cy="feature-placeholder-advanced_analytics"]` | Analytics placeholder |
| Webhooks Placeholder | `[data-cy="feature-placeholder-webhooks"]` | Webhooks placeholder |
| Automation Placeholder | `[data-cy="feature-placeholder-task_automation"]` | Automation placeholder |
| Analytics Content | `[data-cy="analytics-content"]` | Analytics feature content |
| Webhooks Content | `[data-cy="webhooks-content"]` | Webhooks feature content |
| Automation Content | `[data-cy="automation-content"]` | Automation feature content |
| Placeholder Title | `[data-cy="placeholder-title"]` | Feature title in placeholder |
| Placeholder Description | `[data-cy="placeholder-description"]` | Feature description |
| Placeholder Benefits | `[data-cy="placeholder-benefits"]` | Benefits list container |
| Upgrade Button | `[data-cy="placeholder-upgrade-btn"]` | Upgrade CTA button |

## Summary

| Test ID | Plan | Feature | Type | Tags |
|---------|------|---------|------|------|
| FEAT-UAT-001 | Free | Analytics | Blocked | `@smoke` |
| FEAT-UAT-002 | Free | Webhooks | Blocked | `@smoke` |
| FEAT-UAT-003 | Free | Automation | Blocked | `@smoke` |
| FEAT-UAT-010 | Pro | Analytics | Accessible | `@smoke` |
| FEAT-UAT-011 | Pro | Webhooks | Accessible | `@smoke` |
| FEAT-UAT-012 | Pro | Automation | Accessible | `@smoke` |
| FEAT-UAT-020 | Enterprise | All | Accessible | `@smoke` |
| FEAT-UAT-030 | Free | Navigation | Upgrade CTA | `@regression` |
| FEAT-UAT-031 | Free | UI | Benefits | `@regression` |
| FEAT-UAT-032 | Free | UI | Title | `@regression` |
| FEAT-UAT-033 | Free | UI | Description | `@regression` |
