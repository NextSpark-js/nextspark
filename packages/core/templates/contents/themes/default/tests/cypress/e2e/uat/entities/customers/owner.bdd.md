---
feature: Customers Management - Owner Role
priority: high
tags: [customers, owner, crud, dashboard]
grepTags: [uat, feat-customers, role-owner]
coverage: 5
---

# Customers Management - Owner Role (Full CRUD Access)

> Test suite for Owner role managing customers through the dashboard UI. Covers full CRUD operations: create, view, update, and delete customer records.

## Background

```gherkin:en
Given I am logged in as Owner (owner@nextspark.dev)
And I have navigated to the Customers dashboard
And the customers list has loaded successfully
```

```gherkin:es
Given estoy logueado como Owner (owner@nextspark.dev)
And he navegado al dashboard de Clientes
And la lista de clientes ha cargado exitosamente
```

---

## @test CUST-001: Create new customer with all required fields

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** create, customer, form
- **Grep:** `@smoke` `@critical`

```gherkin:en
Scenario: Owner creates a new customer

Given I am logged in as an Owner
And I am on the Customers list page
When I click the "Add" button
Then the customer creation form should appear

When I fill in the following fields:
  | Field   | Value                    |
  | Name    | "Test Customer [timestamp]" |
  | Account | "123456"                 |
  | Office  | "Main Office"            |
And I click the "Save" button
Then the form should submit successfully
And I should be redirected to the customers list
And I should see "Test Customer" in the list
```

```gherkin:es
Scenario: Owner crea un nuevo cliente

Given estoy logueado como Owner
And estoy en la pagina de lista de Clientes
When hago clic en el boton "Agregar"
Then deberia aparecer el formulario de creacion

When completo los siguientes campos:
  | Campo   | Valor                        |
  | Nombre  | "Cliente de Prueba [timestamp]" |
  | Cuenta  | "123456"                     |
  | Oficina | "Oficina Principal"          |
And hago clic en el boton "Guardar"
Then el formulario deberia enviarse exitosamente
And deberia ser redirigido a la lista de clientes
And deberia ver "Cliente de Prueba" en la lista
```

### Expected Results
- Add button is visible and clickable
- Customer creation form displays all required fields
- Form validation works correctly
- Customer is created and appears in the list
- Redirect to customers list after successful creation

---

## @test CUST-002: View customer list

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** read, list, table
- **Grep:** `@smoke` `@critical`

```gherkin:en
Scenario: Owner can view the customers table

Given I am logged in as an Owner
When I navigate to the Customers dashboard
Then the customers page should be visible
And the customers table should be displayed
```

```gherkin:es
Scenario: Owner puede ver la tabla de clientes

Given estoy logueado como Owner
When navego al dashboard de Clientes
Then la pagina de clientes deberia estar visible
And la tabla de clientes deberia mostrarse
```

### Expected Results
- Customers dashboard is accessible
- Customers table displays with data
- Table shows customer information columns

---

## @test CUST-003: View customer details

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** read, details, navigation

```gherkin:en
Scenario: Owner can view individual customer details

Given I am logged in as an Owner
And there is at least one customer in the list
When I click on a customer row
Then I should be navigated to the customer detail page
And the URL should match /dashboard/customers/{id}
```

```gherkin:es
Scenario: Owner puede ver detalles de un cliente

Given estoy logueado como Owner
And existe al menos un cliente en la lista
When hago clic en una fila de cliente
Then deberia ser navegado a la pagina de detalle
And la URL deberia coincidir con /dashboard/customers/{id}
```

### Expected Results
- Customer rows are clickable
- Navigation to detail page works
- URL contains customer ID
- Customer details are displayed

---

## @test CUST-004: Edit existing customer

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** update, edit, form

```gherkin:en
Scenario: Owner can modify customer information

Given I am logged in as an Owner
And there is at least one customer in the list
When I click on a customer row to view details
And I click the "Edit" button
Then the customer edit form should appear
And the form should be pre-filled with current data

When I change the Name to "Updated Customer [timestamp]"
And I click the "Save" button
Then the changes should be saved successfully
And I should see "Updated Customer" in the list
```

```gherkin:es
Scenario: Owner puede modificar informacion del cliente

Given estoy logueado como Owner
And existe al menos un cliente en la lista
When hago clic en una fila para ver detalles
And hago clic en el boton "Editar"
Then deberia aparecer el formulario de edicion
And el formulario deberia estar pre-llenado con datos actuales

When cambio el Nombre a "Cliente Actualizado [timestamp]"
And hago clic en el boton "Guardar"
Then los cambios deberian guardarse exitosamente
And deberia ver "Cliente Actualizado" en la lista
```

### Expected Results
- Edit button is accessible from detail page
- Edit form pre-fills with existing data
- Changes can be saved successfully
- Updated data reflects in the list

---

## @test CUST-005: Delete customer

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** delete, confirmation, dialog

```gherkin:en
Scenario: Owner can permanently delete a customer

Given I am logged in as an Owner
And I have created a customer called "Delete Test [timestamp]"
When I click on that customer to view details
And I click the "Delete" button
Then a confirmation dialog should appear

When I confirm the deletion
Then a second confirmation dialog should appear
When I confirm again
Then the customer should be deleted
And "Delete Test" should no longer appear in the list
```

```gherkin:es
Scenario: Owner puede eliminar permanentemente un cliente

Given estoy logueado como Owner
And he creado un cliente llamado "Prueba Eliminar [timestamp]"
When hago clic en ese cliente para ver detalles
And hago clic en el boton "Eliminar"
Then deberia aparecer un dialogo de confirmacion

When confirmo la eliminacion
Then deberia aparecer un segundo dialogo de confirmacion
When confirmo nuevamente
Then el cliente deberia ser eliminado
And "Prueba Eliminar" ya no deberia aparecer en la lista
```

### Expected Results
- Delete button is accessible from detail page
- First confirmation dialog appears
- Second confirmation dialog appears (2-step deletion)
- Customer is permanently removed
- Customer no longer appears in the list
