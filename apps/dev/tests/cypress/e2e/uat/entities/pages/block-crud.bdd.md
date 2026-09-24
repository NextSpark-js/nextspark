---
feature: Block CRUD Operations
priority: high
tags: [page-builder, blocks, crud, admin]
grepTags: [uat, feat-pages, block-crud, page-builder, regression]
coverage: 14
---

# Block CRUD Operations

> Comprehensive test suite for block creation, editing, duplication, removal, and reordering in the Page Builder.

## @test PB-BLOCK-001: Add Hero block

### Metadata
- **Priority:** High
- **Type:** Smoke
- **Tags:** add, hero
- **Grep:** `@smoke`

```gherkin:en
Scenario: Add Hero block to empty canvas

Given I am logged in as Owner
And I have created a test page via API
When I visit the page editor
And I switch to Layout mode
And the canvas is empty
And I add a "hero" block
Then the block count should be 1
```

```gherkin:es
Scenario: Agregar bloque Hero al canvas vacío

Given estoy logueado como Owner
And he creado una página de prueba via API
When visito el editor de páginas
And cambio al modo Layout
And el canvas está vacío
And agrego un bloque "hero"
Then la cantidad de bloques debería ser 1
```

### Expected Results
- Hero block appears on canvas
- Block count updates to 1
- Block is selectable

---

## @test PB-BLOCK-002: Add Features Grid block

### Metadata
- **Priority:** Medium
- **Type:** Regression
- **Tags:** add, features-grid

```gherkin:en
Scenario: Add Features Grid block

Given I am on the page editor in Layout mode
When I add a "features-grid" block
Then the block count should be 1
```

```gherkin:es
Scenario: Agregar bloque Features Grid

Given estoy en el editor de páginas en modo Layout
When agrego un bloque "features-grid"
Then la cantidad de bloques debería ser 1
```

### Expected Results
- Features Grid block appears on canvas
- Default grid items are displayed

---

## @test PB-BLOCK-003: Add CTA Section block

### Metadata
- **Priority:** Medium
- **Type:** Regression
- **Tags:** add, cta-section

```gherkin:en
Scenario: Add CTA Section block

Given I am on the page editor in Layout mode
When I add a "cta-section" block
Then the block count should be 1
```

```gherkin:es
Scenario: Agregar bloque CTA Section

Given estoy en el editor de páginas en modo Layout
When agrego un bloque "cta-section"
Then la cantidad de bloques debería ser 1
```

### Expected Results
- CTA Section block appears on canvas
- Default CTA content is visible

---

## @test PB-BLOCK-004: Add Testimonials block

### Metadata
- **Priority:** Medium
- **Type:** Regression
- **Tags:** add, testimonials

```gherkin:en
Scenario: Add Testimonials block

Given I am on the page editor in Layout mode
When I add a "testimonials" block
Then the block count should be 1
```

```gherkin:es
Scenario: Agregar bloque Testimonials

Given estoy en el editor de páginas en modo Layout
When agrego un bloque "testimonials"
Then la cantidad de bloques debería ser 1
```

### Expected Results
- Testimonials block appears on canvas
- Default testimonial items are shown

---

## @test PB-BLOCK-005: Add Text Content block

### Metadata
- **Priority:** Medium
- **Type:** Regression
- **Tags:** add, text-content

```gherkin:en
Scenario: Add Text Content block

Given I am on the page editor in Layout mode
When I add a "text-content" block
Then the block count should be 1
```

```gherkin:es
Scenario: Agregar bloque Text Content

Given estoy en el editor de páginas en modo Layout
When agrego un bloque "text-content"
Then la cantidad de bloques debería ser 1
```

### Expected Results
- Text Content block appears on canvas
- Default text placeholder is visible

---

## @test PB-BLOCK-006: Add multiple blocks

### Metadata
- **Priority:** High
- **Type:** Smoke
- **Tags:** add, multiple
- **Grep:** `@smoke`

```gherkin:en
Scenario: Add multiple blocks to canvas

Given I am on the page editor in Layout mode
When I add a "hero" block
And I add a "features-grid" block
And I add a "cta-section" block
Then the block count should be 3
```

```gherkin:es
Scenario: Agregar múltiples bloques al canvas

Given estoy en el editor de páginas en modo Layout
When agrego un bloque "hero"
And agrego un bloque "features-grid"
And agrego un bloque "cta-section"
Then la cantidad de bloques debería ser 3
```

### Expected Results
- All three blocks appear on canvas
- Blocks are in correct order
- Block count shows 3

---

## @test PB-BLOCK-007: Edit block title prop

### Metadata
- **Priority:** High
- **Type:** Smoke
- **Tags:** edit, props, title
- **Grep:** `@smoke`

```gherkin:en
Scenario: Edit block properties

Given I am on the page editor with a hero block
When I locate the title field in settings panel
And I change the title to "Custom Hero Title"
And I save the page
Then the API should confirm the update
And the block should have the new title
```

```gherkin:es
Scenario: Editar propiedades del bloque

Given estoy en el editor de páginas con un bloque hero
When localizo el campo título en el panel de configuración
And cambio el título a "Custom Hero Title"
And guardo la página
Then la API debería confirmar la actualización
And el bloque debería tener el nuevo título
```

### Expected Results
- Settings panel shows title field
- Title change is reflected in preview
- Save completes successfully
- API confirms the update

---

## @test PB-BLOCK-008: Duplicate existing block

### Metadata
- **Priority:** Medium
- **Type:** Regression
- **Tags:** duplicate

```gherkin:en
Scenario: Duplicate a block

Given I am on the page editor with a hero block
And the block count is 1
When I get the block ID
And I duplicate the block
Then the block count should be 2
```

```gherkin:es
Scenario: Duplicar un bloque

Given estoy en el editor de páginas con un bloque hero
And la cantidad de bloques es 1
When obtengo el ID del bloque
And duplico el bloque
Then la cantidad de bloques debería ser 2
```

### Expected Results
- Duplicate button is accessible
- New block appears after original
- Block count updates to 2
- Duplicated block has same properties

---

## @test PB-BLOCK-009: Remove block from canvas

### Metadata
- **Priority:** High
- **Type:** Smoke
- **Tags:** remove, delete
- **Grep:** `@smoke`

```gherkin:en
Scenario: Remove a block from canvas

Given I am on the page editor with a hero block
And the block count is 1
When I get the block ID
And I remove the block
Then the canvas should be empty
```

```gherkin:es
Scenario: Eliminar un bloque del canvas

Given estoy en el editor de páginas con un bloque hero
And la cantidad de bloques es 1
When obtengo el ID del bloque
And elimino el bloque
Then el canvas debería estar vacío
```

### Expected Results
- Remove button is accessible
- Block is removed from canvas
- Canvas shows empty state
- No orphan data remains

---

## @test PB-BLOCK-010: Reorder blocks with drag and drop

### Metadata
- **Priority:** Medium
- **Type:** Regression
- **Tags:** reorder, drag-drop, layout-mode

```gherkin:en
Scenario: Reorder blocks with drag and drop

Given I am on the page editor in Layout mode
And I have added a "hero" block
And I have added a "cta-section" block
Then the first block should contain "hero"
And there should be 2 sortable blocks ready for reordering
```

```gherkin:es
Scenario: Reordenar bloques con arrastrar y soltar

Given estoy en el editor de páginas en modo Layout
And he agregado un bloque "hero"
And he agregado un bloque "cta-section"
Then el primer bloque debería contener "hero"
And debería haber 2 bloques ordenables listos para reordenar
```

### Expected Results
- Both blocks are visible
- Drag handles are present
- Blocks can be reordered
- Order persists after save

---

## @test PB-BLOCK-011: Reorder blocks with move buttons

### Metadata
- **Priority:** Medium
- **Type:** Regression
- **Tags:** reorder, buttons, preview-mode

```gherkin:en
Scenario: Reorder blocks with move buttons in Preview mode

Given I am on the page editor with multiple blocks
And I switch to Preview mode
When I hover over the first block
And I click the "move down" button
Then the block should move down
```

```gherkin:es
Scenario: Reordenar bloques con botones en modo Preview

Given estoy en el editor de páginas con múltiples bloques
And cambio al modo Preview
When paso el mouse sobre el primer bloque
And hago clic en el botón "mover abajo"
Then el bloque debería moverse abajo
```

### Expected Results
- Move buttons appear on hover
- Move down button is clickable
- Block moves to new position
- Other blocks adjust accordingly

---

## @test PB-BLOCK-012: Move up disabled for first block

### Metadata
- **Priority:** Low
- **Type:** Regression
- **Tags:** reorder, buttons, disabled

```gherkin:en
Scenario: Move up disabled for first block

Given I am on the page editor with multiple blocks
And I switch to Preview mode
When I hover over the first block
Then the "move up" button should be disabled
```

```gherkin:es
Scenario: Mover arriba deshabilitado para primer bloque

Given estoy en el editor de páginas con múltiples bloques
And cambio al modo Preview
When paso el mouse sobre el primer bloque
Then el botón "mover arriba" debería estar deshabilitado
```

### Expected Results
- Move up button is visually disabled
- Button is not clickable
- Move down button is still active

---

## @test PB-BLOCK-013: Reset block props to defaults

### Metadata
- **Priority:** Low
- **Type:** Regression
- **Tags:** reset, props, defaults

```gherkin:en
Scenario: Reset block properties to defaults

Given I am on the page editor with a hero block
And I have modified the title field
When I click the "reset props" button
Then the block properties should reset to defaults
```

```gherkin:es
Scenario: Resetear propiedades del bloque a valores por defecto

Given estoy en el editor de páginas con un bloque hero
And he modificado el campo título
When hago clic en el botón "resetear props"
Then las propiedades del bloque deberían resetearse a valores por defecto
```

### Expected Results
- Reset button is accessible
- Confirmation dialog appears (if any)
- All props return to default values
- Block updates in preview

---

## @test PB-BLOCK-014: Add items to array field

### Metadata
- **Priority:** Medium
- **Type:** Regression
- **Tags:** array, fields, add-item

```gherkin:en
Scenario: Add items to array field

Given I am on the page editor with a features-grid block
When I locate the array add button
And I click to add an item
Then at least 1 item should exist in the array
```

```gherkin:es
Scenario: Agregar items al campo array

Given estoy en el editor de páginas con un bloque features-grid
When localizo el botón agregar del array
And hago clic para agregar un item
Then al menos 1 item debería existir en el array
```

### Expected Results
- Add item button is visible
- New item appears in array
- Item can be edited
- Array count updates
