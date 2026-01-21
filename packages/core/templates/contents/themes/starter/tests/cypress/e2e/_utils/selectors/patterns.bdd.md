---
feature: Patterns UI Selectors Validation
priority: high
tags: [selectors, patterns, ui-validation]
grepTags: [ui-selectors, patterns, feat-patterns, SEL_PAT_001, SEL_PAT_002, SEL_PAT_003, SEL_PAT_004, SEL_PAT_005, SEL_PAT_006, SEL_PAT_007, SEL_PAT_008]
coverage: 8
---

# Patterns UI Selectors Validation

> Validates that patterns-specific selectors exist in the DOM. This is a lightweight test that ONLY checks selector presence, not functionality. Validates KEY DIFFERENCES from standard entity editor: no slug input and no patterns tab in block picker.

**Login:** Uses Developer via `loginAsDefaultDeveloper()`.

**Dependencies:**
- Sample patterns must exist (from seed data)
- At least one pattern must have usages (for reports tests)

## @test SEL_PAT_001: Patterns List Page Selectors

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** patterns, list, page
- **Grep:** `@ui-selectors` `@patterns` `@feat-patterns` `@SEL_PAT_001`
- **Status:** Active (5 passing, 0 skipped)

```gherkin:en
Scenario: Patterns list page has complete selector coverage

Given I am logged in as a developer user
And I navigate to the patterns list page
Then I should find the page container
And I should find the page title
And I should find the add button
And I should find the search container
And I should find the table container
```

```gherkin:es
Scenario: Pagina de lista de patrones tiene cobertura completa de selectores

Given estoy logueado como usuario developer
And navego a la pagina de lista de patrones
Then deberia encontrar el contenedor de pagina
And deberia encontrar el titulo de pagina
And deberia encontrar el boton de agregar
And deberia encontrar el contenedor de busqueda
And deberia encontrar el contenedor de tabla
```

### Expected Results
| Test ID | Selector Path | Status |
|---------|---------------|--------|
| SEL_PAT_001_01 | patterns.selectors.page | Implemented |
| SEL_PAT_001_02 | patterns.selectors.title | Implemented |
| SEL_PAT_001_03 | patterns.selectors.addBtn | Implemented |
| SEL_PAT_001_04 | patterns.selectors.searchContainer | Implemented |
| SEL_PAT_001_05 | patterns.selectors.table | Implemented |

---

## @test SEL_PAT_002: Patterns List Table Actions

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** patterns, list, actions, table
- **Grep:** `@ui-selectors` `@patterns` `@feat-patterns` `@SEL_PAT_002`
- **Status:** Active (4 passing, 0 skipped)

```gherkin:en
Scenario: Patterns list table has all row action selectors

Given I am logged in as a developer user
And I navigate to the patterns list page
And at least one pattern exists in the database
Then I should find the row menu for the first pattern
When I click the row menu
Then I should find the edit action
And I should find the delete action
And I should find the usages quick action
```

```gherkin:es
Scenario: Tabla de lista de patrones tiene todos los selectores de acciones de fila

Given estoy logueado como usuario developer
And navego a la pagina de lista de patrones
And al menos un patron existe en la base de datos
Then deberia encontrar el menu de fila del primer patron
When hago click en el menu de fila
Then deberia encontrar la accion de editar
And deberia encontrar la accion de eliminar
And deberia encontrar la accion rapida de usos
```

### Expected Results
| Test ID | Selector Path | Status |
|---------|---------------|--------|
| SEL_PAT_002_01 | patterns.selectors.rowMenu(id) | Implemented |
| SEL_PAT_002_02 | patterns.selectors.rowAction('edit', id) | Implemented |
| SEL_PAT_002_03 | patterns.selectors.rowAction('delete', id) | Implemented |
| SEL_PAT_002_04 | patterns.selectors.rowAction('usages', id) | Implemented |

---

## @test SEL_PAT_003: Patterns Editor Header - KEY DIFFERENCES

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** patterns, editor, header, differences
- **Grep:** `@ui-selectors` `@patterns` `@feat-patterns` `@SEL_PAT_003`
- **Status:** Active (5 passing, 0 skipped)

```gherkin:en
Scenario: Patterns editor header validates key differences from standard editor

Given I am logged in as a developer user
And I navigate to create a new pattern
And the editor is loaded
Then I should find the header container
And I should find the title input
And I should NOT find the slug input (patterns-specific)
And I should find the save button
And I should find the view mode toggle
```

```gherkin:es
Scenario: Header del editor de patrones valida diferencias clave del editor estandar

Given estoy logueado como usuario developer
And navego a crear un nuevo patron
And el editor esta cargado
Then deberia encontrar el contenedor del header
And deberia encontrar el input de titulo
And NO deberia encontrar el input de slug (especifico de patrones)
And deberia encontrar el boton de guardar
And deberia encontrar el toggle de modo de vista
```

### Expected Results
| Test ID | Selector Path | Assertion | Status |
|---------|---------------|-----------|--------|
| SEL_PAT_003_01 | blockEditor.header.container | should exist | Implemented |
| SEL_PAT_003_02 | blockEditor.header.titleInput | should exist | Implemented |
| SEL_PAT_003_03 | blockEditor.header.slugInput | should NOT exist | **KEY DIFFERENCE** |
| SEL_PAT_003_04 | blockEditor.header.saveButton | should exist | Implemented |
| SEL_PAT_003_05 | blockEditor.header.viewToggle | should exist | Implemented |

### Notes
- **KEY DIFFERENCE:** Patterns do not have slugs, so the slug input should NOT exist.

---

## @test SEL_PAT_004: Patterns Editor Block Picker - KEY DIFFERENCES

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** patterns, editor, block-picker, differences
- **Grep:** `@ui-selectors` `@patterns` `@feat-patterns` `@SEL_PAT_004`
- **Status:** Active (5 passing, 0 skipped)

```gherkin:en
Scenario: Patterns block picker validates key differences from standard editor

Given I am logged in as a developer user
And I navigate to create a new pattern
And the editor is loaded
Then I should find the block picker container
And I should find the blocks tab
And I should NOT find the patterns tab (patterns-specific)
And I should find the config tab
And I should find the search input
```

```gherkin:es
Scenario: Block picker de patrones valida diferencias clave del editor estandar

Given estoy logueado como usuario developer
And navego a crear un nuevo patron
And el editor esta cargado
Then deberia encontrar el contenedor del block picker
And deberia encontrar la pestana de bloques
And NO deberia encontrar la pestana de patrones (especifico de patrones)
And deberia encontrar la pestana de configuracion
And deberia encontrar el input de busqueda
```

### Expected Results
| Test ID | Selector Path | Assertion | Status |
|---------|---------------|-----------|--------|
| SEL_PAT_004_01 | blockEditor.blockPicker.container | should exist | Implemented |
| SEL_PAT_004_02 | blockEditor.blockPicker.tabBlocks | should exist | Implemented |
| SEL_PAT_004_03 | blockEditor.blockPicker.tabPatterns | should NOT exist | **KEY DIFFERENCE** |
| SEL_PAT_004_04 | blockEditor.blockPicker.tabConfig | should exist | **Skipped** (patterns have no sidebarFields/taxonomies) |
| SEL_PAT_004_05 | blockEditor.blockPicker.searchInput | should exist | Implemented |

### Notes
- **KEY DIFFERENCE:** Patterns cannot contain other patterns (to prevent recursion), so the patterns tab should NOT exist.

---

## @test SEL_PAT_005: Patterns Reports Page

### Metadata
- **Priority:** Medium
- **Type:** Selector Validation
- **Tags:** patterns, reports, usages
- **Grep:** `@ui-selectors` `@patterns` `@feat-patterns` `@SEL_PAT_005`
- **Status:** Active (4 passing, 0 skipped)

```gherkin:en
Scenario: Pattern usages report page has complete structure

Given I am logged in as a developer user
And I navigate to the patterns list page
And I click the usages action on the first pattern
Then I should find the report container
And I should find the back button
And I should find the page title
And I should find the edit button
```

```gherkin:es
Scenario: Pagina de reporte de usos de patrones tiene estructura completa

Given estoy logueado como usuario developer
And navego a la pagina de lista de patrones
And hago click en la accion de usos del primer patron
Then deberia encontrar el contenedor del reporte
And deberia encontrar el boton de volver
And deberia encontrar el titulo de pagina
And deberia encontrar el boton de editar
```

### Expected Results
| Test ID | Selector Path | Status |
|---------|---------------|--------|
| SEL_PAT_005_01 | patterns.patternSelectors.usageReport.container | Implemented |
| SEL_PAT_005_02 | patterns.selectors.backButton | Implemented |
| SEL_PAT_005_03 | patterns.selectors.headerTitle | Implemented |
| SEL_PAT_005_04 | patterns.selectors.editButton | Implemented |

---

## @test SEL_PAT_006: Pattern Usage Stats

### Metadata
- **Priority:** Medium
- **Type:** Selector Validation
- **Tags:** patterns, reports, stats
- **Grep:** `@ui-selectors` `@patterns` `@feat-patterns` `@SEL_PAT_006`
- **Status:** Active (3 passing, 0 skipped)

```gherkin:en
Scenario: Pattern usage stats have all required selectors

Given I am logged in as a developer user
And I navigate to a pattern's usages page
Then I should find the stats container
And I should find the total usage card
And I should find usage by type cards (if usages exist)
```

```gherkin:es
Scenario: Estadisticas de uso de patron tienen todos los selectores requeridos

Given estoy logueado como usuario developer
And navego a la pagina de usos de un patron
Then deberia encontrar el contenedor de estadisticas
And deberia encontrar la tarjeta de uso total
And deberia encontrar las tarjetas de uso por tipo (si existen usos)
```

### Expected Results
| Test ID | Selector Path | Status |
|---------|---------------|--------|
| SEL_PAT_006_01 | patterns.patternSelectors.usageStats.container | Implemented |
| SEL_PAT_006_02 | patterns.patternSelectors.usageStats.total | Implemented |
| SEL_PAT_006_03 | patterns.patternSelectors.usageStats.byType(type) | Conditional |

---

## @test SEL_PAT_007: Pattern Usage Report Controls

### Metadata
- **Priority:** Medium
- **Type:** Selector Validation
- **Tags:** patterns, reports, controls, pagination
- **Grep:** `@ui-selectors` `@patterns` `@feat-patterns` `@SEL_PAT_007`
- **Status:** Active (6 passing, 0 skipped)

```gherkin:en
Scenario: Pattern usage report controls have all required selectors

Given I am logged in as a developer user
And I navigate to a pattern's usages page
Then I should find the report container
And I should find the filter select
And I should find the pagination container
And I should find the prev page button
And I should find the next page button
And I should find the results info
```

```gherkin:es
Scenario: Controles de reporte de uso de patron tienen todos los selectores requeridos

Given estoy logueado como usuario developer
And navego a la pagina de usos de un patron
Then deberia encontrar el contenedor del reporte
And deberia encontrar el select de filtro
And deberia encontrar el contenedor de paginacion
And deberia encontrar el boton de pagina anterior
And deberia encontrar el boton de pagina siguiente
And deberia encontrar la info de resultados
```

### Expected Results
| Test ID | Selector Path | Status |
|---------|---------------|--------|
| SEL_PAT_007_01 | patterns.patternSelectors.usageReport.container | Implemented |
| SEL_PAT_007_02 | patterns.patternSelectors.usageReport.filterSelect | Implemented |
| SEL_PAT_007_03 | patterns.patternSelectors.usageReport.pagination | Implemented |
| SEL_PAT_007_04 | patterns.patternSelectors.usageReport.prevPage | Implemented |
| SEL_PAT_007_05 | patterns.patternSelectors.usageReport.nextPage | Implemented |
| SEL_PAT_007_06 | patterns.patternSelectors.usageReport.resultsInfo | Implemented |

---

## @test SEL_PAT_008: Pattern Usage Table

### Metadata
- **Priority:** Medium
- **Type:** Selector Validation
- **Tags:** patterns, reports, table
- **Grep:** `@ui-selectors` `@patterns` `@feat-patterns` `@SEL_PAT_008`
- **Status:** Partial (1 passing, 2 skipped)

```gherkin:en
Scenario: Pattern usage table has all required selectors

Given I am logged in as a developer user
And I navigate to a pattern's usages page
Then I should find the usage table container (or empty state)
And I should find usage rows (if pattern has usages)
And I should find view links in usage rows (if pattern has usages)
```

```gherkin:es
Scenario: Tabla de usos de patron tiene todos los selectores requeridos

Given estoy logueado como usuario developer
And navego a la pagina de usos de un patron
Then deberia encontrar el contenedor de tabla de usos (o estado vacio)
And deberia encontrar filas de uso (si el patron tiene usos)
And deberia encontrar links de ver en filas de uso (si el patron tiene usos)
```

### Expected Results
| Test ID | Selector Path | Status |
|---------|---------------|--------|
| SEL_PAT_008_01 | patterns.patternSelectors.usageTable.container/empty | Implemented |
| SEL_PAT_008_02 | [data-cy^="pattern-usage-row-"] | **Skipped** |
| SEL_PAT_008_03 | [data-cy^="pattern-usage-view-"] | **Skipped** |

### Notes
- Tests SEL_PAT_008_02 and SEL_PAT_008_03 are skipped because they require the pattern to have actual usages.

---

## Related Components

| Component | File | Key Selectors |
|-----------|------|---------------|
| PatternsListPage | `packages/core/src/app/[locale]/(auth)/dashboard/patterns/page.tsx` | page, title, addBtn, table |
| PatternEditor | `packages/core/src/components/page-builder/PageBuilder.tsx` | header.*, blockPicker.* |
| PatternUsagesPage | `packages/core/src/app/[locale]/(auth)/dashboard/patterns/[id]/usages/page.tsx` | usageReport.*, usageStats.* |

## Related POMs

| POM | File | Usage |
|-----|------|-------|
| PatternsPOM | `themes/default/tests/cypress/src/entities/PatternsPOM.ts` | List operations, entity selectors |
| PageBuilderPOM | `themes/default/tests/cypress/src/features/PageBuilderPOM.ts` | Editor selectors |
