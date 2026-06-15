#!/usr/bin/env python3
"""
Generate Migration Script

Generates SQL migration from entity configuration.

Usage:
    python generate-migration.py --entity ENTITY_NAME [--theme THEME] [--type TYPE]

Options:
    --entity ENTITY_NAME  Name of the entity (kebab-case)
    --theme THEME         Theme name (default: from NEXT_PUBLIC_ACTIVE_THEME or 'default')
    --type TYPE           Migration type: table, metas, index, rls (default: table)
    --output OUTPUT       Output file (default: stdout)
    --with-rls            Include RLS policies
    --with-indexes        Include optimized indexes
    --soft-delete         Add soft delete columns
"""

import os
import sys
import argparse
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional


def get_active_theme() -> str:
    """Get active theme from environment or default."""
    return os.environ.get('NEXT_PUBLIC_ACTIVE_THEME', 'default')


def to_snake_case(name: str) -> str:
    """Convert kebab-case to snake_case."""
    return name.replace('-', '_')


def to_camel_case(name: str) -> str:
    """Convert kebab-case to camelCase."""
    components = name.split('-')
    return components[0] + ''.join(x.title() for x in components[1:])


# Field type to SQL type mapping
FIELD_TYPE_MAP = {
    'text': 'VARCHAR(255)',
    'textarea': 'TEXT',
    'number': 'DECIMAL',
    'boolean': 'BOOLEAN',
    'date': 'DATE',
    'datetime': 'TIMESTAMPTZ',
    'email': 'VARCHAR(255)',
    'url': 'TEXT',
    'json': 'JSONB',
    'select': 'VARCHAR(100)',
    'multiselect': 'TEXT[]',
    'tags': 'TEXT[]',
    # FKs are TEXT: NextSpark ids are TEXT (Better Auth + gen_random_uuid()::text), not UUID
    'relation': 'TEXT',
    'relation-multi': 'TEXT[]',
    'reference': 'TEXT',
    'user': 'TEXT',
    'phone': 'VARCHAR(50)',
    'rating': 'INTEGER',
    'range': 'DECIMAL',
    'doublerange': 'DECIMAL[]',
    'markdown': 'TEXT',
    'richtext': 'TEXT',
    'code': 'TEXT',
    'timezone': 'VARCHAR(100)',
    'currency': 'VARCHAR(10)',
    'country': 'VARCHAR(10)',
    'address': 'JSONB',
    'file': 'JSONB',
    'image': 'JSONB',
    'video': 'JSONB',
    'audio': 'JSONB',
}


def parse_fields_file(fields_path: Path) -> List[Dict]:
    """Parse TypeScript fields file to extract field definitions."""
    fields = []

    if not fields_path.exists():
        print(f"Warning: Fields file not found: {fields_path}")
        return fields

    with open(fields_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Simple regex-based parser for field objects
    import re

    # Find field blocks
    field_pattern = re.compile(r'\{[^}]*name:\s*[\'"](\w+)[\'"][^}]*type:\s*[\'"](\w+(?:-\w+)?)[\'"][^}]*required:\s*(true|false)[^}]*\}', re.DOTALL)

    for match in field_pattern.finditer(content):
        name = match.group(1)
        field_type = match.group(2)
        required = match.group(3) == 'true'

        # Skip system fields
        if name in ['id', 'createdAt', 'updatedAt', 'created_at', 'updated_at', 'userId', 'user_id']:
            continue

        fields.append({
            'name': name,
            'type': field_type,
            'required': required
        })

        # Try to extract options for select fields
        if field_type == 'select':
            options_pattern = re.compile(rf'name:\s*[\'"]{name}[\'"][^}}]*options:\s*\[(.*?)\]', re.DOTALL)
            options_match = options_pattern.search(content)
            if options_match:
                options_str = options_match.group(1)
                values = re.findall(r'value:\s*[\'"](\w+)[\'"]', options_str)
                fields[-1]['options'] = values

    return fields


def generate_column_sql(field: Dict) -> str:
    """Generate SQL column definition from field."""
    # NextSpark column names are camelCase (e.g. "firstName"), even though table
    # names are snake_case (e.g. "team_members"). Field names from config may be
    # camelCase already (no-op) or kebab-case (converted).
    name = to_camel_case(field['name'])
    field_type = field['type']
    required = field['required']

    sql_type = FIELD_TYPE_MAP.get(field_type, 'TEXT')

    # Handle select fields with CHECK constraint (quote the camelCase column)
    if field_type == 'select' and 'options' in field:
        options = ', '.join(f"'{v}'" for v in field['options'])
        sql_type = f'VARCHAR(100) CHECK ("{name}" IN ({options}))'

    nullable = '' if required else ''
    not_null = ' NOT NULL' if required else ''

    return f'  "{name}" {sql_type}{not_null}'


def generate_table_migration(entity_slug: str, fields: List[Dict], options: Dict) -> str:
    """Generate CREATE TABLE migration."""
    table_name = to_snake_case(entity_slug)
    timestamp = datetime.now().isoformat()

    # Build column definitions (NextSpark: TEXT ids, camelCase columns, "users" table)
    columns = [
        '  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text',
        '  "userId" TEXT NOT NULL REFERENCES "users"(id) ON DELETE CASCADE',
    ]

    for field in fields:
        columns.append(generate_column_sql(field))

    # Timestamps
    columns.extend([
        '  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()',
        '  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()',
    ])

    # Soft delete
    if options.get('soft_delete'):
        columns.extend([
            '  "deletedAt" TIMESTAMPTZ',
            '  "deletedBy" TEXT REFERENCES "users"(id)',
        ])

    # Build SQL
    sql = f'''-- Migration: Create {entity_slug} table
-- Description: Create {entity_slug} entity with fields from config
-- Generated: {timestamp}

-- Up Migration
BEGIN;

-- Create {table_name} table
CREATE TABLE "{table_name}" (
{','.join(columns)}
);
'''

    # Indexes
    if options.get('with_indexes', True):
        sql += f'''
-- Indexes
CREATE INDEX "idx_{table_name}_userId" ON "{table_name}" ("userId");
CREATE INDEX "idx_{table_name}_createdAt" ON "{table_name}" ("createdAt" DESC);
'''
        # Add indexes for searchable/sortable fields (camelCase column names)
        for field in fields:
            name = to_camel_case(field['name'])
            if field['type'] in ['text', 'textarea']:
                sql += f'CREATE INDEX "idx_{table_name}_{name}_search" ON "{table_name}" USING gin(to_tsvector(\'english\', "{name}"));\n'
            elif field['type'] == 'select':
                sql += f'CREATE INDEX "idx_{table_name}_{name}" ON "{table_name}" ("{name}");\n'

        if options.get('soft_delete'):
            sql += f'CREATE INDEX "idx_{table_name}_deletedAt" ON "{table_name}" ("deletedAt");\n'

    # RLS
    if options.get('with_rls', True):
        sql += f'''
-- Enable Row Level Security
ALTER TABLE "{table_name}" ENABLE ROW LEVEL SECURITY;

-- RLS Policies (NextSpark model: app.user_id GUC via public.get_auth_user_id();
-- bypass tier via public.can_bypass_rls(). System ops run on the SERVICE connection
-- which bypasses RLS by credential — no `TO service_role` policy is needed.)
CREATE POLICY "{table_name}_owner_access" ON "{table_name}"
  FOR ALL TO authenticated
  USING (public.can_bypass_rls() OR "userId" = public.get_auth_user_id())
  WITH CHECK (public.can_bypass_rls() OR "userId" = public.get_auth_user_id());
'''

    sql += f'''
-- Trigger for updatedAt (uses the core helper public.set_updated_at from migration 001)
CREATE TRIGGER {table_name}_set_updated_at
  BEFORE UPDATE ON "{table_name}"
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMIT;

-- Down Migration (commented for safety)
-- BEGIN;
-- DROP TABLE IF EXISTS "{table_name}" CASCADE;
-- COMMIT;
'''

    return sql


def generate_metas_migration(entity_slug: str) -> str:
    """Generate metadata table migration."""
    table_name = to_snake_case(entity_slug)
    timestamp = datetime.now().isoformat()

    return f'''-- Migration: Create {entity_slug}_metas table
-- Description: Create metadata table for {entity_slug} entity
-- Generated: {timestamp}

-- Up Migration
BEGIN;

-- Create {table_name}_metas table (NextSpark meta convention: TEXT ids, camelCase,
-- entityId / metaKey / metaValue / isPublic)
CREATE TABLE "{table_name}_metas" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "entityId" TEXT NOT NULL REFERENCES "{table_name}"(id) ON DELETE CASCADE,
  "metaKey" VARCHAR(255) NOT NULL,
  "metaValue" JSONB,
  "isPublic" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE("entityId", "metaKey")
);

-- Indexes
CREATE INDEX "idx_{table_name}_metas_entityId" ON "{table_name}_metas" ("entityId");
CREATE INDEX "idx_{table_name}_metas_metaKey" ON "{table_name}_metas" ("metaKey");
CREATE INDEX "idx_{table_name}_metas_metaValue" ON "{table_name}_metas" USING gin("metaValue");

-- Enable Row Level Security
ALTER TABLE "{table_name}_metas" ENABLE ROW LEVEL SECURITY;

-- RLS Policies (access inherited from the parent row's ownership; public metas readable)
CREATE POLICY "{table_name}_metas_owner_access" ON "{table_name}_metas"
  FOR ALL TO authenticated
  USING (
    public.can_bypass_rls()
    OR EXISTS (
      SELECT 1 FROM "{table_name}" p
      WHERE p.id = "{table_name}_metas"."entityId"
        AND p."userId" = public.get_auth_user_id()
    )
  )
  WITH CHECK (
    public.can_bypass_rls()
    OR EXISTS (
      SELECT 1 FROM "{table_name}" p
      WHERE p.id = "{table_name}_metas"."entityId"
        AND p."userId" = public.get_auth_user_id()
    )
  );

-- Trigger for updatedAt (uses the core helper public.set_updated_at from migration 001)
CREATE TRIGGER {table_name}_metas_set_updated_at
  BEFORE UPDATE ON "{table_name}_metas"
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMIT;

-- Down Migration
-- DROP TABLE IF EXISTS "{table_name}_metas" CASCADE;
'''


def generate_index_migration(entity_slug: str, fields: List[Dict]) -> str:
    """Generate index-only migration."""
    table_name = to_snake_case(entity_slug)
    timestamp = datetime.now().isoformat()

    sql = f'''-- Migration: Add indexes to {entity_slug}
-- Generated: {timestamp}

BEGIN;

'''

    for field in fields:
        name = to_snake_case(field['name'])
        if field['type'] in ['text', 'textarea']:
            sql += f'CREATE INDEX IF NOT EXISTS "idx_{table_name}_{name}_search" ON "{table_name}" USING gin(to_tsvector(\'english\', {name}));\n'
        elif field['type'] in ['select', 'boolean', 'date', 'datetime']:
            sql += f'CREATE INDEX IF NOT EXISTS "idx_{table_name}_{name}" ON "{table_name}" ("{name}");\n'
        elif field['type'] in ['relation', 'reference', 'user']:
            sql += f'CREATE INDEX IF NOT EXISTS "idx_{table_name}_{name}" ON "{table_name}" ("{name}");\n'

    sql += '\nCOMMIT;\n'

    return sql


def main():
    parser = argparse.ArgumentParser(description='Generate entity migration')
    parser.add_argument('--entity', required=True, help='Entity name (kebab-case)')
    parser.add_argument('--theme', default=None, help='Theme name')
    parser.add_argument('--type', choices=['table', 'metas', 'index', 'rls'], default='table')
    parser.add_argument('--output', help='Output file (default: stdout)')
    parser.add_argument('--with-rls', action='store_true', default=True)
    parser.add_argument('--with-indexes', action='store_true', default=True)
    parser.add_argument('--soft-delete', action='store_true')

    args = parser.parse_args()

    theme = args.theme or get_active_theme()
    entity_slug = args.entity.lower()

    # Find fields file
    fields_path = Path(f'contents/themes/{theme}/entities/{entity_slug}/{entity_slug}.fields.ts')

    print(f"\nGenerating migration for: {entity_slug}")
    print(f"Theme: {theme}")
    print(f"Type: {args.type}")
    print(f"Fields file: {fields_path}")

    # Parse fields
    fields = parse_fields_file(fields_path)
    print(f"Found {len(fields)} fields")

    # Generate migration
    options = {
        'with_rls': args.with_rls,
        'with_indexes': args.with_indexes,
        'soft_delete': args.soft_delete,
    }

    if args.type == 'table':
        sql = generate_table_migration(entity_slug, fields, options)
    elif args.type == 'metas':
        sql = generate_metas_migration(entity_slug)
    elif args.type == 'index':
        sql = generate_index_migration(entity_slug, fields)
    else:
        print(f"Unknown migration type: {args.type}")
        return 1

    # Output
    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(sql)
        print(f"\nMigration written to: {args.output}")
    else:
        print("\n" + "=" * 60)
        print("GENERATED MIGRATION:")
        print("=" * 60)
        print(sql)
        print("=" * 60)

    return 0


if __name__ == '__main__':
    sys.exit(main())
