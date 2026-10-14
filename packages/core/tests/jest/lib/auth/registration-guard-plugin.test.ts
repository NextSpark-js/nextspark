import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'

// Mock the config module before importing the plugin
const mockAuthConfig = {
  registration: {
    mode: 'open' as string,
    allowedDomains: [] as string[],
  },
}

let mockBootstrapDone = false

jest.mock('@/core/lib/config', () => ({
  AUTH_CONFIG: mockAuthConfig,
}))

jest.mock('@/core/lib/services/team.service', () => ({
  TeamService: {
    isBootstrapDone: jest.fn(() => Promise.resolve(mockBootstrapDone)),
  },
}))

// Import after mock is set up
import { registrationGuardPlugin } from '@/core/lib/auth/registration-guard-plugin'
import { withSignupContext } from '@/core/lib/auth-context'

/**
 * Helper to create a mock Better Auth context for the plugin hooks
 */
function createMockCtx(path: string, options?: {
  inviteHeader?: string
  inviteQueryParam?: string
}) {
  const url = new URL(`http://localhost:3000${path}`)
  if (options?.inviteQueryParam) {
    url.searchParams.set('inviteToken', options.inviteQueryParam)
  }

  const headers = new Headers()
  if (options?.inviteHeader) {
    headers.set('x-invite-token', options.inviteHeader)
  }

  return {
    path,
    request: {
      url: url.toString(),
      headers,
    },
  }
}

describe('Registration Guard Plugin', () => {
  let plugin: ReturnType<typeof registrationGuardPlugin>
  let matcher: (ctx: any) => boolean
  let handler: (ctx: any) => Promise<any>

  beforeEach(() => {
    mockBootstrapDone = false
    plugin = registrationGuardPlugin()
    const hook = plugin.hooks!.before![0]
    matcher = hook.matcher as (ctx: any) => boolean
    handler = hook.handler as (ctx: any) => Promise<any>
  })

  describe('plugin metadata', () => {
    test('has correct id', () => {
      expect(plugin.id).toBe('registration-guard')
    })
  })

  describe('matcher', () => {
    test('matches /sign-up/social path', () => {
      const ctx = createMockCtx('/sign-up/social')
      expect(matcher(ctx)).toBe(true)
    })

    test('matches /callback/ paths', () => {
      const ctx = createMockCtx('/callback/google')
      expect(matcher(ctx)).toBe(true)
    })

    test('matches /sign-up path', () => {
      const ctx = createMockCtx('/sign-up')
      expect(matcher(ctx)).toBe(true)
    })

    test('does not match /sign-in path', () => {
      const ctx = createMockCtx('/sign-in')
      expect(matcher(ctx)).toBe(false)
    })

    test('does not match /forgot-password path', () => {
      const ctx = createMockCtx('/forgot-password')
      expect(matcher(ctx)).toBe(false)
    })

    test('does not match /sign-in/email path', () => {
      const ctx = createMockCtx('/sign-in/email')
      expect(matcher(ctx)).toBe(false)
    })

    test('handles empty path', () => {
      const ctx = createMockCtx('')
      expect(matcher(ctx)).toBe(false)
    })
  })

  describe('handler - open mode', () => {
    beforeEach(() => {
      mockAuthConfig.registration.mode = 'open'
    })

    test('passes through in open mode', async () => {
      const ctx = createMockCtx('/sign-up/social')
      const result = await handler(ctx)
      expect(result).toBe(ctx)
    })
  })

  describe('handler - invitation-only mode', () => {
    beforeEach(() => {
      mockAuthConfig.registration.mode = 'invitation-only'
    })

    test('allows first user when no team exists', async () => {
      mockBootstrapDone = false
      const ctx = createMockCtx('/sign-up/social')
      const result = await handler(ctx)
      expect(result).toBe(ctx)
    })

    test('throws a 403 SIGNUP_RESTRICTED APIError when team exists and no invite token', async () => {
      mockBootstrapDone = true
      const ctx = createMockCtx('/sign-up/social')
      await expect(handler(ctx)).rejects.toMatchObject({
        name: 'APIError',
        status: 'FORBIDDEN',
        body: { code: 'SIGNUP_RESTRICTED' },
      })
    })

    test('treats a missing request as having no invite token', async () => {
      mockBootstrapDone = true
      await expect(handler({ path: '/sign-up/social' })).rejects.toMatchObject({
        status: 'FORBIDDEN',
        body: { code: 'SIGNUP_RESTRICTED' },
      })
    })

    test('a token the client sends (header or query) is no invitation', async () => {
      mockBootstrapDone = true
      for (const options of [{ inviteHeader: 'any-token' }, { inviteQueryParam: 'any-token' }]) {
        await expect(handler(createMockCtx('/sign-up/email', options))).rejects.toMatchObject({
          status: 'FORBIDDEN',
          body: { code: 'SIGNUP_RESTRICTED' },
        })
      }
    })

    test('passes through inside the signup context signup-with-invite sets after validating the invitation', async () => {
      mockBootstrapDone = true
      const ctx = createMockCtx('/sign-up/email')
      await expect(withSignupContext({ skipTeamCreation: true, invitedTeamId: 'team-1' }, () => handler(ctx))).resolves.toBe(ctx)
      // a context without the invitation flow (a signup intent only) does not
      await expect(withSignupContext({ signupIntent: 'owner' }, () => handler(ctx))).rejects.toMatchObject({
        body: { code: 'SIGNUP_RESTRICTED' },
      })
    })
  })

  describe('handler - domain-restricted mode', () => {
    beforeEach(() => {
      mockAuthConfig.registration.mode = 'domain-restricted'
    })

    test('passes through (deferred to DB hooks)', async () => {
      const ctx = createMockCtx('/sign-up/social')
      const result = await handler(ctx)
      expect(result).toBe(ctx)
    })
  })

  describe('send-verification-otp hook', () => {
    let otpMatcher: (ctx: any) => boolean
    let otpHandler: (ctx: any) => Promise<any>
    const otpCtx = (email: string, type = 'sign-in') =>
      ({ path: '/email-otp/send-verification-otp', body: { email, type } })

    beforeEach(() => {
      const hook = plugin.hooks!.before![1]
      otpMatcher = hook.matcher as (ctx: any) => boolean
      otpHandler = hook.handler as (ctx: any) => Promise<any>
      mockAuthConfig.registration.mode = 'domain-open'
      mockAuthConfig.registration.allowedDomains = ['nextspark.dev']
      jest.spyOn(console, 'log').mockImplementation(() => {})
    })

    afterEach(() => {
      mockAuthConfig.registration.allowedDomains = []
    })

    test('matches only the send-verification-otp and email sign-up endpoints', () => {
      expect(otpMatcher(otpCtx('a@nextspark.dev'))).toBe(true)
      expect(otpMatcher({ path: '/sign-up/email' })).toBe(true)
      expect(otpMatcher({ path: '/sign-in/email-otp' })).toBe(false)
      expect(otpMatcher({ path: '/sign-in/email' })).toBe(false)
    })

    test('refuses an email sign-up for a domain outside allowedDomains with a 403 DOMAIN_NOT_ALLOWED, before Better Auth creates anything', async () => {
      const signUp = (email: unknown) => ({ path: '/sign-up/email', body: { email, password: 'x', name: 'N' } })
      await expect(otpHandler(signUp('someone@other.example'))).rejects.toMatchObject({
        status: 'FORBIDDEN',
        body: { code: 'DOMAIN_NOT_ALLOWED' },
      })
      expect((console.log as jest.Mock).mock.calls.flat().join(' ')).toContain('Refused a sign-up for a user at "other.example"')
      await expect(otpHandler(signUp('someone@nextspark.dev'))).resolves.toBeUndefined()
      // left to Better Auth's own validation
      await expect(otpHandler(signUp(42))).resolves.toBeUndefined()
      mockAuthConfig.registration.mode = 'open'
      await expect(otpHandler(signUp('someone@other.example'))).resolves.toBeUndefined()
    })

    test('refuses a sign-in code for a domain outside allowedDomains with a 403 DOMAIN_NOT_ALLOWED', async () => {
      await expect(otpHandler(otpCtx('someone@other.example'))).rejects.toMatchObject({
        status: 'FORBIDDEN',
        body: { code: 'DOMAIN_NOT_ALLOWED' },
      })
      const logged = (console.log as jest.Mock).mock.calls.flat().join(' ')
      expect(logged).toContain('other.example')
      expect(logged).not.toContain('someone@')
    })

    test('lets an allowed domain through', async () => {
      await expect(otpHandler(otpCtx('someone@nextspark.dev'))).resolves.toBeUndefined()
    })

    test('leaves other code types alone', async () => {
      await expect(otpHandler(otpCtx('someone@other.example', 'forget-password'))).resolves.toBeUndefined()
    })

    test('an empty allowedDomains allows every domain', async () => {
      mockAuthConfig.registration.allowedDomains = []
      await expect(otpHandler(otpCtx('someone@other.example'))).resolves.toBeUndefined()
    })

    test('modes other than domain-* are unaffected', async () => {
      mockAuthConfig.registration.mode = 'open'
      await expect(otpHandler(otpCtx('someone@other.example'))).resolves.toBeUndefined()
    })
  })
})
