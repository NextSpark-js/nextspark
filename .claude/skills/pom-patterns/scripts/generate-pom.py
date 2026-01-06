#!/usr/bin/env python3
"""
Generate POM Script

Generates a Page Object Model (POM) for a Cypress entity.

Usage:
    python generate-pom.py --entity ENTITY [--theme THEME] [--fields FIELDS]

Options:
    --entity ENTITY   Entity name (e.g., products, clients)
    --theme THEME     Theme name (default: default)
    --fields FIELDS   Comma-separated field names (auto-detected if not provided)
    --dry-run         Preview without writing to file
    --output FILE     Output file path (default: auto-generated)
"""

import os
import sys
import re
import json
import argparse
from pathlib import Path
from typing import List, Dict, Optional


def to_pascal_case(name: str) -> str:
    """Convert kebab-case/snake_case to PascalCase."""
    return ''.join(x.title() for x in re.split(r'[-_]', name))


def to_camel_case(name: str) -> str:
    """Convert kebab-case/snake_case to camelCase."""
    parts = re.split(r'[-_]', name)
    return parts[0].lower() + ''.join(x.title() for x in parts[1:])


def to_singular(name: str) -> str:
    """Convert plural to singular (simple English rules)."""
    if name.endswith('ies'):
        return name[:-3] + 'y'
    elif name.endswith('es'):
        return name[:-2]
    elif name.endswith('s'):
        return name[:-1]
    return name


def get_entities_config(theme: str) -> dict:
    """Load entities.json fixture if it exists."""
    fixture_path = Path(f'contents/themes/{theme}/tests/cypress/fixtures/entities.json')
    if fixture_path.exists():
        try:
            with open(fixture_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except json.JSONDecodeError:
            pass
    return {}


def get_entity_fields_from_config(entity: str, theme: str) -> List[str]:
    """Get entity fields from entities.json."""
    config = get_entities_config(theme)
    if 'entities' in config and entity in config['entities']:
        entity_config = config['entities'][entity]
        if 'fields' in entity_config:
            # fields is a list of field names
            fields = entity_config['fields']
            if isinstance(fields, list):
                return fields
            elif isinstance(fields, dict):
                return list(fields.keys())
    return []


def infer_field_type(field_name: str) -> str:
    """Infer field type from field name."""
    field_lower = field_name.lower()

    if field_lower in ['status', 'priority', 'type', 'category', 'role']:
        return 'select'
    elif field_lower in ['description', 'content', 'notes', 'body']:
        return 'textarea'
    elif field_lower in ['isActive', 'isPublished', 'enabled', 'active']:
        return 'checkbox'
    elif field_lower in ['email']:
        return 'email'
    elif field_lower in ['phone']:
        return 'phone'
    elif field_lower in ['price', 'amount', 'quantity', 'count']:
        return 'number'
    elif field_lower in ['date', 'dueDate', 'startDate', 'endDate']:
        return 'date'
    elif field_lower in ['url', 'link', 'website']:
        return 'url'
    else:
        return 'text'


def generate_form_interface(entity: str, fields: List[str]) -> str:
    """Generate TypeScript interface for form data."""
    singular = to_singular(entity)
    pascal_singular = to_pascal_case(singular)

    lines = [
        f"interface {pascal_singular}FormData {{",
    ]

    for field in fields:
        camel_field = to_camel_case(field)
        lines.append(f"  {camel_field}?: string")

    lines.append("}")

    return '\n'.join(lines)


def generate_fill_form_method(entity: str, fields: List[str]) -> str:
    """Generate the fillForm method."""
    singular = to_singular(entity)
    pascal_singular = to_pascal_case(singular)
    camel_singular = to_camel_case(singular)

    lines = [
        f"  /**",
        f"   * Fill the {singular} form with provided data",
        f"   */",
        f"  fill{pascal_singular}Form(data: {pascal_singular}FormData): this {{",
    ]

    for field in fields:
        camel_field = to_camel_case(field)
        field_type = infer_field_type(field)

        if field_type == 'select':
            lines.append(f"    if (data.{camel_field}) this.selectField('{camel_field}', data.{camel_field})")
        elif field_type == 'checkbox':
            lines.append(f"    if (data.{camel_field}) this.checkField('{camel_field}')")
        else:
            lines.append(f"    if (data.{camel_field}) this.fillField('{camel_field}', data.{camel_field})")

    lines.extend([
        "    return this",
        "  }",
    ])

    return '\n'.join(lines)


def generate_crud_methods(entity: str) -> str:
    """Generate standard CRUD workflow methods."""
    singular = to_singular(entity)
    pascal_singular = to_pascal_case(singular)
    camel_singular = to_camel_case(singular)

    return f'''  /**
   * Create a new {singular} with the provided data
   */
  create{pascal_singular}(data: {pascal_singular}FormData): this {{
    return this
      .visitCreate()
      .interceptCreate()
      .fill{pascal_singular}Form(data)
      .submitForm()
      .waitForCreate()
  }}

  /**
   * Update an existing {singular}
   */
  update{pascal_singular}(id: string, data: {pascal_singular}FormData): this {{
    return this
      .visitEdit(id)
      .interceptUpdate()
      .fill{pascal_singular}Form(data)
      .submitForm()
      .waitForUpdate()
  }}

  /**
   * Delete a {singular} by ID
   */
  delete{pascal_singular}(id: string): this {{
    return this
      .interceptDelete()
      .deleteById(id)
      .waitForDelete()
  }}

  /**
   * Load the {entity} list with proper interceptors
   */
  load{pascal_singular}List(): this {{
    return this
      .interceptList()
      .visitList()
      .waitForList()
  }}'''


def generate_pom_content(entity: str, fields: List[str], theme: str) -> str:
    """Generate the complete POM file content."""
    singular = to_singular(entity)
    pascal_singular = to_pascal_case(singular)
    pascal_plural = to_pascal_case(entity)
    camel_entity = to_camel_case(entity)

    # Check if entities.json exists
    config = get_entities_config(theme)
    has_config = 'entities' in config and entity in config['entities']

    form_interface = generate_form_interface(entity, fields)
    fill_form_method = generate_fill_form_method(entity, fields)
    crud_methods = generate_crud_methods(entity)

    # Build imports
    imports = [
        "import { DashboardEntityPOM } from '../core/DashboardEntityPOM'",
        "import { cySelector } from '../selectors'",
    ]

    if has_config:
        imports.append("import entitiesConfig from '../fixtures/entities.json'")

    imports_str = '\n'.join(imports)

    # Build constructor body
    if has_config:
        constructor_body = f"super(entitiesConfig.entities.{camel_entity}.slug)"
    else:
        constructor_body = f"super('{entity}')"

    content = f'''/**
 * {pascal_plural}POM - Page Object Model for {entity} entity
 *
 * Extends DashboardEntityPOM with entity-specific form handling
 * and workflows for {singular} management.
 *
 * @example
 * ```typescript
 * const pom = {pascal_plural}POM.create()
 * pom.create{pascal_singular}({{ title: 'New {pascal_singular}' }})
 * pom.assertSuccessToast()
 * ```
 */

{imports_str}

// =============================================================================
// FORM INTERFACE
// =============================================================================

{form_interface}

// =============================================================================
// POM CLASS
// =============================================================================

export class {pascal_plural}POM extends DashboardEntityPOM {{
  constructor() {{
    {constructor_body}
  }}

  // ===========================================================================
  // FACTORY
  // ===========================================================================

  /**
   * Factory method for creating {pascal_plural}POM instances
   */
  static create(): {pascal_plural}POM {{
    return new {pascal_plural}POM()
  }}

  // ===========================================================================
  // SELECTORS
  // ===========================================================================

  /**
   * Entity-specific selectors
   */
  get elements() {{
    return {{
      // Add entity-specific selectors here
      // Example: statusFilter: cySelector('entities.{entity}.filters.status'),
    }}
  }}

  // ===========================================================================
  // FORM METHODS
  // ===========================================================================

{fill_form_method}

  // ===========================================================================
  // CRUD WORKFLOWS
  // ===========================================================================

{crud_methods}
}}
'''

    return content


def main():
    parser = argparse.ArgumentParser(description='Generate entity POM')
    parser.add_argument('--entity', required=True, help='Entity name (e.g., products)')
    parser.add_argument('--theme', default='default', help='Theme name')
    parser.add_argument('--fields', default=None, help='Comma-separated field names')
    parser.add_argument('--dry-run', action='store_true', help='Preview without writing')
    parser.add_argument('--output', default=None, help='Output file path')

    args = parser.parse_args()

    entity = args.entity.lower()
    theme = args.theme
    pascal_plural = to_pascal_case(entity)

    print(f"\n{'=' * 60}")
    print("GENERATING POM")
    print(f"{'=' * 60}")
    print(f"Entity: {entity}")
    print(f"Theme: {theme}")

    # Determine fields
    if args.fields:
        fields = [f.strip() for f in args.fields.split(',')]
        print(f"Fields: {', '.join(fields)} (from --fields)")
    else:
        # Try to auto-detect from entities.json
        fields = get_entity_fields_from_config(entity, theme)
        if fields:
            print(f"Fields: {', '.join(fields)} (from entities.json)")
        else:
            # Default common fields
            fields = ['title', 'description', 'status']
            print(f"Fields: {', '.join(fields)} (default)")

    print(f"{'=' * 60}\n")

    # Generate content
    content = generate_pom_content(entity, fields, theme)

    if args.dry_run:
        print("DRY RUN - Generated content:\n")
        print("-" * 60)
        print(content)
        print("-" * 60)
        print("\nRun without --dry-run to write to file.")
        return 0

    # Determine output path
    if args.output:
        output_path = Path(args.output)
    else:
        output_path = Path(f'contents/themes/{theme}/tests/cypress/src/entities/{pascal_plural}POM.ts')

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

    print(f"POM generated: {output_path}")
    print(f"\n{'=' * 60}")
    print("NEXT STEPS:")
    print("=" * 60)
    print(f"1. Review generated file: {output_path}")
    print(f"2. Add entity-specific selectors to the elements getter")
    print(f"3. Customize form field handling if needed")
    print(f"4. Add any entity-specific workflow methods")
    print(f"5. Import and use in tests:")
    print(f"")
    print(f"   import {{ {pascal_plural}POM }} from '../entities/{pascal_plural}POM'")
    print(f"")
    print(f"   const pom = {pascal_plural}POM.create()")
    print(f"   pom.load{to_pascal_case(to_singular(entity))}List()")
    print("=" * 60 + "\n")

    return 0


if __name__ == '__main__':
    sys.exit(main())
