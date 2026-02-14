/**
 * Authentication Configuration Prompts (Step 8)
 *
 * Collects registration mode, authentication method preferences, and security settings.
 * Registration mode controls how new users can sign up.
 */

import { checkbox, select } from '@inquirer/prompts'
import { showSection, showInfo } from '../banner.js'
import type { WizardConfig, AuthConfig, WizardMode, RegistrationMode } from '../types.js'

/**
 * Registration mode options
 */
const REGISTRATION_MODE_OPTIONS = [
  {
    name: 'Open (anyone can register)',
    value: 'open' as RegistrationMode,
    description: 'Email+password and Google OAuth signup available to everyone',
  },
  {
    name: 'Domain-Restricted (Google OAuth only for specific domains)',
    value: 'domain-restricted' as RegistrationMode,
    description: 'Only Google OAuth for allowed email domains (e.g., @yourcompany.com)',
  },
  {
    name: 'Invitation-Only (registration via invite link)',
    value: 'invitation-only' as RegistrationMode,
    description: 'Users can only register when invited by an existing user',
  },
  {
    name: 'Closed (no public registration)',
    value: 'closed' as RegistrationMode,
    description: 'No signup at all. Users are created manually by admins.',
  },
]

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
    registrationMode: 'open',
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

  // Select registration mode
  const registrationMode = await select({
    message: 'How should new users register?',
    choices: REGISTRATION_MODE_OPTIONS,
    default: 'open',
  })

  console.log('')

  // Determine auth methods based on registration mode
  let emailPassword = true
  let googleOAuth = false

  if (registrationMode === 'domain-restricted') {
    // Domain-restricted requires Google OAuth, email login is hidden
    googleOAuth = true
    emailPassword = false
    showInfo('Domain-restricted mode: Google OAuth enabled, email login hidden on login page.')
    console.log('')
  } else if (registrationMode === 'closed') {
    // Closed mode: only email login (no OAuth signup)
    emailPassword = true
    googleOAuth = false
    showInfo('Closed mode: Only email login for manually-created users.')
    console.log('')
  } else {
    // Open or invitation-only: let user choose methods
    const selectedMethods = await checkbox({
      message: 'Which authentication methods do you want to enable?',
      choices: AUTH_METHOD_OPTIONS,
    })

    emailPassword = selectedMethods.includes('emailPassword')
    googleOAuth = selectedMethods.includes('googleOAuth')
  }

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
    registrationMode,
    emailPassword,
    googleOAuth,
    emailVerification: selectedSecurity.includes('emailVerification'),
  }

  return { auth }
}
