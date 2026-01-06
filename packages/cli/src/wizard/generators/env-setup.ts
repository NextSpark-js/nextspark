/**
 * Environment Setup Generator
 *
 * Generates and configures the .env file based on wizard responses.
 */

import crypto from 'crypto'
import fs from 'fs-extra'
import path from 'path'
import type { WizardConfig } from '../types.js'
import type { EnvSetupAnswers } from '../prompts/env-config.js'
import { showSuccess, showInfo, showWarning } from '../banner.js'

/**
 * Generate a secure random secret
 */
function generateSecret(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Setup environment configuration for the project
 *
 * @param projectPath - Path to the project directory
 * @param answers - Environment setup answers from prompts
 * @param config - Full wizard configuration
 */
export async function setupEnvironment(
  projectPath: string,
  answers: EnvSetupAnswers,
  config: WizardConfig
): Promise<void> {
  if (!answers.setupEnv) {
    showInfo('Skipping .env setup')
    return
  }

  const envExamplePath = path.join(projectPath, '.env.example')
  const envPath = path.join(projectPath, '.env')

  // Check if .env.example exists
  if (!await fs.pathExists(envExamplePath)) {
    showWarning('.env.example not found, creating default .env file')
    await createDefaultEnv(envPath, answers, config)
    return
  }

  // Check if .env already exists
  if (await fs.pathExists(envPath)) {
    showWarning('.env already exists, updating existing file')
    await updateExistingEnv(envPath, answers, config)
    return
  }

  // Copy .env.example to .env
  await fs.copy(envExamplePath, envPath)
  showSuccess('Copied .env.example to .env')

  // Update the .env file with wizard values
  await updateEnvFile(envPath, answers, config)
}

/**
 * Update an existing .env file with new values
 */
async function updateExistingEnv(
  envPath: string,
  answers: EnvSetupAnswers,
  config: WizardConfig
): Promise<void> {
  let content = await fs.readFile(envPath, 'utf-8')

  // Update NEXT_PUBLIC_ACTIVE_THEME
  content = updateEnvVar(content, 'NEXT_PUBLIC_ACTIVE_THEME', config.projectSlug)
  showSuccess(`Set NEXT_PUBLIC_ACTIVE_THEME=${config.projectSlug}`)

  // Generate and set secrets if requested
  if (answers.generateSecrets) {
    const authSecret = generateSecret()
    const encryptionKey = generateSecret()

    content = updateEnvVar(content, 'AUTH_SECRET', authSecret)
    content = updateEnvVar(content, 'BETTER_AUTH_SECRET', authSecret)
    content = updateEnvVar(content, 'ENCRYPTION_KEY', encryptionKey)

    showSuccess('Generated secure AUTH_SECRET')
    showSuccess('Generated secure ENCRYPTION_KEY')
  }

  // Set DATABASE_URL if provided
  if (answers.databaseUrl) {
    content = updateEnvVar(content, 'DATABASE_URL', answers.databaseUrl)
    showSuccess('Set DATABASE_URL')
  }

  await fs.writeFile(envPath, content, 'utf-8')
}

/**
 * Update the .env file with wizard configuration values
 */
async function updateEnvFile(
  envPath: string,
  answers: EnvSetupAnswers,
  config: WizardConfig
): Promise<void> {
  let content = await fs.readFile(envPath, 'utf-8')

  // Update NEXT_PUBLIC_ACTIVE_THEME with project slug
  content = updateEnvVar(content, 'NEXT_PUBLIC_ACTIVE_THEME', config.projectSlug)
  showSuccess(`Set NEXT_PUBLIC_ACTIVE_THEME=${config.projectSlug}`)

  // Generate and set secrets if requested
  if (answers.generateSecrets) {
    const authSecret = generateSecret()
    const encryptionKey = generateSecret()

    // Try to update AUTH_SECRET or BETTER_AUTH_SECRET (depending on what's in the file)
    content = updateEnvVar(content, 'AUTH_SECRET', authSecret)
    content = updateEnvVar(content, 'BETTER_AUTH_SECRET', authSecret)
    content = updateEnvVar(content, 'ENCRYPTION_KEY', encryptionKey)

    showSuccess('Generated secure AUTH_SECRET')
    showSuccess('Generated secure ENCRYPTION_KEY')
  }

  // Set DATABASE_URL if provided
  if (answers.databaseUrl) {
    content = updateEnvVar(content, 'DATABASE_URL', answers.databaseUrl)
    showSuccess('Set DATABASE_URL')
  }

  await fs.writeFile(envPath, content, 'utf-8')
}

/**
 * Update or add an environment variable in content
 */
function updateEnvVar(content: string, key: string, value: string): string {
  // Pattern to match the env var (with or without quotes, commented or not)
  const pattern = new RegExp(`^(#?\\s*${key}\\s*=).*$`, 'm')

  if (pattern.test(content)) {
    // Update existing variable
    return content.replace(pattern, `${key}=${value}`)
  } else {
    // Add new variable at the end
    return content.trimEnd() + `\n${key}=${value}\n`
  }
}

/**
 * Create a default .env file when .env.example doesn't exist
 */
async function createDefaultEnv(
  envPath: string,
  answers: EnvSetupAnswers,
  config: WizardConfig
): Promise<void> {
  const authSecret = answers.generateSecrets ? generateSecret() : 'your-secret-key-min-32-chars'
  const encryptionKey = answers.generateSecrets ? generateSecret() : 'your-encryption-key-min-32-chars'
  const databaseUrl = answers.databaseUrl || 'postgresql://user:password@localhost:5432/nextspark'

  const content = `# NextSpark Environment Configuration
# Generated by NextSpark Wizard for: ${config.projectName}

# Database
DATABASE_URL=${databaseUrl}

# Authentication (Better Auth)
AUTH_SECRET=${authSecret}
BETTER_AUTH_SECRET=${authSecret}

# Encryption
ENCRYPTION_KEY=${encryptionKey}

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Active Theme
NEXT_PUBLIC_ACTIVE_THEME=${config.projectSlug}

# Email (Resend) - Optional
RESEND_API_KEY=
RESEND_FROM_EMAIL=

# Google OAuth - Optional
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Stripe - Optional
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
`

  await fs.writeFile(envPath, content, 'utf-8')
  showSuccess('Created .env file with default configuration')

  if (answers.generateSecrets) {
    showSuccess('Generated secure AUTH_SECRET')
    showSuccess('Generated secure ENCRYPTION_KEY')
  }

  if (answers.databaseUrl) {
    showSuccess('Set DATABASE_URL')
  }
}
