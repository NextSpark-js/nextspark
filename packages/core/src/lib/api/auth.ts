import { NextRequest } from 'next/server';
import { queryOne } from '../db';
import { ApiKeyManager } from './keys';
import { apiKeyCache, getCacheKey } from './cache';
import { TeamMemberService } from '../services/team-member.service';
import { ScopeService } from '../services/scope.service';

/**
 * Información de autenticación de API Key
 */
export interface ApiKeyAuth {
  userId: string;
  keyId: string;
  scopes: string[];
}

/**
 * Check if auth object has a specific scope
 */
export function hasScope(auth: { scopes: string[] }, requiredScope: string): boolean {
  return auth.scopes.includes(requiredScope);
}

/**
 * Resultado de validación de API Key
 */
export interface ApiKeyValidationResult {
  success: boolean;
  auth?: ApiKeyAuth;
  error?: string;
}

/**
 * Valida una API Key desde el header Authorization o x-api-key
 */
export async function validateApiKey(request: NextRequest): Promise<ApiKeyAuth | null> {
  const startTime = Date.now();

  try {
    const authHeader = request.headers.get('Authorization');
    const xApiKeyHeader = request.headers.get('x-api-key');

    let apiKey: string | null = null;

    // Check Authorization header first
    if (authHeader?.startsWith('Bearer ')) {
      apiKey = authHeader.substring(7);
    }
    // Then check x-api-key header
    else if (xApiKeyHeader) {
      apiKey = xApiKeyHeader;
    }

    if (!apiKey) {
      // Añadir delay constante para prevenir timing attacks
      await constantTimeDelay(startTime);
      return null;
    }
    
    // Validar formato básico
    if (!ApiKeyManager.validateKeyFormat(apiKey)) {
      await constantTimeDelay(startTime);
      return null;
    }
    
    // Extraer prefix y generar hash
    const prefix = ApiKeyManager.extractPrefix(apiKey);
    const keyHash = await ApiKeyManager.hashKey(apiKey);
    
    // Buscar en cache primero
    const cacheKey = getCacheKey('api_key', keyHash);
    let keyData = apiKeyCache.get(cacheKey);
    
    if (!keyData) {
      // Si no está en cache, buscar en base de datos
      const dbResult = await queryOne<{
        id: string;
        userId: string;
        scopes: string[];
        status: 'active' | 'inactive' | 'expired';
        expiresAt: string | null;
        failedAttempts: number | null;
        lockedUntil: string | null;
      }>(
        `SELECT id, "userId", scopes, status, "expiresAt", "failedAttempts", "lockedUntil"
         FROM "api_key" 
         WHERE "keyHash" = $1 AND "keyPrefix" = $2`,
        [keyHash, prefix]
      );
      
      if (dbResult) {
        keyData = {
          id: dbResult.id,
          userId: dbResult.userId,
          scopes: dbResult.scopes,
          status: dbResult.status,
          expiresAt: dbResult.expiresAt,
          failedAttempts: dbResult.failedAttempts,
          lockedUntil: dbResult.lockedUntil
        };
        
        // Cachear por 5 minutos
        apiKeyCache.set(cacheKey, keyData, 300000);
      }
    }
    
    if (!keyData) {
      await constantTimeDelay(startTime);
      return null;
    }
    
    // Verificar bloqueo por intentos fallidos
    if (keyData.lockedUntil && new Date(keyData.lockedUntil) > new Date()) {
      await constantTimeDelay(startTime);
      return null;
    }
    
    // Verificar que esté activa
    if (keyData.status !== 'active') {
      await constantTimeDelay(startTime);
      return null;
    }
    
    // Verificar expiración y actualizar status si es necesario
    if (keyData.expiresAt && new Date(keyData.expiresAt) < new Date()) {
      // Marcar como expirada de forma asíncrona
      markAsExpired(keyData.id).catch(console.error);
      await constantTimeDelay(startTime);
      return null;
    }
    
    // Resetear intentos fallidos en caso de éxito
    if (keyData.failedAttempts && keyData.failedAttempts > 0) {
      resetFailedAttempts(keyData.id).catch(console.error);
    }
    
    // Actualizar lastUsedAt de forma asíncrona (no bloquear)
    updateLastUsed(keyData.id).catch(error => {
      console.error('Error updating API key last used:', error);
    });
    
    return {
      userId: keyData.userId,
      keyId: keyData.id,
      scopes: keyData.scopes || []
    };
  } catch (error) {
    console.error('Error validating API key:', error);
    await constantTimeDelay(startTime);
    return null;
  }
}

/**
 * Añade un delay constante para prevenir timing attacks
 */
async function constantTimeDelay(startTime: number): Promise<void> {
  const minDelay = 100; // 100ms mínimo
  const elapsed = Date.now() - startTime;
  const remaining = Math.max(0, minDelay - elapsed);
  
  if (remaining > 0) {
    await new Promise(resolve => setTimeout(resolve, remaining));
  }
}

/**
 * Resetea los intentos fallidos de una API key
 */
async function resetFailedAttempts(keyId: string): Promise<void> {
  try {
    await queryOne(
      'UPDATE "api_key" SET "failedAttempts" = 0, "lockedUntil" = NULL WHERE id = $1',
      [keyId]
    );
  } catch (error) {
    console.error('Failed to reset failed attempts:', error);
  }
}

/**
 * Marca una API key como expirada
 */
async function markAsExpired(keyId: string): Promise<void> {
  try {
    await queryOne(
      'UPDATE "api_key" SET status = $1 WHERE id = $2',
      ['expired', keyId]
    );
    
    // Invalidar cache
    const cacheKey = getCacheKey('api_key', keyId);
    apiKeyCache.delete(cacheKey);
  } catch (error) {
    console.error('Failed to mark API key as expired:', error);
  }
}

// Duplicate hasScope function removed - using the one defined above

/**
 * Verifica si una autenticación tiene alguno de los scopes requeridos
 */
export function hasAnyScope(auth: ApiKeyAuth, requiredScopes: string[]): boolean {
  if (auth.scopes.includes('*')) {
    return true;
  }
  
  return requiredScopes.some(scope => auth.scopes.includes(scope));
}

/**
 * Verifica si una autenticación tiene todos los scopes requeridos
 */
export function hasAllScopes(auth: ApiKeyAuth, requiredScopes: string[]): boolean {
  if (auth.scopes.includes('*')) {
    return true;
  }
  
  return requiredScopes.every(scope => auth.scopes.includes(scope));
}

/**
 * Actualiza el timestamp de último uso de una API key
 */
async function updateLastUsed(keyId: string): Promise<void> {
  try {
    await queryOne(
      'UPDATE "api_key" SET "lastUsedAt" = CURRENT_TIMESTAMP WHERE id = $1',
      [keyId]
    );
  } catch (error) {
    // No lanzar error, solo logear
    console.error('Failed to update API key last used timestamp:', error);
  }
}

/**
 * Obtiene información del usuario asociado a una API key
 */
export async function getApiKeyUser(auth: ApiKeyAuth) {
  try {
    const user = await queryOne<{
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      role: string;
    }>(
      'SELECT id, email, "firstName", "lastName", role FROM "users" WHERE id = $1',
      [auth.userId]
    );
    
    return user;
  } catch (error) {
    console.error('Error fetching API key user:', error);
    return null;
  }
}

/**
 * Verifica si un usuario puede crear API keys.
 *
 * Superadmin is a GLOBAL role (`users.role`) and is always allowed. Any
 * other user is allowed only if they hold a team role that itself grants
 * `admin:api-keys`/`admin:users`-equivalent scopes for at least one team —
 * i.e. the same source of truth `validateScopesForUser` uses, checked
 * without a specific team in mind (any qualifying membership is enough).
 */
export async function canCreateApiKeys(userId: string): Promise<boolean> {
  try {
    const user = await queryOne<{ role: string }>(
      'SELECT role FROM "users" WHERE id = $1',
      [userId]
    );

    if (!user) {
      return false;
    }

    if (user.role === 'superadmin') {
      return true;
    }

    const memberships = await TeamMemberService.listByUser(userId);
    return memberships.some(({ role }) => {
      const scopes = ScopeService.getRoleScopes(role);
      return scopes.includes('*') || scopes.includes('admin:api-keys');
    });
  } catch (error) {
    console.error('Error checking API key creation permissions:', error);
    return false;
  }
}

/**
 * Valida que los scopes solicitados sean permitidos para el usuario, en el
 * contexto de un team específico.
 *
 * Superadmin is a GLOBAL role (`users.role`) — it never appears in
 * `AVAILABLE_ROLES` (team roles), so it's special-cased here rather than
 * inside the scope registry. Every other user is resolved through their
 * TEAM role for `teamId` (not their global `users.role` — NextSpark's
 * entity authorization model is team-scoped, see `app.config.ts`), and the
 * allowed-scope set comes from the same registry-backed
 * `ScopeService.getRoleScopes()` that session auth's implicit scopes
 * (`generateScopesForRole` in `helpers.ts`) and `checkPermission()` both
 * ultimately derive from — so minting and enforcement can't diverge again.
 */
export async function validateScopesForUser(
  userId: string,
  teamId: string | null,
  requestedScopes: string[]
): Promise<{
  valid: boolean;
  allowedScopes: string[];
  deniedScopes: string[];
}> {
  try {
    const user = await queryOne<{ role: string }>(
      'SELECT role FROM "users" WHERE id = $1',
      [userId]
    );

    if (!user) {
      return {
        valid: false,
        allowedScopes: [],
        deniedScopes: requestedScopes
      };
    }

    if (user.role === 'superadmin') {
      return {
        valid: true,
        allowedScopes: requestedScopes,
        deniedScopes: []
      };
    }

    if (!teamId) {
      // Non-superadmin with no resolvable team context cannot mint any
      // team-scoped API key — there is no role to check scopes against.
      return {
        valid: false,
        allowedScopes: [],
        deniedScopes: requestedScopes
      };
    }

    const teamRole = await TeamMemberService.getRole(teamId, userId);
    if (!teamRole) {
      return {
        valid: false,
        allowedScopes: [],
        deniedScopes: requestedScopes
      };
    }

    const allowedScopes = [
      ...ScopeService.getBaseScopes(),
      ...ScopeService.getRoleScopes(teamRole)
    ];

    // Si tiene acceso completo, permitir todo
    if (allowedScopes.includes('*')) {
      return {
        valid: true,
        allowedScopes: requestedScopes,
        deniedScopes: []
      };
    }

    // Filtrar scopes permitidos y denegados
    const validScopes = requestedScopes.filter(scope => allowedScopes.includes(scope));
    const deniedScopes = requestedScopes.filter(scope => !allowedScopes.includes(scope));

    return {
      valid: deniedScopes.length === 0,
      allowedScopes: validScopes,
      deniedScopes
    };
  } catch (error) {
    console.error('Error validating scopes for user:', error);
    return {
      valid: false,
      allowedScopes: [],
      deniedScopes: requestedScopes
    };
  }
}
