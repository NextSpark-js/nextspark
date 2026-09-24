# Pages List - Admin UI (Format: BDD/Gherkin - Bilingual)

> **Test File:** `pages-list.cy.ts`
> **Format:** Behavior-Driven Development (BDD) with Given/When/Then
> **Languages:** English / Spanish (side-by-side)
> **Total Tests:** 9

---

## Feature: Pages List Management

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

As an **Owner**
I want to **manage pages from the list view**
So that **I can navigate, search, filter, and delete pages**

**Functionality:**
- Navigate to pages list
- Navigate to create/edit pages
- Search pages by title
- Filter pages by status
- Delete pages with confirmation

</td>
<td>

Como **Owner**
Quiero **gestionar paginas desde la vista de lista**
Para **navegar, buscar, filtrar y eliminar paginas**

**Funcionalidad:**
- Navegar a lista de paginas
- Navegar a crear/editar paginas
- Buscar paginas por titulo
- Filtrar paginas por estado
- Eliminar paginas con confirmacion

</td>
</tr>
</table>

---

## Navigation

### PB-LIST-001: Should navigate to pages list `@smoke`

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Navigate to pages list

Given I am logged in as Owner
When I navigate to the pages list
And the API returns the pages
Then the list page should be visible
```

</td>
<td>

```gherkin
Scenario: Navegar a lista de paginas

Given estoy logueado como Owner
When navego a la lista de paginas
And la API retorna las paginas
Then la pagina de lista deberia estar visible
```

</td>
</tr>
</table>

---

### PB-LIST-002: Should navigate to create page from list

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Navigate to create page

Given I am on the pages list
When I click the create page button
Then the URL should include /dashboard/pages/create
```

</td>
<td>

```gherkin
Scenario: Navegar a crear pagina

Given estoy en la lista de paginas
When hago clic en el boton crear pagina
Then la URL deberia incluir /dashboard/pages/create
```

</td>
</tr>
</table>

---

### PB-LIST-003: Should navigate to edit page from list

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Navigate to edit page

Given I am on the pages list
And there is at least one page in the list
When I click the menu trigger for the first row
And I click "Edit" in the dropdown
Then the URL should include /edit
```

</td>
<td>

```gherkin
Scenario: Navegar a editar pagina

Given estoy en la lista de paginas
And hay al menos una pagina en la lista
When hago clic en el menu de la primera fila
And hago clic en "Editar" en el dropdown
Then la URL deberia incluir /edit
```

</td>
</tr>
</table>

---

## Search

### PB-LIST-004: Should search pages by title

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Search pages by title

Given I am on the pages list
When I search for "About"
And the API returns filtered results
Then pages matching "About" should be visible
```

</td>
<td>

```gherkin
Scenario: Buscar paginas por titulo

Given estoy en la lista de paginas
When busco "About"
And la API retorna resultados filtrados
Then las paginas que coinciden con "About" deberian estar visibles
```

</td>
</tr>
</table>

---

### PB-LIST-005: Should clear search and show all pages

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Clear search filter

Given I am on the pages list
And I have performed a search
When I clear the search field
And the API returns all pages
Then at least 1 page should be visible
```

</td>
<td>

```gherkin
Scenario: Limpiar filtro de busqueda

Given estoy en la lista de paginas
And he realizado una busqueda
When limpio el campo de busqueda
And la API retorna todas las paginas
Then al menos 1 pagina deberia estar visible
```

</td>
</tr>
</table>

---

## Filters

### PB-LIST-006: Should filter pages by published status `@in-develop`

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Filter pages by status

Given I am on the pages list
And the status filter exists
When I click the filter trigger
And I select a status option
Then the list should filter by the selected status
```

**Note:** Test marked @in-develop - status filter UI pending implementation.

</td>
<td>

```gherkin
Scenario: Filtrar paginas por estado

Given estoy en la lista de paginas
And el filtro de estado existe
When hago clic en el trigger del filtro
And selecciono una opcion de estado
Then la lista deberia filtrarse por el estado seleccionado
```

**Nota:** Test marcado @in-develop - UI de filtro de estado pendiente de implementar.

</td>
</tr>
</table>

---

## Delete

### PB-LIST-007: Should show delete confirmation dialog `@in-develop`

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Show delete confirmation dialog

Given I am on the pages list
And I have created a test page via API
When I search for the test page
And I open the row menu
And I click delete in the dropdown
Then a confirmation dialog should appear
When I cancel the deletion
Then the dialog should close
```

</td>
<td>

```gherkin
Scenario: Mostrar dialogo de confirmacion de eliminacion

Given estoy en la lista de paginas
And he creado una pagina de prueba via API
When busco la pagina de prueba
And abro el menu de la fila
And hago clic en eliminar en el dropdown
Then deberia aparecer un dialogo de confirmacion
When cancelo la eliminacion
Then el dialogo deberia cerrarse
```

</td>
</tr>
</table>

---

### PB-LIST-008: Should delete page after confirmation `@in-develop`

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Delete page with confirmation

Given I am on the pages list
And I have created a test page via API
When I search for the test page
And I open the row menu
And I click delete in the dropdown
And I confirm the deletion
Then the API should process the delete
And the page should no longer be in the list
```

</td>
<td>

```gherkin
Scenario: Eliminar pagina con confirmacion

Given estoy en la lista de paginas
And he creado una pagina de prueba via API
When busco la pagina de prueba
And abro el menu de la fila
And hago clic en eliminar en el dropdown
And confirmo la eliminacion
Then la API deberia procesar la eliminacion
And la pagina ya no deberia estar en la lista
```

</td>
</tr>
</table>

---

## Empty State

### PB-LIST-009: Should show empty state when no results match search

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Show empty state for no results

Given I am on the pages list
When I search for "NonExistentPageTitle12345"
And the API returns no results
Then an empty state should be shown
Or a "no results" message should be visible
```

</td>
<td>

```gherkin
Scenario: Mostrar estado vacio sin resultados

Given estoy en la lista de paginas
When busco "NonExistentPageTitle12345"
And la API retorna sin resultados
Then deberia mostrarse un estado vacio
Or un mensaje de "sin resultados" deberia estar visible
```

</td>
</tr>
</table>

---

## Summary / Resumen

| Test ID | Block | Description / Descripción | Tags |
|---------|-------|---------------------------|------|
| PB-LIST-001 | Navigation | Navigate to list | `@smoke` |
| PB-LIST-002 | Navigation | Navigate to create | |
| PB-LIST-003 | Navigation | Navigate to edit | |
| PB-LIST-004 | Search | Search by title | |
| PB-LIST-005 | Search | Clear search | |
| PB-LIST-006 | Filters | Filter by status | `@in-develop` |
| PB-LIST-007 | Delete | Show confirmation | `@in-develop` |
| PB-LIST-008 | Delete | Delete with confirm | `@in-develop` |
| PB-LIST-009 | Empty State | No results message | |
