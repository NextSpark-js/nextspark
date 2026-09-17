import pg from 'pg'
import { EventEmitter } from 'node:events'

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

/** True only for a syntactically valid URL which does not state an sslmode. */
export function prefersSSL(databaseUrl) {
  if (!databaseUrl) return false
  try {
    return !new URL(databaseUrl).searchParams.has('sslmode')
  } catch {
    // Keep malformed URLs on the runtime's conservative, documented policy.
    return false
  }
}

/**
 * The initial configuration for a script connection.
 *
 * A URL without sslmode has libpq's `prefer` semantics: first ask for TLS
 * without validating the certificate, and fall back only when Postgres says it
 * has no TLS support. `parseSSLConfig` intentionally remains the runtime's
 * policy; the distinct initial value here is what makes the scripts differ on
 * that one, documented case.
 */
export function scriptConnectionOptions(databaseUrl, options = {}) {
  return {
    ...options,
    connectionString: stripSSLParams(databaseUrl),
    ssl: prefersSSL(databaseUrl) ? { rejectUnauthorized: false } : parseSSLConfig(databaseUrl),
  }
}

const NO_SSL_SUPPORT = 'The server does not support SSL connections'

function isNoSSLSupport(error) {
  return error?.message === NO_SSL_SUPPORT
}

/**
 * A small Client facade for the only case where scripts deliberately differ
 * from the runtime: a URL with no sslmode. It preserves pg's Client surface
 * while swapping the first TLS-only connection for one without TLS only after
 * pg's precise "server does not support SSL" error. Every other failure is
 * returned unchanged.
 */
class SSLPreferClient extends EventEmitter {
  constructor(options) {
    super()
    this.options = options
    this.client = new pg.Client(options)
    this.eventsForwarded = false
  }

  get connection() { return this.client.connection }
  get connectionParameters() { return this.client.connectionParameters }
  get database() { return this.client.database }
  set database(value) { this.client.database = value }
  get processID() { return this.client.processID }
  get _queryable() { return this.client._queryable }
  get _ending() { return this.client._ending }

  forwardEvents() {
    if (this.eventsForwarded) return
    this.eventsForwarded = true
    // Pool relies on these two; the scripts use the underlying connection for
    // protocol events. Forwarding also keeps the normal pg error/end contract.
    for (const event of ['error', 'end', 'notice', 'notification']) {
      this.client.on(event, (...args) => this.emit(event, ...args))
    }
  }

  async connectPromise() {
    const startedAt = performance.now()
    try {
      await this.client.connect()
    } catch (error) {
      if (!isNoSSLSupport(error)) throw error

      // A retry shares, rather than resets, the connection time budget. This
      // matters for timeLimitedClient(), whose connectMs is a hard bound.
      const timeout = Number(this.options.connectionTimeoutMillis) || 0
      const elapsed = performance.now() - startedAt
      if (timeout > 0 && elapsed >= timeout) throw new Error('timeout expired')

      this.client = new pg.Client({
        ...this.options,
        ssl: false,
        ...(timeout > 0 ? { connectionTimeoutMillis: Math.max(1, Math.ceil(timeout - elapsed)) } : {}),
      })
      await this.client.connect()
    }
    this.forwardEvents()
  }

  connect(callback) {
    const promise = this.connectPromise()
    if (!callback) return promise
    promise.then(() => callback(null, this), callback)
  }

  query(...args) { return this.client.query(...args) }
  end(...args) { return this.client.end(...args) }
  ref() { return this.client.ref() }
  unref() { return this.client.unref() }
}

/** A Client with explicit modes unchanged, or libpq-style `prefer` otherwise. */
export function scriptClient(databaseUrl, options = {}) {
  const config = scriptConnectionOptions(databaseUrl, options)
  return prefersSSL(databaseUrl) ? new SSLPreferClient(config) : new pg.Client(config)
}

/** A Pool whose clients have the same `prefer` behavior as direct clients. */
export function scriptPool(databaseUrl, options = {}) {
  const config = scriptConnectionOptions(databaseUrl, options)
  return new pg.Pool({
    ...config,
    ...(prefersSSL(databaseUrl) ? { Client: SSLPreferClient } : {}),
  })
}
