import path from 'node:path'
import fs from 'fs-extra'
import chalk from 'chalk'
import ora from 'ora'
import { execSync } from 'node:child_process'

export interface ProjectOptions {
  projectName: string
  projectPath: string
  preset?: string
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

  // Step 3: Install @nextsparkjs/cli (includes core as dependency)
  const cliSpinner = ora('  Installing @nextsparkjs/cli...').start()
  try {
    execSync('pnpm add @nextsparkjs/cli', {
      cwd: projectPath,
      stdio: 'pipe',
    })
    cliSpinner.succeed('  @nextsparkjs/cli installed')
  } catch (error) {
    cliSpinner.fail('  Failed to install @nextsparkjs/cli')
    throw error
  }

  // Step 4: Run wizard (inherits terminal for interactive mode)
  console.log()
  console.log(chalk.blue('  Starting NextSpark wizard...'))
  console.log()

  const presetArg = preset ? ` --preset=${preset}` : ''
  execSync(`npx nextspark init${presetArg}`, {
    cwd: projectPath,
    stdio: 'inherit', // Interactive mode
  })

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
