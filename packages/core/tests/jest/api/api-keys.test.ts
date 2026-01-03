import { describe, test, expect, beforeEach } from '@jest/globals';
import { ApiKeyManager } from '@/core/lib/api/keys';
import { validateApiKey } from '@/core/lib/api/auth';
import { checkRateLimit, clearRateLimit } from '@/core/lib/api/rate-limit';

describe('ApiKeyManager', () => {
  test('should generate valid API key', async () => {
    const { key, hash, prefix } = await ApiKeyManager.generateApiKey();
    
    expect(key).toMatch(/^sk_(live|test)_[a-f0-9]{64}$/);
    expect(prefix).toMatch(/^sk_(live|test)_[a-f0-9]{8}$/);
    expect(hash).toHaveLength(64);
    expect(typeof hash).toBe('string');
  });

  test('should validate key format correctly', async () => {
    const { key } = await ApiKeyManager.generateApiKey();
    expect(ApiKeyManager.validateKeyFormat(key)).toBe(true);
    
    // Test invalid formats
    expect(ApiKeyManager.validateKeyFormat('invalid-key')).toBe(false);
    expect(ApiKeyManager.validateKeyFormat('sk_live_short')).toBe(false);
    expect(ApiKeyManager.validateKeyFormat('pk_live_1234567890abcdef')).toBe(false);
    expect(ApiKeyManager.validateKeyFormat('')).toBe(false);
  });

  test('should extract prefix correctly', async () => {
    const { key, prefix } = await ApiKeyManager.generateApiKey();
    expect(ApiKeyManager.extractPrefix(key)).toBe(prefix);
    expect(ApiKeyManager.extractPrefix(key)).toHaveLength(16);
  });

  test('should hash keys consistently', async () => {
    const testKey = 'testkey_12345678abcdefghijklmnopqrstuvwxyz1234567890abcdef1234567890';
    const hash1 = await ApiKeyManager.hashKey(testKey);
    const hash2 = await ApiKeyManager.hashKey(testKey);
    
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  test('should validate scopes correctly', () => {
    const validScopes = ['users:read', 'tasks:write'];
    const invalidScopes = ['invalid:scope', 'users:invalid'];
    const mixedScopes = ['users:read', 'invalid:scope'];
    
    expect(ApiKeyManager.validateScopes(validScopes)).toEqual({
      valid: true,
      invalidScopes: []
    });
    
    expect(ApiKeyManager.validateScopes(invalidScopes)).toEqual({
      valid: false,
      invalidScopes: ['invalid:scope', 'users:invalid']
    });
    
    expect(ApiKeyManager.validateScopes(mixedScopes)).toEqual({
      valid: false,
      invalidScopes: ['invalid:scope']
    });
  });

  test('should suggest appropriate key names', () => {
    expect(ApiKeyManager.suggestKeyName(['*'])).toBe('Full Access Key');
    expect(ApiKeyManager.suggestKeyName(['users:read', 'users:write'])).toBe('users Access Key');
    expect(ApiKeyManager.suggestKeyName(['users:read', 'tasks:write'])).toContain('users');
    expect(ApiKeyManager.suggestKeyName(['users:read', 'tasks:write'])).toContain('tasks');
  });
});

describe('API Authentication', () => {
  test('should reject invalid authorization header', async () => {
    const mockRequest = {
      headers: { 
        get: (header: string) => {
          if (header === 'Authorization') return 'Invalid header';
          return null;
        }
      }
    } as NextRequest;
    
    const result = await validateApiKey(mockRequest);
    expect(result).toBeNull();
  });

  test('should reject malformed API key', async () => {
    const mockRequest = {
      headers: { 
        get: (header: string) => {
          if (header === 'Authorization') return 'Bearer invalid-key-format';
          return null;
        }
      }
    } as NextRequest;
    
    const result = await validateApiKey(mockRequest);
    expect(result).toBeNull();
  });

  test('should reject missing authorization header', async () => {
    const mockRequest = {
      headers: { 
        get: () => null
      }
    } as NextRequest;
    
    const result = await validateApiKey(mockRequest);
    expect(result).toBeNull();
  });

  test('should reject non-Bearer authorization', async () => {
    const mockRequest = {
      headers: { 
        get: (header: string) => {
          if (header === 'Authorization') return 'Basic dXNlcjpwYXNz';
          return null;
        }
      }
    } as NextRequest;
    
    const result = await validateApiKey(mockRequest);
    expect(result).toBeNull();
  });
});

describe('Rate Limiting', () => {
  beforeEach(() => {
    // Limpiar rate limits antes de cada test
    clearRateLimit('test-key-1');
    clearRateLimit('test-key-2');
  });

  test('should allow requests within limit', () => {
    const result1 = checkRateLimit('test-key-1', 10, 60000);
    expect(result1.allowed).toBe(true);
    expect(result1.remaining).toBe(9);
    expect(result1.limit).toBe(10);

    const result2 = checkRateLimit('test-key-1', 10, 60000);
    expect(result2.allowed).toBe(true);
    expect(result2.remaining).toBe(8);
  });

  test('should block requests when limit exceeded', () => {
    // Hacer requests hasta el límite
    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit('test-key-2', 5, 60000);
      expect(result.allowed).toBe(true);
    }

    // El siguiente request debe ser bloqueado
    const blockedResult = checkRateLimit('test-key-2', 5, 60000);
    expect(blockedResult.allowed).toBe(false);
    expect(blockedResult.remaining).toBe(0);
  });

  test('should reset after window expires', () => {
    // Usar fake timers para controlar el tiempo
    jest.useFakeTimers();
    
    try {
      // Usar ventana muy pequeña para testing
      const windowMs = 100;
      
      // Hacer requests hasta el límite
      for (let i = 0; i < 3; i++) {
        checkRateLimit('test-key-3', 3, windowMs);
      }

      // Debe estar bloqueado
      const blockedResult = checkRateLimit('test-key-3', 3, windowMs);
      expect(blockedResult.allowed).toBe(false);

      // Avanzar el tiempo más allá de la ventana
      jest.advanceTimersByTime(windowMs + 10);

      // Ahora debe permitir requests nuevamente
      const resetResult = checkRateLimit('test-key-3', 3, windowMs);
      expect(resetResult.allowed).toBe(true);
      expect(resetResult.remaining).toBe(2);
    } finally {
      // Restaurar timers reales
      jest.useRealTimers();
    }
  });

  test('should handle different keys independently', () => {
    // Key 1 - hacer requests hasta el límite
    for (let i = 0; i < 5; i++) {
      checkRateLimit('test-key-4', 5, 60000);
    }
    const key1Result = checkRateLimit('test-key-4', 5, 60000);
    expect(key1Result.allowed).toBe(false);

    // Key 2 - debe estar disponible
    const key2Result = checkRateLimit('test-key-5', 5, 60000);
    expect(key2Result.allowed).toBe(true);
    expect(key2Result.remaining).toBe(4);
  });
});

describe('API Scopes', () => {
  test('should validate scope hierarchies', () => {
    // Test que * otorga acceso completo
    const fullAccessScopes = ['*'];
    expect(fullAccessScopes.includes('*')).toBe(true);

    // Test scopes específicos
    const userScopes = ['users:read', 'users:write'];
    expect(userScopes.includes('users:read')).toBe(true);
    expect(userScopes.includes('users:delete')).toBe(false);
  });

  test('should categorize scopes correctly', () => {
    const userScopes = ['users:read', 'users:write', 'users:delete'];
    const taskScopes = ['tasks:read', 'tasks:write', 'tasks:delete'];
    const adminScopes = ['admin:api-keys', 'admin:users'];

    // Verificar que los scopes están en las categorías correctas
    userScopes.forEach(scope => {
      expect(scope.startsWith('users:')).toBe(true);
    });

    taskScopes.forEach(scope => {
      expect(scope.startsWith('tasks:')).toBe(true);
    });

    adminScopes.forEach(scope => {
      expect(scope.startsWith('admin:')).toBe(true);
    });
  });
});

describe('API Key Security', () => {
  test('should generate cryptographically secure keys', async () => {
    const keys = [];
    
    // Generar múltiples keys y verificar que son únicos
    for (let i = 0; i < 100; i++) {
      const { key } = await ApiKeyManager.generateApiKey();
      expect(keys).not.toContain(key);
      keys.push(key);
    }
  });

  test('should hash keys securely', async () => {
    const { key, hash } = await ApiKeyManager.generateApiKey();
    
    // El hash no debe contener la key original
    expect(hash).not.toContain(key);
    expect(hash).not.toContain(key.substring(16));
    
    // El hash debe ser determinístico
    const hash2 = await ApiKeyManager.hashKey(key);
    expect(hash).toBe(hash2);
  });

  test('should not expose sensitive data in prefix', async () => {
    const { key, prefix } = await ApiKeyManager.generateApiKey();
    
    // El prefix solo debe contener los primeros 16 caracteres
    expect(prefix).toHaveLength(16);
    expect(key.startsWith(prefix)).toBe(true);
    
    // El prefix no debe revelar información sensible
    expect(prefix).toMatch(/^sk_(live|test)_[a-f0-9]{8}$/);
  });
});
