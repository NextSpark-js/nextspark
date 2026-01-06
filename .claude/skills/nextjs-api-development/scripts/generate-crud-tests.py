#!/usr/bin/env python3
"""
Generate CRUD Tests Script

Generates Cypress API tests for entity CRUD operations.
Uses the project's API Controller pattern with BaseAPIController.

Usage:
    python generate-crud-tests.py --entity ENTITY_NAME [--with-controller]

Options:
    --entity ENTITY_NAME   Name of the entity (kebab-case)
    --theme THEME          Theme name for theme-specific tests
    --with-controller      Also generate the API Controller class
    --dry-run              Preview without creating files
"""

import os
import sys
import argparse
from pathlib import Path
from datetime import datetime


def to_camel_case(name: str) -> str:
    """Convert kebab-case to camelCase."""
    components = name.split('-')
    return components[0] + ''.join(x.title() for x in components[1:])


def to_pascal_case(name: str) -> str:
    """Convert kebab-case to PascalCase."""
    return ''.join(x.title() for x in name.split('-'))


def get_active_theme() -> str:
    """Get active theme from environment or default."""
    return os.environ.get('NEXT_PUBLIC_ACTIVE_THEME', 'default')


def generate_api_controller(entity: str) -> str:
    """Generate API Controller class following BaseAPIController pattern."""
    pascal = to_pascal_case(entity)
    singular = entity.rstrip('s')

    return f'''/**
 * {pascal}APIController - Controller for interacting with the {pascal} API
 * Encapsulates all CRUD operations for /api/v1/{entity} endpoints
 *
 * Requires:
 * - API Key with {entity}:read, {entity}:write scopes (or superadmin with *)
 * - x-team-id header for team context
 */
const BaseAPIController = require('./BaseAPIController')
const entitiesConfig = require('../../fixtures/entities.json')

const {{ slug }} = entitiesConfig.entities.{to_camel_case(entity)} || {{ slug: '{entity}' }}

class {pascal}APIController extends BaseAPIController {{
  /**
   * @param {{string}} baseUrl - Base URL for API requests
   * @param {{string|null}} apiKey - API key for authentication
   * @param {{string|null}} teamId - Team ID for x-team-id header
   */
  constructor(baseUrl = 'http://localhost:5173', apiKey = null, teamId = null) {{
    super(baseUrl, apiKey, teamId, {{ slug }})
  }}

  // ============================================================
  // SEMANTIC ALIASES
  // ============================================================

  /**
   * GET /api/v1/{entity} - Get list of {entity}
   * @param {{Object}} options - Query options
   * @returns {{Cypress.Chainable}} Cypress response
   */
  get{pascal}(options = {{}}) {{
    return this.list(options)
  }}

  /**
   * GET /api/v1/{entity}/{{id}} - Get specific {singular} by ID
   * @param {{string}} id - {pascal} ID
   * @param {{Object}} options - Additional options
   * @returns {{Cypress.Chainable}} Cypress response
   */
  get{pascal}ById(id, options = {{}}) {{
    return this.getById(id, options)
  }}

  /**
   * POST /api/v1/{entity} - Create new {singular}
   * @param {{Object}} data - {pascal} data
   * @param {{Object}} options - Additional options
   * @returns {{Cypress.Chainable}} Cypress response
   */
  create{pascal}(data, options = {{}}) {{
    return this.create(data, options)
  }}

  /**
   * PATCH /api/v1/{entity}/{{id}} - Update {singular}
   * @param {{string}} id - {pascal} ID
   * @param {{Object}} data - Data to update
   * @param {{Object}} options - Additional options
   * @returns {{Cypress.Chainable}} Cypress response
   */
  update{pascal}(id, data, options = {{}}) {{
    return this.update(id, data, options)
  }}

  /**
   * DELETE /api/v1/{entity}/{{id}} - Delete {singular}
   * @param {{string}} id - {pascal} ID
   * @param {{Object}} options - Additional options
   * @returns {{Cypress.Chainable}} Cypress response
   */
  delete{pascal}(id, options = {{}}) {{
    return this.delete(id, options)
  }}

  // ============================================================
  // DATA GENERATORS
  // ============================================================

  /**
   * Generate random valid {singular} data
   * @param {{Object}} overrides - Properties to override
   * @returns {{Object}} Valid {singular} data
   */
  generateRandom{pascal}Data(overrides = {{}}) {{
    const timestamp = Date.now()
    return {{
      title: `Test {singular.title()} ${{timestamp}}`,
      description: `Test description for {singular} created at ${{new Date().toISOString()}}`,
      // Add more default fields as needed
      ...overrides
    }}
  }}
}}

module.exports = {pascal}APIController
'''


def generate_api_test(entity: str) -> str:
    """Generate Cypress API test file following project conventions."""
    pascal = to_pascal_case(entity)
    singular = entity.rstrip('s')
    camel = to_camel_case(entity)
    upper = entity.upper().replace('-', '_')

    return f'''/// <reference types="cypress" />

/**
 * {pascal} API - CRUD Tests
 *
 * Basic CRUD operations for /api/v1/{entity} endpoints
 * Uses superadmin API key for full access with team context
 */

import * as allure from 'allure-cypress'

const {pascal}APIController = require('../../../src/controllers/{pascal}APIController.js')

describe('{pascal} API - CRUD Operations', {{
  tags: ['@api', '@feat-{entity}', '@crud', '@regression']
}}, () => {{
  let {camel}API: any
  let createdItems: any[] = []

  // Superadmin API key for testing
  const SUPERADMIN_API_KEY = Cypress.env('SUPERADMIN_API_KEY') || 'sk_test_62fc9942407698cbe1d637c2ea91b5cf3e3e50b9052c432087a7f06f14173f62'
  const TEAM_ID = Cypress.env('TEAM_ID') || 'team-tmt-001'
  const BASE_URL = Cypress.config('baseUrl') || 'http://localhost:5173'

  before(() => {{
    // Initialize API controller with superadmin API key and team context
    {camel}API = new {pascal}APIController(BASE_URL, SUPERADMIN_API_KEY, TEAM_ID)
    cy.log('{pascal}APIController initialized')
    cy.log(`Base URL: ${{BASE_URL}}`)
    cy.log(`Team ID: ${{TEAM_ID}}`)
  }})

  beforeEach(() => {{
    allure.epic('API')
    allure.feature('{pascal}')
  }})

  afterEach(() => {{
    // Cleanup: Delete items created during tests
    if (createdItems.length > 0) {{
      createdItems.forEach((item: any) => {{
        if (item && item.id) {{
          {camel}API.delete{pascal}(item.id)
        }}
      }})
      createdItems = []
    }}
  }})

  // ============================================================
  // GET /api/v1/{entity} - List
  // ============================================================
  describe('GET /api/v1/{entity} - List', () => {{
    it('{upper}_API_001: Should list {entity} with valid API key', {{ tags: '@smoke' }}, () => {{
      allure.story('CRUD Operations')
      allure.severity('critical')
      {camel}API.get{pascal}().then((response: any) => {{
        {camel}API.validateSuccessResponse(response, 200)
        {camel}API.validatePaginatedResponse(response)
        expect(response.body.data).to.be.an('array')

        cy.log(`Found ${{response.body.data.length}} {entity}`)
        cy.log(`Total: ${{response.body.info.total}}`)
      }})
    }})

    it('{upper}_API_002: Should list {entity} with pagination', () => {{
      allure.story('CRUD Operations')
      {camel}API.get{pascal}({{ page: 1, limit: 5 }}).then((response: any) => {{
        {camel}API.validatePaginatedResponse(response)
        expect(response.body.info.page).to.eq(1)
        expect(response.body.info.limit).to.eq(5)
        expect(response.body.data.length).to.be.at.most(5)
      }})
    }})

    it('{upper}_API_003: Should return 401 without API key', () => {{
      allure.story('Authentication')
      allure.severity('critical')
      const noAuthAPI = new {pascal}APIController(BASE_URL, null, TEAM_ID)
      noAuthAPI.get{pascal}({{ failOnStatusCode: false }}).then((response: any) => {{
        expect(response.status).to.eq(401)
        expect(response.body.success).to.be.false
      }})
    }})
  }})

  // ============================================================
  // POST /api/v1/{entity} - Create
  // ============================================================
  describe('POST /api/v1/{entity} - Create', () => {{
    it('{upper}_API_010: Should create {singular} with valid data', {{ tags: '@smoke' }}, () => {{
      allure.story('CRUD Operations')
      allure.severity('critical')
      const data = {camel}API.generateRandom{pascal}Data()

      {camel}API.create{pascal}(data).then((response: any) => {{
        {camel}API.validateSuccessResponse(response, 201)
        expect(response.body.data.id).to.exist
        expect(response.body.data.title).to.eq(data.title)

        // Track for cleanup
        createdItems.push(response.body.data)

        cy.log(`Created {singular}: ${{response.body.data.id}}`)
      }})
    }})

    it('{upper}_API_011: Should return 400 with invalid data', () => {{
      allure.story('Validation')
      const invalidData = {{ title: '' }} // Empty title should fail

      {camel}API.create{pascal}(invalidData, {{ failOnStatusCode: false }}).then((response: any) => {{
        expect(response.status).to.eq(400)
        expect(response.body.success).to.be.false
      }})
    }})
  }})

  // ============================================================
  // GET /api/v1/{entity}/[id] - Read
  // ============================================================
  describe('GET /api/v1/{entity}/[id] - Read', () => {{
    let testItem: any

    beforeEach(() => {{
      // Create a test item first
      const data = {camel}API.generateRandom{pascal}Data()
      {camel}API.create{pascal}(data).then((response: any) => {{
        testItem = response.body.data
        createdItems.push(testItem)
      }})
    }})

    it('{upper}_API_020: Should get single {singular} by ID', () => {{
      allure.story('CRUD Operations')
      {camel}API.get{pascal}ById(testItem.id).then((response: any) => {{
        {camel}API.validateSuccessResponse(response, 200)
        expect(response.body.data.id).to.eq(testItem.id)
      }})
    }})

    it('{upper}_API_021: Should return 404 for non-existent ID', () => {{
      allure.story('Error Handling')
      {camel}API.get{pascal}ById('non-existent-id', {{ failOnStatusCode: false }}).then((response: any) => {{
        expect(response.status).to.eq(404)
      }})
    }})
  }})

  // ============================================================
  // PATCH /api/v1/{entity}/[id] - Update
  // ============================================================
  describe('PATCH /api/v1/{entity}/[id] - Update', () => {{
    let testItem: any

    beforeEach(() => {{
      const data = {camel}API.generateRandom{pascal}Data()
      {camel}API.create{pascal}(data).then((response: any) => {{
        testItem = response.body.data
        createdItems.push(testItem)
      }})
    }})

    it('{upper}_API_030: Should update {singular} with valid data', () => {{
      allure.story('CRUD Operations')
      const updateData = {{ title: 'Updated Title ' + Date.now() }}

      {camel}API.update{pascal}(testItem.id, updateData).then((response: any) => {{
        {camel}API.validateSuccessResponse(response, 200)
        expect(response.body.data.title).to.eq(updateData.title)
      }})
    }})

    it('{upper}_API_031: Should return 400 with invalid data', () => {{
      allure.story('Validation')
      const invalidData = {{ title: '' }}

      {camel}API.update{pascal}(testItem.id, invalidData, {{ failOnStatusCode: false }}).then((response: any) => {{
        expect(response.status).to.eq(400)
      }})
    }})
  }})

  // ============================================================
  // DELETE /api/v1/{entity}/[id] - Delete
  // ============================================================
  describe('DELETE /api/v1/{entity}/[id] - Delete', () => {{
    it('{upper}_API_040: Should delete {singular}', () => {{
      allure.story('CRUD Operations')
      const data = {camel}API.generateRandom{pascal}Data()

      // Create then delete
      {camel}API.create{pascal}(data).then((createResponse: any) => {{
        const itemId = createResponse.body.data.id

        {camel}API.delete{pascal}(itemId).then((deleteResponse: any) => {{
          {camel}API.validateSuccessResponse(deleteResponse, 200)
          expect(deleteResponse.body.data.deleted).to.be.true
        }})

        // Verify deletion
        {camel}API.get{pascal}ById(itemId, {{ failOnStatusCode: false }}).then((getResponse: any) => {{
          expect(getResponse.status).to.eq(404)
        }})
      }})
    }})
  }})

  // ============================================================
  // Edge Cases
  // ============================================================
  describe('Edge Cases', () => {{
    it('{upper}_API_050: Should enforce max limit on pagination', () => {{
      allure.story('Pagination')
      {camel}API.get{pascal}({{ limit: 1000 }}).then((response: any) => {{
        {camel}API.validateSuccessResponse(response, 200)
        expect(response.body.info.limit).to.be.lte(100)
      }})
    }})

    it('{upper}_API_051: Should handle special characters in search', () => {{
      allure.story('Security')
      {camel}API.get{pascal}({{ search: "<script>alert('xss')</script>" }}).then((response: any) => {{
        {camel}API.validateSuccessResponse(response, 200)
        // Should not crash or execute XSS
      }})
    }})
  }})
}})
'''


def main():
    parser = argparse.ArgumentParser(description='Generate CRUD API tests')
    parser.add_argument('--entity', required=True, help='Entity name (kebab-case)')
    parser.add_argument('--theme', default=None, help='Theme name')
    parser.add_argument('--with-controller', action='store_true', help='Also generate API Controller')
    parser.add_argument('--dry-run', action='store_true', help='Preview without creating files')

    args = parser.parse_args()

    theme = args.theme or get_active_theme()
    entity = args.entity.lower()
    pascal = to_pascal_case(entity)

    print(f"\n{'=' * 60}")
    print(f"GENERATING CRUD TESTS: {entity}")
    print(f"{'=' * 60}")
    print(f"Theme: {theme}")
    print(f"With Controller: {args.with_controller}")
    print(f"{'=' * 60}\n")

    # Files to generate
    base_path = Path(f'contents/themes/{theme}/tests/cypress')
    files = {
        f'e2e/api/entities/{entity}-crud.cy.ts': generate_api_test(entity)
    }

    if args.with_controller:
        files[f'src/controllers/{pascal}APIController.js'] = generate_api_controller(entity)

    if args.dry_run:
        print("DRY RUN - Files that would be created:\n")
        for file_path, content in files.items():
            full_path = base_path / file_path
            print(f"  {full_path}")
            print(f"    Lines: {len(content.splitlines())}")
        print("\n" + "-" * 60)
        print(f"TEST FILE PREVIEW ({entity}-crud.cy.ts):")
        print("-" * 60)
        print(files[f'e2e/api/entities/{entity}-crud.cy.ts'][:2000])
        print("...")
        print("-" * 60)
        print("\nRun without --dry-run to create files.")
        return 0

    # Create files
    for file_path, content in files.items():
        full_path = base_path / file_path
        full_path.parent.mkdir(parents=True, exist_ok=True)

        if full_path.exists():
            print(f"  SKIP (exists): {full_path}")
        else:
            with open(full_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"  CREATED: {full_path}")

    print(f"\n{'=' * 60}")
    print("NEXT STEPS:")
    print("=" * 60)
    print("1. Update the API Controller with entity-specific fields")
    print("2. Add entity to fixtures/entities.json if not present")
    print("3. Update test data generators with real field requirements")
    print("4. Run: pnpm cypress run --spec 'contents/themes/{}/tests/cypress/e2e/api/entities/{}-crud.cy.ts'".format(theme, entity))
    print("=" * 60 + "\n")

    return 0


if __name__ == '__main__':
    sys.exit(main())
