/**
 * Authentication Configuration Prompts (Step 6)
 *
 * Collects authentication method preferences and security settings.
 */

import { checkbox, confirm } from '@inquirer/prompts'
import { showSection, showInfo } from '../banner.js'
import type { WizardConfig, AuthConfig, WizardMode } from '../types.js'

/**
 * Authentication method options
 */
const AUTH_METHOD_OPTIONS = [
  {
    name: 'Email & Password',
    value: 'emailPassword',
    description: 'Traditional email and password authentication',
    checked: true,
  },
  {
    name: 'Magic Link',
    value: 'magicLink',
    description: 'Passwordless authentication via email links',
    checked: false,
  },
  {
    name: 'Google OAuth',
    value: 'googleOAuth',
    description: 'Sign in with Google accounts',
    checked: false,
  },
  {
    name: 'GitHub OAuth',
    value: 'githubOAuth',
    description: 'Sign in with GitHub accounts',
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
  {
    name: 'Two-Factor Authentication (2FA)',
    value: 'twoFactor',
    description: 'Optional TOTP-based two-factor authentication',
    checked: false,
  },
]

/**
 * Get default auth configuration
 */
export function getDefaultAuthConfig(): AuthConfig {
  return {
    emailPassword: true,
    magicLink: false,
    googleOAuth: false,
    githubOAuth: false,
    emailVerification: true,
    twoFactor: false,
  }
}

/**
 * Run authentication configuration prompts
 */
export async function promptAuthConfig(
  mode: WizardMode = 'interactive',
  totalSteps: number = 8
): Promise<Pick<WizardConfig, 'auth'>> {
  showSection('Authentication', 6, totalSteps)

  showInfo('Configure how users will authenticate to your application.')
  showInfo('You can enable multiple authentication methods.')
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
  } else {
    // In interactive mode, just ask about 2FA
    console.log('')
    const enable2FA = await confirm({
      message: 'Enable two-factor authentication (2FA)?',
      default: false,
    })
    if (enable2FA) {
      selectedSecurity.push('twoFactor')
    }
  }

  const auth: AuthConfig = {
    emailPassword: selectedMethods.includes('emailPassword'),
    magicLink: selectedMethods.includes('magicLink'),
    googleOAuth: selectedMethods.includes('googleOAuth'),
    githubOAuth: selectedMethods.includes('githubOAuth'),
    emailVerification: selectedSecurity.includes('emailVerification'),
    twoFactor: selectedSecurity.includes('twoFactor'),
  }

  return { auth }
}
