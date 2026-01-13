---
feature: Settings Layout UI Selectors Validation
priority: high
tags: [selectors, settings, layout, sidebar, ui-validation]
grepTags: [ui-selectors, settings, SEL_LAY_001, SEL_LAY_002]
coverage: 2
---

# Settings Layout UI Selectors Validation

> Validates that settings layout and sidebar selectors exist in the DOM. This is a lightweight test that ONLY checks selector presence, not functionality. Runs as Phase 12 sub-gate before functional tests.

## @test SEL_LAY_001: Layout Selectors (sidebar.layout.*)

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** settings, layout, container
- **Grep:** `@ui-selectors` `@SEL_LAY_001`
- **Status:** Active (6 passing, 0 skipped)

```gherkin:en
Scenario: Settings layout has required selectors

Given I am logged in as developer
And I navigate to the settings page
Then I should find the layout main container
And I should find the back to dashboard link
And I should find the layout header
And I should find the layout content area
And I should find the sidebar container
And I should find the layout page content
```

```gherkin:es
Scenario: El layout de settings tiene los selectores requeridos

Given estoy logueado como developer
And navego a la pagina de settings
Then deberia encontrar el contenedor principal del layout
And deberia encontrar el link de volver al dashboard
And deberia encontrar el header del layout
And deberia encontrar el area de contenido del layout
And deberia encontrar el contenedor del sidebar
And deberia encontrar el contenido de la pagina del layout
```

### Expected Results
- `settings.sidebar.layout.main` selector exists (settings-layout-main)
- `settings.sidebar.backButton` selector exists (settings-back-to-dashboard)
- `settings.sidebar.layout.header` selector exists (settings-layout-header)
- `settings.sidebar.layout.contentArea` selector exists (settings-layout-content-area)
- `settings.sidebar.container` selector exists (settings-sidebar)
- `settings.sidebar.layout.pageContent` selector exists (settings-layout-page-content)

---

## @test SEL_LAY_002: Sidebar Selectors

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** settings, sidebar, navigation
- **Grep:** `@ui-selectors` `@SEL_LAY_002`
- **Status:** Active (10 passing, 0 skipped)

```gherkin:en
Scenario: Settings sidebar has all navigation links

Given I am logged in as developer
And I navigate to the settings page
Then I should find the sidebar container
And I should find the sidebar header
And I should find the sidebar nav items container
And I should find the profile nav link
And I should find the security nav link
And I should find the password nav link
And I should find the notifications nav link
And I should find the api-keys nav link
And I should find the billing nav link
And I should find the teams nav link
```

```gherkin:es
Scenario: El sidebar de settings tiene todos los links de navegacion

Given estoy logueado como developer
And navego a la pagina de settings
Then deberia encontrar el contenedor del sidebar
And deberia encontrar el header del sidebar
And deberia encontrar el contenedor de items de navegacion
And deberia encontrar el link de navegacion a perfil
And deberia encontrar el link de navegacion a seguridad
And deberia encontrar el link de navegacion a password
And deberia encontrar el link de navegacion a notificaciones
And deberia encontrar el link de navegacion a api-keys
And deberia encontrar el link de navegacion a facturacion
And deberia encontrar el link de navegacion a equipos
```

### Expected Results
- `settings.sidebar.container` selector exists (settings-sidebar)
- `settings.sidebar.header` selector exists (settings-sidebar-header)
- `settings.sidebar.nav.items` selector exists (settings-sidebar-nav-items)
- `settings.sidebar.nav.item` with section=profile exists (settings-sidebar-nav-profile)
- `settings.sidebar.nav.item` with section=security exists (settings-sidebar-nav-security)
- `settings.sidebar.nav.item` with section=password exists (settings-sidebar-nav-password)
- `settings.sidebar.nav.item` with section=notifications exists (settings-sidebar-nav-notifications)
- `settings.sidebar.nav.item` with section=api-keys exists (settings-sidebar-nav-api-keys)
- `settings.sidebar.nav.item` with section=billing exists (settings-sidebar-nav-billing)
- `settings.sidebar.nav.item` with section=teams exists (settings-sidebar-nav-teams)

### Notes
Some sidebar items may not be visible depending on user permissions and theme configuration. The test validates selectors that are accessible to the developer role.

---

## Related Components

| Component | File | Selectors |
|-----------|------|-----------|
| SettingsLayout | `packages/core/src/components/settings/layouts/SettingsLayout.tsx` | settings-layout-main, settings-layout-header, settings-layout-content-area |
| SettingsSidebar | `packages/core/src/components/settings/layouts/SettingsSidebar.tsx` | settings-sidebar, settings-sidebar-header, settings-sidebar-nav-* |

## Related POMs

| POM | File | Usage |
|-----|------|-------|
| SettingsPOM | `themes/starter/tests/cypress/src/features/SettingsPOM.ts` | Settings layout and sidebar selectors |
