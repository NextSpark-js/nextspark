import path from 'node:path'
import fs from 'fs-extra'
import chalk from 'chalk'
import ora from 'ora'
import { execSync, spawnSync } from 'node:child_process'

export interface ProjectOptions {
  projectName: string
  projectPath: string
  preset?: string
  name?: string
  slug?: string
  description?: string
  theme?: string
  plugins?: string
  yes?: boolean
}

export async function createProject(options: ProjectOptions): Promise<void> {
  const { projectName, projectPath, preset } = options

  // Validate directory
  if (await fs.pathExists(projectPath)) {
    const files = await fs.readdir(projectPath)
    if (files.length > 0) {
      throw new Error(`Directory "${projectName}" already exists and is not empty`)
    }
  }

  console.log()
  console.log(chalk.bold(`  Creating ${chalk.cyan(projectName)}...`))
  console.log()

  // Step 1: Create directory
  const dirSpinner = ora('  Creating project directory...').start()
  await fs.ensureDir(projectPath)
  dirSpinner.succeed('  Project directory created')

  // Step 2: Create minimal package.json
  const pkgSpinner = ora('  Initializing package.json...').start()
  const packageJson = {
    name: projectName,
    version: '0.1.0',
    private: true,
  }
  await fs.writeJson(path.join(projectPath, 'package.json'), packageJson, { spaces: 2 })
  pkgSpinner.succeed('  package.json created')

  // Step 3: Install @nextsparkjs/core and @nextsparkjs/cli
  const cliSpinner = ora('  Installing @nextsparkjs/core and @nextsparkjs/cli...').start()
  try {
    execSync('pnpm add @nextsparkjs/core @nextsparkjs/cli', {
      cwd: projectPath,
      stdio: 'pipe',
    })
    cliSpinner.succeed('  @nextsparkjs/core and @nextsparkjs/cli installed')
  } catch (error) {
    cliSpinner.fail('  Failed to install @nextsparkjs/core and @nextsparkjs/cli')
    throw error
  }

  // Step 4: Run wizard (inherits terminal for interactive mode)
  console.log()
  console.log(chalk.blue('  Starting NextSpark wizard...'))
  console.log()

  // Build init command with all flags
  // Use array format for proper handling of values with spaces
  const initArgs: string[] = ['nextspark', 'init']
  if (preset) {
    initArgs.push('--preset', preset)
  }
  if (options.name) {
    initArgs.push('--name', options.name)
  }
  if (options.slug) {
    initArgs.push('--slug', options.slug)
  }
  if (options.description) {
    initArgs.push('--description', options.description)
  }
  if (options.theme) {
    initArgs.push('--theme', options.theme)
  }
  if (options.plugins) {
    initArgs.push('--plugins', options.plugins)
  }
  if (options.yes) {
    initArgs.push('--yes')
  }

  // Use spawnSync to properly handle arguments with spaces
  const result = spawnSync('npx', initArgs, {
    cwd: projectPath,
    stdio: 'inherit', // Interactive mode
  })

  if (result.status !== 0) {
    throw new Error(`Wizard failed with exit code ${result.status}`)
  }

  // Install all dependencies added by wizard
  const installSpinner = ora('  Installing dependencies...').start()
  try {
    execSync('pnpm install', {
      cwd: projectPath,
      stdio: 'pipe',
    })
    installSpinner.succeed('  Dependencies installed')
  } catch (error) {
    installSpinner.fail('  Failed to install dependencies')
    throw error
  }

  // Note: Wizard already shows detailed next steps, so we just add the cd command
  console.log()
  console.log(chalk.gray(`  To start developing:`))
  console.log()
  console.log(chalk.cyan(`    cd ${projectName}`))
  console.log()
}
