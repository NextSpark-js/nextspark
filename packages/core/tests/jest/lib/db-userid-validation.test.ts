/**
 * User ID Validation Tests
 *
 * Tests for validateUserId function to ensure proper SQL injection
 * prevention in SET LOCAL commands based on environment.
 *
 * @security SEC-003 - SQL injection prevention in SET LOCAL commands
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

describe('validateUserId', () => {
  const originalEnv = process.env.NODE_ENV;

  // Import fresh module for each test to reset cached config
  const getValidateUserId = () => {
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
    return require('@/core/lib/db').validateUserId;
  };

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('Production mode (strict UUID validation)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    test('should accept valid UUID v4', () => {
      const validateUserId = getValidateUserId();

      expect(() => validateUserId('550e8400-e29b-41d4-a716-446655440000')).not.toThrow();
      expect(() => validateUserId('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).not.toThrow();
      expect(() => validateUserId('f47ac10b-58cc-4372-a567-0e02b2c3d479')).not.toThrow();
    });

    test('should accept lowercase UUID', () => {
      const validateUserId = getValidateUserId();

      expect(() => validateUserId('550e8400-e29b-41d4-a716-446655440000')).not.toThrow();
    });

    test('should accept uppercase UUID', () => {
      const validateUserId = getValidateUserId();

      expect(() => validateUserId('550E8400-E29B-41D4-A716-446655440000')).not.toThrow();
    });

    test('should accept alphanumeric IDs in production (nanoid format)', () => {
      const validateUserId = getValidateUserId();

      // Better Auth uses nanoid (alphanumeric) IDs, so these are valid in production
      expect(() => validateUserId('test-superadmin-001')).not.toThrow();
      expect(() => validateUserId('dev_user_123')).not.toThrow();
    });

    test('should reject SQL injection attempts', () => {
      const validateUserId = getValidateUserId();

      expect(() => validateUserId("'; DROP TABLE users; --")).toThrow(
        'Invalid userId format: contains dangerous characters'
      );
      expect(() => validateUserId("admin'--")).toThrow(
        'Invalid userId format: contains dangerous characters'
      );
      expect(() => validateUserId('1; DELETE FROM users')).toThrow(
        'Invalid userId format: contains dangerous characters'
      );
    });

    test('should reject values with non-alphanumeric characters', () => {
      const validateUserId = getValidateUserId();

      // Spaces and special characters should be rejected in production
      expect(() => validateUserId('user name')).toThrow(
        'Invalid userId format - must be valid UUID or alphanumeric'
      );
      expect(() => validateUserId('user@domain.com')).toThrow(
        'Invalid userId format - must be valid UUID or alphanumeric'
      );
    });
  });

  describe('Development mode (relaxed validation)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    test('should accept valid UUIDs', () => {
      const validateUserId = getValidateUserId();

      expect(() => validateUserId('550e8400-e29b-41d4-a716-446655440000')).not.toThrow();
    });

    test('should accept test IDs with hyphens', () => {
      const validateUserId = getValidateUserId();

      expect(() => validateUserId('test-superadmin-001')).not.toThrow();
      expect(() => validateUserId('test-developer-002')).not.toThrow();
      expect(() => validateUserId('test-user-basic-003')).not.toThrow();
    });

    test('should accept test IDs with underscores', () => {
      const validateUserId = getValidateUserId();

      expect(() => validateUserId('dev_user_123')).not.toThrow();
      expect(() => validateUserId('test_admin_456')).not.toThrow();
    });

    test('should accept alphanumeric IDs', () => {
      const validateUserId = getValidateUserId();

      expect(() => validateUserId('user123')).not.toThrow();
      expect(() => validateUserId('admin001')).not.toThrow();
    });

    test('should reject single quotes (SQL injection)', () => {
      const validateUserId = getValidateUserId();

      expect(() => validateUserId("test'user")).toThrow(
        'Invalid userId format: contains dangerous characters'
      );
      expect(() => validateUserId("'; DROP TABLE users; --")).toThrow(
        'Invalid userId format: contains dangerous characters'
      );
    });

    test('should reject double quotes (SQL injection)', () => {
      const validateUserId = getValidateUserId();

      expect(() => validateUserId('test"user')).toThrow(
        'Invalid userId format: contains dangerous characters'
      );
    });

    test('should reject backslashes (escape sequences)', () => {
      const validateUserId = getValidateUserId();

      expect(() => validateUserId('test\\user')).toThrow(
        'Invalid userId format: contains dangerous characters'
      );
    });

    test('should reject semicolons (SQL statement terminator)', () => {
      const validateUserId = getValidateUserId();

      expect(() => validateUserId('test;user')).toThrow(
        'Invalid userId format: contains dangerous characters'
      );
      expect(() => validateUserId('1; DELETE FROM users')).toThrow(
        'Invalid userId format: contains dangerous characters'
      );
    });

    test('should reject control characters', () => {
      const validateUserId = getValidateUserId();

      expect(() => validateUserId('test\x00user')).toThrow(
        'Invalid userId format: contains control characters'
      );
      expect(() => validateUserId('test\nuser')).toThrow(
        'Invalid userId format: contains control characters'
      );
      expect(() => validateUserId('test\tuser')).toThrow(
        'Invalid userId format: contains control characters'
      );
    });

    test('should reject excessively long values', () => {
      const validateUserId = getValidateUserId();

      const longId = 'a'.repeat(256);
      expect(() => validateUserId(longId)).toThrow('Invalid userId format: too long');
    });

    test('should accept maximum length (255 chars)', () => {
      const validateUserId = getValidateUserId();

      const maxLengthId = 'a'.repeat(255);
      expect(() => validateUserId(maxLengthId)).not.toThrow();
    });
  });

  describe('Test mode (same as development)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test';
    });

    test('should accept test IDs', () => {
      const validateUserId = getValidateUserId();

      expect(() => validateUserId('test-superadmin-001')).not.toThrow();
    });

    test('should still reject SQL injection', () => {
      const validateUserId = getValidateUserId();

      expect(() => validateUserId("'; DROP TABLE users; --")).toThrow(
        'Invalid userId format: contains dangerous characters'
      );
    });
  });

  describe('Security guarantees', () => {
    test('SQL injection characters are ALWAYS blocked in development', () => {
      process.env.NODE_ENV = 'development';
      const validateUserId = getValidateUserId();

      const sqlInjectionAttempts = [
        "'; DROP TABLE users; --",
        "admin'--",
        '1" OR "1"="1',
        'user\\x00',
        '1; DELETE FROM sessions',
        "' OR '1'='1",
        '"; DROP TABLE teams; --',
      ];

      for (const attempt of sqlInjectionAttempts) {
        expect(() => validateUserId(attempt)).toThrow();
      }
    });

    test('production NEVER accepts values with dangerous or non-alphanumeric characters', () => {
      process.env.NODE_ENV = 'production';
      const validateUserId = getValidateUserId();

      // Production rejects dangerous characters and non-alphanumeric values
      const dangerousValues = [
        'user@example.com',      // @ not allowed
        'user name',             // space not allowed
        "admin'--",              // SQL injection
        'user;drop',             // semicolon
        'path\\escape',          // backslash
      ];

      for (const value of dangerousValues) {
        expect(() => validateUserId(value)).toThrow();
      }
    });
  });

  describe('DevKeyring compatibility', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    test('should accept standard devKeyring user IDs', () => {
      const validateUserId = getValidateUserId();

      // These are the standard test user IDs used in devKeyring
      const devKeyringUserIds = [
        'test-superadmin-001',
        'test-developer-002',
        'test-user-basic-003',
        'test-team-owner-001',
        'test-team-admin-001',
        'test-team-member-001',
      ];

      for (const userId of devKeyringUserIds) {
        expect(() => validateUserId(userId)).not.toThrow();
      }
    });
  });
});
