/**
 * Unit tests for cors.ts
 *
 * Tests the CORS configuration helper including:
 * - Environment normalization
 * - Origin merging from multiple sources
 * - Deduplication
 * - Debug logging
 */

import { getCorsOrigins, normalizeCorsEnvironment, type CorsEnvironment } from '@/core/lib/utils/cors'
import type { ApplicationConfig } from '@/core/lib/config/config-types'

// =============================================================================
// TEST FIXTURES
// =============================================================================

/**
 * Mock ApplicationConfig for testing
 */
const createMockConfig = (overrides?: Partial<ApplicationConfig['api']['cors']>): ApplicationConfig => ({
  i18n: {
    supportedLocales: ['en'],
    defaultLocale: 'en',
    detectionStrategy: ['default'],
    cookie: {
      name: 'locale',
      maxAge: 365 * 24 * 60 * 60 * 1000,
      httpOnly: false,
      secure: 'auto',
      sameSite: 'lax',
      path: '/',
    },
    namespaces: ['common'],
    performance: {
      lazyLoadNamespaces: false,
      preloadCriticalNamespaces: ['common'],
      enableFallbackChaining: true,
    },
  },
  app: {
    name: 'Test App',
    version: '1.0.0',
    description: 'Test Application',
    contact: {
      email: 'test@test.com',
      website: 'https://test.com',
      documentation: 'https://docs.test.com',
    },
  },
  userRoles: {
    defaultRole: 'member',
    availableRoles: ['member', 'admin'],
    hierarchy: { admin: 0, member: 1 },
    displayNames: { member: 'Member', admin: 'Admin' },
  },
  features: {
    enableAnalytics: false,
    enableNotifications: false,
    enableBilling: false,
    enableTeamFeatures: false,
    enableAdvancedSecurity: false,
    enableAPIAccess: true,
  },
  api: {
    cors: {
      allowedOrigins: {
        development: ['http://localhost:3000', 'http://localhost:5173'],
        production: ['https://app.example.com'],
      },
      allowAllOrigins: {
        development: true,
        production: false,
      },
      ...overrides,
    },
  },
  ui: {
    theme: { defaultMode: 'system', allowUserToggle: true },
    notifications: { position: 'top-right', maxVisible: 5, autoHideDuration: 5000 },
  },
  environments: {
    development: {
      enableDebugLogs: true,
      enableTranslationDebugging: true,
      strictTypeChecking: true,
      enablePerformanceMonitoring: false,
    },
    production: {
      enableDebugLogs: false,
      enableTranslationDebugging: false,
      strictTypeChecking: true,
      enablePerformanceMonitoring: true,
    },
  },
})

// =============================================================================
// DESCRIBE: Environment Normalization
// =============================================================================

describe('normalizeCorsEnvironment', () => {
  it('should return "development" for development environment', () => {
    expect(normalizeCorsEnvironment('development')).toBe('development')
  })

  it('should return "production" for production environment', () => {
    expect(normalizeCorsEnvironment('production')).toBe('production')
  })

  it('should return "development" for staging environment', () => {
    expect(normalizeCorsEnvironment('staging')).toBe('development')
  })

  it('should return "development" for qa environment', () => {
    expect(normalizeCorsEnvironment('qa')).toBe('development')
  })

  it('should be case insensitive', () => {
    expect(normalizeCorsEnvironment('PRODUCTION')).toBe('production')
    expect(normalizeCorsEnvironment('Development')).toBe('development')
    expect(normalizeCorsEnvironment('STAGING')).toBe('development')
    expect(normalizeCorsEnvironment('QA')).toBe('development')
  })

  it('should return "development" for unknown environments', () => {
    expect(normalizeCorsEnvironment('unknown')).toBe('development')
    expect(normalizeCorsEnvironment('test')).toBe('development')
    expect(normalizeCorsEnvironment('')).toBe('development')
  })
})

// =============================================================================
// DESCRIBE: getCorsOrigins - Basic Functionality
// =============================================================================

describe('getCorsOrigins - Basic Functionality', () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Reset environment variables before each test
    process.env = { ...originalEnv }
    delete process.env.NEXT_PUBLIC_APP_URL
    delete process.env.BETTER_AUTH_URL
    delete process.env.CORS_ADDITIONAL_ORIGINS
    delete process.env.NEXTSPARK_DEBUG_CORS
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('should return core allowed origins for development', () => {
    const config = createMockConfig()
    const origins = getCorsOrigins(config, 'development')

    expect(origins).toContain('http://localhost:3000')
    expect(origins).toContain('http://localhost:5173')
  })

  it('should return core allowed origins for production', () => {
    const config = createMockConfig()
    const origins = getCorsOrigins(config, 'production')

    expect(origins).toContain('https://app.example.com')
    expect(origins).not.toContain('http://localhost:3000')
  })

  it('should use development origins for staging', () => {
    const config = createMockConfig()
    const origins = getCorsOrigins(config, 'staging')

    expect(origins).toContain('http://localhost:3000')
    expect(origins).toContain('http://localhost:5173')
  })

  it('should use development origins for qa', () => {
    const config = createMockConfig()
    const origins = getCorsOrigins(config, 'qa')

    expect(origins).toContain('http://localhost:3000')
    expect(origins).toContain('http://localhost:5173')
  })

  it('should default to development when no env specified', () => {
    const config = createMockConfig()
    delete process.env.NODE_ENV
    const origins = getCorsOrigins(config)

    expect(origins).toContain('http://localhost:3000')
  })
})

// =============================================================================
// DESCRIBE: getCorsOrigins - Source Merging
// =============================================================================

describe('getCorsOrigins - Source Merging', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.NEXT_PUBLIC_APP_URL
    delete process.env.BETTER_AUTH_URL
    delete process.env.CORS_ADDITIONAL_ORIGINS
    delete process.env.NEXTSPARK_DEBUG_CORS
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('should include NEXT_PUBLIC_APP_URL when set', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://myapp.com'
    const config = createMockConfig()
    const origins = getCorsOrigins(config, 'development')

    expect(origins).toContain('https://myapp.com')
  })

  it('should include BETTER_AUTH_URL when set and different from APP_URL', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://myapp.com'
    process.env.BETTER_AUTH_URL = 'https://auth.myapp.com'
    const config = createMockConfig()
    const origins = getCorsOrigins(config, 'development')

    expect(origins).toContain('https://myapp.com')
    expect(origins).toContain('https://auth.myapp.com')
  })

  it('should NOT duplicate BETTER_AUTH_URL when same as APP_URL', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://myapp.com'
    process.env.BETTER_AUTH_URL = 'https://myapp.com'
    const config = createMockConfig()
    const origins = getCorsOrigins(config, 'development')

    const appUrlCount = origins.filter(o => o === 'https://myapp.com').length
    expect(appUrlCount).toBe(1)
  })

  it('should include additionalOrigins from theme config', () => {
    const config = createMockConfig({
      additionalOrigins: {
        development: ['http://localhost:8081', 'http://localhost:4200'],
        production: ['https://mobile.example.com'],
      },
    })

    const devOrigins = getCorsOrigins(config, 'development')
    expect(devOrigins).toContain('http://localhost:8081')
    expect(devOrigins).toContain('http://localhost:4200')

    const prodOrigins = getCorsOrigins(config, 'production')
    expect(prodOrigins).toContain('https://mobile.example.com')
    expect(prodOrigins).not.toContain('http://localhost:8081')
  })

  it('should include CORS_ADDITIONAL_ORIGINS from env var', () => {
    process.env.CORS_ADDITIONAL_ORIGINS = 'https://extra1.com,https://extra2.com'
    const config = createMockConfig()
    const origins = getCorsOrigins(config, 'development')

    expect(origins).toContain('https://extra1.com')
    expect(origins).toContain('https://extra2.com')
  })

  it('should handle CORS_ADDITIONAL_ORIGINS with spaces', () => {
    process.env.CORS_ADDITIONAL_ORIGINS = ' https://extra1.com , https://extra2.com '
    const config = createMockConfig()
    const origins = getCorsOrigins(config, 'development')

    expect(origins).toContain('https://extra1.com')
    expect(origins).toContain('https://extra2.com')
  })

  it('should filter empty values from CORS_ADDITIONAL_ORIGINS', () => {
    process.env.CORS_ADDITIONAL_ORIGINS = 'https://extra1.com,,https://extra2.com,'
    const config = createMockConfig()
    const origins = getCorsOrigins(config, 'development')

    expect(origins).toContain('https://extra1.com')
    expect(origins).toContain('https://extra2.com')
    expect(origins).not.toContain('')
  })

  it('should merge all sources together', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://myapp.com'
    process.env.CORS_ADDITIONAL_ORIGINS = 'https://env-extra.com'

    const config = createMockConfig({
      additionalOrigins: {
        development: ['http://localhost:8081'],
      },
    })

    const origins = getCorsOrigins(config, 'development')

    // Base URLs
    expect(origins).toContain('https://myapp.com')
    // Core origins
    expect(origins).toContain('http://localhost:3000')
    expect(origins).toContain('http://localhost:5173')
    // Theme additional origins
    expect(origins).toContain('http://localhost:8081')
    // Env var origins
    expect(origins).toContain('https://env-extra.com')
  })
})

// =============================================================================
// DESCRIBE: getCorsOrigins - Deduplication
// =============================================================================

describe('getCorsOrigins - Deduplication', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.NEXT_PUBLIC_APP_URL
    delete process.env.BETTER_AUTH_URL
    delete process.env.CORS_ADDITIONAL_ORIGINS
    delete process.env.NEXTSPARK_DEBUG_CORS
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('should deduplicate origins from multiple sources', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
    process.env.CORS_ADDITIONAL_ORIGINS = 'http://localhost:3000,http://localhost:5173'

    const config = createMockConfig({
      additionalOrigins: {
        development: ['http://localhost:3000'],
      },
    })

    const origins = getCorsOrigins(config, 'development')

    // Should only appear once despite being in multiple sources
    const localhost3000Count = origins.filter(o => o === 'http://localhost:3000').length
    expect(localhost3000Count).toBe(1)
  })

  it('should return unique origins only', () => {
    const config = createMockConfig()
    const origins = getCorsOrigins(config, 'development')

    const uniqueOrigins = [...new Set(origins)]
    expect(origins.length).toBe(uniqueOrigins.length)
  })
})

// =============================================================================
// DESCRIBE: getCorsOrigins - Edge Cases
// =============================================================================

describe('getCorsOrigins - Edge Cases', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.NEXT_PUBLIC_APP_URL
    delete process.env.BETTER_AUTH_URL
    delete process.env.CORS_ADDITIONAL_ORIGINS
    delete process.env.NEXTSPARK_DEBUG_CORS
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('should handle missing allowedOrigins for environment', () => {
    const config = createMockConfig({
      allowedOrigins: {
        development: ['http://localhost:3000'],
        production: [], // Empty array
      },
    })

    const origins = getCorsOrigins(config, 'production')
    expect(Array.isArray(origins)).toBe(true)
    expect(origins).not.toContain('http://localhost:3000')
  })

  it('should handle missing additionalOrigins', () => {
    const config = createMockConfig()
    // additionalOrigins is undefined by default in createMockConfig
    const origins = getCorsOrigins(config, 'development')

    expect(Array.isArray(origins)).toBe(true)
    expect(origins).toContain('http://localhost:3000')
  })

  it('should handle missing additionalOrigins for specific environment', () => {
    const config = createMockConfig({
      additionalOrigins: {
        development: ['http://localhost:8081'],
        // production not defined
      },
    })

    const origins = getCorsOrigins(config, 'production')
    expect(origins).not.toContain('http://localhost:8081')
  })

  it('should handle empty CORS_ADDITIONAL_ORIGINS', () => {
    process.env.CORS_ADDITIONAL_ORIGINS = ''
    const config = createMockConfig()
    const origins = getCorsOrigins(config, 'development')

    expect(Array.isArray(origins)).toBe(true)
    expect(origins).not.toContain('')
  })

  it('should return empty array when no origins configured', () => {
    const config = createMockConfig({
      allowedOrigins: {
        development: [],
        production: [],
      },
    })

    const origins = getCorsOrigins(config, 'development')
    expect(Array.isArray(origins)).toBe(true)
  })
})

// =============================================================================
// DESCRIBE: getCorsOrigins - Debug Logging
// =============================================================================

describe('getCorsOrigins - Debug Logging', () => {
  const originalEnv = process.env
  let consoleLogSpy: jest.SpyInstance

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.NEXT_PUBLIC_APP_URL
    delete process.env.BETTER_AUTH_URL
    delete process.env.CORS_ADDITIONAL_ORIGINS
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('should NOT log when NEXTSPARK_DEBUG_CORS is not set', () => {
    delete process.env.NEXTSPARK_DEBUG_CORS
    const config = createMockConfig()
    getCorsOrigins(config, 'development')

    expect(consoleLogSpy).not.toHaveBeenCalled()
  })

  it('should NOT log when NEXTSPARK_DEBUG_CORS is false', () => {
    process.env.NEXTSPARK_DEBUG_CORS = 'false'
    const config = createMockConfig()
    getCorsOrigins(config, 'development')

    expect(consoleLogSpy).not.toHaveBeenCalled()
  })

  it('should log when NEXTSPARK_DEBUG_CORS is true', () => {
    process.env.NEXTSPARK_DEBUG_CORS = 'true'
    const config = createMockConfig()
    getCorsOrigins(config, 'development')

    expect(consoleLogSpy).toHaveBeenCalled()
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('[cors]')
    )
  })

  it('should log environment normalization when debugging', () => {
    process.env.NEXTSPARK_DEBUG_CORS = 'true'
    const config = createMockConfig()
    getCorsOrigins(config, 'staging')

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Environment: staging -> normalized: development')
    )
  })

  it('should log merged origins count when debugging', () => {
    process.env.NEXTSPARK_DEBUG_CORS = 'true'
    const config = createMockConfig()
    getCorsOrigins(config, 'development')

    // console.log is called with two arguments: string message and array
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Merged origins'),
      expect.any(Array)
    )
  })

  it('should log breakdown of origin sources when debugging', () => {
    process.env.NEXTSPARK_DEBUG_CORS = 'true'
    const config = createMockConfig()
    getCorsOrigins(config, 'development')

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Core origins')
    )
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Theme origins')
    )
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Env origins')
    )
  })
})

// =============================================================================
// DESCRIBE: Type Exports
// =============================================================================

describe('Type Exports', () => {
  it('should export CorsEnvironment type', () => {
    // This test verifies the type is exported and usable
    const env: CorsEnvironment = 'development'
    expect(env).toBe('development')

    const validEnvs: CorsEnvironment[] = ['development', 'production', 'staging', 'qa']
    expect(validEnvs).toHaveLength(4)
  })
})
