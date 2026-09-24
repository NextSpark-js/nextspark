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
      config: {
        plugins: [],
        features: {
          billing: true,
          teams: true,
          superadmin: true,
          aiChat: true,
        },
      },
    })
  })

  it('accepts local plugin names, packaged plugin names, and template provenance for the project root', () => {
    const config = defineConfig({
      plugins: ['analytics', 'billing-local', '@nextsparkjs/plugin-langchain'],
      features: { aiChat: false },
      template: { name: 'crm', version: '0.1.0-beta.193' },
    })

    const result = validateNextSparkConfig(config)

    expect(result.valid).toBe(true)
    if (!result.valid) return
    expect(result.config.plugins).toEqual(['analytics', 'billing-local', '@nextsparkjs/plugin-langchain'])
    expect(result.config.features).toEqual({
      billing: true,
      teams: true,
      superadmin: true,
      aiChat: false,
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
})
