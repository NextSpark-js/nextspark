#!/usr/bin/env node
import { Command } from 'commander'
import chalk from 'chalk'
import { readFileSync } from 'fs'
import { createProject } from './create.js'
import { LOCALES, checkLocales } from './utils/locales.js'
import { getProjectOptions } from './utils/prompts.js'

// Read version from package.json dynamically
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'))

const program = new Command()

program
  .name('create-nextspark-app')
  .description('Create a new NextSpark SaaS project')
  .version(pkg.version)
  .argument('[project-name]', 'Name of the project')
  .option('--preset <preset>', 'Use a preset (saas, blog, crm); a preset sets configuration only, the template comes from --theme')
  .option('--type <type>', 'Project type: web or web-mobile')
  .option('--name <name>', 'Project name (non-interactive mode)')
  .option('--slug <slug>', 'Project slug (non-interactive mode)')
  .option('--description <desc>', 'Project description (non-interactive mode)')
  .option('--theme <theme>', 'Theme to use (starter, blog, crm, productivity, none); blog, crm and productivity are experimental')
  .option('--plugins <plugins>', 'Plugins to install (comma-separated; all but starter are experimental)')
  .option('--locales <list>', `Languages of the project, comma-separated (${LOCALES.join(', ')}); applies to --yes and --preset runs, the prompts ask otherwise (default: en)`)
  .option('--default-locale <locale>', 'Default language, one of --locales (default: en when selected, else the first)')
  .option('--no-git', 'Do not initialize a git repository or make a first commit')
  .option('-y, --yes', 'Skip prompts and use defaults', false)
  .action(async (projectName: string | undefined, options: { preset?: string; type?: string; name?: string; slug?: string; description?: string; theme?: string; plugins?: string; locales?: string; defaultLocale?: string; yes: boolean; git: boolean }) => {
    console.log()
    console.log(chalk.bold.cyan('  NextSpark'))
    console.log(chalk.dim('  Create a new SaaS project'))
    console.log()

    try {
      // Before the install, which takes minutes: a typo should not cost one
      checkLocales(options.locales, options.defaultLocale)
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
        locales: options.locales,
        defaultLocale: options.defaultLocale,
        yes: options.yes,
        git: options.git,
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
