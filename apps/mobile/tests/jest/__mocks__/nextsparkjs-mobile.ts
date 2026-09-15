/**
 * Partial mock for @nextsparkjs/mobile
 *
 * Screens render standalone in these tests, outside the real AuthProvider,
 * so only the auth surface is mocked; everything else (one-time code
 * validation included) comes from the real package, resolved through the
 * same moduleNameMapper Jest uses for the real module.
 */

const actual = jest.requireActual('@nextsparkjs/mobile')

export const { OTP_MIN_LENGTH, OTP_MAX_LENGTH, validateOtpCode } = actual

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

export const clearNativeCookies = jest.fn(async () => undefined)
