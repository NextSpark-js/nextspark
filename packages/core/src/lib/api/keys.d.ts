/**
 * Gestión de API Keys para acceso externo
 */
export declare class ApiKeyManager {
    /**
     * Genera una nueva API key con formato seguro
     * Formato: sk_live_1234567890abcdef... (56 caracteres total)
     */
    static generateApiKey(): Promise<{
        key: string;
        hash: string;
        prefix: string;
    }>;
    /**
     * Valida el formato de una API key
     */
    static validateKeyFormat(key: string): boolean;
    /**
     * Extrae el prefix de una API key para identificación
     */
    static extractPrefix(key: string): string;
    /**
     * Genera hash SHA-256 de una API key
     */
    static hashKey(key: string): Promise<string>;
    /**
     * Valida que los scopes sean válidos
     */
    static validateScopes(scopes: string[]): {
        valid: boolean;
        invalidScopes: string[];
    };
    /**
     * Genera un nombre sugerido para la API key basado en scopes
     */
    static suggestKeyName(scopes: string[]): string;
}
/**
 * Definición de scopes disponibles para API keys
 */
export declare const API_SCOPES: {
    readonly 'users:read': "Leer información de usuarios";
    readonly 'users:write': "Crear y actualizar usuarios";
    readonly 'users:delete': "Eliminar usuarios";
    readonly 'tasks:read': "Leer tasks";
    readonly 'tasks:write': "Crear y actualizar tasks";
    readonly 'tasks:delete': "Eliminar tasks";
    readonly 'media:read': "Leer información de archivos y media";
    readonly 'media:write': "Subir y actualizar archivos";
    readonly 'media:delete': "Eliminar archivos";
    readonly 'admin:api-keys': "Gestionar API keys";
    readonly 'admin:users': "Administración completa de usuarios";
    readonly '*': "Acceso completo (solo superadmin)";
};
export type ApiScope = keyof typeof API_SCOPES;
/**
 * Categorías de scopes para organización en UI
 */
export declare const SCOPE_CATEGORIES: {
    readonly users: {
        readonly name: "Usuarios";
        readonly description: "Gestión de usuarios del sistema";
        readonly scopes: ("*" | "users:read" | "users:write" | "users:delete" | "tasks:read" | "tasks:write" | "tasks:delete" | "media:read" | "media:write" | "media:delete" | "admin:api-keys" | "admin:users")[];
    };
    readonly tasks: {
        readonly name: "Tasks";
        readonly description: "Gestión de tareas y TODOs";
        readonly scopes: ("*" | "users:read" | "users:write" | "users:delete" | "tasks:read" | "tasks:write" | "tasks:delete" | "media:read" | "media:write" | "media:delete" | "admin:api-keys" | "admin:users")[];
    };
    readonly admin: {
        readonly name: "Administración";
        readonly description: "Funciones administrativas";
        readonly scopes: ("*" | "users:read" | "users:write" | "users:delete" | "tasks:read" | "tasks:write" | "tasks:delete" | "media:read" | "media:write" | "media:delete" | "admin:api-keys" | "admin:users")[];
    };
    readonly system: {
        readonly name: "Sistema";
        readonly description: "Acceso completo al sistema";
        readonly scopes: ("*" | "users:read" | "users:write" | "users:delete" | "tasks:read" | "tasks:write" | "tasks:delete" | "media:read" | "media:write" | "media:delete" | "admin:api-keys" | "admin:users")[];
    };
};
/**
 * Configuración de límites de API keys
 */
export declare const API_KEY_LIMITS: {
    readonly maxKeysPerUser: number;
    readonly maxKeyNameLength: 100;
    readonly keyExpirationDays: 365;
};
/**
 * Configuración de rate limiting por scope
 */
export declare const RATE_LIMITS: {
    readonly default: {
        readonly requests: 1000;
        readonly windowMs: 60000;
    };
    readonly 'users:write': {
        readonly requests: 100;
        readonly windowMs: 60000;
    };
    readonly 'users:delete': {
        readonly requests: 10;
        readonly windowMs: 60000;
    };
    readonly 'tasks:write': {
        readonly requests: 500;
        readonly windowMs: 60000;
    };
    readonly 'teams:invite': {
        readonly requests: 20;
        readonly windowMs: 60000;
    };
    readonly 'teams:invite:respond': {
        readonly requests: 50;
        readonly windowMs: 60000;
    };
    readonly '*': {
        readonly requests: 5000;
        readonly windowMs: 60000;
    };
};
/**
 * Obtiene el rate limit aplicable para un conjunto de scopes
 */
export declare function getRateLimitForScopes(scopes: string[]): {
    requests: number;
    windowMs: number;
};
//# sourceMappingURL=keys.d.ts.map