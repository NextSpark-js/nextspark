---
feature: Settings Password UI Selectors Validation
priority: high
tags: [selectors, settings, password, ui-validation]
grepTags: [ui-selectors, settings, SEL_PASS_001]
coverage: 1
---

# Settings Password UI Selectors Validation

> Validates that settings password selectors exist in the DOM. This is a lightweight test that ONLY checks selector presence, not functionality. Runs as Phase 12 sub-gate before functional tests.

## @test SEL_PASS_001: Password Page Selectors

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** settings, password, form
- **Grep:** `@ui-selectors` `@SEL_PASS_001`
- **Status:** Active (2 passing, 5 skipped)

```gherkin:en
Scenario: Password page has required selectors

Given I am logged in as developer
And I navigate to the password settings page
Then I should find the password container
And I should find the password form
And I should find the current password input
And I should find the new password input
And I should find the confirm password input
And I should find the password submit button
```

```gherkin:es
Scenario: La pagina de password tiene los selectores requeridos

Given estoy logueado como developer
And navego a la pagina de settings de password
Then deberia encontrar el contenedor de password
And deberia encontrar el formulario de password
And deberia encontrar el input de password actual
And deberia encontrar el input de nuevo password
And deberia encontrar el input de confirmar password
And deberia encontrar el boton de enviar password
```

### Expected Results
- `settings.password.container` selector exists (settings-password) - **SKIPPED: Mismatch**
- `settings.password.form` selector exists (password-form)
- `settings.password.current` selector exists (password-current) - **SKIPPED: Mismatch**
- `settings.password.new` selector exists (password-new) - **SKIPPED: Mismatch**
- `settings.password.confirm` selector exists (password-confirm) - **SKIPPED: Mismatch**
- `settings.password.submit` selector exists (password-submit)

### Notes
**Selector Mismatches Documented:**

| Expected (CORE_SELECTORS) | Actual (Component) | Issue |
|---------------------------|-------------------|-------|
| `settings-password` | `password-main` | Container uses different naming |
| `password-current` | `password-current-input` | Extra `-input` suffix |
| `password-new` | `password-new-input` | Extra `-input` suffix |
| `password-confirm` | `password-confirm-input` | Extra `-input` suffix |

Resolution options:
1. Update CORE_SELECTORS to match component naming
2. Update PasswordForm component to match CORE_SELECTORS

---

## Related Components

| Component | File | Selectors |
|-----------|------|-----------|
| PasswordForm | `packages/core/src/components/settings/PasswordForm.tsx` | password-main, password-form, password-current-input, password-new-input, password-confirm-input, password-submit |

## Related POMs

| POM | File | Usage |
|-----|------|-------|
| SettingsPOM | `themes/default/tests/cypress/src/features/SettingsPOM.ts` | Password page selectors |
