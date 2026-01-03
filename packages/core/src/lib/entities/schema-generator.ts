/**
 * Schema Auto-Generation System
 * 
 * Automatically generates Zod validation schemas from entity field definitions.
 * Supports create, update, and response schemas with child entities.
 */

import { z } from 'zod'
import type { EntityConfig, EntityField, ChildEntityDefinition } from './types'

export interface SchemaGenerationOptions {
  includeReadOnly?: boolean
  includeChildEntities?: boolean
  customValidation?: Record<string, z.ZodSchema>
  strict?: boolean
}

export interface GeneratedSchemas {
  create: z.ZodSchema
  update: z.ZodSchema
  response: z.ZodSchema
  list: z.ZodSchema
  childSchemas?: Record<string, z.ZodSchema>
}

/**
 * Generate all schemas for an entity
 */
export function generateEntitySchemas(
  entityConfig: EntityConfig,
  options: SchemaGenerationOptions = {}
): GeneratedSchemas {
  const {
    includeReadOnly = false,
    includeChildEntities = true,
    customValidation = {},
    strict = true
  } = options

  // Generate base field definitions for validation
  generateBaseSchema(entityConfig, customValidation, strict)
  
  // Create schema (exclude read-only fields)
  const createFields = entityConfig.fields
    .filter(field => !field.api.readOnly || includeReadOnly)
    .reduce((acc, field) => {
      const fieldSchema = generateFieldSchema(field, customValidation, strict)
      if (fieldSchema) {
        acc[field.name] = fieldSchema
      }
      return acc
    }, {} as Record<string, z.ZodTypeAny>)

  // Add child entities to create schema
  if (includeChildEntities && entityConfig.childEntities) {
    const childrenSchema = generateChildrenSchema(entityConfig.childEntities, strict)
    if (Object.keys(childrenSchema).length > 0) {
      createFields.children = z.object(childrenSchema).optional()
    }
  }

  // Add blocks field for builder-enabled entities
  // Blocks are managed by the builder interface, not regular entity forms
  if (entityConfig.builder?.enabled) {
    createFields.blocks = z.union([
      z.array(z.object({
        id: z.string(),
        blockSlug: z.string(),
        props: z.record(z.string(), z.unknown()).optional(),
      })),
      z.unknown(), // Fallback for flexibility
    ]).optional()
  }

  const createSchema = z.object(createFields)
  
  // Update schema (all fields optional except id)
  const updateSchema = createSchema.partial()
  
  // Response schema (includes all fields including read-only)
  const responseFields = entityConfig.fields.reduce((acc, field) => {
    const fieldSchema = generateFieldSchema(field, customValidation, false) // Less strict for responses
    if (fieldSchema) {
      acc[field.name] = fieldSchema
    }
    return acc
  }, {} as Record<string, z.ZodTypeAny>)

  // Add common response fields
  responseFields.id = z.string()
  responseFields.createdAt = z.string().datetime()
  responseFields.updatedAt = z.string().datetime()

  // Add child entities to response schema
  let childSchemas: Record<string, z.ZodSchema> | undefined
  if (includeChildEntities && entityConfig.childEntities) {
    childSchemas = {}
    Object.entries(entityConfig.childEntities).forEach(([childName, childConfig]) => {
      childSchemas![childName] = generateChildEntitySchema(childConfig, false)
      responseFields[childName] = z.array(childSchemas![childName]).optional()
    })
    
    responseFields.children = z.record(z.string(), z.array(z.unknown())).optional()
  }

  const responseSchema = z.object(responseFields)
  
  // List response schema
  const listSchema = z.object({
    data: z.array(responseSchema),
    meta: z.object({
      total: z.number(),
      page: z.number(),
      limit: z.number(),
      hasMore: z.boolean()
    }).optional(),
    children: z.record(z.string(), z.record(z.string(), z.array(z.unknown()))).optional()
  })

  return {
    create: createSchema,
    update: updateSchema,
    response: responseSchema,
    list: listSchema,
    childSchemas
  }
}

/**
 * Generate base schema from entity fields
 */
function generateBaseSchema(
  entityConfig: EntityConfig,
  customValidation: Record<string, z.ZodSchema>,
  strict: boolean
): z.ZodSchema {
  const fields = entityConfig.fields.reduce((acc, field) => {
    const fieldSchema = generateFieldSchema(field, customValidation, strict)
    if (fieldSchema) {
      acc[field.name] = fieldSchema
    }
    return acc
  }, {} as Record<string, z.ZodTypeAny>)

  return z.object(fields)
}

/**
 * Generate Zod schema for a single field
 */
function generateFieldSchema(
  field: EntityField,
  customValidation: Record<string, z.ZodSchema>,
  strict: boolean = true
): z.ZodTypeAny | null {
  // Use custom validation if provided
  if (customValidation[field.name]) {
    return field.required ? customValidation[field.name] : customValidation[field.name].optional()
  }

  let schema: z.ZodTypeAny

  switch (field.type) {
    // Basic text types
    case 'text':
    case 'textarea':
      // Handle text fields that might come as empty strings from forms
      // Also handle numbers that might be sent for text fields (e.g., year "2025" might come as 2025)
      schema = z.union([
        z.string(),
        z.number(),  // Accept numbers and convert to string
        z.null(),
        z.undefined()
      ]).transform((val, ctx) => {
        if (val === '' || val === null || val === undefined) {
          if (field.required) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `${field.display.label} is required`
            })
            return z.NEVER
          }
          return null
        }
        // Convert numbers to strings (e.g., year field: 2025 -> "2025")
        const strVal = typeof val === 'number' ? String(val) : val
        return strict ? strVal.trim() : strVal
      })
      break

    case 'email':
      // Handle email fields that might come as empty strings from forms
      schema = z.union([
        z.string(),
        z.literal(''),
        z.null(),
        z.undefined()
      ]).transform((val, ctx) => {
        if (val === '' || val === null || val === undefined) {
          if (field.required) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `${field.display.label} is required`
            })
            return z.NEVER
          }
          return null
        }

        // Validate email format
        const emailVal = strict ? val.trim().toLowerCase() : val
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(emailVal)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${field.display.label} must be a valid email address`
          })
          return z.NEVER
        }
        return emailVal
      })
      break

    case 'url':
      // Handle URL fields that might come as empty strings from forms
      schema = z.union([
        z.string(),
        z.literal(''),
        z.null(),
        z.undefined()
      ]).transform((val, ctx) => {
        if (val === '' || val === null || val === undefined) {
          if (field.required) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `${field.display.label} is required`
            })
            return z.NEVER
          }
          return null
        }

        // Normalize the URL by trimming
        const trimmedVal = strict ? val.trim() : val

        // Add https:// if no protocol is present
        let normalizedUrl = trimmedVal
        if (!/^https?:\/\//i.test(trimmedVal)) {
          normalizedUrl = `https://${trimmedVal}`
        }

        // Validate the normalized URL
        try {
          new URL(normalizedUrl)
          return normalizedUrl
        } catch {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${field.display.label} must be a valid URL`
          })
          return z.NEVER
        }
      })
      break

    case 'phone':
      // Handle phone fields that might come as empty strings from forms
      schema = z.union([
        z.string(),
        z.literal(''),
        z.null(),
        z.undefined()
      ]).transform((val, ctx) => {
        if (val === '' || val === null || val === undefined) {
          if (field.required) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `${field.display.label} is required`
            })
            return z.NEVER
          }
          return null
        }

        // Validate phone format (flexible - just ensure it has some digits)
        const phoneVal = strict ? val.trim() : val
        const phoneRegex = /^[\+]?[\d\s\-\(\)]{6,20}$/
        if (!phoneRegex.test(phoneVal)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${field.display.label} must be a valid phone number`
          })
          return z.NEVER
        }
        return phoneVal
      })
      break

    case 'number':
    case 'range':
      // Handle number fields that might come as empty strings from forms
      schema = z.union([
        z.number(),
        z.string().transform((val, ctx) => {
          if (val === '' || val === null || val === undefined) {
            if (field.required) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `${field.display.label} is required`
              })
              return z.NEVER
            }
            return null
          }
          const num = Number(val)
          if (isNaN(num)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `${field.display.label} must be a valid number`
            })
            return z.NEVER
          }
          return num
        }),
        z.null(),
        z.undefined()
      ]).transform(val => val === undefined ? null : val)
      break

    case 'doublerange':
      schema = z.array(z.number()).length(2, {
        message: `${field.display.label} must be a range with exactly 2 numbers`
      })
      break

    case 'boolean':
      schema = z.boolean()
      break

    case 'date':
      // Handle date fields - accept multiple formats and normalize to YYYY-MM-DD
      schema = z.union([
        z.string().date(`${field.display.label} must be a valid date (YYYY-MM-DD)`),
        z.string().transform((val, ctx) => {
          if (val === '' || val === null || val === undefined) {
            if (field.required) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `${field.display.label} is required`
              })
              return z.NEVER
            }
            return null
          }

          // Try to parse as a date and extract YYYY-MM-DD
          try {
            const date = new Date(val)
            if (isNaN(date.getTime())) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `${field.display.label} must be a valid date`
              })
              return z.NEVER
            }
            // Return YYYY-MM-DD format
            return date.toISOString().split('T')[0]
          } catch {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `${field.display.label} must be a valid date`
            })
            return z.NEVER
          }
        }),
        z.null(),
      ])
      break

    case 'datetime':
      // Handle datetime fields from HTML5 datetime-local inputs
      schema = z.union([
        z.string().datetime(`${field.display.label} must be a valid datetime (ISO 8601)`),
        z.string().transform((val, ctx) => {
          if (val === '' || val === null || val === undefined) {
            if (field.required) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `${field.display.label} is required`
              })
              return z.NEVER
            }
            return null
          }
          
          // Handle HTML5 datetime-local format (YYYY-MM-DDTHH:mm)
          if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(val)) {
            // Convert to ISO 8601 by adding seconds and timezone
            return `${val}:00.000Z`
          }
          
          // Try to parse as ISO 8601
          try {
            const date = new Date(val)
            if (isNaN(date.getTime())) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `${field.display.label} must be a valid datetime`
              })
              return z.NEVER
            }
            return date.toISOString()
          } catch {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `${field.display.label} must be a valid datetime`
            })
            return z.NEVER
          }
        }),
        z.null(),
        z.undefined()
      ]).transform(val => val === undefined ? null : val)
      break

    case 'json':
      schema = z.unknown()
      if (strict) {
        schema = z.union([
          z.object({}).passthrough(),
          z.array(z.unknown()),
          z.string().transform((str, ctx) => {
            // Handle empty strings as null
            if (str === '' || str === null || str === undefined) {
              if (field.required) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: `${field.display.label} is required`
                })
                return z.NEVER
              }
              return null
            }
            try {
              return JSON.parse(str)
            } catch {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `${field.display.label} must be valid JSON`
              })
              return z.NEVER
            }
          }),
          z.literal(''),
          z.null(),
          z.undefined()
        ]).transform((val) => {
          // Final transformation: empty values become null
          if (val === '' || val === null || val === undefined) {
            return null
          }
          return val
        })
      }
      break

    // Selection types
    case 'select':
    case 'radio':
    case 'buttongroup':
    case 'combobox':
      if (field.options && field.options.length > 0) {
        const values = field.options.map(opt => opt.value) as [string, ...string[]]
        // Handle empty values from forms (empty strings, null, undefined)
        // Also handle numbers that might be sent instead of strings (e.g., quarter: 2 instead of "2")
        schema = z.union([
          z.enum(values, {
            message: `${field.display.label} must be one of: ${values.join(', ')}`
          }),
          z.number(), // Accept numbers and convert to string
          z.literal(''),
          z.null(),
          z.undefined()
        ]).transform((val, ctx) => {
          if (val === '' || val === null || val === undefined) {
            if (field.required) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `${field.display.label} is required`
              })
              return z.NEVER
            }
            return null
          }
          // Convert numbers to strings (e.g., quarter: 2 -> "2")
          const strVal = typeof val === 'number' ? String(val) : val
          // Validate that the converted value is in the allowed options
          if (!values.includes(strVal)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `${field.display.label} must be one of: ${values.join(', ')}`
            })
            return z.NEVER
          }
          return strVal
        })
      } else {
        schema = z.string()
      }
      break

    case 'multiselect':
      // Handle empty values from forms (empty strings, null, undefined)
      if (field.options && field.options.length > 0) {
        const values = field.options.map(opt => opt.value)
        schema = z.union([
          z.array(z.enum(values as [string, ...string[]])),
          z.literal(''),
          z.null(),
          z.undefined()
        ]).transform((val, ctx) => {
          if (val === '' || val === null || val === undefined) {
            if (field.required) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `${field.display.label} is required`
              })
              return z.NEVER
            }
            return []
          }
          return Array.isArray(val) ? val : []
        })
      } else {
        schema = z.union([
          z.array(z.string()),
          z.literal(''),
          z.null(),
          z.undefined()
        ]).transform((val, ctx) => {
          if (val === '' || val === null || val === undefined) {
            if (field.required) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `${field.display.label} is required`
              })
              return z.NEVER
            }
            return []
          }
          return Array.isArray(val) ? val : []
        })
      }
      break

    case 'tags':
      // Handle empty values from forms (empty strings, null, undefined)
      schema = z.union([
        z.array(z.string()),
        z.literal(''),
        z.null(),
        z.undefined()
      ]).transform((val, ctx) => {
        if (val === '' || val === null || val === undefined) {
          if (field.required) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `${field.display.label} is required`
            })
            return z.NEVER
          }
          return []
        }
        return Array.isArray(val) ? val : []
      })
      break

    // Specialized inputs
    case 'rating':
      schema = z.number().min(0).max(5)
      break

    // Location & data selectors
    case 'timezone':
      // Handle empty values from forms (empty strings, null, undefined)
      schema = z.union([
        z.string(),
        z.literal(''),
        z.null(),
        z.undefined()
      ]).transform((val, ctx) => {
        if (val === '' || val === null || val === undefined) {
          if (field.required) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `${field.display.label} is required`
            })
            return z.NEVER
          }
          return null
        }
        return val
      })
      // Could add enum validation for valid timezones
      break

    case 'currency':
      schema = z.string().length(3, `${field.display.label} must be a valid 3-letter currency code`)
      break

    case 'country':
      schema = z.string().length(2, `${field.display.label} must be a valid 2-letter country code`)
      break

    case 'address':
      schema = z.object({
        street: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zipCode: z.string().optional(),
        country: z.string().optional(),
        fullAddress: z.string().optional(),
      })
      break

    // Media types
    case 'file':
    case 'video':
    case 'audio':
      schema = z.array(z.object({
        id: z.string(),
        name: z.string(),
        size: z.number(),
        url: z.string().url(),
        type: z.string().optional(),
      }))
      break

    case 'image':
      // Image field can be:
      // 1. A simple string URL (for single image like featuredImage)
      // 2. An array of image objects (for multi-image uploads)
      // 3. null/undefined/empty string (when no image)
      schema = z.union([
        // Simple URL string
        z.string().url(),
        z.string().transform((val, ctx) => {
          if (val === '' || val === null || val === undefined) {
            return null
          }
          // Check if it looks like a URL (starts with http, https, or blob:)
          if (val.startsWith('http') || val.startsWith('blob:') || val.startsWith('/')) {
            return val
          }
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${field.display.label} must be a valid image URL`
          })
          return z.NEVER
        }),
        // Array of image objects (for multi-image)
        z.array(z.object({
          id: z.string(),
          name: z.string(),
          size: z.number(),
          url: z.string().url(),
          type: z.string().optional(),
        })),
        z.literal(''),
        z.null(),
        z.undefined()
      ]).transform(val => {
        if (val === '' || val === undefined) return null
        return val
      })
      break

    // Relationship types
    case 'relation':
      // Single relation - expects a single ID string or null
      schema = z.union([
        z.string().min(1), // Simple ID string (non-empty)
        z.literal(''), // Empty string
        z.null(),
        z.undefined(),
      ]).transform(val => val === '' || val === undefined ? null : val)
      break

    case 'relation-multi':
      // Multiple relations - accepts array of IDs or JSON string, converts to JSON string for DB
      schema = z.union([
        z.array(z.string().min(1)).transform(arr => JSON.stringify(arr)), // Convert array to JSON string
        z.string().transform((str, ctx) => {
          // If it's already a JSON string, validate and return as-is
          if (str === '' || str === null || str === undefined) {
            return JSON.stringify([])
          }
          try {
            const parsed = JSON.parse(str)
            if (Array.isArray(parsed)) {
              return str // Already valid JSON array string
            }
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `${field.display.label} must be a valid JSON array`
            })
            return z.NEVER
          } catch {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `${field.display.label} must be a valid JSON array`
            })
            return z.NEVER
          }
        }),
        z.null().transform(() => JSON.stringify([])),
        z.undefined().transform(() => JSON.stringify([]))
      ]).default(JSON.stringify([]))
      break

    case 'relation-prop':
      // Single property relation - accepts property value directly (string)
      schema = z.union([
        z.string().min(1), // Property value string (non-empty)
        z.literal(''), // Empty string
        z.null(),
        z.undefined(),
      ]).transform(val => val === '' || val === undefined ? null : val)
      break

    case 'relation-prop-multi':
      // Multiple property relations - accepts array of property values or JSON string
      schema = z.union([
        z.array(z.string().min(1)).transform(arr => JSON.stringify(arr)), // Convert array to JSON string
        z.string().transform((str, ctx) => {
          // If it's already a JSON string, validate and return as-is
          if (str === '' || str === null || str === undefined) {
            return JSON.stringify([])
          }
          try {
            const parsed = JSON.parse(str)
            if (Array.isArray(parsed)) {
              return str // Already valid JSON array string
            }
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `${field.display.label} must be a valid JSON array`
            })
            return z.NEVER
          } catch {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `${field.display.label} must be a valid JSON array`
            })
            return z.NEVER
          }
        }),
        z.null().transform(() => JSON.stringify([])),
        z.undefined().transform(() => JSON.stringify([]))
      ]).default(JSON.stringify([]))
      break

    case 'user':
      // Handle user field - accepts string user ID for database storage
      // The form sends a user ID string, which gets stored directly in the database
      schema = z.union([
        // String user ID (primary format for database storage)
        z.string().min(1),
        // Legacy: array of user objects (kept for backward compatibility)
        z.array(z.object({
          id: z.union([z.string(), z.number()]),
          firstName: z.string().optional(),
          lastName: z.string().optional(),
          email: z.string().optional(),
          avatar: z.union([z.string(), z.null()]).optional(),
          role: z.string().optional(),
        })),
        // Empty values
        z.literal(''),
        z.null(),
        z.undefined()
      ]).transform((val, ctx) => {
        // Empty array, empty string, null, or undefined -> null
        if (val === '' || val === null || val === undefined || (Array.isArray(val) && val.length === 0)) {
          if (field.required) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `${field.display.label} is required`
            })
            return z.NEVER
          }
          return null
        }
        // If it's an array of objects, extract the first user's ID for single-user fields
        if (Array.isArray(val) && val.length > 0) {
          const firstUser = val[0]
          if (typeof firstUser === 'object' && firstUser.id) {
            return String(firstUser.id)
          }
        }
        // String user ID - return as-is for database storage
        return val
      })
      break

    // Text editors
    case 'markdown':
    case 'richtext':
    case 'code':
      schema = z.string()
      if (strict) {
        schema = (schema as z.ZodString).trim()
      }
      break

    default:
      // Unknown field type, allow any value but log warning
      console.warn(`Unknown field type: ${field.type} for field ${field.name}`)
      schema = z.unknown()
  }

  // Apply default value if provided
  if (field.defaultValue !== undefined) {
    schema = schema.default(field.defaultValue)
  }

  // Make optional if not required
  if (!field.required) {
    schema = schema.optional()
  }

  return schema
}

/**
 * Generate schema for child entities
 */
function generateChildrenSchema(
  childEntities: Record<string, ChildEntityDefinition>,
  strict: boolean
): Record<string, z.ZodTypeAny> {
  const childrenSchema: Record<string, z.ZodTypeAny> = {}

  Object.entries(childEntities).forEach(([childName, childConfig]) => {
    childrenSchema[childName] = z.array(generateChildEntitySchema(childConfig, strict)).optional()
  })

  return childrenSchema
}

/**
 * Generate schema for a child entity
 */
function generateChildEntitySchema(
  childConfig: ChildEntityDefinition,
  strict: boolean = true
): z.ZodSchema {
  const fields: Record<string, z.ZodTypeAny> = {}

  // Add id field for updates (optional for creates)
  fields.id = z.string().optional()

  childConfig.fields.forEach(field => {
    // Transform ChildEntityField to EntityField by adding required properties
    const entityField = {
      ...field,
      api: {
        searchable: false,
        sortable: true,
        readOnly: false,
      },
      display: field.display || {
        label: field.name,
        description: `${field.name} field`,
        showInList: true,
        showInDetail: true,
        showInForm: true,
        order: 1,
      },
    }
    const fieldSchema = generateFieldSchema(entityField, {}, strict)
    if (fieldSchema) {
      fields[field.name] = fieldSchema
    }
  })

  return z.object(fields)
}

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

    // Case: Root path (basePath = '/') matches single segment paths
    if (basePath === '/') {
      // Path should be /[anything-without-slashes]
      const match = path.match(/^\/([^\/]+)$/)
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