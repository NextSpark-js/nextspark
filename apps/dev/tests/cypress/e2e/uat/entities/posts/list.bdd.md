---
feature: Posts List Management
priority: high
tags: [posts, list, search, filter, navigation]
grepTags: [uat, feat-posts, list]
coverage: 10
---

# Posts List - Admin UI

> Test suite for managing posts from the list view. Covers navigation, search, filtering by category and status, category badges display, and action buttons accessibility.

## Background

```gherkin:en
Given I am logged in as Owner (owner@nextspark.dev)
And I have navigated to the Posts list
And the posts list has loaded successfully
```

```gherkin:es
Given estoy logueado como Owner (owner@nextspark.dev)
And he navegado a la lista de Posts
And la lista de posts ha cargado exitosamente
```

---

## @test POST-LIST-001: Navigate to posts list

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** navigation, page-load
- **Grep:** `@smoke`

```gherkin:en
Scenario: Navigate to posts list

Given I am logged in as Owner
When I navigate to the posts list
And the API returns the posts
Then the list page should be visible
```

```gherkin:es
Scenario: Navegar a lista de posts

Given estoy logueado como Owner
When navego a la lista de posts
And la API retorna los posts
Then la pagina de lista deberia estar visible
```

### Expected Results
- Posts list page is accessible
- Page loads successfully
- API returns posts data

---

## @test POST-LIST-002: Navigate to create post from list

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** navigation, create-button

```gherkin:en
Scenario: Navigate to create post

Given I am on the posts list
When I click the create post button
Then the URL should include /dashboard/posts/create
```

```gherkin:es
Scenario: Navegar a crear post

Given estoy en la lista de posts
When hago clic en el boton crear post
Then la URL deberia incluir /dashboard/posts/create
```

### Expected Results
- Create button is visible
- Clicking navigates to create page
- URL reflects the create route

---

## @test POST-LIST-003: Display sample posts in list

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** list, display, sample-data

```gherkin:en
Scenario: Display sample posts

Given I am on the posts list
Then posts containing "Welcome" should be visible
```

```gherkin:es
Scenario: Mostrar posts de ejemplo

Given estoy en la lista de posts
Then los posts que contienen "Welcome" deberian estar visibles
```

### Expected Results
- Sample posts are displayed
- Posts with "Welcome" are visible
- List shows expected data

---

## @test POST-LIST-004: Search posts by title

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** search, filter, title

```gherkin:en
Scenario: Search posts by title

Given I am on the posts list
When I search for "Welcome"
And the API returns filtered results
Then posts matching "Welcome" should be visible
```

```gherkin:es
Scenario: Buscar posts por titulo

Given estoy en la lista de posts
When busco "Welcome"
And la API retorna resultados filtrados
Then los posts que coinciden con "Welcome" deberian estar visibles
```

### Expected Results
- Search input is available
- Search query filters results
- Matching posts are displayed

---

## @test POST-LIST-005: Clear search and show all posts

### Metadata
- **Priority:** Medium
- **Type:** Regression
- **Tags:** search, clear, reset

```gherkin:en
Scenario: Clear search filter

Given I am on the posts list
And I have performed a search
When I clear the search field
And the API returns all posts
Then at least 1 post should be visible
```

```gherkin:es
Scenario: Limpiar filtro de busqueda

Given estoy en la lista de posts
And he realizado una busqueda
When limpio el campo de busqueda
And la API retorna todos los posts
Then al menos 1 post deberia estar visible
```

### Expected Results
- Search can be cleared
- All posts return after clearing
- List refreshes correctly

---

## @test POST-LIST-006: Filter posts by category

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** filter, category

```gherkin:en
Scenario: Filter posts by category

Given I am on the posts list
And the category filter exists
When I filter by "News" category
And the API returns filtered results
Then only posts with "News" category badge should be visible
```

```gherkin:es
Scenario: Filtrar posts por categoria

Given estoy en la lista de posts
And el filtro de categoria existe
When filtro por categoria "News"
And la API retorna resultados filtrados
Then solo los posts con badge de categoria "News" deberian estar visibles
```

### Expected Results
- Category filter is available
- Filter can be applied
- Only matching category posts are shown

---

## @test POST-LIST-007: Filter posts by published status

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** filter, status, published

```gherkin:en
Scenario: Filter posts by status

Given I am on the posts list
And the status filter exists
When I filter by "published" status
And the API returns filtered results
Then the table should display posts
```

```gherkin:es
Scenario: Filtrar posts por estado

Given estoy en la lista de posts
And el filtro de estado existe
When filtro por estado "published"
And la API retorna resultados filtrados
Then la tabla deberia mostrar posts
```

### Expected Results
- Status filter is available
- Filter by published status works
- Filtered results display correctly

---

## @test POST-LIST-008: Display category badges with colors

### Metadata
- **Priority:** Medium
- **Type:** Regression
- **Tags:** badges, colors, visual

```gherkin:en
Scenario: Display category badges with colors

Given I am on the posts list
Then the table should contain badge elements
And badges should have background colors
```

```gherkin:es
Scenario: Mostrar badges de categoria con colores

Given estoy en la lista de posts
Then la tabla deberia contener elementos badge
And los badges deberian tener colores de fondo
```

### Expected Results
- Category badges are displayed
- Badges have background colors
- Visual styling is applied correctly

---

## @test POST-LIST-009: Edit action available

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** actions, edit, button

```gherkin:en
Scenario: Edit action availability

Given I am on the posts list
When I look at the first row
Then edit action button should exist
```

```gherkin:es
Scenario: Disponibilidad de accion editar

Given estoy en la lista de posts
When miro la primera fila
Then el boton de accion editar deberia existir
```

### Expected Results
- Edit button is present in row
- Action is accessible
- Button is clickable

---

## @test POST-LIST-010: Delete action available

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** actions, delete, button

```gherkin:en
Scenario: Delete action availability

Given I am on the posts list
When I look at the first row
Then delete action button should exist
```

```gherkin:es
Scenario: Disponibilidad de accion eliminar

Given estoy en la lista de posts
When miro la primera fila
Then el boton de accion eliminar deberia existir
```

### Expected Results
- Delete button is present in row
- Action is accessible
- Button is clickable
