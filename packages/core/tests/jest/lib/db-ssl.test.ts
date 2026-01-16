/**
 * Database SSL Configuration Tests
 *
 * Tests for parseSSLConfig function to ensure proper SSL/TLS
 * validation based on environment and DATABASE_URL sslmode parameter.
 *
 * @security SEC-001 - SSL/TLS validation for database connections
 */

describe('parseSSLConfig', () => {
  const originalEnv = process.env.NODE_ENV;

  // Import fresh module for each test to reset cached config
  const getParseSSLConfig = () => {
    // Clear the module cache to get fresh import
    jest.resetModules();
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
