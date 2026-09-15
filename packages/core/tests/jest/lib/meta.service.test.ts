// Mock del módulo de DB
const mockQueryWithRLS = jest.fn();
const mockMutateWithRLS = jest.fn();

jest.mock('@/core/lib/db', () => ({
  queryWithRLS: mockQueryWithRLS,
  mutateWithRLS: mockMutateWithRLS
}));

// Import after mock is set up
const { MetaService, MetaValueTooLargeError } = require('@/core/lib/services/meta.service');

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

  describe('1 MiB limit on the stored value', () => {
    const WRITERS = [['setEntityMeta'], ['mergeEntityMeta'], ['mergeEntityMetaDefaults']];

    test.each(WRITERS)('%s only inserts a value that fits once stored as jsonb', async (method) => {
      mockMutateWithRLS.mockResolvedValue({ rows: [], rowCount: 1 });

      await MetaService[method]('user', mockEntityId, 'uiPreferences', { theme: 'dark' }, mockUserId);

      const [query, params] = mockMutateWithRLS.mock.calls[0];
      expect(query).toContain('SELECT $1, $2, incoming.value, $4, $5, $6');
      expect(query).toContain('FROM (SELECT $3::jsonb AS value) incoming');
      expect(query).toContain('WHERE octet_length((incoming.value)::text) <= 1048576');
      expect(params).toEqual([mockEntityId, 'uiPreferences', JSON.stringify({ theme: 'dark' }), 'json', false, false]);
    });

    test.each(WRITERS)('%s throws MetaValueTooLargeError when the statement wrote nothing', async (method) => {
      mockMutateWithRLS.mockResolvedValue({ rows: [], rowCount: 0 });

      await expect(
        MetaService[method]('user', mockEntityId, 'uiPreferences', { theme: 'dark' }, mockUserId)
      ).rejects.toBeInstanceOf(MetaValueTooLargeError);
    });
  });

  describe('mergeEntityMeta', () => {
    test('merges into the stored value in one statement, incoming keys winning', async () => {
      mockMutateWithRLS.mockResolvedValue({ rows: [], rowCount: 1 });

      const newValue = { theme: 'light' };
      await MetaService.mergeEntityMeta('user', mockEntityId, 'uiPreferences', newValue, mockUserId);

      // No SELECT first: the stored value is read and merged inside the
      // upsert, so two concurrent calls for the same key can't drop each
      // other's keys the way a read-merge-write in application code can.
      expect(mockQueryWithRLS).not.toHaveBeenCalled();
      expect(mockMutateWithRLS).toHaveBeenCalledTimes(1);

      const [query, params, userId] = mockMutateWithRLS.mock.calls[0];
      expect(query).toContain('INSERT INTO "users_metas"');
      expect(query).toContain("jsonb_typeof(\"users_metas\".\"metaValue\") = 'object'");
      expect(query).toContain('THEN "users_metas"."metaValue" || EXCLUDED."metaValue"');
      expect(query).toContain('ELSE EXCLUDED."metaValue"');
      expect(params).toEqual([mockEntityId, 'uiPreferences', JSON.stringify(newValue), 'json', false, false]);
      expect(userId).toBe(mockUserId);
    });

    test('only writes when the merged value is within 1 MiB, in the same statement', async () => {
      mockMutateWithRLS.mockResolvedValue({ rows: [], rowCount: 1 });

      await MetaService.mergeEntityMeta('user', mockEntityId, 'uiPreferences', { theme: 'dark' }, mockUserId);

      const [query] = mockMutateWithRLS.mock.calls[0];
      expect(query).toMatch(/WHERE octet_length\(\(CASE[\s\S]*END\)::text\) <= 1048576/);
    });

    test('throws MetaValueTooLargeError when the merged value is over the limit and nothing was written', async () => {
      mockMutateWithRLS.mockResolvedValue({ rows: [], rowCount: 0 });

      await expect(
        MetaService.mergeEntityMeta('user', mockEntityId, 'uiPreferences', { b: 'y' }, mockUserId)
      ).rejects.toBeInstanceOf(MetaValueTooLargeError);
    });

    test('applies the same validations as setEntityMeta', async () => {
      await expect(
        MetaService.mergeEntityMeta('user', mockEntityId, '', { a: 1 }, mockUserId)
      ).rejects.toThrow('Meta key cannot be empty');

      await expect(
        MetaService.mergeEntityMeta('user', mockEntityId, 'x'.repeat(101), { a: 1 }, mockUserId)
      ).rejects.toThrow('Meta key too long (max 100 characters)');

      await expect(
        MetaService.mergeEntityMeta('user', mockEntityId, 'big', { a: 'x'.repeat(1048576) }, mockUserId)
      ).rejects.toBeInstanceOf(MetaValueTooLargeError);

      expect(mockMutateWithRLS).not.toHaveBeenCalled();
    });
  });

  describe('mergeEntityMetaDefaults', () => {
    test('keeps stored keys and stored non-object values, adding only what is missing', async () => {
      mockMutateWithRLS.mockResolvedValue({ rows: [], rowCount: 1 });

      const defaults = { theme: 'light', sidebarCollapsed: false };
      await MetaService.mergeEntityMetaDefaults('user', mockEntityId, 'uiPreferences', defaults, mockUserId);

      const [query, params] = mockMutateWithRLS.mock.calls[0];
      expect(query).toContain('THEN EXCLUDED."metaValue" || "users_metas"."metaValue"');
      expect(query).toContain('ELSE "users_metas"."metaValue"');
      expect(query).toMatch(/WHERE octet_length\(\(CASE[\s\S]*END\)::text\) <= 1048576/);
      expect(params).toEqual([mockEntityId, 'uiPreferences', JSON.stringify(defaults), 'json', false, false]);
    });
  });

  describe('mergeEntityMetaGroups', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('merges each object group and skips the rest', async () => {
      const merge = jest.spyOn(MetaService, 'mergeEntityMeta').mockResolvedValue(undefined);
      const fill = jest.spyOn(MetaService, 'mergeEntityMetaDefaults').mockResolvedValue(undefined);

      await MetaService.mergeEntityMetaGroups('user', mockEntityId, {
        uiPreferences: { theme: 'dark' },
        securityPreferences: { loginAlertsEnabled: true },
        stray: 'not-a-group',
        empty: null,
      }, mockUserId);

      expect(merge.mock.calls).toEqual([
        ['user', mockEntityId, 'uiPreferences', { theme: 'dark' }, mockUserId],
        ['user', mockEntityId, 'securityPreferences', { loginAlertsEnabled: true }, mockUserId],
      ]);
      expect(fill).not.toHaveBeenCalled();
    });

    test('fills defaults without overwriting when defaults is set', async () => {
      const merge = jest.spyOn(MetaService, 'mergeEntityMeta').mockResolvedValue(undefined);
      const fill = jest.spyOn(MetaService, 'mergeEntityMetaDefaults').mockResolvedValue(undefined);

      await MetaService.mergeEntityMetaGroups('user', mockEntityId, {
        uiPreferences: { theme: 'light', sidebarCollapsed: false },
      }, mockUserId, { defaults: true });

      expect(fill.mock.calls).toEqual([
        ['user', mockEntityId, 'uiPreferences', { theme: 'light', sidebarCollapsed: false }, mockUserId],
      ]);
      expect(merge).not.toHaveBeenCalled();
    });
  });
});