/**
 * One-time sign-in code validation
 *
 * Better Auth issues codes of 4 to 10 digits (`auth.otp.otpLength` on the
 * server), so the whole range is accepted instead of assuming one length.
 */

export const OTP_MIN_LENGTH = 4
export const OTP_MAX_LENGTH = 10

/** Why a code is rejected: outside the length range, or not only digits. */
export type OtpCodeError = 'length' | 'format'

/**
 * Validate a one-time code before it is sent to the server.
 * Surrounding whitespace is ignored. Returns null when the code is valid.
 */
export function validateOtpCode(code: string): OtpCodeError | null {
  const trimmed = code.trim()
  if (trimmed.length < OTP_MIN_LENGTH || trimmed.length > OTP_MAX_LENGTH) {
    return 'length'
  }
  if (!/^\d+$/.test(trimmed)) {
    return 'format'
  }
  return null
}
