#!/usr/bin/env node
import { Command } from 'commander'
import chalk from 'chalk'
import { readFileSync } from 'fs'
import { createProject } from './create.js'
import { getProjectOptions } from './utils/prompts.js'

// Read version from package.json dynamically
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'))

const program = new Command()

program
  .name('create-nextspark-app')
  .description('Create a new NextSpark SaaS project')
  .version(pkg.version)
  .argument('[project-name]', 'Name of the project')
  .option('--preset <preset>', 'Use a preset (saas, blog, crm)')
  .option('--type <type>', 'Project type: web or web-mobile')
  .option('--name <name>', 'Project name (non-interactive mode)')
  .option('--slug <slug>', 'Project slug (non-interactive mode)')
  .option('--description <desc>', 'Project description (non-interactive mode)')
  .option('--theme <theme>', 'Theme to use (default, blog, crm, productivity, none)')
  .option('--plugins <plugins>', 'Plugins to install (comma-separated)')
  .option('-y, --yes', 'Skip prompts and use defaults', false)
  .action(async (projectName: string | undefined, options: { preset?: string; type?: string; name?: string; slug?: string; description?: string; theme?: string; plugins?: string; yes: boolean }) => {
    console.log()
    console.log(chalk.bold.cyan('  NextSpark'))
    console.log(chalk.dim('  Create a new SaaS project'))
    console.log()

    try {
      const projectOptions = await getProjectOptions(projectName, options.yes)

      await createProject({
        ...projectOptions,
        preset: options.preset,
        type: options.type,
        name: options.name,
        slug: options.slug,
        description: options.description,
        theme: options.theme,
        plugins: options.plugins,
        yes: options.yes,
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
