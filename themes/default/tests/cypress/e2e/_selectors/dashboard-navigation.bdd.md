---
feature: Dashboard Navigation UI Selectors Validation
priority: high
tags: [selectors, dashboard, navigation, ui-validation]
grepTags: [ui-selectors, dashboard, SEL_DASH_001, SEL_DASH_002, SEL_DASH_003]
coverage: 3
---

# Dashboard Navigation UI Selectors Validation

> Validates that dashboard navigation selectors exist in the DOM. This is a lightweight test that ONLY checks selector presence, not functionality. Runs as Phase 12 sub-gate before functional tests.

## @test SEL_DASH_001: Navigation Structure

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** navigation, structure, sidebar
- **Grep:** `@ui-selectors` `@SEL_DASH_001`
- **Status:** Active

```gherkin:en
Scenario: Dashboard navigation has complete structure

Given I am logged in as developer
And I navigate to the dashboard
Then I should find the main navigation container
And I should find the dashboard link
```

```gherkin:es
Scenario: Navegacion del dashboard tiene estructura completa

Given estoy logueado como developer
And navego al dashboard
Then deberia encontrar el contenedor principal de navegacion
And deberia encontrar el link de dashboard
```

### Expected Results
- `dashboard.navigation.main` selector exists (nav-main)
- `dashboard.navigation.dashboardLink` selector exists (nav-link-dashboard)

---

## @test SEL_DASH_002: Entity Links

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** navigation, entities, links
- **Grep:** `@ui-selectors` `@SEL_DASH_002`
- **Status:** Active

```gherkin:en
Scenario: Dashboard navigation has entity links

Given I am logged in as developer
And I navigate to the dashboard
Then I should find the tasks entity link
And I should find the customers entity link
And I should find the posts entity link
And I should find the pages entity link
```

```gherkin:es
Scenario: Navegacion del dashboard tiene links de entidades

Given estoy logueado como developer
And navego al dashboard
Then deberia encontrar el link de entidad tasks
And deberia encontrar el link de entidad customers
And deberia encontrar el link de entidad posts
And deberia encontrar el link de entidad pages
```

### Expected Results
- `dashboard.navigation.entityLink` with slug `tasks` exists (nav-link-entity-tasks)
- `dashboard.navigation.entityLink` with slug `customers` exists (nav-link-entity-customers)
- `dashboard.navigation.entityLink` with slug `posts` exists (nav-link-entity-posts)
- `dashboard.navigation.entityLink` with slug `pages` exists (nav-link-entity-pages)

### Notes
Entity links are dynamic based on:
- Entity configuration (enabled, showInMenu)
- User permissions
- Theme configuration

---

## @test SEL_DASH_003: Navigation Sections

### Metadata
- **Priority:** Medium
- **Type:** Selector Validation
- **Tags:** navigation, sections, dynamic
- **Grep:** `@ui-selectors` `@SEL_DASH_003`
- **Status:** Skipped - requires customSidebarSections in app.config.ts

```gherkin:en
Scenario: Dashboard navigation has section structure

Given I am logged in as developer
And I navigate to the dashboard
And the theme has custom sidebar sections configured
Then I should find section containers by ID
And I should find section labels
And I should find section items
```

```gherkin:es
Scenario: Navegacion del dashboard tiene estructura de secciones

Given estoy logueado como developer
And navego al dashboard
And el tema tiene secciones de sidebar personalizadas configuradas
Then deberia encontrar contenedores de seccion por ID
And deberia encontrar etiquetas de seccion
And deberia encontrar items de seccion
```

### Expected Results (when sections are configured)
- `dashboard.navigation.section` with ID exists (nav-section-{id})
- `dashboard.navigation.sectionLabel` with ID exists (nav-section-label-{id})
- `dashboard.navigation.sectionItem` with IDs exists (nav-section-item-{sectionId}-{itemId})

### Notes
All tests in this section are skipped because:
- Requires `customSidebarSections` to be defined in `app.config.ts`
- **IMPORTANT:** Enabling `customSidebarSections` REPLACES the default entity-based navigation entirely
- The sidebar will only show items defined in the sections (no automatic entity links)
- Requires translation keys for each section and item (e.g., `navigation.content`, `navigation.posts`)
- For themes with custom sections (e.g., LMS themes), enable these tests with the actual section/item IDs

---

## Related Components

| Component | File | Selectors |
|-----------|------|-----------|
| DynamicNavigation | `packages/core/src/components/dashboard/navigation/DynamicNavigation.tsx` | nav-main, nav-link-dashboard, nav-link-entity-{slug}, nav-section-{id}, nav-section-label-{id}, nav-section-item-{sectionId}-{itemId} |

## Related POMs

| POM | File | Usage |
|-----|------|-------|
| DashboardPOM | `themes/default/tests/cypress/src/features/DashboardPOM.ts` | Navigation selectors and methods |
