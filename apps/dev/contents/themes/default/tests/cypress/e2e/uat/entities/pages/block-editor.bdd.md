# Block Editor - Admin UI (Format: BDD/Gherkin - Bilingual)

> **Test File:** `block-editor.cy.ts`
> **Format:** Behavior-Driven Development (BDD) with Given/When/Then
> **Languages:** English / Spanish (side-by-side)
> **Total Tests:** 10

---

## Feature: Block Editor Interface

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

As an **Owner**
I want to **use the block editor interface**
So that **I can build and manage page content**

**Interface Components:**
- Editor loading
- Block picker
- Mode switching (Layout/Preview)
- Settings panel
- Save/publish functionality

</td>
<td>

Como **Owner**
Quiero **usar la interfaz del editor de bloques**
Para **construir y gestionar contenido de paginas**

**Componentes de Interfaz:**
- Carga del editor
- Selector de bloques
- Cambio de modo (Layout/Preview)
- Panel de configuracion
- Funcionalidad de guardar/publicar

</td>
</tr>
</table>

---

## Editor Loading

### PB-EDITOR-001: Should open editor for existing page `@smoke`

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Open editor for existing page

Given I am logged in as Owner
And I have created a test page via API
When I visit the page editor
And I wait for the editor to load
Then the editor should be visible
```

</td>
<td>

```gherkin
Scenario: Abrir editor para pagina existente

Given estoy logueado como Owner
And he creado una pagina de prueba via API
When visito el editor de paginas
And espero que el editor cargue
Then el editor deberia estar visible
```

</td>
</tr>
</table>

---

### PB-EDITOR-002: Should open new page form

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Open new page creation form

Given I am logged in as Owner
When I visit /dashboard/pages/create
Then the new page form should be visible
And the title input should be visible
And the slug input should be visible
```

</td>
<td>

```gherkin
Scenario: Abrir formulario de creacion de nueva pagina

Given estoy logueado como Owner
When visito /dashboard/pages/create
Then el formulario de nueva pagina deberia estar visible
And el input de titulo deberia estar visible
And el input de slug deberia estar visible
```

</td>
</tr>
</table>

---

## Block Picker

### PB-EDITOR-003: Should show block picker with available blocks `@smoke`

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Block picker shows available blocks

Given I am on the page editor
And I switch to Layout mode
Then the block picker should be visible
And "hero" block should be in the picker
And "cta-section" block should be in the picker
And "features-grid" block should be in the picker
```

</td>
<td>

```gherkin
Scenario: Selector de bloques muestra bloques disponibles

Given estoy en el editor de paginas
And cambio al modo Layout
Then el selector de bloques deberia estar visible
And el bloque "hero" deberia estar en el selector
And el bloque "cta-section" deberia estar en el selector
And el bloque "features-grid" deberia estar en el selector
```

</td>
</tr>
</table>

---

### PB-EDITOR-004: Should filter blocks by category

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Filter blocks by category

Given I am on the page editor in Layout mode
When I click the "marketing" category tab
Then the block picker should show CTA blocks
```

</td>
<td>

```gherkin
Scenario: Filtrar bloques por categoria

Given estoy en el editor de paginas en modo Layout
When hago clic en la pestana de categoria "marketing"
Then el selector de bloques deberia mostrar bloques CTA
```

</td>
</tr>
</table>

---

### PB-EDITOR-005: Should search blocks by name

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Search blocks by name

Given I am on the page editor in Layout mode
When I search for "hero" in the block picker
Then "hero" block should be visible in the picker
```

</td>
<td>

```gherkin
Scenario: Buscar bloques por nombre

Given estoy en el editor de paginas en modo Layout
When busco "hero" en el selector de bloques
Then el bloque "hero" deberia estar visible en el selector
```

</td>
</tr>
</table>

---

## Mode Switching

### PB-EDITOR-006: Should switch between Layout and Preview mode

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Switch between editor modes

Given I am on the page editor
And I switch to Layout mode
And I add a "hero" block
When I switch to Preview mode
Then the preview canvas should be visible
When I switch to Layout mode
Then the block canvas should be visible
```

</td>
<td>

```gherkin
Scenario: Cambiar entre modos del editor

Given estoy en el editor de paginas
And cambio al modo Layout
And agrego un bloque "hero"
When cambio al modo Preview
Then el canvas de preview deberia estar visible
When cambio al modo Layout
Then el canvas de bloques deberia estar visible
```

</td>
</tr>
</table>

---

## Settings Panel

### PB-EDITOR-007: Should show settings panel when block is selected

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Settings panel shows for selected block

Given I am on the page editor in Layout mode
When I add a "hero" block
Then the settings panel should have content
```

</td>
<td>

```gherkin
Scenario: Panel de configuracion se muestra para bloque seleccionado

Given estoy en el editor de paginas en modo Layout
When agrego un bloque "hero"
Then el panel de configuracion deberia tener contenido
```

</td>
</tr>
</table>

---

### PB-EDITOR-008: Should switch between settings tabs

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Switch between settings tabs

Given I am on the page editor with a hero block
When I select the "content" settings tab
Then the content tab should be active
When I select the "design" settings tab
Then the design tab should be active
```

</td>
<td>

```gherkin
Scenario: Cambiar entre pestanas de configuracion

Given estoy en el editor de paginas con un bloque hero
When selecciono la pestana de configuracion "content"
Then la pestana content deberia estar activa
When selecciono la pestana de configuracion "design"
Then la pestana design deberia estar activa
```

</td>
</tr>
</table>

---

## Save Functionality

### PB-EDITOR-009: Should save page changes `@smoke`

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Save page with blocks

Given I am on the page editor in Layout mode
And I add a "hero" block
When I save the page
And I wait for the API update
Then the API should confirm at least 1 block
And the first block should be "hero"
```

</td>
<td>

```gherkin
Scenario: Guardar pagina con bloques

Given estoy en el editor de paginas en modo Layout
And agrego un bloque "hero"
When guardo la pagina
And espero la actualizacion de API
Then la API deberia confirmar al menos 1 bloque
And el primer bloque deberia ser "hero"
```

</td>
</tr>
</table>

---

### PB-EDITOR-010: Should publish page

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Publish a page

Given I am on the page editor
When I select "published" status
And I save the page
And I wait for the API update
Then the API should confirm status is "published"
```

</td>
<td>

```gherkin
Scenario: Publicar una pagina

Given estoy en el editor de paginas
When selecciono estado "published"
And guardo la pagina
And espero la actualizacion de API
Then la API deberia confirmar que el estado es "published"
```

</td>
</tr>
</table>

---

## Summary / Resumen

| Test ID | Block | Description / Descripción | Tags |
|---------|-------|---------------------------|------|
| PB-EDITOR-001 | Loading | Open editor for page | `@smoke` |
| PB-EDITOR-002 | Loading | Open new page form | |
| PB-EDITOR-003 | Block Picker | Show available blocks | `@smoke` |
| PB-EDITOR-004 | Block Picker | Filter by category | |
| PB-EDITOR-005 | Block Picker | Search by name | |
| PB-EDITOR-006 | Mode Switch | Layout/Preview toggle | |
| PB-EDITOR-007 | Settings | Show settings panel | |
| PB-EDITOR-008 | Settings | Switch tabs | |
| PB-EDITOR-009 | Save | Save page changes | `@smoke` |
| PB-EDITOR-010 | Save | Publish page | |
