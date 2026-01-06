#!/usr/bin/env python3
"""
Generate Metas Migration Script

Generates SQL migration for entity metadata table.

Usage:
    python generate-metas-migration.py --entity ENTITY_NAME [--theme THEME] [--output FILE]

Options:
    --entity ENTITY_NAME  Name of the entity (kebab-case, e.g., 'products', 'blog-posts')
    --theme THEME         Theme name (default: from NEXT_PUBLIC_ACTIVE_THEME or 'default')
    --output FILE         Output file (default: auto-generate path)
    --with-rls            Include RLS policies (default: true)
    --dry-run             Print SQL without writing file
"""

import os
import sys
import argparse
from pathlib import Path
from datetime import datetime


def get_active_theme() -> str:
    """Get active theme from environment or default."""
    return os.environ.get('NEXT_PUBLIC_ACTIVE_THEME', 'default')


def to_camel_case(name: str) -> str:
    """Convert kebab-case to camelCase."""
    components = name.split('-')
    return components[0] + ''.join(x.title() for x in components[1:])


def to_singular(name: str) -> str:
    """Simple pluralization - remove trailing 's' for common cases."""
    if name.endswith('ies'):
        return name[:-3] + 'y'
    elif name.endswith('es') and not name.endswith('ses'):
        return name[:-2]
    elif name.endswith('s') and not name.endswith('ss'):
        return name[:-1]
    return name


def to_pascal_case(name: str) -> str:
    """Convert kebab-case to PascalCase."""
    return ''.join(x.title() for x in name.split('-'))


def generate_metas_migration(entity_slug: str, with_rls: bool = True) -> str:
    """Generate metadata table migration SQL matching project conventions."""

    # Entity naming
    table_name = entity_slug.replace('-', '_')
    singular = to_singular(entity_slug).replace('-', '_')
    pascal = to_pascal_case(entity_slug)
    date_str = datetime.now().strftime('%Y-%m-%d')

    sql = f'''-- Migration: 002_{table_name}_metas.sql
-- Description: {pascal} metas (table, indexes, RLS)
-- Date: {date_str}

-- ============================================
-- TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public."{table_name}_metas" (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "entityId"     TEXT NOT NULL REFERENCES public."{table_name}"(id) ON DELETE CASCADE,
  "metaKey"      TEXT NOT NULL,
  "metaValue"    JSONB NOT NULL DEFAULT '{{}}'::jsonb,
  "dataType"     TEXT DEFAULT 'json',
  "isPublic"     BOOLEAN NOT NULL DEFAULT false,
  "isSearchable" BOOLEAN NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT {table_name}_metas_unique_key UNIQUE ("entityId", "metaKey")
);

COMMENT ON TABLE  public."{table_name}_metas"               IS 'Key-value metadata for {table_name}';
COMMENT ON COLUMN public."{table_name}_metas"."entityId"    IS 'Reference to parent {singular}';
COMMENT ON COLUMN public."{table_name}_metas"."metaKey"     IS 'Metadata key identifier';
COMMENT ON COLUMN public."{table_name}_metas"."metaValue"   IS 'Metadata value in JSONB format';
COMMENT ON COLUMN public."{table_name}_metas"."dataType"    IS 'Type hint: json, string, number, boolean';
COMMENT ON COLUMN public."{table_name}_metas"."isPublic"    IS 'Whether this metadata is publicly readable';
COMMENT ON COLUMN public."{table_name}_metas"."isSearchable" IS 'Whether this metadata is searchable';

-- ============================================
-- TRIGGER updatedAt
-- ============================================
DROP TRIGGER IF EXISTS {table_name}_metas_set_updated_at ON public."{table_name}_metas";
CREATE TRIGGER {table_name}_metas_set_updated_at
BEFORE UPDATE ON public."{table_name}_metas"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_{table_name}_metas_entity_id   ON public."{table_name}_metas"("entityId");
CREATE INDEX IF NOT EXISTS idx_{table_name}_metas_key         ON public."{table_name}_metas"("metaKey");
CREATE INDEX IF NOT EXISTS idx_{table_name}_metas_is_public   ON public."{table_name}_metas"("isPublic") WHERE "isPublic" = true;
CREATE INDEX IF NOT EXISTS idx_{table_name}_metas_searchable  ON public."{table_name}_metas"("isSearchable") WHERE "isSearchable" = true;
CREATE INDEX IF NOT EXISTS idx_{table_name}_metas_value_gin   ON public."{table_name}_metas" USING GIN ("metaValue");
CREATE INDEX IF NOT EXISTS idx_{table_name}_metas_value_ops   ON public."{table_name}_metas" USING GIN ("metaValue" jsonb_path_ops);
'''

    if with_rls:
        sql += f'''
-- ============================================
-- RLS
-- ============================================
ALTER TABLE public."{table_name}_metas" ENABLE ROW LEVEL SECURITY;

-- Cleanup existing policies
DROP POLICY IF EXISTS "{pascal} metas team can do all" ON public."{table_name}_metas";

-- ============================
-- RLS: TEAM ISOLATION VIA PARENT
-- ============================
-- Hereda el aislamiento del parent via teamId
CREATE POLICY "{pascal} metas team can do all"
ON public."{table_name}_metas"
FOR ALL TO authenticated
USING (
  -- Superadmin bypass
  public.is_superadmin()
  OR
  -- Team isolation via parent
  EXISTS (
    SELECT 1 FROM public."{table_name}" t
    WHERE t.id = "entityId"
      AND t."teamId" = ANY(public.get_user_team_ids())
  )
)
WITH CHECK (
  public.is_superadmin()
  OR
  EXISTS (
    SELECT 1 FROM public."{table_name}" t
    WHERE t.id = "entityId"
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
    parser = argparse.ArgumentParser(description='Generate entity metas migration')
    parser.add_argument('--entity', required=True, help='Entity name (kebab-case)')
    parser.add_argument('--theme', default=None, help='Theme name')
    parser.add_argument('--output', help='Output file path')
    parser.add_argument('--with-rls', action='store_true', default=True, help='Include RLS policies')
    parser.add_argument('--no-rls', action='store_true', help='Exclude RLS policies')
    parser.add_argument('--dry-run', action='store_true', help='Print SQL without writing')

    args = parser.parse_args()

    theme = args.theme or get_active_theme()
    entity_slug = args.entity.lower()
    with_rls = not args.no_rls

    print(f"\n{'='*60}")
    print(f"Generating metas migration for: {entity_slug}")
    print(f"Theme: {theme}")
    print(f"With RLS: {with_rls}")
    print(f"{'='*60}")

    # Generate SQL
    sql = generate_metas_migration(entity_slug, with_rls)

    if args.dry_run:
        print("\n" + sql)
        print(f"\n{'='*60}")
        print("DRY RUN - No file written")
        return 0

    # Determine output path
    if args.output:
        output_path = Path(args.output)
    else:
        # Auto-generate path in entity's migrations folder
        entity_dir = Path(f'contents/themes/{theme}/entities/{entity_slug}')
        migrations_dir = entity_dir / 'migrations'

        if not entity_dir.exists():
            print(f"\nError: Entity directory not found: {entity_dir}")
            print("Please create the entity first using scaffold-entity.py")
            return 1

        migrations_dir.mkdir(exist_ok=True)

        next_num = find_next_migration_number(migrations_dir)
        table_name = entity_slug.replace('-', '_')
        output_path = migrations_dir / f'{next_num:03d}_{table_name}_metas.sql'

    # Write file
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(sql)

    print(f"\nMigration written to: {output_path}")
    print(f"\nNext steps:")
    print(f"  1. Review the generated migration")
    print(f"  2. Run: pnpm db:migrate")
    print(f"  3. Update entity config: access.metadata = true")

    return 0


if __name__ == '__main__':
    sys.exit(main())
