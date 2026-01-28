/**
 * Jest setup file for NextSpark Mobile (Native only)
 * This file is run after the test environment is set up
 */

import '@testing-library/jest-native/extend-expect'
import { Alert as RNAlert } from 'react-native'

// Import mock storage for cleanup
import { mockStorage } from './mocks'

// Mock RNAlert.alert function
;(RNAlert.alert as jest.Mock) = jest.fn()

// Cleanup before each test
beforeEach(() => {
  jest.clearAllMocks()
  mockStorage.clear()
})

export { mockStorage }
