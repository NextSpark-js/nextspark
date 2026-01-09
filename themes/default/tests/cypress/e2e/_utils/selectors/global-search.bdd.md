---
feature: Global Search UI Selectors Validation
priority: medium
tags: [selectors, search, modal, ui-validation]
grepTags: [ui-selectors, search, SEL_GSRCH_001, SEL_GSRCH_002, SEL_GSRCH_003]
coverage: 3
---

# Global Search UI Selectors Validation

> Validates that global search component selectors exist in the DOM. This is a lightweight test that ONLY checks selector presence, not functionality. Most selectors require the search modal to be open.

## @test SEL_GSRCH_001: Search Trigger

### Metadata
- **Priority:** Medium
- **Type:** Selector Validation
- **Tags:** search, trigger, button
- **Grep:** `@ui-selectors` `@SEL_GSRCH_001`
- **Status:** Skipped - selector not implemented

```gherkin:en
Scenario: Search trigger button is accessible

Given I am logged in as a valid user
And I navigate to the dashboard
Then I should find the search trigger button
```

```gherkin:es
Scenario: Boton de trigger de busqueda es accesible

Given estoy logueado como usuario valido
And navego al dashboard
Then deberia encontrar el boton de trigger de busqueda
```

### Expected Results
- `global-search-trigger` selector exists

---

## @test SEL_GSRCH_002: Search Modal (when open)

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** search, modal, input
- **Grep:** `@ui-selectors` `@SEL_GSRCH_002`
- **Status:** Partial - 1 passing, 3 skipped

```gherkin:en
Scenario: Search modal has required components when opened

Given I am logged in as a valid user
And I navigate to the dashboard
When I press Cmd+K to open the search modal
Then I should find the search modal container
And I should find the search input
And I should find the search results container (when query entered)
And I should find search result items (when results available)
```

```gherkin:es
Scenario: Modal de busqueda tiene componentes requeridos cuando esta abierto

Given estoy logueado como usuario valido
And navego al dashboard
When presiono Cmd+K para abrir el modal de busqueda
Then deberia encontrar el contenedor del modal de busqueda
And deberia encontrar el input de busqueda
And deberia encontrar el contenedor de resultados (cuando hay query)
And deberia encontrar items de resultados (cuando hay resultados)
```

### Expected Results
- `global-search-modal` skipped - selector not implemented
- `global-search-input` selector exists (WORKING)
- `global-search-results` skipped - requires search query
- `global-search-result` skipped - requires results

---

## @test SEL_GSRCH_003: Search Modal (opened via click)

### Metadata
- **Priority:** Low
- **Type:** Selector Validation
- **Tags:** search, modal, click
- **Grep:** `@ui-selectors` `@SEL_GSRCH_003`
- **Status:** Skipped - trigger selector not implemented

```gherkin:en
Scenario: Search modal opens via click on trigger

Given I am logged in as a valid user
And I navigate to the dashboard
When I click on the search trigger button
Then the search modal should open
And I should find the search input
```

```gherkin:es
Scenario: Modal de busqueda se abre via click en trigger

Given estoy logueado como usuario valido
And navego al dashboard
When hago click en el boton de trigger de busqueda
Then el modal de busqueda deberia abrirse
And deberia encontrar el input de busqueda
```

### Expected Results
- Search modal opens when trigger is clicked
- `global-search-input` selector exists inside modal
