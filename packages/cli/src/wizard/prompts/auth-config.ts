/**
 * Authentication Configuration Prompts (Step 8)
 *
 * Collects authentication method preferences and security settings.
 * Currently supports: Email/Password and Google OAuth
 */

import { checkbox } from '@inquirer/prompts'
import { showSection, showInfo } from '../banner.js'
import type { WizardConfig, AuthConfig, WizardMode } from '../types.js'

/**
 * Authentication method options
 * Note: Only email/password and Google OAuth are currently implemented
 */
const AUTH_METHOD_OPTIONS = [
  {
    name: 'Email & Password',
    value: 'emailPassword',
    description: 'Traditional email and password authentication',
    checked: true,
  },
  {
    name: 'Google OAuth',
    value: 'googleOAuth',
    description: 'Sign in with Google accounts',
    checked: false,
  },
]

/**
 * Security feature options
 */
const SECURITY_OPTIONS = [
  {
    name: 'Email Verification',
    value: 'emailVerification',
    description: 'Require users to verify their email address',
    checked: true,
  },
]

/**
 * Get default auth configuration
 */
export function getDefaultAuthConfig(): AuthConfig {
  return {
    emailPassword: true,
    googleOAuth: false,
    emailVerification: true,
  }
}

/**
 * Run authentication configuration prompts
 */
export async function promptAuthConfig(
  mode: WizardMode = 'interactive',
  totalSteps: number = 8
): Promise<Pick<WizardConfig, 'auth'>> {
  showSection('Authentication', 8, totalSteps)

  showInfo('Configure how users will authenticate to your application.')
  console.log('')

  // Select authentication methods
  const selectedMethods = await checkbox({
    message: 'Which authentication methods do you want to enable?',
    choices: AUTH_METHOD_OPTIONS,
  })

  // In expert mode, also ask about security features
  let selectedSecurity: string[] = ['emailVerification']

  if (mode === 'expert') {
    console.log('')
    showInfo('Configure additional security features.')
    console.log('')

    selectedSecurity = await checkbox({
      message: 'Which security features do you want to enable?',
      choices: SECURITY_OPTIONS,
    })
  }

  const auth: AuthConfig = {
    emailPassword: selectedMethods.includes('emailPassword'),
    googleOAuth: selectedMethods.includes('googleOAuth'),
    emailVerification: selectedSecurity.includes('emailVerification'),
  }

  return { auth }
}
