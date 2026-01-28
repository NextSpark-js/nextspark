/**
 * Project Type Prompts (Step 2)
 *
 * Collects project type configuration (web only vs web + mobile).
 */

import { select } from '@inquirer/prompts'
import { showSection, showInfo } from '../banner.js'
import type { WizardConfig, ProjectType } from '../types.js'

/**
 * Project type options with descriptions
 */
const PROJECT_TYPE_OPTIONS = [
  {
    name: 'Web only',
    value: 'web-only' as ProjectType,
    description: 'Next.js web application with NextSpark. Standard flat project structure.',
  },
  {
    name: 'Web + Mobile',
    value: 'web-mobile' as ProjectType,
    description: 'Monorepo with Next.js web app and Expo mobile app sharing the same backend.',
  },
]

/**
 * Run project type prompt
 */
export async function promptProjectType(): Promise<Pick<WizardConfig, 'projectType'>> {
  showSection('Project Type', 2, 10)

  const projectType = await select({
    message: 'What type of project do you want to create?',
    choices: PROJECT_TYPE_OPTIONS,
    default: 'web-only',
  })

  // Show info about selected type
  const selectedOption = PROJECT_TYPE_OPTIONS.find(o => o.value === projectType)
  if (selectedOption) {
    showInfo(selectedOption.description)
  }

  if (projectType === 'web-mobile') {
    console.log('')
    showInfo('Your project will be a pnpm monorepo with web/ and mobile/ directories.')
    showInfo('The mobile app will use Expo and share the same backend API.')
  }

  return {
    projectType,
  }
}

/**
 * Get default project type (for quick mode or non-interactive)
 */
export function getDefaultProjectType(): ProjectType {
  return 'web-only'
}
