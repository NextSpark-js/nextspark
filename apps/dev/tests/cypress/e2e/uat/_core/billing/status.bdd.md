---
feature: Billing Subscription Status
priority: high
tags: [billing, subscription, status, plans, badges]
grepTags: [uat, billing, status]
coverage: 6
status: pending-permission-fix
---

# Billing Page - Subscription Status

> Tests for subscription status display including plan badges (Free, Pro, Enterprise), subscription status (Active, Trial), and billing period information. **Note:** Currently skipped due to permission check issues.

## Background

```gherkin:en
Given I am logged in as a team owner
And I have navigated to the Billing settings page
And the billing page has loaded successfully
```

```gherkin:es
Given estoy logueado como owner del team
And he navegado a la pagina de configuracion de Billing
And la pagina de billing ha cargado exitosamente
```

---

## @test BILL-UAT-070: Free plan shows correct badge

### Metadata
- **Priority:** Critical
- **Type:** Regression
- **Tags:** free, plan, badge
- **Status:** SKIPPED (permission issue)

```gherkin:en
Scenario: Free plan displays Free badge

Given I am on a Free plan team
When I visit the billing page
Then I should see "Free" plan indicator
```

```gherkin:es
Scenario: Plan Free muestra badge Free

Given estoy en un team con plan Free
When visito la pagina de billing
Then deberia ver el indicador de plan "Free"
```

### Expected Results
- Free plan badge is displayed
- Badge shows "Free" text
- Plan indicator is visible

---

## @test BILL-UAT-071: Pro plan shows Active badge

### Metadata
- **Priority:** Critical
- **Type:** Regression
- **Tags:** pro, plan, active, badge

- **Status:** SKIPPED (permission issue)

```gherkin:en
Scenario: Pro plan displays Active status

Given I am on a Pro plan team with active subscription
When I visit the billing page
Then I should see "Pro" plan with active status
```

```gherkin:es
Scenario: Plan Pro muestra estado Activo

Given estoy en un team con plan Pro y suscripcion activa
When visito la pagina de billing
Then deberia ver el plan "Pro" con estado activo
```

### Expected Results
- Pro plan badge is displayed
- Active status is shown
- Plan tier is correctly identified

---

## @test BILL-UAT-072: Enterprise plan shows correctly

### Metadata
- **Priority:** Critical
- **Type:** Regression
- **Tags:** enterprise, plan, badge
- **Status:** SKIPPED (permission issue)

```gherkin:en
Scenario: Enterprise plan displays Enterprise badge

Given I am on an Enterprise plan team
When I visit the billing page
Then I should see "Enterprise" plan indicator
```

```gherkin:es
Scenario: Plan Enterprise muestra badge Enterprise

Given estoy en un team con plan Enterprise
When visito la pagina de billing
Then deberia ver el indicador de plan "Enterprise"
```

### Expected Results
- Enterprise plan badge is displayed
- Badge shows "Enterprise" text
- Plan indicator is visible

---

## @test BILL-UAT-073: Billing period is displayed for paid plans

### Metadata
- **Priority:** Normal
- **Type:** Regression
- **Tags:** billing, period, paid
- **Status:** SKIPPED (permission issue)

```gherkin:en
Scenario: Paid plan shows billing period

Given I am on a paid plan team
When I visit the billing page
Then I should see billing period information
```

```gherkin:es
Scenario: Plan pago muestra periodo de facturacion

Given estoy en un team con plan pago
When visito la pagina de billing
Then deberia ver la informacion del periodo de facturacion
```

### Expected Results
- Billing main section is visible
- Billing period information is displayed
- Next billing date or cycle is shown

---

## @test BILL-UAT-074: Subscription status visible

### Metadata
- **Priority:** Normal
- **Type:** Regression
- **Tags:** subscription, status, display
- **Status:** SKIPPED (permission issue)

```gherkin:en
Scenario: Subscription status is shown

Given I am on the billing page
Then I should see subscription status (active, trial, etc.)
```

```gherkin:es
Scenario: Estado de suscripcion visible

Given estoy en la pagina de billing
Then deberia ver el estado de suscripcion (activo, trial, etc.)
```

### Expected Results
- Subscription status is visible
- Status reflects actual subscription state
- Status badge shows appropriate label

---

## Known Issues

**Permission Check Issue (2025-12-28):**
- Billing page redirects to /dashboard/settings for all users
- `usePermission('settings.billing')` hook may not resolve correctly
- TeamContext may not be properly hydrated during Cypress session restore
- Investigation needed in: usePermission, TeamContext, permissionRegistry
