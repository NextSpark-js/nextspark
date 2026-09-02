/**
 * Core API Types
 *
 * Types for authentication, users, and teams.
 */

/**
 * User entity
 */
export interface User {
  id: string
  email: string
  name?: string | null
  image?: string | null
}

/**
 * Team entity (from /api/v1/teams)
 */
export interface Team {
  id: string
  name: string
  slug?: string
  logo?: string | null
  role: string // User's role in this team (owner, admin, member, viewer, etc.)
}

/**
 * Auth session info
 */
export interface AuthSession {
  token: string
  user: User
}

/**
 * Login methods the mobile login screen can offer (mirrors the web
 * `AUTH_CONFIG.methods`). Configure them in `src/config/app.config.ts`.
 * Default preset: passwordless — `['email-otp', 'google']`.
 */
export type AuthLoginMethod = 'email-otp' | 'google' | 'email-password'

/**
 * Login response from Better Auth (`/sign-in/email`).
 * Better Auth returns the session token at the top level (`token`); the
 * nested `session.token` shape is kept for backwards compatibility.
 */
export interface LoginResponse {
  user: User
  token?: string
  session?: {
    token: string
  } | null
}

/**
 * Passwordless login response from Better Auth (`/sign-in/email-otp`)
 */
export interface OtpLoginResponse {
  user: User
  token: string
}

/**
 * Social sign-in bootstrap response (`/sign-in/social` with disableRedirect):
 * the provider's authorization URL to open in a browser.
 */
export interface SocialSignInResponse {
  url: string
  redirect: boolean
}

/**
 * Session response from Better Auth
 */
export interface SessionResponse {
  user: User | null
  session: {
    id: string
    expiresAt: string
  } | null
}

/**
 * Teams list response
 */
export interface TeamsResponse {
  data: Team[]
}
