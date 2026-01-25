import { NextRequest, NextResponse } from 'next/server';
import { ApiKeyAuth, validateApiKey } from './auth';
import { mutateWithRLS, queryWithRLS } from '../db';
import { checkRateLimit, addRateLimitHeaders } from './rate-limit';
import { getApplicationConfig } from '../config';
import { auth } from '../auth';
import { MetaService } from '../services/meta.service';
import { ScopeService } from '../services/scope.service';
import { getEntityConfig } from '../entities/registry';
import { getChildEntities, getEntity } from '../entities/queries';
import { CreateMetaPayload } from '../../types/meta.types';
import { getCorsOrigins } from '../utils/cors';

// Types for session-based auth
interface SessionAuth {
  userId: string;
  scopes: string[];
  flags: import('../entities/types').UserFlag[];
  isSession: true;
}

type Auth = ApiKeyAuth | SessionAuth;

/**
 * Validates authentication using session or API key
 * Prefers session auth if available, falls back to API key
 */
export async function validateAndAuthenticateRequest(request: NextRequest): Promise<{
  auth: Auth;
  rateLimitResponse?: NextResponse;
}> {
  // First try session-based authentication
  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader) {
    try {
      // Use the same auth library that's used in the main app
      const session = await auth.api.getSession({
        headers: new Headers({
          cookie: cookieHeader
        })
      });

      if (session?.user?.id) {
        // Create session auth object with appropriate scopes based on user role
        const userRole = session.user.role || 'member';
        const userFlags = ((session.user as { flags?: unknown[] }).flags || []) as import('../entities/types').UserFlag[];
        
        const sessionAuth: SessionAuth = {
          userId: session.user.id,
          scopes: generateScopesForRole(userRole, userFlags),
          flags: userFlags,
          isSession: true
        };
        
        console.log(`[Auth] Session authentication successful for user ${session.user.id} with role ${userRole}`);
        return { auth: sessionAuth };
      }
    } catch (sessionError) {
      console.log(`[Auth] Session authentication failed:`, sessionError);
      // Session auth failed, try API key
    }
  }

  // Fallback to API key authentication
  console.log(`[Auth] Falling back to API key authentication`);
  return validateAndAuthenticateApiRequest(request);
}

/**
 * Generate scopes based on user role and flags for session authentication
 *
 * Note: This replaces hardcoded scope logic with registry-based configuration.
 * Previously violated anti-hardcoding policies with static arrays and role mappings.
 */
function generateScopesForRole(role: string, flags: import('../entities/types').UserFlag[] = []): string[] {
  // Base scopes - loaded from registry-based config (zero hardcoded values)
  const baseScopes = getBaseScopesFromRegistry();

  let scopes = [...baseScopes];

  // Role-based scopes - moved from hardcoded conditions to registry lookup
  const roleScopes = getRoleScopesFromRegistry(role);
  scopes = [...scopes, ...roleScopes];

  // Flag-based scopes - moved from hardcoded mappings to registry lookup
  for (const flag of flags) {
    const flagScopes = getFlagScopesFromRegistry(flag);
    scopes = [...scopes, ...flagScopes];
  }

  // Apply restrictions - moved from hardcoded logic to registry-based rules
  scopes = applyRestrictionRulesFromRegistry(scopes, flags);

  return scopes;
}

/**
 * Get base scopes from registry system
 * Uses ScopeService for O(1) lookup
 */
function getBaseScopesFromRegistry(): string[] {
  return ScopeService.getBaseScopes()
}

/**
 * Get role-specific scopes from registry
 * Uses ScopeService for O(1) lookup
 */
function getRoleScopesFromRegistry(role: string): string[] {
  return ScopeService.getRoleScopes(role)
}

/**
 * Get flag-specific scopes from registry
 * Uses ScopeService for O(1) lookup
 */
function getFlagScopesFromRegistry(flag: string): string[] {
  return ScopeService.getFlagScopes(flag)
}

/**
 * Apply restriction rules from registry
 * Uses ScopeService for dynamic rule lookup
 */
function applyRestrictionRulesFromRegistry(scopes: string[], flags: import('../entities/types').UserFlag[]): string[] {
  let filteredScopes = [...scopes];

  for (const flag of flags) {
    const rules = ScopeService.getRestrictionRules(flag);

    if (rules.remove && rules.remove.length > 0) {
      filteredScopes = filteredScopes.filter(scope =>
        !rules.remove!.some(pattern => scope.includes(pattern))
      );
    }

    if (rules.allow_only && rules.allow_only.length > 0) {
      filteredScopes = filteredScopes.filter(scope =>
        rules.allow_only!.some(allowed => scope.includes(allowed) || scope === allowed)
      );
    }
  }

  return filteredScopes;
}

/**
 * Valida la API key y aplica rate limiting
 * Esta función debe ser llamada al inicio de cada endpoint API v1
 */
export async function validateAndAuthenticateApiRequest(request: NextRequest): Promise<{
  auth: ApiKeyAuth;
  rateLimitResponse?: NextResponse;
}> {
  // Validar API key completa (con DB)
  const auth = await validateApiKey(request);
  
  if (!auth) {
    throw new Error('Invalid API key');
  }
  
  // Aplicar rate limiting
  const rateLimitResult = checkRateLimit(auth.keyId);
  
  if (!rateLimitResult.allowed) {
    const response = NextResponse.json(
      {
        success: false,
        error: 'Rate limit exceeded',
        message: `Too many requests. Limit: ${rateLimitResult.limit} requests per minute`,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
      },
      { status: 429 }
    );
    
    addRateLimitHeaders(response, auth.keyId, auth.scopes);
    return { auth, rateLimitResponse: response };
  }
  
  return { auth };
}

/**
 * Extrae la información de autenticación API de los headers de la request
 * @deprecated Use validateAndAuthenticateApiRequest instead
 */
export function getApiAuth(request: NextRequest): ApiKeyAuth {
  const userId = request.headers.get('x-api-user-id');
  const keyId = request.headers.get('x-api-key-id');
  const scopesHeader = request.headers.get('x-api-scopes');
  
  if (!userId || !keyId || !scopesHeader) {
    throw new Error('Missing API authentication headers');
  }
  
  let scopes: string[] = [];
  try {
    const parsed = JSON.parse(scopesHeader);
    if (Array.isArray(parsed)) {
      scopes = parsed.filter((s): s is string => typeof s === 'string');
    }
  } catch {
    console.warn('[API] Invalid scopes header format');
  }

  return {
    userId,
    keyId,
    scopes
  };
}

/**
 * Verifica que la autenticación tenga el scope requerido
 * Retorna un NextResponse de error si no tiene permisos, null si está autorizado
 */
export function checkScope(auth: Auth, requiredScope: string): NextResponse | null {
  // Check scopes for both session and API key auth
  const hasRequiredScope = auth.scopes.includes(requiredScope);
  
  if (!hasRequiredScope) {
    return NextResponse.json(
      { 
        success: false,
        error: 'Insufficient permissions',
        message: `This operation requires the '${requiredScope}' scope`,
        required_scope: requiredScope,
        your_scopes: auth.scopes,
        code: 'INSUFFICIENT_PERMISSIONS'
      }, 
      { status: 403 }
    );
  }
  return null;
}

/**
 * Crea una respuesta exitosa estandarizada para la API
 */
export function createApiResponse<T>(data: T, responseMeta?: Record<string, unknown>, status: number = 200) {
  return NextResponse.json({
    success: true,
    data,
    info: {
      timestamp: new Date().toISOString(),
      ...responseMeta
    }
  }, { status });
}

/**
 * Crea una respuesta de error estandarizada para la API
 */
export function createApiError(
  message: string, 
  status: number = 400, 
  details?: unknown,
  code?: string
) {
  return NextResponse.json({
    success: false,
    error: message,
    code: code || `HTTP_${status}`,
    details,
    info: {
      timestamp: new Date().toISOString()
    }
  }, { status });
}

/**
 * Parsea y valida parámetros de paginación
 */
export function parsePaginationParams(request: NextRequest): {
  page: number;
  limit: number;
  offset: number;
} {
  const { searchParams } = new URL(request.url);
  
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10')));
  const offset = (page - 1) * limit;
  
  return { page, limit, offset };
}

/**
 * Crea metadatos de paginación para respuestas
 */
export function createPaginationMeta(
  page: number,
  limit: number,
  total: number
) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page * limit < total,
    hasPrevPage: page > 1
  };
}

/**
 * Registra el uso de la API para auditoría
 */
export async function logApiUsage(
  auth: ApiKeyAuth,
  request: NextRequest,
  statusCode: number,
  responseTime?: number,
  requestBody?: unknown
): Promise<void> {
  try {
    const endpoint = request.nextUrl.pathname;
    const method = request.method;
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent');
    
    await mutateWithRLS(
      `INSERT INTO "api_audit_log" 
       ("apiKeyId", "userId", endpoint, method, "statusCode", "ipAddress", "userAgent", "requestBody", "responseTime") 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        auth.keyId,
        auth.userId,
        endpoint,
        method,
        statusCode,
        ipAddress,
        userAgent,
        requestBody ? JSON.stringify(requestBody) : null,
        responseTime || null
      ],
      auth.userId
    );
  } catch (error) {
    // No lanzar error para no interrumpir la respuesta
    console.error('Failed to log API usage:', error);
  }
}

/**
 * Wrapper para endpoints que agrega logging automático
 */
export function withApiLogging<T extends unknown[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const startTime = Date.now();
    let auth: ApiKeyAuth | null = null;
    let requestBody: unknown = null;
    
    try {
      // Intentar obtener auth (puede fallar si no está autenticado)
      try {
        auth = getApiAuth(request);
      } catch {
        // Ignorar si no hay auth (será manejado por el handler)
      }
      
      // Intentar capturar body para logging (solo para POST/PUT/PATCH)
      if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
        try {
          const clonedRequest = request.clone();
          requestBody = await clonedRequest.json();
        } catch {
          // Ignorar si no se puede parsear el body
        }
      }
      
      const response = await handler(request, ...args);
      const responseTime = Date.now() - startTime;
      
      // Log async si tenemos auth
      if (auth) {
        logApiUsage(auth, request, response.status, responseTime, requestBody)
          .catch(console.error);
      }
      
      return response;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      // Log error si tenemos auth
      if (auth) {
        logApiUsage(auth, request, 500, responseTime, requestBody)
          .catch(console.error);
      }
      
      throw error;
    }
  };
}

/**
 * Valida que un UUID tenga formato válido
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Sanitiza parámetros de búsqueda para prevenir inyección SQL
 */
export function sanitizeSearchQuery(query: string): string {
  if (!query || typeof query !== 'string') {
    return '';
  }
  
  // Remover caracteres peligrosos y limitar longitud
  return query
    .replace(/[<>'"%;()&+]/g, '')
    .trim()
    .substring(0, 100);
}

/**
 * Parsea filtros de query parameters
 *
 * Note: Replaces hardcoded allowedFilters array with registry-based configuration.
 * Previously violated anti-hardcoding policies with static filter list.
 */
export function parseFilters(request: NextRequest): Record<string, string> {
  const { searchParams } = new URL(request.url);
  const filters: Record<string, string> = {};

  // Get allowed filters from registry instead of hardcoded array
  const allowedFilters = getAllowedFiltersFromRegistry();

  for (const filter of allowedFilters) {
    const value = searchParams.get(filter);
    if (value) {
      filters[filter] = sanitizeSearchQuery(value);
    }
  }

  return filters;
}

/**
 * Get allowed API filters from registry
 * Uses ScopeService for O(1) lookup
 */
function getAllowedFiltersFromRegistry(): string[] {
  return ScopeService.getAllowedFilters()
}

/**
 * Agrega headers de CORS para API externa
 * Uses unified getCorsOrigins() for single source of truth
 */
export async function addCorsHeaders(response: NextResponse, request?: NextRequest): Promise<NextResponse> {
  const env = process.env.NODE_ENV || 'development';
  const config = await getApplicationConfig();
  const corsConfig = config.api.cors;

  // Determinar el origen permitido
  let allowedOrigin = 'null';

  if (request) {
    const origin = request.headers.get('origin');

    if (origin) {
      // En desarrollo, permitir todos los orígenes si está configurado
      if (env === 'development' && corsConfig.allowAllOrigins.development) {
        allowedOrigin = origin;
      }
      // En producción o desarrollo con restricciones, verificar lista permitida
      else {
        // Use unified origin list from getCorsOrigins()
        const allowedOrigins = getCorsOrigins(config, env);
        if (allowedOrigins.includes(origin)) {
          allowedOrigin = origin;
        }
      }
    }
  } else if (env === 'development' && corsConfig.allowAllOrigins.development) {
    // In development with allowAllOrigins but no request, use the first allowed origin
    // This handles cases where generic handlers don't pass the request
    const allowedOrigins = getCorsOrigins(config, env);
    allowedOrigin = allowedOrigins[0] || 'http://localhost:3000';
  }

  response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, x-team-id, x-builder-source');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Max-Age', '86400');

  return response;
}

/**
 * Maneja requests OPTIONS para CORS preflight
 */
export async function handleCorsPreflightRequest(request?: NextRequest): Promise<NextResponse> {
  const response = new NextResponse(null, { status: 200 });
  return await addCorsHeaders(response, request);
}

/**
 * Wraps an auth handler response with CORS headers
 *
 * Better Auth handles OPTIONS preflight but doesn't add CORS headers to actual responses.
 * This utility wraps responses to add proper CORS headers for cross-origin requests.
 *
 * @param handler - The original handler function (GET, POST, etc.)
 * @param request - The incoming request
 * @returns Response with CORS headers added
 *
 * @example
 * ```ts
 * // In your auth route:
 * import { wrapAuthHandlerWithCors } from '@nextsparkjs/core/lib/api/helpers'
 *
 * export async function POST(req: NextRequest) {
 *   return wrapAuthHandlerWithCors(() => handlers.POST(req), req)
 * }
 * ```
 */
export async function wrapAuthHandlerWithCors(
  handler: () => Promise<Response>,
  request: NextRequest
): Promise<Response> {
  const response = await handler()

  // Clone the response to make headers mutable
  const newResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: new Headers(response.headers),
  })

  // Add CORS headers
  const env = process.env.NODE_ENV || 'development'
  const config = await getApplicationConfig()
  const corsConfig = config.api.cors
  const origin = request.headers.get('origin')

  if (origin) {
    let allowedOrigin = 'null'

    // In development with allowAllOrigins, allow any origin
    if (env === 'development' && corsConfig.allowAllOrigins.development) {
      allowedOrigin = origin
    } else {
      // Check against allowed origins list
      const allowedOrigins = getCorsOrigins(config, env)
      if (allowedOrigins.includes(origin)) {
        allowedOrigin = origin
      }
    }

    newResponse.headers.set('Access-Control-Allow-Origin', allowedOrigin)
    newResponse.headers.set('Access-Control-Allow-Credentials', 'true')
  }

  return newResponse
}

/**
 * Parsea los parámetros de metadata de una request
 * Soporta: metas=all, metas=key1,key2,key3, o sin parámetro
 */
export interface MetaParams {
  includeMetadata: boolean;
  specificKeys?: string[];
  includeAll: boolean;
}

export function parseMetaParams(request: NextRequest): MetaParams {
  const url = new URL(request.url);
  const metasParam = url.searchParams.get('metas');
  
  if (!metasParam) {
    return {
      includeMetadata: false,
      includeAll: false
    };
  }
  
  if (metasParam === 'all') {
    return {
      includeMetadata: true,
      includeAll: true
    };
  }
  
  // Parse specific keys: metas=key1,key2,key3
  const specificKeys = metasParam.split(',').map(key => key.trim()).filter(key => key.length > 0);
  
  return {
    includeMetadata: true,
    includeAll: false,
    specificKeys
  };
}

/**
 * Child entity parameters for request parsing
 */
export interface ChildParams {
  includeChildren: boolean;
  includeAll: boolean;
  specificChildren?: string[];
}

/**
 * Parse child entities parameters from request URL
 * Supports: child=all, child=audiences, child=audiences,products
 */
export function parseChildParams(request: NextRequest): ChildParams {
  const url = new URL(request.url);
  const childParam = url.searchParams.get('child');

  if (!childParam) {
    return {
      includeChildren: false,
      includeAll: false
    };
  }

  if (childParam === 'all') {
    return {
      includeChildren: true,
      includeAll: true
    };
  }

  // Parse specific child entities: child=audiences,products
  const specificChildren = childParam.split(',').map(child => child.trim()).filter(child => child.length > 0);

  return {
    includeChildren: true,
    includeAll: false,
    specificChildren
  };
}

/**
 * Helper para incluir metadata en entidades según parámetros de request
 * Uso: await includeEntityMetadata('user', users, metaParams, userId)
 */
export async function includeEntityMetadata<T extends { id: string }>(
  entityType: string,
  entities: T[],
  metaParams: MetaParams,
  userId: string
): Promise<(T & { metas?: Record<string, unknown> })[]> {
  if (!metaParams.includeMetadata || entities.length === 0) {
    return entities;
  }

  try {
    const entityIds = entities.map(entity => entity.id);
    
    let bulkMetadata: Record<string, Record<string, unknown>>;
    
    if (metaParams.includeAll) {
      // Incluir todos los metadatos
      bulkMetadata = await MetaService.getBulkEntityMetas(entityType, entityIds, userId, true);
    } else if (metaParams.specificKeys && metaParams.specificKeys.length > 0) {
      // Incluir solo metadatos específicos
      bulkMetadata = await MetaService.getBulkSpecificEntityMetas(entityType, entityIds, metaParams.specificKeys, userId);
    } else {
      bulkMetadata = {};
    }
    
    return entities.map(entity => ({
      ...entity,
      metas: bulkMetadata[entity.id] || {}
    }));
  } catch (error) {
    console.error(`Error fetching bulk ${entityType} metadata:`, error);
    // En caso de error, devolver entidades sin metadata
    return entities;
  }
}

/**
 * Helper para incluir child entities en entidades según parámetros de request
 * Uso: await includeEntityChildren('client', clients, childParams, userId, entityConfig)
 */
export async function includeEntityChildren<T extends { id: string }>(
  entityName: string,
  entities: T[],
  childParams: ChildParams,
  userId: string,
  entityConfig?: unknown
): Promise<(T & { child?: Record<string, unknown[]> })[]> {
  if (!childParams.includeChildren || entities.length === 0) {
    return entities;
  }

  try {
    // Use new registry system to get child entities
    const childEntities = getChildEntities(entityName as any);

    if (!childEntities || childEntities.length === 0) {
      return entities;
    }

    const entityIds = entities.map(entity => entity.id);

    // Determine which child entities to load
    let childTypesToLoad: string[];
    if (childParams.includeAll) {
      childTypesToLoad = childEntities.map(child => child.name);
    } else if (childParams.specificChildren) {
      childTypesToLoad = childParams.specificChildren.filter(childType =>
        childEntities.some(child => child.name === childType)
      );
    } else {
      childTypesToLoad = [];
    }

    // Load child entities for all parent entities
    const childData: Record<string, Record<string, unknown[]>> = {};

    for (const entityId of entityIds) {
      childData[entityId] = {};

      for (const childType of childTypesToLoad) {
        const childEntity = childEntities.find(child => child.name === childType);
        if (!childEntity) continue;

        const parentIdColumn = 'parentId'; // Use consistent foreign key naming
        const query = `
          SELECT * FROM "${childEntity.tableName}"
          WHERE "${parentIdColumn}" = $1
          ORDER BY "createdAt" DESC
        `;

        try {
          const childRows = await queryWithRLS(query, [entityId], userId);
          childData[entityId][childType] = childRows || [];
        } catch (error) {
          console.error(`Error loading ${childType} for ${entityName} ${entityId}:`, error);
          childData[entityId][childType] = [];
        }
      }
    }

    return entities.map(entity => ({
      ...entity,
      child: childData[entity.id] || {}
    }));

  } catch (error) {
    console.error(`Error fetching child entities for ${entityName}:`, error);
    // En caso de error, devolver entidades sin child entities
    return entities;
  }
}

/**
 * Helper para incluir metadata en una entidad individual según parámetros de request
 * Uso: await includeEntityMetadataForSingle('user', user, metaParams, userId)
 */
export async function includeEntityMetadataForSingle<T extends { id: string }>(
  entityType: string,
  entity: T,
  metaParams: MetaParams,
  userId: string
): Promise<T & { metas?: Record<string, unknown> }> {
  if (!metaParams.includeMetadata) {
    return entity;
  }

  try {
    let metadata: Record<string, unknown>;
    
    if (metaParams.includeAll) {
      // Incluir todos los metadatos
      metadata = await MetaService.getEntityMetas(entityType, entity.id, userId, true);
    } else if (metaParams.specificKeys && metaParams.specificKeys.length > 0) {
      // Incluir solo metadatos específicos
      metadata = await MetaService.getSpecificEntityMetas(entityType, entity.id, metaParams.specificKeys, userId);
    } else {
      metadata = {};
    }
    
    return {
      ...entity,
      metas: metadata
    };
  } catch (error) {
    console.error(`Error fetching ${entityType} metadata:`, error);
    // En caso de error, devolver entidad sin metadata
    return entity;
  }
}

/**
 * Helper para manejar metadata en CREATE/UPDATE: responder con metadata solo si se envió en el payload
 * Uso: await handleEntityMetadataInResponse('user', entity, metaWasProvided, userId)
 */
export async function handleEntityMetadataInResponse<T extends { id: string }>(
  entityType: string,
  entity: T,
  metaWasProvided: boolean,
  userId: string
): Promise<T & { metas?: Record<string, unknown> }> {
  if (!metaWasProvided) {
    return entity;
  }

  try {
    const allEntityMetadata = await MetaService.getEntityMetas(entityType, entity.id, userId, true);
    
    return {
      ...entity,
      metas: allEntityMetadata
    };
  } catch (error) {
    console.error(`Error fetching ${entityType} metadata for response:`, error);
    // Si falla obtener metadata, responder solo con entity data
    return entity;
  }
}

/**
 * Detect the appropriate dataType for a meta value
 * Used to properly serialize metadata with correct types
 */
function detectMetaDataType(value: unknown): 'string' | 'number' | 'boolean' | 'json' {
  if (typeof value === 'number' || (typeof value === 'string' && !isNaN(Number(value)) && value.trim() !== '')) {
    return 'number';
  }
  if (typeof value === 'boolean') {
    return 'boolean';
  }
  if (typeof value === 'string') {
    return 'string';
  }
  // Arrays, objects, etc.
  return 'json';
}

/**
 * Helper para procesar metadata en CREATE/UPDATE
 * Uso: await processEntityMetadata('user', entityId, meta, userId)
 *
 * NOTE: Metas tables do NOT have teamId - security is inherited from parent entity via RLS.
 */
export async function processEntityMetadata(
  entityType: string,
  entityId: string,
  meta: unknown,
  userId: string
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];
  let success = true;

  if (meta && typeof meta === 'object' && Object.keys(meta).length > 0) {
    try {
      // Obtener metadatos existentes para hacer merge
      const existingMetadata = await MetaService.getEntityMetas(entityType, entityId, userId, true);

      // Procesar cada metadata por separado con merge inteligente
      for (const [metaKey, metaValue] of Object.entries(meta)) {
        if (metaValue !== null && metaValue !== undefined) {
          try {
            // Obtener valor existente
            const existingValue = existingMetadata[metaKey];
            let finalValue: unknown;

            // Merge inteligente: solo mergear objetos, reemplazar otros tipos
            if (metaValue && typeof metaValue === 'object' && !Array.isArray(metaValue) &&
                existingValue && typeof existingValue === 'object' && !Array.isArray(existingValue)) {
              // Ambos son objetos: hacer merge profundo de 1 nivel
              finalValue = {
                ...(existingValue as Record<string, unknown>),
                ...(metaValue as Record<string, unknown>)
              };
            } else {
              // Otros tipos (string, number, array, etc.): reemplazar directamente
              finalValue = metaValue;
            }

            // Detect appropriate dataType and convert value to proper type
            const detectedType = detectMetaDataType(finalValue);

            // Convert value to proper type for storage
            let typedValue: unknown = finalValue;
            if (detectedType === 'number' && typeof finalValue === 'string') {
              typedValue = Number(finalValue);
            } else if (detectedType === 'boolean' && typeof finalValue === 'string') {
              typedValue = finalValue === 'true';
            }

            const metaOptions: Partial<CreateMetaPayload> = {
              isPublic: true, // Default to public for API-set metas
              isSearchable: false,
              dataType: detectedType
            };

            await MetaService.setEntityMeta(entityType, entityId, metaKey, typedValue, userId, metaOptions);
          } catch (individualMetaError) {
            console.error(`Error setting ${entityType} metadata for key '${metaKey}':`, individualMetaError);
            errors.push(`Failed to set metadata for key '${metaKey}'`);
            success = false;
          }
        }
      }
    } catch (metaError) {
      console.error(`Error processing ${entityType} metadata:`, metaError);
      errors.push('General metadata processing error');
      success = false;
    }
  }

  return { success, errors };
}
