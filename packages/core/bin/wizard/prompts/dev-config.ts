/**
 * Development Tools Configuration Prompts (Step 8)
 *
 * Collects development and debugging preferences.
 */

import { checkbox, confirm } from '@inquirer/prompts'
import { showSection, showInfo, showWarning } from '../banner.js'
import type { WizardConfig, DevConfig, WizardMode } from '../types.js'

/**
 * Development tool options
 */
const DEV_TOOL_OPTIONS = [
  {
    name: 'Dev Keyring',
    value: 'devKeyring',
    description: 'Quick login as different users during development',
    checked: true,
  },
  {
    name: 'Debug Mode',
    value: 'debugMode',
    description: 'Enable verbose logging and debugging tools',
    checked: false,
  },
]

/**
 * Get default dev configuration
 */
export function getDefaultDevConfig(): DevConfig {
  return {
    devKeyring: true,
    debugMode: false,
  }
}

/**
 * Run development tools configuration prompts
 */
export async function promptDevConfig(
  mode: WizardMode = 'interactive',
  totalSteps: number = 8
): Promise<Pick<WizardConfig, 'dev'>> {
  showSection('Development Tools', 8, totalSteps)

  showInfo('Configure development and debugging tools.')
  showWarning('These tools are disabled in production builds.')
  console.log('')

  let devKeyring = true
  let debugMode = false

  if (mode === 'expert') {
    // Expert mode: show all options
    const selectedTools = await checkbox({
      message: 'Which development tools do you want to enable?',
      choices: DEV_TOOL_OPTIONS,
    })

    devKeyring = selectedTools.includes('devKeyring')
    debugMode = selectedTools.includes('debugMode')
  } else {
    // Interactive mode: just ask about dev keyring
    devKeyring = await confirm({
      message: 'Enable dev keyring for quick user switching during development?',
      default: true,
    })
  }

  const dev: DevConfig = {
    devKeyring,
    debugMode,
  }

  return { dev }
}
