/**
 * resolveOtpConfig and the countdown helpers — the emailed code's lifetime and
 * length as a single source of truth for the server and the login form (#186).
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import {
  resolveOtpConfig,
  getOtpSecondsRemaining,
  formatOtpCountdown,
  DEFAULT_OTP_CONFIG,
} from '@/core/lib/auth/otp-config'

describe('resolveOtpConfig', () => {
  let warnSpy: ReturnType<typeof jest.spyOn>

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  test('returns the core defaults when the theme sets nothing', () => {
    expect(resolveOtpConfig(undefined)).toEqual(DEFAULT_OTP_CONFIG)
    expect(resolveOtpConfig(null)).toEqual(DEFAULT_OTP_CONFIG)
    expect(resolveOtpConfig({})).toEqual(DEFAULT_OTP_CONFIG)
    expect(resolveOtpConfig({ otp: {} })).toEqual(DEFAULT_OTP_CONFIG)
    expect(DEFAULT_OTP_CONFIG).toEqual({ expiresIn: 300, otpLength: 6 })
  })

  test('takes the theme values when they are valid', () => {
    expect(resolveOtpConfig({ otp: { expiresIn: 120, otpLength: 8 } })).toEqual({
      expiresIn: 120,
      otpLength: 8,
    })
  })

  test('each field falls back on its own', () => {
    expect(resolveOtpConfig({ otp: { expiresIn: 60 } })).toEqual({
      expiresIn: 60,
      otpLength: DEFAULT_OTP_CONFIG.otpLength,
    })
    expect(resolveOtpConfig({ otp: { otpLength: 4 } })).toEqual({
      expiresIn: DEFAULT_OTP_CONFIG.expiresIn,
      otpLength: 4,
    })
  })

  test.each([0, -1, NaN, Infinity, '300', null])(
    'rejects %p as expiresIn and warns',
    (value) => {
      expect(resolveOtpConfig({ otp: { expiresIn: value as number } }).expiresIn).toBe(
        DEFAULT_OTP_CONFIG.expiresIn
      )
      expect(warnSpy).toHaveBeenCalled()
    }
  )

  test('floors fractional values', () => {
    expect(resolveOtpConfig({ otp: { expiresIn: 90.7, otpLength: 6.9 } })).toEqual({
      expiresIn: 90,
      otpLength: 6,
    })
  })

  test.each([3, 11, 100])('rejects out-of-range otpLength %p and warns', (length) => {
    expect(resolveOtpConfig({ otp: { otpLength: length } }).otpLength).toBe(
      DEFAULT_OTP_CONFIG.otpLength
    )
    expect(warnSpy).toHaveBeenCalled()
  })

  test('keeps the range bounds themselves', () => {
    expect(resolveOtpConfig({ otp: { otpLength: 4 } }).otpLength).toBe(4)
    expect(resolveOtpConfig({ otp: { otpLength: 10 } }).otpLength).toBe(10)
  })
})

describe('getOtpSecondsRemaining', () => {
  const sentAt = 1_700_000_000_000

  test('counts down from the full lifetime', () => {
    expect(getOtpSecondsRemaining(sentAt, 300, sentAt)).toBe(300)
    expect(getOtpSecondsRemaining(sentAt, 300, sentAt + 1_000)).toBe(299)
    expect(getOtpSecondsRemaining(sentAt, 300, sentAt + 60_000)).toBe(240)
  })

  test('floors at zero instead of going negative', () => {
    expect(getOtpSecondsRemaining(sentAt, 300, sentAt + 300_000)).toBe(0)
    expect(getOtpSecondsRemaining(sentAt, 300, sentAt + 10_000_000)).toBe(0)
  })

  test('a clock that jumped backwards never reports more than the lifetime', () => {
    expect(getOtpSecondsRemaining(sentAt, 300, sentAt - 60_000)).toBe(360)
  })
})

describe('formatOtpCountdown', () => {
  test.each([
    [300, '5:00'],
    [299, '4:59'],
    [61, '1:01'],
    [60, '1:00'],
    [59, '59'],
    [5, '5'],
    [0, '0'],
  ])('formats %p seconds as %p', (seconds, expected) => {
    expect(formatOtpCountdown(seconds)).toBe(expected)
  })

  test('never renders a negative time', () => {
    expect(formatOtpCountdown(-30)).toBe('0')
  })
})
