/**
 * resolveSessionConfig — turns a theme's `auth.session` block into the values
 * handed to Better Auth (#125: session duration configurable per theme).
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import {
  resolveSessionConfig,
  DEFAULT_SESSION_CONFIG,
} from '@/core/lib/auth/session-config'

const DAY = 60 * 60 * 24

describe('resolveSessionConfig', () => {
  let warnSpy: ReturnType<typeof jest.spyOn>

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  test('returns the core defaults when the theme sets nothing', () => {
    expect(resolveSessionConfig(undefined)).toEqual(DEFAULT_SESSION_CONFIG)
    expect(resolveSessionConfig(null)).toEqual(DEFAULT_SESSION_CONFIG)
    expect(resolveSessionConfig({})).toEqual(DEFAULT_SESSION_CONFIG)
    expect(resolveSessionConfig({ session: {} })).toEqual(DEFAULT_SESSION_CONFIG)
    expect(DEFAULT_SESSION_CONFIG).toEqual({
      expiresIn: 7 * DAY,
      updateAge: DAY,
      cookieCache: { enabled: true, maxAge: 300 },
    })
    expect(warnSpy).not.toHaveBeenCalled()
  })

  test('a theme can set long-lived PWA sessions (expiresIn + updateAge)', () => {
    const resolved = resolveSessionConfig({
      session: { expiresIn: 90 * DAY, updateAge: 7 * DAY },
    })
    expect(resolved.expiresIn).toBe(90 * DAY)
    expect(resolved.updateAge).toBe(7 * DAY)
    // untouched fields keep the defaults
    expect(resolved.cookieCache).toEqual(DEFAULT_SESSION_CONFIG.cookieCache)
  })

  test('partial overrides merge with the defaults', () => {
    expect(resolveSessionConfig({ session: { expiresIn: 30 * DAY } })).toEqual({
      expiresIn: 30 * DAY,
      updateAge: DAY,
      cookieCache: { enabled: true, maxAge: 300 },
    })
    expect(
      resolveSessionConfig({ session: { cookieCache: { enabled: false } } }).cookieCache
    ).toEqual({ enabled: false, maxAge: 300 })
    expect(
      resolveSessionConfig({ session: { cookieCache: { maxAge: 60 } } }).cookieCache
    ).toEqual({ enabled: true, maxAge: 60 })
  })

  test('short sessions get a proportional default updateAge so they still roll', () => {
    // 1-hour session, no updateAge → half the session, not the 1-day default
    expect(resolveSessionConfig({ session: { expiresIn: 3600 } }).updateAge).toBe(1800)
  })

  test('updateAge larger than expiresIn is clamped with a warning', () => {
    const resolved = resolveSessionConfig({ session: { expiresIn: DAY, updateAge: 3 * DAY } })
    expect(resolved.updateAge).toBe(DAY)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('updateAge'))
  })

  test('cookieCache.maxAge never outlives the session', () => {
    const resolved = resolveSessionConfig({ session: { expiresIn: 60, cookieCache: { maxAge: 3600 } } })
    expect(resolved.cookieCache.maxAge).toBe(60)
  })

  test('invalid durations fall back to the defaults with a warning', () => {
    const invalid = [0, -5, NaN, Infinity, '7d' as unknown as number]
    for (const value of invalid) {
      warnSpy.mockClear()
      const resolved = resolveSessionConfig({ session: { expiresIn: value } })
      expect(resolved.expiresIn).toBe(DEFAULT_SESSION_CONFIG.expiresIn)
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('auth.session.expiresIn'))
    }
  })

  test('fractional seconds are floored', () => {
    expect(resolveSessionConfig({ session: { expiresIn: 100.9 } }).expiresIn).toBe(100)
  })
})
