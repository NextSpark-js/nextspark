/**
 * Schema Auto-Generation System
 *
 * The schema generation itself lives in ./portable/schema-generator (portable, shared with the
 * generated API contracts); this file re-exports it and keeps the server-side helpers around it
 * (TypeScript type text, validation helper, documentation, builder configuration checks).
 */

import * as z from 'zod'
import type { EntityConfig, EntityField, ChildEntityDefinition } from './types'
import { generateEntitySchemas, type GeneratedSchemas, type SchemaGenerationOptions } from './portable/schema-generator'

export { generateEntitySchemas }
export type { GeneratedSchemas, SchemaGenerationOptions }

/**
 * Generate TypeScript types from schemas
 */
export function generateTypeScriptTypes(
  entityConfig: EntityConfig,
  schemas: GeneratedSchemas
): string {
  const entityName = pascalCase(entityConfig.slug)

  return `
// Auto-generated types for ${entityConfig.names.singular}

export type ${entityName}Create = z.infer<typeof schemas.create>
export type ${entityName}Update = z.infer<typeof schemas.update>
export type ${entityName}Response = z.infer<typeof schemas.response>
export type ${entityName}List = z.infer<typeof schemas.list>

${schemas.childSchemas ? Object.entries(schemas.childSchemas).map(([childName]) => 
  `export type ${entityName}${pascalCase(childName)} = z.infer<typeof schemas.childSchemas.${childName}>`
).join('\n') : ''}
`.trim()
}

/**
 * Convert string to PascalCase
 */
function pascalCase(str: string): string {
  return str.replace(/(?:^|[_-])(\w)/g, (_, char) => char.toUpperCase())
}

/**
 * Validate data against entity schema
 */
export function validateEntityData(
  entityConfig: EntityConfig,
  data: unknown,
  schemaType: 'create' | 'update' | 'response' = 'create',
  options: SchemaGenerationOptions = {}
): { success: true; data: unknown } | { success: false; errors: z.ZodError } {
  const schemas = generateEntitySchemas(entityConfig, options)
  const schema = schemas[schemaType]
  
  const result = schema.safeParse(data)
  
  if (result.success) {
    return { success: true, data: result.data }
  } else {
    return { success: false, errors: result.error }
  }
}

/**
 * Generate schema documentation in markdown format
 */
export function generateSchemaDocumentation(
  entityConfig: EntityConfig
): string {
  const { slug, names, fields } = entityConfig

  let doc = `# ${names.singular} API Schema\n\n`


  // Entity overview
  doc += `## Entity: ${slug}\n\n`
  doc += `**Display Name**: ${names.singular}\n`
  doc += `**Plural**: ${names.plural}\n\n`

  // Fields documentation
  doc += `## Fields\n\n`
  doc += `| Field | Type | Required | Description |\n`
  doc += `|-------|------|----------|-------------|\n`

  fields.forEach(field => {
    const required = field.required ? 'Yes' : 'No'
    const description = field.display.description || field.display.label
    doc += `| ${field.name} | ${field.type} | ${required} | ${description} |\n`
  })

  // API endpoints
  doc += `\n## API Endpoints\n\n`
  doc += `- **GET** \`/api/v1/${slug}\` - List ${names.plural}\n`
  doc += `- **POST** \`/api/v1/${slug}\` - Create ${names.singular}\n`
  doc += `- **GET** \`/api/v1/${slug}/{id}\` - Get ${names.singular}\n`
  doc += `- **PATCH** \`/api/v1/${slug}/{id}\` - Update ${names.singular}\n`
  doc += `- **DELETE** \`/api/v1/${slug}/{id}\` - Delete ${names.singular}\n\n`

  // Child entities
  if (entityConfig.childEntities) {
    doc += `## Child Entities\n\n`
    Object.entries(entityConfig.childEntities).forEach(([childName, childConfig]) => {
      doc += `### ${childName}\n`
      doc += `**Table**: ${childConfig.table}\n`
      doc += `**Fields**: ${childConfig.fields.map(f => f.name).join(', ')}\n\n`
    })
  }

  return doc
}

// =============================================================================
// BUILDER & TAXONOMIES VALIDATION
// =============================================================================

export interface BuilderValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Required fields for entities with builder.enabled = true
 */
const REQUIRED_BUILDER_FIELDS = ['title', 'slug', 'status'] as const

/**
 * Validate an EntityConfig that has builder.enabled = true
 * Ensures required fields exist for page builder functionality
 */
export function validateBuilderEntityConfig(entityConfig: EntityConfig): BuilderValidationResult {
  const result: BuilderValidationResult = {
    valid: true,
    errors: [],
    warnings: []
  }

  // If builder is not enabled, no validation needed
  if (!entityConfig.builder?.enabled) {
    return result
  }

  const fieldNames = entityConfig.fields.map(f => f.name)

  // Check required fields
  for (const requiredField of REQUIRED_BUILDER_FIELDS) {
    if (!fieldNames.includes(requiredField)) {
      result.valid = false
      result.errors.push(
        `Entity "${entityConfig.slug}" has builder.enabled=true but is missing required field: "${requiredField}". ` +
        `Builder entities must have fields: ${REQUIRED_BUILDER_FIELDS.join(', ')}`
      )
    }
  }

  // Check status field has correct type (select or text with appropriate options)
  const statusField = entityConfig.fields.find(f => f.name === 'status')
  if (statusField && statusField.type !== 'select' && statusField.type !== 'text') {
    result.warnings.push(
      `Entity "${entityConfig.slug}" has status field with type "${statusField.type}". ` +
      `Recommended: "select" with options ["draft", "published", ...] for better UX.`
    )
  }

  // Validate sidebarFields reference actual fields
  if (entityConfig.builder.sidebarFields) {
    for (const sidebarField of entityConfig.builder.sidebarFields) {
      if (!fieldNames.includes(sidebarField)) {
        result.warnings.push(
          `Entity "${entityConfig.slug}" references sidebarField "${sidebarField}" which does not exist in fields[].`
        )
      }
    }
  }

  // Validate basePath format (check access.basePath first, then deprecated builder.public.basePath)
  const basePath = entityConfig.access?.basePath ?? entityConfig.builder.public?.basePath
  if (basePath) {
    if (!basePath.startsWith('/')) {
      result.errors.push(
        `Entity "${entityConfig.slug}" has invalid basePath: "${basePath}". ` +
        `basePath must start with "/".`
      )
      result.valid = false
    }
    // Warn about deprecated builder.public.basePath if both are set
    if (entityConfig.access?.basePath && entityConfig.builder.public?.basePath) {
      result.warnings.push(
        `Entity "${entityConfig.slug}" has basePath defined in both access.basePath and builder.public.basePath. ` +
        `Using access.basePath. builder.public.basePath is deprecated and will be removed in v2.0.`
      )
    } else if (entityConfig.builder.public?.basePath && !entityConfig.access?.basePath) {
      result.warnings.push(
        `Entity "${entityConfig.slug}" uses deprecated builder.public.basePath. ` +
        `Please migrate to access.basePath. builder.public.basePath will be removed in v2.0.`
      )
    }
  }

  return result
}

/**
 * Validate TaxonomiesConfig
 */
export function validateTaxonomiesConfig(entityConfig: EntityConfig): BuilderValidationResult {
  const result: BuilderValidationResult = {
    valid: true,
    errors: [],
    warnings: []
  }

  // If taxonomies is not enabled, no validation needed
  if (!entityConfig.taxonomies?.enabled) {
    return result
  }

  // Check that types array exists and is not empty
  if (!entityConfig.taxonomies.types || entityConfig.taxonomies.types.length === 0) {
    result.errors.push(
      `Entity "${entityConfig.slug}" has taxonomies.enabled=true but taxonomies.types is empty. ` +
      `At least one taxonomy type must be defined.`
    )
    result.valid = false
    return result
  }

  // Validate each taxonomy type
  for (const taxonomyType of entityConfig.taxonomies.types) {
    // Check required properties
    if (!taxonomyType.type) {
      result.errors.push(
        `Entity "${entityConfig.slug}" has a taxonomy type with missing "type" property.`
      )
      result.valid = false
    }
    if (!taxonomyType.field) {
      result.errors.push(
        `Entity "${entityConfig.slug}" has a taxonomy type with missing "field" property.`
      )
      result.valid = false
    }
    if (taxonomyType.multiple === undefined) {
      result.warnings.push(
        `Entity "${entityConfig.slug}" taxonomy type "${taxonomyType.type}" has no "multiple" property. Defaulting to false.`
      )
    }
  }

  return result
}

/**
 * Get all entities with builder.enabled from a registry
 */
export function getBuilderEntities(
  registry: Record<string, EntityConfig>
): EntityConfig[] {
  return Object.values(registry).filter(
    entity => entity.builder?.enabled === true
  )
}

/**
 * Get the effective basePath for an entity
 * Reads from access.basePath (new) with fallback to builder.public.basePath (deprecated)
 */
export function getEntityBasePath(entity: EntityConfig): string | undefined {
  return entity.access?.basePath ?? entity.builder?.public?.basePath
}

/**
 * Match a URL path to an entity based on access.basePath
 * Uses longest-match strategy to handle nested paths
 *
 * @param path - The URL path to match (e.g., '/blog/my-post', '/about')
 * @param registry - Entity registry to search
 * @returns Match result with entity, slug, and optional isArchive flag
 */
export function matchPathToEntity(
  path: string,
  registry: Record<string, EntityConfig>
): { entity: EntityConfig; slug: string; isArchive?: boolean } | null {
  const builderEntities = getBuilderEntities(registry)

  // Sort by basePath length (longest first) for longest-match strategy
  const sortedEntities = builderEntities
    .filter(e => getEntityBasePath(e))
    .sort((a, b) => {
      const aPath = getEntityBasePath(a) || '/'
      const bPath = getEntityBasePath(b) || '/'
      return bPath.length - aPath.length
    })

  for (const entity of sortedEntities) {
    const basePath = getEntityBasePath(entity)!

    // Case: Exact match to basePath (archive page, e.g., /blog)
    if (path === basePath) {
      return { entity, slug: '', isArchive: true }
    }

    // Case: Root path (basePath = '/') matches paths below root
    if (basePath === '/') {
      // Allow multi-segment slugs only if the entity opts in via allowNestedSlugs.
      // Without the flag only single-segment paths (/my-page) match, avoiding a DB
      // round-trip for every unrecognised multi-segment URL (bots, crawlers, etc.).
      const pattern = entity.access?.allowNestedSlugs
        ? /^\/(.+)$/          // /qa/block/home-qa-us → slug: 'qa/block/home-qa-us'
        : /^\/([^/]+)$/       // /my-page only (no slashes in slug)
      const match = path.match(pattern)
      if (match) {
        return { entity, slug: match[1] }
      }
    } else {
      // Case: Custom basePath matches basePath + /[slug] (supports nested slugs)
      // e.g., basePath = '/blog' matches /blog/[slug] or /blog/nested/slug
      const pattern = new RegExp(`^${basePath.replace(/\//g, '\\/')}\\/(.+)$`)
      const match = path.match(pattern)
      if (match) {
        return { entity, slug: match[1] }
      }
    }
  }

  return null
}