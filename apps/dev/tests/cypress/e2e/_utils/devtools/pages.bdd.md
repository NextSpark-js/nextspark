---
feature: DevTools Page Content
priority: high
tags: [dev-area, pages, content]
grepTags: [uat, feat-dev-area, regression]
coverage: 6
---

# DevTools Page Content

> Tests the content and functionality of each /devtools page including Home quick links, Style Gallery components, Test Cases viewer, and Config viewer tabs.

## @test PAGE-001: Home page renders quick links

### Metadata
- **Priority:** High
- **Type:** Smoke
- **Tags:** home, quick-links
- **Grep:** `@smoke`

```gherkin:en
Scenario: Display all quick link cards on home page

Given I am logged in as Developer (developer@nextspark.dev)
When I visit /devtools home
Then the home page container should be visible
And all quick links should be visible (Style, Tests, Config)

When I click Style Gallery quick link
Then I should be on /devtools/style

When I go back to /devtools home
And I click Test Cases quick link
Then I should be on /devtools/tests

When I go back to /devtools home
And I click Config Viewer quick link
Then I should be on /devtools/config
```

```gherkin:es
Scenario: Mostrar todas las tarjetas de enlaces rapidos en home

Given estoy logueado como Developer (developer@nextspark.dev)
When visito /devtools home
Then el contenedor de home page deberia estar visible
And todos los enlaces rapidos deberian estar visibles (Style, Tests, Config)

When hago clic en el enlace rapido Style Gallery
Then deberia estar en /devtools/style

When vuelvo a /devtools home
And hago clic en el enlace rapido Test Cases
Then deberia estar en /devtools/tests

When vuelvo a /devtools home
And hago clic en el enlace rapido Config Viewer
Then deberia estar en /devtools/config
```

### Expected Results
- Home page container visible
- All 3 quick link cards displayed
- Each quick link navigates correctly
- All target pages load successfully

---

## @test PAGE-002: Style Gallery loads components

### Metadata
- **Priority:** High
- **Type:** Smoke
- **Tags:** style-gallery, components, tabs

```gherkin:en
Scenario: Display all Style Gallery sections

Given I am logged in as Developer (developer@nextspark.dev)
When I visit /devtools/style
Then the style page should be visible

And I verify all tab sections by clicking through them:
| Tab | Content Section |
| Components | Component Gallery |
| Field Types | Field Types Gallery |
| Theme | Theme Preview |
```

```gherkin:es
Scenario: Mostrar todas las secciones de Style Gallery

Given estoy logueado como Developer (developer@nextspark.dev)
When visito /devtools/style
Then la pagina de estilos deberia estar visible

And verifico todas las secciones de tabs haciendo clic en cada una:
| Tab | Seccion de Contenido |
| Components | Component Gallery |
| Field Types | Field Types Gallery |
| Theme | Theme Preview |
```

### Expected Results
- Style page container visible
- Components tab visible by default
- Field Types tab content loads on click
- Theme tab content loads on click

---

## @test PAGE-003a: Test Cases viewer shows file tree

### Metadata
- **Priority:** High
- **Type:** Smoke
- **Tags:** test-cases, file-tree

```gherkin:en
Scenario: Display test cases viewer with file tree

Given I am logged in as Developer (developer@nextspark.dev)
When I visit /devtools/tests
Then the tests page should be visible
And the viewer container should be visible
And either file tree or empty state should be displayed
```

```gherkin:es
Scenario: Mostrar visor de test cases con arbol de archivos

Given estoy logueado como Developer (developer@nextspark.dev)
When visito /devtools/tests
Then la pagina de tests deberia estar visible
And el contenedor del visor deberia estar visible
And deberia mostrarse el arbol de archivos o estado vacio
```

### Expected Results
- Tests page container visible
- Viewer component rendered
- File tree shows .bdd.md files (or empty state)

---

## @test PAGE-003b: Test Cases viewer shows markdown content

### Metadata
- **Priority:** Medium
- **Type:** Regression
- **Tags:** test-cases, markdown, file-select

```gherkin:en
Scenario: Show markdown content when selecting a file

Given I am on /devtools/tests
When I check if file tree has files
And files exist
And I click on the first file
Then the content area should be visible
And markdown content should be rendered
```

```gherkin:es
Scenario: Mostrar contenido markdown al seleccionar un archivo

Given estoy en /devtools/tests
When verifico si el arbol de archivos tiene archivos
And existen archivos
And hago clic en el primer archivo
Then el area de contenido deberia estar visible
And el contenido markdown deberia estar renderizado
```

### Expected Results
- File selection works
- Markdown content loads
- Content is properly formatted

---

## @test PAGE-004a: Config viewer shows tabs

### Metadata
- **Priority:** High
- **Type:** Smoke
- **Tags:** config, tabs

```gherkin:en
Scenario: Display config viewer with tabs

Given I am logged in as Developer (developer@nextspark.dev)
When I visit /devtools/config
Then the config page should be visible
And config tabs should be visible (Theme, Entities)

When I click Theme tab
Then Theme content should be visible

When I click Entities tab
Then Entities content should be visible
```

```gherkin:es
Scenario: Mostrar visor de config con tabs

Given estoy logueado como Developer (developer@nextspark.dev)
When visito /devtools/config
Then la pagina de config deberia estar visible
And los tabs de config deberian estar visibles (Theme, Entities)

When hago clic en el tab Theme
Then el contenido de Theme deberia estar visible

When hago clic en el tab Entities
Then el contenido de Entities deberia estar visible
```

### Expected Results
- Config page container visible
- Theme and Entities tabs visible
- Tab switching works correctly
- Each tab shows correct content

---

## @test PAGE-004b: Config viewer shows copy buttons

### Metadata
- **Priority:** Medium
- **Type:** Regression
- **Tags:** config, copy-buttons

```gherkin:en
Scenario: Display copy buttons in config viewer

Given I am on /devtools/config
When I click Theme tab
Then copy button for theme config should be visible

When I click Entities tab
Then copy button for entities config should be visible
```

```gherkin:es
Scenario: Mostrar botones de copia en el visor de config

Given estoy en /devtools/config
When hago clic en el tab Theme
Then el boton de copia para config de theme deberia estar visible

When hago clic en el tab Entities
Then el boton de copia para config de entities deberia estar visible
```

### Expected Results
- Copy buttons present in both tabs
- Copy functionality available for developers

---

## UI Elements

| Element | Selector | Description |
|---------|----------|-------------|
| Home Page | `[data-cy="dev-home-page"]` | Dev home page container |
| Home Style Link | `[data-cy="dev-home-style-link"]` | Quick link to Style Gallery |
| Home Tests Link | `[data-cy="dev-home-tests-link"]` | Quick link to Test Cases |
| Home Config Link | `[data-cy="dev-home-config-link"]` | Quick link to Config Viewer |
| Style Page | `[data-cy="dev-style-page"]` | Style Gallery page container |
| Style Tab Components | `[data-cy="dev-style-tab-components"]` | Components tab trigger |
| Style Tab Field Types | `[data-cy="dev-style-tab-field-types"]` | Field Types tab trigger |
| Style Tab Theme | `[data-cy="dev-style-tab-theme"]` | Theme tab trigger |
| Style Component Gallery | `[data-cy="dev-style-component-gallery"]` | Components tab content |
| Style Field Types | `[data-cy="dev-style-field-types"]` | Field Types tab content |
| Style Theme Preview | `[data-cy="dev-style-theme-preview"]` | Theme tab content |
| Tests Page | `[data-cy="dev-tests-page"]` | Test Cases page container |
| Tests Viewer | `[data-cy="dev-tests-viewer"]` | Test viewer container |
| Tests Tree | `[data-cy="dev-tests-tree"]` | File tree component |
| Tests Empty State | `[data-cy="dev-tests-empty-state"]` | Empty state when no files |
| Tests Content | `[data-cy="dev-tests-content"]` | Content display area |
| Tests Markdown | `[data-cy="dev-tests-markdown-content"]` | Rendered markdown content |
| Config Page | `[data-cy="dev-config-page"]` | Config Viewer page container |
| Config Viewer | `[data-cy="dev-config-viewer"]` | Config viewer container |
| Config Tab Theme | `[data-cy="dev-config-tab-theme"]` | Theme tab trigger |
| Config Tab Entities | `[data-cy="dev-config-tab-entities"]` | Entities tab trigger |
| Config Theme Content | `[data-cy="dev-config-theme-content"]` | Theme config content |
| Config Entities Content | `[data-cy="dev-config-entities-content"]` | Entities config content |
| Config Copy Theme | `[data-cy="dev-config-copy-theme"]` | Copy theme config button |
| Config Copy Entities | `[data-cy="dev-config-copy-entities"]` | Copy entities config button |

---

## Summary

| Test ID | Block | Description | Tags |
|---------|-------|-------------|------|
| PAGE-001 | Home Page | Quick links display and work | `@smoke` |
| PAGE-002 | Style Gallery | All tab sections load | |
| PAGE-003a | Test Cases | File tree viewer works | |
| PAGE-003b | Test Cases | Markdown content renders | |
| PAGE-004a | Config Viewer | Tabs display and switch | |
| PAGE-004b | Config Viewer | Copy buttons available | |
