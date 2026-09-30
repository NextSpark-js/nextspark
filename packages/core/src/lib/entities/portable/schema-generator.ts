/**
 * Schema Auto-Generation System
 *
 * Automatically generates Zod validation schemas from entity field definitions.
 * Supports create, update, and response schemas with child entities.
 *
 * PORTABLE: this file imports zod and its siblings in this directory and nothing else. The server
 * (lib/entities/schema-generator.ts re-exports it) and the generated portable contracts
 * (`nextspark prepare` copies this directory verbatim into the contracts package) run the same
 * bytes, so what a client validates and what the server enforces cannot drift.
 */

import { z } from 'zod'
import { SYSTEM_FIELD_NAMES } from './system-fields'
import type { EntityConfig, EntityField, ChildEntityDefinition } from './types'
import { mediaRefSchema } from './media-ref'
import { builderBlocksSchema } from './response-shape'

/** One uploaded file: the items of `file`, `video`, `audio` and multi-`image` fields. */
export const fileObjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  size: z.number(),
  url: z.string().url(),
  type: z.string().optional(),
})

/** `address` fields. */
export const addressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
  fullAddress: z.string().optional(),
})

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
    createFields.blocks = builderBlocksSchema.optional()
    // The builder editor also sends page `settings` (SEO, custom fields)
    // alongside `blocks`. Accepted here so the strict schema does not reject
    // builder saves; the generic handler only persists declared columns.
    createFields.settings = z.unknown().optional()
  }

  // #97: strict — z.object() silently STRIPS unknown keys by default, so a
  // typo'd key (`notes` for `note`) was accepted with a 201 and the value
  // quietly discarded. Unknown keys now fail validation (`unrecognized_keys`)
  // and the handlers answer 400 VALIDATION_ERROR naming them.
  const createSchema = z.object(createFields).strict()

  // Update schema (all fields optional). `.partial()` preserves the strict
  // unknown-keys policy for real typos, but the record a client fetched and
  // PATCHes back legitimately carries the read-only/system columns (`id`,
  // `createdAt`, `updatedAt`, soft-delete markers, read-only fields). The edit
  // form does exactly that, so those keys are stripped before validation
  // instead of failing the whole update as "unknown" (#97 follow-up).
  const readOnlyKeys = new Set<string>([
    ...SYSTEM_FIELD_NAMES,
    ...(entityConfig.table?.softDelete ? ['deletedAt', 'deletedBy'] : []),
    ...entityConfig.fields
      .filter(field => field.api.readOnly && !includeReadOnly)
      .map(field => field.name),
  ])
  const updateSchema = z.preprocess(
    (data) => stripKeys(data, readOnlyKeys),
    createSchema.partial()
  )

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
 * Drop the given keys from a plain object before validation. Non-object input
 * is returned untouched so the schema itself reports the type error.
 */
function stripKeys(data: unknown, keys: Set<string>): unknown {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data
  return Object.fromEntries(
    Object.entries(data as Record<string, unknown>).filter(([key]) => !keys.has(key))
  )
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
          // Return the field's defaultValue (as string) when available,
          // so NOT NULL DEFAULT '' columns receive '' instead of null.
          return field.defaultValue !== undefined ? String(field.defaultValue) : null
        }
        // Convert numbers to strings (e.g., year field: 2025 -> "2025")
        const strVal = typeof val === 'number' ? String(val) : val
        const trimmed = strict ? strVal.trim() : strVal
        // Enforce maxLength if defined on field
        if (field.maxLength && trimmed.length > field.maxLength) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${field.display.label} cannot exceed ${field.maxLength} characters`
          })
          return z.NEVER
        }
        return trimmed
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
      ]).transform((val, ctx) => {
        if (val === undefined) return null
        // Enforce min/max if defined on field
        if (typeof val === 'number') {
          if (field.min !== undefined && val < field.min) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `${field.display.label} must be at least ${field.min}`
            })
            return z.NEVER
          }
          if (field.max !== undefined && val > field.max) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `${field.display.label} must be at most ${field.max}`
            })
            return z.NEVER
          }
        }
        return val
      })
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
      schema = addressSchema
      break

    // Media types
    case 'media-library':
      // Stores { mediaId, url } from the Media Library (also accepts legacy string for backward compat)
      schema = mediaRefSchema.nullable()
      break

    case 'file':
    case 'video':
    case 'audio':
      schema = z.array(fileObjectSchema)
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
        z.array(fileObjectSchema),
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

  // Apply optional BEFORE default so that .default() becomes the outer wrapper.
  // In Zod, the outermost wrapper runs first: .default().optional() means .optional()
  // intercepts undefined before .default() can fire. With the reversed order
  // (.optional().default(x)), undefined hits .default() first → fills in the
  // default value → passes to the inner optional/schema as a real value.
  if (!field.required) {
    schema = schema.optional()
  }

  // Apply default value AFTER optional so it is the outermost wrapper and fires
  // for undefined inputs even on optional fields.
  if (field.defaultValue !== undefined) {
    schema = schema.default(field.defaultValue)
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

  // Same unknown-keys policy as the parent create/update schemas (#97)
  return z.object(fields).strict()
}
