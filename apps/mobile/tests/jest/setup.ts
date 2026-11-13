/**
 * Jest setup file for NextSpark Mobile (Native only)
 * This file is run after the test environment is set up
 */

import { act } from 'react'
import { cleanup } from '@testing-library/react-native'
import { notifyManager } from '@tanstack/react-query'
import { Alert as RNAlert } from 'react-native'

// Import mock storage for cleanup
import { mockStorage } from './mocks'
import { cleanupTestQueryClients } from './query-test-utils'

// Mock RNAlert.alert function
;(RNAlert.alert as jest.Mock) = jest.fn()

// TanStack Query schedules observer notifications. Wrap them in React's test
// boundary so updates delivered after a query or mutation settles are awaited.
// RNTL 14's act always returns a promise and this callback cannot await one, so
// use React's own act, which flushes a synchronous callback before it returns.
// RNTL only turns the act environment on while it is inside its own act, hence the flag.
const actEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
notifyManager.setNotifyFunction((callback) => {
  const previous = actEnvironment.IS_REACT_ACT_ENVIRONMENT
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
  try {
    act(callback)
  } finally {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = previous
  }
})

// Cleanup before each test
beforeEach(() => {
  jest.clearAllMocks()
  mockStorage.clear()
})

afterEach(async () => {
  // Unsubscribe rendered hooks before clearing their QueryClient caches. This
  // also cancels any cache garbage-collection timers deterministically.
  await cleanup()
  cleanupTestQueryClients()
})

export { mockStorage }
