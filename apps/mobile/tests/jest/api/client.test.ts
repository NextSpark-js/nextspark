/**
 * Tests for api/client.ts
 * Content-Type and body encoding of requests, and clearing the stored session
 */

jest.mock('@nextsparkjs/mobile', () => require('../__mocks__/nextsparkjs-mobile'))

import * as SecureStore from 'expo-secure-store'
import { clearNativeCookies } from '@nextsparkjs/mobile'
import { apiClient } from '@/api/client'

const mockFetch = jest.fn()

function lastFetchInit(): RequestInit {
  const calls = mockFetch.mock.calls
  return calls[calls.length - 1][1]
}

beforeEach(() => {
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ success: true }),
  })
  global.fetch = mockFetch as unknown as typeof fetch
})

describe('apiClient request encoding', () => {
  it('does not declare a JSON Content-Type on a bodyless POST', async () => {
    await apiClient.post('/api/auth/sign-out')

    const init = lastFetchInit()
    expect(init.headers).not.toHaveProperty('Content-Type')
    expect(init.body).toBeUndefined()
  })

  it('does not declare a JSON Content-Type on a GET', async () => {
    await apiClient.get('/api/auth/get-session')

    expect(lastFetchInit().headers).not.toHaveProperty('Content-Type')
  })

  it('declares a JSON Content-Type when the POST has a body', async () => {
    await apiClient.post('/api/auth/sign-out', {})

    const init = lastFetchInit()
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' })
    expect(init.body).toBe('{}')
  })

  it('sends a falsy body instead of dropping it', async () => {
    await apiClient.patch('/api/v1/settings/notifications', false)

    const init = lastFetchInit()
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' })
    expect(init.body).toBe('false')
  })

  it('does not declare a JSON Content-Type when the body is null', async () => {
    await apiClient.request('/api/auth/sign-out', { method: 'POST', body: null })

    expect(lastFetchInit().headers).not.toHaveProperty('Content-Type')
  })
})

describe('apiClient.clearAuth()', () => {
  const storedKeys = ['nextspark.auth.token', 'nextspark.auth.teamId', 'nextspark.auth.user']
  let warn: jest.SpyInstance

  beforeEach(async () => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    await apiClient.setToken('token')
    await apiClient.setTeamId('team-1')
  })

  afterEach(() => {
    warn.mockRestore()
  })

  it('empties the native cookie store and ends the session', async () => {
    await apiClient.clearAuth()

    expect(clearNativeCookies).toHaveBeenCalledTimes(1)
    expect(apiClient.getToken()).toBeNull()
    expect(apiClient.getTeamId()).toBeNull()
    for (const key of storedKeys) {
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(key)
    }
  })

  it('empties the native cookie store when a SecureStore delete fails', async () => {
    ;(SecureStore.deleteItemAsync as jest.Mock).mockRejectedValueOnce(new Error('SecureStore unavailable'))

    await expect(apiClient.clearAuth()).resolves.toBeUndefined()

    expect(clearNativeCookies).toHaveBeenCalledTimes(1)
    expect(apiClient.getToken()).toBeNull()
    for (const key of storedKeys) {
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(key)
    }
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Failed to clear'), expect.any(Error))
  })

  it('clears the stored session when emptying the cookie store fails', async () => {
    ;(clearNativeCookies as jest.Mock).mockRejectedValueOnce(new Error('native failure'))

    await expect(apiClient.clearAuth()).resolves.toBeUndefined()

    expect(apiClient.getToken()).toBeNull()
    for (const key of storedKeys) {
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(key)
    }
  })
})
