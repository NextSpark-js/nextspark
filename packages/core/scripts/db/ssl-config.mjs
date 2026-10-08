import pg from 'pg'
import { EventEmitter } from 'node:events'
import { isProduction } from './sample-data.mjs'

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

// On globalThis, like src/lib/db.ts: one warning per process however many copies of the module are loaded
const SSL_WARNED = Symbol.for('nextspark.dbSslDisabledWarned')

/** Once per process, and not for a loopback host: mirrors `warnSSLDisabledInProduction` in src/lib/db.ts. */
function warnSSLDisabledInProduction(url) {
  if (globalThis[SSL_WARNED]) return
  if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname.toLowerCase())) return
  globalThis[SSL_WARNED] = true
  console.warn('[DB] WARNING: SSL disabled in production environment. This is insecure!')
}

/**
 * Parse the SSL policy used by database scripts.
 *
 * Explicit sslmode takes precedence. With no recognized mode, only production
 * uses validated TLS; all other environments use no TLS. `isProduction`
 * defaults to the runtime's check; scriptSSL passes the scripts' own.
 */
export function parseSSLConfig(databaseUrl, isProduction = process.env.NODE_ENV === 'production') {

  if (!databaseUrl) return isProduction ? { rejectUnauthorized: true } : false

  try {
    const url = new URL(databaseUrl)
    const sslmode = url.searchParams.get('sslmode')?.trim().toLowerCase()

    if (sslmode) {
      switch (sslmode) {
        case 'disable':
          if (isProduction) warnSSLDisabledInProduction(url)
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

// What the project .env says NODE_ENV is, when the runner has read it (see setProjectEnv).
let projectNodeEnv

/**
 * The runner reads NODE_ENV from the project .env for the sample data; it hands
 * the same values here so that a production .env counts for SSL as well.
 */
export function setProjectEnv(fileEnv = {}) {
  projectNodeEnv = fileEnv.NODE_ENV
}

/** NODE_ENV is production in the process environment or the project .env, read as the runner reads it for the sample data. */
export function scriptsInProduction() {
  return [process.env.NODE_ENV, projectNodeEnv].some(isProduction)
}

/**
 * The one SSL decision for a script connection: the `ssl` option pg gets, and
 * whether a server that says it has no SSL is retried without it.
 *
 * An explicit sslmode means what it means to the application (parseSSLConfig),
 * with no retry; an empty or unknown one, or a malformed URL, gets
 * parseSSLConfig's environment default, with production as the scripts read it.
 * A URL without sslmode:
 * - in production, is what the application does there: SSL with a validated
 *   certificate, and no plaintext retry;
 * - elsewhere, has libpq's `prefer` semantics: SSL without validating the
 *   certificate, then plaintext only when Postgres says it has no SSL.
 */
export function scriptSSL(databaseUrl, production = scriptsInProduction()) {
  if (!prefersSSL(databaseUrl)) return { ssl: parseSSLConfig(databaseUrl, production), fallback: false }
  return production ? { ssl: { rejectUnauthorized: true }, fallback: false } : { ssl: { rejectUnauthorized: false }, fallback: true }
}

/** The initial configuration for a script connection. */
export function scriptConnectionOptions(databaseUrl, options = {}) {
  return {
    ...options,
    connectionString: stripSSLParams(databaseUrl),
    ssl: scriptSSL(databaseUrl).ssl,
  }
}

const NO_SSL_SUPPORT = 'The server does not support SSL connections'

/** Never names the URL: it holds the password. */
export const NO_SSL_IN_PRODUCTION =
  'The database server does not support SSL. With NODE_ENV=production, a database URL without sslmode ' +
  'connects only over SSL with a validated certificate, as the application does. For a server without SSL, ' +
  'such as a local PostgreSQL, add sslmode=disable to the URL; for a server with SSL, sslmode=verify-full ' +
  'states the validated connection explicitly.'

function isNoSSLSupport(error) {
  return error?.message === NO_SSL_SUPPORT
}

/**
 * A small Client facade for a URL with no sslmode. It preserves pg's Client
 * surface while swapping the first TLS-only connection for one without TLS only
 * after pg's precise "server does not support SSL" error. Every other failure
 * is returned unchanged.
 */
class SSLPreferClient extends EventEmitter {
  fallback = true

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
      if (!this.fallback) throw new Error(NO_SSL_IN_PRODUCTION, { cause: error })

      // A retry shares, rather than resets, the connection time budget. This
      // matters for timeLimitedClient(), whose connectMs is a hard bound.
      const timeout = Number(this.options.connectionTimeoutMillis) || 0
      const elapsed = performance.now() - startedAt
      if (timeout > 0 && elapsed >= timeout) throw new Error('timeout expired')

      // The facade exposes pg's live connection parameters. Callers such as
      // timeLimitedClient() deliberately update those after construction so a
      // connection string cannot disable their limits. Build the plaintext
      // retry from that live, resolved state (rather than re-parsing the URL),
      // or it would silently discard every such update.
      const { connectionString: _connectionString, ...options } = this.options
      this.client = new pg.Client({
        ...options,
        ...this.client.connectionParameters,
        password: this.client.password,
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

/** The same facade with no plaintext retry: pg's no-SSL error becomes one that says what to put in the URL. */
class SSLRequiredClient extends SSLPreferClient {
  fallback = false
}

/** The client class for a URL, as scriptSSL decides. */
function clientClass(databaseUrl) {
  if (!prefersSSL(databaseUrl)) return pg.Client
  return scriptSSL(databaseUrl).fallback ? SSLPreferClient : SSLRequiredClient
}

/** A Client with the SSL behaviour scriptSSL decides. */
export function scriptClient(databaseUrl, options = {}) {
  const Client = clientClass(databaseUrl)
  return new Client(scriptConnectionOptions(databaseUrl, options))
}

/** A Pool whose clients behave as direct script clients do. */
export function scriptPool(databaseUrl, options = {}) {
  return new pg.Pool({ ...scriptConnectionOptions(databaseUrl, options), Client: clientClass(databaseUrl) })
}
