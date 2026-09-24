import path from 'node:path'
import fs from 'fs-extra'
import chalk from 'chalk'
import ora from 'ora'
import { execFileSync, execSync, spawnSync } from 'node:child_process'

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
 * Every local tarball for `packageName`, across all of findLocalTarball's
 * search paths -- not just the first match in the first path that has one --
 * so a caller that needs to choose among them by version can see all of them
 * instead of silently getting whichever sorted first.
 */
function findLocalTarballCandidates(packageName: string): string[] {
  const tarballPrefix = packageName.replace('@', '').replace('/', '-')

  const searchPaths = [
    path.join(process.cwd(), '.packages'),
    path.join(process.cwd(), '..', '.packages'),
    path.join(process.cwd(), '..', 'repo', '.packages'),
    path.join(process.cwd(), '..', '..', '.packages'),
    path.join(process.cwd(), '..', '..', 'repo', '.packages'),
  ]

  const candidates = new Set<string>()
  for (const searchPath of searchPaths) {
    if (!fs.existsSync(searchPath)) continue
    for (const file of fs.readdirSync(searchPath)) {
      if (file.startsWith(tarballPrefix) && file.endsWith('.tgz')) {
        candidates.add(path.join(searchPath, file))
      }
    }
  }
  return [...candidates]
}

/**
 * The version a local tarball's filename declares for `packageName`, the way
 * `pnpm pack` names it (`<prefix>-<version>.tgz`), or null when the file
 * doesn't match that pattern for this package.
 */
function localTarballVersion(file: string, packageName: string): string | null {
  const prefix = `${packageName.replace('@', '').replace('/', '-')}-`
  const name = path.basename(file)
  if (!name.startsWith(prefix) || !name.endsWith('.tgz')) return null
  return name.slice(prefix.length, -4)
}

/**
 * The single local tarball for `packageName` whose filename declares
 * `targetVersion` (the local core tarball's version), among every candidate
 * `findLocalTarballCandidates` finds -- or null when there is no match, or
 * more than one (an ambiguous choice). Either case prints a notice naming
 * what happened, so a stale tarball left over from an earlier local pack is
 * never installed silently in place of the version packed core actually
 * requires, and an ambiguous match is never guessed at either; the package
 * then resolves from the registry as if no local tarball existed.
 */
function findVersionMatchedTarball(packageName: string, targetVersion: string): string | null {
  const candidates = findLocalTarballCandidates(packageName)
  const matching = candidates.filter(file => localTarballVersion(file, packageName) === targetVersion)

  if (matching.length === 1) return matching[0]
  if (matching.length > 1) {
    console.log(chalk.yellow(`  ⚠ Found more than one local ${packageName} tarball at ${targetVersion}; not guessing which to use, so it will be installed from the registry instead.`))
  } else if (candidates.length > 0) {
    console.log(chalk.yellow(`  ⚠ Ignoring local ${packageName} tarball(s) not at ${targetVersion} (the local core tarball's version); it will be installed from the registry instead.`))
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
 * pnpm-workspace.yaml has none. Root-first source and local plugins are owned
 * by the project rather than separate workspace packages.
 */
export function buildWorkspaceYaml(
  allowlist: string[],
  releaseAgeExclude: string[] = [],
  overrides: Record<string, string> = {},
): string {
  const quoted = allowlist.map(entry => `'${entry}'`)
  const exclusions = releaseAgeExclude.length > 0
    ? `minimumReleaseAgeExclude:\n${releaseAgeExclude.map(entry => `  - '${entry}'`).join('\n')}\n`
    : ''
  const overrideEntries = Object.entries(overrides)
  const overrideYaml = overrideEntries.length > 0
    ? `overrides:\n${overrideEntries.map(([name, spec]) => `  '${name}': '${spec}'`).join('\n')}\n\n`
    : ''
  return `packages: []

# Dependencies allowed to run their install scripts: pnpm 11 reads allowBuilds,
# pnpm 10 onlyBuiltDependencies, and pnpm 9 runs them all.
allowBuilds:
${quoted.map(entry => `  ${entry}: true`).join('\n')}
onlyBuiltDependencies:
${quoted.map(entry => `  - ${entry}`).join('\n')}

${overrideYaml}# pnpm 11's own release-age policy, declared so that pnpm 10.16 and later
# resolve with it too: pnpm 11 refuses a lockfile holding a version published
# less than a day before it installs.
minimumReleaseAge: ${MINIMUM_RELEASE_AGE_MINUTES}
minimumReleaseAgeStrict: false
${exclusions}`
}

/**
 * Major version of the pnpm that will install `projectPath`, or null when it
 * cannot be determined. This runs the same `pnpm` command with the same cwd
 * as the later `pnpm add`: Corepack therefore resolves packageManager from
 * projectPath's ancestors, not from the directory that launched this CLI.
 * A project in a different workspace can consequently use a different pnpm.
 */
function getPnpmMajorVersion(projectPath: string): number | null {
  try {
    const output = execFileSync('pnpm', ['--version'], {
      cwd: projectPath,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const match = /^(\d+)\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.exec(output.trim())
    return match ? Number.parseInt(match[1], 10) : null
  } catch {
    return null
  }
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

/** What create-nextspark-app installs next to the NextSpark packages before the wizard runs. */
export const ESSENTIAL_DEPENDENCIES = [
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
] as const

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

  // @nextsparkjs/testing, found locally alongside core/cli, resolved by a
  // local tarball file: spec -- written directly into the project's
  // devDependencies below -- or null to leave it to the wizard's own
  // registry pin (packages/cli/src/wizard/generators/index.ts pins
  // packageJson.devDependencies['@nextsparkjs/testing'] to this CLI's
  // version once nextspark init runs).
  //
  // Since beta.192, @nextsparkjs/testing is a direct devDependency every
  // generated project declares for itself -- the starter theme's Cypress
  // helpers (BasePOM, DashboardEntityPOM, ApiInterceptor) import it -- not a
  // nested runtime dependency of @nextsparkjs/core the way it was before:
  // back then packages/core/package.json listed it under "dependencies",
  // `pnpm pack` resolved its workspace:* range to the exact local version
  // (unpublished until that release), and `pnpm add corePackage` failed
  // resolving that nested dependency with ERR_PNPM_NO_MATCHING_VERSION
  // without a pnpm.overrides entry pointing it at the same local tarball.
  // Now that core no longer depends on it, that override is gone for
  // testing: it is resolved and installed the same direct way as core/cli/ui
  // instead, protected from the wizard's later registry pin by the
  // isLocalPackageRef check already in packages/cli/src/wizard/generators/index.ts
  // (it only overwrites a devDependency spec that isn't already an explicit
  // file:/link:/workspace: reference).
  let testingPackage: string | null = null

  // @nextsparkjs/* packages other than core/cli/ui/testing, found locally
  // alongside them. None of these is installed directly, but any could still
  // be a plain runtime dependency of one that is -- the same situation
  // @nextsparkjs/testing used to be in -- so each gets a version-matched pnpm
  // override pointing it at its own local tarball when packed
  // locally too. Nothing in this monorepo currently needs it (only
  // @nextsparkjs/testing did, and it no longer goes through this path), but
  // the mechanism is kept generic for whichever @nextsparkjs package
  // becomes a nested dependency of core, cli or ui next.
  // The local packages that are nested dependencies of another local tarball.
  // Unlike a direct `pnpm add <tarball>`, those must be redirected explicitly.
  const nestedTarballs: LocalTarball[] = []

  if (localCoreTarball && localCliTarball) {
    corePackage = localCoreTarball
    cliPackage = localCliTarball
    localTarballs.push(
      { name: '@nextsparkjs/core', file: localCoreTarball },
      { name: '@nextsparkjs/cli', file: localCliTarball },
    )

    const targetVersion = localTarballVersion(localCoreTarball, '@nextsparkjs/core')
    if (!targetVersion) {
      console.log(chalk.yellow(`  ⚠ Could not read a version from ${path.basename(localCoreTarball)}; skipping local-tarball resolution for other @nextsparkjs packages.`))
    } else {
      const uiTarball = findVersionMatchedTarball('@nextsparkjs/ui', targetVersion)
      if (uiTarball) {
        uiPackage = uiTarball
        const localUi = { name: '@nextsparkjs/ui', file: uiTarball }
        localTarballs.push(localUi)
        // `pnpm add` installs this tarball directly, but packed core also
        // requires ui at its exact, possibly unpublished version.
        nestedTarballs.push(localUi)
      }

      testingPackage = findVersionMatchedTarball('@nextsparkjs/testing', targetVersion)
      if (testingPackage) {
        localTarballs.push({ name: '@nextsparkjs/testing', file: testingPackage })
      }

      for (const name of NEXTSPARK_PACKAGES) {
        if (name === '@nextsparkjs/core' || name === '@nextsparkjs/cli' || name === '@nextsparkjs/ui' || name === '@nextsparkjs/testing') continue
        const file = findVersionMatchedTarball(name, targetVersion)
        if (file) {
          const auxiliaryTarball = { name, file }
          nestedTarballs.push(auxiliaryTarball)
          localTarballs.push(auxiliaryTarball)
        }
      }
    }
  }

  // Step 3: Create minimal package.json
  const pkgSpinner = ora('  Initializing package.json...').start()
  const packageJson: Record<string, unknown> = {
    name: projectName,
    version: '0.1.0',
    private: true,
  }
  if (testingPackage) {
    packageJson.devDependencies = {
      '@nextsparkjs/testing': `file:${path.relative(projectPath, testingPackage).split(path.sep).join('/')}`,
    }
  }
  const overrides = Object.fromEntries(
    nestedTarballs.map(({ name, file }) => [
      name,
      `file:${path.relative(projectPath, file).split(path.sep).join('/')}`,
    ])
  )
  const pnpmMajor = nestedTarballs.length > 0 ? getPnpmMajorVersion(projectPath) : null
  if (nestedTarballs.length > 0 && pnpmMajor === null) {
    // pnpm 9/10 read package.json while pnpm 11 reads pnpm-workspace.yaml.
    // Guessing one for an unknown version would make a local nested tarball
    // unresolvable in the other, so fail before writing either configuration.
    throw new Error('Could not determine the pnpm version that will install this project; cannot safely configure local-tarball overrides.')
  }
  if (nestedTarballs.length > 0 && pnpmMajor < 11) {
    packageJson.pnpm = {
      overrides,
    }
  }
  await fs.writeJson(path.join(projectPath, 'package.json'), packageJson, { spaces: 2 })

  // Written before the install so the allowlist is in place for it
  await fs.writeFile(
    path.join(projectPath, 'pnpm-workspace.yaml'),
    buildWorkspaceYaml(
      allowlistEntries(projectPath, localTarballs),
      releaseAgeExclusions(ownVersion),
      pnpmMajor !== null && pnpmMajor >= 11 ? overrides : {},
    )
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
      ...ESSENTIAL_DEPENDENCIES,
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
