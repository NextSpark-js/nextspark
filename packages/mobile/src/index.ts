/**
 * @nextsparkjs/mobile
 *
 * Mobile app infrastructure for NextSpark.
 * Provides API client, authentication, and utilities for Expo apps.
 */

// API Client
export { apiClient, ApiClient, getApiUrl } from './api/client'
export { ApiError } from './api/client.types'
export type { RequestConfig, PaginatedResponse, SingleResponse } from './api/client.types'

// Entity Factory
export { createEntityApi } from './api/entities/factory'
export type { EntityApi, EntityListParams } from './api/entities/types'

// Core API Services
export { authApi } from './api/core/auth'
export { teamsApi } from './api/core/teams'
export type {
  User,
  Team,
  AuthSession,
  AuthLoginMethod,
  LoginResponse,
  OtpLoginResponse,
  SocialSignInResponse,
  SessionResponse,
  TeamsResponse,
} from './api/core/types'

// Providers
export { AuthProvider, useAuth } from './providers/AuthProvider'
export { QueryProvider, queryClient } from './providers/QueryProvider'

// Utilities
/**
 * Secure storage utilities using Expo SecureStore (native) or localStorage (web)
 * @example
 * ```ts
 * import { Storage } from '@nextsparkjs/mobile'
 * await Storage.setItemAsync('key', 'value')
 * const value = await Storage.getItemAsync('key')
 * ```
 */
export * as Storage from './lib/storage'

/**
 * Cross-platform alert dialogs (native Alert API on iOS/Android, window.confirm on web)
 * @example
 * ```ts
 * import { alert, confirm } from '@nextsparkjs/mobile'
 * alert({ title: 'Info', message: 'Hello!' })
 * const confirmed = await confirm('Are you sure?', 'This action cannot be undone')
 * ```
 */
export { alert, confirm, confirmDestructive, Alert } from './lib/alert'

/**
 * One-time sign-in code validation (Better Auth's 4-10 digit range)
 * @example
 * ```ts
 * import { validateOtpCode } from '@nextsparkjs/mobile'
 * validateOtpCode('123456') // null
 * validateOtpCode('12a4')   // 'format'
 * ```
 */
export { OTP_MIN_LENGTH, OTP_MAX_LENGTH, validateOtpCode } from './lib/otp'
export type { OtpCodeError } from './lib/otp'

/**
 * Empty the app's native cookie store, as apiClient.clearAuth() does on sign-out.
 * Needs @preeternal/react-native-cookie-manager and a development build; without
 * them it warns once and does nothing. Never rejects.
 */
export { clearNativeCookies } from './lib/cookies'
