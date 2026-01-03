---
feature: Billing Page UAT
priority: high
tags: [billing, uat, settings]
grepTags: [uat, billing, regression]
coverage: 10
---

# Billing Page - UAT Tests

> Browser-based tests that validate the billing settings page from the user's perspective, testing with different subscription plans (Free, Pro, Enterprise).

## @test BILL-UAT-001: Free plan user can view billing page

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** free-plan, billing-page
- **Grep:** `@smoke`

```gherkin:en
Scenario: Free plan user views billing page

Given I am logged in as Carlos (Free plan team)
When I visit /dashboard/settings/billing
Then I should see the billing page
And I should see my current plan is Free
```

```gherkin:es
Scenario: Usuario con plan Free visualiza pagina de billing

Given estoy logueado como Carlos (team con plan Free)
When visito /dashboard/settings/billing
Then deberia ver la pagina de billing
And deberia ver que mi plan actual es Free
```

### Expected Results
- Billing page loads successfully
- Current plan shows "Free"
- Page header is visible

---

## @test BILL-UAT-002: Free plan user sees upgrade button

### Metadata
- **Priority:** Normal
- **Type:** Regression
- **Tags:** free-plan, upgrade
- **Grep:** `@regression`

```gherkin:en
Scenario: Free plan user sees upgrade option

Given I am on the billing page with Free plan
Then I should see the upgrade button
```

```gherkin:es
Scenario: Usuario Free ve opcion de upgrade

Given estoy en la pagina de billing con plan Free
Then deberia ver el boton de upgrade
```

### Expected Results
- Upgrade button is visible
- Button is clickable

---

## @test BILL-UAT-003: Free plan user sees usage limits

### Metadata
- **Priority:** Normal
- **Type:** Regression
- **Tags:** free-plan, usage
- **Grep:** `@regression`

```gherkin:en
Scenario: Free plan user can see their usage

Given I am on the billing page with Free plan
Then I should see my usage displayed
```

```gherkin:es
Scenario: Usuario Free puede ver su uso

Given estoy en la pagina de billing con plan Free
Then deberia ver mi uso mostrado
```

### Expected Results
- Usage numbers are visible (format: X / Y)

---

## @test BILL-UAT-004: Free plan user has no invoices

### Metadata
- **Priority:** Low
- **Type:** Regression
- **Tags:** free-plan, invoices
- **Grep:** `@regression`

```gherkin:en
Scenario: Free plan user has no billing history

Given I am on the billing page with Free plan
Then I should see no invoices (free plan)
```

```gherkin:es
Scenario: Usuario Free no tiene historial de facturacion

Given estoy en la pagina de billing con plan Free
Then no deberia ver facturas (plan gratuito)
```

### Expected Results
- No invoices displayed
- Empty state message shown

---

## @test BILL-UAT-010: Pro plan user can view billing page

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** pro-plan, billing-page
- **Grep:** `@smoke`

```gherkin:en
Scenario: Pro plan user views billing page

Given I am logged in as Carlos (Pro plan team - Everpoint)
When I visit /dashboard/settings/billing
Then I should see the billing page
And I should see my current plan is Pro
```

```gherkin:es
Scenario: Usuario Pro visualiza pagina de billing

Given estoy logueado como Carlos (team Pro - Everpoint)
When visito /dashboard/settings/billing
Then deberia ver la pagina de billing
And deberia ver que mi plan actual es Pro
```

### Expected Results
- Billing page loads successfully
- Current plan shows "Pro"

---

## @test BILL-UAT-011: Pro plan user sees invoices

### Metadata
- **Priority:** Normal
- **Type:** Regression
- **Tags:** pro-plan, invoices
- **Grep:** `@regression`

```gherkin:en
Scenario: Pro plan user can see billing history

Given I am on the billing page with Pro plan
Then I should see my invoices
```

```gherkin:es
Scenario: Usuario Pro puede ver historial de facturacion

Given estoy en la pagina de billing con plan Pro
Then deberia ver mis facturas
```

### Expected Results
- Invoices table is visible
- At least one invoice is shown

---

## @test BILL-UAT-012: Pro plan user sees usage limits

### Metadata
- **Priority:** Normal
- **Type:** Regression
- **Tags:** pro-plan, usage
- **Grep:** `@regression`

```gherkin:en
Scenario: Pro plan user can see their usage

Given I am on the billing page with Pro plan
Then I should see my usage displayed
```

```gherkin:es
Scenario: Usuario Pro puede ver su uso

Given estoy en la pagina de billing con plan Pro
Then deberia ver mi uso mostrado
```

### Expected Results
- Usage numbers are visible

---

## @test BILL-UAT-020: Enterprise plan user can view billing page

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** enterprise-plan, billing-page
- **Grep:** `@smoke`

```gherkin:en
Scenario: Enterprise plan user views billing page

Given I am logged in as Ana (Enterprise plan team - Ironvale)
When I visit /dashboard/settings/billing
Then I should see the billing page
And I should see my current plan is Enterprise
```

```gherkin:es
Scenario: Usuario Enterprise visualiza pagina de billing

Given estoy logueado como Ana (team Enterprise - Ironvale)
When visito /dashboard/settings/billing
Then deberia ver la pagina de billing
And deberia ver que mi plan actual es Enterprise
```

### Expected Results
- Billing page loads successfully
- Current plan shows "Enterprise"

---

## @test BILL-UAT-021: Enterprise plan user sees invoices

### Metadata
- **Priority:** Normal
- **Type:** Regression
- **Tags:** enterprise-plan, invoices
- **Grep:** `@regression`

```gherkin:en
Scenario: Enterprise plan user can see billing history

Given I am on the billing page with Enterprise plan
Then I should see my invoices
```

```gherkin:es
Scenario: Usuario Enterprise puede ver historial de facturacion

Given estoy en la pagina de billing con plan Enterprise
Then deberia ver mis facturas
```

### Expected Results
- Invoices table is visible
- At least one invoice is shown

---

## @test BILL-UAT-030: Upgrade button navigates to pricing page

### Metadata
- **Priority:** Normal
- **Type:** Regression
- **Tags:** navigation, upgrade
- **Grep:** `@regression`

```gherkin:en
Scenario: User can navigate to pricing from billing

Given I am on the billing page
When I click the upgrade button
Then I should be on the pricing page
```

```gherkin:es
Scenario: Usuario puede navegar a pricing desde billing

Given estoy en la pagina de billing
When hago clic en el boton de upgrade
Then deberia estar en la pagina de pricing
```

### Expected Results
- URL includes /pricing
- Pricing page is visible

---

## UI Elements

| Element | Selector | Description |
|---------|----------|-------------|
| Billing Container | `[data-cy="billing-main"]` | Main billing page container |
| Billing Header | `[data-cy="billing-header"]` | Billing page header |
| Upgrade Button | `[data-cy="billing-upgrade-plan"]` | Upgrade plan button |
| Add Payment | `[data-cy="billing-add-payment"]` | Add payment method button |
| Load More Invoices | `[data-cy="invoices-load-more"]` | Load more invoices button |

## Summary

| Test ID | Plan | Description | Tags |
|---------|------|-------------|------|
| BILL-UAT-001 | Free | View billing page | `@smoke` |
| BILL-UAT-002 | Free | See upgrade button | `@regression` |
| BILL-UAT-003 | Free | See usage limits | `@regression` |
| BILL-UAT-004 | Free | No invoices | `@regression` |
| BILL-UAT-010 | Pro | View billing page | `@smoke` |
| BILL-UAT-011 | Pro | See invoices | `@regression` |
| BILL-UAT-012 | Pro | See usage limits | `@regression` |
| BILL-UAT-020 | Enterprise | View billing page | `@smoke` |
| BILL-UAT-021 | Enterprise | See invoices | `@regression` |
| BILL-UAT-030 | All | Navigate to pricing | `@regression` |
