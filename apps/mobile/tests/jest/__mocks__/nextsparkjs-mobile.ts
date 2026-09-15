/**
 * Mock for @nextsparkjs/mobile
 *
 * apps/mobile is installed outside the pnpm workspace, so the real package
 * is not resolvable from its Jest run. Screens only need the auth surface,
 * which is mocked, and the one-time code validation, which has no native
 * dependencies and comes from the package source as is.
 */

export { OTP_MIN_LENGTH, OTP_MAX_LENGTH, validateOtpCode } from '../../../../../packages/mobile/src/lib/otp'

export const mockUseAuth = {
  login: jest.fn(),
  requestOtp: jest.fn(),
  loginWithOtp: jest.fn(),
  isLoading: false,
}

export const mockAuthApi = {
  getSocialSignInUrl: jest.fn(),
}

export const useAuth = jest.fn(() => mockUseAuth)
export const authApi = mockAuthApi
