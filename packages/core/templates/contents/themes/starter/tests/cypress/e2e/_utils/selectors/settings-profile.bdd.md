---
feature: Settings Profile UI Selectors Validation
priority: high
tags: [selectors, settings, profile, ui-validation]
grepTags: [ui-selectors, settings, SEL_PROF_001]
coverage: 1
---

# Settings Profile UI Selectors Validation

> Validates that settings profile selectors exist in the DOM. This is a lightweight test that ONLY checks selector presence, not functionality. Runs as Phase 12 sub-gate before functional tests.

## @test SEL_PROF_001: Profile Page Selectors

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** settings, profile, form
- **Grep:** `@ui-selectors` `@SEL_PROF_001`
- **Status:** Active (6 passing, 3 skipped)

```gherkin:en
Scenario: Profile page has required selectors

Given I am logged in as developer
And I navigate to the profile settings page
Then I should find the profile container
And I should find the profile form
And I should find the first name input
And I should find the last name input
And I should find the email input
And I should find the profile submit button
```

```gherkin:es
Scenario: La pagina de perfil tiene los selectores requeridos

Given estoy logueado como developer
And navego a la pagina de settings de perfil
Then deberia encontrar el contenedor de perfil
And deberia encontrar el formulario de perfil
And deberia encontrar el input de nombre
And deberia encontrar el input de apellido
And deberia encontrar el input de email
And deberia encontrar el boton de enviar perfil
```

### Expected Results
- `settings.profile.container` selector exists (settings-profile) ✅
- `settings.profile.form` selector exists (profile-form) ✅
- `settings.profile.firstName` selector exists (profile-first-name) ✅
- `settings.profile.lastName` selector exists (profile-last-name) ✅
- `settings.profile.email` selector exists (profile-email) ✅
- `settings.profile.submit` selector exists (profile-submit) ✅
- `settings.profile.avatar` selector - **SKIPPED: Feature not implemented**
- `settings.profile.avatarUpload` selector - **SKIPPED: Feature not implemented**
- `settings.profile.successMessage` selector - **SKIPPED: Requires form submission (functional test)**

### Notes
**Skipped Tests (3):**
1. `profile-avatar` - Avatar feature not implemented in ProfilePage component
2. `profile-avatar-upload` - Avatar upload feature not implemented
3. `profile-success` - Success message only appears after form submission (functional test, not selector validation)

---

## Related Components

| Component | File | Selectors |
|-----------|------|-----------|
| ProfilePage | `apps/dev/app/dashboard/settings/profile/page.tsx` | settings-profile, profile-form, profile-first-name, profile-last-name, profile-email, profile-submit, profile-success |

## Related POMs

| POM | File | Usage |
|-----|------|-------|
| SettingsPOM | `themes/default/tests/cypress/src/features/SettingsPOM.ts` | Profile page selectors |
