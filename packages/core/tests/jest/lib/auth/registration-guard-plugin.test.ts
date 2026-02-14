import { describe, test, expect, beforeEach } from '@jest/globals'

// Mock the config module before importing the plugin
const mockAuthConfig = {
  registration: {
    mode: 'open' as string,
  },
}

let mockHasGlobal = false

jest.mock('@/core/lib/config', () => ({
  AUTH_CONFIG: mockAuthConfig,
}))

jest.mock('@/core/lib/services/team.service', () => ({
  TeamService: {
    hasGlobal: jest.fn(() => Promise.resolve(mockHasGlobal)),
  },
}))

// Import after mock is set up
import { registrationGuardPlugin } from '@/core/lib/auth/registration-guard-plugin'

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
    mockHasGlobal = false
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
      mockHasGlobal = false
      const ctx = createMockCtx('/sign-up/social')
      const result = await handler(ctx)
      expect(result).toBe(ctx)
    })

    test('throws SIGNUP_RESTRICTED when team exists and no invite token', async () => {
      mockHasGlobal = true
      const ctx = createMockCtx('/sign-up/social')
      await expect(handler(ctx)).rejects.toThrow('SIGNUP_RESTRICTED')
    })

    test('passes through with invite header when team exists', async () => {
      mockHasGlobal = true
      const ctx = createMockCtx('/sign-up/social', {
        inviteHeader: 'valid-token-123',
      })
      const result = await handler(ctx)
      expect(result).toBe(ctx)
    })

    test('passes through with invite query param when team exists', async () => {
      mockHasGlobal = true
      const ctx = createMockCtx('/sign-up/social', {
        inviteQueryParam: 'valid-token-456',
      })
      const result = await handler(ctx)
      expect(result).toBe(ctx)
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
})
