/**
 * NextSpark NPM Distribution Configuration Types
 *
 * Type definitions for nextspark.config.ts (project-level configuration)
 * This is separate from app.config.ts (application runtime configuration)
 *
 * @module core/lib/config/nextspark-types
 */

export interface NextSparkConfig {
  /** Active theme name */
  theme: string

  /** Enabled plugins */
  plugins?: string[]

  /** Feature flags */
  features?: {
    billing?: boolean
    teams?: boolean
    superadmin?: boolean
    aiChat?: boolean
  }

  /** Database configuration */
  database?: {
    provider: 'postgres' | 'mysql' | 'sqlite'
    runMigrations?: boolean
  }

  /** Auth configuration */
  auth?: {
    providers: ('email' | 'google' | 'github')[]
    requireEmailVerification?: boolean
  }

  /** App metadata */
  app?: {
    name?: string
    description?: string
  }
}

/**
 * Helper function to define configuration with TypeScript support
 */
export function defineConfig(config: NextSparkConfig): NextSparkConfig {
  return config
}
