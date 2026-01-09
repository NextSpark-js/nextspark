---
feature: Pages Block Editor UI Selectors Validation
priority: high
tags: [selectors, pages, editor, page-builder, ui-validation]
grepTags: [ui-selectors, pages, editor, SEL_PGED_001, SEL_PGED_002, SEL_PGED_003, SEL_PGED_004, SEL_PGED_005, SEL_PGED_006]
coverage: 6
---

# Pages Block Editor UI Selectors Validation

> Validates selectors specific to the Page Builder including page settings, SEO, and locale features. These tests ensure the page editor has all required UI elements.

## @test SEL_PGED_001: Pages List Page Selectors

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** pages, list, table
- **Grep:** `@ui-selectors` `@SEL_PGED_001`
- **Status:** Active

```gherkin:en
Scenario: Pages list has required selectors

Given I am logged in as a valid user
And I navigate to the pages list
Then I should find the pages table container
And I should find the add page button
And I should find at least one page row
```

```gherkin:es
Scenario: Lista de paginas tiene selectores requeridos

Given estoy logueado como usuario valido
And navego a la lista de paginas
Then deberia encontrar el contenedor de tabla de paginas
And deberia encontrar el boton de agregar pagina
And deberia encontrar al menos una fila de pagina
```

---

## @test SEL_PGED_002: Block Editor Core Selectors

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** pages, editor, core
- **Grep:** `@ui-selectors` `@SEL_PGED_002`
- **Status:** Active

```gherkin:en
Scenario: Page editor has core selectors

Given I am logged in as a valid user
And I create a new page
Then I should find the editor container
And I should find the title input
And I should find the slug input
And I should find the save button
```

```gherkin:es
Scenario: Editor de paginas tiene selectores core

Given estoy logueado como usuario valido
And creo una nueva pagina
Then deberia encontrar el contenedor del editor
And deberia encontrar el input de titulo
And deberia encontrar el input de slug
And deberia encontrar el boton de guardar
```

---

## @test SEL_PGED_003: Page Settings Selectors

### Metadata
- **Priority:** Medium
- **Type:** Selector Validation
- **Tags:** pages, settings, seo, locale
- **Grep:** `@ui-selectors` `@SEL_PGED_003`
- **Status:** Partial - 2 passing, 2 skipped (SEO not implemented)

```gherkin:en
Scenario: Page editor has settings and SEO selectors

Given I am logged in as a valid user
And I edit an existing page
When I click on the fields tab
Then I should find the entity fields sidebar
And I should find the locale selector
And the SEO trigger should exist (skipped - not implemented)
And the SEO fields should exist when expanded (skipped - not implemented)
```

```gherkin:es
Scenario: Editor de paginas tiene selectores de configuracion y SEO

Given estoy logueado como usuario valido
And edito una pagina existente
When hago click en la tab de campos
Then deberia encontrar el sidebar de campos de entidad
And deberia encontrar el selector de locale
And el trigger de SEO deberia existir (skipped - no implementado)
And los campos de SEO deberian existir cuando se expanden (skipped - no implementado)
```

---

## @test SEL_PGED_004: Block Picker Selectors

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** pages, blocks, picker
- **Grep:** `@ui-selectors` `@SEL_PGED_004`
- **Status:** Active

```gherkin:en
Scenario: Page editor has block picker selectors

Given I am logged in as a valid user
And I create a new page
Then I should find the block picker container
And I should find the hero block item
And I should find the add hero block button
```

```gherkin:es
Scenario: Editor de paginas tiene selectores de block picker

Given estoy logueado como usuario valido
And creo una nueva pagina
Then deberia encontrar el contenedor del block picker
And deberia encontrar el item de bloque hero
And deberia encontrar el boton de agregar bloque hero
```

---

## @test SEL_PGED_005: Block Canvas and Settings

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** pages, canvas, settings
- **Grep:** `@ui-selectors` `@SEL_PGED_005`
- **Status:** Active

```gherkin:en
Scenario: Page editor canvas and settings work

Given I am logged in as a valid user
And I create a new page
Then I should find the empty state when no blocks added
When I add a hero block
Then I should find the block canvas
And I should find the settings panel
And I should find the content and design tabs
```

```gherkin:es
Scenario: Canvas y configuracion del editor de paginas funcionan

Given estoy logueado como usuario valido
And creo una nueva pagina
Then deberia encontrar el estado vacio cuando no hay bloques
When agrego un bloque hero
Then deberia encontrar el canvas de bloques
And deberia encontrar el panel de configuracion
And deberia encontrar las tabs de contenido y diseno
```

---

## @test SEL_PGED_006: Edit Existing Page

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** pages, edit, existing
- **Grep:** `@ui-selectors` `@SEL_PGED_006`
- **Status:** Active

```gherkin:en
Scenario: Editing existing page loads editor correctly

Given I am logged in as a valid user
And I navigate to the pages list
When I select an existing page to edit
Then I should find the editor container
And I should find the title input with existing content
And I should find the save button
```

```gherkin:es
Scenario: Editar pagina existente carga el editor correctamente

Given estoy logueado como usuario valido
And navego a la lista de paginas
When selecciono una pagina existente para editar
Then deberia encontrar el contenedor del editor
And deberia encontrar el input de titulo con contenido existente
And deberia encontrar el boton de guardar
```
