/**
 * Tests for api/core/auth.ts
 * Sign-in token extraction and the sign-out request
 */

jest.mock('@/api/client', () => ({
  apiClient: {
    post: jest.fn(),
    get: jest.fn(),
    setUser: jest.fn(),
    setToken: jest.fn(),
    clearAuth: jest.fn(),
  },
}))

import { apiClient } from '@/api/client'
import { authApi } from '@/api/core/auth'

const mockPost = apiClient.post as jest.Mock
const user = { id: 'user-1', email: 'ada@example.com', name: 'Ada' }

describe('authApi', () => {
  it('login stores the top-level token Better Auth returns', async () => {
    mockPost.mockResolvedValueOnce({ user, token: 'flat-token' })

    await authApi.login('ada@example.com', 'secret')

    expect(apiClient.setUser).toHaveBeenCalledWith(user)
    expect(apiClient.setToken).toHaveBeenCalledWith('flat-token')
  })

  it('login accepts a token nested under session', async () => {
    mockPost.mockResolvedValueOnce({ user, session: { token: 'nested-token' } })

    await authApi.login('ada@example.com', 'secret')

    expect(apiClient.setToken).toHaveBeenCalledWith('nested-token')
  })

  it('login does not store a token when the response has none', async () => {
    mockPost.mockResolvedValueOnce({ user })

    await authApi.login('ada@example.com', 'secret')

    expect(apiClient.setToken).not.toHaveBeenCalled()
  })

  it('logout sends a JSON body, so the server revokes the session', async () => {
    mockPost.mockResolvedValueOnce({ success: true })

    await authApi.logout()

    expect(mockPost).toHaveBeenCalledWith('/api/auth/sign-out', {})
    expect(apiClient.clearAuth).toHaveBeenCalled()
  })

  it('logout clears local auth when the server request fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    mockPost.mockRejectedValueOnce(new Error('Network request failed'))

    await authApi.logout()

    expect(apiClient.clearAuth).toHaveBeenCalled()
    warn.mockRestore()
  })
})
