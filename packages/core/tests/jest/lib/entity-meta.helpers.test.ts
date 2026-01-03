import { validateBasicMetas } from '@/core/lib/helpers/entity-meta.helpers';

// Mock MetaService - keep it simple
jest.mock('@/core/lib/services/meta.service', () => ({
  MetaService: {
    getEntityMetas: jest.fn(),
    setBulkEntityMetas: jest.fn()
  }
}));

// Import functions after mock is set up
const { withMeta, copyEntityMetas } = require('@/core/lib/helpers/entity-meta.helpers');

describe('Entity Meta Helpers - Simplified Tests', () => {
  let MetaService: any;

  beforeEach(() => {
    jest.clearAllMocks();
    MetaService = require('@/core/lib/services/meta.service').MetaService;
  });

  describe('withMeta', () => {
    test('should add meta to single entity', async () => {
      const mockMeta = { setting1: 'value1' };
      
      MetaService.getEntityMetas.mockResolvedValue(mockMeta);

      const entity = { id: 'test-id', name: 'Test Entity' };
      const result = await withMeta(entity, 'user', 'user-123');

      expect(result).toEqual({
        id: 'test-id',
        name: 'Test Entity',
        meta: mockMeta
      });
    });
  });

  describe('validateBasicMetas', () => {
    test('should validate basic metadata constraints', () => {
      const validMetas = {
        setting1: 'value1',
        setting2: { nested: 'value' }
      };

      const result = validateBasicMetas(validMetas);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject empty keys', () => {
      const invalidMetas = {
        '': 'value',
        '   ': 'value2'
      };

      const result = validateBasicMetas(invalidMetas);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Meta key cannot be empty');
    });

    test('should reject keys that are too long', () => {
      const longKey = 'a'.repeat(101);
      const invalidMetas = {
        [longKey]: 'value'
      };

      const result = validateBasicMetas(invalidMetas);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('too long'))).toBe(true);
    });
  });

  describe('copyEntityMetas', () => {
    test('should be defined and callable', () => {
      expect(copyEntityMetas).toBeDefined();
      expect(typeof copyEntityMetas).toBe('function');
    });
  });
});