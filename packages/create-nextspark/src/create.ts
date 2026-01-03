import path from 'node:path'
import fs from 'node:fs'
import chalk from 'chalk'
import ora from 'ora'
import { execAsync } from './utils/exec.js'
import { createEnvFile } from './utils/templates.js'

export interface ProjectOptions {
  projectName: string
  projectPath: string
}

export async function createProject(options: ProjectOptions): Promise<void> {
  const { projectName, projectPath } = options

  // Check if directory already exists
  if (fs.existsSync(projectPath)) {
    const files = fs.readdirSync(projectPath)
    if (files.length > 0) {
      throw new Error(`Directory "${projectName}" already exists and is not empty`)
    }
  }

  console.log()
  console.log(chalk.bold(`  Creating ${chalk.cyan(projectName)}...`))
  console.log()

  // Step 1: Create Next.js app
  const nextSpinner = ora('  Creating Next.js app with TypeScript and Tailwind...').start()
  try {
    await execAsync(
      `pnpm create next-app@latest "${projectPath}" --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-pnpm`,
      { cwd: process.cwd() }
    )
    nextSpinner.succeed('  Next.js app created')
  } catch (error) {
    nextSpinner.fail('  Failed to create Next.js app')
    throw error
  }

  // Step 2: Install @nextsparkjs/core
  const coreSpinner = ora('  Installing @nextsparkjs/core...').start()
  try {
    await execAsync('pnpm add @nextsparkjs/core', { cwd: projectPath })
    coreSpinner.succeed('  @nextsparkjs/core installed')
  } catch (error) {
    coreSpinner.fail('  Failed to install @nextsparkjs/core')
    throw error
  }

  // Step 3: Run nextspark init
  const initSpinner = ora('  Initializing NextSpark...').start()
  try {
    await execAsync('npx nextspark init --yes', { cwd: projectPath })
    initSpinner.succeed('  NextSpark initialized')
  } catch (error) {
    initSpinner.fail('  Failed to initialize NextSpark')
    throw error
  }

  // Step 4: Create .env file
  const envSpinner = ora('  Creating .env file...').start()
  try {
    await createEnvFile(projectPath)
    envSpinner.succeed('  .env file created')
  } catch (error) {
    envSpinner.fail('  Failed to create .env file')
    throw error
  }

  // Success message
  console.log()
  console.log(chalk.bold.green('  Success!') + ` Created ${chalk.cyan(projectName)} at ${chalk.dim(projectPath)}`)
  console.log()
  console.log('  Next steps:')
  console.log()
  console.log(chalk.cyan(`    cd ${projectName}`))
  console.log(chalk.cyan('    pnpm dev'))
  console.log()
  console.log('  To configure your project:')
  console.log()
  console.log(chalk.dim('    1. Edit .env with your API keys'))
  console.log(chalk.dim('    2. Configure your database in prisma/schema.prisma'))
  console.log(chalk.dim('    3. Run pnpm db:push to sync your database'))
  console.log()
  console.log(chalk.dim('  Documentation: https://nextspark.dev/docs'))
  console.log()
}
