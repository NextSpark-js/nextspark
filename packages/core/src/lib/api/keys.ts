/**
 * Gestión de API Keys para acceso externo
 */
export class ApiKeyManager {
  /**
   * Genera una nueva API key con formato seguro
   * Formato: sk_live_1234567890abcdef... (56 caracteres total)
   */
  static async generateApiKey(): Promise<{ key: string; hash: string; prefix: string }> {
    // Determinar environment
    const environment = process.env.NODE_ENV === 'production' ? 'live' : 'test';
    
    // Generar 32 bytes aleatorios usando Web Crypto API
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const randomHex = Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');
    
    // Crear prefix (primeros 8 caracteres del random + environment)
    const prefix = `sk_${environment}_${randomHex.substring(0, 8)}`;
    
    // Crear key completa
    const key = `${prefix}${randomHex.substring(8)}`;
    
    // Crear hash SHA-256 para almacenamiento seguro usando Web Crypto API
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    const hash = Array.from(hashArray, byte => byte.toString(16).padStart(2, '0')).join('');
    
    return { key, hash, prefix };
  }

  /**
   * Valida el formato de una API key
   */
  static validateKeyFormat(key: string): boolean {
    // Formato: sk_(live|test)_[64 hex chars] (32 bytes = 64 hex chars)
    const pattern = /^sk_(live|test)_[a-f0-9]{64}$/;
    return pattern.test(key);
  }

  /**
   * Extrae el prefix de una API key para identificación
   */
  static extractPrefix(key: string): string {
    // Retorna los primeros 16 caracteres: sk_live_12345678
    return key.substring(0, 16);
  }

  /**
   * Genera hash SHA-256 de una API key
   */
  static async hashKey(key: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    return Array.from(hashArray, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Valida que los scopes sean válidos
   */
  static validateScopes(scopes: string[]): { valid: boolean; invalidScopes: string[] } {
    const validScopes = Object.keys(API_SCOPES);
    const invalidScopes = scopes.filter(scope => !validScopes.includes(scope));
    
    return {
      valid: invalidScopes.length === 0,
      invalidScopes
    };
  }

  /**
   * Genera un nombre sugerido para la API key basado en scopes
   */
  static suggestKeyName(scopes: string[]): string {
    if (scopes.includes('*')) {
      return 'Full Access Key';
    }
    
    const categories = new Set<string>();
    scopes.forEach(scope => {
      const [category] = scope.split(':');
      categories.add(category);
    });
    
    const categoryNames = Array.from(categories).join(', ');
    return `${categoryNames} Access Key`;
  }
}

/**
 * Definición de scopes disponibles para API keys
 */
export const API_SCOPES = {
  // Usuarios
  'users:read': 'Leer información de usuarios',
  'users:write': 'Crear y actualizar usuarios',
  'users:delete': 'Eliminar usuarios',

  // Tasks
  'tasks:read': 'Leer tasks',
  'tasks:write': 'Crear y actualizar tasks',
  'tasks:delete': 'Eliminar tasks',

  // Media (archivos, imágenes, videos)
  'media:read': 'Leer información de archivos y media',
  'media:write': 'Subir y actualizar archivos',
  'media:delete': 'Eliminar archivos',

  // Administración
  'admin:api-keys': 'Gestionar API keys',
  'admin:users': 'Administración completa de usuarios',

  // Comodín (solo para superadmins)
  '*': 'Acceso completo (solo superadmin)'
} as const;

export type ApiScope = keyof typeof API_SCOPES;

/**
 * Categorías de scopes para organización en UI
 */
export const SCOPE_CATEGORIES = {
  users: {
    name: 'Usuarios',
    description: 'Gestión de usuarios del sistema',
    scopes: ['users:read', 'users:write', 'users:delete'] as ApiScope[]
  },
  tasks: {
    name: 'Tasks',
    description: 'Gestión de tareas y TODOs',
    scopes: ['tasks:read', 'tasks:write', 'tasks:delete'] as ApiScope[]
  },
  admin: {
    name: 'Administración',
    description: 'Funciones administrativas',
    scopes: ['admin:api-keys', 'admin:users'] as ApiScope[]
  },
  system: {
    name: 'Sistema',
    description: 'Acceso completo al sistema',
    scopes: ['*'] as ApiScope[]
  }
} as const;

/**
 * Configuración de límites de API keys
 */
export const API_KEY_LIMITS = {
  maxKeysPerUser: parseInt(process.env.MAX_API_KEYS_PER_USER || '10'),
  maxKeyNameLength: 100,
  keyExpirationDays: 365
} as const;

/**
 * Configuración de rate limiting por scope
 */
export const RATE_LIMITS = {
  default: { requests: 1000, windowMs: 60000 }, // 1000 req/min
  'users:write': { requests: 100, windowMs: 60000 }, // 100 req/min para escritura
  'users:delete': { requests: 10, windowMs: 60000 }, // 10 req/min para eliminación
  'tasks:write': { requests: 500, windowMs: 60000 }, // 500 req/min para tasks
  // Team invitation limits (prevent spam and abuse)
  'teams:invite': { requests: 20, windowMs: 60000 }, // 20 req/min - crear invitaciones
  'teams:invite:respond': { requests: 50, windowMs: 60000 }, // 50 req/min - aceptar/rechazar
  '*': { requests: 5000, windowMs: 60000 } // 5000 req/min para acceso completo
} as const;

/**
 * Obtiene el rate limit aplicable para un conjunto de scopes
 */
export function getRateLimitForScopes(scopes: string[]): { requests: number; windowMs: number } {
  // Si tiene acceso completo, usar el límite más alto
  if (scopes.includes('*')) {
    return RATE_LIMITS['*'];
  }
  
  // Encontrar el límite más restrictivo entre los scopes
  let minRequests: number = RATE_LIMITS.default.requests;
  let windowMs: number = RATE_LIMITS.default.windowMs;
  
  for (const scope of scopes) {
    const limit = RATE_LIMITS[scope as keyof typeof RATE_LIMITS];
    if (limit && limit.requests < minRequests) {
      minRequests = limit.requests;
      windowMs = limit.windowMs;
    }
  }
  
  return { requests: minRequests, windowMs };
}
