import {
  defineConfig,
  validateNextSparkConfig,
} from '@/core/lib/config'

describe('nextspark.config.ts source contract', () => {
  it('accepts the minimal root-first config and applies compiler defaults', () => {
    const result = validateNextSparkConfig({})

    expect(result).toEqual({
      valid: true,
      errors: [],
      warnings: [],
      config: {
        plugins: [],
        apiDir: 'api',
        features: {
          billing: true,
          superadmin: true,
        },
      },
    })
  })

  it('accepts features.teams with a warning, and leaves it out of the resolved config (#425)', () => {
    const result = validateNextSparkConfig({ features: { teams: false, billing: true } })

    expect(result.valid).toBe(true)
    if (!result.valid) return
    expect(result.config.features).toEqual({ billing: true, superadmin: true })
    expect(result.warnings).toEqual([expect.stringContaining("features.teams is not read and will be removed")])
    expect(result.warnings[0]).toContain("teams.mode: 'single-user'")
    expect(validateNextSparkConfig({ features: { teams: 'no' } })).toEqual({ valid: false, errors: ['features.teams must be a boolean; received string.'] })
  })

  it('accepts features.aiChat with a warning that points to the plugins, and leaves it out of the resolved config (#425)', () => {
    const result = validateNextSparkConfig({ features: { aiChat: false } })

    expect(result.valid).toBe(true)
    if (!result.valid) return
    expect(result.config.features).toEqual({ billing: true, superadmin: true })
    expect(result.warnings).toEqual([expect.stringContaining('features.aiChat is not read and will be removed: core has no AI chat')])
  })

  it('accepts local plugin names, packaged plugin names, and template provenance for the project root', () => {
    const config = defineConfig({
      plugins: ['analytics', 'billing-local', '@nextsparkjs/plugin-langchain'],
      features: { billing: false },
      template: { name: 'crm', version: '0.1.0-beta.193' },
    })

    const result = validateNextSparkConfig(config)

    expect(result.valid).toBe(true)
    if (!result.valid) return
    expect(result.config.plugins).toEqual(['analytics', 'billing-local', '@nextsparkjs/plugin-langchain'])
    expect(result.config.features).toEqual({
      billing: false,
      superadmin: true,
    })
    expect(result.config.template).toEqual({ name: 'crm', version: '0.1.0-beta.193' })
  })

  it.each([
    'apps/web',
    String.raw`C:\apps\web`,
  ])('rejects project selection, including %s', (root) => {
    const result = validateNextSparkConfig({ project: { root } })

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('project is not a supported nextspark.config.ts field.')
  })

  it('rejects plugin paths and duplicate plugin entries', () => {
    const result = validateNextSparkConfig({
      plugins: ['analytics', 'plugins/payments', String.raw`C:\plugins\payments`, 'analytics'],
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      'plugins[1] must be a directory name under <projectRoot>/plugins, not a path; received "plugins/payments".'
    )
    expect(result.errors).toContain(
      'plugins[2] must be a directory name under <projectRoot>/plugins, not a path; received "C:\\plugins\\payments".'
    )
    expect(result.errors).toContain('plugins contains duplicate entry "analytics".')
  })

  it('rejects an incomplete scoped package name', () => {
    const result = validateNextSparkConfig({ plugins: ['@nextsparkjs'] })

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('plugins[0] must be a complete scoped package name; received "@nextsparkjs".')
  })

  it('reports nested types and unknown fields by their config paths', () => {
    const result = validateNextSparkConfig({
      features: { billing: 'yes', unknownFeature: true },
      database: { provider: 'mongo' },
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(expect.arrayContaining([
      'features.billing must be a boolean; received string.',
      'features.unknownFeature is not supported.',
      'database.provider must be one of "postgres", "mysql", or "sqlite"; received "mongo".',
    ]))
  })

  it('keeps runtime-only fields valid without making them compiler defaults', () => {
    const result = validateNextSparkConfig({
      database: { provider: 'postgres', runMigrations: false },
      auth: { providers: ['email', 'google'], requireEmailVerification: true },
      app: { name: 'Example', description: 'Synthetic fixture' },
    })

    expect(result.valid).toBe(true)
    if (!result.valid) return
    expect(result.config.database).toEqual({ provider: 'postgres', runMigrations: false })
    expect(result.config.auth).toEqual({ providers: ['email', 'google'], requireEmailVerification: true })
    expect(result.config.app).toEqual({ name: 'Example', description: 'Synthetic fixture' })
  })

  it('rejects the legacy theme selector', () => {
    const result = validateNextSparkConfig({ theme: 'legacy-theme' })

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('theme is not a supported nextspark.config.ts field.')
  })

  it('accepts billing webhook extension modules, one path per provider', () => {
    const result = validateNextSparkConfig({
      billing: { webhookExtensions: { stripe: './lib/billing/stripe-webhook-extensions', polar: './lib/billing/polar-webhook-extensions', lemonsqueezy: './lib/billing/lemonsqueezy-webhook-extensions' } },
    })

    expect(result.valid).toBe(true)
    if (!result.valid) return
    expect(result.config.billing).toEqual({
      webhookExtensions: { stripe: './lib/billing/stripe-webhook-extensions', polar: './lib/billing/polar-webhook-extensions', lemonsqueezy: './lib/billing/lemonsqueezy-webhook-extensions' },
    })
    expect(validateNextSparkConfig({ billing: {} }).valid).toBe(true)
    expect(validateNextSparkConfig({ billing: { webhookExtensions: {} } }).valid).toBe(true)
  })

  it('rejects malformed billing settings, naming each', () => {
    const result = validateNextSparkConfig({
      billing: { webhookExtensions: { stripe: '', paypal: './x' }, other: true },
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(expect.arrayContaining([
      'billing.other is not supported.',
      'billing.webhookExtensions.paypal is not supported.',
      'billing.webhookExtensions.stripe must be a non-empty string; received string.',
    ]))
    expect(validateNextSparkConfig({ billing: 'stripe' })).toEqual({ valid: false, errors: ['billing must be an object; received string.'] })
    expect(validateNextSparkConfig({ billing: { webhookExtensions: ['./x'] } })).toEqual({
      valid: false,
      errors: ['billing.webhookExtensions must be an object; received array.'],
    })
  })
  it('accepts sitemap settings and keeps them', () => {
    const sitemap = { enabled: false, urls: ['/pricing', '/a/b'], exclude: ['/legal/*', '/draft'] }
    const result = validateNextSparkConfig({ sitemap })

    expect(result.valid).toBe(true)
    if (result.valid) expect(result.config.sitemap).toEqual(sitemap)
    expect(validateNextSparkConfig({ sitemap: {} }).valid).toBe(true)
  })

  it('accepts URL path characters, including & and percent-encoded bytes, and rejects empty, dot and encoded-dot segments and a trailing slash', () => {
    const valid = ['/', '/terms&conditions', '/a/b-c_d.e~f', "/it's", '/caf%C3%A9', '/a:b@c,d;e=f', '/x/%2Fy']
    expect(validateNextSparkConfig({ sitemap: { urls: valid } }).valid).toBe(true)
    const invalid = ['/a//b', '//a', '/a/./b', '/a/../b', '/%2e%2e/x', '/%2E/x', '/a/%2e', '/pricing/', '/a%', '/a%zz', '/a"b', '/a<b>', '/é', '/a|b', '/a\\b', '/a[b]']
    for (const entry of invalid) {
      const result = validateNextSparkConfig({ sitemap: { urls: [entry], exclude: [entry] } })
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.errors).toHaveLength(2)
    }
    expect(validateNextSparkConfig({ sitemap: { exclude: ['/legal/*', '/*'] } }).valid).toBe(true)
  })

  it('rejects malformed sitemap settings, naming each', () => {
    const result = validateNextSparkConfig({
      sitemap: { enabled: 'no', urls: ['pricing', '//evil.com', '/a?b=1', '/a b', '/x/../y', '/p*', 3, '/ok', '/ok'], exclude: ['/a*b', '/ok/*'], extra: 1 },
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual([
      'sitemap.extra is not supported.',
      'sitemap.enabled must be a boolean; received string.',
      'sitemap.urls[0] must be a path from the app root such as "/pricing" (URL path characters only: no query, fragment, spaces, empty or dot segments, or trailing "/"); received "pricing".',
      'sitemap.urls[1] must be a path from the app root such as "/pricing" (URL path characters only: no query, fragment, spaces, empty or dot segments, or trailing "/"); received "//evil.com".',
      'sitemap.urls[2] must be a path from the app root such as "/pricing" (URL path characters only: no query, fragment, spaces, empty or dot segments, or trailing "/"); received "/a?b=1".',
      'sitemap.urls[3] must be a path from the app root such as "/pricing" (URL path characters only: no query, fragment, spaces, empty or dot segments, or trailing "/"); received "/a b".',
      'sitemap.urls[4] must be a path from the app root such as "/pricing" (URL path characters only: no query, fragment, spaces, empty or dot segments, or trailing "/"); received "/x/../y".',
      'sitemap.urls[5] may not contain "*"; received "/p*".',
      'sitemap.urls[6] must be a path from the app root such as "/pricing" (URL path characters only: no query, fragment, spaces, empty or dot segments, or trailing "/"); received 3.',
      'sitemap.urls contains duplicate entry "/ok".',
      'sitemap.exclude[0] may only use "*" as the last character, to exclude a prefix such as "/legal/*"; received "/a*b".',
    ])
    expect(validateNextSparkConfig({ sitemap: 'on' })).toEqual({ valid: false, errors: ['sitemap must be an object; received string.'] })
    expect(validateNextSparkConfig({ sitemap: { urls: '/a' } })).toEqual({ valid: false, errors: ['sitemap.urls must be an array of paths; received string.'] })
  })

  it('takes apiDir as a relative directory of the project and refuses anything else', () => {
    const accepted = (value: unknown) => validateNextSparkConfig({ apiDir: value })
    for (const value of ['api', 'routes', 'server/api', 'my_routes/v2-api']) {
      expect(accepted(value)).toMatchObject({ valid: true, config: { apiDir: value } })
    }

    const shape = /apiDir must be a relative path inside the project/
    for (const value of ['', '/routes', 'routes/', 'a//b', '.', './routes', '..', '../routes', 'server/../routes', 'server\\api', 'C:/routes', '.hidden', '(group)', '[id]', 'with space']) {
      const result = accepted(value)
      expect(result.valid).toBe(false)
      expect(result.errors).toEqual([expect.stringMatching(shape)])
    }

    for (const value of ['node_modules', 'server/node_modules', 'server/node_modules/api', 'server/Node_Modules']) {
      const result = accepted(value)
      expect(result.valid).toBe(false)
      expect(result.errors).toEqual([expect.stringMatching(/apiDir cannot be inside a "node_modules\/" directory/)])
    }

    for (const value of ['app', 'pages', 'src', 'public', 'templates', 'plugins', 'lib/api', 'App', 'config/routes', 'about', 'contents', 'contents/api']) {
      const result = accepted(value)
      expect(result.valid).toBe(false)
      expect(result.errors).toEqual([expect.stringMatching(/apiDir cannot be inside/)])
    }

    for (const value of ['api/routes', 'API']) {
      const result = accepted(value)
      expect(result.valid).toBe(false)
      expect(result.errors).toEqual([expect.stringMatching(/apiDir cannot be a directory under "api\/"/)])
    }

    expect(accepted(3)).toEqual({ valid: false, errors: ['apiDir must be a string; received number.'] })
  })
})
