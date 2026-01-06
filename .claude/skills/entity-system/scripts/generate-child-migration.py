#!/usr/bin/env python3
"""
Generate Child Entity Migration Script

Generates SQL migration for child entity table with parent reference.

Usage:
    python generate-child-migration.py --parent PARENT --child CHILD [--theme THEME]

Options:
    --parent PARENT     Parent entity name (kebab-case, e.g., 'orders')
    --child CHILD       Child entity name (kebab-case, e.g., 'items')
    --theme THEME       Theme name (default: from NEXT_PUBLIC_ACTIVE_THEME or 'default')
    --output FILE       Output file path
    --fields FIELDS     Comma-separated field:type pairs (e.g., 'name:text,quantity:number')
    --with-rls          Include RLS policies (default: true)
    --no-rls            Exclude RLS policies
    --dry-run           Print SQL without writing file
"""

import os
import sys
import argparse
import re
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Tuple


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
    'number': 'DECIMAL(10, 2)',
    'integer': 'INTEGER',
    'boolean': 'BOOLEAN DEFAULT FALSE',
    'date': 'DATE',
    'datetime': 'TIMESTAMPTZ',
    'email': 'VARCHAR(255)',
    'url': 'TEXT',
    'json': 'JSONB DEFAULT \'{}\'::jsonb',
    'select': 'VARCHAR(100)',
    'uuid': 'TEXT',
}


def parse_fields(fields_str: str) -> List[Dict]:
    """Parse comma-separated field:type pairs."""
    if not fields_str:
        return []

    fields = []
    for field_def in fields_str.split(','):
        parts = field_def.strip().split(':')
        if len(parts) >= 2:
            name = parts[0].strip()
            field_type = parts[1].strip()
            required = len(parts) > 2 and parts[2].strip().lower() == 'required'
            fields.append({
                'name': name,
                'type': field_type,
                'required': required
            })
    return fields


def to_pascal_case(name: str) -> str:
    """Convert kebab-case to PascalCase."""
    return ''.join(x.title() for x in name.split('-'))


def generate_child_migration(
    parent_slug: str,
    child_slug: str,
    fields: List[Dict],
    with_rls: bool = True
) -> str:
    """Generate child entity table migration SQL matching project conventions."""

    parent_table = to_snake_case(parent_slug)
    child_table = f"{parent_table}_{to_snake_case(child_slug)}"
    parent_pascal = to_pascal_case(parent_slug)
    child_pascal = to_pascal_case(child_slug)
    date_str = datetime.now().strftime('%Y-%m-%d')

    # Build column definitions with proper alignment
    columns = [
        '  -- Primary Key',
        '  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,',
        '',
        '  -- Parent Reference',
        f'  "parentId"     TEXT NOT NULL REFERENCES public."{parent_table}"(id) ON DELETE CASCADE,',
    ]

    # Add custom fields if any
    if fields:
        columns.append('')
        columns.append('  -- Entity-specific fields')
        for field in fields:
            name = field['name']
            field_type = field['type']
            required = field.get('required', False)

            sql_type = FIELD_TYPE_MAP.get(field_type, 'TEXT')
            not_null = ' NOT NULL' if required else ''
            # Pad the name for alignment
            padded_name = f'"{name}"'.ljust(14) if name[0].isupper() or '-' in name else name.ljust(14)
            columns.append(f'  {padded_name} {sql_type}{not_null},')

    # System fields
    columns.append('')
    columns.append('  -- System fields')
    columns.append('  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),')
    columns.append('  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now()')

    columns_sql = '\n'.join(columns)

    sql = f'''-- Migration: 003_{child_table}.sql
-- Description: {parent_pascal} {child_pascal} child entity (table, indexes, RLS)
-- Date: {date_str}

-- ============================================
-- TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public."{child_table}" (
{columns_sql}
);

COMMENT ON TABLE  public."{child_table}"              IS 'Child entity: {child_slug} for {parent_slug}';
COMMENT ON COLUMN public."{child_table}"."parentId"   IS 'Reference to parent {parent_slug}';

-- ============================================
-- TRIGGER updatedAt
-- ============================================
DROP TRIGGER IF EXISTS {child_table}_set_updated_at ON public."{child_table}";
CREATE TRIGGER {child_table}_set_updated_at
BEFORE UPDATE ON public."{child_table}"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_{child_table}_parent_id  ON public."{child_table}"("parentId");
CREATE INDEX IF NOT EXISTS idx_{child_table}_created_at ON public."{child_table}"("createdAt" DESC);
'''

    if with_rls:
        sql += f'''
-- ============================================
-- RLS
-- ============================================
ALTER TABLE public."{child_table}" ENABLE ROW LEVEL SECURITY;

-- Cleanup existing policies
DROP POLICY IF EXISTS "{parent_pascal} {child_pascal} team can do all" ON public."{child_table}";

-- ============================
-- RLS: TEAM ISOLATION VIA PARENT
-- ============================
-- Hereda el aislamiento del parent via teamId
CREATE POLICY "{parent_pascal} {child_pascal} team can do all"
ON public."{child_table}"
FOR ALL TO authenticated
USING (
  -- Superadmin bypass
  public.is_superadmin()
  OR
  -- Team isolation via parent
  EXISTS (
    SELECT 1 FROM public."{parent_table}" t
    WHERE t.id = "parentId"
      AND t."teamId" = ANY(public.get_user_team_ids())
  )
)
WITH CHECK (
  public.is_superadmin()
  OR
  EXISTS (
    SELECT 1 FROM public."{parent_table}" t
    WHERE t.id = "parentId"
      AND t."teamId" = ANY(public.get_user_team_ids())
  )
);
'''

    return sql


def find_next_migration_number(migrations_dir: Path) -> int:
    """Find the next available migration number."""
    if not migrations_dir.exists():
        return 1

    existing = list(migrations_dir.glob('*.sql'))
    if not existing:
        return 1

    numbers = []
    for f in existing:
        try:
            num = int(f.name.split('_')[0])
            numbers.append(num)
        except (ValueError, IndexError):
            continue

    return max(numbers, default=0) + 1


def main():
    parser = argparse.ArgumentParser(description='Generate child entity migration')
    parser.add_argument('--parent', required=True, help='Parent entity name (kebab-case)')
    parser.add_argument('--child', required=True, help='Child entity name (kebab-case)')
    parser.add_argument('--theme', default=None, help='Theme name')
    parser.add_argument('--output', help='Output file path')
    parser.add_argument('--fields', help='Comma-separated field:type pairs')
    parser.add_argument('--with-rls', action='store_true', default=True)
    parser.add_argument('--no-rls', action='store_true', help='Exclude RLS policies')
    parser.add_argument('--dry-run', action='store_true', help='Print SQL without writing')

    args = parser.parse_args()

    theme = args.theme or get_active_theme()
    parent_slug = args.parent.lower()
    child_slug = args.child.lower()
    with_rls = not args.no_rls

    # Parse fields
    fields = parse_fields(args.fields) if args.fields else []

    print(f"\n{'='*60}")
    print(f"Generating child entity migration")
    print(f"Parent: {parent_slug}")
    print(f"Child: {child_slug}")
    print(f"Theme: {theme}")
    print(f"With RLS: {with_rls}")
    print(f"Fields: {len(fields)}")
    print(f"{'='*60}")

    # Generate SQL
    sql = generate_child_migration(parent_slug, child_slug, fields, with_rls)

    if args.dry_run:
        print("\n" + sql)
        print(f"\n{'='*60}")
        print("DRY RUN - No file written")
        return 0

    # Determine output path
    if args.output:
        output_path = Path(args.output)
    else:
        # Auto-generate path in parent entity's migrations folder
        entity_dir = Path(f'contents/themes/{theme}/entities/{parent_slug}')
        migrations_dir = entity_dir / 'migrations'

        if not entity_dir.exists():
            print(f"\nError: Parent entity directory not found: {entity_dir}")
            print("Please create the parent entity first using scaffold-entity.py")
            return 1

        migrations_dir.mkdir(exist_ok=True)

        next_num = find_next_migration_number(migrations_dir)
        parent_table = to_snake_case(parent_slug)
        child_table = to_snake_case(child_slug)
        output_path = migrations_dir / f'{next_num:03d}_{parent_table}_{child_table}.sql'

    # Write file
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(sql)

    print(f"\nMigration written to: {output_path}")
    print(f"\nNext steps:")
    print(f"  1. Add fields to the migration if not specified via --fields")
    print(f"  2. Add childEntities config to {parent_slug}.config.ts")
    print(f"  3. Run: pnpm db:migrate")

    return 0


if __name__ == '__main__':
    sys.exit(main())
