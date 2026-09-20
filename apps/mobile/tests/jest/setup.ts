/**
 * Jest setup file for NextSpark Mobile (Native only)
 * This file is run after the test environment is set up
 */

import '@testing-library/jest-native/extend-expect'
import { act, cleanup } from '@testing-library/react-native'
import { notifyManager } from '@tanstack/react-query'
import { Alert as RNAlert } from 'react-native'

// Import mock storage for cleanup
import { mockStorage } from './mocks'
import { cleanupTestQueryClients } from './query-test-utils'

// Mock RNAlert.alert function
;(RNAlert.alert as jest.Mock) = jest.fn()

// TanStack Query schedules observer notifications. Wrap them in React's test
// boundary so updates delivered after a query or mutation settles are awaited.
notifyManager.setNotifyFunction((callback) => {
  act(callback)
})

// Cleanup before each test
beforeEach(() => {
  jest.clearAllMocks()
  mockStorage.clear()
})

afterEach(() => {
  // Unsubscribe rendered hooks before clearing their QueryClient caches. This
  // also cancels any cache garbage-collection timers deterministically.
  cleanup()
  cleanupTestQueryClients()
})

export { mockStorage }
