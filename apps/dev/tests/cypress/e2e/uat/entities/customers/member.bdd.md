---
feature: Customers Management - Member Role
priority: high
tags: [customers, member, permissions, read-only, security]
grepTags: [uat, feat-customers, role-member, security]
coverage: 7
---

# Customers Management - Member Role (View Only - Restricted)

> Test suite for Member role customer permissions. Members can only READ customers - they CANNOT create, update, or delete. These tests verify proper UI restrictions for the Member role.

## Background

```gherkin:en
Given I am logged in as Member (member@nextspark.dev)
And I have navigated to the Customers dashboard
And the customers list has loaded successfully
```

```gherkin:es
Given estoy logueado como Member (member@nextspark.dev)
And he navegado al dashboard de Clientes
And la lista de clientes ha cargado exitosamente
```

---

## @test CUST-MEMBER-001: View customer list

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** read, list, permissions
- **Grep:** `@smoke` `@critical`

```gherkin:en
Scenario: Member can view the customers table

Given I am logged in as a Member
When I navigate to the Customers dashboard
Then the customers page should be visible
And the customers table should be displayed
```

```gherkin:es
Scenario: Member puede ver la tabla de clientes

Given estoy logueado como Member
When navego al dashboard de Clientes
Then la pagina de clientes deberia estar visible
And la tabla de clientes deberia mostrarse
```

### Expected Results
- Customers dashboard is accessible to Member role
- Customers table displays with data
- Read access is properly granted

---

## @test CUST-MEMBER-002: View customer details

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** read, details, navigation

```gherkin:en
Scenario: Member can view individual customer details

Given I am logged in as a Member
And there is at least one customer in the list
When I click on a customer row
Then I should be navigated to the customer detail page
And the URL should match /dashboard/customers/{id}
And the detail header should be visible
```

```gherkin:es
Scenario: Member puede ver detalles de un cliente

Given estoy logueado como Member
And existe al menos un cliente en la lista
When hago clic en una fila de cliente
Then deberia ser navegado a la pagina de detalle
And la URL deberia coincidir con /dashboard/customers/{id}
And el encabezado de detalle deberia estar visible
```

### Expected Results
- Customer rows are clickable for Members
- Detail page navigation works
- Customer information is visible
- Detail header displays correctly

---

## @test CUST-MEMBER-003: Edit button is hidden

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** update, security, hidden-button
- **Grep:** `@security`

```gherkin:en
Scenario: Edit button is hidden for Member role

Given I am logged in as a Member
And there is at least one customer in the list
When I click on a customer row to view details
Then I should see the customer information
But I should NOT see an "Edit" button
And the edit button should not exist in the DOM
```

```gherkin:es
Scenario: Boton editar oculto para rol Member

Given estoy logueado como Member
And existe al menos un cliente en la lista
When hago clic en una fila para ver detalles
Then deberia ver la informacion del cliente
But NO deberia ver un boton "Editar"
And el boton editar no deberia existir en el DOM
```

### Expected Results
- Customer information is visible
- Edit button is completely hidden (not just disabled)
- Edit button does not exist in DOM
- Security: No way to access edit functionality

---

## @test CUST-MEMBER-004: Create button is hidden

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** create, security, hidden-button
- **Grep:** `@smoke` `@critical` `@security`

```gherkin:en
Scenario: Create button is hidden for Member role

Given I am logged in as a Member
When I navigate to the Customers list page
Then the customers page should be visible
But I should NOT see an "Add" button
And the create button should not exist in the DOM
```

```gherkin:es
Scenario: Boton crear oculto para rol Member

Given estoy logueado como Member
When navego a la pagina de lista de Clientes
Then la pagina de clientes deberia estar visible
But NO deberia ver un boton "Agregar"
And el boton crear no deberia existir en el DOM
```

### Expected Results
- Customers list page loads correctly
- Add/Create button is completely hidden
- Create button does not exist in DOM
- Security: No way to access create functionality

---

## @test CUST-MEMBER-005: No UI access to create form

### Metadata
- **Priority:** Medium
- **Type:** Regression
- **Tags:** create, security, form-access

```gherkin:en
Scenario: Member has no UI access to create form

Given I am logged in as a Member
When I am on the Customers list page
Then there should be no way to access the create form
And the "Add" button should not exist
```

```gherkin:es
Scenario: Member no tiene acceso UI al formulario de creacion

Given estoy logueado como Member
When estoy en la pagina de lista de Clientes
Then no deberia haber forma de acceder al formulario de creacion
And el boton "Agregar" no deberia existir
```

### Expected Results
- No UI element leads to create form
- Add button does not exist
- Create form is inaccessible through UI

---

## @test CUST-MEMBER-006: Delete buttons are hidden

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** delete, security, hidden-button
- **Grep:** `@smoke` `@critical` `@security`

```gherkin:en
Scenario: Delete buttons are hidden in list view

Given I am logged in as a Member
When I am on the Customers list page
Then I should NOT see any delete action buttons
And no delete buttons should exist in table rows
```

```gherkin:es
Scenario: Botones eliminar ocultos en vista de lista

Given estoy logueado como Member
When estoy en la pagina de lista de Clientes
Then NO deberia ver ningun boton de accion eliminar
And no deberian existir botones eliminar en las filas
```

### Expected Results
- No delete buttons visible in list view
- Delete actions do not exist in table rows
- Security: No way to trigger delete from list

---

## @test CUST-MEMBER-007: No delete action in detail view

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** delete, security, detail-view
- **Grep:** `@security`

```gherkin:en
Scenario: Delete button is hidden in detail view

Given I am logged in as a Member
And there is at least one customer in the list
When I click on a customer row to view details
Then the detail page should load
And the detail header should be visible
But I should NOT see a "Delete" button
And the delete button should not exist in the DOM
```

```gherkin:es
Scenario: Boton eliminar oculto en vista de detalle

Given estoy logueado como Member
And existe al menos un cliente en la lista
When hago clic en una fila para ver detalles
Then la pagina de detalle deberia cargar
And el encabezado de detalle deberia estar visible
But NO deberia ver un boton "Eliminar"
And el boton eliminar no deberia existir en el DOM
```

### Expected Results
- Detail page loads correctly
- Detail header is visible
- Delete button is completely hidden
- Delete button does not exist in DOM
- Security: No way to trigger delete from detail view
