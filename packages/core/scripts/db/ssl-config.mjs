/**
 * SSL handling for the database maintenance scripts.
 *
 * This deliberately mirrors `src/lib/db.ts` without importing application
 * runtime code: scripts run as standalone Node ESM programs while the runtime
 * remains bundled separately until its next release.
 */

/**
 * Strip SSL-related parameters so pg cannot override the explicit `ssl` option.
 * pg v8+ otherwise resolves `sslmode=require` as certificate validation.
 */
export function stripSSLParams(databaseUrl) {
  if (!databaseUrl) return databaseUrl
  try {
    const url = new URL(databaseUrl)
    url.searchParams.delete('sslmode')
    url.searchParams.delete('uselibpqcompat')
    return url.toString()
  } catch {
    return databaseUrl
      .replace(/[?&]sslmode=[^&]*/g, '')
      .replace(/[?&]uselibpqcompat=[^&]*/g, '')
      .replace(/\?&/, '?')
      .replace(/\?$/, '')
  }
}

/**
 * Parse the SSL policy used by database scripts.
 *
 * Explicit sslmode takes precedence. With no recognized mode, only production
 * uses validated TLS; all other environments use no TLS.
 */
export function parseSSLConfig(databaseUrl) {
  const isProduction = process.env.NODE_ENV === 'production'

  if (!databaseUrl) return isProduction ? { rejectUnauthorized: true } : false

  try {
    const url = new URL(databaseUrl)
    const sslmode = url.searchParams.get('sslmode')?.trim().toLowerCase()

    if (sslmode) {
      switch (sslmode) {
        case 'disable':
          if (isProduction) console.warn('[DB] WARNING: SSL disabled in production environment. This is insecure!')
          return false
        case 'require':
        case 'prefer':
        case 'allow':
          return { rejectUnauthorized: false }
        case 'verify-ca':
        case 'verify-full':
          return { rejectUnauthorized: true }
        default:
          console.warn(`[DB] Unknown sslmode value: "${sslmode}". Using environment defaults.`)
      }
    }

    return isProduction ? { rejectUnauthorized: true } : false
  } catch {
    if (databaseUrl.includes('sslmode=disable')) return false
    return isProduction ? { rejectUnauthorized: true } : false
  }
}
