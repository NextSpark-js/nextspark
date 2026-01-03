// Mock del módulo de DB
const mockQueryWithRLS = jest.fn();
const mockMutateWithRLS = jest.fn();

jest.mock('@/core/lib/db', () => ({
  queryWithRLS: mockQueryWithRLS,
  mutateWithRLS: mockMutateWithRLS
}));

// Import after mock is set up
const { MetaService } = require('@/core/lib/services/meta.service');

describe('MetaService - Simplified Tests', () => {
  const mockUserId = 'test-user-123';
  const mockEntityId = 'entity-456';
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Core functionality', () => {
    test('should have core methods', () => {
      expect(MetaService).toBeDefined();
      expect(typeof MetaService.getEntityMetas).toBe('function');
      expect(typeof MetaService.setEntityMeta).toBe('function');
      expect(typeof MetaService.setBulkEntityMetas).toBe('function');
    });

    test('should handle entity types correctly', async () => {
      mockQueryWithRLS.mockResolvedValue([]);

      await MetaService.getEntityMetas('user', mockEntityId, mockUserId, true);

      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('users_metas'),
        [mockEntityId],
        mockUserId
      );
    });

    test('should return empty object when no metadata found', async () => {
      mockQueryWithRLS.mockResolvedValue([]);

      const result = await MetaService.getEntityMetas('user', mockEntityId, mockUserId);
      
      expect(result).toEqual({});
    });
  });

  describe('Error handling', () => {
    test('should handle database errors gracefully', async () => {
      mockQueryWithRLS.mockRejectedValue(new Error('Database error'));

      await expect(
        MetaService.getEntityMetas('user', mockEntityId, mockUserId)
      ).rejects.toThrow('Database error');
    });
  });

  describe('JSONB serialization - Critical fix', () => {
    test('should pass JSON string for ::jsonb cast in PostgreSQL', async () => {
      // When using $3::jsonb cast, PostgreSQL expects a JSON string that it will parse
      // The pg driver passes this string directly to PostgreSQL for proper JSONB handling
      mockQueryWithRLS.mockResolvedValue([]);
      mockMutateWithRLS.mockResolvedValue([{ id: 'meta-id' }]);

      const complexObject = {
        currentUsage: 0,
        dailyLimit: 50,
        resetTime: '2025-10-02T00:00:00Z',
        lastUpdated: '2025-10-01T12:30:45Z',
        history: [
          { date: '2025-09-30', usage: 12 },
          { date: '2025-09-29', usage: 8 }
        ]
      };

      await MetaService.setEntityMeta('user', mockEntityId, 'ai-usage', complexObject, mockUserId);

      // The third parameter is JSON.stringify(object) for ::jsonb cast
      expect(mockMutateWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO'),
        [
          mockEntityId,
          'ai-usage',
          JSON.stringify(complexObject), // JSON string for ::jsonb cast
          'json',
          false,
          false
        ],
        mockUserId
      );

      // Verify it's a string (JSON serialized)
      const callArgs = mockMutateWithRLS.mock.calls[0][1];
      expect(typeof callArgs[2]).toBe('string');
      expect(JSON.parse(callArgs[2])).toEqual(complexObject);
    });

    test('should handle nested objects correctly', async () => {
      mockQueryWithRLS.mockResolvedValue([]);
      mockMutateWithRLS.mockResolvedValue([{ id: 'meta-id' }]);

      const nestedObject = {
        level1: {
          level2: {
            level3: {
              deepValue: 'test',
              deepArray: [1, 2, 3]
            }
          }
        }
      };

      await MetaService.setEntityMeta('user', mockEntityId, 'nested-meta', nestedObject, mockUserId);

      const callArgs = mockMutateWithRLS.mock.calls[0][1];
      expect(typeof callArgs[2]).toBe('string');
      const parsed = JSON.parse(callArgs[2]);
      expect(parsed.level1.level2.level3.deepValue).toBe('test');
      expect(Array.isArray(parsed.level1.level2.level3.deepArray)).toBe(true);
    });
  });

  describe('Replace behavior (no merging)', () => {
    test('should replace entire metaValue when updating a key', async () => {
      // Mock existing metadata (this will be completely replaced)
      mockQueryWithRLS.mockResolvedValue([
        {
          metaKey: 'uiPreferences',
          metaValue: {
            theme: 'dark',
            sidebarCollapsed: true,
            toolbar: {
              visible: true,
              position: 'top',
              buttons: ['save', 'print', 'export']
            }
          }
        }
      ]);

      // Mock successful upsert
      mockMutateWithRLS.mockResolvedValue([{ id: 'meta-id' }]);

      // When updating a metaKey, the entire value is replaced (no merging)
      const newValue = {
        theme: 'light',        // New value
        newSetting: 'value',   // New value
        toolbar: {             // New nested object
          visible: false
        }
        // Note: sidebarCollapsed is NOT preserved - entire object is replaced
      };

      const newMetas = {
        uiPreferences: newValue
      };

      await MetaService.setBulkEntityMetas('user', mockEntityId, newMetas, mockUserId);

      // Verify the JSON string is passed for ::jsonb cast and replaces existing value
      expect(mockMutateWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO'),
        [
          mockEntityId,
          'uiPreferences',
          JSON.stringify(newValue), // JSON string for ::jsonb cast
          'json',
          false,
          false
        ],
        mockUserId
      );
    });

    test('should handle completely new metadata keys', async () => {
      // Mock no existing metadata for this key
      mockQueryWithRLS.mockResolvedValue([]);
      mockMutateWithRLS.mockResolvedValue([{ id: 'meta-id' }]);

      const newValue = {
        setting1: 'value1',
        setting2: 'value2'
      };

      const newMetas = {
        newMetaGroup: newValue
      };

      await MetaService.setBulkEntityMetas('user', mockEntityId, newMetas, mockUserId);

      // Verify JSON string is passed for ::jsonb cast
      expect(mockMutateWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO'),
        [
          mockEntityId,
          'newMetaGroup',
          JSON.stringify(newValue), // JSON string for ::jsonb cast
          'json',
          false,
          false
        ],
        mockUserId
      );
    });

    test('should preserve other metaKeys when updating one key', async () => {
      // Mock existing metadata with multiple keys
      mockQueryWithRLS.mockResolvedValue([
        {
          metaKey: 'uiPreferences',
          metaValue: { theme: 'dark', sidebarCollapsed: true }
        },
        {
          metaKey: 'securityPreferences',
          metaValue: { twoFactorEnabled: true, loginAlertsEnabled: false }
        }
      ]);

      mockMutateWithRLS.mockResolvedValue([{ id: 'meta-id' }]);

      // Update only one metaKey - the OTHER metaKeys remain untouched
      const newValue = {
        theme: 'light'  // This REPLACES the entire uiPreferences value
        // Note: sidebarCollapsed is lost because we're replacing the entire value
      };

      const newMetas = {
        uiPreferences: newValue
      };

      await MetaService.setBulkEntityMetas('user', mockEntityId, newMetas, mockUserId);

      // Only uiPreferences is updated (replaced), securityPreferences remains unchanged in DB
      expect(mockMutateWithRLS).toHaveBeenCalledTimes(1);
      expect(mockMutateWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO'),
        [
          mockEntityId,
          'uiPreferences',
          JSON.stringify(newValue), // JSON string for ::jsonb cast
          'json',
          false,
          false
        ],
        mockUserId
      );
    });
  });
});