import { existsSync, cpSync, readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import chalk from '../utils/colors.js'
import ora from 'ora'
import { execSync } from 'node:child_process'
import { CONTRACTS_PACKAGE_NAME, writeContractsPackage } from '../wizard/generators/contracts-package.js'
import { printExperimentalNotice } from '../utils/experimental.js'
import { reconcileMobileSampleEntities } from '../wizard/generators/monorepo-generator.js'

interface AddMobileOptions {
  force?: boolean
  skipInstall?: boolean
}

/**
 * Find the @nextsparkjs/mobile package directory
 */
function findMobileCoreDir(): string {
  const projectRoot = process.cwd()

  // Check node_modules (npm mode)
  const npmPath = join(projectRoot, 'node_modules', '@nextsparkjs', 'mobile')
  if (existsSync(npmPath)) {
    return npmPath
  }

  // Check monorepo packages (development mode)
  const monoPath = join(projectRoot, 'packages', 'mobile')
  if (existsSync(monoPath)) {
    return monoPath
  }

  // Check parent directories (consumer in monorepo)
  const parentNpmPath = join(projectRoot, '..', 'node_modules', '@nextsparkjs', 'mobile')
  if (existsSync(parentNpmPath)) {
    return parentNpmPath
  }

  throw new Error(
    'Could not find @nextsparkjs/mobile package.\n' +
    'Run: pnpm add @nextsparkjs/mobile'
  )
}

/**
 * Add mobile app to project
 */
export async function addMobileCommand(options: AddMobileOptions = {}): Promise<void> {
  const projectRoot = process.cwd()
  const mobileDir = join(projectRoot, 'mobile')

  console.log()
  console.log(chalk.bold('Adding NextSpark Mobile App'))
  printExperimentalNotice('add:mobile')
  console.log()

  // 1. Check if already exists
  if (existsSync(mobileDir) && !options.force) {
    console.log(chalk.red('Error: Mobile app already exists at mobile/'))
    console.log(chalk.gray('Use --force to overwrite'))
    process.exit(1)
  }

  // 2. Find mobile templates
  let mobileCoreDir: string
  try {
    mobileCoreDir = findMobileCoreDir()
  } catch (error) {
    console.log(chalk.red((error as Error).message))
    process.exit(1)
  }

  const templatesDir = join(mobileCoreDir, 'templates')

  if (!existsSync(templatesDir)) {
    console.log(chalk.red('Error: Could not find mobile templates'))
    console.log(chalk.gray(`Expected at: ${templatesDir}`))
    process.exit(1)
  }

  // 3. Copy templates
  const copySpinner = ora('Copying mobile app template...').start()

  try {
    // Create mobile directory
    mkdirSync(mobileDir, { recursive: true })

    // Copy all templates
    cpSync(templatesDir, mobileDir, { recursive: true })

    // Rename package.json.template
    const pkgTemplatePath = join(mobileDir, 'package.json.template')
    const pkgPath = join(mobileDir, 'package.json')

    if (existsSync(pkgTemplatePath)) {
      renameSync(pkgTemplatePath, pkgPath)

      // Update project name
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))

      // Try to get project name from root package.json
      const rootPkgPath = join(projectRoot, 'package.json')
      if (existsSync(rootPkgPath)) {
        const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf-8'))
        const rawName = rootPkg.name || 'my-project'

        // Preserve scope if present (e.g., @company/my-app -> @company/my-app-mobile)
        if (rawName.startsWith('@')) {
          const scopeMatch = rawName.match(/^@[\w-]+/)
          const scope = scopeMatch ? scopeMatch[0] : ''
          const projectName = rawName.replace(/^@[\w-]+\//, '')
          pkg.name = `${scope}/${projectName}-mobile`
        } else {
          pkg.name = `${rawName}-mobile`
        }
      }

      // The template imports its API types from the generated contracts package. This project is not a
      // pnpm workspace, so mobile/ links the package by path instead of `workspace:*`.
      if (pkg.dependencies) pkg.dependencies[CONTRACTS_PACKAGE_NAME] = 'file:../packages/contracts'

      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2))
    }

    // packages/contracts: `nextspark prepare` generates its src/ from this project's entities
    const contractsDir = join(projectRoot, 'packages', 'contracts')
    if (!existsSync(join(contractsDir, 'package.json'))) {
      await writeContractsPackage(contractsDir, { projectPath: '../..' })
    }
    // Samples whose entity this project does not have keep hand-written types (see the note in the file)
    await reconcileMobileSampleEntities(projectRoot, projectRoot)

    copySpinner.succeed('Mobile app template copied')
  } catch (error) {
    copySpinner.fail('Failed to copy templates')
    console.log(chalk.red((error as Error).message))
    process.exit(1)
  }

  // 4. Install dependencies
  if (!options.skipInstall) {
    const installSpinner = ora('Installing dependencies...').start()

    try {
      execSync('pnpm install', {
        cwd: mobileDir,
        stdio: 'pipe',
        timeout: 300000, // 5 minutes
      })
      installSpinner.succeed('Dependencies installed')
    } catch (error) {
      installSpinner.fail('Failed to install dependencies')
      console.log(chalk.yellow('  Run `pnpm install` in mobile/ manually'))
    }
  }

  // 5. Show next steps
  console.log()
  console.log(chalk.green.bold('  Mobile app created successfully!'))
  console.log()
  console.log(chalk.bold('  Next steps:'))
  console.log()
  console.log(`  ${chalk.cyan('1.')} cd mobile`)
  console.log(`  ${chalk.cyan('2.')} Update ${chalk.bold('app.config.ts')} with your app name and bundle ID`)
  console.log(`  ${chalk.cyan('3.')} Add your entities in ${chalk.bold('src/entities/')}`)
  console.log(`  ${chalk.cyan('4.')} From the project root, run ${chalk.bold('nextspark prepare --contracts-only')} to generate ${chalk.bold('packages/contracts')} (the API types mobile/ imports)`)
  console.log(`  ${chalk.cyan('5.')} npm start`)
  console.log()
  console.log(chalk.gray('  Documentation: https://nextspark.dev/docs/mobile'))
  console.log()
}
