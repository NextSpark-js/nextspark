/**
 * Environment Setup Generator
 *
 * Generates and configures the .env file based on wizard responses.
 * Uses env.template file as the source for new .env files.
 */

import crypto from 'crypto'
import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'
import type { WizardConfig } from '../types.js'
import type { EnvSetupAnswers } from '../prompts/env-config.js'
import { showSuccess, showInfo, showWarning } from '../banner.js'

// Get the directory of this file (ESM compatible)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Path to the env template file
const ENV_TEMPLATE_PATH = path.resolve(__dirname, '../../../templates/env.template')

/**
 * Generate a secure random secret
 */
function generateSecret(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Read and process the env template file
 * Replaces placeholders with actual values
 */
async function processEnvTemplate(
  answers: EnvSetupAnswers,
  config: WizardConfig
): Promise<string> {
  // Read the template file
  const template = await fs.readFile(ENV_TEMPLATE_PATH, 'utf-8')

  // Prepare values
  const authSecret = answers.generateSecrets ? generateSecret() : 'your-secret-key-min-32-chars'
  const databaseUrl = answers.databaseUrl || 'postgresql://user:password@localhost:5432/nextspark'

  // Replace placeholders
  const content = template
    .replace(/\{\{PROJECT_NAME\}\}/g, config.projectName)
    .replace(/\{\{DATABASE_URL\}\}/g, databaseUrl)
    .replace(/\{\{BETTER_AUTH_SECRET\}\}/g, authSecret)
    .replace(/\{\{ACTIVE_THEME\}\}/g, config.projectSlug)

  return content
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
    content = updateEnvVar(content, 'BETTER_AUTH_SECRET', authSecret)
    showSuccess('Generated secure BETTER_AUTH_SECRET')
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
    content = updateEnvVar(content, 'BETTER_AUTH_SECRET', authSecret)
    showSuccess('Generated secure BETTER_AUTH_SECRET')
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
 * Create a default .env file from template when .env.example doesn't exist
 */
async function createDefaultEnv(
  envPath: string,
  answers: EnvSetupAnswers,
  config: WizardConfig
): Promise<void> {
  // Check if template exists
  if (!await fs.pathExists(ENV_TEMPLATE_PATH)) {
    showWarning('Template file not found, creating minimal .env')
    await createMinimalEnv(envPath, answers, config)
    return
  }

  // Process template and write to .env
  const content = await processEnvTemplate(answers, config)
  await fs.writeFile(envPath, content, 'utf-8')
  showSuccess('Created .env file from template')

  if (answers.generateSecrets) {
    showSuccess('Generated secure BETTER_AUTH_SECRET')
  }

  if (answers.databaseUrl) {
    showSuccess('Set DATABASE_URL')
  }
}

/**
 * Fallback: Create minimal .env file if template is not available
 */
async function createMinimalEnv(
  envPath: string,
  answers: EnvSetupAnswers,
  config: WizardConfig
): Promise<void> {
  const authSecret = answers.generateSecrets ? generateSecret() : 'your-secret-key-min-32-chars'
  const databaseUrl = answers.databaseUrl || 'postgresql://user:password@localhost:5432/nextspark'

  const content = `# NextSpark Environment Configuration
# Generated by NextSpark Wizard for: ${config.projectName}

DATABASE_URL=${databaseUrl}
BETTER_AUTH_SECRET=${authSecret}
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ACTIVE_THEME=${config.projectSlug}
`

  await fs.writeFile(envPath, content, 'utf-8')
  showSuccess('Created minimal .env file')
}
