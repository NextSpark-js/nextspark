---
feature: API-Aware Testing Pattern
priority: medium
tags: [posts, categories, api-aware, patterns, testing]
grepTags: [uat, feat-posts, api, patterns]
coverage: 3
---

# API-Aware Testing Pattern - Demo

> Test suite demonstrating API-aware POM patterns for deterministic waits instead of arbitrary delays. Shows how to replace `cy.wait(ms)` with API intercepts for more reliable and faster tests.

## Background

```gherkin:en
Given I am logged in as Owner (owner@nextspark.dev)
And I have the ApiInterceptor utility available
And deterministic API waits replace arbitrary delays
```

```gherkin:es
Given estoy logueado como Owner (owner@nextspark.dev)
And tengo la utilidad ApiInterceptor disponible
And las esperas deterministicas de API reemplazan delays arbitrarios
```

---

## @test APIAWARE-001: Navigate with deterministic API wait

### Metadata
- **Priority:** High
- **Type:** Smoke
- **Tags:** navigation, api-wait, patterns
- **Grep:** `@smoke`

```gherkin:en
Scenario: Navigate with deterministic API wait

Given I am logged in as Owner
When I use the API-aware navigation method
Then the page should be visible
And at least 1 category row should exist

Note: This replaces the pattern:
  visitCategoriesPage() + waitForPageLoad() + cy.wait(2000)
With:
  visitWithApiWait()
```

```gherkin:es
Scenario: Navegar con espera deterministica de API

Given estoy logueado como Owner
When uso el metodo de navegacion consciente de API
Then la pagina deberia estar visible
And al menos 1 fila de categoria deberia existir

Nota: Esto reemplaza el patron:
  visitCategoriesPage() + waitForPageLoad() + cy.wait(2000)
Con:
  visitWithApiWait()
```

### Expected Results
- Navigation completes with API wait
- Page loads with data from API response
- No arbitrary delays needed
- Test is faster and more reliable

---

## @test APIAWARE-002: Create category with deterministic waits

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** crud, create, api-wait

```gherkin:en
Scenario: Create category with deterministic waits

Given I am logged in as Owner
And I have navigated with API wait
When I create a category using the API-aware method
Then the category should appear in the list

Note: This replaces the pattern:
  createCategory() + cy.wait(2000)
With:
  createCategoryWithApiWait()
```

```gherkin:es
Scenario: Crear categoria con esperas deterministicas

Given estoy logueado como Owner
And he navegado con espera de API
When creo una categoria usando el metodo consciente de API
Then la categoria deberia aparecer en la lista

Nota: Esto reemplaza el patron:
  createCategory() + cy.wait(2000)
Con:
  createCategoryWithApiWait()
```

### Expected Results
- Create operation waits for POST response
- List refreshes after create
- New category appears in list
- No arbitrary delays needed

---

## @test APIAWARE-003: Direct ApiInterceptor usage for custom flows

### Metadata
- **Priority:** Medium
- **Type:** Regression
- **Tags:** api-interceptor, custom-flow, manual-setup

```gherkin:en
Scenario: Direct ApiInterceptor usage

Given I am logged in as Owner
And I have setup API intercepts manually
When I navigate to categories page
And I wait for the page to load
And I wait for the initial list via api.waitForList()
And I open the create dialog
And I fill the form with test data
And I save the category
And I wait for create via api.waitForCreate()
And I wait for refresh via api.waitForRefresh()
And the dialog closes
Then the category should be visible in the list
```

```gherkin:es
Scenario: Uso directo de ApiInterceptor

Given estoy logueado como Owner
And he configurado intercepts de API manualmente
When navego a la pagina de categorias
And espero que la pagina cargue
And espero la lista inicial via api.waitForList()
And abro el dialogo de crear
And completo el formulario con datos de prueba
And guardo la categoria
And espero create via api.waitForCreate()
And espero refresh via api.waitForRefresh()
And el dialogo cierra
Then la categoria deberia estar visible en la lista
```

### Expected Results
- Manual API intercept setup works
- Each wait method targets specific API call
- Full control over wait timing
- Complex flows can be orchestrated with precision
