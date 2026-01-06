/**
 * Billing Configuration Prompts (Step 4)
 *
 * Collects billing model and payment configuration.
 */

import { select } from '@inquirer/prompts'
import { showSection, showInfo } from '../banner.js'
import type { WizardConfig, BillingModel } from '../types.js'
import { CURRENCIES } from '../types.js'

/**
 * Billing model options with descriptions
 */
const BILLING_MODEL_OPTIONS = [
  {
    name: 'Free (No payments)',
    value: 'free' as BillingModel,
    description: 'All features are free. No payment processing needed.',
  },
  {
    name: 'Freemium (Free + Paid tiers)',
    value: 'freemium' as BillingModel,
    description: 'Free tier with optional paid upgrades (Free + Pro plans).',
  },
  {
    name: 'Paid (Subscription required)',
    value: 'paid' as BillingModel,
    description: 'Subscription-based access with optional trial period.',
  },
]

/**
 * Run billing configuration prompts
 */
export async function promptBillingConfig(): Promise<Pick<WizardConfig, 'billingModel' | 'currency'>> {
  showSection('Billing Configuration', 4, 5)

  // Select billing model
  const billingModel = await select({
    message: 'What billing model do you want to use?',
    choices: BILLING_MODEL_OPTIONS,
    default: 'freemium',
  })

  // Show info about selected model
  const selectedOption = BILLING_MODEL_OPTIONS.find(o => o.value === billingModel)
  if (selectedOption) {
    showInfo(selectedOption.description)
  }

  // Only ask for currency if not free
  let currency = 'usd'

  if (billingModel !== 'free') {
    console.log('')
    currency = await select({
      message: 'What currency will you use?',
      choices: CURRENCIES.map(c => ({
        name: c.label,
        value: c.value,
      })),
      default: 'usd',
    })
  }

  // Show info about customizing plans
  console.log('')
  showInfo('You can customize plans and pricing in billing.config.ts')

  return {
    billingModel,
    currency,
  }
}
