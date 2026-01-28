// In-memory storage for SecureStore mock (must be declared before jest.mock)
const mockSecureStoreData = new Map()

// Mock React Native
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: (obj) => obj.ios,
  },
  Alert: {
    alert: jest.fn(),
  },
}))

// Mock Expo modules for testing
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      apiUrl: 'http://test-api.example.com',
    },
    hostUri: null,
  },
}))

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn((key) => Promise.resolve(mockSecureStoreData.get(key) || null)),
  setItemAsync: jest.fn((key, value) => {
    mockSecureStoreData.set(key, value)
    return Promise.resolve()
  }),
  deleteItemAsync: jest.fn((key) => {
    mockSecureStoreData.delete(key)
    return Promise.resolve()
  }),
}))

// Mock fetch
global.fetch = jest.fn()

// Reset mocks and storage between tests
beforeEach(() => {
  jest.clearAllMocks()
  mockSecureStoreData.clear()
})
