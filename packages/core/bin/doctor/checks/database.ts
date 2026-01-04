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
 * Check if DATABASE_URL is configured
 */
export async function checkDatabase(): Promise<HealthCheckResult> {
  const cwd = process.cwd()

  // Check .env file
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

  // Also check environment variable directly
  const databaseUrl = envVars['DATABASE_URL'] || process.env.DATABASE_URL

  // No .env files found
  if (!await fs.pathExists(envPath) && !await fs.pathExists(envLocalPath)) {
    return {
      name: 'Database',
      status: 'warn',
      message: 'No .env file found',
      fix: 'Copy .env.example to .env and configure DATABASE_URL',
    }
  }

  // DATABASE_URL not configured
  if (!databaseUrl) {
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
