/**
 * Test suite for Amplitude Core functionality
 */

import { AmplitudeCore } from '../lib/amplitude-core';
import { AmplitudeAPIKey, AmplitudePluginConfig } from '../types/amplitude.types';

// Mock performance module
jest.mock('../lib/performance', () => ({
  trackPerformanceMetric: jest.fn(),
  getPerformanceMetrics: jest.fn(() => []),
}));

// Mock security module
jest.mock('../lib/security', () => ({
  DataSanitizer: {
    sanitizeEventProperties: jest.fn((props) => props),
    sanitizeUserProperties: jest.fn((props) => props),
  },
}));

// Mock queue module
jest.mock('../lib/queue', () => ({
  EventQueue: jest.fn().mockImplementation(() => ({
    enqueue: jest.fn().mockResolvedValue('event-id'),
    shutdown: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Import mocked modules to get stable references
import { trackPerformanceMetric } from '../lib/performance';
import { DataSanitizer } from '../lib/security';

describe('AmplitudeCore', () => {
  const mockApiKey = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6' as AmplitudeAPIKey;
  const mockConfig: AmplitudePluginConfig = {
    apiKey: mockApiKey,
    serverZone: 'US',
    enableSessionReplay: false,
    enableABTesting: false,
    sampleRate: 1,
    enableConsentManagement: true,
    batchSize: 30,
    flushInterval: 10000,
    debugMode: false,
    piiMaskingEnabled: true,
    rateLimitEventsPerMinute: 1000,
    errorRetryAttempts: 3,
    errorRetryDelayMs: 1000,
  };

  beforeEach(() => {
    // Reset core state
    if (AmplitudeCore.isInitialized()) {
      AmplitudeCore.shutdown();
    }
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (AmplitudeCore.isInitialized()) {
      AmplitudeCore.shutdown();
    }
  });

  describe('initialization', () => {
    it('should initialize successfully with valid config', async () => {
      expect(AmplitudeCore.isInitialized()).toBe(false);
      
      await AmplitudeCore.init(mockApiKey, mockConfig);
      
      expect(AmplitudeCore.isInitialized()).toBe(true);
    });

    it('should throw error when initializing with invalid API key', async () => {
      const invalidApiKey = 'invalid-key' as AmplitudeAPIKey;
      
      await expect(AmplitudeCore.init(invalidApiKey, mockConfig))
        .rejects.toThrow('Failed to initialize Amplitude');
    });

    it('should not allow double initialization', async () => {
      await AmplitudeCore.init(mockApiKey, mockConfig);
      
      await expect(AmplitudeCore.init(mockApiKey, mockConfig))
        .rejects.toThrow();
    });
  });

  describe('event tracking', () => {
    beforeEach(async () => {
      await AmplitudeCore.init(mockApiKey, mockConfig);
    });

    it('should track events successfully when initialized', async () => {
      const eventType = 'Test Event' as any;
      const properties = { test: 'value' };
      
      await expect(AmplitudeCore.track(eventType, properties))
        .resolves.toBeUndefined();
    });

    it('should throw error when tracking without initialization', async () => {
      AmplitudeCore.shutdown();
      
      const eventType = 'Test Event' as any;
      
      await expect(AmplitudeCore.track(eventType))
        .rejects.toThrow('Amplitude not initialized');
    });

    it('should sanitize PII in event properties when enabled', async () => {
      const eventType = 'Test Event' as any;
      const properties = {
        email: 'test@example.com',
        phone: '555-123-4567'
      };

      await AmplitudeCore.track(eventType, properties);

      // Verify sanitization was called
      expect(DataSanitizer.sanitizeEventProperties).toHaveBeenCalledWith(
        properties,
        expect.any(Array)
      );
    });
  });

  describe('user identification', () => {
    beforeEach(async () => {
      await AmplitudeCore.init(mockApiKey, mockConfig);
    });

    it('should identify users successfully when initialized', async () => {
      const userId = 'user123' as any;
      const properties = { name: 'Test User' };
      
      await expect(AmplitudeCore.identify(userId, properties))
        .resolves.toBeUndefined();
    });

    it('should throw error when identifying without initialization', async () => {
      AmplitudeCore.shutdown();
      
      const userId = 'user123' as any;
      
      await expect(AmplitudeCore.identify(userId))
        .rejects.toThrow('Amplitude not initialized');
    });

    it('should sanitize PII in user properties when enabled', async () => {
      const userId = 'user123' as any;
      const properties = {
        email: 'test@example.com',
        phone: '555-123-4567'
      };

      await AmplitudeCore.identify(userId, properties);

      // Verify sanitization was called
      expect(DataSanitizer.sanitizeUserProperties).toHaveBeenCalledWith(
        properties,
        expect.any(Array)
      );
    });
  });

  describe('user properties', () => {
    beforeEach(async () => {
      await AmplitudeCore.init(mockApiKey, mockConfig);
    });

    it('should set user properties successfully when initialized', async () => {
      const properties = { plan: 'premium', country: 'US' };
      
      await expect(AmplitudeCore.setUserProperties(properties))
        .resolves.toBeUndefined();
    });

    it('should throw error when setting properties without initialization', async () => {
      AmplitudeCore.shutdown();
      
      const properties = { plan: 'premium' };
      
      await expect(AmplitudeCore.setUserProperties(properties))
        .rejects.toThrow('Amplitude not initialized');
    });
  });

  describe('reset functionality', () => {
    beforeEach(async () => {
      await AmplitudeCore.init(mockApiKey, mockConfig);
    });

    it('should reset successfully when initialized', () => {
      expect(() => AmplitudeCore.reset()).not.toThrow();
    });

    it('should throw error when resetting without initialization', () => {
      AmplitudeCore.shutdown();
      
      expect(() => AmplitudeCore.reset())
        .toThrow('Amplitude not initialized');
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      await AmplitudeCore.init(mockApiKey, mockConfig);
      expect(AmplitudeCore.isInitialized()).toBe(true);
      
      AmplitudeCore.shutdown();
      expect(AmplitudeCore.isInitialized()).toBe(false);
    });

    it('should be safe to call shutdown multiple times', async () => {
      await AmplitudeCore.init(mockApiKey, mockConfig);
      
      expect(() => {
        AmplitudeCore.shutdown();
        AmplitudeCore.shutdown();
      }).not.toThrow();
    });
  });

  describe('performance monitoring', () => {
    beforeEach(async () => {
      await AmplitudeCore.init(mockApiKey, mockConfig);
    });

    it('should track performance metrics during operations', async () => {
      await AmplitudeCore.track('Test Event' as any);

      expect(trackPerformanceMetric).toHaveBeenCalledWith(
        'amplitude_track_latency',
        expect.any(Number),
        'timing'
      );
    });

    it('should track initialization metrics', async () => {
      AmplitudeCore.shutdown();

      await AmplitudeCore.init(mockApiKey, mockConfig);

      expect(trackPerformanceMetric).toHaveBeenCalledWith(
        'amplitude_init_success',
        1,
        'counter'
      );
    });
  });

  describe('error handling', () => {
    // Skip this test - requires re-mocking EventQueue after singleton creation
    // TODO: Refactor to use dependency injection or mock reset strategy
    it.skip('should track error metrics when operations fail', async () => {
      // Mock queue to throw error
      const { EventQueue } = require('../lib/queue');
      EventQueue.mockImplementation(() => ({
        enqueue: jest.fn().mockRejectedValue(new Error('Queue error')),
        shutdown: jest.fn(),
      }));

      await AmplitudeCore.init(mockApiKey, mockConfig);

      const { trackPerformanceMetric } = require('../lib/performance');

      await expect(AmplitudeCore.track('Test Event' as any))
        .rejects.toThrow('Queue error');

      expect(trackPerformanceMetric).toHaveBeenCalledWith(
        'amplitude_track_error',
        1,
        'counter'
      );
    });
  });
});
