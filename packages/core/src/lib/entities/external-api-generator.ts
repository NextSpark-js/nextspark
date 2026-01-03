/**
 * External API Generator
 * 
 * Generates external REST APIs for entities with automatic auth, rate limiting,
 * pagination, filtering, and CORS handling.
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateEntityAPI, APIGeneratorOptions } from './api-generator'
import type { EntityConfig } from './types'
import { getEntityConfig } from './registry'
import { rateLimit } from '../rate-limit'
import { validateAPIKey } from '../auth/api-keys'

export interface ExternalAPIOptions extends APIGeneratorOptions {
  enableAPIKeyAuth?: boolean
  enableRateLimit?: boolean
  enableCORS?: boolean
  rateLimitConfig?: {
    windowMs: number
    maxRequests: number
  }
  corsOptions?: {
    origins: string[]
    methods: string[]
    headers: string[]
  }
}

export interface ExternalAPIContext {
  entityName: string
  entityConfig: EntityConfig
  apiKey?: string
  clientId?: string
  userAgent?: string
  ip?: string
}

/**
 * Generate external REST API for an entity with v1 prefix
 */
export function generateExternalAPI(
  entityName: string, 
  options: ExternalAPIOptions = {}
) {
  const entityConfig = getEntityConfig(entityName)
  if (!entityConfig) {
    throw new Error(`Entity configuration not found: ${entityName}`)
  }

  // Validate that entity has external API enabled
  if (!entityConfig.access.api) {
    throw new Error(`Entity ${entityName} does not have external API enabled`)
  }

  const {
    enableAPIKeyAuth = true,
    enableRateLimit: enableRL = true,
    enableCORS = true,
    rateLimitConfig = {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 60 // Default rate limit
    },
    corsOptions = {
      origins: ['*'],
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization', 'X-API-Key']
    }
  } = options

  // Generate base CRUD handlers
  const baseAPI = generateEntityAPI(entityName, {
    ...options,
    enableAuth: false, // We'll handle API key auth separately
  })

  return {
    GET: wrapExternalHandler(baseAPI.GET, entityConfig, {
      enableAPIKeyAuth,
      enableRateLimit: enableRL,
      enableCORS,
      rateLimitConfig,
      corsOptions,
      action: 'read'
    }),
    POST: wrapExternalHandler(baseAPI.POST, entityConfig, {
      enableAPIKeyAuth,
      enableRateLimit: enableRL,
      enableCORS,
      rateLimitConfig,
      corsOptions,
      action: 'create'
    }),
    PATCH: wrapExternalHandler(baseAPI.PATCH, entityConfig, {
      enableAPIKeyAuth,
      enableRateLimit: enableRL,
      enableCORS,
      rateLimitConfig,
      corsOptions,
      action: 'update'
    }),
    DELETE: wrapExternalHandler(baseAPI.DELETE, entityConfig, {
      enableAPIKeyAuth,
      enableRateLimit: enableRL,
      enableCORS,
      rateLimitConfig,
      corsOptions,
      action: 'delete'
    }),
    OPTIONS: createOPTIONSHandler(corsOptions)
  }
}

/**
 * Wrap base API handler with external API middleware
 */
function wrapExternalHandler(
  baseHandler: (req: NextRequest, context?: { params?: { id?: string } }) => Promise<NextResponse>,
  entityConfig: EntityConfig,
  options: {
    enableAPIKeyAuth: boolean
    enableRateLimit: boolean
    enableCORS: boolean
    rateLimitConfig: { windowMs: number; maxRequests: number }
    corsOptions: { origins: string[]; methods: string[]; headers: string[] }
    action: 'create' | 'read' | 'update' | 'delete'
  }
) {
  return async (request: NextRequest, context?: { params?: { id?: string } }) => {
    try {
      // CORS preflight
      if (options.enableCORS && request.method === 'OPTIONS') {
        return createOPTIONSHandler(options.corsOptions)(request)
      }

      // Validate allowed methods
      const allowedMethods = ['GET', 'POST', 'PATCH', 'DELETE']
      if (!allowedMethods.includes(request.method)) {
        return createErrorResponse(405, 'Method not allowed', {
          allowedMethods
        })
      }

      // Rate limiting
      if (options.enableRateLimit && true) {
        const rateLimitResult = await rateLimit({
          key: getClientIdentifier(request),
          windowMs: options.rateLimitConfig.windowMs,
          maxRequests: options.rateLimitConfig.maxRequests
        })

        if (!rateLimitResult.success) {
          return createErrorResponse(429, 'Rate limit exceeded', {
            limit: options.rateLimitConfig.maxRequests,
            windowMs: options.rateLimitConfig.windowMs,
            retryAfter: rateLimitResult.retryAfter
          })
        }
      }

      // API Key authentication
      if (options.enableAPIKeyAuth) {
        const apiKey = request.headers.get('X-API-Key') || request.headers.get('Authorization')?.replace('Bearer ', '')
        
        if (!apiKey) {
          return createErrorResponse(401, 'API key required', {
            hint: 'Include X-API-Key header or Authorization: Bearer <api-key>'
          })
        }

        const keyValidation = await validateAPIKey(apiKey, {
          requiredScopes: [`${entityConfig.slug}:${options.action}`],
          entityName: entityConfig.slug
        })

        if (!keyValidation.valid) {
          return createErrorResponse(401, 'Invalid API key', {
            reason: keyValidation.reason
          })
        }

        // Add API key context to request headers for downstream handlers
        request.headers.set('x-client-id', keyValidation.clientId || '')
        request.headers.set('x-api-key-id', keyValidation.apiKeyId || '')
        
        // Add user context from API key
        if (keyValidation.userId) {
          request.headers.set('x-user-id', keyValidation.userId)
        }
      }

      // Call base handler
      const response = await baseHandler(request, context)

      // Add CORS headers to response
      if (options.enableCORS) {
        addCORSHeaders(response, options.corsOptions)
      }

      // Add external API specific headers
      response.headers.set('X-API-Version', 'v1')
      response.headers.set('X-Entity-Type', entityConfig.slug)
      response.headers.set('X-Response-Time', Date.now().toString())

      // Add rate limit headers
      if (options.enableRateLimit) {
        response.headers.set('X-RateLimit-Limit', options.rateLimitConfig.maxRequests.toString())
        response.headers.set('X-RateLimit-Window', options.rateLimitConfig.windowMs.toString())
      }

      return response

    } catch (error) {
      console.error(`External API error for ${entityConfig.slug}:`, error)
      return createErrorResponse(500, 'Internal server error', {
        timestamp: new Date().toISOString(),
        entity: entityConfig.slug
      })
    }
  }
}

/**
 * Create OPTIONS handler for CORS preflight
 */
function createOPTIONSHandler(corsOptions: { origins: string[]; methods: string[]; headers: string[] }) {
  return async (request: NextRequest) => {
    const response = new NextResponse(null, { status: 204 })
    addCORSHeaders(response, corsOptions, request)
    return response
  }
}

/**
 * Add CORS headers to response
 */
function addCORSHeaders(
  response: NextResponse, 
  corsOptions: { origins: string[]; methods: string[]; headers: string[] },
  request?: NextRequest
) {
  const origin = request?.headers.get('origin')
  
  // Check if origin is allowed
  if (corsOptions.origins.includes('*') || (origin && corsOptions.origins.includes(origin))) {
    response.headers.set('Access-Control-Allow-Origin', origin || '*')
  }
  
  response.headers.set('Access-Control-Allow-Methods', corsOptions.methods.join(', '))
  response.headers.set('Access-Control-Allow-Headers', corsOptions.headers.join(', '))
  response.headers.set('Access-Control-Max-Age', '86400') // 24 hours
  response.headers.set('Access-Control-Allow-Credentials', 'true')
}

/**
 * Create standardized error response
 */
function createErrorResponse(status: number, message: string, details?: Record<string, unknown>) {
  return NextResponse.json({
    error: {
      status,
      message,
      timestamp: new Date().toISOString(),
      ...details
    }
  }, { status })
}

/**
 * Get client identifier for rate limiting
 */
function getClientIdentifier(request: NextRequest): string {
  // Priority: API Key ID > Client ID > IP address
  const apiKeyId = request.headers.get('x-api-key-id')
  const clientId = request.headers.get('x-client-id')
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
  
  return apiKeyId || clientId || ip
}

/**
 * Generate OpenAPI/Swagger documentation for entity
 */
export function generateOpenAPISpec(entityName: string) {
  const entityConfig = getEntityConfig(entityName)
  if (!entityConfig) {
    throw new Error(`Entity configuration not found: ${entityName}`)
  }

  const paths: Record<string, Record<string, unknown>> = {}
  const basePath = `/api/v1/${entityName}`

  // Generate schema definitions
  const entitySchema = {
    type: 'object',
    properties: entityConfig.fields.reduce((props, field) => {
      props[field.name] = {
        type: getOpenAPIType(field.type),
        description: field.display.description || field.display.label,
        ...(field.required ? {} : { nullable: true })
      }
      return props
    }, {} as Record<string, Record<string, unknown>>),
    required: entityConfig.fields.filter(f => f.required).map(f => f.name)
  }

  // List endpoint
  paths[basePath] = {
    get: {
      summary: `List ${entityConfig.names.plural}`,
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 10, maximum: 100 } },
        { name: 'search', in: 'query', schema: { type: 'string' } },
        { name: 'sortBy', in: 'query', schema: { type: 'string' } },
        { name: 'sortOrder', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
        ...(entityConfig.childEntities ? [
          { name: 'children', in: 'query', schema: { type: 'string', description: 'Comma-separated child entity names to include' } }
        ] : [])
      ],
      responses: {
        200: {
          description: `List of ${entityConfig.names.plural}`,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { type: 'array', items: { $ref: `#/components/schemas/${entityConfig.slug}` } },
                  meta: {
                    type: 'object',
                    properties: {
                      total: { type: 'integer' },
                      page: { type: 'integer' },
                      limit: { type: 'integer' },
                      hasMore: { type: 'boolean' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    post: {
      summary: `Create ${entityConfig.names.singular}`,
      requestBody: {
        content: {
          'application/json': {
            schema: { $ref: `#/components/schemas/${entityConfig.slug}Create` }
          }
        }
      },
      responses: {
        201: {
          description: `Created ${entityConfig.names.singular}`,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: `#/components/schemas/${entityConfig.slug}` }
                }
              }
            }
          }
        }
      }
    }
  }

  // Detail endpoint
  paths[`${basePath}/{id}`] = {
    get: {
      summary: `Get ${entityConfig.names.singular}`,
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ...(entityConfig.childEntities ? [
          { name: 'children', in: 'query', schema: { type: 'string' } }
        ] : [])
      ],
      responses: {
        200: {
          description: entityConfig.names.singular,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: `#/components/schemas/${entityConfig.slug}` }
                }
              }
            }
          }
        }
      }
    },
    patch: {
      summary: `Update ${entityConfig.names.singular}`,
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: { $ref: `#/components/schemas/${entityConfig.slug}Update` }
          }
        }
      },
      responses: {
        200: {
          description: `Updated ${entityConfig.names.singular}`,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: `#/components/schemas/${entityConfig.slug}` }
                }
              }
            }
          }
        }
      }
    },
    delete: {
      summary: `Delete ${entityConfig.names.singular}`,
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
      ],
      responses: {
        200: {
          description: 'Deleted successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' }
                }
              }
            }
          }
        }
      }
    }
  }

  return {
    openapi: '3.0.0',
    info: {
      title: `${entityConfig.names.singular} API`,
      version: '1.0.0',
      description: `REST API for ${entityConfig.names.plural}`
    },
    paths,
    components: {
      schemas: {
        [entityConfig.slug]: entitySchema,
        [`${entityConfig.slug}Create`]: {
          ...entitySchema,
          required: entityConfig.fields.filter(f => f.required && !f.api.readOnly).map(f => f.name)
        },
        [`${entityConfig.slug}Update`]: {
          ...entitySchema,
          required: []
        }
      },
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key'
        }
      }
    },
    security: [{ ApiKeyAuth: [] }]
  }
}

/**
 * Convert field type to OpenAPI type
 */
function getOpenAPIType(fieldType: string): string {
  switch (fieldType) {
    case 'string':
    case 'text':
    case 'email':
    case 'url':
    case 'date':
    case 'datetime':
    case 'select':
      return 'string'
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'multiselect':
      return 'array'
    case 'json':
      return 'object'
    default:
      return 'string'
  }
}