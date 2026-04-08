import path from 'node:path'
import fs from 'fs-extra'
import chalk from 'chalk'
import ora from 'ora'
import { execSync, spawnSync } from 'node:child_process'

/**
 * Find local tarball for a package (for development testing)
 * Looks in .packages/ directory in current dir or parent directories
 */
function findLocalTarball(packageName: string): string | null {
  // Package name patterns: @nextsparkjs/core -> nextsparkjs-core-*.tgz
  const tarballPrefix = packageName.replace('@', '').replace('/', '-')

  const searchPaths = [
    path.join(process.cwd(), '.packages'),
    path.join(process.cwd(), '..', '.packages'),
    path.join(process.cwd(), '..', 'repo', '.packages'),  // projects/ -> repo/.packages
    path.join(process.cwd(), '..', '..', '.packages'),
    path.join(process.cwd(), '..', '..', 'repo', '.packages'),
  ]

  for (const searchPath of searchPaths) {
    if (fs.existsSync(searchPath)) {
      const files = fs.readdirSync(searchPath)
      const tarball = files.find(f => f.startsWith(tarballPrefix) && f.endsWith('.tgz'))
      if (tarball) {
        return path.join(searchPath, tarball)
      }
    }
  }

  return null
}

export interface ProjectOptions {
  projectName: string
  projectPath: string
  preset?: string
  type?: string
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

  // Step 2: Create .npmrc for proper pnpm hoisting
  // Required because @nextsparkjs/core has peer dependencies (next, react, etc.)
  // that must be accessible from within the package's node_modules
  await fs.writeFile(
    path.join(projectPath, '.npmrc'),
    `shamefully-hoist=true\n`
  )

  // Step 3: Create minimal package.json
  const pkgSpinner = ora('  Initializing package.json...').start()
  const packageJson = {
    name: projectName,
    version: '0.1.0',
    private: true,
    pnpm: {
      onlyBuiltDependencies: [
        '@nextsparkjs/core',
        '@nextsparkjs/ai-workflow',
      ],
    },
  }
  await fs.writeJson(path.join(projectPath, 'package.json'), packageJson, { spaces: 2 })
  pkgSpinner.succeed('  package.json created')

  // Step 4: Install @nextsparkjs/core, @nextsparkjs/cli, and essential peer dependencies
  const cliSpinner = ora('  Installing @nextsparkjs/core, @nextsparkjs/cli, and dependencies...').start()
  try {
    // Check for local tarballs (for development testing)
    const localCoreTarball = findLocalTarball('@nextsparkjs/core')
    const localCliTarball = findLocalTarball('@nextsparkjs/cli')
    const localUiTarball = findLocalTarball('@nextsparkjs/ui')

    let corePackage = '@nextsparkjs/core'
    let cliPackage = '@nextsparkjs/cli'
    let uiPackage = '@nextsparkjs/ui'

    if (localCoreTarball && localCliTarball) {
      corePackage = localCoreTarball
      cliPackage = localCliTarball
      if (localUiTarball) uiPackage = localUiTarball
      cliSpinner.text = '  Installing from local tarballs...'
    }

    // Essential runtime dependencies that must be present for Next.js to start
    const essentialDeps = [
      corePackage,
      cliPackage,
      uiPackage,
      'next',
      'react',
      'react-dom',
      'next-intl',
      'better-auth',
      '@better-fetch/fetch',
      'jiti',
    ].join(' ')

    execSync(`pnpm add ${essentialDeps}`, {
      cwd: projectPath,
      stdio: 'pipe',
    })
    cliSpinner.succeed('  @nextsparkjs/core, @nextsparkjs/cli, and dependencies installed')
  } catch (error) {
    cliSpinner.fail('  Failed to install dependencies')
    throw error
  }

  // Step 5: Run wizard (inherits terminal for interactive mode)
  console.log()
  console.log(chalk.blue('  Starting NextSpark wizard...'))
  console.log()

  // Build init command with all flags
  // Use array format for proper handling of values with spaces
  const initArgs: string[] = ['nextspark', 'init']
  if (preset) {
    initArgs.push('--preset', preset)
  }
  if (options.type) {
    initArgs.push('--type', options.type)
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
  // shell: true is required for Windows compatibility
  const result = spawnSync('npx', initArgs, {
    cwd: projectPath,
    stdio: 'inherit', // Interactive mode
    shell: true,
  })

  if (result.status !== 0) {
    throw new Error(`Wizard failed with exit code ${result.status}`)
  }

  // Note: Wizard handles pnpm install and shows detailed next steps
  console.log()
  console.log(chalk.gray(`  To start developing:`))
  console.log()
  console.log(chalk.cyan(`    cd ${projectName}`))
  console.log()
}
