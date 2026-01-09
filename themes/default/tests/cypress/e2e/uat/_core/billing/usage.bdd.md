---
feature: Billing Usage Limits
priority: high
tags: [billing, usage, limits, resources, plans]
grepTags: [uat, billing, usage]
coverage: 7
status: pending-permission-fix
---

# Billing Page - Usage Limits

> Tests for usage limits display including Free plan limits, Pro plan higher limits, Enterprise unlimited display, usage percentage, and progress indicators. **Note:** Currently skipped due to permission check issues.

## Background

```gherkin:en
Given I am logged in as a team owner
And I have navigated to the Billing settings page
And usage information is available for my team
```

```gherkin:es
Given estoy logueado como owner del team
And he navegado a la pagina de configuracion de Billing
And la informacion de uso esta disponible para mi team
```

---

## @test BILL-UAT-080: Free plan shows usage with limits

### Metadata
- **Priority:** Critical
- **Type:** Regression
- **Tags:** free, usage, limits
- **Status:** SKIPPED (permission issue)

```gherkin:en
Scenario: Free plan displays usage against limits

Given I am on a Free plan team
When I visit the billing page
Then I should see usage displayed (X / Y format)
```

```gherkin:es
Scenario: Plan Free muestra uso contra limites

Given estoy en un team con plan Free
When visito la pagina de billing
Then deberia ver el uso mostrado (formato X / Y)
```

### Expected Results
- Usage section is visible
- Usage shows current/limit format
- Free plan limits are displayed

---

## @test BILL-UAT-081: Usage shows current count

### Metadata
- **Priority:** Normal
- **Type:** Regression
- **Tags:** usage, count, display
- **Status:** SKIPPED (permission issue)

```gherkin:en
Scenario: Usage shows current resource count

Given I am on the billing page
Then I should see my current usage numbers
```

```gherkin:es
Scenario: Uso muestra conteo actual de recursos

Given estoy en la pagina de billing
Then deberia ver mis numeros de uso actuales
```

### Expected Results
- Usage numbers are displayed
- Format matches X / Y pattern
- Numbers reflect actual resource count

---

## @test BILL-UAT-082: Pro plan shows higher limits

### Metadata
- **Priority:** Normal
- **Type:** Regression
- **Tags:** pro, usage, limits
- **Status:** SKIPPED (permission issue)

```gherkin:en
Scenario: Pro plan has higher limits than Free

Given I am on a Pro plan team
When I visit the billing page
Then I should see higher usage limits
```

```gherkin:es
Scenario: Plan Pro tiene limites mas altos que Free

Given estoy en un team con plan Pro
When visito la pagina de billing
Then deberia ver limites de uso mas altos
```

### Expected Results
- Pro plan limits are displayed
- Limits are higher than Free tier
- Usage section is visible

---

## @test BILL-UAT-083: Enterprise plan shows Unlimited where applicable

### Metadata
- **Priority:** Normal
- **Type:** Regression
- **Tags:** enterprise, unlimited, limits
- **Status:** SKIPPED (permission issue)

```gherkin:en
Scenario: Enterprise plan shows unlimited resources

Given I am on an Enterprise plan team
When I visit the billing page
Then I should see "Unlimited" or very high limits
```

```gherkin:es
Scenario: Plan Enterprise muestra recursos ilimitados

Given estoy en un team con plan Enterprise
When visito la pagina de billing
Then deberia ver "Ilimitado" o limites muy altos
```

### Expected Results
- Enterprise plan is displayed
- Some resources show as unlimited
- Billing page is visible

---

## @test BILL-UAT-084: Usage display is visible on billing page

### Metadata
- **Priority:** Normal
- **Type:** Regression
- **Tags:** usage, section, visibility
- **Status:** SKIPPED (permission issue)

```gherkin:en
Scenario: Usage section exists on billing page

Given I am on the billing page
Then I should see a usage section
```

```gherkin:es
Scenario: Seccion de uso existe en pagina de billing

Given estoy en la pagina de billing
Then deberia ver una seccion de uso
```

### Expected Results
- Billing main section is visible
- Usage section exists
- Usage information is displayed

---

## @test BILL-UAT-085: Usage reflects actual resource count

### Metadata
- **Priority:** Normal
- **Type:** Regression
- **Tags:** usage, validation, accuracy
- **Status:** SKIPPED (permission issue)

```gherkin:en
Scenario: Usage numbers are reasonable

Given I am on the billing page
Then the usage numbers should be non-negative integers
And current usage should not exceed the limit
```

```gherkin:es
Scenario: Numeros de uso son razonables

Given estoy en la pagina de billing
Then los numeros de uso deberian ser enteros no negativos
And el uso actual no deberia exceder el limite
```

### Expected Results
- Usage numbers are non-negative
- Limit numbers are at least 1
- Current usage does not exceed limit

---

## Known Issues

**Permission Check Issue (2025-12-28):**
- Billing page redirects to /dashboard/settings for all users
- `usePermission('settings.billing')` hook may not resolve correctly
- TeamContext may not be properly hydrated during Cypress session restore
- Investigation needed in: usePermission, TeamContext, permissionRegistry
