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
 * Login response from Better Auth
 */
export interface LoginResponse {
  user: User
  session: {
    token: string
  }
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
