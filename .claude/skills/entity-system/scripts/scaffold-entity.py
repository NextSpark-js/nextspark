#!/usr/bin/env python3
"""
Scaffold Entity Script

Creates the complete file structure for a new entity.

Usage:
    python scaffold-entity.py --entity ENTITY_NAME [--theme THEME]

Options:
    --entity ENTITY_NAME  Name of the entity in kebab-case (e.g., blog-posts)
    --theme THEME         Theme name (default: from NEXT_PUBLIC_ACTIVE_THEME or 'default')
    --with-metas          Include metadata table migration
    --with-builder        Enable page builder for this entity
"""

import os
import re
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


def to_snake_case(name: str) -> str:
    """Convert kebab-case to snake_case."""
    return name.replace('-', '_')


def to_singular(name: str) -> str:
    """Convert plural to singular (simple heuristic)."""
    if name.endswith('ies'):
        return name[:-3] + 'y'
    elif name.endswith('es') and name[-3] in 'sxz':
        return name[:-2]
    elif name.endswith('s') and not name.endswith('ss'):
        return name[:-1]
    return name


def get_active_theme() -> str:
    """Get active theme from environment or default."""
    return os.environ.get('NEXT_PUBLIC_ACTIVE_THEME', 'default')


def generate_config_file(entity_slug: str, singular: str, pascal: str) -> str:
    """Generate entity config TypeScript file."""
    return f'''/**
 * {pascal} Entity Configuration
 *
 * Config-driven entity following the 5-section structure.
 * All table names, API paths, and metadata are derived from slug.
 */

import {{ FileText }} from 'lucide-react'
import type {{ EntityConfig }} from '@/core/lib/entities/types'
import {{ {to_camel_case(entity_slug)}Fields }} from './{entity_slug}.fields'

export const {to_camel_case(singular)}EntityConfig: EntityConfig = {{
  // ==========================================
  // 1. BASIC IDENTIFICATION
  // ==========================================
  slug: '{entity_slug}',
  enabled: true,
  names: {{
    singular: '{singular}',
    plural: '{pascal}'
  }},
  icon: FileText,

  // ==========================================
  // 2. ACCESS AND SCOPE CONFIGURATION
  // ==========================================
  access: {{
    public: false,
    api: true,
    metadata: false,
    shared: false
  }},

  // ==========================================
  // 3. UI/UX FEATURES
  // ==========================================
  ui: {{
    dashboard: {{
      showInMenu: true,
      showInTopbar: true,
      filters: [
        // {{ field: 'status', type: 'multiSelect' }},
      ],
    }},
    public: {{
      hasArchivePage: false,
      hasSinglePage: false
    }},
    features: {{
      searchable: true,
      sortable: true,
      filterable: true,
      bulkOperations: true,
      importExport: false
    }}
  }},

  // ==========================================
  // 4. PERMISSIONS SYSTEM
  // ==========================================
  // Permissions are centralized in permissions.config.ts
  // See: contents/themes/{{theme}}/permissions.config.ts

  // ==========================================
  // 5. INTERNATIONALIZATION
  // ==========================================
  i18n: {{
    fallbackLocale: 'en',
    loaders: {{
      es: () => import('./messages/es.json'),
      en: () => import('./messages/en.json')
    }}
  }},

  // ==========================================
  // FIELDS (imported from separate file)
  // ==========================================
  fields: {to_camel_case(entity_slug)}Fields,
}}
'''


def generate_fields_file(entity_slug: str, singular: str, pascal: str) -> str:
    """Generate entity fields TypeScript file."""
    return f'''/**
 * {pascal} Entity Fields Configuration
 *
 * Field definitions separated from main config.
 * Contains all field definitions for the {entity_slug} entity.
 */

import type {{ EntityField }} from '@/core/lib/entities/types'

export const {to_camel_case(entity_slug)}Fields: EntityField[] = [
  {{
    name: 'title',
    type: 'text',
    required: true,
    display: {{
      label: 'Title',
      description: '{pascal} title',
      placeholder: 'Enter title...',
      showInList: true,
      showInDetail: true,
      showInForm: true,
      order: 1,
      columnWidth: 12,
    }},
    api: {{
      readOnly: false,
      searchable: true,
      sortable: true,
    }},
  }},
  {{
    name: 'description',
    type: 'textarea',
    required: false,
    display: {{
      label: 'Description',
      description: 'Detailed description',
      placeholder: 'Enter description...',
      showInList: false,
      showInDetail: true,
      showInForm: true,
      order: 2,
      columnWidth: 12,
    }},
    api: {{
      readOnly: false,
      searchable: true,
      sortable: false,
    }},
  }},
  {{
    name: 'status',
    type: 'select',
    required: false,
    defaultValue: 'draft',
    options: [
      {{ value: 'draft', label: 'Draft' }},
      {{ value: 'active', label: 'Active' }},
      {{ value: 'archived', label: 'Archived' }},
    ],
    display: {{
      label: 'Status',
      description: 'Current status',
      placeholder: 'Select status...',
      showInList: true,
      showInDetail: true,
      showInForm: true,
      order: 3,
      columnWidth: 6,
    }},
    api: {{
      readOnly: false,
      searchable: false,
      sortable: true,
    }},
  }},
  // NOTE: id, createdAt, updatedAt are implicit system fields
  // They are automatically included by the API and frontend
  // Do NOT declare them here - see core/lib/entities/system-fields.ts
]
'''


def generate_types_file(entity_slug: str, singular: str, pascal: str) -> str:
    """Generate entity types TypeScript file."""
    return f'''/**
 * {pascal} Types
 *
 * Type definitions for the {pascal} entity.
 *
 * @module {pascal}Types
 */

/**
 * {pascal} status values
 */
export type {pascal}Status = 'draft' | 'active' | 'archived'

/**
 * {pascal} entity
 */
export interface {pascal} {{
  id: string
  userId: string
  teamId: string
  title: string
  description?: string
  status: {pascal}Status
  createdAt: string
  updatedAt: string
}}

/**
 * Input for creating a {singular}
 */
export interface Create{pascal}Input {{
  title: string
  description?: string
  status?: {pascal}Status
}}

/**
 * Input for updating a {singular}
 */
export interface Update{pascal}Input {{
  title?: string
  description?: string
  status?: {pascal}Status
}}
'''


def generate_service_file(entity_slug: str, singular: str, pascal: str) -> str:
    """Generate entity service TypeScript file."""
    table_name = entity_slug.replace('-', '_')
    camel = to_camel_case(entity_slug)
    return f'''/**
 * {pascal} Service
 *
 * Provides data access methods for {entity_slug}.
 * Extends BaseEntityService for standard CRUD operations.
 *
 * @module {pascal}Service
 */

import {{ BaseEntityService }} from '@/core/lib/services/base-entity.service'
import type {{ {pascal}, Create{pascal}Input, Update{pascal}Input }} from './{entity_slug}.types'

class {pascal}ServiceClass extends BaseEntityService<{pascal}, Create{pascal}Input, Update{pascal}Input> {{
  constructor() {{
    super({{
      tableName: '{table_name}',
      fields: ['title', 'description', 'status'],
      searchableFields: ['title'],
      defaultOrderBy: 'createdAt',
      defaultOrderDir: 'desc',
    }})
  }}

  // ============================================
  // CUSTOM METHODS
  // ============================================
  // Add entity-specific methods here. Examples:
  //
  // async getByStatus(userId: string, status: string): Promise<{pascal}[]> {{
  //   return this.query(userId, {{ where: {{ status }} }})
  // }}
  //
  // async getRecent(userId: string, limit: number = 5): Promise<{pascal}[]> {{
  //   return this.query(userId, {{ limit, orderBy: 'createdAt', orderDir: 'desc' }})
  // }}
}}

// Export singleton instance
export const {camel}Service = new {pascal}ServiceClass()

// Export class for testing
export {{ {pascal}ServiceClass }}
'''


def generate_messages_en(entity_slug: str, singular: str, pascal: str) -> str:
    """Generate English messages JSON."""
    return f'''{{
  "title": "{pascal}",
  "description": "Manage your {entity_slug}",
  "fields": {{
    "title": {{
      "label": "Title",
      "placeholder": "Enter title...",
      "description": "{pascal} title"
    }},
    "description": {{
      "label": "Description",
      "placeholder": "Enter description...",
      "description": "Detailed description"
    }},
    "status": {{
      "label": "Status",
      "placeholder": "Select status...",
      "options": {{
        "draft": "Draft",
        "active": "Active",
        "archived": "Archived"
      }}
    }}
  }},
  "actions": {{
    "create": "Create {singular.title()}",
    "edit": "Edit {singular.title()}",
    "delete": "Delete {singular.title()}",
    "view": "View {singular.title()}"
  }},
  "messages": {{
    "createSuccess": "{singular.title()} created successfully",
    "updateSuccess": "{singular.title()} updated successfully",
    "deleteSuccess": "{singular.title()} deleted successfully",
    "deleteConfirm": "Are you sure you want to delete this {singular}?"
  }}
}}
'''


def generate_messages_es(entity_slug: str, singular: str, pascal: str) -> str:
    """Generate Spanish messages JSON."""
    return f'''{{
  "title": "{pascal}",
  "description": "Gestiona tus {entity_slug}",
  "fields": {{
    "title": {{
      "label": "Titulo",
      "placeholder": "Ingrese titulo...",
      "description": "Titulo del {singular}"
    }},
    "description": {{
      "label": "Descripcion",
      "placeholder": "Ingrese descripcion...",
      "description": "Descripcion detallada"
    }},
    "status": {{
      "label": "Estado",
      "placeholder": "Seleccione estado...",
      "options": {{
        "draft": "Borrador",
        "active": "Activo",
        "archived": "Archivado"
      }}
    }}
  }},
  "actions": {{
    "create": "Crear {singular}",
    "edit": "Editar {singular}",
    "delete": "Eliminar {singular}",
    "view": "Ver {singular}"
  }},
  "messages": {{
    "createSuccess": "{singular.title()} creado exitosamente",
    "updateSuccess": "{singular.title()} actualizado exitosamente",
    "deleteSuccess": "{singular.title()} eliminado exitosamente",
    "deleteConfirm": "Esta seguro que desea eliminar este {singular}?"
  }}
}}
'''


def generate_migration(entity_slug: str, singular: str, pascal: str) -> str:
    """Generate migration SQL file matching project conventions."""
    table_name = to_snake_case(entity_slug)
    date_str = datetime.now().strftime('%Y-%m-%d')

    return f'''-- Migration: 001_{table_name}_table.sql
-- Description: {pascal} (table, indexes, RLS)
-- Date: {date_str}

-- ============================================
-- TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public."{table_name}" (
  -- Primary Key
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Relational Fields
  "userId"       TEXT NOT NULL REFERENCES public."users"(id) ON DELETE CASCADE,
  "teamId"       TEXT NOT NULL REFERENCES public."teams"(id) ON DELETE CASCADE,

  -- Entity-specific fields
  title          TEXT NOT NULL,
  description    TEXT,
  status         TEXT NOT NULL DEFAULT 'draft',

  -- System fields
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT {table_name}_status_check CHECK (status IN ('draft', 'active', 'archived'))
);

COMMENT ON TABLE  public."{table_name}"              IS '{pascal} table with team isolation via RLS';
COMMENT ON COLUMN public."{table_name}"."userId"     IS 'Owner user id';
COMMENT ON COLUMN public."{table_name}"."teamId"     IS 'Team context for isolation';
COMMENT ON COLUMN public."{table_name}".title        IS '{singular.title()} title';
COMMENT ON COLUMN public."{table_name}".description  IS 'Detailed description';
COMMENT ON COLUMN public."{table_name}".status       IS 'Status: draft, active, archived';

-- ============================================
-- TRIGGER updatedAt
-- ============================================
DROP TRIGGER IF EXISTS {table_name}_set_updated_at ON public."{table_name}";
CREATE TRIGGER {table_name}_set_updated_at
BEFORE UPDATE ON public."{table_name}"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_{table_name}_user_id    ON public."{table_name}"("userId");
CREATE INDEX IF NOT EXISTS idx_{table_name}_team_id    ON public."{table_name}"("teamId");
CREATE INDEX IF NOT EXISTS idx_{table_name}_user_team  ON public."{table_name}"("userId", "teamId");
CREATE INDEX IF NOT EXISTS idx_{table_name}_status     ON public."{table_name}"(status);
CREATE INDEX IF NOT EXISTS idx_{table_name}_created_at ON public."{table_name}"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_{table_name}_title_search ON public."{table_name}" USING GIN(to_tsvector('english', title));

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public."{table_name}" ENABLE ROW LEVEL SECURITY;

-- Cleanup existing policies
DROP POLICY IF EXISTS "{pascal} team can do all" ON public."{table_name}";

-- ============================
-- RLS: TEAM ISOLATION
-- ============================
-- RLS verifies team membership
-- The access.shared (user isolation) logic is handled at APP LEVEL
CREATE POLICY "{pascal} team can do all"
ON public."{table_name}"
FOR ALL TO authenticated
USING (
  -- Superadmin bypass
  public.is_superadmin()
  OR
  -- Team isolation: user must be member of the team
  "teamId" = ANY(public.get_user_team_ids())
)
WITH CHECK (
  public.is_superadmin()
  OR
  "teamId" = ANY(public.get_user_team_ids())
);
'''


def generate_metas_migration(entity_slug: str, singular: str, pascal: str) -> str:
    """Generate metas table migration SQL file matching project conventions."""
    table_name = to_snake_case(entity_slug)
    date_str = datetime.now().strftime('%Y-%m-%d')

    return f'''-- Migration: 002_{table_name}_metas.sql
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

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public."{table_name}_metas" ENABLE ROW LEVEL SECURITY;

-- Cleanup existing policies
DROP POLICY IF EXISTS "{pascal} metas team can do all" ON public."{table_name}_metas";

-- ============================
-- RLS: TEAM ISOLATION VIA PARENT
-- ============================
-- Inherits isolation from parent via teamId
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


def main():
    parser = argparse.ArgumentParser(description='Scaffold a new entity')
    parser.add_argument('--entity', required=True, help='Entity name in kebab-case (plural)')
    parser.add_argument('--theme', default=None, help='Theme name')
    parser.add_argument('--with-metas', action='store_true', help='Include metadata table')
    parser.add_argument('--with-builder', action='store_true', help='Enable page builder')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be created')

    args = parser.parse_args()

    theme = args.theme or get_active_theme()
    entity_slug = args.entity.lower()
    singular = to_singular(entity_slug)
    pascal = to_pascal_case(entity_slug)

    # Base path
    base_path = Path(f'contents/themes/{theme}/entities/{entity_slug}')

    print(f"\n{'=' * 60}")
    print(f"SCAFFOLDING ENTITY: {entity_slug}")
    print(f"{'=' * 60}")
    print(f"Theme: {theme}")
    print(f"Singular: {singular}")
    print(f"Pascal: {pascal}")
    print(f"Base path: {base_path}")
    print(f"{'=' * 60}\n")

    # Files to create
    files = {
        f'{entity_slug}.config.ts': generate_config_file(entity_slug, singular, pascal),
        f'{entity_slug}.fields.ts': generate_fields_file(entity_slug, singular, pascal),
        f'{entity_slug}.types.ts': generate_types_file(entity_slug, singular, pascal),
        f'{entity_slug}.service.ts': generate_service_file(entity_slug, singular, pascal),
        'messages/en.json': generate_messages_en(entity_slug, singular, pascal),
        'messages/es.json': generate_messages_es(entity_slug, singular, pascal),
        f'migrations/001_{to_snake_case(entity_slug)}_table.sql': generate_migration(entity_slug, singular, pascal),
    }

    # Add metas migration if requested
    if args.with_metas:
        files[f'migrations/002_{to_snake_case(entity_slug)}_metas.sql'] = generate_metas_migration(entity_slug, singular, pascal)

    if args.dry_run:
        print("DRY RUN - Files that would be created:\n")
        for file_path in files.keys():
            print(f"  {base_path / file_path}")
        print("\nRun without --dry-run to create files.")
        return 0

    # Create directories and files
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
    print(f"1. Review and customize {entity_slug}.config.ts")
    print(f"2. Add/modify fields in {entity_slug}.fields.ts")
    print(f"3. Update translations in messages/en.json and es.json")
    print(f"4. Run migration: pnpm db:migrate")
    print(f"5. Regenerate registry: node core/scripts/build/registry.mjs")
    print("=" * 60 + "\n")

    return 0


if __name__ == '__main__':
    sys.exit(main())
