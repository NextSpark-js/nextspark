/**
 * Test suite for Amplitude validation and security
 */

import { 
  isAmplitudeAPIKey, 
  isValidUserId, 
  isAmplitudeEvent,
  AmplitudeAPIKeySchema,
  UserIdSchema,
  EventTypeSchema,
  EventPropertiesSchema,
  UserPropertiesSchema
} from '../types/amplitude.types';
import { DataSanitizer, SlidingWindowRateLimiter, SecurityAuditLogger } from '../lib/security';

describe('Type Guards and Validation', () => {
  describe('isAmplitudeAPIKey', () => {
    it('should validate correct API key format', () => {
      const validKey = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';
      expect(isAmplitudeAPIKey(validKey)).toBe(true);
    });

    it('should reject invalid API key formats', () => {
      const invalidKeys = [
        'too-short',
        'this-key-is-way-too-long-to-be-valid',
        'contains-invalid-chars!@#',
        '',
        'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p', // 31 chars
        'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p67', // 33 chars
      ];

      invalidKeys.forEach(key => {
        expect(isAmplitudeAPIKey(key)).toBe(false);
      });
    });
  });

  describe('isValidUserId', () => {
    it('should validate non-empty user IDs', () => {
      const validIds = ['user123', 'test@example.com', 'uuid-1234-5678'];
      
      validIds.forEach(id => {
        expect(isValidUserId(id)).toBe(true);
      });
    });

    it('should reject empty or invalid user IDs', () => {
      const invalidIds = ['', '   ', null, undefined];
      
      invalidIds.forEach(id => {
        expect(isValidUserId(id as any)).toBe(false);
      });
    });
  });

  describe('isAmplitudeEvent', () => {
    it('should validate correct event objects', () => {
      const validEvents = [
        { eventType: 'Page Viewed' },
        { eventType: 'Button Clicked', properties: { buttonId: 'submit' } },
        { eventType: 'User Signup', properties: { plan: 'premium', source: 'organic' } },
      ];

      validEvents.forEach(event => {
        expect(isAmplitudeEvent(event)).toBe(true);
      });
    });

    it('should reject invalid event objects', () => {
      const invalidEvents = [
        {},
        { eventType: '' },
        { eventType: null },
        { eventType: undefined },
        { properties: { test: 'value' } }, // missing eventType
        null,
        undefined,
        'not an object',
      ];

      invalidEvents.forEach(event => {
        expect(isAmplitudeEvent(event)).toBe(false);
      });
    });
  });
});

describe('Zod Schema Validation', () => {
  describe('AmplitudeAPIKeySchema', () => {
    it('should validate correct API key', () => {
      const validKey = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';
      const result = AmplitudeAPIKeySchema.safeParse(validKey);
      expect(result.success).toBe(true);
    });

    it('should reject invalid API key', () => {
      const invalidKey = 'invalid-key';
      const result = AmplitudeAPIKeySchema.safeParse(invalidKey);
      expect(result.success).toBe(false);
    });
  });

  describe('UserIdSchema', () => {
    it('should validate non-empty user ID', () => {
      const validId = 'user123';
      const result = UserIdSchema.safeParse(validId);
      expect(result.success).toBe(true);
    });

    it('should reject empty user ID', () => {
      const invalidId = '';
      const result = UserIdSchema.safeParse(invalidId);
      expect(result.success).toBe(false);
    });
  });

  describe('EventTypeSchema', () => {
    it('should validate non-empty event type', () => {
      const validEventType = 'Page Viewed';
      const result = EventTypeSchema.safeParse(validEventType);
      expect(result.success).toBe(true);
    });

    it('should reject empty event type', () => {
      const invalidEventType = '';
      const result = EventTypeSchema.safeParse(invalidEventType);
      expect(result.success).toBe(false);
    });
  });

  describe('EventPropertiesSchema', () => {
    it('should validate valid event properties', () => {
      const validProperties = {
        page: '/home',
        source: 'organic',
        value: 123,
        metadata: { nested: 'object' },
      };
      const result = EventPropertiesSchema.safeParse(validProperties);
      expect(result.success).toBe(true);
    });

    it('should handle empty properties', () => {
      const emptyProperties = {};
      const result = EventPropertiesSchema.safeParse(emptyProperties);
      expect(result.success).toBe(true);
    });
  });

  describe('UserPropertiesSchema', () => {
    it('should validate valid user properties', () => {
      const validProperties = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
        preferences: { theme: 'dark' },
      };
      const result = UserPropertiesSchema.safeParse(validProperties);
      expect(result.success).toBe(true);
    });
  });
});

describe('Data Sanitization', () => {
  const piiPatterns = [
    { regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, mask: '[EMAIL]' },
    { regex: /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/, mask: '[PHONE]' },
    { regex: /\b\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}\b/, mask: '[CARD]' },
  ];

  describe('sanitizeEventProperties', () => {
    it('should sanitize PII in event properties', () => {
      const properties = {
        email: 'user@example.com',
        phone: '555-123-4567',
        cardNumber: '1234-5678-9012-3456',
        regularField: 'safe value',
      };

      const sanitized = DataSanitizer.sanitizeEventProperties(properties, piiPatterns);

      expect(sanitized).toEqual({
        email: '[EMAIL]',
        phone: '[PHONE]',
        cardNumber: '[CARD]',
        regularField: 'safe value',
      });
    });

    it('should handle nested objects', () => {
      const properties = {
        user: {
          contact: {
            email: 'user@example.com',
            phone: '555-123-4567',
          },
          name: 'John Doe',
        },
        metadata: {
          source: 'safe value',
        },
      };

      const sanitized = DataSanitizer.sanitizeEventProperties(properties, piiPatterns);

      expect(sanitized?.user?.contact?.email).toBe('[EMAIL]');
      expect(sanitized?.user?.contact?.phone).toBe('[PHONE]');
      expect(sanitized?.user?.name).toBe('John Doe');
      expect(sanitized?.metadata?.source).toBe('safe value');
    });

    it('should handle undefined properties', () => {
      const sanitized = DataSanitizer.sanitizeEventProperties(undefined, piiPatterns);
      expect(sanitized).toBeUndefined();
    });
  });

  describe('sanitizeUserProperties', () => {
    it('should sanitize PII in user properties', () => {
      const properties = {
        email: 'user@example.com',
        phoneNumber: '555-123-4567',
        name: 'John Doe',
        age: 30,
      };

      const sanitized = DataSanitizer.sanitizeUserProperties(properties, piiPatterns);

      expect(sanitized).toEqual({
        email: '[EMAIL]',
        phoneNumber: '[PHONE]',
        name: 'John Doe',
        age: 30,
      });
    });

    it('should handle undefined properties', () => {
      const sanitized = DataSanitizer.sanitizeUserProperties(undefined, piiPatterns);
      expect(sanitized).toBeUndefined();
    });
  });
});

describe('Rate Limiting', () => {
  let rateLimiter: SlidingWindowRateLimiter;

  beforeEach(() => {
    rateLimiter = new SlidingWindowRateLimiter(3, 1000); // 3 requests per second
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should allow requests within limit', () => {
    expect(rateLimiter.checkRateLimit('user1')).toBe(true);
    expect(rateLimiter.checkRateLimit('user1')).toBe(true);
    expect(rateLimiter.checkRateLimit('user1')).toBe(true);
  });

  it('should reject requests over limit', () => {
    // Use up the limit
    expect(rateLimiter.checkRateLimit('user1')).toBe(true);
    expect(rateLimiter.checkRateLimit('user1')).toBe(true);
    expect(rateLimiter.checkRateLimit('user1')).toBe(true);
    
    // This should be rejected
    expect(rateLimiter.checkRateLimit('user1')).toBe(false);
  });

  it('should reset after window expires', () => {
    // Use up the limit
    rateLimiter.checkRateLimit('user1');
    rateLimiter.checkRateLimit('user1');
    rateLimiter.checkRateLimit('user1');
    
    expect(rateLimiter.checkRateLimit('user1')).toBe(false);
    
    // Advance time past window
    jest.advanceTimersByTime(1100);
    
    // Should allow requests again
    expect(rateLimiter.checkRateLimit('user1')).toBe(true);
  });

  it('should track different users separately', () => {
    // Use up limit for user1
    rateLimiter.checkRateLimit('user1');
    rateLimiter.checkRateLimit('user1');
    rateLimiter.checkRateLimit('user1');
    
    expect(rateLimiter.checkRateLimit('user1')).toBe(false);
    
    // user2 should still have full quota
    expect(rateLimiter.checkRateLimit('user2')).toBe(true);
    expect(rateLimiter.checkRateLimit('user2')).toBe(true);
    expect(rateLimiter.checkRateLimit('user2')).toBe(true);
  });

  it('should return correct remaining requests', () => {
    expect(rateLimiter.getRemainingRequests('user1')).toBe(3);
    
    rateLimiter.checkRateLimit('user1');
    expect(rateLimiter.getRemainingRequests('user1')).toBe(2);
    
    rateLimiter.checkRateLimit('user1');
    expect(rateLimiter.getRemainingRequests('user1')).toBe(1);
    
    rateLimiter.checkRateLimit('user1');
    expect(rateLimiter.getRemainingRequests('user1')).toBe(0);
  });
});

describe('Security Audit Logger', () => {
  let auditLogger: SecurityAuditLogger;

  beforeEach(() => {
    auditLogger = new SecurityAuditLogger(7, 100); // 7 days retention, max 100 logs
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should log events with correct structure', () => {
    auditLogger.log('TEST_EVENT', { test: 'data' }, 'INFO');
    
    const logs = auditLogger.getLogs();
    expect(logs).toHaveLength(1);
    
    const log = logs[0];
    expect(log.event).toBe('TEST_EVENT');
    expect(log.data).toEqual({ test: 'data' });
    expect(log.severity).toBe('INFO');
    expect(log.source).toBe('amplitude-plugin');
    expect(log.id).toBeDefined();
    expect(log.timestamp).toBeDefined();
  });

  it('should filter logs by severity', () => {
    auditLogger.log('INFO_EVENT', {}, 'INFO');
    auditLogger.log('WARN_EVENT', {}, 'WARN');
    auditLogger.log('ERROR_EVENT', {}, 'ERROR');
    auditLogger.log('CRITICAL_EVENT', {}, 'CRITICAL');
    
    expect(auditLogger.getLogs(undefined, undefined, 'ERROR')).toHaveLength(1);
    expect(auditLogger.getLogs(undefined, undefined, 'WARN')).toHaveLength(1);
    expect(auditLogger.getLogs(undefined, undefined, 'CRITICAL')).toHaveLength(1);
  });

  it('should filter logs by time range', () => {
    const now = Date.now();
    auditLogger.log('OLD_EVENT', {}, 'INFO');
    
    // Simulate time passing
    jest.spyOn(Date, 'now').mockReturnValue(now + 1000);
    auditLogger.log('NEW_EVENT', {}, 'INFO');
    
    const recentLogs = auditLogger.getLogs(now + 500);
    expect(recentLogs).toHaveLength(1);
    expect(recentLogs[0].event).toBe('NEW_EVENT');
  });

  it('should enforce log retention limits', () => {
    // Add logs up to the limit
    for (let i = 0; i < 150; i++) {
      auditLogger.log(`EVENT_${i}`, {}, 'INFO');
    }
    
    const logs = auditLogger.getLogs();
    expect(logs.length).toBeLessThanOrEqual(100);
  });

  it('should log to console with appropriate level', () => {
    auditLogger.log('INFO_EVENT', {}, 'INFO');
    expect(console.log).toHaveBeenCalled();
    
    auditLogger.log('WARN_EVENT', {}, 'WARN');
    expect(console.warn).toHaveBeenCalled();
    
    auditLogger.log('ERROR_EVENT', {}, 'ERROR');
    expect(console.error).toHaveBeenCalled();
    
    auditLogger.log('CRITICAL_EVENT', {}, 'CRITICAL');
    expect(console.error).toHaveBeenCalled();
  });
});
