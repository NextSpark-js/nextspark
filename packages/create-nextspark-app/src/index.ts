#!/usr/bin/env node
import { Command } from 'commander'
import chalk from 'chalk'
import { createProject } from './create.js'
import { getProjectOptions } from './utils/prompts.js'

const program = new Command()

program
  .name('create-nextspark-app')
  .description('Create a new NextSpark SaaS project')
  .version('0.1.0-beta.4')
  .argument('[project-name]', 'Name of the project')
  .option('--preset <preset>', 'Use a preset (saas, blog, crm)')
  .option('-y, --yes', 'Skip prompts and use defaults', false)
  .action(async (projectName: string | undefined, options: { preset?: string; yes: boolean }) => {
    console.log()
    console.log(chalk.bold.cyan('  NextSpark'))
    console.log(chalk.dim('  Create a new SaaS project'))
    console.log()

    try {
      const projectOptions = await getProjectOptions(projectName, options.yes)

      await createProject({
        ...projectOptions,
        preset: options.preset,
      })
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'PROMPT_CANCELLED') {
          console.log(chalk.yellow('\n  Setup cancelled.\n'))
          process.exit(0)
        }
        console.error(chalk.red(`  Error: ${error.message}`))
      } else {
        console.error(chalk.red('  An unexpected error occurred'))
      }
      process.exit(1)
    }
  })

program.parse()
