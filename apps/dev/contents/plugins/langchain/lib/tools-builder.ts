import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'

export interface ToolDefinition<T extends z.ZodObject<z.ZodRawShape>> {
    name: string
    description: string
    schema: T
    func: (input: z.infer<T>) => Promise<string>
}

/**
 * Get the Zod type name for a field (Zod v4 compatible)
 */
function getZodTypeName(zodField: z.ZodTypeAny): string {
    // Zod v4: use _zod.def.type
    const zodDef = (zodField as unknown as { _zod?: { def?: { type?: string } } })._zod
    if (zodDef?.def?.type) {
        return zodDef.def.type
    }
    // Fallback for edge cases
    return 'unknown'
}

/**
 * Get the inner type for optional/array types (Zod v4 compatible)
 */
function getInnerType(zodField: z.ZodTypeAny): z.ZodTypeAny | null {
    const zodDef = (zodField as unknown as { _zod?: { def?: { innerType?: z.ZodTypeAny; element?: z.ZodTypeAny } } })._zod
    // For optional types
    if (zodDef?.def?.innerType) {
        return zodDef.def.innerType
    }
    // For array types
    if (zodDef?.def?.element) {
        return zodDef.def.element
    }
    return null
}

/**
 * Get enum values (Zod v4 compatible)
 */
function getEnumValues(zodField: z.ZodTypeAny): string[] | null {
    const zodDef = (zodField as unknown as { _zod?: { def?: { entries?: Record<string, string> } } })._zod
    if (zodDef?.def?.entries) {
        return Object.values(zodDef.def.entries)
    }
    return null
}

/**
 * Convert Zod schema to JSON Schema with explicit type: "object"
 * LM Studio requires type: "object" at root level which zodToJsonSchema sometimes omits
 *
 * Zod v4 compatible implementation
 */
export function zodToOpenAISchema(zodSchema: z.ZodObject<z.ZodRawShape>): Record<string, unknown> {
    const shape = zodSchema.shape
    const properties: Record<string, unknown> = {}
    const required: string[] = []

    for (const [key, value] of Object.entries(shape)) {
        const zodField = value as z.ZodTypeAny
        const fieldSchema: Record<string, unknown> = {}

        // Get the description if available (Zod v4 uses .description property)
        const description = (zodField as unknown as { description?: string }).description
        if (description) {
            fieldSchema.description = description
        }

        // Get the type name using Zod v4 API
        const typeName = getZodTypeName(zodField)

        // Handle different Zod types
        switch (typeName) {
            case 'string':
                fieldSchema.type = 'string'
                break
            case 'number':
                fieldSchema.type = 'number'
                break
            case 'boolean':
                fieldSchema.type = 'boolean'
                break
            case 'array': {
                fieldSchema.type = 'array'
                const elementType = getInnerType(zodField)
                if (elementType) {
                    const elementTypeName = getZodTypeName(elementType)
                    if (elementTypeName === 'object') {
                        fieldSchema.items = zodToOpenAISchema(elementType as z.ZodObject<z.ZodRawShape>)
                    } else if (elementTypeName === 'string') {
                        fieldSchema.items = { type: 'string' }
                    } else {
                        fieldSchema.items = { type: 'string' } // default fallback
                    }
                } else {
                    fieldSchema.items = { type: 'string' } // default fallback
                }
                break
            }
            case 'object':
                Object.assign(fieldSchema, zodToOpenAISchema(zodField as z.ZodObject<z.ZodRawShape>))
                break
            case 'optional': {
                // Handle optional - get inner type
                const innerType = getInnerType(zodField)
                if (innerType) {
                    const innerTypeName = getZodTypeName(innerType)
                    if (innerTypeName === 'string') {
                        fieldSchema.type = 'string'
                    } else if (innerTypeName === 'number') {
                        fieldSchema.type = 'number'
                    } else if (innerTypeName === 'boolean') {
                        fieldSchema.type = 'boolean'
                    } else {
                        fieldSchema.type = 'string'
                    }
                } else {
                    fieldSchema.type = 'string'
                }
                break
            }
            case 'enum': {
                fieldSchema.type = 'string'
                const enumValues = getEnumValues(zodField)
                if (enumValues) {
                    fieldSchema.enum = enumValues
                }
                break
            }
            default:
                // Default to string for unknown types
                fieldSchema.type = 'string'
        }

        properties[key] = fieldSchema

        // Check if required (not optional)
        if (typeName !== 'optional') {
            required.push(key)
        }
    }

    return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
    }
}

/**
 * Convert tool definitions to OpenAI tool format with proper type: "object"
 * Use this for LM Studio compatibility
 */
export function convertToOpenAITools(definitions: ToolDefinition<z.ZodObject<z.ZodRawShape>>[]): Array<{
    type: 'function'
    function: {
        name: string
        description: string
        parameters: Record<string, unknown>
    }
}> {
    return definitions.map(def => ({
        type: 'function' as const,
        function: {
            name: def.name,
            description: def.description,
            parameters: zodToOpenAISchema(def.schema),
        },
    }))
}

/**
 * Create a LangChain tool from a definition
 */
export function createTool<T extends z.ZodObject<z.ZodRawShape>>(def: ToolDefinition<T>) {
    return new DynamicStructuredTool({
        name: def.name,
        description: def.description,
        schema: def.schema,
        func: def.func,
    })
}

/**
 * Build multiple tools from definitions
 */
export function buildTools(definitions: ToolDefinition<z.ZodObject<z.ZodRawShape>>[]) {
    return definitions.map(createTool)
}
