#!/usr/bin/env python3
"""
Generate UAT Test Script

Generates a UAT test file and optional BDD documentation for an entity.

Usage:
    python generate-uat-test.py --entity ENTITY --role ROLE [--theme THEME] [--with-bdd]

Options:
    --entity ENTITY   Entity name (e.g., tasks, customers)
    --theme THEME     Theme name (default: default)
    --role ROLE       Role name (owner, admin, member, editor, viewer)
    --session SESSION Session name for @scope tag (optional)
    --with-bdd        Generate BDD documentation file
    --dry-run         Preview without writing to file
"""

import os
import sys
import re
import argparse
from pathlib import Path
from datetime import datetime
from typing import Optional


def to_pascal_case(name: str) -> str:
    """Convert kebab-case/snake_case to PascalCase."""
    return ''.join(x.title() for x in re.split(r'[-_]', name))


def to_singular(name: str) -> str:
    """Convert plural to singular (simple English rules)."""
    if name.endswith('ies'):
        return name[:-3] + 'y'
    elif name.endswith('es'):
        return name[:-2]
    elif name.endswith('s'):
        return name[:-1]
    return name


def get_login_helper(role: str) -> str:
    """Get the login helper function name for a role."""
    role_map = {
        'owner': 'loginAsOwner',
        'admin': 'loginAsAdmin',
        'member': 'loginAsMember',
        'editor': 'loginAsEditor',
        'viewer': 'loginAsViewer',
        'superadmin': 'loginAsSuperadmin',
        'developer': 'loginAsDeveloper',
    }
    return role_map.get(role.lower(), 'loginAsOwner')


def get_role_access_level(role: str) -> str:
    """Get access level description for a role."""
    access_map = {
        'owner': 'Full CRUD Access',
        'admin': 'Full CRUD Access',
        'member': 'Limited Access',
        'editor': 'Edit Access',
        'viewer': 'Read-Only Access',
    }
    return access_map.get(role.lower(), 'Standard Access')


def generate_test_content(
    entity: str,
    role: str,
    theme: str,
    session: Optional[str] = None
) -> str:
    """Generate the UAT test file content."""
    singular = to_singular(entity)
    pascal_singular = to_pascal_case(singular)
    pascal_plural = to_pascal_case(entity)
    role_upper = role.upper()
    entity_upper = entity.upper()
    login_helper = get_login_helper(role)
    access_level = get_role_access_level(role)
    timestamp = datetime.now().strftime('%Y-%m-%d')

    # Build tags
    tags = [f"'@uat'", f"'@feat-{entity}'", f"'@role-{role}'", "'@crud'", "'@regression'"]
    if session:
        tags.append(f"'@scope-{session}'")
    tags_str = ', '.join(tags)

    return f'''/// <reference types="cypress" />

/**
 * {pascal_plural} CRUD - {role.title()} Role ({access_level})
 *
 * Generated: {timestamp}
 * Theme: {theme}
 *
 * UAT tests for {entity} entity with {role.title()} role permissions.
 */

import * as allure from 'allure-cypress'

import {{ {pascal_plural}POM }} from '../../src/entities/{pascal_plural}POM'
import {{ {login_helper} }} from '../../src/session-helpers'

describe('{pascal_plural} CRUD - {role.title()} Role ({access_level})', {{
  tags: [{tags_str}]
}}, () => {{
  const pom = {pascal_plural}POM.create()

  beforeEach(() => {{
    allure.epic('UAT')
    allure.feature('{pascal_plural}')
    allure.story('{role.title()} Permissions')
    pom.setupApiIntercepts()
    {login_helper}()
    pom.visitList()
    pom.api.waitForList()
    pom.waitForList()
  }})

  // ============================================================
  // CREATE - {role.title()} can create {entity}
  // ============================================================
  describe('CREATE - {role.title()} can create {entity}', {{ tags: '@smoke' }}, () => {{
    it('{role_upper}_{entity_upper}_CREATE_001: should create new {singular} successfully', {{ tags: '@smoke' }}, () => {{
      allure.severity('critical')

      const entityName = `{role.title()} {pascal_singular} ${{Date.now()}}`

      // Click create button
      pom.clickAdd()

      // Validate form is visible
      pom.waitForForm()

      // TODO: Fill required fields based on entity schema
      // pom.fillTextField('title', entityName)

      // Submit form
      pom.submitForm()

      // Wait for API response
      pom.api.waitForCreate()

      // Validate redirect to list
      cy.url().should('include', `/dashboard/${{pom.entitySlug}}`)

      // Validate entity appears in list
      pom.assert{pascal_singular}InList(entityName)

      cy.log('Created {singular} successfully')
    }})

    it('{role_upper}_{entity_upper}_CREATE_002: should create {singular} with all fields', () => {{
      const entityName = `Full {pascal_singular} ${{Date.now()}}`

      // Click create button
      pom.clickAdd()

      // Validate form is visible
      pom.waitForForm()

      // TODO: Fill all fields based on entity schema
      // pom.fillTextField('title', entityName)
      // pom.fillTextarea('description', 'Description text')
      // pom.selectOption('status', 'active')

      // Submit form
      pom.submitForm()

      // Wait for API response
      pom.api.waitForCreate()

      // Validate entity appears in list
      cy.url().should('include', `/dashboard/${{pom.entitySlug}}`)
      pom.assert{pascal_singular}InList(entityName)

      cy.log('Created full {singular} successfully')
    }})
  }})

  // ============================================================
  // READ - {role.title()} can read {entity}
  // ============================================================
  describe('READ - {role.title()} can read {entity}', {{ tags: '@smoke' }}, () => {{
    it('{role_upper}_{entity_upper}_READ_001: should view {singular} list', {{ tags: '@smoke' }}, () => {{
      allure.severity('critical')
      // Validate list is visible
      pom.assertTableVisible()

      cy.log('{role.title()} can view {singular} list')
    }})

    it('{role_upper}_{entity_upper}_READ_002: should view {singular} details', () => {{
      // Check if there are entities to view
      cy.get('body').then($body => {{
        if ($body.find(pom.selectors.rowGeneric).length > 0) {{
          // Click the first row (navigation via onClick)
          cy.get(pom.selectors.rowGeneric).first().click()

          // Should navigate to detail page
          cy.url().should('match', new RegExp(`/dashboard/${{pom.entitySlug}}/[a-z0-9-]+`))

          cy.log('{role.title()} can view {singular} details')
        }} else {{
          cy.log('No {entity} available to view details')
        }}
      }})
    }})
  }})

  // ============================================================
  // UPDATE - {role.title()} can update {entity}
  // ============================================================
  describe('UPDATE - {role.title()} can update {entity}', () => {{
    it('{role_upper}_{entity_upper}_UPDATE_001: should edit {singular} successfully', () => {{
      // Check if there are entities to edit
      cy.get('body').then($body => {{
        if ($body.find(pom.selectors.rowActionEditGeneric).length > 0) {{
          // Click edit button on first entity
          cy.get(pom.selectors.rowActionEditGeneric).first().click()

          // Validate form is visible
          pom.waitForForm()

          // TODO: Update entity-specific fields
          const updatedName = `Updated {pascal_singular} ${{Date.now()}}`
          // pom.fillTextField('title', updatedName)

          // Submit form
          pom.submitForm()

          // Wait for API response
          pom.api.waitForUpdate()

          // Validate update
          cy.url().should('include', `/dashboard/${{pom.entitySlug}}`)

          cy.log('{role.title()} updated {singular} successfully')
        }} else {{
          cy.log('No {entity} available to edit')
        }}
      }})
    }})
  }})

  // ============================================================
  // DELETE - {role.title()} can delete {entity}
  // ============================================================
  describe('DELETE - {role.title()} can delete {entity}', () => {{
    it('{role_upper}_{entity_upper}_DELETE_001: should delete {singular} successfully', () => {{
      // First, create an entity to delete
      const entityName = `Delete Test ${{Date.now()}}`

      pom.clickAdd()
      pom.waitForForm()
      // TODO: Fill required fields
      // pom.fillTextField('title', entityName)
      pom.submitForm()
      pom.api.waitForCreate()

      // Navigate back to list and wait for it to load
      pom.visitList()
      pom.waitForList()

      // Wait for entity to appear in the list
      pom.assert{pascal_singular}InList(entityName)

      // Delete the entity
      pom.clickRowByText(entityName)
      pom.waitForDetail()

      // Click delete button
      pom.clickDelete()

      // Confirm deletion (2-step)
      cy.get(pom.selectors.deleteConfirm).should('be.visible').click()
      cy.get(pom.selectors.parentDeleteConfirm).should('be.visible').click()

      // Wait for delete API response
      pom.api.waitForDelete()

      // Navigate to list and verify deletion
      pom.visitList()
      pom.api.waitForList()
      pom.waitForList()
      pom.assert{pascal_singular}NotInList(entityName)

      cy.log('{role.title()} deleted {singular} successfully')
    }})
  }})

  after(() => {{
    cy.log('{pascal_plural} CRUD tests completed')
  }})
}})
'''


def generate_bdd_content(
    entity: str,
    role: str,
    theme: str
) -> str:
    """Generate the BDD documentation file content."""
    singular = to_singular(entity)
    singular_es = singular  # Would need proper translation
    pascal_singular = to_pascal_case(singular)
    pascal_plural = to_pascal_case(entity)
    role_upper = role.upper()
    entity_upper = entity.upper()
    access_level = get_role_access_level(role)

    # Spanish translations (simplified)
    role_es = {
        'owner': 'Owner',
        'admin': 'Admin',
        'member': 'Member',
        'editor': 'Editor',
        'viewer': 'Viewer',
    }.get(role.lower(), role.title())

    return f'''# {pascal_plural} UI - {role.title()} Role (Format: BDD/Gherkin - Bilingual)

> **Test File:** `{entity}-{role}.cy.ts`
> **Format:** Behavior-Driven Development (BDD) with Given/When/Then
> **Languages:** English / Spanish (side-by-side)
> **Total Tests:** 6

---

## Feature: {pascal_plural} Management - {role.title()} Role ({access_level})

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Espanol</th>
</tr>
<tr>
<td>

As a **{role.title()}**
I want to **manage {entity} through the dashboard UI**
So that **I can create, read, update, and delete {entity} for my team**

</td>
<td>

Como **{role_es}**
Quiero **gestionar {entity} a traves del dashboard**
Para **crear, leer, actualizar y eliminar {entity} de mi equipo**

</td>
</tr>
</table>

### Background

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Espanol</th>
</tr>
<tr>
<td>

```gherkin
Given I am logged in as {role.title()}
And I have navigated to the {pascal_plural} dashboard
And the {entity} list has loaded successfully
```

</td>
<td>

```gherkin
Given estoy logueado como {role_es}
And he navegado al dashboard de {pascal_plural}
And la lista de {entity} ha cargado exitosamente
```

</td>
</tr>
</table>

---

## CREATE - {role.title()} can create {entity} `@smoke`

### {role_upper}_{entity_upper}_CREATE_001: Create new {singular} successfully `@smoke` `@critical`

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Espanol</th>
</tr>
<tr>
<td>

```gherkin
Scenario: {role.title()} creates a simple {singular}

Given I am logged in as {role.title()}
And I am on the {pascal_plural} list page
When I click the "Add" button
Then the {singular} creation form should appear

When I enter "New {pascal_singular}" in the Title field
And I click the "Save" button
Then the form should submit successfully
And I should see a success message
And I should be redirected to the {entity} list
And I should see "New {pascal_singular}" in the {singular} list
```

</td>
<td>

```gherkin
Scenario: {role_es} crea un/a {singular_es} simple

Given estoy logueado como {role_es}
And estoy en la pagina de lista de {pascal_plural}
When hago clic en el boton "Agregar"
Then deberia aparecer el formulario de creacion

When ingreso "Nuevo/a {pascal_singular}" en el campo Titulo
And hago clic en el boton "Guardar"
Then el formulario deberia enviarse exitosamente
And deberia ver un mensaje de exito
And deberia ser redirigido a la lista de {entity}
And deberia ver "Nuevo/a {pascal_singular}" en la lista
```

</td>
</tr>
</table>

**Visual Flow:**
```
[{pascal_plural} List] -> [Click Add] -> [Form Modal] -> [Fill Title] -> [Save] -> [List with new {singular}]
```

---

### {role_upper}_{entity_upper}_CREATE_002: Create {singular} with all fields

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Espanol</th>
</tr>
<tr>
<td>

```gherkin
Scenario: {role.title()} creates a {singular} with complete information

Given I am logged in as {role.title()}
And I am on the {pascal_plural} list page
When I click the "Add" button
Then the {singular} creation form should appear

When I fill in all available fields
And I click the "Save" button
Then the form should submit successfully
And the {singular} should be created with all provided values
And I should see the {singular} in the list
```

</td>
<td>

```gherkin
Scenario: {role_es} crea un/a {singular_es} con informacion completa

Given estoy logueado como {role_es}
And estoy en la pagina de lista de {pascal_plural}
When hago clic en el boton "Agregar"
Then deberia aparecer el formulario de creacion

When completo todos los campos disponibles
And hago clic en el boton "Guardar"
Then el formulario deberia enviarse exitosamente
And el/la {singular_es} deberia crearse con todos los valores
And deberia ver el/la {singular_es} en la lista
```

</td>
</tr>
</table>

---

## READ - {role.title()} can read {entity} `@smoke`

### {role_upper}_{entity_upper}_READ_001: View {singular} list `@smoke` `@critical`

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Espanol</th>
</tr>
<tr>
<td>

```gherkin
Scenario: {role.title()} can view the {entity} table

Given I am logged in as {role.title()}
When I navigate to the {pascal_plural} dashboard
Then I should see the {entity} table
And the table should display {singular} information
```

</td>
<td>

```gherkin
Scenario: {role_es} puede ver la tabla de {entity}

Given estoy logueado como {role_es}
When navego al dashboard de {pascal_plural}
Then deberia ver la tabla de {entity}
And la tabla deberia mostrar informacion de {singular_es}
```

</td>
</tr>
</table>

---

### {role_upper}_{entity_upper}_READ_002: View {singular} details

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Espanol</th>
</tr>
<tr>
<td>

```gherkin
Scenario: {role.title()} can view individual {singular} details

Given I am logged in as {role.title()}
And there is at least one {singular} in the list
When I click on a {singular} row
Then I should be navigated to the {singular} detail page
And the URL should contain the {singular} ID
And I should see the complete {singular} information
```

</td>
<td>

```gherkin
Scenario: {role_es} puede ver detalles de un/a {singular_es}

Given estoy logueado como {role_es}
And existe al menos un/a {singular_es} en la lista
When hago clic en una fila de {singular_es}
Then deberia ser navegado a la pagina de detalle
And la URL deberia contener el ID del/la {singular_es}
And deberia ver la informacion completa
```

</td>
</tr>
</table>

---

## UPDATE - {role.title()} can update {entity}

### {role_upper}_{entity_upper}_UPDATE_001: Edit existing {singular}

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Espanol</th>
</tr>
<tr>
<td>

```gherkin
Scenario: {role.title()} can modify {singular} information

Given I am logged in as {role.title()}
And there is at least one {singular} in the list
When I click the "Edit" button on a {singular} row
Then the {singular} edit form should appear
And the form should be pre-filled with current {singular} data

When I change the Title to "Updated {pascal_singular}"
And I click the "Save" button
Then the changes should be saved successfully
And I should be redirected to the {entity} list
And I should see "Updated {pascal_singular}" in the list
```

</td>
<td>

```gherkin
Scenario: {role_es} puede modificar informacion de {singular_es}

Given estoy logueado como {role_es}
And existe al menos un/a {singular_es} en la lista
When hago clic en el boton "Editar" de una fila
Then deberia aparecer el formulario de edicion
And el formulario deberia estar pre-llenado con datos actuales

When cambio el Titulo a "Actualizado/a {pascal_singular}"
And hago clic en el boton "Guardar"
Then los cambios deberian guardarse exitosamente
And deberia ser redirigido a la lista de {entity}
And deberia ver "Actualizado/a {pascal_singular}" en la lista
```

</td>
</tr>
</table>

---

## DELETE - {role.title()} can delete {entity}

### {role_upper}_{entity_upper}_DELETE_001: Delete existing {singular} `@critical`

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Espanol</th>
</tr>
<tr>
<td>

```gherkin
Scenario: {role.title()} can permanently delete a {singular}

Given I am logged in as {role.title()}
And I have created a {singular} called "{pascal_singular} to Delete"
When I click on the {singular} to view details
And I click the "Delete" button
Then a confirmation dialog should appear

When I confirm the deletion
Then a second confirmation dialog should appear
When I confirm again
Then the {singular} should be deleted
And I should be redirected to the {entity} list
And "{pascal_singular} to Delete" should no longer appear in the list
```

</td>
<td>

```gherkin
Scenario: {role_es} puede eliminar permanentemente un/a {singular_es}

Given estoy logueado como {role_es}
And he creado un/a {singular_es} llamado/a "{pascal_singular} a Eliminar"
When hago clic en el/la {singular_es} para ver detalles
And hago clic en el boton "Eliminar"
Then deberia aparecer un dialogo de confirmacion

When confirmo la eliminacion
Then deberia aparecer un segundo dialogo de confirmacion
When confirmo nuevamente
Then el/la {singular_es} deberia ser eliminado/a
And deberia ser redirigido a la lista de {entity}
And "{pascal_singular} a Eliminar" ya no deberia aparecer en la lista
```

</td>
</tr>
</table>

**Deletion Flow (2-step confirmation):**
```
[Detail Page] -> [Delete Button] -> [Confirm Dialog 1] -> [Confirm Dialog 2] -> [{pascal_singular} Deleted]
```

> **Note:** The double confirmation is a safety feature to prevent accidental deletions.

---

## Summary

| Test ID | Operation | Description | Tags |
|---------|-----------|-------------|------|
| {role_upper}_{entity_upper}_CREATE_001 | CREATE | Create {singular} with title | `@smoke` `@critical` |
| {role_upper}_{entity_upper}_CREATE_002 | CREATE | Create {singular} with all fields | |
| {role_upper}_{entity_upper}_READ_001 | READ | View {singular} list | `@smoke` `@critical` |
| {role_upper}_{entity_upper}_READ_002 | READ | View {singular} details | |
| {role_upper}_{entity_upper}_UPDATE_001 | UPDATE | Edit existing {singular} | |
| {role_upper}_{entity_upper}_DELETE_001 | DELETE | Delete {singular} | `@critical` |
'''


def main():
    parser = argparse.ArgumentParser(description='Generate UAT test file')
    parser.add_argument('--entity', required=True, help='Entity name (e.g., tasks)')
    parser.add_argument('--theme', default='default', help='Theme name')
    parser.add_argument('--role', required=True, help='Role name (owner, admin, member, editor, viewer)')
    parser.add_argument('--session', default=None, help='Session name for @scope tag')
    parser.add_argument('--with-bdd', action='store_true', help='Generate BDD documentation')
    parser.add_argument('--dry-run', action='store_true', help='Preview without writing')
    parser.add_argument('--output', default=None, help='Output directory path')

    args = parser.parse_args()

    entity = args.entity.lower()
    role = args.role.lower()
    theme = args.theme

    print(f"\n{'=' * 60}")
    print("GENERATING UAT TEST")
    print(f"{'=' * 60}")
    print(f"Entity: {entity}")
    print(f"Role: {role}")
    print(f"Theme: {theme}")
    print(f"Session: {args.session or '(none)'}")
    print(f"With BDD: {args.with_bdd}")
    print(f"{'=' * 60}\n")

    # Generate test content
    test_content = generate_test_content(entity, role, theme, args.session)

    # Determine output paths
    if args.output:
        output_dir = Path(args.output)
    else:
        output_dir = Path(f'contents/themes/{theme}/tests/cypress/e2e/uat/{entity}')

    test_file = output_dir / f'{entity}-{role}.cy.ts'
    bdd_file = output_dir / f'{entity}-{role}.bdd.md'

    if args.dry_run:
        print("DRY RUN - Generated test content:\n")
        print("-" * 60)
        print(test_content[:2000] + "\n... (truncated)")
        print("-" * 60)

        if args.with_bdd:
            bdd_content = generate_bdd_content(entity, role, theme)
            print("\nDRY RUN - Generated BDD content:\n")
            print("-" * 60)
            print(bdd_content[:2000] + "\n... (truncated)")
            print("-" * 60)

        print("\nRun without --dry-run to write files.")
        return 0

    # Create directories
    output_dir.mkdir(parents=True, exist_ok=True)

    # Write test file
    with open(test_file, 'w', encoding='utf-8') as f:
        f.write(test_content)
    print(f"Test file generated: {test_file}")

    # Write BDD file if requested
    if args.with_bdd:
        bdd_content = generate_bdd_content(entity, role, theme)
        with open(bdd_file, 'w', encoding='utf-8') as f:
            f.write(bdd_content)
        print(f"BDD file generated: {bdd_file}")

    print(f"\n{'=' * 60}")
    print("NEXT STEPS:")
    print("=" * 60)
    print(f"1. Review generated file(s)")
    print(f"2. Customize TODO sections based on entity schema")
    print(f"3. Ensure {to_pascal_case(entity)}POM exists in src/entities/")
    print(f"4. Run tests: pnpm cy:run --spec \"{test_file}\"")
    print("=" * 60 + "\n")

    return 0


if __name__ == '__main__':
    sys.exit(main())
