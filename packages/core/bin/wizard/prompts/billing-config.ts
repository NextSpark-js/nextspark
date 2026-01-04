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
    description: 'Basic features free, premium features require payment.',
  },
  {
    name: 'Subscription (Recurring payments)',
    value: 'subscription' as BillingModel,
    description: 'Monthly or yearly subscription plans.',
  },
  {
    name: 'One-time (Single purchase)',
    value: 'one-time' as BillingModel,
    description: 'Users pay once for lifetime access.',
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

  return {
    billingModel,
    currency,
  }
}
