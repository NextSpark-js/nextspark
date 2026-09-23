/**
 * Type definitions for nextspark.config.ts (project-level configuration).
 * This is separate from app.config.ts (application runtime configuration).
 *
 * @module core/lib/config/nextspark-types
 */

export interface NextSparkFeatureConfig {
  billing?: boolean
  teams?: boolean
  superadmin?: boolean
  aiChat?: boolean
}

export interface NextSparkTemplateOrigin {
  /** Install-once template name, retained only as upgrade-guide metadata. */
  name: string

  /** Framework/template version that originally scaffolded the project. */
  version: string
}

export interface NextSparkConfig {
  /**
   * Legacy 0.x theme selector. The root-first compiler does not read it; it is
   * retained so slice A does not change the existing config reader.
   */
  theme?: string

  /** Local plugin directory names under <projectRoot>/plugins. */
  plugins?: string[]

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
}

export interface ResolvedNextSparkConfig extends Omit<NextSparkConfig, 'plugins' | 'features'> {
  plugins: string[]
  features: Required<NextSparkFeatureConfig>
}

export type NextSparkConfigValidationResult =
  | { valid: true; errors: []; config: ResolvedNextSparkConfig }
  | { valid: false; errors: string[] }

const DEFAULT_FEATURES: Required<NextSparkFeatureConfig> = {
  billing: true,
  teams: true,
  superadmin: true,
  aiChat: true,
}

const ROOT_FIELDS = new Set([
  'theme',
  'plugins',
  'features',
  'template',
  'database',
  'auth',
  'app',
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
    errors.push(`plugins must be an array of local plugin directory names; received ${receivedType(value)}.`)
    return
  }

  const seen = new Set<string>()
  value.forEach((plugin, index) => {
    if (typeof plugin !== 'string' || plugin.trim() === '') {
      errors.push(`plugins[${index}] must be a non-empty string; received ${receivedType(plugin)}.`)
      return
    }
    if (plugin.includes('/') || plugin.includes('\\') || plugin === '.' || plugin === '..') {
      errors.push(`plugins[${index}] must be a directory name under <projectRoot>/plugins, not a path; received "${plugin}".`)
    }
    if (seen.has(plugin)) errors.push(`plugins contains duplicate local plugin "${plugin}".`)
    seen.add(plugin)
  })
}

function validateFeatures(value: unknown, errors: string[]): void {
  if (value === undefined) return
  if (!isRecord(value)) {
    errors.push(`features must be an object; received ${receivedType(value)}.`)
    return
  }
  validateKnownFields(value, Object.keys(DEFAULT_FEATURES), 'features.', errors)
  for (const field of Object.keys(DEFAULT_FEATURES)) {
    validateOptionalBoolean(value[field], `features.${field}`, errors)
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

/** Validate and normalize a nextspark.config.ts value without loading the file. */
export function validateNextSparkConfig(value: unknown): NextSparkConfigValidationResult {
  if (!isRecord(value)) {
    return {
      valid: false,
      errors: [`nextspark.config.ts must export an object; received ${receivedType(value)}.`],
    }
  }

  const errors: string[] = []
  for (const field of Object.keys(value)) {
    if (!ROOT_FIELDS.has(field)) errors.push(`${field} is not a supported nextspark.config.ts field.`)
  }

  validateOptionalString(value.theme, 'theme', errors)
  validatePlugins(value.plugins, errors)
  validateFeatures(value.features, errors)
  validateTemplate(value.template, errors)
  validateDatabase(value.database, errors)
  validateAuth(value.auth, errors)
  validateApp(value.app, errors)

  if (errors.length > 0) return { valid: false, errors }

  const config = value as NextSparkConfig
  return {
    valid: true,
    errors: [],
    config: {
      ...config,
      plugins: [...(config.plugins ?? [])],
      features: { ...DEFAULT_FEATURES, ...config.features },
    },
  }
}

/** Define configuration with TypeScript inference and editor completion. */
export function defineConfig(config: NextSparkConfig): NextSparkConfig {
  return config
}
