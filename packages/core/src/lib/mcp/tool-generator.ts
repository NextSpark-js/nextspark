/**
 * Tool generator — one entity config → its CRUD tool definitions.
 *
 * Names come from the entity config (names.singular/plural), never from naive
 * singularization. Descriptions are fed primarily from the entity's API
 * presets (summary → entity description, preset descriptions/payloads →
 * few-shot examples). Delete tools require confirm:true and carry destructive
 * warnings.
 *
 * No separate authorization gate is re-implemented here: every tool call
 * round-trips in-process through the real generic entity handler (see
 * executor.ts), which already runs `checkAuthPermission` + `hasRequiredScope`
 * + ownership/field guards for API-key auth (fixed for #94/#95). A denied
 * call surfaces as a normal API error, translated via errors.ts.
 */

import { z } from 'zod'
import type { EntityConfig } from '../entities/types'
import { buildEntitySchemas } from './schema-builder'
import { translateApiError } from './errors'
import {
  McpToolError,
  type EntityApiResult,
  type EntityExecutor,
  type EntityPresetInfo,
  type McpEngineOptions,
  type McpEntityOverride,
  type McpOperation,
  type McpShape,
  type McpToolDefinition,
  type McpToolResult,
  type ToolExecutionContext,
} from './types'

interface GeneratorDeps {
  executor: EntityExecutor
  toolPrefix: string
  translateOption?: McpEngineOptions['translateOption']
  presets?: EntityPresetInfo
}

export function generateEntityTools(
  entityConfig: EntityConfig,
  operations: McpOperation[],
  override: McpEntityOverride | undefined,
  deps: GeneratorDeps
): McpToolDefinition[] {
  const schemas = buildEntitySchemas(entityConfig, {
    translateOption: deps.translateOption,
    override,
  })

  const slug = entityConfig.slug
  const singular = toolToken(entityConfig.names.singular)
  // Plural comes from the slug, not names.plural: display names like
  // "Meal Plans" would yield acme_list_meal_plans next to acme_get_mealplan,
  // and the mismatch makes the tool set harder to reason about.
  const plural = toolToken(slug)
  const entityDescription = buildEntityDescription(entityConfig, override, deps.presets)

  const tools: McpToolDefinition[] = []

  const make = (
    operation: McpOperation,
    name: string,
    title: string,
    description: string,
    inputSchema: McpShape,
    strictSchema: z.ZodTypeAny,
    annotations: McpToolDefinition['annotations'],
    run: (args: Record<string, unknown>, ctx: ToolExecutionContext) => Promise<McpToolResult>
  ): McpToolDefinition => ({
    name,
    title,
    description: override?.describe?.tools?.[operation] ?? description,
    inputSchema,
    strictSchema,
    annotations,
    meta: { entitySlug: slug, operation },
    handler: async (rawArgs, ctx) => {
      const parsed = strictSchema.safeParse(rawArgs ?? {})
      if (!parsed.success) {
        return errorResult(
          `Argumentos inválidos para ${name}: ${formatZodIssues(parsed.error)}. Revisá el schema de la tool.`
        )
      }
      try {
        return await run(parsed.data as Record<string, unknown>, ctx)
      } catch (error) {
        if (error instanceof McpToolError) return errorResult(error.message)
        console.error(`[mcp] unexpected error in ${name}:`, error)
        return errorResult(
          `Error inesperado ejecutando ${name}: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    },
  })

  const apiError = (result: EntityApiResult, operation: string) =>
    errorResult(
      translateApiError(result, { slug, operation, hints: override?.errorHints })
    )

  // ── LIST ────────────────────────────────────────────────────────────────
  if (operations.includes('list')) {
    tools.push(
      make(
        'list',
        `${deps.toolPrefix}_list_${plural}`,
        `List ${entityConfig.names.plural}`,
        `Lista ${entityConfig.names.plural} con paginación, orden y filtros. ${entityDescription}${presetExamples(deps.presets, 'GET')}`,
        schemas.listShape,
        schemas.listStrict,
        { readOnlyHint: true },
        async (args, ctx) => {
          const query = listArgsToQuery(args)
          const result = await deps.executor({ slug, operation: 'list', query }, ctx)
          if (!result.body.success) return apiError(result, 'list')
          const data = normalizeOutput(result.body.data)
          const info = (result.body.info ?? {}) as Record<string, unknown>
          const total = info.total ?? (Array.isArray(data) ? data.length : '?')
          const page = info.page ?? 1
          const totalPages = info.totalPages ?? 1
          return {
            content: [
              {
                type: 'text',
                text: `${String(total)} ${entityConfig.names.plural} (página ${String(page)}/${String(totalPages)})`,
              },
            ],
            structuredContent: { data, info } as Record<string, unknown>,
          }
        }
      )
    )
  }

  // ── GET ─────────────────────────────────────────────────────────────────
  if (operations.includes('get')) {
    tools.push(
      make(
        'get',
        `${deps.toolPrefix}_get_${singular}`,
        `Get ${entityConfig.names.singular}`,
        `Obtiene un registro de ${entityConfig.names.singular} por ID. ${entityDescription}`,
        schemas.getShape,
        schemas.getStrict,
        { readOnlyHint: true },
        async (args, ctx) => {
          const result = await deps.executor(
            { slug, operation: 'get', id: String(args.id) },
            ctx
          )
          if (!result.body.success) return apiError(result, 'get')
          const data = normalizeOutput(result.body.data)
          return {
            content: [{ type: 'text', text: `${entityConfig.names.singular} encontrado.` }],
            structuredContent: { data } as Record<string, unknown>,
          }
        }
      )
    )
  }

  // ── CREATE ──────────────────────────────────────────────────────────────
  if (operations.includes('create')) {
    tools.push(
      make(
        'create',
        `${deps.toolPrefix}_create_${singular}`,
        `Create ${entityConfig.names.singular}`,
        `Crea un registro de ${entityConfig.names.singular}. ${entityDescription}${presetExamples(deps.presets, 'POST')}`,
        schemas.createShape,
        schemas.createStrict,
        {},
        async (args, ctx) => {
          const input = override?.transformInput
            ? await override.transformInput('create', args, ctx)
            : args
          const result = await deps.executor({ slug, operation: 'create', body: input }, ctx)
          if (!result.body.success) return apiError(result, 'create')
          const data = normalizeOutput(result.body.data)
          const id = extractId(data)
          return {
            content: [
              { type: 'text', text: `${entityConfig.names.singular} creado${id ? ` (id: ${id})` : ''}.` },
            ],
            structuredContent: { data } as Record<string, unknown>,
          }
        }
      )
    )
  }

  // ── UPDATE ──────────────────────────────────────────────────────────────
  if (operations.includes('update')) {
    const updateShape: McpShape = {
      id: z.string().min(1).describe(`ID del registro de ${entityConfig.names.singular} a modificar (uuid)`),
      ...schemas.updateShape,
    }
    tools.push(
      make(
        'update',
        `${deps.toolPrefix}_update_${singular}`,
        `Update ${entityConfig.names.singular}`,
        `Modifica campos de un registro de ${entityConfig.names.singular} (PATCH parcial: solo enviá los campos a cambiar). ${entityDescription}`,
        updateShape,
        z.object(updateShape).strict(),
        { idempotentHint: true },
        async (args, ctx) => {
          const { id, ...fields } = args as { id: string } & Record<string, unknown>
          if (!Object.keys(fields).length) {
            return errorResult('No enviaste ningún campo a modificar.')
          }
          const input = override?.transformInput
            ? await override.transformInput('update', fields, ctx)
            : fields
          const result = await deps.executor(
            { slug, operation: 'update', id, body: input },
            ctx
          )
          if (!result.body.success) return apiError(result, 'update')
          const data = normalizeOutput(result.body.data)
          return {
            content: [{ type: 'text', text: `${entityConfig.names.singular} actualizado.` }],
            structuredContent: { data } as Record<string, unknown>,
          }
        }
      )
    )
  }

  // ── DELETE ──────────────────────────────────────────────────────────────
  if (operations.includes('delete')) {
    const deleteShape: McpShape = {
      id: z.string().min(1).describe(`ID del registro de ${entityConfig.names.singular} a eliminar (uuid)`),
      confirm: z.boolean().describe('true SOLO tras confirmación explícita del usuario'),
    }
    tools.push(
      make(
        'delete',
        `${deps.toolPrefix}_delete_${singular}`,
        `Delete ${entityConfig.names.singular}`,
        `Elimina un ${entityConfig.names.singular}. DESTRUCTIVO: mostrale al usuario qué vas a borrar y pedile confirmación antes.${deleteWarning(override)}`,
        deleteShape,
        z.object(deleteShape).strict(),
        { destructiveHint: true },
        async (args, ctx) => {
          if (args.confirm !== true) {
            return errorResult(
              'Eliminación no confirmada: pedile al usuario confirmación explícita y reintentá con confirm: true.'
            )
          }
          const result = await deps.executor(
            { slug, operation: 'delete', id: String(args.id) },
            ctx
          )
          if (!result.body.success) return apiError(result, 'delete')
          return {
            content: [{ type: 'text', text: `${entityConfig.names.singular} eliminado (id: ${String(args.id)}).` }],
          }
        }
      )
    )
  }

  return tools
}

// ── helpers ───────────────────────────────────────────────────────────────

export function toolToken(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function buildEntityDescription(
  entityConfig: EntityConfig,
  override: McpEntityOverride | undefined,
  presets: EntityPresetInfo | undefined
): string {
  if (override?.describe?.entity) return override.describe.entity
  return presets?.summary ? `${presets.summary}.` : ''
}

function presetExamples(presets: EntityPresetInfo | undefined, method: 'GET' | 'POST'): string {
  if (!presets) return ''
  const relevant = presets.presets.filter((p) => (p.method ?? 'GET') === method)
  const example = relevant.find((p) => (method === 'POST' ? p.payload : p.params))
  if (!example) return ''
  const body = method === 'POST' ? example.payload : example.params
  const label = example.description || example.title || example.id
  return ` Ejemplo (${label}): ${JSON.stringify(body)}`
}

function deleteWarning(override: McpEntityOverride | undefined): string {
  const hint = override?.describe?.tools?.delete
  return hint ? ` ${hint}` : ''
}

export function listArgsToQuery(args: Record<string, unknown>): Record<string, string> {
  const query: Record<string, string> = {}
  const { filters, fields, ...rest } = args as {
    filters?: Record<string, unknown>
    fields?: string[]
  } & Record<string, unknown>

  for (const [key, value] of Object.entries(rest)) {
    if (value === undefined || value === null || value === '') continue
    query[key] = String(value)
  }
  for (const [key, value] of Object.entries(filters ?? {})) {
    if (value === undefined || value === null || value === '') continue
    query[key] = String(value)
  }
  if (fields?.length) query.fields = fields.join(',')
  return query
}

/** DATE columns come back serialized as timestamptz — normalize to YYYY-MM-DD. */
export function normalizeDateFields(row: unknown, dateFields: string[]): unknown {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return row
  const record = { ...(row as Record<string, unknown>) }
  for (const field of dateFields) {
    const value = record[field]
    if (typeof value === 'string' && value.length >= 10) {
      record[field] = value.slice(0, 10)
    }
  }
  return record
}

/**
 * Output already comes normalized from the engine's executor (dates trimmed,
 * transformOutput applied) so generated and workflow tools stay consistent.
 * Kept as a named pass-through to make that ownership explicit.
 */
function normalizeOutput(data: unknown): unknown {
  return data
}

function extractId(data: unknown): string | null {
  if (data && typeof data === 'object' && 'id' in data) {
    return String((data as { id: unknown }).id)
  }
  return null
}

export function errorResult(message: string): McpToolResult {
  return { content: [{ type: 'text', text: message }], isError: true }
}

function formatZodIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 6)
    .map((issue) => {
      const path = issue.path.join('.')
      return path ? `${path}: ${issue.message}` : issue.message
    })
    .join(' · ')
}
