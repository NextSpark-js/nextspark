import { NextRequest, NextResponse } from 'next/server';
import { queryWithRLS, mutateWithRLS } from '@nextsparkjs/core/lib/db';
import {
  createApiResponse,
  createApiError,
  withApiLogging,
  handleCorsPreflightRequest,
  addCorsHeaders
} from '@nextsparkjs/core/lib/api/helpers';
import { authenticateRequest, hasRequiredScope } from '@nextsparkjs/core/lib/api/auth/dual-auth';
import { ApiKeyManager, API_SCOPES, API_KEY_LIMITS } from '@nextsparkjs/core/lib/api/keys';
import { validateScopesForUser } from '@nextsparkjs/core/lib/api/auth';
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit';
import { z } from 'zod';

const createApiKeySchema = z.object({
  name: z.string().min(1, 'Name is required').max(API_KEY_LIMITS.maxKeyNameLength, 'Name too long'),
  scopes: z.array(z.string()).min(1, 'At least one scope is required'),
  expiresAt: z.string().datetime().optional()
});

// Handle CORS preflight
export async function OPTIONS() {
  return handleCorsPreflightRequest();
}

// GET /api/v1/api-keys - List user's API keys with dual auth
export const GET = withRateLimitTier(withApiLogging(async (req: NextRequest): Promise<NextResponse> => {
  try {
    // Authenticate using dual auth
    const authResult = await authenticateRequest(req);
    
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: 'Authentication required', code: 'AUTHENTICATION_FAILED' },
        { status: 401 }
      );
    }

    if (authResult.rateLimitResponse) {
      return authResult.rateLimitResponse as NextResponse;
    }

    // Check required permissions - session users have admin access, API key users need specific scope
    const hasPermission = authResult.type === 'session' || 
      (authResult.type === 'api-key' && hasRequiredScope(authResult, 'admin:api-keys'));

    if (!hasPermission) {
      const response = createApiError('Insufficient permissions. Admin access required for API key management.', 403);
      return addCorsHeaders(response);
    }

    const apiKeys = await queryWithRLS<{
      id: string;
      keyPrefix: string;
      name: string;
      scopes: string[];
      status: 'active' | 'inactive' | 'expired';
      lastUsedAt: string | null;
      expiresAt: string | null;
      createdAt: string;
      updatedAt: string;
    }>(
      `SELECT id, "keyPrefix", name, scopes, status, "lastUsedAt", "expiresAt", "createdAt", "updatedAt"
       FROM "api_key" 
       WHERE "userId" = $1 
       ORDER BY "createdAt" DESC`,
      [authResult.user!.id],
      authResult.user!.id
    );

    // Optimización: Una sola consulta para todas las estadísticas (evita N+1)
    const keyIds = apiKeys.map(key => key.id);
    let allStats: { 
      apiKeyId: string;
      total_requests: number; 
      last_24h: number;
      avg_response_time: number;
    }[] = [];
    
    // Intentar obtener estadísticas si existe la tabla api_audit_log
    if (keyIds.length > 0) {
      try {
        allStats = await queryWithRLS<{ 
          apiKeyId: string;
          total_requests: number; 
          last_24h: number;
          avg_response_time: number;
        }>(
          `SELECT 
             "apiKeyId",
             COUNT(*) as total_requests,
             COUNT(CASE WHEN "createdAt" > NOW() - INTERVAL '24 hours' THEN 1 END) as last_24h,
             AVG("responseTime") as avg_response_time
           FROM "api_audit_log" 
           WHERE "apiKeyId" = ANY($1)
           GROUP BY "apiKeyId"`,
          [keyIds],
          authResult.user!.id
        );
      } catch (error: unknown) {
        // Si la tabla api_audit_log no existe, simplemente usar estadísticas vacías
        if (error && typeof error === 'object' && 'code' in error && error.code === '42P01') {
          console.warn('api_audit_log table does not exist, returning empty stats');
          allStats = [];
        } else {
          throw error;
        }
      }
    }

    // Crear mapa de estadísticas para lookup O(1)
    const statsMap = new Map(
      allStats.map(stat => [stat.apiKeyId, stat])
    );

    // Combinar datos con estadísticas
    const keysWithStats = apiKeys.map((key) => ({
      ...key,
      usage_stats: statsMap.get(key.id) || { 
        total_requests: 0, 
        last_24h: 0, 
        avg_response_time: null 
      }
    }));

    const response = createApiResponse(keysWithStats);
    return addCorsHeaders(response);
  } catch (error) {
    console.error('Error fetching API keys:', error);
    const response = createApiError('Internal server error', 500);
    return addCorsHeaders(response);
  }
}), 'strict');

// POST /api/v1/api-keys - Create new API key with dual auth
export const POST = withRateLimitTier(withApiLogging(async (req: NextRequest): Promise<NextResponse> => {
  try {
    // Authenticate using dual auth
    const authResult = await authenticateRequest(req);
    
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: 'Authentication required', code: 'AUTHENTICATION_FAILED' },
        { status: 401 }
      );
    }

    if (authResult.rateLimitResponse) {
      return authResult.rateLimitResponse as NextResponse;
    }

    // Check required permissions - session users have admin access, API key users need specific scope
    const hasPermission = authResult.type === 'session' || 
      (authResult.type === 'api-key' && hasRequiredScope(authResult, 'admin:api-keys'));

    if (!hasPermission) {
      const response = createApiError('Insufficient permissions. Admin access required for API key management.', 403);
      return addCorsHeaders(response);
    }

    const body = await req.json();
    const validatedData = createApiKeySchema.parse(body);

    // Validar que los scopes sean válidos
    const scopeValidation = ApiKeyManager.validateScopes(validatedData.scopes);
    if (!scopeValidation.valid) {
      const response = createApiError(
        'Invalid scopes provided', 
        400, 
        { 
          invalidScopes: scopeValidation.invalidScopes,
          validScopes: Object.keys(API_SCOPES)
        },
        'INVALID_SCOPES'
      );
      return addCorsHeaders(response);
    }

    // Validar que el usuario pueda crear API keys con estos scopes
    const userScopeValidation = await validateScopesForUser(authResult.user!.id, validatedData.scopes);
    if (!userScopeValidation.valid) {
      const response = createApiError(
        'You do not have permission to create API keys with these scopes', 
        403, 
        { 
          deniedScopes: userScopeValidation.deniedScopes,
          allowedScopes: userScopeValidation.allowedScopes
        },
        'INSUFFICIENT_SCOPE_PERMISSIONS'
      );
      return addCorsHeaders(response);
    }

    // Verificar límite de API keys por usuario (máximo 10)
    const existingKeysCount = await queryWithRLS<{ count: number }>(
      'SELECT COUNT(*) as count FROM "api_key" WHERE "userId" = $1 AND status = $2',
      [authResult.user!.id, 'active'],
      authResult.user!.id
    );

    if ((existingKeysCount[0]?.count || 0) >= API_KEY_LIMITS.maxKeysPerUser) {
      const response = createApiError(
        `Maximum number of API keys reached (${API_KEY_LIMITS.maxKeysPerUser})`, 
        429, 
        null,
        'API_KEY_LIMIT_REACHED'
      );
      return addCorsHeaders(response);
    }

    // Generar API key
    const { key, hash, prefix } = await ApiKeyManager.generateApiKey();

    // Guardar en DB
    const result = await mutateWithRLS(
      `INSERT INTO "api_key" (id, "keyHash", "keyPrefix", name, "userId", scopes, "expiresAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING id, "keyPrefix", name, scopes, status, "expiresAt", "createdAt"`,
      [
        globalThis.crypto.randomUUID(),
        hash,
        prefix,
        validatedData.name,
        authResult.user!.id,
        validatedData.scopes,
        validatedData.expiresAt || null
      ],
      authResult.user!.id
    );

    // Retornar la key completa SOLO una vez
    const responseData = {
      ...(result.rows[0] as Record<string, unknown>),
      key, // Esta es la única vez que se muestra la key completa
      warning: 'Save this API key now. You will not be able to see it again.'
    };

    const response = createApiResponse(responseData, { created: true }, 201);
    return addCorsHeaders(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const response = createApiError('Validation error', 400, error.issues, 'VALIDATION_ERROR');
      return addCorsHeaders(response);
    }
    
    console.error('Error creating API key:', error);
    const response = createApiError('Internal server error', 500);
    return addCorsHeaders(response);
  }
}), 'strict');
