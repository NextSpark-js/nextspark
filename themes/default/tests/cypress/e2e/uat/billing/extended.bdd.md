---
feature: Billing Extended Features
priority: medium
tags: [billing, payment, features, invoices, navigation]
grepTags: [uat, billing, extended]
coverage: 8
status: pending-permission-fix
---

# Billing Page - Extended Tests

> Extended coverage tests for the billing settings page including payment method section, plan features list, view pricing navigation, and invoice details. **Note:** Currently skipped due to permission check issues - billing page redirects to /dashboard/settings.

## Background

```gherkin:en
Given I am logged in as Owner (owner@nextspark.dev)
And I have navigated to the Billing settings page
And the billing page has loaded successfully
```

```gherkin:es
Given estoy logueado como Owner (owner@nextspark.dev)
And he navegado a la pagina de configuracion de Billing
And la pagina de billing ha cargado exitosamente
```

---

## @test BILL-UAT-040: Owner sees payment method section

### Metadata
- **Priority:** Normal
- **Type:** Regression
- **Tags:** payment, section, owner
- **Status:** SKIPPED (permission issue)

```gherkin:en
Scenario: Owner sees payment method section

Given I am logged in as an owner
When I visit the billing page
Then I should see payment method section
```

```gherkin:es
Scenario: Owner ve la seccion de metodo de pago

Given estoy logueado como owner
When visito la pagina de billing
Then deberia ver la seccion de metodo de pago
```

### Expected Results
- Billing page is accessible to owner
- Payment method section is visible
- Section displays current payment info or add option

---

## @test BILL-UAT-041: Add payment button is visible

### Metadata
- **Priority:** Normal
- **Type:** Regression
- **Tags:** payment, button, add
- **Status:** SKIPPED (permission issue)

```gherkin:en
Scenario: User can see add payment button

Given I am on the billing page
Then I should see the add payment button
```

```gherkin:es
Scenario: Usuario puede ver boton agregar pago

Given estoy en la pagina de billing
Then deberia ver el boton de agregar pago
```

### Expected Results
- Add payment button exists
- Button is visible and clickable
- Button leads to payment method addition flow

---

## @test BILL-UAT-042: Plan features list is visible

### Metadata
- **Priority:** Normal
- **Type:** Regression
- **Tags:** plan, features, list

- **Status:** SKIPPED (permission issue)

```gherkin:en
Scenario: User can see plan features

Given I am on the billing page
Then I should see the features included in my plan
```

```gherkin:es
Scenario: Usuario puede ver caracteristicas del plan

Given estoy en la pagina de billing
Then deberia ver las caracteristicas incluidas en mi plan
```

### Expected Results
- Plan features section is visible
- Features list displays current plan inclusions
- Features match the subscribed plan tier

---

## @test BILL-UAT-043: View pricing button is visible

### Metadata
- **Priority:** Normal
- **Type:** Regression
- **Tags:** navigation, pricing, upgrade
- **Status:** SKIPPED (permission issue)

```gherkin:en
Scenario: User can see view pricing option

Given I am on the billing page
Then I should see a way to view pricing
```

```gherkin:es
Scenario: Usuario puede ver opcion de ver precios

Given estoy en la pagina de billing
Then deberia ver una forma de ver precios
```

### Expected Results
- Upgrade/pricing button exists
- Button is visible
- Navigation to pricing is available

---

## @test BILL-UAT-044: Contact sales option available

### Metadata
- **Priority:** Low
- **Type:** Regression
- **Tags:** enterprise, sales, contact
- **Status:** SKIPPED (permission issue)

```gherkin:en
Scenario: Enterprise contact option exists

Given I am on the billing page
Then I should see a way to contact sales (or upgrade to Enterprise)
```

```gherkin:es
Scenario: Opcion de contacto Enterprise existe

Given estoy en la pagina de billing
Then deberia ver una forma de contactar ventas (o actualizar a Enterprise)
```

### Expected Results
- Enterprise/sales contact option exists
- Main billing section is visible
- Path to enterprise upgrade is available

---

## @test BILL-UAT-045: Owner billing section visible

### Metadata
- **Priority:** Normal
- **Type:** Regression
- **Tags:** owner, section, visibility
- **Status:** SKIPPED (permission issue)

```gherkin:en
Scenario: Owner can see billing section

Given I am logged in as an owner
When I visit the billing page
Then I should see the billing section
```

```gherkin:es
Scenario: Owner puede ver seccion de billing

Given estoy logueado como owner
When visito la pagina de billing
Then deberia ver la seccion de billing
```

### Expected Results
- Billing page loads for owner role
- Billing section is visible
- All billing components render

---

## @test BILL-UAT-046: Invoices section accessible

### Metadata
- **Priority:** Low
- **Type:** Regression
- **Tags:** invoices, section, table
- **Status:** SKIPPED (permission issue)

```gherkin:en
Scenario: User can see invoices section

Given I am on the billing page
Then I should see the invoices section
```

```gherkin:es
Scenario: Usuario puede ver seccion de facturas

Given estoy en la pagina de billing
Then deberia ver la seccion de facturas
```

### Expected Results
- Invoices table exists
- Section is accessible
- Invoice history is displayed

---

## @test BILL-UAT-047: Invoice status badge is visible

### Metadata
- **Priority:** Normal
- **Type:** Regression
- **Tags:** invoices, status, badge
- **Status:** SKIPPED (permission issue)

```gherkin:en
Scenario: Invoice shows status badge

Given I am on the billing page with invoices
Then each invoice should have a status badge
```

```gherkin:es
Scenario: Factura muestra badge de estado

Given estoy en la pagina de billing con facturas
Then cada factura deberia tener un badge de estado
```

### Expected Results
- Invoices table exists
- Each invoice row has status indicator
- Status badges are visible (paid, pending, etc.)

---

## Known Issues

**Permission Check Issue (2025-12-28):**
- Billing page redirects to /dashboard/settings for all users
- `usePermission('settings.billing')` hook may not resolve correctly
- TeamContext may not be properly hydrated during Cypress session restore
- Investigation needed in: usePermission, TeamContext, permissionRegistry
