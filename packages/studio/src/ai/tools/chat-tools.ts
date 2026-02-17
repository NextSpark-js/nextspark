/**
 * Chat MCP Tools
 *
 * File manipulation tools for post-generation iterative chat.
 * All operations are sandboxed to the project directory.
 *
 * Includes low-level file tools (read, write, delete, list, search, run_command)
 * and high-level orchestration tools (create_entity, create_page) that handle
 * multi-file operations in a single tool call.
 */

import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { readFile, writeFile, readdir, stat, mkdir, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { execSync } from 'child_process'
import path from 'path'
import type { StudioEventHandler } from '../../types'
import { generatePageTemplate, getTemplateFilePath } from '../../lib/page-template-generator'

/**
 * Validate that a resolved path is within the project directory.
 * Prevents path traversal attacks.
 */
function assertWithinProject(filePath: string, projectDir: string): string {
  const resolved = path.resolve(projectDir, filePath)
  const normalizedProject = path.resolve(projectDir)
  if (!resolved.startsWith(normalizedProject + path.sep) && resolved !== normalizedProject) {
    throw new Error(`Access denied: path "${filePath}" is outside the project directory`)
  }
  return resolved
}

// Skip patterns for file listing
const SKIP_DIRS = new Set([
  'node_modules', '.next', '.git', '.nextspark',
  '.turbo', 'dist', '.DS_Store',
])

const ALLOWED_COMMANDS = [
  'pnpm build:registries',
  'pnpm db:migrate',
  'pnpm db:seed',
]

// ── SQL type mapping ────────────────────────────────────────────────

const SQL_TYPE_MAP: Record<string, string> = {
  text: 'TEXT',
  textarea: 'TEXT',
  number: 'NUMERIC',
  boolean: 'BOOLEAN DEFAULT false',
  date: 'DATE',
  datetime: 'TIMESTAMPTZ',
  email: 'TEXT',
  url: 'TEXT',
  phone: 'TEXT',
  select: 'TEXT',
  multiselect: "JSONB DEFAULT '[]'::jsonb",
  tags: "JSONB DEFAULT '[]'::jsonb",
  image: 'TEXT',
  file: 'TEXT',
  rating: 'INTEGER',
  currency: 'NUMERIC(12,2)',
  richtext: 'TEXT',
  markdown: 'TEXT',
  json: "JSONB DEFAULT '{}'::jsonb",
  country: 'TEXT',
  address: 'JSONB',
}

// ── Entity file generators ──────────────────────────────────────────

function toCamelCase(str: string): string {
  return str
    .split('-')
    .map((word, i) => i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
}

function toPascalCase(str: string): string {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
}

interface EntityField {
  name: string
  type: string
  required: boolean
  description?: string
  options?: Array<{ value: string; label: string }>
}

interface EntityInput {
  slug: string
  singular: string
  plural: string
  description: string
  icon?: string
  accessShared?: boolean
  fields: EntityField[]
}

function generateEntityConfig(entity: EntityInput, themeName: string): string {
  const camelSlug = toCamelCase(entity.slug)
  const icon = entity.icon || 'CircleDot'

  return `import { ${icon} } from 'lucide-react'
import type { EntityConfig } from '@nextsparkjs/core/lib/entities/types'
import { ${camelSlug}Fields } from './${entity.slug}.fields'

export const ${camelSlug}EntityConfig: EntityConfig = {
  slug: '${entity.slug}',
  enabled: true,
  names: {
    singular: '${entity.singular}',
    plural: '${entity.plural}',
  },
  icon: ${icon},

  access: {
    public: false,
    api: true,
    metadata: true,
    shared: ${entity.accessShared ?? false},
  },

  ui: {
    dashboard: {
      showInMenu: true,
      showInTopbar: true,
    },
    public: {
      hasArchivePage: false,
      hasSinglePage: false,
    },
    features: {
      searchable: true,
      sortable: true,
      filterable: true,
      bulkOperations: true,
      importExport: false,
    },
  },

  fields: ${camelSlug}Fields,
}

export default ${camelSlug}EntityConfig
`
}

function generateEntityFields(entity: EntityInput): string {
  const camelSlug = toCamelCase(entity.slug)
  const fieldDefs = entity.fields.map((f, i) => {
    let def = `  {
    name: '${f.name}',
    type: '${f.type}',
    required: ${f.required},
    display: {
      label: '${toPascalCase(f.name.replace(/([A-Z])/g, '-$1').toLowerCase())}',
      description: '${f.description || ''}',
      placeholder: 'Enter ${f.name.replace(/([A-Z])/g, ' $1').toLowerCase()}...',
      showInList: ${i < 4},
      showInDetail: true,
      showInForm: true,
      order: ${i + 1},
      columnWidth: 12,
    },
    api: {
      readOnly: false,
      searchable: ${f.type === 'text' || f.type === 'textarea' || f.type === 'email'},
      sortable: ${f.type !== 'json' && f.type !== 'tags' && f.type !== 'multiselect'},
    },`

    // Add options for select/multiselect fields
    if ((f.type === 'select' || f.type === 'multiselect') && f.options?.length) {
      def += `\n    options: [\n${f.options.map(o => `      { value: '${o.value}', label: '${o.label}' },`).join('\n')}\n    ],`
      if (f.type === 'select' && f.options[0]) {
        def += `\n    defaultValue: '${f.options[0].value}',`
      }
    }

    def += '\n  }'
    return def
  })

  return `import type { EntityField } from '@nextsparkjs/core/lib/entities/types'

export const ${camelSlug}Fields: EntityField[] = [
${fieldDefs.join(',\n')}
]
`
}

function generateEntityMessages(entity: EntityInput): string {
  const fieldMessages: Record<string, { label: string; placeholder: string; description: string }> = {}
  for (const f of entity.fields) {
    const label = toPascalCase(f.name.replace(/([A-Z])/g, '-$1').toLowerCase())
    fieldMessages[f.name] = {
      label,
      placeholder: `Enter ${f.name.replace(/([A-Z])/g, ' $1').toLowerCase()}...`,
      description: f.description || label,
    }
  }

  // Status values for select fields
  const statusMessages: Record<string, string> = {}
  for (const f of entity.fields) {
    if ((f.type === 'select' || f.type === 'multiselect') && f.options?.length) {
      for (const opt of f.options) {
        statusMessages[opt.value] = opt.label
      }
    }
  }

  const messages = {
    entity: {
      name: entity.singular,
      namePlural: entity.plural,
      description: entity.description,
    },
    title: `My ${entity.plural}`,
    subtitle: `Manage and organize your ${entity.plural.toLowerCase()}.`,
    fields: fieldMessages,
    ...(Object.keys(statusMessages).length > 0 ? { status: statusMessages } : {}),
    actions: {
      create: `Create ${entity.singular}`,
      edit: `Edit ${entity.singular}`,
      delete: `Delete ${entity.singular}`,
    },
    messages: {
      created: `${entity.singular} created successfully`,
      updated: `${entity.singular} updated successfully`,
      deleted: `${entity.singular} deleted successfully`,
      confirmDelete: `Are you sure you want to delete this ${entity.singular.toLowerCase()}?`,
      noItems: `No ${entity.plural.toLowerCase()} found`,
      createFirst: `Create your first ${entity.singular.toLowerCase()} to get started`,
    },
    list: {
      title: `${entity.plural} List`,
      description: `Manage all your ${entity.plural.toLowerCase()} in one place`,
    },
  }

  return JSON.stringify(messages, null, 2)
}

function generateEntityMigration(entity: EntityInput): string {
  const columns: string[] = [
    `  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text`,
    `  "userId"     TEXT NOT NULL REFERENCES public."users"(id) ON DELETE CASCADE`,
    `  "teamId"     TEXT NOT NULL REFERENCES public."teams"(id) ON DELETE CASCADE`,
    '',
    `  -- Entity-specific fields`,
  ]

  const constraints: string[] = []

  for (const f of entity.fields) {
    const needsQuotes = f.name !== f.name.toLowerCase() || f.name.includes('-')
    const colName = needsQuotes ? `"${f.name}"` : f.name
    const sqlType = f.type === 'relation'
      ? `TEXT REFERENCES public."${f.name.replace(/Id$/, '')}"(id)`
      : SQL_TYPE_MAP[f.type] || 'TEXT'
    const notNull = f.required ? ' NOT NULL' : ''

    columns.push(`  ${colName.padEnd(14)} ${sqlType}${notNull}`)

    // Add CHECK constraint for select fields
    if (f.type === 'select' && f.options?.length) {
      const values = f.options.map(o => `'${o.value}'`).join(', ')
      constraints.push(`  CONSTRAINT ${entity.slug}_${f.name}_check CHECK (${colName} IN (${values}))`)
    }
  }

  columns.push('')
  columns.push(`  -- System fields`)
  columns.push(`  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now()`)
  columns.push(`  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT now()`)

  if (constraints.length > 0) {
    columns.push('')
    columns.push(...constraints)
  }

  return `-- Migration: 001_${entity.slug}_table.sql
-- Description: ${entity.plural} (table, indexes, RLS)

-- TABLE
DROP TABLE IF EXISTS public."${entity.slug}" CASCADE;

CREATE TABLE IF NOT EXISTS public."${entity.slug}" (
${columns.join(',\n')}
);

-- TRIGGER updatedAt
DROP TRIGGER IF EXISTS ${entity.slug}_set_updated_at ON public."${entity.slug}";
CREATE TRIGGER ${entity.slug}_set_updated_at
BEFORE UPDATE ON public."${entity.slug}"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_${entity.slug}_user_id    ON public."${entity.slug}"("userId");
CREATE INDEX IF NOT EXISTS idx_${entity.slug}_team_id    ON public."${entity.slug}"("teamId");
CREATE INDEX IF NOT EXISTS idx_${entity.slug}_user_team  ON public."${entity.slug}"("userId", "teamId");
CREATE INDEX IF NOT EXISTS idx_${entity.slug}_created_at ON public."${entity.slug}"("userId", "createdAt");

-- RLS
ALTER TABLE public."${entity.slug}" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "${entity.slug}_team_policy" ON public."${entity.slug}";

CREATE POLICY "${entity.slug}_team_policy"
ON public."${entity.slug}"
FOR ALL TO authenticated
USING (
  public.is_superadmin()
  OR "teamId" = ANY(public.get_user_team_ids())
)
WITH CHECK (
  public.is_superadmin()
  OR "teamId" = ANY(public.get_user_team_ids())
);
`
}

function generateMetasMigration(entity: EntityInput): string {
  return `-- Migration: 002_${entity.slug}_metas.sql
CREATE TABLE IF NOT EXISTS public."${entity.slug}_metas" (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "entityId"     TEXT NOT NULL REFERENCES public."${entity.slug}"(id) ON DELETE CASCADE,
  "metaKey"      TEXT NOT NULL,
  "metaValue"    JSONB NOT NULL DEFAULT '{}'::jsonb,
  "dataType"     TEXT DEFAULT 'json',
  "isPublic"     BOOLEAN NOT NULL DEFAULT false,
  "isSearchable" BOOLEAN NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ${entity.slug}_metas_unique_key UNIQUE ("entityId", "metaKey")
);

DROP TRIGGER IF EXISTS ${entity.slug}_metas_set_updated_at ON public."${entity.slug}_metas";
CREATE TRIGGER ${entity.slug}_metas_set_updated_at
  BEFORE UPDATE ON public."${entity.slug}_metas"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_${entity.slug}_metas_entity_id ON public."${entity.slug}_metas"("entityId");
CREATE INDEX IF NOT EXISTS idx_${entity.slug}_metas_key       ON public."${entity.slug}_metas"("metaKey");

ALTER TABLE public."${entity.slug}_metas" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "${entity.slug}_metas_team_policy" ON public."${entity.slug}_metas";

CREATE POLICY "${entity.slug}_metas_team_policy"
ON public."${entity.slug}_metas"
FOR ALL TO authenticated
USING (
  public.is_superadmin()
  OR EXISTS (
    SELECT 1 FROM public."${entity.slug}" t
    WHERE t.id = "entityId"
      AND t."teamId" = ANY(public.get_user_team_ids())
  )
)
WITH CHECK (
  public.is_superadmin()
  OR EXISTS (
    SELECT 1 FROM public."${entity.slug}" t
    WHERE t.id = "entityId"
      AND t."teamId" = ANY(public.get_user_team_ids())
  )
);
`
}

// ── Config file updaters ────────────────────────────────────────────

async function addEntityToPermissions(themePath: string, entity: EntityInput): Promise<void> {
  const filePath = path.join(themePath, 'config', 'permissions.config.ts')
  if (!existsSync(filePath)) return

  const content = await readFile(filePath, 'utf-8')

  // Check if entity already exists
  if (content.includes(`${entity.slug}:`)) return

  const permBlock = `    ${entity.slug}: [
      { action: 'create', label: 'Create ${entity.plural}', description: 'Can create new ${entity.plural.toLowerCase()}', roles: ['owner', 'admin', 'member'] },
      { action: 'read', label: 'View ${entity.plural}', description: 'Can view ${entity.singular.toLowerCase()} details', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'list', label: 'List ${entity.plural}', description: 'Can see the ${entity.plural.toLowerCase()} list', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'update', label: 'Edit ${entity.plural}', description: 'Can modify ${entity.singular.toLowerCase()} information', roles: ['owner', 'admin', 'member'] },
      { action: 'delete', label: 'Delete ${entity.plural}', description: 'Can delete ${entity.plural.toLowerCase()}', roles: ['owner', 'admin'], dangerous: true },
    ],`

  // Insert before the closing brace of 'entities'
  const entitiesEnd = content.lastIndexOf('},')
  if (entitiesEnd !== -1) {
    const updated = content.slice(0, entitiesEnd) + '},\n' + permBlock + '\n' + content.slice(entitiesEnd + 2)
    await writeFile(filePath, updated, 'utf-8')
  }
}

async function addEntityToFeatures(themePath: string, entity: EntityInput): Promise<void> {
  const filePath = path.join(themePath, 'config', 'features.config.ts')
  if (!existsSync(filePath)) return

  const content = await readFile(filePath, 'utf-8')
  if (content.includes(`'${entity.slug}'`)) return

  const featureBlock = `  ${entity.slug}: {
    name: '${entity.plural}',
    description: '${entity.description}',
    category: 'entities',
    icon: '${entity.icon || 'circle-dot'}',
    entities: ['${entity.slug}'],
    permissions: ['${entity.slug}.*'],
    docs: [],
  },`

  // Insert before the closing })
  const closingIdx = content.lastIndexOf('})')
  if (closingIdx !== -1) {
    const updated = content.slice(0, closingIdx) + featureBlock + '\n' + content.slice(closingIdx)
    await writeFile(filePath, updated, 'utf-8')
  }
}

async function addEntityToAppConfig(themePath: string, entity: EntityInput): Promise<void> {
  const filePath = path.join(themePath, 'config', 'app.config.ts')
  if (!existsSync(filePath)) return

  const content = await readFile(filePath, 'utf-8')
  if (content.includes(`'${entity.slug}'`)) return

  // Add to i18n.namespaces array
  const nsMatch = content.match(/namespaces:\s*\[([^\]]+)\]/)
  if (nsMatch) {
    const updated = content.replace(
      nsMatch[0],
      nsMatch[0].replace(']', `, '${entity.slug}']`)
    )
    await writeFile(filePath, updated, 'utf-8')
  }
}

// ── Helper: run a command ───────────────────────────────────────────

function runCmd(projectDir: string, command: string): string {
  return execSync(command, {
    cwd: projectDir,
    timeout: 60_000,
    encoding: 'utf-8',
    env: {
      ...process.env,
      FORCE_COLOR: '0',
      NEXTSPARK_PROJECT_ROOT: projectDir,
    },
  })
}

/**
 * Create the Chat MCP server with file manipulation tools.
 */
export function createChatMcpServer(projectDir: string, onEvent?: StudioEventHandler, themeName?: string) {
  // Resolve theme name from .env if not provided
  if (!themeName) {
    try {
      const envContent = existsSync(path.join(projectDir, '.env'))
        ? require('fs').readFileSync(path.join(projectDir, '.env'), 'utf-8')
        : ''
      const match = envContent.match(/NEXT_PUBLIC_ACTIVE_THEME="?([^"\n]+)"?/)
      themeName = match?.[1] || path.basename(projectDir)
    } catch {
      themeName = path.basename(projectDir)
    }
  }
  const resolvedTheme = themeName || 'starter'

  return createSdkMcpServer({
    name: 'project',
    version: '1.0.0',
    tools: [
      // ── read_file ──────────────────────────────────────────────
      tool(
        'read_file',
        'Read the contents of a file in the project. Use this to understand existing code before making changes.',
        { path: z.string().describe('Relative path from project root, e.g. "contents/themes/my-app/entities/products/products.config.ts"') },
        async (args) => {
          onEvent?.({ type: 'tool_start', toolName: 'read_file', content: `Reading ${args.path}` })
          try {
            const fullPath = assertWithinProject(args.path, projectDir)
            if (!existsSync(fullPath)) {
              return { content: [{ type: 'text' as const, text: `Error: File not found: ${args.path}` }] }
            }
            const stats = await stat(fullPath)
            if (stats.size > 500_000) {
              return { content: [{ type: 'text' as const, text: `Error: File too large (${(stats.size / 1024).toFixed(0)}KB). Maximum 500KB.` }] }
            }
            const content = await readFile(fullPath, 'utf-8')
            onEvent?.({ type: 'tool_result', toolName: 'read_file', content: `Read ${args.path} (${content.length} chars)` })
            return { content: [{ type: 'text' as const, text: content }] }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            return { content: [{ type: 'text' as const, text: `Error reading file: ${msg}` }] }
          }
        }
      ),

      // ── write_file ─────────────────────────────────────────────
      tool(
        'write_file',
        'Write content to a file in the project. Creates the file if it doesn\'t exist, or overwrites if it does. Use this to modify configs, entity definitions, pages, components, etc.',
        {
          path: z.string().describe('Relative path from project root'),
          content: z.string().describe('Complete file content to write'),
        },
        async (args) => {
          onEvent?.({ type: 'tool_start', toolName: 'write_file', content: `Writing ${args.path}` })
          try {
            const fullPath = assertWithinProject(args.path, projectDir)
            // Ensure parent directory exists
            await mkdir(path.dirname(fullPath), { recursive: true })
            await writeFile(fullPath, args.content, 'utf-8')
            onEvent?.({ type: 'tool_result', toolName: 'write_file', content: `Wrote ${args.path} (${args.content.length} chars)` })
            return { content: [{ type: 'text' as const, text: `Successfully wrote ${args.path}` }] }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            return { content: [{ type: 'text' as const, text: `Error writing file: ${msg}` }] }
          }
        }
      ),

      // ── delete_file ────────────────────────────────────────────
      tool(
        'delete_file',
        'Delete a file from the project. Use when removing entities, cleaning up obsolete files, or undoing changes.',
        { path: z.string().describe('Relative path from project root') },
        async (args) => {
          onEvent?.({ type: 'tool_start', toolName: 'delete_file', content: `Deleting ${args.path}` })
          try {
            const fullPath = assertWithinProject(args.path, projectDir)
            if (!existsSync(fullPath)) {
              return { content: [{ type: 'text' as const, text: `Error: File not found: ${args.path}` }] }
            }
            await unlink(fullPath)
            onEvent?.({ type: 'tool_result', toolName: 'delete_file', content: `Deleted ${args.path}` })
            return { content: [{ type: 'text' as const, text: `Deleted ${args.path}` }] }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            return { content: [{ type: 'text' as const, text: `Error deleting file: ${msg}` }] }
          }
        }
      ),

      // ── list_files ─────────────────────────────────────────────
      tool(
        'list_files',
        'List files and directories in a project directory. Useful for understanding project structure before making changes.',
        {
          directory: z.string().default('.').describe('Relative directory path from project root. Use "." for root.'),
          depth: z.number().default(2).describe('How many levels deep to list (1-3)'),
        },
        async (args) => {
          onEvent?.({ type: 'tool_start', toolName: 'list_files', content: `Listing ${args.directory}` })
          try {
            const fullPath = assertWithinProject(args.directory, projectDir)
            if (!existsSync(fullPath)) {
              return { content: [{ type: 'text' as const, text: `Error: Directory not found: ${args.directory}` }] }
            }

            const maxDepth = Math.min(Math.max(args.depth, 1), 3)
            const lines: string[] = []

            async function listDir(dir: string, prefix: string, currentDepth: number) {
              if (currentDepth > maxDepth) return
              const entries = await readdir(dir, { withFileTypes: true })
              const sorted = entries
                .filter(e => !SKIP_DIRS.has(e.name) && !e.name.startsWith('.'))
                .sort((a, b) => {
                  if (a.isDirectory() && !b.isDirectory()) return -1
                  if (!a.isDirectory() && b.isDirectory()) return 1
                  return a.name.localeCompare(b.name)
                })

              for (const entry of sorted) {
                if (entry.isDirectory()) {
                  lines.push(`${prefix}${entry.name}/`)
                  await listDir(path.join(dir, entry.name), prefix + '  ', currentDepth + 1)
                } else {
                  lines.push(`${prefix}${entry.name}`)
                }
              }
            }

            await listDir(fullPath, '', 1)
            const result = lines.join('\n') || '(empty directory)'
            onEvent?.({ type: 'tool_result', toolName: 'list_files', content: `Listed ${lines.length} items in ${args.directory}` })
            return { content: [{ type: 'text' as const, text: result }] }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            return { content: [{ type: 'text' as const, text: `Error listing files: ${msg}` }] }
          }
        }
      ),

      // ── search_files ───────────────────────────────────────────
      tool(
        'search_files',
        'Search for text patterns in project files. Returns matching lines with file paths. Useful for finding where something is defined before modifying it.',
        {
          pattern: z.string().describe('Text or regex pattern to search for'),
          directory: z.string().default('.').describe('Directory to search in (relative to project root)'),
          filePattern: z.string().default('*.ts,*.tsx,*.json,*.css,*.mjs').describe('Comma-separated file extensions to search'),
        },
        async (args) => {
          onEvent?.({ type: 'tool_start', toolName: 'search_files', content: `Searching for "${args.pattern}"` })
          try {
            const fullPath = assertWithinProject(args.directory, projectDir)
            if (!existsSync(fullPath)) {
              return { content: [{ type: 'text' as const, text: `Error: Directory not found: ${args.directory}` }] }
            }

            const results: string[] = []
            const extensions = args.filePattern.split(',').map(e => e.trim().replace('*', ''))

            async function searchDir(dir: string) {
              if (results.length >= 50) return // Cap results
              const entries = await readdir(dir, { withFileTypes: true })
              for (const entry of entries) {
                if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue
                const entryPath = path.join(dir, entry.name)
                if (entry.isDirectory()) {
                  await searchDir(entryPath)
                } else if (extensions.some(ext => entry.name.endsWith(ext))) {
                  try {
                    const content = await readFile(entryPath, 'utf-8')
                    const lines = content.split('\n')
                    for (let i = 0; i < lines.length; i++) {
                      if (lines[i].includes(args.pattern)) {
                        const relPath = path.relative(projectDir, entryPath).replace(/\\/g, '/')
                        results.push(`${relPath}:${i + 1}: ${lines[i].trim()}`)
                        if (results.length >= 50) return
                      }
                    }
                  } catch {
                    // Skip unreadable files
                  }
                }
              }
            }

            await searchDir(fullPath)
            const output = results.length > 0
              ? results.join('\n')
              : `No matches found for "${args.pattern}"`
            onEvent?.({ type: 'tool_result', toolName: 'search_files', content: `Found ${results.length} matches` })
            return { content: [{ type: 'text' as const, text: output }] }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            return { content: [{ type: 'text' as const, text: `Error searching: ${msg}` }] }
          }
        }
      ),

      // ── run_command ────────────────────────────────────────────
      tool(
        'run_command',
        `Run a pre-approved command in the project directory. Only these commands are allowed: ${ALLOWED_COMMANDS.join(', ')}. Use "pnpm build:registries" after modifying entity configs to rebuild auto-generated registries.`,
        {
          command: z.enum(ALLOWED_COMMANDS as [string, ...string[]]).describe('The command to run'),
        },
        async (args) => {
          onEvent?.({ type: 'tool_start', toolName: 'run_command', content: `Running ${args.command}` })
          try {
            const output = runCmd(projectDir, args.command)
            onEvent?.({ type: 'tool_result', toolName: 'run_command', content: `Command completed: ${args.command}` })
            return { content: [{ type: 'text' as const, text: output || 'Command completed successfully' }] }
          } catch (err) {
            const msg = err instanceof Error ? (err as Error & { stdout?: string; stderr?: string }).stderr || err.message : String(err)
            return { content: [{ type: 'text' as const, text: `Command failed: ${msg}` }] }
          }
        }
      ),

      // ── create_entity (high-level) ─────────────────────────────
      tool(
        'create_entity',
        'Create a complete new entity with all required files (config, fields, messages, migrations) and update cross-references (permissions, features, app.config). Also runs build:registries and db:migrate. Use this instead of multiple write_file calls when creating a new entity.',
        {
          slug: z.string().describe('Entity slug in kebab-case (e.g. "invoices", "gym-classes")'),
          singular: z.string().describe('Singular display name (e.g. "Invoice", "Gym Class")'),
          plural: z.string().describe('Plural display name (e.g. "Invoices", "Gym Classes")'),
          description: z.string().describe('Brief description of this entity'),
          icon: z.string().default('CircleDot').describe('Lucide icon name (e.g. "FileText", "Dumbbell")'),
          accessShared: z.boolean().default(false).describe('If true, all team members see all records. If false, user isolation.'),
          fields: z.array(z.object({
            name: z.string().describe('Field name in camelCase'),
            type: z.string().describe('Field type: text, textarea, number, boolean, date, datetime, email, url, phone, select, multiselect, tags, image, file, rating, currency, richtext, markdown, json, country, address, relation'),
            required: z.boolean().default(false),
            description: z.string().optional().describe('Field description'),
            options: z.array(z.object({
              value: z.string(),
              label: z.string(),
            })).optional().describe('Options for select/multiselect fields'),
          })).describe('Entity fields (do NOT include id, userId, teamId, createdAt, updatedAt — those are automatic)'),
        },
        async (args) => {
          onEvent?.({ type: 'tool_start', toolName: 'create_entity', content: `Creating entity "${args.plural}" (${args.slug})` })

          const entity: EntityInput = {
            slug: args.slug,
            singular: args.singular,
            plural: args.plural,
            description: args.description,
            icon: args.icon,
            accessShared: args.accessShared,
            fields: args.fields.map(f => ({
              name: f.name,
              type: f.type,
              required: f.required ?? false,
              description: f.description,
              options: f.options,
            })),
          }

          const themePath = path.join(projectDir, 'contents', 'themes', resolvedTheme)
          const entityDir = path.join(themePath, 'entities', entity.slug)
          const filesCreated: string[] = []

          try {
            // 1. Create entity directory
            await mkdir(entityDir, { recursive: true })
            await mkdir(path.join(entityDir, 'messages'), { recursive: true })
            await mkdir(path.join(entityDir, 'migrations'), { recursive: true })

            // 2. Write entity config
            const configPath = path.join(entityDir, `${entity.slug}.config.ts`)
            await writeFile(configPath, generateEntityConfig(entity, resolvedTheme), 'utf-8')
            filesCreated.push(`contents/themes/${resolvedTheme}/entities/${entity.slug}/${entity.slug}.config.ts`)

            // 3. Write entity fields
            const fieldsPath = path.join(entityDir, `${entity.slug}.fields.ts`)
            await writeFile(fieldsPath, generateEntityFields(entity), 'utf-8')
            filesCreated.push(`contents/themes/${resolvedTheme}/entities/${entity.slug}/${entity.slug}.fields.ts`)

            // 4. Write messages (en)
            const messagesPath = path.join(entityDir, 'messages', 'en.json')
            await writeFile(messagesPath, generateEntityMessages(entity), 'utf-8')
            filesCreated.push(`contents/themes/${resolvedTheme}/entities/${entity.slug}/messages/en.json`)

            // 5. Write main migration
            const migrationPath = path.join(entityDir, 'migrations', `001_${entity.slug}_table.sql`)
            await writeFile(migrationPath, generateEntityMigration(entity), 'utf-8')
            filesCreated.push(`contents/themes/${resolvedTheme}/entities/${entity.slug}/migrations/001_${entity.slug}_table.sql`)

            // 6. Write metas migration
            const metasPath = path.join(entityDir, 'migrations', `002_${entity.slug}_metas.sql`)
            await writeFile(metasPath, generateMetasMigration(entity), 'utf-8')
            filesCreated.push(`contents/themes/${resolvedTheme}/entities/${entity.slug}/migrations/002_${entity.slug}_metas.sql`)

            // 7. Update config files
            await addEntityToPermissions(themePath, entity)
            await addEntityToFeatures(themePath, entity)
            await addEntityToAppConfig(themePath, entity)

            // 8. Build registries
            onEvent?.({ type: 'tool_start', toolName: 'create_entity', content: 'Building registries...' })
            try {
              runCmd(projectDir, 'pnpm build:registries')
            } catch {
              // Non-fatal — entity files are still valid
            }

            // 9. Run migration
            onEvent?.({ type: 'tool_start', toolName: 'create_entity', content: 'Running database migration...' })
            try {
              runCmd(projectDir, 'pnpm db:migrate')
            } catch {
              // Non-fatal — migration may need manual review
            }

            // Emit write events for each file so they get tracked as modifications
            for (const f of filesCreated) {
              onEvent?.({ type: 'tool_result', toolName: 'write_file', content: `Wrote ${f} (auto-generated)` })
            }

            onEvent?.({ type: 'tool_result', toolName: 'create_entity', content: `Created entity "${entity.plural}" with ${filesCreated.length} files` })

            return {
              content: [{
                type: 'text' as const,
                text: `Successfully created entity "${entity.plural}" (${entity.slug}) with ${entity.fields.length} fields.\n\nFiles created:\n${filesCreated.map(f => `  - ${f}`).join('\n')}\n\nConfig files updated:\n  - permissions.config.ts\n  - features.config.ts\n  - app.config.ts (i18n namespaces)\n\nCommands run:\n  - pnpm build:registries\n  - pnpm db:migrate`,
              }],
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            return { content: [{ type: 'text' as const, text: `Error creating entity: ${msg}` }] }
          }
        }
      ),

      // ── create_page (high-level) ───────────────────────────────
      tool(
        'create_page',
        'Create or update a page builder page with blocks. Writes a page JSON file to the theme\'s pages directory. Use this when the user wants to add or modify a landing page, about page, etc.',
        {
          pageName: z.string().describe('Human-readable page title (e.g. "Home", "About Us", "Pricing")'),
          route: z.string().describe('Page route path (e.g. "/", "/about", "/pricing")'),
          blocks: z.array(z.object({
            blockType: z.string().describe('Block type slug (e.g. "hero", "features", "cta", "pricing", "testimonials", "faq")'),
            props: z.record(z.unknown()).describe('Block properties (title, subtitle, items, etc.)'),
          })).describe('Ordered array of blocks on this page'),
        },
        async (args) => {
          const pageSlug = args.route === '/'
            ? 'home'
            : args.route.replace(/^\//, '').replace(/\//g, '-')

          onEvent?.({ type: 'tool_start', toolName: 'create_page', content: `Creating page "${args.pageName}" at ${args.route}` })

          try {
            const pagesDir = path.join(projectDir, 'contents', 'themes', resolvedTheme, 'pages')
            await mkdir(pagesDir, { recursive: true })

            const pageConfig = {
              id: `page-${pageSlug}-${Date.now()}`,
              slug: pageSlug,
              title: args.pageName,
              route: args.route,
              blocks: args.blocks.map((block, index) => ({
                id: `block-${pageSlug}-${index}-${Date.now()}`,
                blockSlug: block.blockType,
                props: block.props,
                order: index + 1,
              })),
              locale: 'en',
              status: 'published',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }

            const filePath = path.join(pagesDir, `${pageSlug}.json`)
            await writeFile(filePath, JSON.stringify(pageConfig, null, 2), 'utf-8')

            const relPath = `contents/themes/${resolvedTheme}/pages/${pageSlug}.json`
            onEvent?.({ type: 'tool_result', toolName: 'write_file', content: `Wrote ${relPath} (auto-generated)` })

            // Regenerate the React template file from the block definitions
            let templateRelPath = ''
            try {
              const pageForTemplate = {
                pageName: args.pageName,
                route: args.route,
                blocks: args.blocks.map((block, index) => ({
                  blockType: block.blockType,
                  props: block.props,
                  order: index + 1,
                })),
              }
              const templateContent = generatePageTemplate(pageForTemplate)
              templateRelPath = getTemplateFilePath(args.route, resolvedTheme)
              const templateAbsPath = path.join(projectDir, templateRelPath)
              await mkdir(path.dirname(templateAbsPath), { recursive: true })
              await writeFile(templateAbsPath, templateContent, 'utf-8')
              onEvent?.({ type: 'tool_result', toolName: 'write_file', content: `Wrote ${templateRelPath} (template regenerated)` })
            } catch {
              // Non-fatal
            }

            onEvent?.({ type: 'tool_result', toolName: 'create_page', content: `Created page "${args.pageName}"` })

            // Report files modified so preview auto-reloads
            const filesModified = [relPath]
            if (templateRelPath) filesModified.push(templateRelPath)
            onEvent?.({ type: 'files_modified', filesModified })

            return {
              content: [{
                type: 'text' as const,
                text: `Successfully created page "${args.pageName}" at route "${args.route}" with ${args.blocks.length} blocks: ${args.blocks.map(b => b.blockType).join(', ')}.\n\nFiles:\n  - ${relPath}\n  - ${templateRelPath || '(template generation skipped)'}`,
              }],
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            return { content: [{ type: 'text' as const, text: `Error creating page: ${msg}` }] }
          }
        }
      ),
    ],
  })
}

/**
 * MCP tool names for the chat server.
 */
export const CHAT_MCP_TOOL_NAMES = [
  'mcp__project__read_file',
  'mcp__project__write_file',
  'mcp__project__delete_file',
  'mcp__project__list_files',
  'mcp__project__search_files',
  'mcp__project__run_command',
  'mcp__project__create_entity',
  'mcp__project__create_page',
] as const
