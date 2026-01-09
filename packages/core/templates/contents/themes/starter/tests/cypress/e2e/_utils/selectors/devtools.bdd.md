---
feature: DevTools UI Selectors Validation
priority: medium
tags: [selectors, devtools, developer, ui-validation]
grepTags: [ui-selectors, devtools, SEL_DEVT_001, SEL_DEVT_002, SEL_DEVT_003, SEL_DEVT_004, SEL_DEVT_005, SEL_DEVT_006]
coverage: 6
---

# DevTools UI Selectors Validation

> Validates that DevTools (devzone) component selectors exist in the DOM. This is a lightweight test that ONLY checks selector presence, not functionality.

**IMPORTANT:** DevTools is only accessible to users with 'developer' app role. All tests use `loginAsDefaultDeveloper()`.

## @test SEL_DEVT_001: Navigation Structure

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** devtools, navigation, sidebar
- **Grep:** `@ui-selectors` `@SEL_DEVT_001`
- **Status:** Active - 8 tests

```gherkin:en
Scenario: DevTools navigation has complete structure

Given I am logged in as a developer user
And I navigate to /devtools
Then I should find the sidebar container
And I should find the sidebar collapse toggle
And I should find the nav home item
And I should find the nav style gallery item
And I should find the nav test cases item
And I should find the nav config item
And I should find the exit to dashboard link
And I should find the go to admin link
```

```gherkin:es
Scenario: Navegacion de DevTools tiene estructura completa

Given estoy logueado como usuario developer
And navego a /devtools
Then deberia encontrar el contenedor del sidebar
And deberia encontrar el toggle de colapso del sidebar
And deberia encontrar el item de navegacion home
And deberia encontrar el item de navegacion style gallery
And deberia encontrar el item de navegacion test cases
And deberia encontrar el item de navegacion config
And deberia encontrar el link de salir al dashboard
And deberia encontrar el link de ir a admin
```

### Expected Results
- `devtools-sidebar` selector exists
- `devtools-sidebar-collapse` selector exists
- `devtools-nav-home` selector exists
- `devtools-nav-style` selector exists
- `devtools-nav-tests` selector exists
- `devtools-nav-config` selector exists
- `devtools-exit-dashboard` selector exists
- `devtools-go-admin` selector exists

---

## @test SEL_DEVT_002: Home Page

### Metadata
- **Priority:** Medium
- **Type:** Selector Validation
- **Tags:** devtools, home, quicklinks
- **Grep:** `@ui-selectors` `@SEL_DEVT_002`
- **Status:** Active - 4 tests

```gherkin:en
Scenario: DevTools home page has quick links

Given I am logged in as a developer user
And I navigate to /devtools
Then I should find the home page container
And I should find the style gallery quick link
And I should find the tests quick link
And I should find the config quick link
```

```gherkin:es
Scenario: Pagina home de DevTools tiene links rapidos

Given estoy logueado como usuario developer
And navego a /devtools
Then deberia encontrar el contenedor de la pagina home
And deberia encontrar el link rapido a style gallery
And deberia encontrar el link rapido a tests
And deberia encontrar el link rapido a config
```

### Expected Results
- `devtools-home-page` selector exists
- `devtools-home-style-link` selector exists
- `devtools-home-tests-link` selector exists
- `devtools-home-config-link` selector exists

---

## @test SEL_DEVT_003: Style Gallery Page

### Metadata
- **Priority:** Medium
- **Type:** Selector Validation
- **Tags:** devtools, style, gallery, tabs
- **Grep:** `@ui-selectors` `@SEL_DEVT_003`
- **Status:** Active - 8 tests

```gherkin:en
Scenario: DevTools style gallery has all tabs and content

Given I am logged in as a developer user
And I navigate to /devtools/style
Then I should find the style page container
And I should find the components tab
And I should find the field types tab
And I should find the theme tab
And I should find the guidelines tab
And I should find the component gallery (default tab)
When I click the field types tab
Then I should find the field types content
When I click the theme tab
Then I should find the theme preview
```

```gherkin:es
Scenario: Style gallery de DevTools tiene todas las tabs y contenido

Given estoy logueado como usuario developer
And navego a /devtools/style
Then deberia encontrar el contenedor de la pagina style
And deberia encontrar la tab de components
And deberia encontrar la tab de field types
And deberia encontrar la tab de theme
And deberia encontrar la tab de guidelines
And deberia encontrar la galeria de componentes (tab por defecto)
When hago click en la tab de field types
Then deberia encontrar el contenido de field types
When hago click en la tab de theme
Then deberia encontrar el preview del tema
```

### Expected Results
- `devtools-style-page` selector exists
- `devtools-style-tab-components` selector exists
- `devtools-style-tab-fieldtypes` selector exists
- `devtools-style-tab-theme` selector exists
- `devtools-style-tab-guidelines` selector exists
- `devtools-style-component-gallery` selector exists
- `devtools-style-fieldtypes` selector exists (when tab clicked)
- `devtools-style-theme-preview` selector exists (when tab clicked)

---

## @test SEL_DEVT_004: Config Viewer Page

### Metadata
- **Priority:** Medium
- **Type:** Selector Validation
- **Tags:** devtools, config, viewer, tabs
- **Grep:** `@ui-selectors` `@SEL_DEVT_004`
- **Status:** Active - 8 tests

```gherkin:en
Scenario: DevTools config viewer has all tabs and actions

Given I am logged in as a developer user
And I navigate to /devtools/config
Then I should find the config page container
And I should find the config viewer container
And I should find the theme tab
And I should find the entities tab
And I should find the theme content (default tab)
And I should find the copy theme button
When I click the entities tab
Then I should find the entities content
And I should find the copy entities button
```

```gherkin:es
Scenario: Config viewer de DevTools tiene todas las tabs y acciones

Given estoy logueado como usuario developer
And navego a /devtools/config
Then deberia encontrar el contenedor de la pagina config
And deberia encontrar el contenedor del config viewer
And deberia encontrar la tab de theme
And deberia encontrar la tab de entities
And deberia encontrar el contenido de theme (tab por defecto)
And deberia encontrar el boton de copiar theme
When hago click en la tab de entities
Then deberia encontrar el contenido de entities
And deberia encontrar el boton de copiar entities
```

### Expected Results
- `devtools-config-page` selector exists
- `devtools-config-viewer` selector exists
- `devtools-config-tab-theme` selector exists
- `devtools-config-tab-entities` selector exists
- `devtools-config-theme-content` selector exists
- `devtools-config-copy-theme` selector exists
- `devtools-config-entities-content` selector exists (when tab clicked)
- `devtools-config-copy-entities` selector exists (when tab clicked)

---

## @test SEL_DEVT_005: Test Cases Page

### Metadata
- **Priority:** Medium
- **Type:** Selector Validation
- **Tags:** devtools, tests, viewer
- **Grep:** `@ui-selectors` `@SEL_DEVT_005`
- **Status:** Active - 3 tests

```gherkin:en
Scenario: DevTools test cases page has viewer components

Given I am logged in as a developer user
And I navigate to /devtools/tests
Then I should find the tests page container
And I should find the tests viewer container
And I should find the tests tree
```

```gherkin:es
Scenario: Pagina test cases de DevTools tiene componentes del viewer

Given estoy logueado como usuario developer
And navego a /devtools/tests
Then deberia encontrar el contenedor de la pagina tests
And deberia encontrar el contenedor del tests viewer
And deberia encontrar el arbol de tests
```

### Expected Results
- `devtools-tests-page` selector exists
- `devtools-tests-viewer` selector exists
- `devtools-tests-tree` selector exists

### Notes
Conditional states (loading, empty, error) are not tested in selector validation.

---

## @test SEL_DEVT_006: Test Coverage Dashboard

### Metadata
- **Priority:** Medium
- **Type:** Selector Validation
- **Tags:** devtools, tests, dashboard, coverage
- **Grep:** `@ui-selectors` `@SEL_DEVT_006`
- **Status:** Active - 9 tests

```gherkin:en
Scenario: DevTools test coverage dashboard has all components

Given I am logged in as a developer user
And I navigate to /devtools/tests
Then I should find the dashboard container
And I should find the dashboard stats container
And I should find the features stat card
And I should find the flows stat card
And I should find the files stat card
And I should find the tags stat card
And I should find the coverage gaps container
When I select a test file from the tree
Then I should find the dashboard button in sidebar
When I click the dashboard button
Then I should see the dashboard again
```

```gherkin:es
Scenario: Dashboard de cobertura de DevTools tiene todos los componentes

Given estoy logueado como usuario developer
And navego a /devtools/tests
Then deberia encontrar el contenedor del dashboard
And deberia encontrar el contenedor de estadisticas
And deberia encontrar la tarjeta de estadisticas de features
And deberia encontrar la tarjeta de estadisticas de flows
And deberia encontrar la tarjeta de estadisticas de files
And deberia encontrar la tarjeta de estadisticas de tags
And deberia encontrar el contenedor de gaps de cobertura
When selecciono un archivo de test del arbol
Then deberia encontrar el boton de dashboard en el sidebar
When hago click en el boton de dashboard
Then deberia ver el dashboard nuevamente
```

### Expected Results
- `devtools-tests-dashboard` selector exists (when no file selected)
- `devtools-tests-dashboard-stats` selector exists
- `devtools-tests-dashboard-stat-features` selector exists
- `devtools-tests-dashboard-stat-flows` selector exists
- `devtools-tests-dashboard-stat-files` selector exists
- `devtools-tests-dashboard-stat-tags` selector exists
- `devtools-tests-dashboard-gaps` selector exists
- `devtools-tests-dashboard-button` selector exists (when file selected)
- Dashboard button returns to dashboard view
