import { authApi } from '../../../src/api/core/auth'
import { apiClient } from '../../../src/api/client'

jest.mock('../../../src/api/client', () => ({
  apiClient: {
    post: jest.fn(),
    get: jest.fn(),
    setUser: jest.fn(),
    setToken: jest.fn(),
    clearAuth: jest.fn(),
  },
}))

const mockPost = apiClient.post as jest.Mock

describe('authApi (passwordless preset)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('sendOtp requests a sign-in code for the email', async () => {
    mockPost.mockResolvedValue({ success: true })

    await authApi.sendOtp('ada@example.com')

    expect(mockPost).toHaveBeenCalledWith('/api/auth/email-otp/send-verification-otp', {
      email: 'ada@example.com',
      type: 'sign-in',
    })
  })

  it('loginWithOtp exchanges the code for a session and persists user + token', async () => {
    const user = { id: 'user-1', email: 'ada@example.com' }
    mockPost.mockResolvedValue({ token: 'session-token', user })

    const response = await authApi.loginWithOtp('ada@example.com', '123456')

    expect(mockPost).toHaveBeenCalledWith('/api/auth/sign-in/email-otp', { email: 'ada@example.com', otp: '123456' })
    expect(apiClient.setUser).toHaveBeenCalledWith(user)
    expect(apiClient.setToken).toHaveBeenCalledWith('session-token')
    expect(response.user).toEqual(user)
  })

  it('login (classic) still works and stores the top-level Better Auth token', async () => {
    const user = { id: 'user-1', email: 'ada@example.com' }
    mockPost.mockResolvedValue({ token: 'session-token', user, redirect: false })

    await authApi.login('ada@example.com', 'Test1234')

    expect(mockPost).toHaveBeenCalledWith('/api/auth/sign-in/email', { email: 'ada@example.com', password: 'Test1234' })
    expect(apiClient.setUser).toHaveBeenCalledWith(user)
    expect(apiClient.setToken).toHaveBeenCalledWith('session-token')
  })

  it('login keeps supporting the legacy nested session.token shape', async () => {
    mockPost.mockResolvedValue({ user: { id: 'u' }, session: { token: 'nested-token' } })

    await authApi.login('ada@example.com', 'Test1234')

    expect(apiClient.setToken).toHaveBeenCalledWith('nested-token')
  })

  it('getSocialSignInUrl returns the provider authorization URL', async () => {
    mockPost.mockResolvedValue({ url: 'https://accounts.google.com/o/oauth2/auth?x=1', redirect: true })

    const url = await authApi.getSocialSignInUrl('google', 'nextspark://')

    expect(mockPost).toHaveBeenCalledWith('/api/auth/sign-in/social', {
      provider: 'google',
      callbackURL: 'nextspark://',
      disableRedirect: true,
    })
    expect(url).toBe('https://accounts.google.com/o/oauth2/auth?x=1')
  })
})
