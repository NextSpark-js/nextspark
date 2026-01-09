---
feature: Settings Billing UI Selectors Validation
priority: medium
tags: [selectors, settings, billing, ui-validation]
grepTags: [ui-selectors, settings, SEL_BILL_001]
coverage: 1
---

# Settings Billing UI Selectors Validation

> Validates that settings billing selectors exist in the DOM. This is a lightweight test that ONLY checks selector presence, not functionality. Runs as Phase 12 sub-gate before functional tests.

## @test SEL_BILL_001: Billing Page Selectors

### Metadata
- **Priority:** Medium
- **Type:** Selector Validation
- **Tags:** settings, billing, subscription
- **Grep:** `@ui-selectors` `@SEL_BILL_001`
- **Status:** Active (1 passing, 13 skipped)

```gherkin:en
Scenario: Billing page has required selectors

Given I am logged in as admin with billing permission
And I navigate to the billing settings page
Then I should find the billing main container
And I should find the manage subscription button
And I should find the current plan card
And I should find the plan name display
And I should find the plan status display
```

```gherkin:es
Scenario: La pagina de billing tiene los selectores requeridos

Given estoy logueado como admin con permiso de billing
And navego a la pagina de settings de billing
Then deberia encontrar el contenedor principal de billing
And deberia encontrar el boton de administrar suscripcion
And deberia encontrar la tarjeta del plan actual
And deberia encontrar el nombre del plan
And deberia encontrar el estado del plan
```

### Expected Results
- `settings.billing.main` selector exists (settings-billing-main) - **SKIPPED: Requires admin**
- `settings.billing.manageSubscription` selector exists (settings-billing-manage-subscription) - **SKIPPED: Requires admin**
- `settings.billing.currentPlan` selector exists (settings-billing-current-plan) - **SKIPPED: Requires admin**
- `settings.billing.planName` selector exists (settings-billing-plan-name) - **SKIPPED: Requires admin**
- `settings.billing.planStatus` selector exists (settings-billing-plan-status) - **SKIPPED: Requires admin**

### Notes
**All tests are skipped because:**
- The billing page requires `settings.billing` permission
- The default developer user in devKeyring does not have this permission
- To test billing selectors:
  1. Configure a user with admin role that includes billing permissions
  2. Use `loginAsUser('admin')` instead of `loginAsDefaultDeveloper()`
  3. Enable tests by removing `.skip`

**Future Enhancement:**
Consider adding a billing admin user to devKeyring specifically for testing billing functionality.

---

## Related Components

| Component | File | Selectors |
|-----------|------|-----------|
| BillingSettings | `packages/core/src/components/settings/BillingSettings.tsx` | settings-billing-* |
| PlanCard | `packages/core/src/components/billing/PlanCard.tsx` | settings-billing-current-plan, settings-billing-plan-name, settings-billing-plan-status |

## Related POMs

| POM | File | Usage |
|-----|------|-------|
| SettingsPOM | `themes/default/tests/cypress/src/features/SettingsPOM.ts` | Billing page selectors |
