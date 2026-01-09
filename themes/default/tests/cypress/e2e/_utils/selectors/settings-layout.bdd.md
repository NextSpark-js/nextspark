---
feature: Settings Layout UI Selectors Validation
priority: high
tags: [selectors, settings, layout, ui-validation]
grepTags: [ui-selectors, settings, SEL_LAY_001, SEL_LAY_002]
coverage: 2
---

# Settings Layout UI Selectors Validation

> Validates that settings layout selectors exist in the DOM. This is a lightweight test that ONLY checks selector presence, not functionality. Runs as Phase 12 sub-gate before functional tests.

## @test SEL_LAY_001: Layout Selectors

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** settings, layout, container
- **Grep:** `@ui-selectors` `@SEL_LAY_001`
- **Status:** Active (7 passing, 0 skipped)

```gherkin:en
Scenario: Settings layout has required selectors

Given I am logged in as developer
And I navigate to the settings page
Then I should find the settings layout main container
And I should find the settings header
And I should find the settings content area
And I should find the settings sidebar
And I should find the settings sidebar container
And I should find the settings mobile menu trigger
And I should find the settings mobile sheet
```

```gherkin:es
Scenario: El layout de settings tiene los selectores requeridos

Given estoy logueado como developer
And navego a la pagina de settings
Then deberia encontrar el contenedor principal del layout de settings
And deberia encontrar el header de settings
And deberia encontrar el area de contenido de settings
And deberia encontrar el sidebar de settings
And deberia encontrar el contenedor del sidebar de settings
And deberia encontrar el trigger del menu movil de settings
And deberia encontrar el sheet movil de settings
```

### Expected Results
- `settings.layout.main` selector exists (settings-layout-main)
- `settings.layout.header` selector exists (settings-layout-header)
- `settings.layout.content` selector exists (settings-layout-content)
- `settings.layout.sidebar` selector exists (settings-layout-sidebar)
- `settings.layout.sidebarContainer` selector exists (settings-sidebar-container)
- `settings.layout.mobileMenuTrigger` selector exists (settings-mobile-menu-trigger)
- `settings.layout.mobileSheet` selector exists (settings-mobile-sheet)

---

## @test SEL_LAY_002: Sidebar Selectors

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** settings, sidebar, navigation
- **Grep:** `@ui-selectors` `@SEL_LAY_002`
- **Status:** Active (11 passing, 0 skipped)

```gherkin:en
Scenario: Settings sidebar has all navigation links

Given I am logged in as developer
And I navigate to the settings page
Then I should find the profile nav link
And I should find the password nav link
And I should find the teams nav link
And I should find the API keys nav link
And I should find the appearance nav link
And I should find the notifications nav link
And I should find the billing nav link
And I should find the members nav link
And I should find the invite nav link
And I should find the roles nav link
And I should find the danger zone nav link
And I should find the back to dashboard link
```

```gherkin:es
Scenario: El sidebar de settings tiene todos los links de navegacion

Given estoy logueado como developer
And navego a la pagina de settings
Then deberia encontrar el link de navegacion a perfil
And deberia encontrar el link de navegacion a password
And deberia encontrar el link de navegacion a equipos
And deberia encontrar el link de navegacion a API keys
And deberia encontrar el link de navegacion a apariencia
And deberia encontrar el link de navegacion a notificaciones
And deberia encontrar el link de navegacion a facturacion
And deberia encontrar el link de navegacion a miembros
And deberia encontrar el link de navegacion a invitar
And deberia encontrar el link de navegacion a roles
And deberia encontrar el link de navegacion a zona de peligro
And deberia encontrar el link de volver al dashboard
```

### Expected Results
- `settings.sidebar.profile` selector exists (settings-sidebar-profile)
- `settings.sidebar.password` selector exists (settings-sidebar-password)
- `settings.sidebar.teams` selector exists (settings-sidebar-teams)
- `settings.sidebar.apiKeys` selector exists (settings-sidebar-api-keys)
- `settings.sidebar.appearance` selector exists (settings-sidebar-appearance)
- `settings.sidebar.notifications` selector exists (settings-sidebar-notifications)
- `settings.sidebar.billing` selector exists (settings-sidebar-billing)
- `settings.sidebar.members` selector exists (settings-sidebar-members)
- `settings.sidebar.invite` selector exists (settings-sidebar-invite)
- `settings.sidebar.roles` selector exists (settings-sidebar-roles)
- `settings.sidebar.dangerZone` selector exists (settings-sidebar-danger-zone)
- `settings.sidebar.backToDashboard` selector exists (settings-sidebar-back-to-dashboard)

### Notes
Some sidebar items may not be visible depending on user permissions. The test validates selectors that are accessible to the developer role.

---

## Related Components

| Component | File | Selectors |
|-----------|------|-----------|
| SettingsLayout | `packages/core/src/components/settings/SettingsLayout.tsx` | settings-layout-main, settings-layout-header, settings-layout-content |
| SettingsSidebar | `packages/core/src/components/settings/SettingsSidebar.tsx` | settings-sidebar-*, settings-layout-sidebar |

## Related POMs

| POM | File | Usage |
|-----|------|-------|
| SettingsPOM | `themes/default/tests/cypress/src/features/SettingsPOM.ts` | Settings layout and sidebar selectors |
