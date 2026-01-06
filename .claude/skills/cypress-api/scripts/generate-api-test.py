#!/usr/bin/env python3
"""
Generate API Test Script

Generates an API test file and optional BDD documentation for an entity.

Usage:
    python generate-api-test.py --entity ENTITY [--theme THEME] [--session SESSION] [--with-bdd]

Options:
    --entity ENTITY   Entity name (e.g., tasks, customers)
    --theme THEME     Theme name (default: default)
    --session SESSION Session name for @scope tag
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


def generate_test_content(
    entity: str,
    theme: str,
    session: Optional[str] = None
) -> str:
    """Generate the API test file content."""
    singular = to_singular(entity)
    pascal_singular = to_pascal_case(singular)
    pascal_plural = to_pascal_case(entity)
    entity_upper = entity.upper()
    timestamp = datetime.now().strftime('%Y-%m-%d')
    session_name = session or 'manual'

    # Build tags
    tags = [f"'@api'", f"'@feat-{entity}'", "'@crud'", "'@regression'"]
    if session:
        tags.append(f"'@scope-{session}'")
    tags_str = ', '.join(tags)

    return f'''/// <reference types="cypress" />

/**
 * {pascal_plural} API - CRUD Tests
 *
 * Generated: {timestamp}
 * Session: {session_name}
 *
 * Basic CRUD operations for /api/v1/{entity} endpoints
 * Uses superadmin API key for full access with team context
 */

import * as allure from 'allure-cypress'

const {pascal_plural}APIController = require('../../src/controllers/{pascal_plural}APIController.js')

describe('{pascal_plural} API - CRUD Operations', {{
  tags: [{tags_str}]
}}, () => {{
  let api: any
  let createdEntities: any[] = []

  // Superadmin API key for testing
  // TODO: Replace with your test API key from fixtures or environment
  const SUPERADMIN_API_KEY = Cypress.env('SUPERADMIN_API_KEY') || 'sk_test_...'
  const TEAM_ID = Cypress.env('TEAM_ID') || 'team-tmt-001'
  const BASE_URL = Cypress.config('baseUrl') || 'http://localhost:5173'

  before(() => {{
    // Initialize API controller with superadmin API key and team context
    api = new {pascal_plural}APIController(BASE_URL, SUPERADMIN_API_KEY, TEAM_ID)
    cy.log('{pascal_plural}APIController initialized')
    cy.log(`Base URL: ${{BASE_URL}}`)
    cy.log(`Team ID: ${{TEAM_ID}}`)
  }})

  beforeEach(() => {{
    allure.epic('API')
    allure.feature('{pascal_plural}')
  }})

  afterEach(() => {{
    // Cleanup: Delete entities created during tests
    if (createdEntities.length > 0) {{
      createdEntities.forEach((entity: any) => {{
        if (entity && entity.id) {{
          api.delete{pascal_singular}(entity.id)
        }}
      }})
      createdEntities = []
    }}
  }})

  // ============================================================
  // GET /api/v1/{entity} - List {pascal_plural}
  // ============================================================
  describe('GET /api/v1/{entity} - List {pascal_plural}', () => {{
    it('{entity_upper}_API_001: Should list {entity} with valid API key', {{ tags: '@smoke' }}, () => {{
      allure.story('CRUD Operations')
      allure.severity('critical')
      api.get{pascal_plural}().then((response: any) => {{
        api.validateSuccessResponse(response, 200)
        api.validatePaginatedResponse(response)
        expect(response.body.data).to.be.an('array')

        cy.log(`Found ${{response.body.data.length}} {entity}`)
        cy.log(`Total: ${{response.body.info.total}}`)
      }})
    }})

    it('{entity_upper}_API_002: Should list {entity} with pagination', () => {{
      api.get{pascal_plural}({{ page: 1, limit: 5 }}).then((response: any) => {{
        api.validatePaginatedResponse(response)
        expect(response.body.info.page).to.eq(1)
        expect(response.body.info.limit).to.eq(5)
        expect(response.body.data.length).to.be.at.most(5)

        cy.log(`Page 1, Limit 5: Got ${{response.body.data.length}} {entity}`)
      }})
    }})

    it('{entity_upper}_API_003: Should reject request without API key', () => {{
      const originalApiKey = api.apiKey
      api.setApiKey(null)

      api.get{pascal_plural}().then((response: any) => {{
        expect(response.status).to.eq(401)
        expect(response.body.success).to.be.false
      }})

      api.setApiKey(originalApiKey)
    }})

    it('{entity_upper}_API_004: Should reject request without x-team-id', () => {{
      const originalTeamId = api.teamId
      api.setTeamId(null)

      api.get{pascal_plural}().then((response: any) => {{
        expect(response.status).to.eq(400)
        expect(response.body.success).to.be.false
        expect(response.body.code).to.eq('TEAM_CONTEXT_REQUIRED')
      }})

      api.setTeamId(originalTeamId)
    }})
  }})

  // ============================================================
  // POST /api/v1/{entity} - Create {pascal_singular}
  // ============================================================
  describe('POST /api/v1/{entity} - Create {pascal_singular}', () => {{
    it('{entity_upper}_API_010: Should create {singular} with valid data', {{ tags: '@smoke' }}, () => {{
      allure.story('CRUD Operations')
      allure.severity('critical')

      // TODO: Customize test data based on entity schema
      const data = api.generateRandom{pascal_singular}Data({{
        // Add required fields here
      }})

      api.create{pascal_singular}(data).then((response: any) => {{
        api.validateSuccessResponse(response, 201)
        api.validate{pascal_singular}Object(response.body.data)

        // TODO: Add entity-specific validations
        // expect(response.body.data.title).to.eq(data.title)

        createdEntities.push(response.body.data)
        cy.log(`Created {singular}: ${{response.body.data.id}}`)
      }})
    }})

    it('{entity_upper}_API_011: Should create {singular} with minimal data', () => {{
      // TODO: Customize with minimal required fields
      const data = api.generateRandom{pascal_singular}Data()

      api.create{pascal_singular}(data).then((response: any) => {{
        api.validateSuccessResponse(response, 201)
        api.validate{pascal_singular}Object(response.body.data)

        createdEntities.push(response.body.data)
        cy.log(`Created {singular} with defaults: ${{response.body.data.id}}`)
      }})
    }})

    it('{entity_upper}_API_012: Should reject creation without x-team-id', () => {{
      const originalTeamId = api.teamId
      api.setTeamId(null)

      const data = api.generateRandom{pascal_singular}Data()

      api.create{pascal_singular}(data).then((response: any) => {{
        expect(response.status).to.eq(400)
        expect(response.body.success).to.be.false
        expect(response.body.code).to.eq('TEAM_CONTEXT_REQUIRED')
      }})

      api.setTeamId(originalTeamId)
    }})
  }})

  // ============================================================
  // GET /api/v1/{entity}/{{id}} - Get {pascal_singular} by ID
  // ============================================================
  describe('GET /api/v1/{entity}/{{id}} - Get {pascal_singular} by ID', () => {{
    let testEntity: any

    beforeEach(() => {{
      const data = api.generateRandom{pascal_singular}Data()

      api.create{pascal_singular}(data).then((response: any) => {{
        testEntity = response.body.data
        createdEntities.push(testEntity)
      }})
    }})

    it('{entity_upper}_API_020: Should get {singular} by valid ID', () => {{
      cy.then(() => {{
        api.get{pascal_singular}ById(testEntity.id).then((response: any) => {{
          api.validateSuccessResponse(response, 200)
          api.validate{pascal_singular}Object(response.body.data)

          expect(response.body.data.id).to.eq(testEntity.id)

          cy.log(`Got {singular} by ID: ${{testEntity.id}}`)
        }})
      }})
    }})

    it('{entity_upper}_API_021: Should return 404 for non-existent {singular}', () => {{
      const nonExistentId = 'non-existent-id-12345'

      api.get{pascal_singular}ById(nonExistentId).then((response: any) => {{
        expect(response.status).to.eq(404)
        expect(response.body.success).to.be.false
      }})
    }})
  }})

  // ============================================================
  // PATCH /api/v1/{entity}/{{id}} - Update {pascal_singular}
  // ============================================================
  describe('PATCH /api/v1/{entity}/{{id}} - Update {pascal_singular}', () => {{
    let testEntity: any

    beforeEach(() => {{
      const data = api.generateRandom{pascal_singular}Data()

      api.create{pascal_singular}(data).then((response: any) => {{
        testEntity = response.body.data
        createdEntities.push(testEntity)
      }})
    }})

    it('{entity_upper}_API_030: Should update {singular} with valid data', () => {{
      // TODO: Customize update data based on entity schema
      const updateData = {{
        // title: 'Updated Title'
      }}

      cy.then(() => {{
        api.update{pascal_singular}(testEntity.id, updateData).then((response: any) => {{
          api.validateSuccessResponse(response, 200)
          api.validate{pascal_singular}Object(response.body.data)

          // TODO: Add entity-specific validations
          // expect(response.body.data.title).to.eq(updateData.title)
          expect(response.body.data.id).to.eq(testEntity.id)

          cy.log(`Updated {singular}: ${{testEntity.id}}`)
        }})
      }})
    }})

    it('{entity_upper}_API_031: Should return 404 for non-existent {singular}', () => {{
      const nonExistentId = 'non-existent-id-12345'
      const updateData = {{ /* minimal update */ }}

      api.update{pascal_singular}(nonExistentId, updateData).then((response: any) => {{
        expect(response.status).to.eq(404)
        expect(response.body.success).to.be.false
      }})
    }})

    it('{entity_upper}_API_032: Should reject empty update body', () => {{
      cy.then(() => {{
        api.update{pascal_singular}(testEntity.id, {{}}).then((response: any) => {{
          expect(response.status).to.eq(400)
          expect(response.body.success).to.be.false
        }})
      }})
    }})
  }})

  // ============================================================
  // DELETE /api/v1/{entity}/{{id}} - Delete {pascal_singular}
  // ============================================================
  describe('DELETE /api/v1/{entity}/{{id}} - Delete {pascal_singular}', () => {{
    let testEntity: any

    beforeEach(() => {{
      const data = api.generateRandom{pascal_singular}Data()

      api.create{pascal_singular}(data).then((response: any) => {{
        testEntity = response.body.data
        // Don't add to createdEntities - we'll delete manually
      }})
    }})

    it('{entity_upper}_API_040: Should delete {singular} by valid ID', () => {{
      cy.then(() => {{
        api.delete{pascal_singular}(testEntity.id).then((response: any) => {{
          api.validateSuccessResponse(response, 200)
          expect(response.body.data.success).to.be.true
          expect(response.body.data.id).to.exist

          cy.log(`Deleted {singular}: ${{testEntity.id}}`)

          // Verify deletion
          api.get{pascal_singular}ById(testEntity.id).then((getResponse: any) => {{
            expect(getResponse.status).to.eq(404)
          }})
        }})
      }})
    }})

    it('{entity_upper}_API_041: Should return 404 for non-existent {singular}', () => {{
      const nonExistentId = 'non-existent-id-12345'

      api.delete{pascal_singular}(nonExistentId).then((response: any) => {{
        expect(response.status).to.eq(404)
        expect(response.body.success).to.be.false
      }})

      // Add testEntity to cleanup since we didn't delete it
      createdEntities.push(testEntity)
    }})
  }})

  // ============================================================
  // Integration Test - Complete CRUD Lifecycle
  // ============================================================
  describe('Integration - Complete CRUD Lifecycle', () => {{
    it('{entity_upper}_API_100: Should complete full lifecycle: Create -> Read -> Update -> Delete', () => {{
      // TODO: Customize test data
      const createData = api.generateRandom{pascal_singular}Data()

      // 1. CREATE
      api.create{pascal_singular}(createData).then((createResponse: any) => {{
        api.validateSuccessResponse(createResponse, 201)
        const created = createResponse.body.data
        cy.log(`1. Created: ${{created.id}}`)

        // 2. READ
        api.get{pascal_singular}ById(created.id).then((readResponse: any) => {{
          api.validateSuccessResponse(readResponse, 200)
          expect(readResponse.body.data.id).to.eq(created.id)
          cy.log(`2. Read: ${{created.id}}`)

          // 3. UPDATE
          const updateData = {{
            // TODO: Add update fields
          }}
          api.update{pascal_singular}(created.id, updateData).then((updateResponse: any) => {{
            api.validateSuccessResponse(updateResponse, 200)
            cy.log(`3. Updated: ${{created.id}}`)

            // 4. DELETE
            api.delete{pascal_singular}(created.id).then((deleteResponse: any) => {{
              api.validateSuccessResponse(deleteResponse, 200)
              expect(deleteResponse.body.data.success).to.be.true
              cy.log(`4. Deleted: ${{created.id}}`)

              // 5. VERIFY DELETION
              api.get{pascal_singular}ById(created.id).then((finalResponse: any) => {{
                expect(finalResponse.status).to.eq(404)
                cy.log(`5. Verified deletion: 404`)
                cy.log('Full CRUD lifecycle completed successfully')
              }})
            }})
          }})
        }})
      }})
    }})
  }})
}})
'''


def generate_bdd_content(entity: str, theme: str) -> str:
    """Generate the BDD documentation file content."""
    singular = to_singular(entity)
    pascal_singular = to_pascal_case(singular)
    pascal_plural = to_pascal_case(entity)
    entity_upper = entity.upper()

    return f'''---
feature: {pascal_plural} API
priority: high
tags: [api, feat-{entity}, crud, regression]
grepTags: ["@api", "@feat-{entity}"]
coverage: 14 tests
---

# {pascal_plural} API

> API tests for /api/v1/{entity} CRUD endpoints. Uses superadmin API key with team context.

## Endpoints Covered

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/{entity}` | GET | List {entity} (paginated) |
| `/api/v1/{entity}` | POST | Create new {singular} |
| `/api/v1/{entity}/{{id}}` | GET | Get {singular} by ID |
| `/api/v1/{entity}/{{id}}` | PATCH | Update {singular} |
| `/api/v1/{entity}/{{id}}` | DELETE | Delete {singular} |

---

## @test {entity_upper}_API_001: List {entity} with valid API key

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** api, {entity}, list, authentication
- **Grep:** `@smoke @feat-{entity}`

```gherkin:en
Scenario: List {entity} with valid authentication

Given I have a valid superadmin API key
And I have x-team-id header set to a valid team
When I make a GET request to /api/v1/{entity}
Then the response status should be 200
And the response body should have success true
And the data should be an array of {entity}
And the info should contain total, page, and limit
```

```gherkin:es
Scenario: Listar {entity} con autenticacion valida

Given tengo una API key de superadmin valida
And tengo el header x-team-id configurado con un team valido
When hago una solicitud GET a /api/v1/{entity}
Then el status de respuesta deberia ser 200
And el body deberia tener success true
And los datos deberian ser un array de {entity}
And info deberia contener total, page y limit
```

---

## @test {entity_upper}_API_002: List {entity} with pagination

### Metadata
- **Priority:** Normal
- **Type:** Functional
- **Tags:** api, {entity}, pagination

```gherkin:en
Scenario: List {entity} with pagination parameters

Given I have valid authentication
When I make a GET request to /api/v1/{entity}?page=1&limit=5
Then the response status should be 200
And info.page should be 1
And info.limit should be 5
And data array length should be at most 5
```

```gherkin:es
Scenario: Listar {entity} con parametros de paginacion

Given tengo autenticacion valida
When hago una solicitud GET a /api/v1/{entity}?page=1&limit=5
Then el status de respuesta deberia ser 200
And info.page deberia ser 1
And info.limit deberia ser 5
And la longitud del array data deberia ser maximo 5
```

---

## @test {entity_upper}_API_003: Reject request without API key

### Metadata
- **Priority:** Critical
- **Type:** Security
- **Tags:** api, {entity}, authentication, 401

```gherkin:en
Scenario: Request without API key returns 401

Given I make a request without Authorization header
When I make a GET request to /api/v1/{entity}
Then the response status should be 401
And the response body should have success false
```

```gherkin:es
Scenario: Solicitud sin API key retorna 401

Given hago una solicitud sin header Authorization
When hago una solicitud GET a /api/v1/{entity}
Then el status de respuesta deberia ser 401
And el body deberia tener success false
```

---

## @test {entity_upper}_API_004: Reject request without x-team-id

### Metadata
- **Priority:** Critical
- **Type:** Security
- **Tags:** api, {entity}, team-context, 400

```gherkin:en
Scenario: Request without x-team-id returns 400

Given I have a valid API key
But I do not include x-team-id header
When I make a GET request to /api/v1/{entity}
Then the response status should be 400
And the error code should be TEAM_CONTEXT_REQUIRED
```

```gherkin:es
Scenario: Solicitud sin x-team-id retorna 400

Given tengo una API key valida
But no incluyo el header x-team-id
When hago una solicitud GET a /api/v1/{entity}
Then el status de respuesta deberia ser 400
And el codigo de error deberia ser TEAM_CONTEXT_REQUIRED
```

---

## @test {entity_upper}_API_010: Create {singular} with valid data

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** api, {entity}, create, 201

```gherkin:en
Scenario: Create new {singular} successfully

Given I have valid authentication and team context
And I have valid {singular} data
When I make a POST request to /api/v1/{entity}
Then the response status should be 201
And the response body should have success true
And the data should contain the created {singular} with an ID
```

```gherkin:es
Scenario: Crear nuevo/a {singular} exitosamente

Given tengo autenticacion y contexto de team validos
And tengo datos de {singular} validos
When hago una solicitud POST a /api/v1/{entity}
Then el status de respuesta deberia ser 201
And el body deberia tener success true
And los datos deberian contener el/la {singular} creado/a con un ID
```

---

## @test {entity_upper}_API_020: Get {singular} by valid ID

### Metadata
- **Priority:** Normal
- **Type:** Functional
- **Tags:** api, {entity}, read

```gherkin:en
Scenario: Get {singular} by valid ID

Given I have valid authentication
And a {singular} exists with a known ID
When I make a GET request to /api/v1/{entity}/{{id}}
Then the response status should be 200
And the data should contain the {singular} details
And data.id should match the requested ID
```

```gherkin:es
Scenario: Obtener {singular} por ID valido

Given tengo autenticacion valida
And existe un/a {singular} con un ID conocido
When hago una solicitud GET a /api/v1/{entity}/{{id}}
Then el status de respuesta deberia ser 200
And los datos deberian contener los detalles del/la {singular}
And data.id deberia coincidir con el ID solicitado
```

---

## @test {entity_upper}_API_021: Return 404 for non-existent {singular}

### Metadata
- **Priority:** Normal
- **Type:** Functional
- **Tags:** api, {entity}, 404

```gherkin:en
Scenario: Get non-existent {singular} returns 404

Given I have valid authentication
When I make a GET request to /api/v1/{entity}/non-existent-id
Then the response status should be 404
And the response body should have success false
```

```gherkin:es
Scenario: Obtener {singular} inexistente retorna 404

Given tengo autenticacion valida
When hago una solicitud GET a /api/v1/{entity}/id-inexistente
Then el status de respuesta deberia ser 404
And el body deberia tener success false
```

---

## @test {entity_upper}_API_030: Update {singular} with valid data

### Metadata
- **Priority:** Normal
- **Type:** Functional
- **Tags:** api, {entity}, update

```gherkin:en
Scenario: Update {singular} successfully

Given I have valid authentication
And a {singular} exists with a known ID
And I have valid update data
When I make a PATCH request to /api/v1/{entity}/{{id}}
Then the response status should be 200
And the data should contain the updated {singular}
And the updated fields should reflect my changes
```

```gherkin:es
Scenario: Actualizar {singular} exitosamente

Given tengo autenticacion valida
And existe un/a {singular} con un ID conocido
And tengo datos de actualizacion validos
When hago una solicitud PATCH a /api/v1/{entity}/{{id}}
Then el status de respuesta deberia ser 200
And los datos deberian contener el/la {singular} actualizado/a
And los campos actualizados deberian reflejar mis cambios
```

---

## @test {entity_upper}_API_040: Delete {singular} by valid ID

### Metadata
- **Priority:** Normal
- **Type:** Functional
- **Tags:** api, {entity}, delete

```gherkin:en
Scenario: Delete {singular} successfully

Given I have valid authentication
And a {singular} exists with a known ID
When I make a DELETE request to /api/v1/{entity}/{{id}}
Then the response status should be 200
And data.success should be true
And subsequent GET for the same ID should return 404
```

```gherkin:es
Scenario: Eliminar {singular} exitosamente

Given tengo autenticacion valida
And existe un/a {singular} con un ID conocido
When hago una solicitud DELETE a /api/v1/{entity}/{{id}}
Then el status de respuesta deberia ser 200
And data.success deberia ser true
And un GET posterior para el mismo ID deberia retornar 404
```

---

## @test {entity_upper}_API_100: Complete CRUD Lifecycle

### Metadata
- **Priority:** Critical
- **Type:** Integration
- **Tags:** api, {entity}, integration, lifecycle

```gherkin:en
Scenario: Complete CRUD lifecycle (Create -> Read -> Update -> Delete)

Given I have valid authentication and team context
When I create a new {singular}
Then the {singular} should be created with status 201

When I read the created {singular} by ID
Then I should get the {singular} details with status 200

When I update the {singular} with new data
Then the {singular} should be updated with status 200

When I delete the {singular}
Then the {singular} should be deleted with status 200

When I try to read the deleted {singular}
Then I should get a 404 response
```

```gherkin:es
Scenario: Ciclo de vida CRUD completo (Crear -> Leer -> Actualizar -> Eliminar)

Given tengo autenticacion y contexto de team validos
When creo un/a nuevo/a {singular}
Then el/la {singular} deberia crearse con status 201

When leo el/la {singular} creado/a por ID
Then deberia obtener los detalles con status 200

When actualizo el/la {singular} con nuevos datos
Then el/la {singular} deberia actualizarse con status 200

When elimino el/la {singular}
Then el/la {singular} deberia eliminarse con status 200

When intento leer el/la {singular} eliminado/a
Then deberia obtener una respuesta 404
```

---

## Response Formats

### Success Response (200/201)

```json
{{
  "success": true,
  "data": {{ ... }},
  "info": {{
    "total": 10,
    "page": 1,
    "limit": 10
  }}
}}
```

### Error Response (400 - TEAM_CONTEXT_REQUIRED)

```json
{{
  "success": false,
  "error": {{
    "message": "Team context required",
    "code": "TEAM_CONTEXT_REQUIRED",
    "details": {{
      "hint": "Include x-team-id header with valid team ID"
    }}
  }}
}}
```

### Error Response (401 - Unauthorized)

```json
{{
  "success": false,
  "error": {{
    "message": "Authentication required",
    "code": "AUTHENTICATION_REQUIRED",
    "details": {{
      "hint": "Provide valid API key via Authorization or x-api-key header"
    }}
  }}
}}
```

### Error Response (404 - Not Found)

```json
{{
  "success": false,
  "error": {{
    "message": "{pascal_singular} not found",
    "code": "NOT_FOUND"
  }}
}}
```

---

## Test Summary

| Test ID | Endpoint | Method | Description | Tags |
|---------|----------|--------|-------------|------|
| {entity_upper}_API_001 | /{entity} | GET | List with valid auth | `@smoke` |
| {entity_upper}_API_002 | /{entity} | GET | List with pagination | |
| {entity_upper}_API_003 | /{entity} | GET | 401 without API key | |
| {entity_upper}_API_004 | /{entity} | GET | 400 without x-team-id | |
| {entity_upper}_API_010 | /{entity} | POST | Create with valid data | `@smoke` |
| {entity_upper}_API_011 | /{entity} | POST | Create with minimal data | |
| {entity_upper}_API_012 | /{entity} | POST | 400 without x-team-id | |
| {entity_upper}_API_020 | /{entity}/{{id}} | GET | Get by valid ID | |
| {entity_upper}_API_021 | /{entity}/{{id}} | GET | 404 non-existent | |
| {entity_upper}_API_030 | /{entity}/{{id}} | PATCH | Update with valid data | |
| {entity_upper}_API_031 | /{entity}/{{id}} | PATCH | 404 non-existent | |
| {entity_upper}_API_032 | /{entity}/{{id}} | PATCH | 400 empty body | |
| {entity_upper}_API_040 | /{entity}/{{id}} | DELETE | Delete by valid ID | |
| {entity_upper}_API_041 | /{entity}/{{id}} | DELETE | 404 non-existent | |
| {entity_upper}_API_100 | All | All | Full CRUD lifecycle | |
'''


def main():
    parser = argparse.ArgumentParser(description='Generate API test file')
    parser.add_argument('--entity', required=True, help='Entity name (e.g., tasks)')
    parser.add_argument('--theme', default='default', help='Theme name')
    parser.add_argument('--session', default=None, help='Session name for @scope tag')
    parser.add_argument('--with-bdd', action='store_true', help='Generate BDD documentation')
    parser.add_argument('--dry-run', action='store_true', help='Preview without writing')
    parser.add_argument('--output', default=None, help='Output directory path')

    args = parser.parse_args()

    entity = args.entity.lower()
    theme = args.theme

    print(f"\n{'=' * 60}")
    print("GENERATING API TEST")
    print(f"{'=' * 60}")
    print(f"Entity: {entity}")
    print(f"Theme: {theme}")
    print(f"Session: {args.session or '(none)'}")
    print(f"With BDD: {args.with_bdd}")
    print(f"{'=' * 60}\n")

    # Generate test content
    test_content = generate_test_content(entity, theme, args.session)

    # Determine output paths
    if args.output:
        output_dir = Path(args.output)
    else:
        output_dir = Path(f'contents/themes/{theme}/tests/cypress/e2e/api/entities')

    test_file = output_dir / f'{entity}-crud.cy.ts'
    bdd_file = output_dir / f'{entity}-crud.bdd.md'

    if args.dry_run:
        print("DRY RUN - Generated test content:\n")
        print("-" * 60)
        print(test_content[:2000] + "\n... (truncated)")
        print("-" * 60)

        if args.with_bdd:
            bdd_content = generate_bdd_content(entity, theme)
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
        bdd_content = generate_bdd_content(entity, theme)
        with open(bdd_file, 'w', encoding='utf-8') as f:
            f.write(bdd_content)
        print(f"BDD file generated: {bdd_file}")

    pascal_plural = to_pascal_case(entity)
    pascal_singular = to_pascal_case(to_singular(entity))

    print(f"\n{'=' * 60}")
    print("NEXT STEPS:")
    print("=" * 60)
    print(f"1. Review generated file(s)")
    print(f"2. Ensure {pascal_plural}APIController exists in src/controllers/")
    print(f"3. Customize generateRandom{pascal_singular}Data() with entity fields")
    print(f"4. Customize TODO sections in test file")
    print(f"5. Run tests: pnpm cy:run --spec \"{test_file}\"")
    print("=" * 60 + "\n")

    return 0


if __name__ == '__main__':
    sys.exit(main())
