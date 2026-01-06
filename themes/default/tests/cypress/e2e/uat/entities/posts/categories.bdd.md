---
feature: Post Category Management
priority: high
tags: [posts, categories, crud, icons, colors]
grepTags: [uat, feat-posts, feat-categories]
coverage: 10
---

# Post Categories - Admin UI

> Test suite for managing post categories. Covers full CRUD operations plus visual features like colors and icons display.

## Background

```gherkin:en
Given I am logged in as Owner (owner@nextspark.dev)
And I have navigated to the Categories page
And the categories list has loaded successfully
```

```gherkin:es
Given estoy logueado como Owner (owner@nextspark.dev)
And he navegado a la pagina de Categorias
And la lista de categorias ha cargado exitosamente
```

---

## @test CAT-001: Navigate to categories page

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** navigation, page-load
- **Grep:** `@smoke`

```gherkin:en
Scenario: Navigate to categories page

Given I am logged in as Owner
When I navigate to the categories page
And the API returns the categories
Then the page should be visible
```

```gherkin:es
Scenario: Navegar a pagina de categorias

Given estoy logueado como Owner
When navego a la pagina de categorias
And la API retorna las categorias
Then la pagina deberia estar visible
```

### Expected Results
- Categories page is accessible
- Page loads successfully
- API returns category data

---

## @test CAT-002: Display categories in list

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** list, display, table

```gherkin:en
Scenario: Display categories in list

Given I am on the categories page
Then the list should have at least 1 category row
```

```gherkin:es
Scenario: Mostrar categorias en lista

Given estoy en la pagina de categorias
Then la lista deberia tener al menos 1 fila de categoria
```

### Expected Results
- Categories list displays correctly
- At least one category row is visible
- Table structure is correct

---

## @test CAT-003: Open create category dialog

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** create, dialog, ui

```gherkin:en
Scenario: Open create category dialog

Given I am on the categories page
When I click the create button
And I wait for the dialog to open
Then the dialog should be visible
```

```gherkin:es
Scenario: Abrir dialogo de crear categoria

Given estoy en la pagina de categorias
When hago clic en el boton crear
And espero que el dialogo abra
Then el dialogo deberia estar visible
```

### Expected Results
- Create button is visible and clickable
- Dialog opens correctly
- Form fields are displayed

---

## @test CAT-004: Create a new category

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** create, form, crud
- **Grep:** `@smoke`

```gherkin:en
Scenario: Create a new category

Given I am on the categories page
When I click the create button
And the dialog opens
And I fill the name with a unique value
And I fill the slug with a unique value
And I save the category
And I wait for the API create response
And the dialog closes
Then the new category should appear in the list
```

```gherkin:es
Scenario: Crear una nueva categoria

Given estoy en la pagina de categorias
When hago clic en el boton crear
And el dialogo abre
And completo el nombre con un valor unico
And completo el slug con un valor unico
And guardo la categoria
And espero la respuesta de API create
And el dialogo cierra
Then la nueva categoria deberia aparecer en la lista
```

### Expected Results
- Category creation form works correctly
- Name and slug fields accept input
- Save operation completes successfully
- New category appears in list
- Dialog closes after save

---

## @test CAT-005: Validate slug field accessibility

### Metadata
- **Priority:** Medium
- **Type:** Regression
- **Tags:** form, validation, slug

```gherkin:en
Scenario: Slug field accessibility

Given I am on the categories page
When I click the create button
And the dialog opens
And I fill only the name field
Then the slug input should be visible
When I cancel the form
Then the dialog should close
```

```gherkin:es
Scenario: Accesibilidad del campo slug

Given estoy en la pagina de categorias
When hago clic en el boton crear
And el dialogo abre
And completo solo el campo nombre
Then el input de slug deberia estar visible
When cancelo el formulario
Then el dialogo deberia cerrarse
```

### Expected Results
- Slug field is visible and accessible
- Form can be cancelled
- Dialog closes on cancel

---

## @test CAT-006: Edit an existing category

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** edit, update, crud

```gherkin:en
Scenario: Edit existing category

Given I am on the categories page
When I click the edit button on the first row
And the dialog opens
And I update the name with a unique value
And I save the category
And I wait for the API update response
And the dialog closes
Then the updated name should be visible in the list
```

```gherkin:es
Scenario: Editar categoria existente

Given estoy en la pagina de categorias
When hago clic en el boton editar de la primera fila
And el dialogo abre
And actualizo el nombre con un valor unico
And guardo la categoria
And espero la respuesta de API update
And el dialogo cierra
Then el nombre actualizado deberia estar visible en la lista
```

### Expected Results
- Edit button is accessible
- Edit dialog opens with pre-filled data
- Name can be updated
- Changes are saved correctly
- Updated data reflects in list

---

## @test CAT-007: Delete a category

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** delete, crud, confirmation

```gherkin:en
Scenario: Delete a category

Given I am on the categories page
And I have created a test category via API
And the test category is visible in the list
When I click the delete button on the test category row
And I confirm the deletion
And I wait for the API delete response
Then the category should no longer be in the list
```

```gherkin:es
Scenario: Eliminar una categoria

Given estoy en la pagina de categorias
And he creado una categoria de prueba via API
And la categoria de prueba esta visible en la lista
When hago clic en el boton eliminar de la fila de categoria de prueba
And confirmo la eliminacion
And espero la respuesta de API delete
Then la categoria ya no deberia estar en la lista
```

### Expected Results
- Delete button is accessible
- Confirmation dialog appears
- Category is deleted after confirmation
- Category no longer appears in list

---

## @test CAT-008: Cancel category deletion

### Metadata
- **Priority:** Medium
- **Type:** Regression
- **Tags:** delete, cancel, dialog

```gherkin:en
Scenario: Cancel category deletion

Given I am on the categories page
When I click the delete button on the first row
And the confirmation dialog appears
And I click cancel
Then the dialog should close
And at least 1 category should remain in the list
```

```gherkin:es
Scenario: Cancelar eliminacion de categoria

Given estoy en la pagina de categorias
When hago clic en el boton eliminar de la primera fila
And el dialogo de confirmacion aparece
And hago clic en cancelar
Then el dialogo deberia cerrarse
And al menos 1 categoria deberia permanecer en la lista
```

### Expected Results
- Confirmation dialog has cancel option
- Cancelling closes dialog
- Category is NOT deleted
- List remains unchanged

---

## @test CAT-009: Display category colors in table

### Metadata
- **Priority:** Medium
- **Type:** Regression
- **Tags:** colors, display, visual

```gherkin:en
Scenario: Display category colors

Given I am on the categories page
Then the table should contain elements with background or color styles
```

```gherkin:es
Scenario: Mostrar colores de categoria

Given estoy en la pagina de categorias
Then la tabla deberia contener elementos con estilos de background o color
```

### Expected Results
- Color badges are displayed
- Categories show their assigned colors
- Visual styling is applied correctly

---

## @test CAT-010: Display category icons in table

### Metadata
- **Priority:** Medium
- **Type:** Regression
- **Tags:** icons, display, visual

```gherkin:en
Scenario: Display category icons

Given I am on the categories page
Then the table should contain SVG or icon elements
```

```gherkin:es
Scenario: Mostrar iconos de categoria

Given estoy en la pagina de categorias
Then la tabla deberia contener elementos SVG o iconos
```

### Expected Results
- Icon elements are displayed
- Categories show their assigned icons
- SVG or icon components render correctly
