/**
 * Internationalization Prompts (Step 4)
 *
 * Collects language and locale configuration.
 */

import { select, checkbox } from '@inquirer/prompts'
import { showSection, showInfo } from '../banner.js'
import type { WizardConfig } from '../types.js'
import { AVAILABLE_LOCALES } from '../types.js'

/**
 * Locale options for selection
 */
const LOCALE_OPTIONS = Object.entries(AVAILABLE_LOCALES).map(([value, name]) => ({
  name: `${name} (${value})`,
  value,
  checked: value === 'en', // English selected by default
}))

/**
 * Run i18n configuration prompts
 */
export async function promptI18nConfig(): Promise<Pick<WizardConfig, 'defaultLocale' | 'supportedLocales'>> {
  showSection('Internationalization', 4, 10)

  // Select supported languages
  const supportedLocales = await checkbox({
    message: 'Which languages do you want to support?',
    choices: LOCALE_OPTIONS,
    required: true,
  })

  // Ensure at least one language is selected
  if (supportedLocales.length === 0) {
    showInfo('At least one language is required. English has been selected.')
    supportedLocales.push('en')
  }

  // Select default language from the selected ones
  let defaultLocale: string = 'en'

  if (supportedLocales.length === 1) {
    defaultLocale = supportedLocales[0]
    showInfo(`Default language set to ${AVAILABLE_LOCALES[defaultLocale]}`)
  } else {
    console.log('')
    defaultLocale = await select({
      message: 'Which should be the default language?',
      choices: supportedLocales.map(locale => ({
        name: `${AVAILABLE_LOCALES[locale]} (${locale})`,
        value: locale,
      })),
      default: supportedLocales.includes('en') ? 'en' : supportedLocales[0],
    })
  }

  return {
    defaultLocale,
    supportedLocales,
  }
}
