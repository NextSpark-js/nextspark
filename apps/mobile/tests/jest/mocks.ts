/**
 * Jest mocks file - loaded BEFORE test environment setup
 * This ensures mocks are in place before any module imports
 *
 * Note: Platform mock is handled via moduleNameMapper in jest.config.js
 */

// expo-secure-store mock (in-memory)
const mockStorage = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockStorage.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockStorage.delete(key);
  }),
}));

// Export for test access
export { mockStorage };
