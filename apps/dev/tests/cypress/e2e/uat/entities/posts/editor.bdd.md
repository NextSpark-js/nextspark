---
feature: Post Editor Interface
priority: high
tags: [posts, editor, form, blocks, categories]
grepTags: [uat, feat-posts, editor]
coverage: 12
---

# Post Editor - Admin UI

> Test suite for the post editor interface. Covers loading create/edit editors, filling form fields, using block picker with scope filtering, adding/removing blocks, selecting categories, and saving drafts.

## Background

```gherkin:en
Given I am logged in as Owner (owner@nextspark.dev)
And I have navigated to the Post Editor
And the editor has loaded successfully
```

```gherkin:es
Given estoy logueado como Owner (owner@nextspark.dev)
And he navegado al Editor de Posts
And el editor ha cargado exitosamente
```

---

## @test POST-EDITOR-001: Load create post editor

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** editor, load, create
- **Grep:** `@smoke`

```gherkin:en
Scenario: Load create post editor

Given I am logged in as Owner
When I visit /dashboard/posts/create
And I wait for the editor to load
Then the editor should be visible
```

```gherkin:es
Scenario: Cargar editor de crear post

Given estoy logueado como Owner
When visito /dashboard/posts/create
And espero que el editor cargue
Then el editor deberia estar visible
```

### Expected Results
- Create post URL is accessible
- Editor loads successfully
- Editor component is visible

---

## @test POST-EDITOR-002: Load edit post editor

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** editor, load, edit

```gherkin:en
Scenario: Load edit post editor

Given I am logged in as Owner
And I am on the posts list
When I click the edit action on the first post
Then the URL should include /edit
And the editor should be visible
```

```gherkin:es
Scenario: Cargar editor de editar post

Given estoy logueado como Owner
And estoy en la lista de posts
When hago clic en la accion editar del primer post
Then la URL deberia incluir /edit
And el editor deberia estar visible
```

### Expected Results
- Edit action navigates to edit page
- URL contains /edit
- Editor loads with post data

---

## @test POST-EDITOR-003: Display all required form fields

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** form, fields, validation

```gherkin:en
Scenario: Display required form fields

Given I am on the create post editor
Then the title input should be visible
And the slug input should be visible
And the excerpt input should be visible
And the featured image input should be visible
And the categories select should be visible
```

```gherkin:es
Scenario: Mostrar campos de formulario requeridos

Given estoy en el editor de crear post
Then el input de titulo deberia estar visible
And el input de slug deberia estar visible
And el input de extracto deberia estar visible
And el input de imagen destacada deberia estar visible
And el select de categorias deberia estar visible
```

### Expected Results
- Title input is present
- Slug input is present
- Excerpt textarea is present
- Featured image field is present
- Categories selector is present

---

## @test POST-EDITOR-004: Fill title and slug

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** form, title, slug

```gherkin:en
Scenario: Fill title and slug fields

Given I am on the create post editor
When I set the title to "Test Post"
And I set the slug to "test-post"
Then the title should have value "Test Post"
And the slug should have value "test-post"
```

```gherkin:es
Scenario: Completar campos titulo y slug

Given estoy en el editor de crear post
When establezco el titulo como "Test Post"
And establezco el slug como "test-post"
Then el titulo deberia tener valor "Test Post"
And el slug deberia tener valor "test-post"
```

### Expected Results
- Title field accepts input
- Slug field accepts input
- Values are correctly set

---

## @test POST-EDITOR-005: Fill excerpt field

### Metadata
- **Priority:** Medium
- **Type:** Regression
- **Tags:** form, excerpt, textarea

```gherkin:en
Scenario: Fill excerpt field

Given I am on the create post editor
When I set the excerpt to "This is a test excerpt for the post."
Then the excerpt should have the entered value
```

```gherkin:es
Scenario: Completar campo de extracto

Given estoy en el editor de crear post
When establezco el extracto como "This is a test excerpt for the post."
Then el extracto deberia tener el valor ingresado
```

### Expected Results
- Excerpt textarea accepts input
- Value is correctly set
- Multi-line text is supported

---

## @test POST-EDITOR-006: Fill featured image field

### Metadata
- **Priority:** Medium
- **Type:** Regression
- **Tags:** form, image, url

```gherkin:en
Scenario: Fill featured image field

Given I am on the create post editor
When I set the featured image URL to "https://example.com/image.jpg"
Then the featured image input should have the URL value
```

```gherkin:es
Scenario: Completar campo de imagen destacada

Given estoy en el editor de crear post
When establezco la URL de imagen destacada como "https://example.com/image.jpg"
Then el input de imagen destacada deberia tener el valor de URL
```

### Expected Results
- Featured image field accepts URL
- URL value is correctly set
- Field validates URL format

---

## @test POST-EDITOR-007: Display block picker

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** blocks, picker, ui

```gherkin:en
Scenario: Display block picker

Given I am on the create post editor
And the block picker has loaded
Then the block picker should be visible
```

```gherkin:es
Scenario: Mostrar selector de bloques

Given estoy en el editor de crear post
And el selector de bloques ha cargado
Then el selector de bloques deberia estar visible
```

### Expected Results
- Block picker component loads
- Block picker is visible
- Available blocks are displayed

---

## @test POST-EDITOR-008: Block scope filtering for posts

### Metadata
- **Priority:** Critical
- **Type:** Regression
- **Tags:** blocks, scope, filtering
- **Grep:** `@critical`

```gherkin:en
Scenario: Block scope filtering for posts

Given I am on the create post editor
And the block picker has loaded
Then the "hero" block should be in the picker
And the block count should be 2 or less

Note: Posts have limited block scope - only blocks with
scope: ['pages', 'posts'] are available.
```

```gherkin:es
Scenario: Filtrado de scope de bloques para posts

Given estoy en el editor de crear post
And el selector de bloques ha cargado
Then el bloque "hero" deberia estar en el selector
And la cantidad de bloques deberia ser 2 o menos

Nota: Los posts tienen scope limitado de bloques - solo
bloques con scope: ['pages', 'posts'] estan disponibles.
```

### Expected Results
- Hero block is available for posts
- Block scope filtering works correctly
- Only post-scoped blocks are shown

---

## @test POST-EDITOR-009: Add a hero block

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** blocks, add, hero

```gherkin:en
Scenario: Add hero block to post

Given I am on the create post editor
And the block picker has loaded
When I add a "hero" block
Then the block count should be 1
```

```gherkin:es
Scenario: Agregar bloque hero al post

Given estoy en el editor de crear post
And el selector de bloques ha cargado
When agrego un bloque "hero"
Then la cantidad de bloques deberia ser 1
```

### Expected Results
- Block can be added from picker
- Block appears in editor
- Block count increments correctly

---

## @test POST-EDITOR-010: Remove a block

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** blocks, remove, delete

```gherkin:en
Scenario: Remove block from post

Given I am on the create post editor
And I have added a "hero" block
And the block count is 1
When I get the block ID
And I remove the block
Then the block count should be 0
```

```gherkin:es
Scenario: Eliminar bloque del post

Given estoy en el editor de crear post
And he agregado un bloque "hero"
And la cantidad de bloques es 1
When obtengo el ID del bloque
And elimino el bloque
Then la cantidad de bloques deberia ser 0
```

### Expected Results
- Block can be removed
- Block disappears from editor
- Block count decrements correctly

---

## @test POST-EDITOR-011: Display and toggle categories

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** categories, select, toggle

```gherkin:en
Scenario: Category selection toggle

Given I am on the create post editor
Then the categories select should have at least 1 category
When I click on the first category
Then the category should become selected (have bg-primary class)
```

```gherkin:es
Scenario: Toggle de seleccion de categoria

Given estoy en el editor de crear post
Then el select de categorias deberia tener al menos 1 categoria
When hago clic en la primera categoria
Then la categoria deberia quedar seleccionada (tener clase bg-primary)
```

### Expected Results
- Categories are displayed
- Categories can be clicked
- Selection state updates visually

---

## @test POST-EDITOR-012: Save a draft post

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** save, draft, form

```gherkin:en
Scenario: Save draft post

Given I am on the create post editor
When I set the title to "Draft Test Post"
And I set the slug to "draft-test-post"
And I save the post
And I wait for the API create response
Then the URL should include /dashboard/posts
```

```gherkin:es
Scenario: Guardar borrador de post

Given estoy en el editor de crear post
When establezco el titulo como "Draft Test Post"
And establezco el slug como "draft-test-post"
And guardo el post
And espero la respuesta de API create
Then la URL deberia incluir /dashboard/posts
```

### Expected Results
- Post can be saved as draft
- API create request completes
- Redirect to posts list after save
