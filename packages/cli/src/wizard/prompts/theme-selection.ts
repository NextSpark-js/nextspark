/**
 * Theme Selection Prompt
 *
 * Asks the user which reference theme they want to install.
 * The reference theme provides a complete example to learn from,
 * while the user's custom theme (based on starter) is the active theme.
 */

import { select } from '@inquirer/prompts'
import chalk from 'chalk'

export type ThemeChoice = 'default' | 'blog' | 'crm' | 'productivity' | null

/**
 * Prompt the user to select a reference theme
 */
export async function promptThemeSelection(): Promise<ThemeChoice> {
  console.log('')
  console.log(chalk.cyan('  Reference Theme Installation'))
  console.log(chalk.gray('  ' + '-'.repeat(40)))
  console.log('')
  console.log(chalk.gray('  A reference theme provides a complete example to learn from.'))
  console.log(chalk.gray('  Your custom theme (based on starter) will be your active theme.'))
  console.log('')

  const theme = await select<ThemeChoice>({
    message: 'Which reference theme would you like to install?',
    choices: [
      {
        name: 'None (skip)',
        value: null,
        description: 'Only my custom theme, no reference (add later with add:theme)',
      },
      {
        name: 'Default (SaaS boilerplate)',
        value: 'default',
        description: 'Full-featured SaaS with dashboard, billing, AI chat',
      },
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
