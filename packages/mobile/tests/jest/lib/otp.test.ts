import { validateOtpCode, OTP_MIN_LENGTH, OTP_MAX_LENGTH } from '../../../src/lib/otp'

describe('validateOtpCode()', () => {
  it('accepts a code at the minimum length', () => {
    expect(validateOtpCode('1'.repeat(OTP_MIN_LENGTH))).toBeNull()
  })

  it('accepts a code at the maximum length', () => {
    expect(validateOtpCode('1'.repeat(OTP_MAX_LENGTH))).toBeNull()
  })

  it('accepts a code in the middle of the range', () => {
    expect(validateOtpCode('123456')).toBeNull()
  })

  it('rejects a code shorter than the minimum', () => {
    expect(validateOtpCode('1'.repeat(OTP_MIN_LENGTH - 1))).toBe('length')
  })

  it('rejects a code longer than the maximum', () => {
    expect(validateOtpCode('1'.repeat(OTP_MAX_LENGTH + 1))).toBe('length')
  })

  it('rejects an empty code', () => {
    expect(validateOtpCode('')).toBe('length')
  })

  it('rejects a code with only whitespace', () => {
    expect(validateOtpCode('    ')).toBe('length')
  })

  it('ignores surrounding whitespace', () => {
    expect(validateOtpCode(`  ${'1'.repeat(OTP_MIN_LENGTH)}  `)).toBeNull()
  })

  it('rejects a code with letters', () => {
    expect(validateOtpCode('12a456')).toBe('format')
  })

  it('rejects a code with symbols', () => {
    expect(validateOtpCode('123-456')).toBe('format')
  })
})
