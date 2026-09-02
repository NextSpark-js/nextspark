/**
 * auth.methods presets & resolution (#126 — passwordless preset by default).
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import {
  AUTH_PRESETS,
  DEFAULT_AUTH_METHODS,
  resolveAuthMethods,
  isPasswordlessPreset,
  getPrimaryEmailMethod,
  matchAuthPreset,
  isPasswordLoginEnabled,
  isAuthLoginMethod,
} from '@/core/lib/auth/auth-methods'
import { DEFAULT_APP_CONFIG } from '@/core/lib/config/app.config'
import { getPublicAuthConfig, isGoogleAuthEnabled, isPasswordSignupAvailable } from '@/core/lib/auth/registration-helpers'
import type { AuthConfig } from '@/core/lib/config/types'

describe('auth methods presets', () => {
  let warnSpy: ReturnType<typeof jest.spyOn>
  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => warnSpy.mockRestore())

  test('the default preset is passwordless: email OTP + Google, no password', () => {
    expect(DEFAULT_AUTH_METHODS).toEqual(['email-otp', 'google'])
    expect(DEFAULT_AUTH_METHODS).toBe(AUTH_PRESETS.passwordless)
    expect(isPasswordlessPreset(DEFAULT_AUTH_METHODS)).toBe(true)
    expect(AUTH_PRESETS.classic).toEqual(['email-password', 'google'])
  })

  test('the core app config ships the passwordless preset by default', () => {
    const methods = resolveAuthMethods(DEFAULT_APP_CONFIG.auth)
    expect(methods).toEqual(['email-otp', 'google'])
    expect(matchAuthPreset(methods)).toBe('passwordless')
    expect(getPrimaryEmailMethod(methods)).toBe('email-otp')
  })

  test('no methods configured → passwordless preset', () => {
    expect(resolveAuthMethods(undefined)).toEqual(['email-otp', 'google'])
    expect(resolveAuthMethods(null)).toEqual(['email-otp', 'google'])
    expect(resolveAuthMethods({})).toEqual(['email-otp', 'google'])
  })

  test('a theme overrides the preset (arrays replace, order is kept)', () => {
    expect(resolveAuthMethods({ methods: ['email-password', 'google'] })).toEqual(['email-password', 'google'])
    expect(matchAuthPreset(['google', 'email-password'])).toBe('classic')
    expect(resolveAuthMethods({ methods: ['email-otp', 'email-password', 'google'] })).toEqual([
      'email-otp',
      'email-password',
      'google',
    ])
    expect(matchAuthPreset(['email-otp', 'email-password', 'google'])).toBeNull()
  })

  test('unknown entries are dropped with a warning; duplicates removed', () => {
    const methods = resolveAuthMethods({ methods: ['google', 'magic-link', 'google', 'email-otp'] })
    expect(methods).toEqual(['google', 'email-otp'])
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('magic-link'))
  })

  test('an empty or fully invalid list falls back to the passwordless preset', () => {
    expect(resolveAuthMethods({ methods: [] })).toEqual(['email-otp', 'google'])
    expect(resolveAuthMethods({ methods: ['nope'] })).toEqual(['email-otp', 'google'])
    expect(warnSpy).toHaveBeenCalled()
  })

  test('primary email method follows the configured order', () => {
    expect(getPrimaryEmailMethod(['email-password', 'email-otp'])).toBe('email-password')
    expect(getPrimaryEmailMethod(['google', 'email-otp', 'email-password'])).toBe('email-otp')
    expect(getPrimaryEmailMethod(['google'])).toBeNull()
  })

  test('isPasswordlessPreset requires OTP and no password', () => {
    expect(isPasswordlessPreset(['email-otp'])).toBe(true)
    expect(isPasswordlessPreset(['email-otp', 'email-password'])).toBe(false)
    expect(isPasswordlessPreset(['google'])).toBe(false)
  })

  test('isAuthLoginMethod type guard', () => {
    expect(isAuthLoginMethod('email-otp')).toBe(true)
    expect(isAuthLoginMethod('password')).toBe(false)
    expect(isAuthLoginMethod(42)).toBe(false)
  })

  test('password endpoints stay enabled server-side unless a theme disables them', () => {
    expect(isPasswordLoginEnabled(undefined)).toBe(true)
    expect(isPasswordLoginEnabled({})).toBe(true)
    expect(isPasswordLoginEnabled(DEFAULT_APP_CONFIG.auth)).toBe(true)
    expect(isPasswordLoginEnabled({ emailAndPassword: { enabled: false } })).toBe(false)
  })
})

describe('registration helpers with auth.methods', () => {
  test('google is offered only when listed in methods and not disabled in providers', () => {
    const base: AuthConfig = { registration: { mode: 'open' } }
    expect(isGoogleAuthEnabled(base)).toBe(true) // default preset includes google
    expect(isGoogleAuthEnabled({ ...base, methods: ['email-otp'] })).toBe(false)
    expect(isGoogleAuthEnabled({ ...base, providers: { google: { enabled: false } } })).toBe(false)
  })

  test('getPublicAuthConfig exposes the resolved methods', () => {
    const publicConfig = getPublicAuthConfig({ registration: { mode: 'open' } })
    expect(publicConfig.methods).toEqual(['email-otp', 'google'])
    expect(publicConfig.providers.google.enabled).toBe(true)

    const classic = getPublicAuthConfig({ registration: { mode: 'open' }, methods: ['email-password', 'google'] })
    expect(classic.methods).toEqual(['email-password', 'google'])
  })

  test('password signup page exists only for the classic flow in open modes', () => {
    expect(isPasswordSignupAvailable({ registration: { mode: 'open' } })).toBe(false) // passwordless default
    expect(isPasswordSignupAvailable({ registration: { mode: 'open' }, methods: ['email-password', 'google'] })).toBe(true)
    expect(
      isPasswordSignupAvailable({ registration: { mode: 'domain-restricted' }, methods: ['email-password', 'google'] })
    ).toBe(false)
  })
})
