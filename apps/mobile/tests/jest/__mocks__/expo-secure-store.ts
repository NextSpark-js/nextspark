/**
 * Manual mock for expo-secure-store
 * In-memory implementation for testing
 */

const mockStorage = new Map<string, string>();

export const getItemAsync = jest.fn(
  async (key: string): Promise<string | null> => {
    return mockStorage.get(key) ?? null;
  }
);

export const setItemAsync = jest.fn(
  async (key: string, value: string): Promise<void> => {
    mockStorage.set(key, value);
  }
);

export const deleteItemAsync = jest.fn(async (key: string): Promise<void> => {
  mockStorage.delete(key);
});

// Helper to reset storage between tests
export const __resetMockStorage = () => {
  mockStorage.clear();
};

// Helper to get current storage state (for assertions)
export const __getMockStorage = () => new Map(mockStorage);
