/**
 * Theme Selection Prompt
 *
 * Asks which install-once project template to extract.
 */

import { select } from '@inquirer/prompts'
import chalk from '../../utils/colors.js'

export type ThemeChoice = 'starter' | 'blog' | 'crm' | 'productivity' | null

/**
 * Prompt the user to select a project template.
 */
export async function promptThemeSelection(): Promise<ThemeChoice> {
  console.log('')
  console.log(chalk.cyan('  Project Template'))
  console.log(chalk.gray('  ' + '-'.repeat(40)))
  console.log('')
  console.log(chalk.gray('  The selected template is extracted once and becomes project-owned source.'))
  console.log('')

  const theme = await select<ThemeChoice>({
    message: 'Which project template would you like to use?',
    choices: [
      {
        name: 'Starter (default)',
        value: null,
        description: 'Start from the minimal bundled project template',
      },
      { name: 'Starter', value: 'starter', description: 'Minimal bundled project template' },
      {
        name: 'Blog',
        value: 'blog',
        description: 'Content management and publishing platform',
      },
      {
        name: 'CRM',
        value: 'crm',
        description: 'Customer relationship management',
      },
      {
        name: 'Productivity',
        value: 'productivity',
        description: 'Tasks, projects, and calendar management',
      },
    ],
    default: null,
  })

  return theme
}
