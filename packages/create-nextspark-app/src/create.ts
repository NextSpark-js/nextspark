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
 * Every package with an install script that a NextSpark project, its themes and
 * its plugins install. pnpm 10 and later run a dependency's install script only
 * when the dependency is listed, and a blocked one installs without what the
 * script sets up: the native binaries esbuild, @swc/core, sharp, @parcel/watcher
 * and unrs-resolver fetch or check, cypress's app, and the app/ directory
 * @nextsparkjs/core syncs. pnpm 11 also fails the install over each one left
 * out, even one whose script only prints a warning, as protobufjs's does.
 */
const PACKAGES_ALLOWED_TO_BUILD = [
  '@nextsparkjs/ai-workflow',
  '@nextsparkjs/core',
  '@parcel/watcher',
  '@swc/core',
  'cypress',
  'esbuild',
  'protobufjs',
  'sharp',
  'unrs-resolver',
]

/** A package installed from a tarball on disk instead of the registry. */
export interface LocalTarball {
  name: string
  file: string
}

/**
 * The allowlist entries for this project: the package names, and the full spec
 * of each listed package installed from a local tarball, since pnpm versions
 * disagree on how a `file:` dependency is matched. pnpm 10.34 and pnpm 11 from
 * 11.5.3 match it only by `<name>@file:<path from the project>`, pnpm 10.13 only
 * by its name, and pnpm 11.0.0 to 11.5.2 reject the spec in `allowBuilds` and
 * refuse the whole file. A project installed from local tarballs therefore
 * can't be installed with those 11.x releases; one installed from the
 * registry lists names only and can.
 */
export function allowlistEntries(projectPath: string, localTarballs: LocalTarball[]): string[] {
  const tarballSpecs = localTarballs
    .filter(tarball => PACKAGES_ALLOWED_TO_BUILD.includes(tarball.name))
    .map(tarball => `${tarball.name}@file:${path.relative(projectPath, tarball.file).split(path.sep).join('/')}`)

  return [...PACKAGES_ALLOWED_TO_BUILD, ...tarballSpecs]
}

/** The NextSpark packages a project can install, all released at one version. */
const NEXTSPARK_PACKAGES = [
  '@nextsparkjs/ai-workflow',
  '@nextsparkjs/cli',
  '@nextsparkjs/core',
  '@nextsparkjs/mobile',
  '@nextsparkjs/testing',
  '@nextsparkjs/ui',
]

/** The minimum release age pnpm 11 applies when none is configured: one day, in minutes. */
const MINIMUM_RELEASE_AGE_MINUTES = 1440

/**
 * The `minimumReleaseAgeExclude` entries that let the NextSpark packages of
 * `version` install while that release is less than a day old: `<name>@<version>`
 * for each, the form pnpm 11 writes by itself for a pinned version younger than
 * the minimum. None when `version` is a dist-tag rather than a version.
 */
export function releaseAgeExclusions(version: string): string[] {
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) return []
  return NEXTSPARK_PACKAGES.map(name => `${name}@${version}`)
}

/**
 * The pnpm-workspace.yaml a new project starts with.
 *
 * It holds the build-script allowlist in the forms each pnpm reads: pnpm 11
 * reads only `allowBuilds`, 10 reads `onlyBuiltDependencies`, and 9 reads
 * neither and runs every install script. The `pnpm` field in package.json is
 * left out: pnpm 11 ignores it and warns about it on every command.
 *
 * It also declares the release-age policy pnpm 11 applies when none is set: a
 * version has to be a day old to be picked, and a pinned version younger than
 * that is installed and added to `minimumReleaseAgeExclude`. pnpm 11 checks
 * every entry of an existing lockfile against that age on each install and
 * refuses the lockfile over a younger one, whatever pnpm wrote it and with or
 * without --no-frozen-lockfile. With the policy declared, pnpm 10.16 and later
 * resolve with the same age when they create the project, and pnpm 11 accepts
 * their lockfile. `minimumReleaseAgeStrict: false` keeps pnpm 11 lenient, as it
 * is by default, once the age is set explicitly. pnpm 10 is strict whatever that
 * key says, so the NextSpark packages of the release being installed, which
 * the project pins, are excluded by version; pnpm 10.16 to 10.18 do not read a
 * version in an exclusion, and with them a NextSpark release fails to install
 * during its first day.
 *
 * pnpm 9 and pnpm 10 before 10.16 ignore the policy and lock the newest version
 * each range allows. pnpm 11 refuses that lockfile with
 * ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION while any version in it is less than a
 * day old: it installs once they all are, or after `pnpm clean --lockfile`,
 * which lets `pnpm install` resolve the project again under the policy.
 *
 * `packages:` is there because pnpm 9 refuses to run in a directory whose
 * pnpm-workspace.yaml has none. It lists the globs `nextspark init` adds for
 * themes and plugins; init merges into this file rather than replacing it. It
 * also makes the project a workspace root, so adding a dependency to the
 * project itself takes `-w`.
 */
export function buildWorkspaceYaml(allowlist: string[], releaseAgeExclude: string[] = []): string {
  const quoted = allowlist.map(entry => `'${entry}'`)
  const exclusions = releaseAgeExclude.length > 0
    ? `minimumReleaseAgeExclude:\n${releaseAgeExclude.map(entry => `  - '${entry}'`).join('\n')}\n`
    : ''
  return `packages:
  - 'contents/themes/*'
  - 'contents/plugins/*'

# Dependencies allowed to run their install scripts: pnpm 11 reads allowBuilds,
# pnpm 10 onlyBuiltDependencies, and pnpm 9 runs them all.
allowBuilds:
${quoted.map(entry => `  ${entry}: true`).join('\n')}
onlyBuiltDependencies:
${quoted.map(entry => `  - ${entry}`).join('\n')}

# pnpm 11's own release-age policy, declared so that pnpm 10.16 and later
# resolve with it too: pnpm 11 refuses a lockfile holding a version published
# less than a day before it installs.
minimumReleaseAge: ${MINIMUM_RELEASE_AGE_MINUTES}
minimumReleaseAgeStrict: false
${exclusions}`
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
  const localTarballs: LocalTarball[] = []

  if (localCoreTarball && localCliTarball) {
    corePackage = localCoreTarball
    cliPackage = localCliTarball
    localTarballs.push(
      { name: '@nextsparkjs/core', file: localCoreTarball },
      { name: '@nextsparkjs/cli', file: localCliTarball },
    )
    if (localUiTarball) {
      uiPackage = localUiTarball
      localTarballs.push({ name: '@nextsparkjs/ui', file: localUiTarball })
    }
  }

  // Step 3: Create minimal package.json
  const pkgSpinner = ora('  Initializing package.json...').start()
  const packageJson: Record<string, unknown> = {
    name: projectName,
    version: '0.1.0',
    private: true,
  }
  await fs.writeJson(path.join(projectPath, 'package.json'), packageJson, { spaces: 2 })

  // Written before the install so the allowlist is in place for it
  await fs.writeFile(
    path.join(projectPath, 'pnpm-workspace.yaml'),
    buildWorkspaceYaml(allowlistEntries(projectPath, localTarballs), releaseAgeExclusions(ownVersion))
  )
  pkgSpinner.succeed('  package.json created')

  // Step 4: Install @nextsparkjs/core, @nextsparkjs/cli, and essential peer dependencies
  const cliSpinner = ora('  Installing @nextsparkjs/core, @nextsparkjs/cli, and dependencies...').start()
  try {
    if (localTarballs.length > 0) {
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
      // better-auth pins this exact version and @better-auth/core requires it as a
      // peer; the template proxy.ts imports it directly, so the project declares it.
      '@better-fetch/fetch@1.3.1',
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
    execSync(`pnpm add -w ${essentialDeps}`, {
      cwd: projectPath,
      stdio: 'inherit',
    })
    cliSpinner.succeed('  @nextsparkjs/core, @nextsparkjs/cli, and dependencies installed')
  } catch (error) {
    // A non-zero exit means pnpm did not finish the install, even when some of
    // it, @nextsparkjs/core included, already landed in node_modules.
    const status = (error as { status?: number | null }).status ?? 'unknown'
    cliSpinner.fail('  Failed to install dependencies')
    throw new Error(`pnpm add exited with code ${status}; its output above says why.`)
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
