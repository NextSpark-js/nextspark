---
feature: Billing Team Switching
priority: high
tags: [billing, teams, switch, plans, invoices]
grepTags: [uat, billing, team-switch]
coverage: 5
status: pending-permission-fix
---

# Billing Page - Team Switching

> Tests that billing information updates correctly when switching between teams. Covers plan changes, usage limits updates, and invoice history changes per team. **Note:** Currently skipped due to permission check issues.

## Background

```gherkin:en
Given I am logged in as a user with multiple teams
And I have access to teams with different billing plans
And the billing page is accessible
```

```gherkin:es
Given estoy logueado como usuario con multiples teams
And tengo acceso a teams con diferentes planes de facturacion
And la pagina de billing es accesible
```

---

## @test BILL-UAT-060: Free plan team shows Free billing

### Metadata
- **Priority:** Critical
- **Type:** Regression
- **Tags:** free, plan, team-switch
- **Status:** SKIPPED (permission issue)

```gherkin:en
Scenario: Free team shows Free plan billing

Given I switch to a Free plan team
When I visit the billing page
Then I should see Free plan details
```

```gherkin:es
Scenario: Team Free muestra billing Free

Given cambio a un team con plan Free
When visito la pagina de billing
Then deberia ver los detalles del plan Free
```

### Expected Results
- Free plan details are displayed
- Plan badge shows "Free"
- Billing reflects Free tier limitations

---

## @test BILL-UAT-061: Pro plan team shows Pro billing

### Metadata
- **Priority:** Critical
- **Type:** Regression
- **Tags:** pro, plan, team-switch
- **Status:** SKIPPED (permission issue)

```gherkin:en
Scenario: Pro team shows Pro plan billing

Given I switch to a Pro plan team
When I visit the billing page
Then I should see Pro plan details
```

```gherkin:es
Scenario: Team Pro muestra billing Pro

Given cambio a un team con plan Pro
When visito la pagina de billing
Then deberia ver los detalles del plan Pro
```

### Expected Results
- Pro plan details are displayed
- Plan badge shows "Pro"
- Billing reflects Pro tier features

---

## @test BILL-UAT-062: Different teams show different invoices

### Metadata
- **Priority:** Normal
- **Type:** Regression
- **Tags:** invoices, team-switch, history
- **Status:** SKIPPED (permission issue)

```gherkin:en
Scenario: Invoice history is team-specific

Given I switch between teams
Then I should see different invoice histories
```

```gherkin:es
Scenario: Historial de facturas es especifico del team

Given cambio entre teams
Then deberia ver diferentes historiales de facturas
```

### Expected Results
- Free team shows 0 invoices
- Pro team shows at least 1 invoice
- Invoice history is team-specific

---

## @test BILL-UAT-063: Active team shown in billing header

### Metadata
- **Priority:** Normal
- **Type:** Regression
- **Tags:** header, team-context, display
- **Status:** SKIPPED (permission issue)

```gherkin:en
Scenario: Billing page shows active team context

Given I am on the billing page
Then I should see which team I am viewing billing for
```

```gherkin:es
Scenario: Pagina de billing muestra contexto del team activo

Given estoy en la pagina de billing
Then deberia ver para que team estoy viendo el billing
```

### Expected Results
- Billing header is visible
- Team context is displayed
- Current plan is shown for active team

---

## Known Issues

**Permission Check Issue (2025-12-28):**
- Billing page redirects to /dashboard/settings for all users
- `usePermission('settings.billing')` hook may not resolve correctly
- TeamContext may not be properly hydrated during Cypress session restore
- Investigation needed in: usePermission, TeamContext, permissionRegistry
