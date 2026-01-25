/**
 * Environment Configuration Prompts
 *
 * Collects environment setup preferences for the project.
 */

import { confirm, input } from '@inquirer/prompts'
import { showSection, showInfo } from '../banner.js'

/**
 * Environment setup answers from prompts
 */
export interface EnvSetupAnswers {
  setupEnv: boolean
  generateSecrets: boolean
  databaseUrl?: string
}

/**
 * Get default environment setup answers
 */
export function getDefaultEnvSetupAnswers(): EnvSetupAnswers {
  return {
    setupEnv: true,
    generateSecrets: true,
    databaseUrl: undefined,
  }
}

/**
 * Run environment configuration prompts
 */
export async function promptEnvSetup(): Promise<EnvSetupAnswers> {
  showSection('Environment Setup', 9, 9)

  showInfo('Configure your environment variables.')
  showInfo('This will create a .env file based on .env.example.')
  console.log('')

  // Ask if user wants to set up .env
  const setupEnv = await confirm({
    message: 'Would you like to configure .env file?',
    default: true,
  })

  if (!setupEnv) {
    return {
      setupEnv: false,
      generateSecrets: false,
      databaseUrl: undefined,
    }
  }

  console.log('')

  // Ask if user wants to generate secrets
  const generateSecrets = await confirm({
    message: 'Generate secure BETTER_AUTH_SECRET automatically?',
    default: true,
  })

  console.log('')

  // Ask for database URL (optional)
  const databaseUrl = await input({
    message: 'Enter DATABASE_URL (leave empty to use default):',
    default: '',
    validate: (value) => {
      if (value === '') return true
      // Basic validation for postgres URL format
      if (value.startsWith('postgresql://') || value.startsWith('postgres://')) {
        return true
      }
      return 'Please enter a valid PostgreSQL connection string (postgresql://...)'
    },
  })

  return {
    setupEnv,
    generateSecrets,
    databaseUrl: databaseUrl || undefined,
  }
}
