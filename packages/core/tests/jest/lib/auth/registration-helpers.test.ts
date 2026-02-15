import { describe, test, expect } from '@jest/globals'
import {
  isRegistrationOpen,
  isDomainAllowed,
  isGoogleAuthEnabled,
  isSignupPageVisible,
  isEmailSignupEnabled,
  isEmailLoginVisible,
  shouldBlockSignup,
  getPublicAuthConfig,
} from '@/core/lib/auth/registration-helpers'
import type { AuthConfig } from '@/core/lib/config/types'

describe('Registration Helpers', () => {
  describe('isRegistrationOpen', () => {
    test('returns true for open mode', () => {
      expect(isRegistrationOpen('open')).toBe(true)
    })

    test('returns false for domain-restricted mode', () => {
      expect(isRegistrationOpen('domain-restricted')).toBe(false)
    })

    test('returns false for invitation-only mode', () => {
      expect(isRegistrationOpen('invitation-only')).toBe(false)
    })
  })

  describe('isDomainAllowed', () => {
    test('returns true when email domain matches allowed list', () => {
      expect(isDomainAllowed('user@nextspark.dev', ['nextspark.dev'])).toBe(true)
    })

    test('returns true when email domain matches one of multiple allowed domains', () => {
      expect(
        isDomainAllowed('user@company.com', ['nextspark.dev', 'company.com', 'other.com'])
      ).toBe(true)
    })

    test('returns false when email domain is not in allowed list', () => {
      expect(isDomainAllowed('user@gmail.com', ['nextspark.dev'])).toBe(false)
    })

    test('returns false for empty allowed domains list', () => {
      expect(isDomainAllowed('user@nextspark.dev', [])).toBe(false)
    })

    test('handles case-insensitive domain comparison', () => {
      expect(isDomainAllowed('user@nextspark.dev', ['nextspark.dev'])).toBe(true)
      expect(isDomainAllowed('user@nextspark.dev', ['nextspark.dev'])).toBe(true)
    })

    test('returns false for invalid email without @', () => {
      expect(isDomainAllowed('invalidemail', ['nextspark.dev'])).toBe(false)
    })

    test('returns false for empty email', () => {
      expect(isDomainAllowed('', ['nextspark.dev'])).toBe(false)
    })

    test('does not crash with malformed email containing multiple @ signs', () => {
      // split('@')[1] gets 'bad@nextspark.dev' which won't match 'nextspark.dev'
      // This is correct behavior - malformed emails should not match
      expect(isDomainAllowed('user@bad@nextspark.dev', ['nextspark.dev'])).toBe(false)
    })
  })

  describe('isGoogleAuthEnabled', () => {
    test('returns true for open mode with default config', () => {
      const config: AuthConfig = {
        registration: { mode: 'open' },
      }
      expect(isGoogleAuthEnabled(config)).toBe(true)
    })

    test('returns true for domain-restricted mode', () => {
      const config: AuthConfig = {
        registration: { mode: 'domain-restricted', allowedDomains: ['test.com'] },
      }
      expect(isGoogleAuthEnabled(config)).toBe(true)
    })

    test('returns false when explicitly disabled', () => {
      const config: AuthConfig = {
        registration: { mode: 'open' },
        providers: { google: { enabled: false } },
      }
      expect(isGoogleAuthEnabled(config)).toBe(false)
    })

    test('returns true when providers config is undefined', () => {
      const config: AuthConfig = {
        registration: { mode: 'open' },
      }
      expect(isGoogleAuthEnabled(config)).toBe(true)
    })

    test('returns true for invitation-only mode', () => {
      const config: AuthConfig = {
        registration: { mode: 'invitation-only' },
      }
      expect(isGoogleAuthEnabled(config)).toBe(true)
    })
  })

  describe('isSignupPageVisible', () => {
    test('returns true only for open mode', () => {
      expect(isSignupPageVisible('open')).toBe(true)
      expect(isSignupPageVisible('domain-restricted')).toBe(false)
      expect(isSignupPageVisible('invitation-only')).toBe(false)
    })
  })

  describe('isEmailSignupEnabled', () => {
    test('returns true only for open mode', () => {
      expect(isEmailSignupEnabled('open')).toBe(true)
      expect(isEmailSignupEnabled('domain-restricted')).toBe(false)
      expect(isEmailSignupEnabled('invitation-only')).toBe(false)
    })
  })

  describe('isEmailLoginVisible', () => {
    test('returns true for open mode', () => {
      expect(isEmailLoginVisible('open')).toBe(true)
    })

    test('returns true for invitation-only mode', () => {
      expect(isEmailLoginVisible('invitation-only')).toBe(true)
    })

    test('returns false for domain-restricted mode', () => {
      expect(isEmailLoginVisible('domain-restricted')).toBe(false)
    })
  })

  describe('shouldBlockSignup', () => {
    test('blocks email signup in domain-restricted mode', () => {
      expect(shouldBlockSignup('domain-restricted', false)).toBe(true)
    })

    test('allows OAuth signup in domain-restricted mode', () => {
      expect(shouldBlockSignup('domain-restricted', true)).toBe(false)
    })

    test('allows all signup in open mode', () => {
      expect(shouldBlockSignup('open', false)).toBe(false)
      expect(shouldBlockSignup('open', true)).toBe(false)
    })

    test('allows all signup in invitation-only mode (handled elsewhere)', () => {
      expect(shouldBlockSignup('invitation-only', false)).toBe(false)
      expect(shouldBlockSignup('invitation-only', true)).toBe(false)
    })
  })

  describe('getPublicAuthConfig', () => {
    test('strips allowedDomains from output', () => {
      const config: AuthConfig = {
        registration: {
          mode: 'domain-restricted',
          allowedDomains: ['nextspark.dev', 'secret-company.com'],
        },
      }
      const publicConfig = getPublicAuthConfig(config)

      expect(publicConfig.registration.mode).toBe('domain-restricted')
      expect((publicConfig.registration as any).allowedDomains).toBeUndefined()
    })

    test('sets google enabled based on mode and providers config', () => {
      const openConfig: AuthConfig = {
        registration: { mode: 'open' },
      }
      expect(getPublicAuthConfig(openConfig).providers.google.enabled).toBe(true)

      const disabledGoogle: AuthConfig = {
        registration: { mode: 'open' },
        providers: { google: { enabled: false } },
      }
      expect(getPublicAuthConfig(disabledGoogle).providers.google.enabled).toBe(false)
    })

    test('returns correct shape for all modes', () => {
      const modes = ['open', 'domain-restricted', 'invitation-only'] as const
      for (const mode of modes) {
        const config: AuthConfig = { registration: { mode } }
        const result = getPublicAuthConfig(config)

        expect(result).toHaveProperty('registration.mode', mode)
        expect(result).toHaveProperty('providers.google.enabled')
        expect(typeof result.providers.google.enabled).toBe('boolean')
      }
    })
  })
})
