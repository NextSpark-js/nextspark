/**
 * Features Configuration Prompts (Step 6)
 *
 * Collects feature flags and optional modules.
 */

import { checkbox } from '@inquirer/prompts'
import { showSection, showInfo } from '../banner.js'
import type { WizardConfig, FeatureFlags } from '../types.js'

/**
 * Feature options with descriptions
 */
const FEATURE_OPTIONS = [
  {
    name: 'Analytics Dashboard',
    value: 'analytics',
    description: 'Built-in analytics and metrics dashboard',
    checked: true,
  },
  {
    name: 'Team Management',
    value: 'teams',
    description: 'Team invitations, roles, and member management',
    checked: true,
  },
  {
    name: 'Billing & Subscriptions',
    value: 'billing',
    description: 'Stripe integration for payments and subscriptions (experimental)',
    checked: false, // overridden by the chosen billing model
  },
  {
    name: 'API Access',
    value: 'api',
    description: 'REST API endpoints with authentication',
    checked: true,
  },
  {
    name: 'Documentation Site',
    value: 'docs',
    description: 'Built-in documentation system with markdown support',
    checked: false,
  },
]

/**
 * Run features configuration prompts
 */
export function featureChoices(billingModel: WizardConfig['billingModel']) {
  return FEATURE_OPTIONS.map((o) => (o.value === 'billing' ? { ...o, checked: billingModel !== 'free' } : o))
}

export async function promptFeaturesConfig(
  billingModel: WizardConfig['billingModel'] = 'free'
): Promise<Pick<WizardConfig, 'features'>> {
  showSection('Features', 6, 10)

  showInfo('Select the features you want to include in your project.')
  showInfo('You can add or remove features later by editing your config files.')
  console.log('')

  // Select features
  const selectedFeatures = await checkbox({
    message: 'Which features do you want to enable?',
    choices: featureChoices(billingModel),
  })

  // Convert to feature flags object
  const features: FeatureFlags = {
    analytics: selectedFeatures.includes('analytics'),
    teams: selectedFeatures.includes('teams'),
    billing: selectedFeatures.includes('billing'),
    api: selectedFeatures.includes('api'),
    docs: selectedFeatures.includes('docs'),
  }

  return {
    features,
  }
}
