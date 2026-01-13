---
feature: Dashboard Sidebar UI Selectors Validation
priority: medium
tags: [selectors, sidebar, dashboard, ui-validation]
grepTags: [ui-selectors, dashboard, sidebar, SEL_DBAR_001]
coverage: 1
---

# Dashboard Sidebar UI Selectors Validation

> Validates that dashboard sidebar component selectors exist in the DOM. This is a lightweight test that ONLY checks selector presence, not functionality. Runs as Phase 12 sub-gate before functional tests.

**IMPORTANT:** Sidebar is only visible on desktop viewports (>= 1024px) when authenticated.

**Login:** Uses Developer via `loginAsDefaultDeveloper()`.

## @test SEL_DBAR_001: Sidebar Structure

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** sidebar, structure, desktop
- **Grep:** `@ui-selectors` `@dashboard` `@sidebar` `@SEL_DBAR_001`
- **Status:** Active (4 passing, 1 skipped)

```gherkin:en
Scenario: Dashboard sidebar has required structure selectors

Given I am logged in as a developer user
And I am viewing the dashboard on desktop viewport
Then I should find the sidebar container
And I should find the sidebar header
And I should find the sidebar logo
And I should find the sidebar content
And I should find the sidebar footer (not implemented in component)
```

```gherkin:es
Scenario: Sidebar del dashboard tiene selectores de estructura requeridos

Given estoy logueado como usuario developer
And estoy viendo el dashboard en viewport desktop
Then deberia encontrar el contenedor del sidebar
And deberia encontrar el header del sidebar
And deberia encontrar el logo del sidebar
And deberia encontrar el contenido del sidebar
And deberia encontrar el footer del sidebar (no implementado en componente)
```

### Expected Results
| Selector Path | POM Accessor | data-cy Value | Status |
|---------------|--------------|---------------|--------|
| dashboard.sidebar.container | dashboard.selectors.sidebarContainer | sidebar-main | Implemented |
| dashboard.sidebar.header | dashboard.selectors.sidebarHeader | sidebar-header | Implemented |
| dashboard.sidebar.logo | dashboard.selectors.sidebarLogo | sidebar-logo | Implemented |
| dashboard.sidebar.content | dashboard.selectors.sidebarContent | sidebar-content | Implemented |
| dashboard.sidebar.footer | dashboard.selectors.sidebarFooter | sidebar-footer | **NOT IMPLEMENTED** |

### Notes
- The sidebar footer selector is not currently implemented in Sidebar.tsx component
- Sidebar is only visible on desktop viewports when authenticated
- Component file: `packages/core/src/components/dashboard/Sidebar.tsx`

---

## Related Components

| Component | File | Selectors |
|-----------|------|-----------|
| Sidebar | `packages/core/src/components/dashboard/Sidebar.tsx` | sidebar-main, sidebar-header, sidebar-logo, sidebar-content |

## Related POMs

| POM | File | Usage |
|-----|------|-------|
| DashboardPOM | `themes/default/tests/cypress/src/features/DashboardPOM.ts` | Sidebar selectors and methods |
