---
feature: Posts Block Editor UI Selectors Validation
priority: high
tags: [selectors, posts, editor, block-editor, ui-validation]
grepTags: [ui-selectors, posts, editor, SEL_PTED_001, SEL_PTED_002, SEL_PTED_003, SEL_PTED_004, SEL_PTED_005, SEL_PTED_006, SEL_PTED_007, SEL_PTED_008, SEL_PTED_009]
coverage: 9
---

# Posts Block Editor UI Selectors Validation

> Validates that the block-based post editor has all required selectors. Tests the POM architecture with dynamic selectors.

## @test SEL_PTED_001: Posts List Page Selectors

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** posts, list, table
- **Grep:** `@ui-selectors` `@SEL_PTED_001`
- **Status:** Active

```gherkin:en
Scenario: Posts list has required selectors

Given I am logged in as a valid user
And I navigate to the posts list
Then I should find the posts table container
And I should find the add post button
And I should find the search input
And I should find pagination
And I should find at least one post row
```

```gherkin:es
Scenario: Lista de posts tiene selectores requeridos

Given estoy logueado como usuario valido
And navego a la lista de posts
Then deberia encontrar el contenedor de tabla de posts
And deberia encontrar el boton de agregar post
And deberia encontrar el input de busqueda
And deberia encontrar paginacion
And deberia encontrar al menos una fila de post
```

---

## @test SEL_PTED_002: Block Editor Core Selectors

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** posts, editor, core
- **Grep:** `@ui-selectors` `@SEL_PTED_002`
- **Status:** Active

```gherkin:en
Scenario: Post editor has core selectors

Given I am logged in as a valid user
And I create a new post
Then I should find the editor container
And I should find the title input
And I should find the slug input
And I should find the save button
And I should find the status badge
And I should find the sidebar toggle
And I should find the view mode toggle
```

```gherkin:es
Scenario: Editor de posts tiene selectores core

Given estoy logueado como usuario valido
And creo un nuevo post
Then deberia encontrar el contenedor del editor
And deberia encontrar el input de titulo
And deberia encontrar el input de slug
And deberia encontrar el boton de guardar
And deberia encontrar el badge de estado
And deberia encontrar el toggle del sidebar
And deberia encontrar el toggle de modo de vista
```

---

## @test SEL_PTED_003: Block Picker Selectors

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** posts, blocks, picker
- **Grep:** `@ui-selectors` `@SEL_PTED_003`
- **Status:** Active

```gherkin:en
Scenario: Post editor has block picker selectors

Given I am logged in as a valid user
And I create a new post
Then I should find the block picker container
And I should find the block search input
And I should find the "All" category button
And I should find block items with dynamic selectors
And I should find category selectors
```

```gherkin:es
Scenario: Editor de posts tiene selectores de block picker

Given estoy logueado como usuario valido
And creo un nuevo post
Then deberia encontrar el contenedor del block picker
And deberia encontrar el input de busqueda de bloques
And deberia encontrar el boton de categoria "All"
And deberia encontrar items de bloque con selectores dinamicos
And deberia encontrar selectores de categoria
```

---

## @test SEL_PTED_004: Block Canvas Selectors

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** posts, canvas, empty-state
- **Grep:** `@ui-selectors` `@SEL_PTED_004`
- **Status:** Active

---

## @test SEL_PTED_005: Settings Panel Selectors

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** posts, settings, panel
- **Grep:** `@ui-selectors` `@SEL_PTED_005`
- **Status:** Active

---

## @test SEL_PTED_006: Status Selector

### Metadata
- **Priority:** Medium
- **Type:** Selector Validation
- **Tags:** posts, status, draft, published
- **Grep:** `@ui-selectors` `@SEL_PTED_006`
- **Status:** Active

---

## @test SEL_PTED_007: Block Manipulation Selectors

### Metadata
- **Priority:** Medium
- **Type:** Selector Validation
- **Tags:** posts, blocks, preview, controls
- **Grep:** `@ui-selectors` `@SEL_PTED_007`
- **Status:** Partial - sortable-block skipped

---

## @test SEL_PTED_008: Post-Specific Selectors

### Metadata
- **Priority:** Medium
- **Type:** Selector Validation
- **Tags:** posts, excerpt, featured-image
- **Grep:** `@ui-selectors` `@SEL_PTED_008`
- **Status:** Partial - categories/locale skipped

---

## @test SEL_PTED_009: Edit Existing Post

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** posts, edit, existing
- **Grep:** `@ui-selectors` `@SEL_PTED_009`
- **Status:** Active
