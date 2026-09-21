import { afterEach, describe, expect, jest, test } from '@jest/globals'
import { evaluateAuthReadiness } from '@/core/lib/auth/readiness'

const productionWeb = {
  profile: 'web-local-auth' as const,
  stage: 'runtime' as const,
  environment: 'production' as const,
}

describe('evaluateAuthReadiness', () => {
  test('accepts production OTP when Resend is syntactically configured', () => {
    const result = evaluateAuthReadiness({
      ...productionWeb,
      authConfig: { methods: ['email-otp'] },
      configuration: {
        email: {
          provider: 'resend',
          resendApiKey: 're_1234567890abcdefghijklmnop',
          resendFromEmail: 'auth@example.com',
        },
      },
    })

    expect(result.outcome).toBe('ready')
    expect(result.declaredMethods).toEqual(['email-otp'])
    expect(result.availableMethods).toEqual(['email-otp'])
  })

  test('accepts an OAuth-only production configuration with a complete credential pair', () => {
    const result = evaluateAuthReadiness({
      ...productionWeb,
      authConfig: { methods: ['google'] },
      configuration: {
        google: {
          clientId: '123456789-abcdef.apps.googleusercontent.com',
          clientSecret: 'GOCSPX-production-secret',
        },
      },
    })

    expect(result.outcome).toBe('ready')
    expect(result.availableMethods).toEqual(['google'])
  })

  test('reports both declared methods as available when both providers are configured', () => {
    const result = evaluateAuthReadiness({
      ...productionWeb,
      authConfig: { methods: ['email-otp', 'google'] },
      configuration: {
        email: {
          provider: 'auto',
          resendApiKey: 're_1234567890abcdefghijklmnop',
          resendFromEmail: 'auth@example.com',
        },
        google: {
          clientId: '123456789-abcdef.apps.googleusercontent.com',
          clientSecret: 'GOCSPX-production-secret',
        },
      },
    })

    expect(result.outcome).toBe('ready')
    expect(result.availableMethods).toEqual(['email-otp', 'google'])
  })

  test('distinguishes declared methods from unavailable provider configuration', () => {
    const result = evaluateAuthReadiness({
      ...productionWeb,
      authConfig: { methods: ['email-otp', 'google'] },
      configuration: {},
    })

    expect(result.outcome).toBe('invalid')
    expect(result.declaredMethods).toEqual(['email-otp', 'google'])
    expect(result.availableMethods).toEqual([])
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining([
        'EMAIL_PROVIDER_DEVELOPMENT_ONLY',
        'GOOGLE_CLIENT_ID_MISSING',
        'GOOGLE_CLIENT_SECRET_MISSING',
      ])
    )
  })

  test.each([
    ['empty', '   ', 'auth@example.com'],
    ['placeholder', 're_...', 'your-email@example.com'],
    ['malformed', 'not-a-resend-key', 'not-an-email'],
  ])('rejects %s Resend configuration', (_label, resendApiKey, resendFromEmail) => {
    const result = evaluateAuthReadiness({
      ...productionWeb,
      authConfig: { methods: ['email-otp'] },
      configuration: {
        email: { provider: 'resend', resendApiKey, resendFromEmail },
      },
    })

    expect(result.outcome).toBe('invalid')
    expect(result.availableMethods).toEqual([])
    expect(result.diagnostics.some((diagnostic) => diagnostic.severity === 'error')).toBe(true)
  })

  test('rejects placeholder OAuth credentials and incomplete credential pairs', () => {
    const placeholder = evaluateAuthReadiness({
      ...productionWeb,
      authConfig: { methods: ['google'] },
      configuration: {
        google: {
          clientId: 'YOUR_GOOGLE_CLIENT_ID',
          clientSecret: 'YOUR_GOOGLE_CLIENT_SECRET',
        },
      },
    })
    const incomplete = evaluateAuthReadiness({
      ...productionWeb,
      authConfig: { methods: ['google'] },
      configuration: {
        google: { clientId: '123456789-abcdef.apps.googleusercontent.com' },
      },
    })

    expect(placeholder.outcome).toBe('invalid')
    expect(placeholder.availableMethods).toEqual([])
    expect(incomplete.outcome).toBe('invalid')
    expect(incomplete.diagnostics.map((diagnostic) => diagnostic.code)).toContain('GOOGLE_CLIENT_SECRET_MISSING')
  })

  test('allows console email in development but rejects it for production readiness', () => {
    const development = evaluateAuthReadiness({
      ...productionWeb,
      environment: 'development',
      authConfig: { methods: ['email-otp'] },
      configuration: { email: { provider: 'console' } },
    })
    const autoDevelopment = evaluateAuthReadiness({
      ...productionWeb,
      environment: 'development',
      authConfig: { methods: ['email-otp'] },
      configuration: { email: { provider: 'auto', resendApiKey: 'ignored-by-development-auto' } },
    })
    const production = evaluateAuthReadiness({
      ...productionWeb,
      authConfig: { methods: ['email-otp'] },
      configuration: { email: { provider: 'console' } },
    })

    expect(development.outcome).toBe('ready')
    expect(development.availableMethods).toEqual(['email-otp'])
    expect(autoDevelopment.outcome).toBe('ready')
    expect(production.outcome).toBe('invalid')
    expect(production.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      'EMAIL_PROVIDER_DEVELOPMENT_ONLY'
    )
  })

  test('defers absent runtime-only credentials at build but requires them at runtime', () => {
    const build = evaluateAuthReadiness({
      ...productionWeb,
      stage: 'build',
      authConfig: { methods: ['google'] },
      configuration: { google: { runtimeOnly: true } },
    })
    const runtime = evaluateAuthReadiness({
      ...productionWeb,
      authConfig: { methods: ['google'] },
      configuration: { google: { runtimeOnly: true } },
    })

    expect(build.outcome).toBe('deferred')
    expect(build.deferredMethods).toEqual(['google'])
    expect(build.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      'GOOGLE_RUNTIME_VALIDATION_REQUIRED'
    )
    expect(runtime.outcome).toBe('invalid')
  })

  test('can be ready with build-time values and invalid when those values are absent at runtime', () => {
    const build = evaluateAuthReadiness({
      ...productionWeb,
      stage: 'build',
      authConfig: { methods: ['google'] },
      configuration: {
        google: {
          clientId: '123456789-abcdef.apps.googleusercontent.com',
          clientSecret: 'GOCSPX-production-secret',
        },
      },
    })
    const runtime = evaluateAuthReadiness({
      ...productionWeb,
      authConfig: { methods: ['google'] },
      configuration: {},
    })

    expect(build.outcome).toBe('ready')
    expect(runtime.outcome).toBe('invalid')
  })

  test('does not treat a concrete invalid build value as runtime-deferred', () => {
    const result = evaluateAuthReadiness({
      ...productionWeb,
      stage: 'build',
      authConfig: { methods: ['google'] },
      configuration: {
        google: {
          clientId: 'YOUR_GOOGLE_CLIENT_ID',
          clientSecret: 'YOUR_GOOGLE_CLIENT_SECRET',
          runtimeOnly: true,
        },
      },
    })

    expect(result.outcome).toBe('invalid')
    expect(result.deferredMethods).toEqual([])
  })

  test('evaluates headless local auth without requiring an unused email provider', () => {
    const result = evaluateAuthReadiness({
      ...productionWeb,
      profile: 'headless',
      authConfig: { methods: ['google'] },
      configuration: {
        google: {
          clientId: '123456789-abcdef.apps.googleusercontent.com',
          clientSecret: 'GOCSPX-production-secret',
        },
      },
    })

    expect(result.outcome).toBe('ready')
    expect(result.availableMethods).toEqual(['google'])
    expect(result.diagnostics.some((diagnostic) => diagnostic.method === 'email')).toBe(false)
  })

  test('does not require local providers for an external/no-local-auth profile', () => {
    const result = evaluateAuthReadiness({
      ...productionWeb,
      profile: 'external-no-local-auth',
      authConfig: { methods: ['email-otp', 'google'] },
      configuration: {
        email: { provider: 'resend', resendApiKey: 're_...', resendFromEmail: 'not-an-email' },
        google: { clientId: 'placeholder', clientSecret: 'placeholder' },
      },
    })

    expect(result.outcome).toBe('not-applicable')
    expect(result.declaredMethods).toEqual([])
    expect(result.availableMethods).toEqual([])
    expect(result.diagnostics).toEqual([])
  })

  test('never includes credential values in its diagnostic representation', () => {
    const secrets = {
      resendApiKey: 're_SUPER_SECRET_1234567890',
      resendFromEmail: 'secret-sender@example.com',
      clientId: '123456789-secret.apps.googleusercontent.com',
      clientSecret: 'GOCSPX-super-secret-value',
    }
    const result = evaluateAuthReadiness({
      ...productionWeb,
      authConfig: { methods: ['email-otp', 'google'] },
      configuration: {
        email: {
          provider: 'resend',
          resendApiKey: secrets.resendApiKey,
          resendFromEmail: secrets.resendFromEmail,
        },
        google: {
          clientId: secrets.clientId,
          clientSecret: secrets.clientSecret,
        },
      },
    })
    const diagnosticJson = JSON.stringify(result)

    for (const secret of Object.values(secrets)) {
      expect(diagnosticJson).not.toContain(secret)
    }
  })
})

const validResendApiKey = 're_1234567890abcdefghijklmnop'
const validGoogleClientId = '123456789-abcdef.apps.googleusercontent.com'
const validGoogleClientSecret = 'GOCSPX-production-secret'

function diagnosticCodes(result: ReturnType<typeof evaluateAuthReadiness>) {
  return result.diagnostics.map((diagnostic) => diagnostic.code)
}

describe('evaluateAuthReadiness shipped placeholders', () => {
  test.each([
    ['documented sender', 'noreply@yourdomain.com'],
    ['uppercase sender', 'NoReply@YourDomain.COM'],
    ['whitespace-padded sender', '  noreply@yourdomain.com\n'],
  ])('rejects the %s placeholder', (_label, resendFromEmail) => {
    const result = evaluateAuthReadiness({
      ...productionWeb,
      authConfig: { methods: ['email-otp'] },
      configuration: {
        email: { provider: 'resend', resendApiKey: validResendApiKey, resendFromEmail },
      },
    })

    expect(result.outcome).toBe('invalid')
    expect(result.availableMethods).toEqual([])
    expect(diagnosticCodes(result)).toContain('RESEND_FROM_EMAIL_PLACEHOLDER')
  })

  test.each([
    'auth@example.com',
    'noreply@yourbank.com',
    'noreply@yourdomain.co',
    'noreply@notyourdomain.com',
    'yourdomain@company.com',
  ])('accepts the legitimate sender %s', (resendFromEmail) => {
    const result = evaluateAuthReadiness({
      ...productionWeb,
      authConfig: { methods: ['email-otp'] },
      configuration: {
        email: { provider: 'resend', resendApiKey: validResendApiKey, resendFromEmail },
      },
    })

    expect(result.outcome).toBe('ready')
    expect(result.availableMethods).toEqual(['email-otp'])
    expect(result.diagnostics).toEqual([])
  })

  test('rejects the shipped Resend API key placeholder', () => {
    const result = evaluateAuthReadiness({
      ...productionWeb,
      authConfig: { methods: ['email-otp'] },
      configuration: {
        email: { provider: 'resend', resendApiKey: 're_xxxxxxxxxxxx', resendFromEmail: 'auth@example.com' },
      },
    })

    expect(result.outcome).toBe('invalid')
    expect(diagnosticCodes(result)).toEqual(['RESEND_API_KEY_PLACEHOLDER', 'AUTH_NO_AVAILABLE_METHOD'])
  })

  test('rejects the shipped Google credential placeholders', () => {
    const result = evaluateAuthReadiness({
      ...productionWeb,
      authConfig: { methods: ['google'] },
      configuration: {
        google: { clientId: 'your-google-client-id', clientSecret: 'your-google-client-secret' },
      },
    })

    expect(result.outcome).toBe('invalid')
    expect(diagnosticCodes(result)).toEqual([
      'GOOGLE_CLIENT_ID_PLACEHOLDER',
      'GOOGLE_CLIENT_SECRET_PLACEHOLDER',
      'AUTH_NO_AVAILABLE_METHOD',
    ])
  })
})

describe('evaluateAuthReadiness per-field runtime deferral', () => {
  const buildWeb = { ...productionWeb, stage: 'build' as const }

  test.each([
    ['client secret', { clientId: validGoogleClientId }],
    ['client ID', { clientSecret: validGoogleClientSecret }],
  ])('defers Google at build when only the %s is missing', (_label, credentials) => {
    const configuration = { google: { ...credentials, runtimeOnly: true } }
    const build = evaluateAuthReadiness({ ...buildWeb, authConfig: { methods: ['google'] }, configuration })
    const runtime = evaluateAuthReadiness({ ...productionWeb, authConfig: { methods: ['google'] }, configuration })

    expect(build.outcome).toBe('deferred')
    expect(build.deferredMethods).toEqual(['google'])
    expect(build.availableMethods).toEqual([])
    expect(diagnosticCodes(build)).toEqual(['GOOGLE_RUNTIME_VALIDATION_REQUIRED'])
    expect(runtime.outcome).toBe('invalid')
    expect(runtime.deferredMethods).toEqual([])
  })

  test.each([
    ['placeholder client ID', { clientId: 'your-google-client-id' }, 'GOOGLE_CLIENT_ID_PLACEHOLDER'],
    ['malformed client ID', { clientId: 'not-a-client-id' }, 'GOOGLE_CLIENT_ID_MALFORMED'],
    ['placeholder client secret', { clientSecret: 'your-google-client-secret' }, 'GOOGLE_CLIENT_SECRET_PLACEHOLDER'],
    ['malformed client secret', { clientSecret: 'short' }, 'GOOGLE_CLIENT_SECRET_MALFORMED'],
  ])('does not defer Google at build with a %s and the other half missing', (_label, credentials, code) => {
    const result = evaluateAuthReadiness({
      ...buildWeb,
      authConfig: { methods: ['google'] },
      configuration: { google: { ...credentials, runtimeOnly: true } },
    })

    expect(result.outcome).toBe('invalid')
    expect(result.deferredMethods).toEqual([])
    expect(diagnosticCodes(result)).toContain(code)
  })

  test('does not defer a present-but-missing Google half without runtimeOnly', () => {
    const result = evaluateAuthReadiness({
      ...buildWeb,
      authConfig: { methods: ['google'] },
      configuration: { google: { clientId: validGoogleClientId } },
    })

    expect(result.outcome).toBe('invalid')
    expect(diagnosticCodes(result)).toContain('GOOGLE_CLIENT_SECRET_MISSING')
  })

  test.each([
    ['resend', 'sender', { resendApiKey: validResendApiKey }],
    ['resend', 'API key', { resendFromEmail: 'auth@example.com' }],
    ['auto', 'sender', { resendApiKey: validResendApiKey }],
    ['auto', 'API key', { resendFromEmail: 'auth@example.com' }],
  ])('defers %s email at build when only the %s is missing', (provider, _label, credentials) => {
    const configuration = { email: { provider, ...credentials, runtimeOnly: true } }
    const build = evaluateAuthReadiness({ ...buildWeb, authConfig: { methods: ['email-otp'] }, configuration })
    const runtime = evaluateAuthReadiness({ ...productionWeb, authConfig: { methods: ['email-otp'] }, configuration })

    expect(build.outcome).toBe('deferred')
    expect(build.deferredMethods).toEqual(['email-otp'])
    expect(build.availableMethods).toEqual([])
    expect(diagnosticCodes(build)).toEqual(['EMAIL_RUNTIME_VALIDATION_REQUIRED'])
    expect(runtime.outcome).toBe('invalid')
    expect(runtime.deferredMethods).toEqual([])
  })

  test.each([
    ['placeholder API key', { resendApiKey: 're_xxxxxxxxxxxx' }, 'RESEND_API_KEY_PLACEHOLDER'],
    ['malformed API key', { resendApiKey: 'not-a-resend-key' }, 'RESEND_API_KEY_MALFORMED'],
    ['placeholder sender', { resendFromEmail: 'noreply@yourdomain.com' }, 'RESEND_FROM_EMAIL_PLACEHOLDER'],
    ['malformed sender', { resendFromEmail: 'not-an-email' }, 'RESEND_FROM_EMAIL_MALFORMED'],
  ])('does not defer email at build with a %s and the other half missing', (_label, credentials, code) => {
    const result = evaluateAuthReadiness({
      ...buildWeb,
      authConfig: { methods: ['email-otp'] },
      configuration: { email: { provider: 'resend', ...credentials, runtimeOnly: true } },
    })

    expect(result.outcome).toBe('invalid')
    expect(result.deferredMethods).toEqual([])
    expect(diagnosticCodes(result)).toContain(code)
  })

  test('keeps complete pairs available at build even when marked runtimeOnly', () => {
    const result = evaluateAuthReadiness({
      ...buildWeb,
      authConfig: { methods: ['email-otp', 'google'] },
      configuration: {
        email: {
          provider: 'resend',
          resendApiKey: validResendApiKey,
          resendFromEmail: 'auth@example.com',
          runtimeOnly: true,
        },
        google: { clientId: validGoogleClientId, clientSecret: validGoogleClientSecret, runtimeOnly: true },
      },
    })

    expect(result.outcome).toBe('ready')
    expect(result.availableMethods).toEqual(['email-otp', 'google'])
    expect(result.deferredMethods).toEqual([])
    expect(result.diagnostics).toEqual([])
  })

  test('keeps explicit console email invalid for a production build even when runtimeOnly', () => {
    const result = evaluateAuthReadiness({
      ...buildWeb,
      authConfig: { methods: ['email-otp'] },
      configuration: {
        email: { provider: 'console', resendFromEmail: 'auth@example.com', runtimeOnly: true },
      },
    })

    expect(result.outcome).toBe('invalid')
    expect(result.deferredMethods).toEqual([])
    expect(diagnosticCodes(result)).toContain('EMAIL_PROVIDER_DEVELOPMENT_ONLY')
  })
})

const validEmail = { provider: 'resend', resendApiKey: validResendApiKey, resendFromEmail: 'auth@example.com' }
const validGoogle = { clientId: validGoogleClientId, clientSecret: validGoogleClientSecret }

function severities(result: ReturnType<typeof evaluateAuthReadiness>) {
  return result.diagnostics.map((diagnostic) => diagnostic.severity)
}

describe('evaluateAuthReadiness availability contract', () => {
  test('is ready with one valid path and keeps the unavailable method as warnings', () => {
    const result = evaluateAuthReadiness({
      ...productionWeb,
      authConfig: { methods: ['email-otp', 'google'] },
      configuration: {
        email: validEmail,
        google: { clientId: 'your-google-client-id', clientSecret: 'your-google-client-secret' },
      },
    })

    expect(result.outcome).toBe('ready')
    expect(result.declaredMethods).toEqual(['email-otp', 'google'])
    expect(result.availableMethods).toEqual(['email-otp'])
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ method: 'google', code: 'GOOGLE_CLIENT_ID_PLACEHOLDER', severity: 'warning' }),
      expect.objectContaining({ method: 'google', code: 'GOOGLE_CLIENT_SECRET_PLACEHOLDER', severity: 'warning' }),
    ])
  })

  test('defers at build with one runtime-only path and an invalid other method, then fails at runtime', () => {
    const configuration = {
      email: { provider: 'resend', resendApiKey: 're_xxxxxxxxxxxx', resendFromEmail: 'auth@example.com' },
      google: { clientId: validGoogleClientId, runtimeOnly: true },
    }
    const build = evaluateAuthReadiness({
      ...productionWeb,
      stage: 'build',
      authConfig: { methods: ['email-otp', 'google'] },
      configuration,
    })
    const runtime = evaluateAuthReadiness({
      ...productionWeb,
      authConfig: { methods: ['email-otp', 'google'] },
      configuration,
    })

    expect(build.outcome).toBe('deferred')
    expect(build.availableMethods).toEqual([])
    expect(build.deferredMethods).toEqual(['google'])
    expect(diagnosticCodes(build)).toEqual(['RESEND_API_KEY_PLACEHOLDER', 'GOOGLE_RUNTIME_VALIDATION_REQUIRED'])
    expect(severities(build)).toEqual(['warning', 'warning'])

    expect(runtime.outcome).toBe('invalid')
    expect(runtime.deferredMethods).toEqual([])
    expect(diagnosticCodes(runtime)).toEqual([
      'RESEND_API_KEY_PLACEHOLDER',
      'GOOGLE_CLIENT_SECRET_MISSING',
      'AUTH_NO_AVAILABLE_METHOD',
    ])
    expect(severities(runtime).every((severity) => severity === 'error')).toBe(true)
  })

  test('is invalid with an overall error when every selected method is unavailable', () => {
    const result = evaluateAuthReadiness({
      ...productionWeb,
      authConfig: { methods: ['email-otp', 'google'] },
      configuration: {},
    })

    expect(result.outcome).toBe('invalid')
    expect(result.diagnostics.at(-1)).toEqual({
      method: 'auth',
      code: 'AUTH_NO_AVAILABLE_METHOD',
      severity: 'error',
      message: expect.stringContaining('No selected login method'),
    })
  })

  test('never reports ready or deferred with error-severity diagnostics', () => {
    const results = [
      evaluateAuthReadiness({
        ...productionWeb,
        authConfig: { methods: ['email-otp', 'google', 'email-password'] },
        configuration: { email: validEmail, google: { clientId: 'not-a-client-id' } },
      }),
      evaluateAuthReadiness({
        ...productionWeb,
        stage: 'build',
        authConfig: { methods: ['email-otp', 'google'] },
        configuration: { email: { provider: 'console' }, google: { runtimeOnly: true } },
      }),
    ]

    expect(results.map((result) => result.outcome)).toEqual(['ready', 'deferred'])
    for (const result of results) {
      expect(result.diagnostics.length).toBeGreaterThan(0)
      expect(severities(result)).not.toContain('error')
    }
  })

  test('does not evaluate disabled Google credentials or report it as available/deferred', () => {
    const result = evaluateAuthReadiness({
      ...productionWeb,
      stage: 'build',
      authConfig: { methods: ['email-otp', 'google'], providers: { google: { enabled: false } } },
      configuration: {
        email: validEmail,
        google: { clientId: 'your-google-client-id', runtimeOnly: true },
      },
    })

    expect(result.outcome).toBe('ready')
    expect(result.declaredMethods).toEqual(['email-otp', 'google'])
    expect(result.availableMethods).toEqual(['email-otp'])
    expect(result.deferredMethods).toEqual([])
    expect(result.diagnostics).toEqual([])
  })

  test('does not treat disabled email-password as available, deferred or an error', () => {
    const result = evaluateAuthReadiness({
      ...productionWeb,
      authConfig: { methods: ['email-password', 'google'], emailAndPassword: { enabled: false } },
      configuration: { email: validEmail, google: validGoogle },
    })

    expect(result.outcome).toBe('ready')
    expect(result.declaredMethods).toEqual(['email-password', 'google'])
    expect(result.availableMethods).toEqual(['google'])
    expect(result.deferredMethods).toEqual([])
    expect(result.diagnostics).toEqual([])
  })

  test('skips the email provider entirely when email-password is the only email method and is disabled', () => {
    const result = evaluateAuthReadiness({
      ...productionWeb,
      authConfig: { methods: ['email-password', 'google'], emailAndPassword: { enabled: false } },
      configuration: { email: { provider: 'console' }, google: validGoogle },
    })

    expect(result.outcome).toBe('ready')
    expect(result.diagnostics.some((diagnostic) => diagnostic.method === 'email')).toBe(false)
  })

  test('is invalid with an actionable error when every selected method is disabled', () => {
    const result = evaluateAuthReadiness({
      ...productionWeb,
      authConfig: {
        methods: ['email-password', 'google'],
        emailAndPassword: { enabled: false },
        providers: { google: { enabled: false } },
      },
      configuration: { email: validEmail, google: validGoogle },
    })

    expect(result.outcome).toBe('invalid')
    expect(result.declaredMethods).toEqual(['email-password', 'google'])
    expect(result.availableMethods).toEqual([])
    expect(result.deferredMethods).toEqual([])
    expect(result.diagnostics).toEqual([
      {
        method: 'auth',
        code: 'AUTH_ALL_METHODS_DISABLED',
        severity: 'error',
        message: expect.stringContaining('auth.methods'),
      },
    ])
  })
})

describe('evaluateAuthReadiness Resend sandbox sender', () => {
  test.each(['onboarding@resend.dev', 'Onboarding@Resend.DEV', '  auth@resend.dev '])(
    'rejects the %s sandbox sender for production',
    (resendFromEmail) => {
      const result = evaluateAuthReadiness({
        ...productionWeb,
        authConfig: { methods: ['email-otp'] },
        configuration: { email: { ...validEmail, resendFromEmail } },
      })

      expect(result.outcome).toBe('invalid')
      expect(result.availableMethods).toEqual([])
      expect(diagnosticCodes(result)).toEqual(['RESEND_FROM_EMAIL_SANDBOX', 'AUTH_NO_AVAILABLE_METHOD'])
      expect(result.diagnostics[0].message).toContain('verified')
      expect(JSON.stringify(result)).not.toContain(resendFromEmail.trim())
    }
  )

  test('does not defer a sandbox sender at build even when runtimeOnly', () => {
    const result = evaluateAuthReadiness({
      ...productionWeb,
      stage: 'build',
      authConfig: { methods: ['email-otp'] },
      configuration: { email: { provider: 'resend', resendFromEmail: 'onboarding@resend.dev', runtimeOnly: true } },
    })

    expect(result.outcome).toBe('invalid')
    expect(result.deferredMethods).toEqual([])
    expect(diagnosticCodes(result)).toContain('RESEND_FROM_EMAIL_SANDBOX')
  })

  test.each(['auth@notresend.dev', 'auth@resend.dev.example.com', 'resend.dev@example.com'])(
    'accepts the non-sandbox sender %s',
    (resendFromEmail) => {
      const result = evaluateAuthReadiness({
        ...productionWeb,
        authConfig: { methods: ['email-otp'] },
        configuration: { email: { ...validEmail, resendFromEmail } },
      })

      expect(result.outcome).toBe('ready')
      expect(result.diagnostics).toEqual([])
    }
  )

  test('allows the sandbox sender for development testing', () => {
    const result = evaluateAuthReadiness({
      ...productionWeb,
      environment: 'development',
      authConfig: { methods: ['email-otp'] },
      configuration: { email: { ...validEmail, resendFromEmail: 'onboarding@resend.dev' } },
    })

    expect(result.outcome).toBe('ready')
    expect(result.availableMethods).toEqual(['email-otp'])
    expect(result.diagnostics).toEqual([])
  })
})

describe('evaluateAuthReadiness EmailFactory provider parity', () => {
  test.each([undefined, ''])('treats the provider %p as auto', (provider) => {
    const result = evaluateAuthReadiness({
      ...productionWeb,
      authConfig: { methods: ['email-otp'] },
      configuration: { email: { ...validEmail, provider } },
    })

    expect(result.outcome).toBe('ready')
  })

  test.each(['smtp', 'Console', 'RESEND', ' resend', 'resend ', 'Auto', '   '])(
    'rejects the provider token %p instead of normalizing it',
    (provider) => {
      for (const environment of ['development', 'production'] as const) {
        const result = evaluateAuthReadiness({
          ...productionWeb,
          environment,
          authConfig: { methods: ['email-otp'] },
          configuration: { email: { ...validEmail, provider } },
        })

        expect(result.outcome).toBe('invalid')
        expect(diagnosticCodes(result)).toEqual(['EMAIL_PROVIDER_UNSUPPORTED', 'AUTH_NO_AVAILABLE_METHOD'])
        // The message is static, so the raw token is never echoed.
        expect(result.diagnostics[0].message).toBe(
          'EMAIL_PROVIDER must be exactly auto, resend or console (case- and whitespace-sensitive).'
        )
      }
    }
  )

  test('does not defer an unsupported provider token at build', () => {
    const result = evaluateAuthReadiness({
      ...productionWeb,
      stage: 'build',
      authConfig: { methods: ['email-otp'] },
      configuration: { email: { provider: 'Resend', runtimeOnly: true } },
    })

    expect(result.outcome).toBe('invalid')
    expect(result.deferredMethods).toEqual([])
  })

  const developmentOtp = {
    ...productionWeb,
    environment: 'development' as const,
    authConfig: { methods: ['email-otp' as const] },
  }

  test('selects console for auto in development when Resend is not forced', () => {
    const result = evaluateAuthReadiness({
      ...developmentOtp,
      configuration: { email: { provider: 'auto', resendApiKey: 're_xxxxxxxxxxxx', forceResendInDevelopment: false } },
    })

    expect(result.outcome).toBe('ready')
    expect(result.diagnostics).toEqual([])
  })

  test('falls back to console for forced auto in development when no API key is present', () => {
    const result = evaluateAuthReadiness({
      ...developmentOtp,
      configuration: { email: { provider: 'auto', forceResendInDevelopment: true } },
    })

    expect(result.outcome).toBe('ready')
    expect(result.availableMethods).toEqual(['email-otp'])
  })

  test('validates Resend for forced auto in development when a valid API key is present', () => {
    const result = evaluateAuthReadiness({
      ...developmentOtp,
      configuration: { email: { ...validEmail, provider: 'auto', forceResendInDevelopment: true } },
    })

    expect(result.outcome).toBe('ready')
    expect(result.diagnostics).toEqual([])
  })

  test.each([
    ['placeholder', 're_xxxxxxxxxxxx', 'RESEND_API_KEY_PLACEHOLDER'],
    ['malformed', 'not-a-resend-key', 'RESEND_API_KEY_MALFORMED'],
  ])('rejects a %s API key for forced auto in development', (_label, resendApiKey, code) => {
    const result = evaluateAuthReadiness({
      ...developmentOtp,
      configuration: {
        email: { provider: 'auto', resendApiKey, resendFromEmail: 'auth@example.com', forceResendInDevelopment: true },
      },
    })

    expect(result.outcome).toBe('invalid')
    expect(diagnosticCodes(result)).toEqual([code, 'AUTH_NO_AVAILABLE_METHOD'])
  })

  test('rejects a placeholder API key when Resend is selected explicitly in development', () => {
    const result = evaluateAuthReadiness({
      ...developmentOtp,
      configuration: { email: { ...validEmail, resendApiKey: 're_...' } },
    })

    expect(result.outcome).toBe('invalid')
    expect(diagnosticCodes(result)).toContain('RESEND_API_KEY_PLACEHOLDER')
  })

  test('keeps build-time runtimeOnly deferral for production auto with nothing configured', () => {
    const result = evaluateAuthReadiness({
      ...productionWeb,
      stage: 'build',
      authConfig: { methods: ['email-otp'] },
      configuration: { email: { provider: 'auto', runtimeOnly: true } },
    })

    expect(result.outcome).toBe('deferred')
    expect(diagnosticCodes(result)).toEqual(['EMAIL_RUNTIME_VALIDATION_REQUIRED'])
  })
})

describe('evaluateAuthReadiness purity', () => {
  const envKeys = ['NODE_ENV', 'EMAIL_PROVIDER', 'FORCE_RESEND_IN_DEV', 'RESEND_API_KEY', 'RESEND_FROM_EMAIL'] as const
  const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]))

  afterEach(() => {
    for (const key of envKeys) {
      if (originalEnv[key] === undefined) delete process.env[key]
      else process.env[key] = originalEnv[key]
    }
    jest.restoreAllMocks()
  })

  function deepFreeze<T>(value: T): T {
    if (value && typeof value === 'object') {
      Object.values(value).forEach(deepFreeze)
      Object.freeze(value)
    }
    return value
  }

  const input = () =>
    deepFreeze({
      ...productionWeb,
      environment: 'development' as const,
      authConfig: { methods: ['email-otp' as const, 'google' as const] },
      configuration: {
        email: { provider: 'auto', forceResendInDevelopment: false },
        google: { clientId: 'your-google-client-id', clientSecret: 'GOCSPX-super-secret-value' },
      },
    })

  test('ignores process.env, never logs and never mutates its input', () => {
    const logSpies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((level) =>
      jest.spyOn(console, level).mockImplementation(() => undefined)
    )
    const baseline = evaluateAuthReadiness(input())

    process.env.NODE_ENV = 'production'
    process.env.EMAIL_PROVIDER = 'resend'
    process.env.FORCE_RESEND_IN_DEV = 'true'
    process.env.RESEND_API_KEY = 're_xxxxxxxxxxxx'
    process.env.RESEND_FROM_EMAIL = 'onboarding@resend.dev'
    const withEnvironment = evaluateAuthReadiness(input())

    expect(baseline.outcome).toBe('ready')
    expect(baseline.availableMethods).toEqual(['email-otp'])
    expect(withEnvironment).toEqual(baseline)
    for (const spy of logSpies) expect(spy).not.toHaveBeenCalled()
  })

  test('never copies credential values into invalid results', () => {
    const secrets = {
      resendApiKey: 're_super_secret_but_short',
      resendFromEmail: 'leaky-sender@resend.dev',
      clientId: 'secret-client-id-not-google',
      clientSecret: 'x',
    }
    const result = evaluateAuthReadiness({
      ...productionWeb,
      authConfig: { methods: ['email-otp', 'google'] },
      configuration: {
        email: { provider: 'resend', resendApiKey: secrets.resendApiKey, resendFromEmail: secrets.resendFromEmail },
        google: { clientId: secrets.clientId, clientSecret: secrets.clientSecret, runtimeOnly: true },
      },
    })
    const serialized = JSON.stringify(result)

    expect(result.outcome).toBe('invalid')
    for (const secret of [secrets.resendApiKey, secrets.resendFromEmail, secrets.clientId]) {
      expect(serialized).not.toContain(secret)
    }
    expect(result.diagnostics.map((diagnostic) => diagnostic.message).join(' ')).not.toMatch(/leaky|super_secret/)
  })
})
