---
feature: Billing UI Selectors Validation
priority: high
tags: [selectors, billing, ui-validation]
grepTags: [ui-selectors, billing, SEL_BILL_001, SEL_BILL_002, SEL_BILL_003, SEL_BILL_004, SEL_BILL_005, SEL_BILL_006, SEL_BILL_DOC]
coverage: 7
---

# Billing UI Selectors Validation

> Validates that billing component selectors exist in the DOM. This is a lightweight test that ONLY checks selector presence, not functionality. Most tests are skipped due to permission requirements (OWNER role only) or specific state requirements (paid subscription, downgrade flow).

**IMPORTANT:** Billing page requires `settings.billing` permission which only OWNER role has. See also: `settings-billing.cy.ts` for additional billing page selectors.

## @test SEL_BILL_001: Billing Page Structure

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** billing, page, structure
- **Grep:** `@ui-selectors` `@SEL_BILL_001`
- **Status:** Skipped - requires OWNER permission

```gherkin:en
Scenario: Billing page has complete structure

Given I am logged in as OWNER
And I navigate to the billing settings page
Then I should find the billing main container
And I should find the billing header
And I should find the upgrade plan button
And I should find the add payment button
```

```gherkin:es
Scenario: Pagina de billing tiene estructura completa

Given estoy logueado como OWNER
And navego a la pagina de configuracion de billing
Then deberia encontrar el contenedor principal de billing
And deberia encontrar el header de billing
And deberia encontrar el boton de upgrade plan
And deberia encontrar el boton de agregar pago
```

### Expected Results
- `billing-main` selector exists
- `billing-header` selector exists
- `billing-upgrade-plan` selector exists
- `billing-add-payment` selector exists

### Notes
All tests skipped because billing page requires `settings.billing` permission which only OWNER role has.

---

## @test SEL_BILL_002: Invoices Section

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** billing, invoices, table
- **Grep:** `@ui-selectors` `@SEL_BILL_002`
- **Status:** Skipped - requires OWNER permission

```gherkin:en
Scenario: Billing page has invoices section

Given I am logged in as OWNER
And I navigate to the billing settings page
Then I should find the invoices table
And I should find invoice rows (when invoices exist)
And I should find load more button (when many invoices)
And I should find invoice status badges
```

```gherkin:es
Scenario: Pagina de billing tiene seccion de facturas

Given estoy logueado como OWNER
And navego a la pagina de configuracion de billing
Then deberia encontrar la tabla de facturas
And deberia encontrar filas de facturas (cuando existen)
And deberia encontrar boton cargar mas (cuando hay muchas)
And deberia encontrar badges de estado de factura
```

### Expected Results
- `invoices-table` selector exists
- `invoices-row` selector exists (when invoices present)
- `invoices-load-more` selector exists (when more invoices available)
- `invoice-status-badge` selector exists (when invoices present)

---

## @test SEL_BILL_003: Usage Display

### Metadata
- **Priority:** Medium
- **Type:** Selector Validation
- **Tags:** billing, usage, limits
- **Grep:** `@ui-selectors` `@SEL_BILL_003`
- **Status:** Skipped - requires OWNER permission

```gherkin:en
Scenario: Billing page displays usage information

Given I am logged in as OWNER
And I navigate to the billing settings page
Then I should see usage numbers in format "X / Y"
And I should find the usage dashboard component
```

```gherkin:es
Scenario: Pagina de billing muestra informacion de uso

Given estoy logueado como OWNER
And navego a la pagina de configuracion de billing
Then deberia ver numeros de uso en formato "X / Y"
And deberia encontrar el componente usage dashboard
```

### Expected Results
- Usage numbers displayed in format `N / M`
- `usage-dashboard` selector exists

---

## @test SEL_BILL_004: ManageBillingButton

### Metadata
- **Priority:** Low
- **Type:** Selector Validation
- **Tags:** billing, manage, stripe
- **Grep:** `@ui-selectors` `@SEL_BILL_004`
- **Status:** Skipped - requires paid Stripe subscription

```gherkin:en
Scenario: Billing page has manage billing button for paid users

Given I am logged in as a user with paid subscription
And the subscription has an external Stripe customer ID
And I navigate to the billing settings page
Then I should find the manage billing button
```

```gherkin:es
Scenario: Pagina de billing tiene boton de gestionar billing para usuarios de pago

Given estoy logueado como usuario con suscripcion de pago
And la suscripcion tiene un ID de cliente externo de Stripe
And navego a la pagina de configuracion de billing
Then deberia encontrar el boton de gestionar billing
```

### Expected Results
- `manage-billing-button` selector exists

### Notes
ManageBillingButton only renders when `subscription.externalCustomerId` exists (Stripe customer).

---

## @test SEL_BILL_005: SubscriptionStatus

### Metadata
- **Priority:** Low
- **Type:** Selector Validation
- **Tags:** billing, subscription, status
- **Grep:** `@ui-selectors` `@SEL_BILL_005`
- **Status:** Skipped - requires active subscription

```gherkin:en
Scenario: Billing page shows subscription status for subscribers

Given I am logged in as a user with active subscription
And I navigate to the billing settings page
Then I should find the subscription status container
And I should find the subscription plan name
And I should find the subscription status badge
```

```gherkin:es
Scenario: Pagina de billing muestra estado de suscripcion para suscriptores

Given estoy logueado como usuario con suscripcion activa
And navego a la pagina de configuracion de billing
Then deberia encontrar el contenedor de estado de suscripcion
And deberia encontrar el nombre del plan de suscripcion
And deberia encontrar el badge de estado de suscripcion
```

### Expected Results
- `subscription-status` selector exists
- `subscription-status-plan` selector exists
- `subscription-status-badge` selector exists

---

## @test SEL_BILL_006: DowngradeWarning

### Metadata
- **Priority:** Low
- **Type:** Selector Validation
- **Tags:** billing, downgrade, warning
- **Grep:** `@ui-selectors` `@SEL_BILL_006`
- **Status:** Skipped - requires downgrade flow with over-limit resources

```gherkin:en
Scenario: Downgrade warning appears when user has over-limit resources

Given I am attempting to downgrade my subscription
And I have resources that exceed the new plan limits
Then I should see the downgrade warning alert
And I should see the warning title
And I should see the warning description
And I should see the list of over-limit resources
And I should see the confirm downgrade button
And I should see the cancel button
```

```gherkin:es
Scenario: Advertencia de downgrade aparece cuando usuario tiene recursos sobre el limite

Given estoy intentando bajar mi suscripcion
And tengo recursos que exceden los limites del nuevo plan
Then deberia ver la alerta de advertencia de downgrade
And deberia ver el titulo de advertencia
And deberia ver la descripcion de advertencia
And deberia ver la lista de recursos sobre el limite
And deberia ver el boton de confirmar downgrade
And deberia ver el boton de cancelar
```

### Expected Results
- `downgrade-warning` selector exists
- `downgrade-warning-title` selector exists
- `downgrade-warning-description` selector exists
- `downgrade-warning-list` selector exists
- `downgrade-limit-{slug}` selectors exist
- `downgrade-warning-confirm` selector exists
- `downgrade-warning-cancel` selector exists

### Notes
DowngradeWarning only renders when `overLimitResources.length > 0`.

---

## @test SEL_BILL_DOC: Selector Documentation

### Metadata
- **Priority:** Low
- **Type:** Documentation
- **Tags:** billing, documentation
- **Grep:** `@ui-selectors` `@SEL_BILL_DOC`
- **Status:** Active

```gherkin:en
Scenario: Document all billing component selectors

Given the billing selector tests are running
Then the test should log all available billing selectors
And document which permissions/states are required for each
```

```gherkin:es
Scenario: Documentar todos los selectores de componentes de billing

Given los tests de selectores de billing estan corriendo
Then el test deberia loguear todos los selectores de billing disponibles
And documentar que permisos/estados se requieren para cada uno
```

### Expected Results
- Test logs all billing selectors for reference
- Documents permission and state requirements
