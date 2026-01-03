import { NextRequest } from 'next/server';
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
export declare function hasScope(auth: {
    scopes: string[];
}, requiredScope: string): boolean;
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
export declare function validateApiKey(request: NextRequest): Promise<ApiKeyAuth | null>;
/**
 * Verifica si una autenticación tiene alguno de los scopes requeridos
 */
export declare function hasAnyScope(auth: ApiKeyAuth, requiredScopes: string[]): boolean;
/**
 * Verifica si una autenticación tiene todos los scopes requeridos
 */
export declare function hasAllScopes(auth: ApiKeyAuth, requiredScopes: string[]): boolean;
/**
 * Obtiene información del usuario asociado a una API key
 */
export declare function getApiKeyUser(auth: ApiKeyAuth): Promise<{
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
}>;
/**
 * Verifica si un usuario puede crear API keys
 */
export declare function canCreateApiKeys(userId: string): Promise<boolean>;
/**
 * Valida que los scopes solicitados sean permitidos para el usuario
 */
export declare function validateScopesForUser(userId: string, requestedScopes: string[]): Promise<{
    valid: boolean;
    allowedScopes: string[];
    deniedScopes: string[];
}>;
//# sourceMappingURL=auth.d.ts.map