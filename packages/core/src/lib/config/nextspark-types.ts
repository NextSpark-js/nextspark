/**
 * Type definitions for nextspark.config.ts (project-level configuration).
 * This is separate from app.config.ts (application runtime configuration).
 *
 * @module core/lib/config/nextspark-types
 */

export interface NextSparkFeatureConfig {
  billing?: boolean
  superadmin?: boolean
  aiChat?: boolean
  /**
   * @deprecated Not read, and it will be removed (#425): the data of every project is kept per team, so team support
   * cannot be left out. A project without team features sets `teams.mode: 'single-user'` in config/app.config.ts.
   */
  teams?: boolean
}

export interface NextSparkTemplateOrigin {
  /** Install-once template name, retained only as upgrade-guide metadata. */
  name: string

  /** Framework/template version that originally scaffolded the project. */
  version: string
}

export interface NextSparkConfig {
  /** Local plugin names or scoped package names resolved from the project. */
  plugins?: string[]

  /**
   * Directory of the project's Route Handlers, from the project root (`routes`, `server/api`). Default `api`.
   * Vercel also builds every file of a root `api/` as a function of its own; see docs/14-deployment/03-vercel-deployment.
   */
  apiDir?: string

  /** Compiler feature flags. Omitted flags default to true. */
  features?: NextSparkFeatureConfig

  /** Informational scaffold provenance; never an automatic update source. */
  template?: NextSparkTemplateOrigin

  /** Database configuration consumed outside the source compiler. */
  database?: {
    provider: 'postgres' | 'mysql' | 'sqlite'
    runMigrations?: boolean
  }

  /** Authentication configuration consumed outside the source compiler. */
  auth?: {
    providers: ('email' | 'google')[]
    requireEmailVerification?: boolean
  }

  /** Application metadata consumed outside the source compiler. */
  app?: {
    name?: string
    description?: string
  }

  /** /sitemap.xml and the `Sitemap:` line of /robots.txt, wired by the generated host (`nextspark prepare`). See docs/23-search-engine-optimization. */
  sitemap?: {
    /** `false` serves no sitemap and leaves robots.txt without the line. Default `true`. */
    enabled?: boolean
    /** Extra paths from the app root, such as `/pricing` (the base path is added). */
    urls?: string[]
    /** Paths left out: an exact path or a prefix ending in `*` (`/legal/*`). */
    exclude?: string[]
  }

  /** Billing hooks the generated host wires (`nextspark prepare`). */
  billing?: {
    /**
     * Modules extending core's billing webhooks, as paths from the project root. The generated host imports
     * each one statically into its webhook route: `stripe` must export `stripeWebhookExtensions`, `polar`
     * `polarWebhookExtensions` and `lemonsqueezy` `lemonsqueezyWebhookExtensions` (one-time payments: credit packs,
     * lifetime deals, upsells).
     */
    webhookExtensions?: {
      stripe?: string
      polar?: string
      lemonsqueezy?: string
    }
  }
}

/** The feature flags that are read: the deprecated ones are left out of the resolved config. */
export type ResolvedNextSparkFeatures = Required<Omit<NextSparkFeatureConfig, 'teams'>>

export interface ResolvedNextSparkConfig extends Omit<NextSparkConfig, 'plugins' | 'features' | 'apiDir'> {
  plugins: string[]
  features: ResolvedNextSparkFeatures
  apiDir: string
}

/** `warnings`: settings that are accepted but have no effect (a deprecated flag); the loaders print them. */
export type NextSparkConfigValidationResult =
  | { valid: true; errors: []; warnings: string[]; config: ResolvedNextSparkConfig }
  | { valid: false; errors: string[] }

const DEFAULT_FEATURES: ResolvedNextSparkFeatures = {
  billing: true,
  superadmin: true,
  aiChat: true,
}

/** Flags still accepted but not read (#425): the warning that says what to do instead. */
const DEPRECATED_FEATURES: Record<string, string> = {
  teams:
    "features.teams is not read and will be removed: the data of every project is kept per team, so team support cannot be left out. " +
    "A project without team features sets teams.mode: 'single-user' in config/app.config.ts. Delete the key.",
}

const DEFAULT_API_DIR = 'api'

/** Root directories with another owner (Next.js, the generated host, the project layout): `apiDir` cannot be, or live in, one of them. */
const RESERVED_API_DIRS = new Set([
  'app', 'pages', 'src', 'public', 'node_modules', 'dist', 'build', 'out',
  'templates', 'entities', 'config', 'blocks', 'components', 'hooks', 'lib', 'services', 'messages', 'styles',
  'emails', 'auth', 'plugins', 'migrations', 'scripts', 'tests', 'docs', 'about', 'contents',
])

const ROOT_FIELDS = new Set([
  'plugins',
  'apiDir',
  'features',
  'template',
  'database',
  'auth',
  'app',
  'billing',
  'sitemap',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function receivedType(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

function validateKnownFields(
  value: Record<string, unknown>,
  supported: readonly string[],
  prefix: string,
  errors: string[]
): void {
  const known = new Set(supported)
  for (const field of Object.keys(value)) {
    if (!known.has(field)) errors.push(`${prefix}${field} is not supported.`)
  }
}

function validateOptionalString(value: unknown, path: string, errors: string[]): void {
  if (value === undefined) return
  if (typeof value !== 'string' || value.trim() === '') {
    errors.push(`${path} must be a non-empty string; received ${receivedType(value)}.`)
  }
}

function validateOptionalBoolean(value: unknown, path: string, errors: string[]): void {
  if (value !== undefined && typeof value !== 'boolean') {
    errors.push(`${path} must be a boolean; received ${receivedType(value)}.`)
  }
}

function validatePlugins(value: unknown, errors: string[]): void {
  if (value === undefined) return
  if (!Array.isArray(value)) {
    errors.push(`plugins must be an array of local plugin names or scoped package names; received ${receivedType(value)}.`)
    return
  }

  const seen = new Set<string>()
  value.forEach((plugin, index) => {
    if (typeof plugin !== 'string' || plugin.trim() === '') {
      errors.push(`plugins[${index}] must be a non-empty string; received ${receivedType(plugin)}.`)
      return
    }
    const isScopedPackage = /^@[^/\\\s]+\/[^/\\\s]+$/.test(plugin)
    if (plugin.startsWith('@') && !isScopedPackage) {
      errors.push(`plugins[${index}] must be a complete scoped package name; received "${plugin}".`)
    } else if ((!isScopedPackage && (plugin.includes('/') || plugin.includes('\\'))) || plugin === '.' || plugin === '..') {
      errors.push(`plugins[${index}] must be a directory name under <projectRoot>/plugins, not a path; received "${plugin}".`)
    }
    if (seen.has(plugin)) errors.push(`plugins contains duplicate entry "${plugin}".`)
    seen.add(plugin)
  })
}

function validateFeatures(value: unknown, errors: string[], warnings: string[]): void {
  if (value === undefined) return
  if (!isRecord(value)) {
    errors.push(`features must be an object; received ${receivedType(value)}.`)
    return
  }
  const fields = [...Object.keys(DEFAULT_FEATURES), ...Object.keys(DEPRECATED_FEATURES)]
  validateKnownFields(value, fields, 'features.', errors)
  for (const field of fields) {
    validateOptionalBoolean(value[field], `features.${field}`, errors)
  }
  for (const [field, warning] of Object.entries(DEPRECATED_FEATURES)) {
    if (value[field] !== undefined) warnings.push(warning)
  }
}

function validateTemplate(value: unknown, errors: string[]): void {
  if (value === undefined) return
  if (!isRecord(value)) {
    errors.push(`template must be an object; received ${receivedType(value)}.`)
    return
  }
  validateKnownFields(value, ['name', 'version'], 'template.', errors)
  validateOptionalString(value.name, 'template.name', errors)
  validateOptionalString(value.version, 'template.version', errors)
  if (value.name === undefined) errors.push('template.name is required when template is present.')
  if (value.version === undefined) errors.push('template.version is required when template is present.')
}

function validateDatabase(value: unknown, errors: string[]): void {
  if (value === undefined) return
  if (!isRecord(value)) {
    errors.push(`database must be an object; received ${receivedType(value)}.`)
    return
  }
  validateKnownFields(value, ['provider', 'runMigrations'], 'database.', errors)
  if (!['postgres', 'mysql', 'sqlite'].includes(String(value.provider))) {
    errors.push(`database.provider must be one of "postgres", "mysql", or "sqlite"; received ${JSON.stringify(value.provider)}.`)
  }
  validateOptionalBoolean(value.runMigrations, 'database.runMigrations', errors)
}

function validateAuth(value: unknown, errors: string[]): void {
  if (value === undefined) return
  if (!isRecord(value)) {
    errors.push(`auth must be an object; received ${receivedType(value)}.`)
    return
  }
  validateKnownFields(value, ['providers', 'requireEmailVerification'], 'auth.', errors)
  if (!Array.isArray(value.providers)) {
    errors.push(`auth.providers must be an array; received ${receivedType(value.providers)}.`)
  } else {
    value.providers.forEach((provider, index) => {
      if (provider !== 'email' && provider !== 'google') {
        errors.push(`auth.providers[${index}] must be "email" or "google"; received ${JSON.stringify(provider)}.`)
      }
    })
  }
  validateOptionalBoolean(value.requireEmailVerification, 'auth.requireEmailVerification', errors)
}

function validateApp(value: unknown, errors: string[]): void {
  if (value === undefined) return
  if (!isRecord(value)) {
    errors.push(`app must be an object; received ${receivedType(value)}.`)
    return
  }
  validateKnownFields(value, ['name', 'description'], 'app.', errors)
  validateOptionalString(value.name, 'app.name', errors)
  validateOptionalString(value.description, 'app.description', errors)
}

/** URL path characters (RFC 3986 pchar and `/`); `%` only as a `%XX` triplet, `*` is checked apart. */
const URL_PATH = /^\/(?:[A-Za-z0-9\-._~!$&'()+,;=:@/]|%[0-9A-Fa-f]{2}|\*)*$/

/** A path of this app: from the root, URL path characters only, no empty or dot segment (`//`, `.`, `..`, `%2e`), no trailing `/` but `/`; `*` only as the last character when `wildcard`. */
function validateSitemapPaths(value: unknown, path: string, wildcard: boolean, errors: string[]): void {
  if (value === undefined) return
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array of paths; received ${receivedType(value)}.`)
    return
  }
  const seen = new Set<string>()
  value.forEach((entry, index) => {
    const where = `${path}[${index}]`
    const segments = typeof entry === 'string' ? entry.split('/').slice(1) : []
    if (
      typeof entry !== 'string' ||
      !URL_PATH.test(entry) ||
      (entry !== '/' && segments.some(segment => segment === '' || /^(?:\.|%2e){1,2}$/i.test(segment)))
    ) {
      errors.push(`${where} must be a path from the app root such as "/pricing" (URL path characters only: no query, fragment, spaces, empty or dot segments, or trailing "/"); received ${JSON.stringify(entry)}.`)
      return
    }
    if (!wildcard && entry.includes('*')) {
      errors.push(`${where} may not contain "*"; received ${JSON.stringify(entry)}.`)
    } else if (entry.slice(0, -1).includes('*')) {
      errors.push(`${where} may only use "*" as the last character, to exclude a prefix such as "/legal/*"; received ${JSON.stringify(entry)}.`)
    }
    if (seen.has(entry)) errors.push(`${path} contains duplicate entry "${entry}".`)
    seen.add(entry)
  })
}

function validateSitemap(value: unknown, errors: string[]): void {
  if (value === undefined) return
  if (!isRecord(value)) {
    errors.push(`sitemap must be an object; received ${receivedType(value)}.`)
    return
  }
  validateKnownFields(value, ['enabled', 'urls', 'exclude'], 'sitemap.', errors)
  validateOptionalBoolean(value.enabled, 'sitemap.enabled', errors)
  validateSitemapPaths(value.urls, 'sitemap.urls', false, errors)
  validateSitemapPaths(value.exclude, 'sitemap.exclude', true, errors)
}

function validateApiDir(value: unknown, errors: string[]): void {
  if (value === undefined || value === DEFAULT_API_DIR) return
  if (typeof value !== 'string') {
    errors.push(`apiDir must be a string; received ${receivedType(value)}.`)
    return
  }
  // Letters, digits, - and _ per segment: this also leaves out absolute paths, `.` and `..`, backslashes and Next's route syntax
  if (!/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(value)) {
    errors.push(`apiDir must be a relative path inside the project, such as "routes" or "server/api": segments of letters, digits, - and _ separated by /, with no leading or trailing slash, "." or "..". Received ${JSON.stringify(value)}.`)
    return
  }
  const segments = value.toLowerCase().split('/')
  const first = segments[0]
  // The route discovery does not look inside node_modules, at any depth
  if (segments.includes('node_modules')) {
    errors.push(`apiDir cannot be inside a "node_modules/" directory. Received ${JSON.stringify(value)}.`)
  } else if (RESERVED_API_DIRS.has(first)) {
    errors.push(`apiDir cannot be inside "${first}/", a project root directory with another use. Received ${JSON.stringify(value)}.`)
  } else if (first === DEFAULT_API_DIR) {
    errors.push(`apiDir cannot be a directory under "api/": Vercel builds everything under a root api/ as functions, which is what moving it avoids. Received ${JSON.stringify(value)}.`)
  }
}

function validateBilling(value: unknown, errors: string[]): void {
  if (value === undefined) return
  if (!isRecord(value)) {
    errors.push(`billing must be an object; received ${receivedType(value)}.`)
    return
  }
  validateKnownFields(value, ['webhookExtensions'], 'billing.', errors)
  const extensions = value.webhookExtensions
  if (extensions === undefined) return
  if (!isRecord(extensions)) {
    errors.push(`billing.webhookExtensions must be an object; received ${receivedType(extensions)}.`)
    return
  }
  validateKnownFields(extensions, ['stripe', 'polar', 'lemonsqueezy'], 'billing.webhookExtensions.', errors)
  validateOptionalString(extensions.stripe, 'billing.webhookExtensions.stripe', errors)
  validateOptionalString(extensions.polar, 'billing.webhookExtensions.polar', errors)
  validateOptionalString(extensions.lemonsqueezy, 'billing.webhookExtensions.lemonsqueezy', errors)
}

/** Validate and normalize a nextspark.config.ts value without loading the file. */
export function validateNextSparkConfig(value: unknown): NextSparkConfigValidationResult {
  if (!isRecord(value)) {
    return {
      valid: false,
      errors: [`nextspark.config.ts must export an object; received ${receivedType(value)}.`],
    }
  }

  const errors: string[] = []
  const warnings: string[] = []
  for (const field of Object.keys(value)) {
    if (!ROOT_FIELDS.has(field)) errors.push(`${field} is not a supported nextspark.config.ts field.`)
  }

  validatePlugins(value.plugins, errors)
  validateApiDir(value.apiDir, errors)
  validateFeatures(value.features, errors, warnings)
  validateTemplate(value.template, errors)
  validateDatabase(value.database, errors)
  validateAuth(value.auth, errors)
  validateApp(value.app, errors)
  validateBilling(value.billing, errors)
  validateSitemap(value.sitemap, errors)

  if (errors.length > 0) return { valid: false, errors }

  const config = value as NextSparkConfig
  const features = Object.fromEntries(
    Object.entries(DEFAULT_FEATURES).map(([field, fallback]) => [field, config.features?.[field as keyof ResolvedNextSparkFeatures] ?? fallback]),
  ) as ResolvedNextSparkFeatures
  return {
    valid: true,
    errors: [],
    warnings,
    config: {
      ...config,
      plugins: [...(config.plugins ?? [])],
      apiDir: config.apiDir ?? DEFAULT_API_DIR,
      features,
    },
  }
}

/** Define configuration with TypeScript inference and editor completion. */
export function defineConfig(config: NextSparkConfig): NextSparkConfig {
  return config
}
