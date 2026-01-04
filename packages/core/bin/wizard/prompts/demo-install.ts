/**
 * Demo Theme Installation Prompt
 *
 * Asks the user if they want to install a demo theme before completing the wizard.
 * This allows users to explore NextSpark functionality with a fully-featured theme.
 */

import { select } from '@inquirer/prompts'
import chalk from 'chalk'

/**
 * Prompt the user to install a demo theme
 *
 * Explains that the demo is for demonstration purposes only
 * and that the wizard must still be completed afterwards.
 */
export async function promptDemoInstall(): Promise<boolean> {
  console.log('')
  console.log(chalk.cyan('  Demo Theme Installation'))
  console.log(chalk.gray('  ' + '-'.repeat(40)))
  console.log('')
  console.log(chalk.gray('  A demo theme lets you explore NextSpark features immediately.'))
  console.log(chalk.gray('  ' + chalk.yellow('Note:') + ' This is for demonstration only.'))
  console.log(chalk.gray('  You will still need to complete the wizard to create your project.'))
  console.log('')

  const installDemo = await select({
    message: 'Would you like to install a demo theme first?',
    choices: [
      {
        name: 'No, continue with wizard',
        value: false,
        description: 'Proceed directly to project configuration',
      },
      {
        name: 'Yes, install demo theme',
        value: true,
        description: 'Install the default demo theme to explore features',
      },
    ],
    default: false,
  })

  return installDemo
}
