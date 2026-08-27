/**
 * Schema builder — derives MCP tool input schemas from entity configs.
 *
 * DESIGN NOTE: the core's generateEntitySchemas output cannot back tools/list
 * — its fields are built as z.union([..., z.undefined()]).transform(...),
 * which zod 4 cannot convert to JSON Schema ("Undefined cannot be
 * represented"). So this builder emits PRESENTATION schemas (JSON-Schema-
 * friendly, LLM-documented) derived from the same field definitions. The core
 * still validates: every call runs in-process through the generic handler,
 * which validates with the real core schemas. The MCP layer enforces
 * shape/enums/strictness; the core enforces semantics. This presentation
 * layer must never be stricter than what the real API accepts.
 *
 * MCP-side hardening against the API's silent failures:
 * - strict objects: unknown keys are rejected, not stripped
 * - sortBy: enum of the entity's actually-sortable fields
 * - filters: only real filterable fields; date/datetime EXCLUDED (the core
 *   applies `=` equality which never matches a timestamptz → silent [])
 * - dateField/from/to validated as a trio (a lone `from` is silently ignored)
 * - search only exposed when the entity has one of name|title|slug|content
 * - `distinct` NEVER exposed (identifier interpolation risk in the core)
 */

import { z } from 'zod'
import type { EntityConfig, EntityField } from '../entities/types'
import type { McpEntityOverride, McpShape } from './types'

const SEARCHED_FIELDS = ['name', 'title', 'slug', 'content'] as const

/** Field types excluded from MCP input schemas entirely. */
const INPUT_EXCLUDED_TYPES = new Set(['media-library', 'file', 'image', 'video', 'audio'])

/**
 * Field types excluded from the LIST filters object.
 *
 * `datetime` is excluded because the core applies `=` equality and a
 * timestamptz never matches a plain date → silent empty result. Plain `date`
 * (DATE column) IS filterable: `=` works. Range queries still go through
 * dateField/from/to.
 */
const FILTER_EXCLUDED_TYPES = new Set([
  'datetime',
  'json',
  'media-library',
  'textarea',
  'richtext',
  'markdown',
])

export interface EntitySchemaBundle {
  createShape: McpShape
  createStrict: z.ZodTypeAny
  updateShape: McpShape
  updateStrict: z.ZodTypeAny
  listShape: McpShape
  listStrict: z.ZodTypeAny
  getShape: McpShape
  getStrict: z.ZodTypeAny
  /** Field names of type date (DATE column) — outputs get normalized to YYYY-MM-DD. */
  dateFields: string[]
  /** Which field the core search param actually scans for this entity (or null). */
  searchField: string | null
}

export interface SchemaBuilderContext {
  translateOption?: (slug: string, fieldName: string, value: string) => string | undefined
  override?: McpEntityOverride
}

export function buildEntitySchemas(
  entityConfig: EntityConfig,
  context: SchemaBuilderContext = {}
): EntitySchemaBundle {
  const createShape = buildInputShape(entityConfig, 'create', context)
  const updateShape = buildInputShape(entityConfig, 'update', context)
  const listShape = buildListShape(entityConfig, context)
  const getShape: McpShape = {
    id: z.string().min(1).describe(`ID del registro de ${entityConfig.names.singular} (uuid)`),
  }

  const dateFields = entityConfig.fields.filter((f) => f.type === 'date').map((f) => f.name)
  const searchField =
    SEARCHED_FIELDS.find((name) => entityConfig.fields.some((f) => f.name === name)) ?? null

  return {
    createShape,
    createStrict: z.object(createShape).strict(),
    updateShape,
    updateStrict: z.object(updateShape).strict(),
    listShape,
    listStrict: buildListStrict(listShape),
    getShape,
    getStrict: z.object(getShape).strict(),
    dateFields,
    searchField,
  }
}

/**
 * JSON-Schema-friendly presentation type for one field. The in-process core
 * handler re-validates every value with the real core schema, so this layer
 * only needs to be correct about shape, enums and required-ness — and must
 * NEVER be stricter than what the API accepts.
 */
function presentationType(field: EntityField): z.ZodTypeAny {
  switch (field.type) {
    case 'select':
    case 'radio':
    case 'buttongroup':
    case 'combobox': {
      const values = (field.options ?? []).map((opt) => String(opt.value))
      return values.length ? z.enum(values as [string, ...string[]]) : z.string()
    }
    case 'multiselect':
    case 'tags':
      return z.array(z.string())
    case 'doublerange':
      return z.array(z.number()).length(2)
    case 'number':
    case 'rating':
    case 'range':
    case 'currency': {
      let type = z.number()
      if (field.min !== undefined) type = type.min(field.min)
      if (field.max !== undefined) type = type.max(field.max)
      return type
    }
    case 'boolean':
      return z.boolean()
    case 'date':
    case 'datetime':
    case 'email':
    case 'url':
    case 'phone':
    case 'timezone':
    case 'country':
      return z.string().min(1)
    case 'relation':
    case 'relation-prop':
    case 'reference':
    case 'user':
      return z.string().min(1)
    case 'relation-multi':
    case 'relation-prop-multi':
      return z.array(z.string())
    case 'json':
    case 'address':
      return z.record(z.string(), z.unknown())
    case 'text':
    case 'textarea':
    case 'markdown':
    case 'richtext':
    case 'code': {
      let type = z.string()
      if (field.maxLength) type = type.max(field.maxLength)
      return type
    }
    default:
      console.warn(`[mcp] unmapped field type "${field.type}" (${field.name}) — using permissive schema`)
      return z.unknown()
  }
}

function buildInputShape(
  entityConfig: EntityConfig,
  operation: 'create' | 'update',
  context: SchemaBuilderContext
): McpShape {
  const shape: McpShape = {}
  const relax = new Set(context.override?.relaxRequired ?? [])

  for (const field of entityConfig.fields) {
    if (INPUT_EXCLUDED_TYPES.has(field.type)) continue
    if (field.api?.readOnly) continue

    let type = presentationType(field)
    const required = operation === 'create' && field.required && !relax.has(field.name)
    if (!required) type = type.optional()
    shape[field.name] = type.describe(describeField(entityConfig, field, field.name, context))
  }
  return shape
}

function buildListShape(entityConfig: EntityConfig, context: SchemaBuilderContext): McpShape {
  const sortable = entityConfig.fields.filter((f) => f.api?.sortable).map((f) => f.name)
  const sortableValues = [...sortable, 'createdAt', 'updatedAt']
  const dateFieldNames = entityConfig.fields
    .filter((f) => f.type === 'date' || f.type === 'datetime')
    .map((f) => f.name)

  // Descriptions here are repeated once per entity in tools/list, so they are
  // deliberately terse — anything longer than a clause belongs in the tool
  // description, not in every shared param.
  const shape: McpShape = {
    page: z.number().int().min(1).optional().describe('Página (1)'),
    limit: z.number().int().min(1).max(100).optional().describe('Por página (10, máx 100)'),
    sortBy: z.enum(sortableValues as [string, ...string[]]).optional().describe('Ordenar por'),
    sortOrder: z.enum(['ASC', 'DESC']).optional().describe('Orden (DESC)'),
  }

  const searchField = SEARCHED_FIELDS.find((name) =>
    entityConfig.fields.some((f) => f.name === name)
  )
  if (searchField) {
    shape.search = z
      .string()
      .min(1)
      .optional()
      .describe(`Busca SOLO en "${searchField}"`)
  }

  if (dateFieldNames.length) {
    shape.dateField = z
      .enum(dateFieldNames as [string, ...string[]])
      .optional()
      .describe('Campo de fecha del rango (obligatorio con from/to)')
    shape.from = z.string().optional().describe('Desde (YYYY-MM-DD)')
    shape.to = z.string().optional().describe('Hasta (YYYY-MM-DD)')
  }

  // Typed filters: only real, filterable, non-date fields.
  const filterShape: McpShape = {}
  for (const field of entityConfig.fields) {
    if (FILTER_EXCLUDED_TYPES.has(field.type)) continue
    if (INPUT_EXCLUDED_TYPES.has(field.type)) continue
    if (field.api?.filterable === false) continue
    filterShape[field.name] = presentationType(field)
      .optional()
      .describe(describeField(entityConfig, field, field.name, context, true))
  }
  if (Object.keys(filterShape).length) {
    shape.filters = z
      .object(filterShape)
      .strict()
      .optional()
      .describe('Filtros exactos. Fechas NO acá: usá dateField/from/to.')
  }

  const projectable = entityConfig.fields.map((f) => f.name)
  if (projectable.length) {
    shape.fields = z
      .array(z.enum(projectable as [string, ...string[]]))
      .min(1)
      .optional()
      .describe('Devolver solo estos campos (achica la respuesta)')
  }

  return shape
}

/** Strict list schema + trio rule: from/to require dateField (the API ignores a lone from/to silently). */
function buildListStrict(listShape: McpShape): z.ZodTypeAny {
  return z
    .object(listShape)
    .strict()
    .superRefine((value, ctx) => {
      const v = value as Record<string, unknown>
      if ((v.from || v.to) && !v.dateField) {
        ctx.addIssue({
          code: 'custom',
          path: ['dateField'],
          message: 'from/to requieren dateField — sin él la API los ignora en silencio',
        })
      }
    })
}

/**
 * Field descriptions. `compact` mode is used inside the LIST `filters` object,
 * where repeating full descriptions for every entity would dominate the
 * tools/list payload. In compact mode the JSON Schema's own `enum`/`type`
 * already carries the machine-readable part, so only the human label is
 * emitted.
 */
function describeField(
  entityConfig: EntityConfig,
  field: EntityField | undefined,
  name: string,
  context: SchemaBuilderContext,
  compact = false
): string {
  const overrideDescription = context.override?.describe?.fields?.[name]
  if (overrideDescription) return compact ? shorten(overrideDescription) : overrideDescription
  if (!field) return name

  const label = field.display?.label || name
  if (compact) return label

  const parts: string[] = [label]
  if (field.display?.description && field.display.description !== label) {
    parts.push(field.display.description)
  }

  switch (field.type) {
    case 'select':
    case 'multiselect':
    case 'radio':
    case 'buttongroup':
    case 'combobox': {
      const options = (field.options ?? [])
        .map((opt) => {
          const value = String(opt.value)
          const translated =
            context.translateOption?.(entityConfig.slug, field.name, value) ?? opt.label
          return translated && translated !== value ? `${value}=${translated}` : value
        })
        .join(', ')
      if (options) parts.push(options)
      break
    }
    case 'relation':
      if (field.relation?.entity) {
        parts.push(`uuid de ${field.relation.entity} (usá su tool de list)`)
      }
      break
    case 'user':
      parts.push('uuid de un miembro del team')
      break
    case 'date':
      parts.push('YYYY-MM-DD')
      break
    case 'datetime':
      parts.push('ISO 8601 con offset, ej. 2026-08-05T10:00:00-03:00')
      break
    case 'boolean':
      parts.push('true/false (booleano, no string)')
      break
    default:
      break
  }
  return parts.join('. ')
}

function shorten(text: string): string {
  return text.length <= 60 ? text : `${text.slice(0, 57)}...`
}
