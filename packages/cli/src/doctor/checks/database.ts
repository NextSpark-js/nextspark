/**
 * Database Health Check
 *
 * Verifies that DATABASE_URL is configured in the environment.
 */

import fs from 'fs-extra'
import path from 'path'
import type { HealthCheckResult } from '../index.js'

/**
 * Parse a .env file and return key-value pairs
 */
function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {}
  const lines = content.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    // Parse key=value
    const equalsIndex = trimmed.indexOf('=')
    if (equalsIndex > 0) {
      const key = trimmed.substring(0, equalsIndex).trim()
      let value = trimmed.substring(equalsIndex + 1).trim()

      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }

      result[key] = value
    }
  }

  return result
}

/**
 * The variables of the project's .env.local and .env (.env.local first)
 */
export async function readProjectEnv(cwd = process.cwd()): Promise<Record<string, string>> {
  const envPath = path.join(cwd, '.env')
  const envLocalPath = path.join(cwd, '.env.local')

  let envVars: Record<string, string> = {}

  // Try to read .env.local first (has priority)
  if (await fs.pathExists(envLocalPath)) {
    try {
      const content = await fs.readFile(envLocalPath, 'utf-8')
      envVars = { ...envVars, ...parseEnvFile(content) }
    } catch {
      // Ignore read errors
    }
  }

  // Then read .env
  if (await fs.pathExists(envPath)) {
    try {
      const content = await fs.readFile(envPath, 'utf-8')
      envVars = { ...envVars, ...parseEnvFile(content) }
    } catch {
      // Ignore read errors
    }
  }

  return envVars
}

/**
 * The DATABASE_URL db:migrate would use: an exported one beats the project's .env files.
 */
export async function resolveDatabaseUrl(cwd = process.cwd(), processEnv: NodeJS.ProcessEnv = process.env): Promise<string | undefined> {
  return processEnv.DATABASE_URL || (await readProjectEnv(cwd))['DATABASE_URL'] || undefined
}

/**
 * Check if DATABASE_URL is configured
 */
export async function checkDatabase(): Promise<HealthCheckResult> {
  const cwd = process.cwd()
  const envPath = path.join(cwd, '.env')
  const envLocalPath = path.join(cwd, '.env.local')

  // The same precedence as db:migrate: the exported variable first, then the .env files
  const databaseUrl = await resolveDatabaseUrl(cwd)

  // DATABASE_URL not configured: with no .env file either, the file is what to create (an exported variable needs none)
  if (!databaseUrl) {
    if (!await fs.pathExists(envPath) && !await fs.pathExists(envLocalPath)) {
      return {
        name: 'Database',
        status: 'warn',
        message: 'No .env file found',
        fix: 'Copy .env.example to .env and configure DATABASE_URL',
      }
    }
    return {
      name: 'Database',
      status: 'warn',
      message: 'DATABASE_URL not configured',
      fix: 'Add DATABASE_URL to .env',
    }
  }

  // DATABASE_URL is a placeholder
  if (databaseUrl.includes('your-') ||
      databaseUrl.includes('example') ||
      databaseUrl.includes('placeholder') ||
      databaseUrl === 'postgresql://') {
    return {
      name: 'Database',
      status: 'warn',
      message: 'DATABASE_URL appears to be a placeholder',
      fix: 'Update DATABASE_URL in .env with your actual database connection string',
    }
  }

  // Check if it looks like a valid connection string
  const isValidFormat = databaseUrl.startsWith('postgresql://') ||
                        databaseUrl.startsWith('postgres://') ||
                        databaseUrl.startsWith('mysql://') ||
                        databaseUrl.startsWith('sqlite:')

  if (!isValidFormat) {
    return {
      name: 'Database',
      status: 'warn',
      message: 'DATABASE_URL format may be invalid',
      fix: 'Ensure DATABASE_URL is a valid database connection string',
    }
  }

  return {
    name: 'Database',
    status: 'pass',
    message: 'DATABASE_URL configured',
  }
}
