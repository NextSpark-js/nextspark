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

/**
 * Packages whose install scripts the project needs to run. pnpm 10 stopped
 * running dependency build scripts unless they are listed, and a blocked one
 * installs without its binary: esbuild, @swc/core and cypress ship theirs that
 * way, and @nextsparkjs/core syncs app/ from its own postinstall.
 */
const PACKAGES_ALLOWED_TO_BUILD = [
  '@nextsparkjs/core',
  '@nextsparkjs/ai-workflow',
  '@parcel/watcher',
  '@swc/core',
  'cypress',
  'esbuild',
  'unrs-resolver',
]

/**
 * Major version of the pnpm that will install this project, or null when pnpm
 * isn't callable.
 *
 * It decides where the build-script allowlist goes: pnpm 11 reads `allowBuilds`
 * from pnpm-workspace.yaml and ignores the `pnpm` field in package.json
 * entirely (warning about it on every command), while 10 and older read
 * `pnpm.onlyBuiltDependencies` from package.json and know nothing about the new
 * key. Writing the wrong one leaves every native dependency without its binary.
 */
function getPnpmMajorVersion(): number | null {
  try {
    const version = execSync('pnpm --version', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    const major = Number.parseInt(version.split('.')[0], 10)
    return Number.isNaN(major) ? null : major
  } catch {
    return null
  }
}

/**
 * On pnpm 11 the build-script allowlist lives in pnpm-workspace.yaml.
 *
 * Deliberately without a `packages:` key: that is what turns a directory into a
 * workspace root, and then the install below would need `-w` to add anything.
 * `nextspark init` adds the theme and plugin packages afterwards, merging into
 * this file rather than replacing it.
 */
function buildWorkspaceYaml(): string {
  const allowed = PACKAGES_ALLOWED_TO_BUILD.map(name => `  '${name}': true`).join('\n')
  return `# Dependencies allowed to run their install scripts (pnpm 11 spelling;
# older pnpm reads pnpm.onlyBuiltDependencies from package.json instead)
allowBuilds:
${allowed}
`
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
  const pnpmMajor = getPnpmMajorVersion()
  const packageJson: Record<string, unknown> = {
    name: projectName,
    version: '0.1.0',
    private: true,
  }
  // pnpm 11 ignores this field (and warns about it on every command); there the
  // allowlist travels in pnpm-workspace.yaml instead.
  if (pnpmMajor === null || pnpmMajor < 11) {
    packageJson.pnpm = { onlyBuiltDependencies: PACKAGES_ALLOWED_TO_BUILD }
  }
  await fs.writeJson(path.join(projectPath, 'package.json'), packageJson, { spaces: 2 })

  // Written before the install so the allowlist is in place for it
  if (pnpmMajor !== null && pnpmMajor >= 11) {
    await fs.writeFile(path.join(projectPath, 'pnpm-workspace.yaml'), buildWorkspaceYaml())
  }
  pkgSpinner.succeed('  package.json created')

  // Step 4: Install @nextsparkjs/core, @nextsparkjs/cli, and essential peer dependencies
  const cliSpinner = ora('  Installing @nextsparkjs/core, @nextsparkjs/cli, and dependencies...').start()
  try {
    // Check for local tarballs (for development testing)
    const localCoreTarball = findLocalTarball('@nextsparkjs/core')
    const localCliTarball = findLocalTarball('@nextsparkjs/cli')
    const localUiTarball = findLocalTarball('@nextsparkjs/ui')

    // Pin @nextsparkjs/* to create-nextspark-app's own version (all NextSpark
    // packages release in lockstep). Without this, the unversioned names resolve
    // to `latest` independently for web/ and mobile/, producing an incoherent
    // "version Frankenstein" install.
    let ownVersion = 'latest'
    try {
      const ownPkg = JSON.parse(
        fs.readFileSync(new URL('../package.json', import.meta.url), 'utf-8')
      )
      if (ownPkg.version) ownVersion = ownPkg.version
    } catch {
      // fall back to latest
    }

    let corePackage = `@nextsparkjs/core@${ownVersion}`
    let cliPackage = `@nextsparkjs/cli@${ownVersion}`
    let uiPackage = `@nextsparkjs/ui@${ownVersion}`

    if (localCoreTarball && localCliTarball) {
      corePackage = localCoreTarball
      cliPackage = localCliTarball
      if (localUiTarball) uiPackage = localUiTarball
      cliSpinner.text = '  Installing from local tarballs...'
    }

    // Essential runtime dependencies that must be present for Next.js to start.
    // next/next-intl/better-auth are pinned (not left to float to npm "latest")
    // because unpinned installs bypass whatever security/compatibility vetting
    // this monorepo's own pnpm.overrides did -- in particular, better-auth >=1.7.0
    // has a breaking Account table schema change (accountId -> providerAccountId)
    // this app's migrations don't account for. Bump these deliberately, in lockstep
    // with the monorepo's own pnpm.overrides in package.json, not automatically.
    const essentialDeps = [
      corePackage,
      cliPackage,
      uiPackage,
      'next@16.3.5',
      'react',
      'react-dom',
      'next-intl@4.11.0',
      'better-auth@~1.6.30',
      '@better-fetch/fetch',
      'jiti',
      // Imported directly by shipped app routes (devtools docs/tests + media upload).
      // Must be direct project deps, not phantom-hoisted from @nextsparkjs/core,
      // otherwise `next build` fails to resolve them under pnpm.
      'gray-matter',
      '@vercel/blob',
    ].join(' ')

    // pnpm writes its progress and any error straight to the terminal, so the
    // cause of a failure is on screen as pnpm printed it and nothing captured
    // is printed again.
    cliSpinner.stopAndPersist({ symbol: chalk.gray('›'), text: '  Installing @nextsparkjs/core, @nextsparkjs/cli, and dependencies...' })
    execSync(`pnpm add ${essentialDeps}`, {
      cwd: projectPath,
      stdio: 'inherit',
    })
    cliSpinner.succeed('  @nextsparkjs/core, @nextsparkjs/cli, and dependencies installed')
  } catch (error) {
    // pnpm v10.1+/v11 exits non-zero on unapproved native build scripts
    // (ERR_PNPM_IGNORED_BUILDS) even though the install actually succeeds.
    // Whether @nextsparkjs/core landed in node_modules decides between a warning
    // and a failure; what went wrong is in pnpm's own output above.
    const status = (error as { status?: number | null }).status ?? 'unknown'
    const coreInstalled = fs.existsSync(
      path.join(projectPath, 'node_modules', '@nextsparkjs', 'core')
    )
    if (coreInstalled) {
      cliSpinner.succeed('  @nextsparkjs/core, @nextsparkjs/cli, and dependencies installed')
      console.log(chalk.yellow(`  Warning: pnpm exited with code ${status}. If its output above reports more than ignored build scripts, part of the install did not finish.`))
    } else {
      cliSpinner.fail('  Failed to install dependencies')
      throw new Error(`pnpm add exited with code ${status}; its output above says why.`)
    }
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
