---
feature: Block Editor UI Selectors Validation
priority: high
tags: [selectors, block-editor, page-builder, ui-validation]
grepTags: [ui-selectors, block-editor, selector-validation, SEL_BE_001, SEL_BE_002, SEL_BE_003, SEL_BE_004, SEL_BE_005, SEL_BE_006, SEL_BE_007]
coverage: 7
---

# Block Editor UI Selectors Validation

> Comprehensive test suite validating ALL selectors in BlockEditorBasePOM. Uses the `pages` entity as the test base. Validates selector presence across all block editor panels: Header, Block Picker, Entity Fields, Layout Canvas, Preview Canvas, Block Properties, and Array Fields.

**IMPORTANT:** Uses `PageBuilderPOM` which provides editor selectors. Tests run as developer role with team context.

**Login:** Uses Developer via `loginAsDefaultDeveloper()` with team-nextspark-001.

## @test SEL_BE_001: Header Selectors

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** block-editor, header, view-mode
- **Grep:** `@ui-selectors` `@SEL_BE_001`
- **Status:** Active (11 passing, 0 skipped)

```gherkin:en
Scenario: Block editor header has all required selectors

Given I am logged in as developer
And I navigate to the page builder create page
When the editor loads
Then I should find the editor container
And I should find the back button
And I should find the title input
And I should find the slug input
And I should find the view mode toggle
And I should find the layout mode button (viewEditor)
And I should find the preview mode button (viewPreview)
And I should find the save button
And I should find the publish button
And I should find the status dot
And I should find the status label
```

```gherkin:es
Scenario: El header del editor de bloques tiene todos los selectores requeridos

Given estoy logueado como developer
And navego a la pagina de crear page builder
When el editor carga
Then deberia encontrar el contenedor del editor
And deberia encontrar el boton de volver
And deberia encontrar el input de titulo
And deberia encontrar el input de slug
And deberia encontrar el toggle de modo de vista
And deberia encontrar el boton de modo layout (viewEditor)
And deberia encontrar el boton de modo preview (viewPreview)
And deberia encontrar el boton de guardar
And deberia encontrar el boton de publicar
And deberia encontrar el dot de status
And deberia encontrar el label de status
```

### Expected Results
| Test ID | Selector Path | POM Accessor | data-cy Value |
|---------|---------------|--------------|---------------|
| SEL_BE_001_01 | editorSelectors.container | pom.editorSelectors.container | block-editor-container |
| SEL_BE_001_02 | editorSelectors.backButton | pom.editorSelectors.backButton | block-editor-back |
| SEL_BE_001_03 | editorSelectors.titleInput | pom.editorSelectors.titleInput | block-editor-title |
| SEL_BE_001_04 | editorSelectors.slugInput | pom.editorSelectors.slugInput | block-editor-slug |
| SEL_BE_001_05 | editorSelectors.viewModeToggle | pom.editorSelectors.viewModeToggle | block-editor-view-toggle |
| SEL_BE_001_06 | editorSelectors.viewEditor | pom.editorSelectors.viewEditor | block-editor-view-editor |
| SEL_BE_001_07 | editorSelectors.viewPreview | pom.editorSelectors.viewPreview | block-editor-view-preview |
| SEL_BE_001_08 | editorSelectors.saveButton | pom.editorSelectors.saveButton | block-editor-save |
| SEL_BE_001_09 | editorSelectors.publishButton | pom.editorSelectors.publishButton | block-editor-publish |
| SEL_BE_001_10 | editorSelectors.statusDot | pom.editorSelectors.statusDot | block-editor-status-dot |
| SEL_BE_001_11 | editorSelectors.statusLabel | pom.editorSelectors.statusLabel | block-editor-status-label |

---

## @test SEL_BE_002: Block Picker Selectors

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** block-editor, block-picker, blocks-tab
- **Grep:** `@ui-selectors` `@SEL_BE_002`
- **Status:** Active (8 passing, 0 skipped)

```gherkin:en
Scenario: Block picker panel has all required selectors

Given I am logged in as developer
And I navigate to the page builder create page
When the editor loads
Then I should find the block picker container
And I should find the blocks tab
And I should find the config tab
And I should find the block search input
And I should find the category chips container
And I should find category chip by name
And I should find the hero block card
When I hover over the hero block card
Then I should find the hero add button
```

```gherkin:es
Scenario: El panel del selector de bloques tiene todos los selectores requeridos

Given estoy logueado como developer
And navego a la pagina de crear page builder
When el editor carga
Then deberia encontrar el contenedor del selector de bloques
And deberia encontrar el tab de bloques
And deberia encontrar el tab de config
And deberia encontrar el input de busqueda de bloques
And deberia encontrar el contenedor de chips de categoria
And deberia encontrar chip de categoria por nombre
And deberia encontrar la tarjeta del bloque hero
When hago hover sobre la tarjeta del bloque hero
Then deberia encontrar el boton de agregar hero
```

### Expected Results
| Test ID | Selector Path | POM Accessor | data-cy Value |
|---------|---------------|--------------|---------------|
| SEL_BE_002_01 | editorSelectors.blockPicker | pom.editorSelectors.blockPicker | block-picker |
| SEL_BE_002_02 | editorSelectors.tabBlocks | pom.editorSelectors.tabBlocks | block-picker-tab-blocks |
| SEL_BE_002_03 | editorSelectors.tabConfig | pom.editorSelectors.tabConfig | block-picker-tab-config |
| SEL_BE_002_04 | editorSelectors.blockSearch | pom.editorSelectors.blockSearch | block-picker-search |
| SEL_BE_002_05 | editorSelectors.categoryChips | pom.editorSelectors.categoryChips | block-picker-categories |
| SEL_BE_002_06 | (dynamic) | `[data-cy^="block-picker-category-"]` | block-picker-category-{name} |
| SEL_BE_002_07 | editorSelectors.blockItem(name) | pom.editorSelectors.blockItem('hero') | block-item-hero |
| SEL_BE_002_08 | editorSelectors.addBlock(name) | pom.editorSelectors.addBlock('hero') | block-add-hero |

---

## @test SEL_BE_003: Entity Fields Panel Selectors

### Metadata
- **Priority:** Medium
- **Type:** Selector Validation
- **Tags:** block-editor, entity-fields, config-tab
- **Grep:** `@ui-selectors` `@SEL_BE_003`
- **Status:** Active (3 tests, conditional)

```gherkin:en
Scenario: Entity fields panel has selectors when in config tab

Given I am logged in as developer
And a test page exists for editing
And I navigate to edit the test page
When the editor loads
And I click the config tab
Then I should find the entity fields panel container
And I should find entity field selectors by name
And if taxonomies are enabled
Then I should find the category list selector
```

```gherkin:es
Scenario: El panel de campos de entidad tiene selectores cuando esta en tab config

Given estoy logueado como developer
And existe una pagina de prueba para editar
And navego a editar la pagina de prueba
When el editor carga
And hago click en el tab de config
Then deberia encontrar el contenedor del panel de campos de entidad
And deberia encontrar selectores de campo de entidad por nombre
And si taxonomias estan habilitadas
Then deberia encontrar el selector de lista de categorias
```

### Expected Results
| Test ID | Selector Path | POM Accessor | data-cy Value |
|---------|---------------|--------------|---------------|
| SEL_BE_003_01 | editorSelectors.entityFieldsPanel | pom.editorSelectors.entityFieldsPanel | entity-fields-panel |
| SEL_BE_003_02 | (dynamic) | `[data-cy^="entity-field-"]` | entity-field-{name} |
| SEL_BE_003_03 | editorSelectors.entityCategoryList | pom.editorSelectors.entityCategoryList | entity-category-list |

### Notes
- Test SEL_BE_003_03 is conditional - only runs if taxonomies are enabled for pages entity
- Entity fields depend on the entity configuration

---

## @test SEL_BE_004: Layout Canvas Selectors

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** block-editor, layout-canvas, sortable
- **Grep:** `@ui-selectors` `@SEL_BE_004`
- **Status:** Active (8 passing, 0 skipped)

```gherkin:en
Scenario: Layout canvas shows empty state when no blocks

Given I am logged in as developer
And I navigate to the page builder create page
When the editor loads
And I switch to layout mode
Then I should find the empty state selector

Scenario: Layout canvas has block selectors when blocks exist

Given I am logged in as developer
And I navigate to the page builder create page
When the editor loads
And I switch to layout mode
And I add a hero block
Then I should find the layout canvas container
And I should find sortable blocks with generic selector
And I should find specific sortable block by ID
And I should find the drag handle
And I should find the duplicate button
And I should find the remove button
And I should see the block name in sortable card
```

```gherkin:es
Scenario: El canvas de layout muestra estado vacio cuando no hay bloques

Given estoy logueado como developer
And navego a la pagina de crear page builder
When el editor carga
And cambio a modo layout
Then deberia encontrar el selector de estado vacio

Scenario: El canvas de layout tiene selectores de bloque cuando existen bloques

Given estoy logueado como developer
And navego a la pagina de crear page builder
When el editor carga
And cambio a modo layout
And agrego un bloque hero
Then deberia encontrar el contenedor del canvas de layout
And deberia encontrar bloques ordenables con selector generico
And deberia encontrar bloque ordenable especifico por ID
And deberia encontrar el handle de arrastrar
And deberia encontrar el boton de duplicar
And deberia encontrar el boton de remover
And deberia ver el nombre del bloque en tarjeta ordenable
```

### Expected Results
| Test ID | Selector Path | POM Accessor | data-cy Value |
|---------|---------------|--------------|---------------|
| SEL_BE_004_01 | editorSelectors.layoutCanvasEmpty | pom.editorSelectors.layoutCanvasEmpty | layout-canvas-empty |
| SEL_BE_004_02 | editorSelectors.layoutCanvas | pom.editorSelectors.layoutCanvas | layout-canvas |
| SEL_BE_004_03 | editorSelectors.sortableBlockGeneric | pom.editorSelectors.sortableBlockGeneric | sortable-block-* |
| SEL_BE_004_04 | editorSelectors.sortableBlock(id) | pom.editorSelectors.sortableBlock(id) | sortable-block-{id} |
| SEL_BE_004_05 | editorSelectors.dragHandle(id) | pom.editorSelectors.dragHandle(id) | block-drag-{id} |
| SEL_BE_004_06 | editorSelectors.duplicateBlock(id) | pom.editorSelectors.duplicateBlock(id) | block-duplicate-{id} |
| SEL_BE_004_07 | editorSelectors.removeBlock(id) | pom.editorSelectors.removeBlock(id) | block-remove-{id} |
| SEL_BE_004_08 | (text content) | Block name displayed in card | N/A |

### Notes
- Layout canvas container only exists when there ARE blocks
- Empty state only exists when there are NO blocks

---

## @test SEL_BE_005: Preview Canvas Selectors

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** block-editor, preview-canvas, floating-toolbar
- **Grep:** `@ui-selectors` `@SEL_BE_005`
- **Status:** Active (7 passing, 0 skipped)

```gherkin:en
Scenario: Preview canvas has block and toolbar selectors

Given I am logged in as developer
And I navigate to the page builder create page
When the editor loads
And I switch to layout mode
And I add a hero block
And I switch to preview mode
Then I should find the preview canvas container
And I should find preview blocks with generic selector
And I should find specific preview block by ID
When I hover over a preview block
Then I should find the floating toolbar
And I should find the toolbar block name
And I should find the toolbar duplicate button
And I should find the toolbar delete button
```

```gherkin:es
Scenario: El canvas de preview tiene selectores de bloque y toolbar

Given estoy logueado como developer
And navego a la pagina de crear page builder
When el editor carga
And cambio a modo layout
And agrego un bloque hero
And cambio a modo preview
Then deberia encontrar el contenedor del canvas de preview
And deberia encontrar bloques de preview con selector generico
And deberia encontrar bloque de preview especifico por ID
When hago hover sobre un bloque de preview
Then deberia encontrar el toolbar flotante
And deberia encontrar el nombre de bloque en toolbar
And deberia encontrar el boton de duplicar en toolbar
And deberia encontrar el boton de eliminar en toolbar
```

### Expected Results
| Test ID | Selector Path | POM Accessor | data-cy Value |
|---------|---------------|--------------|---------------|
| SEL_BE_005_01 | editorSelectors.previewCanvas | pom.editorSelectors.previewCanvas | preview-canvas |
| SEL_BE_005_02 | editorSelectors.previewBlockGeneric | pom.editorSelectors.previewBlockGeneric | preview-block-* |
| SEL_BE_005_03 | editorSelectors.previewBlock(id) | pom.editorSelectors.previewBlock(id) | preview-block-{id} |
| SEL_BE_005_04 | editorSelectors.floatingToolbar(id) | pom.editorSelectors.floatingToolbar(id) | block-toolbar-{id} |
| SEL_BE_005_05 | editorSelectors.floatingToolbarName(id) | pom.editorSelectors.floatingToolbarName(id) | block-toolbar-name-{id} |
| SEL_BE_005_06 | editorSelectors.floatingToolbarDuplicate(id) | pom.editorSelectors.floatingToolbarDuplicate(id) | block-toolbar-duplicate-{id} |
| SEL_BE_005_07 | editorSelectors.floatingToolbarDelete(id) | pom.editorSelectors.floatingToolbarDelete(id) | block-toolbar-delete-{id} |

---

## @test SEL_BE_006: Block Properties Panel Selectors

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** block-editor, properties-panel, dynamic-form
- **Grep:** `@ui-selectors` `@SEL_BE_006`
- **Status:** Active (9 passing, 0 skipped)

```gherkin:en
Scenario: Properties panel shows empty state when no block selected

Given I am logged in as developer
And I navigate to the page builder create page
When the editor loads
Then I should find the empty state for block properties

Scenario: Properties panel has form selectors when block is selected

Given I am logged in as developer
And I navigate to the page builder create page
When the editor loads
And I switch to layout mode
And I add a hero block
Then I should find the properties panel container
And I should find the panel header
And I should find the block name in header
And I should find the content tab
And I should find the design tab
And I should find the advanced tab
And I should find the dynamic form container
And I should find dynamic field by name (title)
```

```gherkin:es
Scenario: El panel de propiedades muestra estado vacio cuando no hay bloque seleccionado

Given estoy logueado como developer
And navego a la pagina de crear page builder
When el editor carga
Then deberia encontrar el estado vacio para propiedades de bloque

Scenario: El panel de propiedades tiene selectores de formulario cuando un bloque esta seleccionado

Given estoy logueado como developer
And navego a la pagina de crear page builder
When el editor carga
And cambio a modo layout
And agrego un bloque hero
Then deberia encontrar el contenedor del panel de propiedades
And deberia encontrar el header del panel
And deberia encontrar el nombre del bloque en el header
And deberia encontrar el tab de contenido
And deberia encontrar el tab de diseno
And deberia encontrar el tab avanzado
And deberia encontrar el contenedor de formulario dinamico
And deberia encontrar campo dinamico por nombre (title)
```

### Expected Results
| Test ID | Selector Path | POM Accessor | data-cy Value |
|---------|---------------|--------------|---------------|
| SEL_BE_006_01 | editorSelectors.blockPropertiesEmpty | pom.editorSelectors.blockPropertiesEmpty | block-properties-empty |
| SEL_BE_006_02 | editorSelectors.blockPropertiesPanel | pom.editorSelectors.blockPropertiesPanel | block-properties-panel |
| SEL_BE_006_03 | editorSelectors.blockPropertiesHeader | pom.editorSelectors.blockPropertiesHeader | block-properties-header |
| SEL_BE_006_04 | editorSelectors.blockPropertiesName | pom.editorSelectors.blockPropertiesName | block-properties-name |
| SEL_BE_006_05 | editorSelectors.tabContent | pom.editorSelectors.tabContent | block-properties-tab-content |
| SEL_BE_006_06 | editorSelectors.tabDesign | pom.editorSelectors.tabDesign | block-properties-tab-design |
| SEL_BE_006_07 | editorSelectors.tabAdvanced | pom.editorSelectors.tabAdvanced | block-properties-tab-advanced |
| SEL_BE_006_08 | editorSelectors.dynamicForm | pom.editorSelectors.dynamicForm | block-dynamic-form |
| SEL_BE_006_09 | editorSelectors.dynamicField(name) | pom.editorSelectors.dynamicField('title') | block-field-{name} |

### Notes
- Properties panel container only exists when a block IS selected
- Empty state only exists when NO block is selected
- Block is auto-selected after adding

---

## @test SEL_BE_007: Array Fields Selectors

### Metadata
- **Priority:** Medium
- **Type:** Selector Validation
- **Tags:** block-editor, array-fields, features-grid
- **Grep:** `@ui-selectors` `@SEL_BE_007`
- **Status:** Active (6 passing, 0 skipped)

```gherkin:en
Scenario: Array fields have container and add button

Given I am logged in as developer
And I navigate to the page builder create page
When the editor loads
And I switch to layout mode
And I add a features-grid block
Then I should find the array field container
And I should find the array field add button

Scenario: Array field items have control selectors

Given the above setup with features-grid block
When I click the add button to add an item
Then I should find array field item controls
When I add a second item
Then I should find array field item move up button
And I should find array field item move down button
And I should find array field item remove button
```

```gherkin:es
Scenario: Los campos de array tienen contenedor y boton de agregar

Given estoy logueado como developer
And navego a la pagina de crear page builder
When el editor carga
And cambio a modo layout
And agrego un bloque features-grid
Then deberia encontrar el contenedor del campo de array
And deberia encontrar el boton de agregar del campo de array

Scenario: Los items del campo de array tienen selectores de control

Given la configuracion anterior con bloque features-grid
When hago click en el boton de agregar para agregar un item
Then deberia encontrar controles del item del campo de array
When agrego un segundo item
Then deberia encontrar el boton de mover arriba del item
And deberia encontrar el boton de mover abajo del item
And deberia encontrar el boton de remover del item
```

### Expected Results
| Test ID | Selector Path | POM Accessor | data-cy Value |
|---------|---------------|--------------|---------------|
| SEL_BE_007_01 | (dynamic) | `[data-cy^="block-array-"]` | block-array-{name} |
| SEL_BE_007_02 | (dynamic) | `[data-cy$="-add"][data-cy^="block-array-"]` | block-array-{name}-add |
| SEL_BE_007_03 | (dynamic) | `[data-cy$="-remove"][data-cy^="block-array-"]` | block-array-{name}-{index}-remove |
| SEL_BE_007_04 | (dynamic) | `[data-cy$="-up"][data-cy^="block-array-"]` | block-array-{name}-{index}-up |
| SEL_BE_007_05 | (dynamic) | `[data-cy$="-down"][data-cy^="block-array-"]` | block-array-{name}-{index}-down |
| SEL_BE_007_06 | (dynamic) | `[data-cy$="-remove"][data-cy^="block-array-"]` | block-array-{name}-{index}-remove |

### Notes
- Uses features-grid block which has 'features' array field
- Move up/down buttons require at least 2 items in array
- Item index is 0-based in selector pattern

---

## Related Components

| Component | File | Selectors |
|-----------|------|-----------|
| BlockEditorHeader | `packages/core/src/components/page-builder/BlockEditorHeader.tsx` | container, back, title, slug, view-toggle, save, publish, status |
| BlockPicker | `packages/core/src/components/page-builder/BlockPicker.tsx` | block-picker, tabs, search, categories, block-items |
| EntityFieldsPanel | `packages/core/src/components/page-builder/EntityFieldsPanel.tsx` | entity-fields-panel, entity-field-{name} |
| LayoutCanvas | `packages/core/src/components/page-builder/LayoutCanvas.tsx` | layout-canvas, sortable-block-{id}, drag/duplicate/remove |
| PreviewCanvas | `packages/core/src/components/page-builder/PreviewCanvas.tsx` | preview-canvas, preview-block-{id}, floating-toolbar |
| BlockPropertiesPanel | `packages/core/src/components/page-builder/BlockPropertiesPanel.tsx` | block-properties-panel, tabs, dynamic-form |
| ArrayFieldItems | `packages/core/src/components/page-builder/ArrayFieldItems.tsx` | block-array-{name}, item controls |

## Related POMs

| POM | File | Usage |
|-----|------|-------|
| PageBuilderPOM | `themes/default/tests/cypress/src/features/PageBuilderPOM.ts` | Block editor selectors and methods |
| PagesPOM | `themes/default/tests/cypress/src/entities/PagesPOM.ts` | Pages entity selectors |
