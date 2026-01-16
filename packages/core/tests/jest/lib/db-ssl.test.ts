/**
 * Database SSL Configuration Tests
 *
 * Tests for parseSSLConfig function to ensure proper SSL/TLS
 * validation based on environment and DATABASE_URL sslmode parameter.
 *
 * @security SEC-001 - SSL/TLS validation for database connections
 */

// Mock pg Pool to avoid database connection
jest.mock('pg', () => ({
  Pool: jest.fn(() => ({
    connect: jest.fn(),
    query: jest.fn(),
    end: jest.fn(),
    on: jest.fn(),
    options: { max: 20 },
    totalCount: 0,
    idleCount: 0,
    waitingCount: 0,
  })),
}));

// Mock the helpers module to provide isValidUUID without auth dependency
jest.mock('@/core/lib/api/helpers', () => ({
  isValidUUID: (uuid: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  },
}));

describe('parseSSLConfig', () => {
  const originalEnv = process.env.NODE_ENV;

  // Import fresh module for each test to reset cached config
  const getParseSSLConfig = () => {
    // Clear the module cache to get fresh import
    jest.resetModules();
    // Re-apply mocks after resetModules
    jest.doMock('pg', () => ({
      Pool: jest.fn(() => ({
        connect: jest.fn(),
        query: jest.fn(),
        end: jest.fn(),
        on: jest.fn(),
        options: { max: 20 },
        totalCount: 0,
        idleCount: 0,
        waitingCount: 0,
      })),
    }));
    jest.doMock('@/core/lib/api/helpers', () => ({
      isValidUUID: (uuid: string): boolean => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(uuid);
      },
    }));
    return require('@/core/lib/db').parseSSLConfig;
  };

  afterEach(() => {
    // Restore original NODE_ENV after each test
    process.env.NODE_ENV = originalEnv;
  });

  describe('Environment-based defaults (no sslmode in URL)', () => {
    test('production: should enable SSL with certificate validation', () => {
      process.env.NODE_ENV = 'production';
      const parseSSLConfig = getParseSSLConfig();

      const result = parseSSLConfig('postgresql://user:pass@host:5432/db');

      expect(result).toEqual({ rejectUnauthorized: true });
    });

    test('development: should disable SSL', () => {
      process.env.NODE_ENV = 'development';
      const parseSSLConfig = getParseSSLConfig();

      const result = parseSSLConfig('postgresql://user:pass@localhost:5432/db');

      expect(result).toBe(false);
    });

    test('test: should disable SSL', () => {
      process.env.NODE_ENV = 'test';
      const parseSSLConfig = getParseSSLConfig();

      const result = parseSSLConfig('postgresql://user:pass@localhost:5432/db');

      expect(result).toBe(false);
    });

    test('production with empty URL: should enable SSL with validation', () => {
      process.env.NODE_ENV = 'production';
      const parseSSLConfig = getParseSSLConfig();

      const result = parseSSLConfig('');

      expect(result).toEqual({ rejectUnauthorized: true });
    });

    test('development with empty URL: should disable SSL', () => {
      process.env.NODE_ENV = 'development';
      const parseSSLConfig = getParseSSLConfig();

      const result = parseSSLConfig('');

      expect(result).toBe(false);
    });
  });

  describe('Explicit sslmode parameter (takes precedence over environment)', () => {
    test('sslmode=disable: should disable SSL regardless of environment', () => {
      process.env.NODE_ENV = 'production';
      const parseSSLConfig = getParseSSLConfig();

      const result = parseSSLConfig('postgresql://user:pass@host:5432/db?sslmode=disable');

      expect(result).toBe(false);
    });

    test('sslmode=require: should use SSL without certificate validation', () => {
      process.env.NODE_ENV = 'production';
      const parseSSLConfig = getParseSSLConfig();

      const result = parseSSLConfig('postgresql://user:pass@host:5432/db?sslmode=require');

      expect(result).toEqual({ rejectUnauthorized: false });
    });

    test('sslmode=prefer: should use SSL without certificate validation', () => {
      process.env.NODE_ENV = 'production';
      const parseSSLConfig = getParseSSLConfig();

      const result = parseSSLConfig('postgresql://user:pass@host:5432/db?sslmode=prefer');

      expect(result).toEqual({ rejectUnauthorized: false });
    });

    test('sslmode=allow: should use SSL without certificate validation', () => {
      process.env.NODE_ENV = 'production';
      const parseSSLConfig = getParseSSLConfig();

      const result = parseSSLConfig('postgresql://user:pass@host:5432/db?sslmode=allow');

      expect(result).toEqual({ rejectUnauthorized: false });
    });

    test('sslmode=verify-ca: should use SSL with certificate validation', () => {
      process.env.NODE_ENV = 'development';
      const parseSSLConfig = getParseSSLConfig();

      const result = parseSSLConfig('postgresql://user:pass@host:5432/db?sslmode=verify-ca');

      expect(result).toEqual({ rejectUnauthorized: true });
    });

    test('sslmode=verify-full: should use SSL with certificate validation', () => {
      process.env.NODE_ENV = 'development';
      const parseSSLConfig = getParseSSLConfig();

      const result = parseSSLConfig('postgresql://user:pass@host:5432/db?sslmode=verify-full');

      expect(result).toEqual({ rejectUnauthorized: true });
    });
  });

  describe('URL parsing edge cases', () => {
    test('should handle URL with other query parameters', () => {
      process.env.NODE_ENV = 'production';
      const parseSSLConfig = getParseSSLConfig();

      const result = parseSSLConfig(
        'postgresql://user:pass@host:5432/db?sslmode=verify-full&schema=public'
      );

      expect(result).toEqual({ rejectUnauthorized: true });
    });

    test('should handle malformed URL with sslmode=disable in path', () => {
      process.env.NODE_ENV = 'production';
      const parseSSLConfig = getParseSSLConfig();

      // This should fall back to simple string check
      const result = parseSSLConfig('not-a-url-but-has-sslmode=disable');

      expect(result).toBe(false);
    });

    test('should handle malformed URL without sslmode in production', () => {
      process.env.NODE_ENV = 'production';
      const parseSSLConfig = getParseSSLConfig();

      // Invalid URL should fall back to production default (secure)
      const result = parseSSLConfig('not-a-valid-url');

      expect(result).toEqual({ rejectUnauthorized: true });
    });

    test('should handle malformed URL without sslmode in development', () => {
      process.env.NODE_ENV = 'development';
      const parseSSLConfig = getParseSSLConfig();

      // Invalid URL should fall back to development default (no SSL)
      const result = parseSSLConfig('not-a-valid-url');

      expect(result).toBe(false);
    });

    test('should handle case-insensitive sslmode values', () => {
      process.env.NODE_ENV = 'development';
      const parseSSLConfig = getParseSSLConfig();

      // Uppercase should be normalized to lowercase
      expect(parseSSLConfig('postgresql://h/d?sslmode=VERIFY-FULL')).toEqual({
        rejectUnauthorized: true,
      });
      expect(parseSSLConfig('postgresql://h/d?sslmode=DISABLE')).toBe(false);
      expect(parseSSLConfig('postgresql://h/d?sslmode=Require')).toEqual({
        rejectUnauthorized: false,
      });
    });

    test('should handle whitespace in sslmode values', () => {
      process.env.NODE_ENV = 'production';
      const parseSSLConfig = getParseSSLConfig();

      // Whitespace should be trimmed
      expect(parseSSLConfig('postgresql://h/d?sslmode=%20require%20')).toEqual({
        rejectUnauthorized: false,
      });
    });

    test('should handle unknown sslmode values by falling back to environment defaults', () => {
      // Unknown value in production should fall back to secure default
      process.env.NODE_ENV = 'production';
      let parseSSLConfig = getParseSSLConfig();

      expect(parseSSLConfig('postgresql://h/d?sslmode=unknown-mode')).toEqual({
        rejectUnauthorized: true,
      });

      // Unknown value in development should fall back to no SSL
      process.env.NODE_ENV = 'development';
      parseSSLConfig = getParseSSLConfig();

      expect(parseSSLConfig('postgresql://h/d?sslmode=invalid')).toBe(false);
    });
  });

  describe('Security guarantees', () => {
    test('production should NEVER default to rejectUnauthorized: false', () => {
      process.env.NODE_ENV = 'production';
      const parseSSLConfig = getParseSSLConfig();

      // Test various URLs without explicit sslmode
      const urls = [
        'postgresql://user:pass@host:5432/db',
        'postgresql://host/db',
        '',
        'invalid-url',
      ];

      for (const url of urls) {
        const result = parseSSLConfig(url);
        // In production, default should either be false (no SSL needed)
        // or have rejectUnauthorized: true (validated SSL)
        // It should NEVER be { rejectUnauthorized: false } without explicit sslmode
        if (result !== false) {
          expect(result).toEqual({ rejectUnauthorized: true });
        }
      }
    });

    test('explicit sslmode should override environment defaults', () => {
      // Even in production, sslmode=disable should work
      process.env.NODE_ENV = 'production';
      let parseSSLConfig = getParseSSLConfig();

      expect(parseSSLConfig('postgresql://h/d?sslmode=disable')).toBe(false);

      // Even in development, sslmode=verify-full should enable validation
      process.env.NODE_ENV = 'development';
      parseSSLConfig = getParseSSLConfig();

      expect(parseSSLConfig('postgresql://h/d?sslmode=verify-full')).toEqual({
        rejectUnauthorized: true,
      });
    });
  });
});
