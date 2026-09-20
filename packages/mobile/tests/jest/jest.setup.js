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

jest.mock('expo-device', () => ({
  isDevice: true,
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

// @testing-library/react-native currently renders through react-test-renderer.
// React 19 emits this deprecation from the library's internals on every render;
// leave every other console.error visible to keep real test failures diagnosable.
const REACT_TEST_RENDERER_DEPRECATION = 'react-test-renderer is deprecated. See https://react.dev/warnings/react-test-renderer'
const originalConsoleError = console.error
jest.spyOn(console, 'error').mockImplementation((...args) => {
  if (args.length === 1 && args[0] === REACT_TEST_RENDERER_DEPRECATION) return

  originalConsoleError(...args)
})

// Reset mocks and storage between tests
beforeEach(() => {
  jest.clearAllMocks()
  mockSecureStoreData.clear()
})
