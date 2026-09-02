/**
 * Auth API Service
 *
 * Authentication operations: login, logout, session management.
 */

import { apiClient } from '../client'
import { ApiError } from '../client.types'
import type { LoginResponse, OtpLoginResponse, SessionResponse, SocialSignInResponse } from './types'

/**
 * Better Auth returns the session token at the top level of sign-in
 * responses (`token`); older shapes nested it under `session.token`.
 */
function extractSessionToken(response: { token?: string | null; session?: { token?: string | null } | null }): string | null {
  return response.token ?? response.session?.token ?? null
}

/**
 * Persist what a successful sign-in gives us: the user (for offline
 * restoration) and the Bearer token (for API calls).
 */
async function persistSignIn(response: { user: LoginResponse['user']; token?: string | null; session?: { token?: string | null } | null }) {
  await apiClient.setUser(response.user)
  const token = extractSessionToken(response)
  if (token) {
    await apiClient.setToken(token)
  }
}

export const authApi = {
  /**
   * Login with email and password
   * Better Auth returns user and session info
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>('/api/auth/sign-in/email', {
      email,
      password,
    })

    await persistSignIn(response)

    return response
  },

  /**
   * Passwordless step 1: email a 6-digit one-time sign-in code
   * (Better Auth emailOTP plugin). A first sign-in creates the account.
   */
  async sendOtp(email: string): Promise<void> {
    await apiClient.post('/api/auth/email-otp/send-verification-otp', {
      email,
      type: 'sign-in',
    })
  },

  /**
   * Passwordless step 2: exchange the emailed code for a session.
   * Stores user + Bearer token like `login()`.
   */
  async loginWithOtp(email: string, otp: string): Promise<OtpLoginResponse> {
    const response = await apiClient.post<OtpLoginResponse>('/api/auth/sign-in/email-otp', {
      email,
      otp,
    })

    await persistSignIn(response)

    return response
  },

  /**
   * Get the provider's OAuth authorization URL to open in a browser.
   *
   * NOTE: on a native device the session established in the browser is NOT
   * handed back to the app by itself — that needs Better Auth's Expo plugin
   * (`@better-auth/expo`) on both server and client. On Expo web the browser
   * shares cookies with the app, so the flow completes end-to-end. See
   * `.docs/02-authentication.md` in the mobile template.
   */
  async getSocialSignInUrl(provider: 'google', callbackURL: string): Promise<string> {
    const response = await apiClient.post<SocialSignInResponse>('/api/auth/sign-in/social', {
      provider,
      callbackURL,
      disableRedirect: true,
    })
    return response.url
  },

  /**
   * Logout - clear local auth and call server signout
   */
  async logout(): Promise<void> {
    try {
      // Call server signout endpoint to invalidate session
      await apiClient.post('/api/auth/sign-out')
    } catch (error) {
      // Log error for debugging but continue with local cleanup
      // Server session may remain active if this fails (network issues)
      console.warn('[AuthApi] Failed to sign out from server:', error)
    }
    await apiClient.clearAuth()
  },

  /**
   * Get current session from server
   * Used to validate stored credentials and get fresh user data
   */
  async getSession(): Promise<SessionResponse | null> {
    try {
      const response = await apiClient.get<SessionResponse>('/api/auth/get-session')

      // Update stored user with fresh data
      if (response.user) {
        await apiClient.setUser(response.user)
      }

      return response
    } catch (error) {
      // Session invalid or expired
      if (error instanceof ApiError && error.status === 401) {
        return null
      }
      throw error
    }
  },
}
