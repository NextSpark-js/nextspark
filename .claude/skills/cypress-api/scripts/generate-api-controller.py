#!/usr/bin/env python3
"""
Generate API Controller Script

Generates an API controller for a Cypress entity.

Usage:
    python generate-api-controller.py --entity ENTITY [--theme THEME] [--session SESSION]

Options:
    --entity ENTITY   Entity name (e.g., tasks, customers)
    --theme THEME     Theme name (default: default)
    --session SESSION Session name for comments
    --dry-run         Preview without writing to file
"""

import os
import sys
import re
import argparse
from pathlib import Path
from datetime import datetime


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


def generate_controller_content(
    entity: str,
    theme: str,
    session: str = None
) -> str:
    """Generate the API controller file content."""
    singular = to_singular(entity)
    pascal_singular = to_pascal_case(singular)
    pascal_plural = to_pascal_case(entity)
    timestamp = datetime.now().strftime('%Y-%m-%d')
    session_name = session or 'manual'

    return f'''/**
 * {pascal_plural}APIController - Controller for interacting with the {entity} API
 * Encapsulates all CRUD operations for /api/v1/{entity} endpoints
 *
 * Generated: {timestamp}
 * Session: {session_name}
 *
 * Requires:
 * - API Key with {entity}:read, {entity}:write scopes (or superadmin with *)
 * - x-team-id header for team context
 */
const BaseAPIController = require('./BaseAPIController')
const entitiesConfig = require('../fixtures/entities.json')

const {{ slug }} = entitiesConfig.entities.{entity}

class {pascal_plural}APIController extends BaseAPIController {{
  /**
   * @param {{string}} baseUrl - Base URL for API requests
   * @param {{string|null}} apiKey - API key for authentication
   * @param {{string|null}} teamId - Team ID for x-team-id header
   */
  constructor(baseUrl = 'http://localhost:5173', apiKey = null, teamId = null) {{
    super(baseUrl, apiKey, teamId, {{ slug }})
  }}

  // ============================================================
  // SEMANTIC ALIASES (for backward compatibility)
  // ============================================================

  /**
   * GET /api/v1/{entity} - Get list of {entity}
   * @param {{Object}} options - Query options
   * @param {{number}} [options.page] - Page number
   * @param {{number}} [options.limit] - Results per page
   * @param {{string}} [options.metas] - Metadata parameter ('all', 'key1,key2', etc.)
   * @param {{string}} [options.search] - Search in searchable fields
   * @param {{Object}} [options.headers] - Additional headers
   * @returns {{Cypress.Chainable}} Cypress response
   */
  get{pascal_plural}(options = {{}}) {{
    return this.list(options)
  }}

  /**
   * GET /api/v1/{entity}/{{id}} - Get specific {singular} by ID
   * @param {{string}} id - {pascal_singular} ID
   * @param {{Object}} options - Additional options
   * @returns {{Cypress.Chainable}} Cypress response
   */
  get{pascal_singular}ById(id, options = {{}}) {{
    return this.getById(id, options)
  }}

  /**
   * POST /api/v1/{entity} - Create new {singular}
   * @param {{Object}} data - {pascal_singular} data
   * @param {{Object}} options - Additional options
   * @returns {{Cypress.Chainable}} Cypress response
   */
  create{pascal_singular}(data, options = {{}}) {{
    return this.create(data, options)
  }}

  /**
   * PATCH /api/v1/{entity}/{{id}} - Update {singular}
   * @param {{string}} id - {pascal_singular} ID
   * @param {{Object}} updateData - Data to update
   * @param {{Object}} options - Additional options
   * @returns {{Cypress.Chainable}} Cypress response
   */
  update{pascal_singular}(id, updateData, options = {{}}) {{
    return this.update(id, updateData, options)
  }}

  /**
   * DELETE /api/v1/{entity}/{{id}} - Delete {singular}
   * @param {{string}} id - {pascal_singular} ID
   * @param {{Object}} options - Additional options
   * @returns {{Cypress.Chainable}} Cypress response
   */
  delete{pascal_singular}(id, options = {{}}) {{
    return this.delete(id, options)
  }}

  // ============================================================
  // DATA GENERATORS
  // ============================================================

  /**
   * Generate random {singular} data for testing
   * @param {{Object}} overrides - Specific data to override
   * @returns {{Object}} Generated {singular} data
   */
  generateRandomData(overrides = {{}}) {{
    return this.generateRandom{pascal_singular}Data(overrides)
  }}

  /**
   * Generate random {singular} data for testing
   *
   * TODO: Implement based on entity schema
   *
   * @param {{Object}} overrides - Specific data to override
   * @returns {{Object}} Generated {singular} data
   */
  generateRandom{pascal_singular}Data(overrides = {{}}) {{
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 8)

    // TODO: Customize based on your entity's required/optional fields
    return {{
      // Example fields - customize based on your entity:
      // title: `Test {pascal_singular} ${{randomId}} - ${{timestamp}}`,
      // description: `Description for test {singular} created at ${{new Date().toISOString()}}`,
      // status: 'active',
      ...overrides
    }}
  }}

  /**
   * Create a test {singular} and return its data
   * @param {{Object}} data - {pascal_singular} data (optional)
   * @returns {{Cypress.Chainable}} Promise resolving with created {singular} data
   */
  createTest{pascal_singular}(data = {{}}) {{
    return this.createTestEntity(data)
  }}

  /**
   * Clean up a test {singular} (delete it)
   * @param {{string}} id - {pascal_singular} ID
   * @returns {{Cypress.Chainable}} Delete response
   */
  cleanupTest{pascal_singular}(id) {{
    return this.cleanup(id)
  }}

  // ============================================================
  // ENTITY-SPECIFIC VALIDATORS
  // ============================================================

  /**
   * Validate {singular} object structure
   *
   * TODO: Implement validation based on entity schema
   *
   * @param {{Object}} entity - {pascal_singular} object
   * @param {{boolean}} allowMetas - If metas property is allowed
   */
  validate{pascal_singular}Object(entity, allowMetas = false) {{
    // Base fields (id, createdAt, updatedAt, teamId)
    this.validateBaseEntityFields(entity)

    // TODO: Add entity-specific field validations
    // Example:
    // expect(entity).to.have.property('title')
    // expect(entity.title).to.be.a('string')
    //
    // expect(entity).to.have.property('status')
    // expect(entity.status).to.be.oneOf(['active', 'inactive', 'archived'])

    // Validate metas if present
    if (allowMetas && entity.hasOwnProperty('metas')) {{
      expect(entity.metas).to.be.an('object')
    }}
  }}

  // ============================================================
  // METADATA HELPERS (optional)
  // ============================================================

  /**
   * Generate sample metadata for testing
   *
   * TODO: Customize based on your entity's metadata needs
   *
   * @param {{string}} type - Type of metadata
   * @returns {{Object}} Sample metadata
   */
  generateSampleMetadata(type = 'uiPreferences') {{
    const sampleMetas = {{
      uiPreferences: {{
        colorLabel: 'blue',
        collapsed: false,
        customIcon: 'star'
      }},
      customFields: {{
        // Add custom metadata fields here
      }}
    }}

    return {{ [type]: sampleMetas[type] || sampleMetas.uiPreferences }}
  }}
}}

// Export class for use in tests
module.exports = {pascal_plural}APIController

// For global use in Cypress
if (typeof window !== 'undefined') {{
  window.{pascal_plural}APIController = {pascal_plural}APIController
}}
'''


def main():
    parser = argparse.ArgumentParser(description='Generate API controller')
    parser.add_argument('--entity', required=True, help='Entity name (e.g., tasks)')
    parser.add_argument('--theme', default='default', help='Theme name')
    parser.add_argument('--session', default=None, help='Session name for comments')
    parser.add_argument('--dry-run', action='store_true', help='Preview without writing')
    parser.add_argument('--output', default=None, help='Output file path')

    args = parser.parse_args()

    entity = args.entity.lower()
    theme = args.theme
    pascal_plural = to_pascal_case(entity)

    print(f"\n{'=' * 60}")
    print("GENERATING API CONTROLLER")
    print(f"{'=' * 60}")
    print(f"Entity: {entity}")
    print(f"Theme: {theme}")
    print(f"Session: {args.session or '(none)'}")
    print(f"{'=' * 60}\n")

    # Generate content
    content = generate_controller_content(entity, theme, args.session)

    if args.dry_run:
        print("DRY RUN - Generated content:\n")
        print("-" * 60)
        print(content[:2000] + "\n... (truncated)")
        print("-" * 60)
        print("\nRun without --dry-run to write file.")
        return 0

    # Determine output path
    if args.output:
        output_path = Path(args.output)
    else:
        output_path = Path(f'contents/themes/{theme}/tests/cypress/src/controllers/{pascal_plural}APIController.js')

    # Check if file already exists
    if output_path.exists():
        print(f"WARNING: File already exists: {output_path}")
        print("Use --output to specify a different path or remove the existing file.")
        return 1

    # Create parent directories
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Write file
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"API Controller generated: {output_path}")
    print(f"\n{'=' * 60}")
    print("NEXT STEPS:")
    print("=" * 60)
    print(f"1. Review generated file: {output_path}")
    print(f"2. Customize generateRandom{to_pascal_case(to_singular(entity))}Data() with entity fields")
    print(f"3. Implement validate{to_pascal_case(to_singular(entity))}Object() validations")
    print(f"4. Import and use in tests:")
    print(f"")
    print(f"   const {pascal_plural}APIController = require('../controllers/{pascal_plural}APIController.js')")
    print(f"")
    print(f"   const api = new {pascal_plural}APIController(BASE_URL, API_KEY, TEAM_ID)")
    print("=" * 60 + "\n")

    return 0


if __name__ == '__main__':
    sys.exit(main())
