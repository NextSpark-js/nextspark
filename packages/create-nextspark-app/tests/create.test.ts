/**
 * create-nextspark-app writes the build-script allowlist before its first install, in the forms
 * pnpm 9, 10 and 11 read, because the pnpm that creates a project need not be the one that
 * installs it later. That pnpm is picked per directory: Corepack takes the version from the nearest
 * `packageManager` field above where it runs, so the directory create-nextspark-app starts from can
 * resolve another pnpm than the new project does.
 *
 * `pnpm` and `npx` are replaced by scripts on PATH: `pnpm --version` answers the way Corepack
 * resolves it, and `pnpm add` records its arguments, leaves core "installed" and exits with
 * FAKE_PNPM_ADD_EXIT.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { allowlistEntries, buildWorkspaceYaml, createProject } from '../src/create.js'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const TARBALLS = ['nextsparkjs-core-0.1.0-beta.189.tgz', 'nextsparkjs-cli-0.1.0-beta.189.tgz', 'nextsparkjs-ui-0.1.0-beta.189.tgz']

const FAKE_PNPM = `#!/bin/sh
dir=$(pwd -P)
version="$FAKE_PNPM_DEFAULT_VERSION"
while [ "$dir" != "/" ]; do
  if [ -f "$dir/package.json" ]; then
    found=$(sed -n 's/.*"packageManager": *"pnpm@\\([^"]*\\)".*/\\1/p' "$dir/package.json")
    if [ -n "$found" ]; then version=$found; break; fi
  fi
  dir=$(dirname "$dir")
done
case "$1" in
  --version) echo "$version" ;;
  add) echo "$@" > "$FAKE_PNPM_ADD_LOG"; mkdir -p node_modules/@nextsparkjs/core; exit "\${FAKE_PNPM_ADD_EXIT:-0}" ;;
esac
`

interface Scenario {
  /** The pnpm the directory create-nextspark-app starts from pins with `packageManager`. */
  callerPnpm: string
  /** The pnpm every other directory resolves, the new project's included. */
  projectPnpm: string
  /** The exit code of `pnpm add`. */
  addExit?: number
  /** Extra @nextsparkjs/* tarballs dropped in .packages/, beyond the always-present core/cli/ui ones. */
  extraTarballs?: string[]
}

interface Created {
  packageJson: { pnpm?: unknown; devDependencies?: Record<string, string> }
  workspaceYaml: string
  /** The globs under `packages:`. */
  packages: string[]
  /** The keys of `allowBuilds`. */
  allowBuilds: string[]
  /** The items of `onlyBuiltDependencies`. */
  onlyBuiltDependencies: string[]
  /** What `pnpm add` was asked to install, flags included. */
  added: string[]
  /** Every line createProject printed with console.log, in order. */
  printed: string[]
}

/** The entries of the top-level YAML key `key`, one per line in the form `pattern` matches. */
function yamlEntries(yaml: string, key: string, pattern: RegExp): string[] {
  const lines = yaml.split('\n')
  const start = lines.indexOf(`${key}:`)
  if (start === -1) return []
  const entries: string[] = []
  for (const line of lines.slice(start + 1)) {
    const match = line.match(pattern)
    if (!match) break
    entries.push(match[1])
  }
  return entries
}

async function create({ callerPnpm, projectPnpm, addExit = 0, extraTarballs = [] }: Scenario): Promise<Created> {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'create-nextspark-app-')))
  const bin = path.join(root, 'bin')
  const caller = path.join(root, 'caller')
  const project = path.join(root, 'projects', 'my-app')
  const addLog = path.join(root, 'pnpm-add.log')

  fs.mkdirSync(bin)
  fs.writeFileSync(path.join(bin, 'pnpm'), FAKE_PNPM, { mode: 0o755 })
  fs.writeFileSync(path.join(bin, 'npx'), '#!/bin/sh\nexit 0\n', { mode: 0o755 })
  fs.mkdirSync(path.join(caller, '.packages'), { recursive: true })
  fs.writeFileSync(path.join(caller, 'package.json'), JSON.stringify({ name: 'caller', packageManager: `pnpm@${callerPnpm}` }))
  for (const tarball of [...TARBALLS, ...extraTarballs]) fs.writeFileSync(path.join(caller, '.packages', tarball), '')

  const previousCwd = process.cwd()
  const previousPath = process.env.PATH
  const previousLog = console.log
  const printed: string[] = []
  console.log = (...args: unknown[]) => { printed.push(args.map(String).join(' ')) }
  process.chdir(caller)
  process.env.PATH = `${bin}${path.delimiter}${previousPath}`
  process.env.FAKE_PNPM_DEFAULT_VERSION = projectPnpm
  process.env.FAKE_PNPM_ADD_LOG = addLog
  process.env.FAKE_PNPM_ADD_EXIT = String(addExit)
  try {
    await createProject({ projectName: 'my-app', projectPath: project })

    const workspaceYaml = fs.readFileSync(path.join(project, 'pnpm-workspace.yaml'), 'utf8')
    return {
      packageJson: JSON.parse(fs.readFileSync(path.join(project, 'package.json'), 'utf8')),
      workspaceYaml,
      packages: yamlEntries(workspaceYaml, 'packages', /^ {2}- '([^']+)'$/),
      allowBuilds: yamlEntries(workspaceYaml, 'allowBuilds', /^ {2}'([^']+)': true$/),
      onlyBuiltDependencies: yamlEntries(workspaceYaml, 'onlyBuiltDependencies', /^ {2}- '([^']+)'$/),
      added: fs.readFileSync(addLog, 'utf8').trim().split(/\s+/).slice(1),
      printed,
    }
  } finally {
    process.chdir(previousCwd)
    process.env.PATH = previousPath
    console.log = previousLog
    delete process.env.FAKE_PNPM_DEFAULT_VERSION
    delete process.env.FAKE_PNPM_ADD_LOG
    delete process.env.FAKE_PNPM_ADD_EXIT
    fs.rmSync(root, { recursive: true, force: true })
  }
}

/** The spec pnpm matches a `file:` dependency by: the tarball's path from the project. */
const coreTarballSpec = '@nextsparkjs/core@file:../../caller/.packages/nextsparkjs-core-0.1.0-beta.189.tgz'

/**
 * Every package installed in this repository that pnpm holds back until it is allowlisted: one
 * with a preinstall, install or postinstall script, or a binding.gyp (an implicit
 * `node-gyp rebuild`). The repository installs every theme and plugin a project can add.
 */
function packagesWithInstallScripts(): string[] {
  const store = path.join(REPO, 'node_modules/.pnpm')
  const names = new Set<string>()

  for (const entry of fs.readdirSync(store)) {
    const modules = path.join(store, entry, 'node_modules')
    if (!fs.existsSync(modules)) continue

    for (const child of fs.readdirSync(modules)) {
      const dirs = child.startsWith('@')
        ? fs.readdirSync(path.join(modules, child)).map(name => path.join(modules, child, name))
        : [path.join(modules, child)]

      for (const dir of dirs) {
        if (fs.lstatSync(dir).isSymbolicLink() || !fs.existsSync(path.join(dir, 'package.json'))) continue
        const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
        const scripts = manifest.scripts ?? {}
        if (scripts.preinstall || scripts.install || scripts.postinstall || fs.existsSync(path.join(dir, 'binding.gyp'))) {
          names.add(manifest.name)
        }
      }
    }
  }

  return [...names].sort()
}

test('the pnpm that creates the project does not change the allowlist it writes', async () => {
  const scenarios: Scenario[] = [
    { callerPnpm: '9.0.0', projectPnpm: '9.0.0' },
    { callerPnpm: '9.0.0', projectPnpm: '11.17.0' },
    { callerPnpm: '11.17.0', projectPnpm: '9.0.0' },
    { callerPnpm: '11.17.0', projectPnpm: '10.34.5' },
    { callerPnpm: '11.17.0', projectPnpm: '11.17.0' },
  ]
  const yamls = new Set<string>()

  for (const scenario of scenarios) {
    const label = `created with pnpm ${scenario.projectPnpm} from a caller on ${scenario.callerPnpm}`
    const { packageJson, workspaceYaml, packages, allowBuilds, onlyBuiltDependencies } = await create(scenario)

    assert.equal(packageJson.pnpm, undefined, `${label}: pnpm 11 ignores the pnpm field and warns about it on every command`)
    assert.deepEqual(packages, ['contents/themes/*', 'contents/plugins/*'], `${label}: pnpm 9 refuses a pnpm-workspace.yaml without packages`)
    assert.ok(allowBuilds.includes('@nextsparkjs/core'), `${label}: allowBuilds is ${allowBuilds.join(', ')}`)
    assert.ok(allowBuilds.includes(coreTarballSpec), `${label}: expected ${coreTarballSpec} in allowBuilds`)
    assert.deepEqual(onlyBuiltDependencies, allowBuilds, `${label}: pnpm 10 reads onlyBuiltDependencies`)
    assert.match(workspaceYaml, /^minimumReleaseAge: 1440$/m, `${label}: pnpm 11's one-day release-age policy is declared`)
    assert.match(workspaceYaml, /^minimumReleaseAgeStrict: false$/m, `${label}: pnpm 11 keeps the declared policy lenient`)
    yamls.add(workspaceYaml)
  }

  assert.equal(yamls.size, 1, 'the pnpm that creates the project changes what it writes')
})

test('pnpm add adds to the project itself, a workspace root once pnpm-workspace.yaml lists packages', async () => {
  const { added } = await create({ callerPnpm: '11.17.0', projectPnpm: '11.17.0' })

  assert.equal(added[0], '-w', `pnpm stops with ERR_PNPM_ADDING_TO_ROOT without it: pnpm add ${added.join(' ')}`)
})

test('a pnpm add that exits non-zero fails the creation, even with core already in node_modules', async () => {
  await assert.rejects(
    create({ callerPnpm: '11.17.0', projectPnpm: '11.17.0', addExit: 1 }),
    /pnpm add exited with code 1/
  )
})

test('the allowlist names every package with an install script that this repository installs', async () => {
  const { allowBuilds } = await create({ callerPnpm: '11.17.0', projectPnpm: '11.17.0' })

  const required = packagesWithInstallScripts()
  assert.ok(required.includes('esbuild'), `the scan found no esbuild; is the repository installed? Found: ${required.join(', ')}`)
  const missing = required.filter(name => !allowBuilds.includes(name))
  assert.deepEqual(missing, [], `pnpm 11 fails the install over each of these: ${missing.join(', ')}`)
})

/**
 * @nextsparkjs/testing is a direct devDependency every generated project
 * declares for itself (packages/cli's wizard pins it once `nextspark init`
 * runs; the starter theme's Cypress helpers import it) -- not, since
 * beta.192, a nested runtime dependency of @nextsparkjs/core. It is resolved
 * the same direct way as @nextsparkjs/core, cli and ui: a local tarball
 * matching the local core tarball's version, when one exists alongside it, is
 * written straight into the project's devDependencies as a file: spec, so
 * the wizard's later registry pin (packages/cli/src/wizard/generators/index.ts)
 * leaves it alone instead of clobbering it back to an unpublished version.
 * Only @nextsparkjs/core, @nextsparkjs/cli and @nextsparkjs/ui are requested
 * directly from `pnpm add`; @nextsparkjs/testing is written into
 * devDependencies instead, since it is the wizard, not this initial install,
 * that normally declares it. A tarball is only used when its own filename
 * declares the same version as the local core tarball (0.1.0-beta.189 for
 * every scenario `create()` builds, from TARBALLS). A stale tarball from an
 * earlier local pack must never be installed in place of the version packed
 * core actually requires, and an ambiguous match (more than one tarball at
 * that version) must never be guessed at either -- both are skipped, with a
 * notice, and the package is left for the wizard to pin from the registry as
 * if no local tarball existed.
 */
test('@nextsparkjs/testing is installed from its local tarball when core, cli and testing are all packed locally', async () => {
  const withoutTesting = await create({ callerPnpm: '11.17.0', projectPnpm: '11.17.0' })
  assert.equal(withoutTesting.packageJson.devDependencies, undefined, 'no devDependencies are written when no local testing tarball exists')
  assert.equal(withoutTesting.packageJson.pnpm, undefined, 'no override is written for @nextsparkjs/testing any more')

  const withTesting = await create({
    callerPnpm: '11.17.0',
    projectPnpm: '11.17.0',
    extraTarballs: ['nextsparkjs-testing-0.1.0-beta.189.tgz'],
  })
  assert.equal(
    withTesting.packageJson.devDependencies?.['@nextsparkjs/testing'],
    'file:../../caller/.packages/nextsparkjs-testing-0.1.0-beta.189.tgz'
  )
})

test('a local testing tarball at a version other than the local core tarball is ignored, with a notice, not installed', async () => {
  const { packageJson, printed } = await create({
    callerPnpm: '11.17.0',
    projectPnpm: '11.17.0',
    // TARBALLS pins core (and cli/ui) to 0.1.0-beta.189; this is stale next to it.
    extraTarballs: ['nextsparkjs-testing-0.1.0-beta.150.tgz'],
  })

  assert.equal(packageJson.devDependencies, undefined, 'no devDependencies are written for a testing tarball at the wrong version')
  assert.ok(
    printed.some(line => line.includes('testing') && line.includes('0.1.0-beta.189')),
    `expected a notice naming the ignored testing tarball and the expected version; printed:\n${printed.join('\n')}`
  )
})

test('when both a stale and a matching local testing tarball exist, the matching one is used and the stale one is ignored', async () => {
  const { packageJson } = await create({
    callerPnpm: '11.17.0',
    projectPnpm: '11.17.0',
    extraTarballs: ['nextsparkjs-testing-0.1.0-beta.150.tgz', 'nextsparkjs-testing-0.1.0-beta.189.tgz'],
  })

  assert.equal(
    packageJson.devDependencies?.['@nextsparkjs/testing'],
    'file:../../caller/.packages/nextsparkjs-testing-0.1.0-beta.189.tgz'
  )
})

test('two local testing tarballs at the same, matching version are an ambiguous match: neither is used, and a notice is printed', async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'create-nextspark-app-')))
  const bin = path.join(root, 'bin')
  const caller = path.join(root, 'caller')
  const project = path.join(root, 'projects', 'my-app')
  const addLog = path.join(root, 'pnpm-add.log')

  fs.mkdirSync(bin)
  fs.writeFileSync(path.join(bin, 'pnpm'), FAKE_PNPM, { mode: 0o755 })
  fs.writeFileSync(path.join(bin, 'npx'), '#!/bin/sh\nexit 0\n', { mode: 0o755 })
  // Two different directories findLocalTarballCandidates both search, each
  // holding a same-version testing tarball: a real "which one?" ambiguity
  // that a single .packages/ directory (where a filename collision is
  // impossible) can't reproduce.
  fs.mkdirSync(path.join(caller, '.packages'), { recursive: true })
  fs.mkdirSync(path.join(root, '.packages'), { recursive: true })
  fs.writeFileSync(path.join(caller, 'package.json'), JSON.stringify({ name: 'caller', packageManager: 'pnpm@11.17.0' }))
  for (const tarball of TARBALLS) fs.writeFileSync(path.join(caller, '.packages', tarball), '')
  fs.writeFileSync(path.join(caller, '.packages', 'nextsparkjs-testing-0.1.0-beta.189.tgz'), '')
  fs.writeFileSync(path.join(root, '.packages', 'nextsparkjs-testing-0.1.0-beta.189.tgz'), '')

  const previousCwd = process.cwd()
  const previousPath = process.env.PATH
  const previousLog = console.log
  const printed: string[] = []
  console.log = (...args: unknown[]) => { printed.push(args.map(String).join(' ')) }
  process.chdir(caller)
  process.env.PATH = `${bin}${path.delimiter}${previousPath}`
  process.env.FAKE_PNPM_DEFAULT_VERSION = '11.17.0'
  process.env.FAKE_PNPM_ADD_LOG = addLog
  process.env.FAKE_PNPM_ADD_EXIT = '0'
  try {
    await createProject({ projectName: 'my-app', projectPath: project })
    const packageJson = JSON.parse(fs.readFileSync(path.join(project, 'package.json'), 'utf8'))

    assert.equal(packageJson.devDependencies, undefined, 'no devDependencies are written when the matching version is ambiguous')
    assert.ok(
      printed.some(line => line.includes('testing') && line.includes('0.1.0-beta.189')),
      `expected a notice naming the ambiguous testing match; printed:\n${printed.join('\n')}`
    )
  } finally {
    process.chdir(previousCwd)
    process.env.PATH = previousPath
    console.log = previousLog
    delete process.env.FAKE_PNPM_DEFAULT_VERSION
    delete process.env.FAKE_PNPM_ADD_LOG
    delete process.env.FAKE_PNPM_ADD_EXIT
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('the project pins the @better-fetch/fetch better-auth depends on, which @better-auth/core requires as a peer', async () => {
  const { added } = await create({ callerPnpm: '11.17.0', projectPnpm: '11.17.0' })

  const betterAuth = fs.realpathSync(path.join(REPO, 'packages/core/node_modules/better-auth'))
  const pinned = JSON.parse(fs.readFileSync(path.join(betterAuth, 'package.json'), 'utf8')).dependencies['@better-fetch/fetch']
  assert.ok(added.includes(`@better-fetch/fetch@${pinned}`), `expected @better-fetch/fetch@${pinned} in: ${added.join(' ')}`)
})

/**
 * The pnpm versions the written pnpm-workspace.yaml is installed with below, which Corepack fetches
 * when it does not have them: 9 reads no allowlist, 10.13 matches a `file:` dependency by name,
 * 10.34 and 11.17 by its `<name>@file:` spec. pnpm 11.0.0 to 11.5.2 reject that spec, so a project
 * from local tarballs is not installable with them and they are not listed.
 */
const REAL_PNPM_VERSIONS = ['9.0.0', '9.15.9', '10.13.1', '10.34.5', '11.17.0']

test('each pnpm builds a NextSpark package from a local tarball under the pnpm-workspace.yaml written for it', async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'create-nextspark-app-pnpm-')))
  // Outside this repository, whose packageManager would make Corepack refuse other versions.
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    COREPACK_ENABLE_DOWNLOAD_PROMPT: '0',
    // A user-level ignore-scripts would stop pnpm 9 and 10 from running any script at all, and the
    // store's cached side effects would skip a script that already ran once.
    npm_config_ignore_scripts: 'false',
    npm_config_side_effects_cache: 'false',
  }
  delete env.CI

  try {
    const source = path.join(root, 'source', 'package')
    fs.mkdirSync(source, { recursive: true })
    fs.writeFileSync(path.join(source, 'package.json'), JSON.stringify({
      name: '@nextsparkjs/core',
      version: '0.0.0',
      scripts: { postinstall: `node -e "require('fs').writeFileSync('built', '')"` },
    }))
    const tarball = path.join(root, '.packages', 'nextsparkjs-core-0.0.0.tgz')
    fs.mkdirSync(path.dirname(tarball))
    const packed = spawnSync('tar', ['-czf', tarball, '-C', path.dirname(source), 'package'], { encoding: 'utf8' })
    assert.equal(packed.status, 0, packed.stderr)

    for (const version of REAL_PNPM_VERSIONS) {
      const available = spawnSync('corepack', [`pnpm@${version}`, '--version'], { cwd: root, env, encoding: 'utf8' })
      assert.equal(available.status, 0, `Corepack could not provide pnpm ${version}:\n${available.stderr}`)

      const project = path.join(root, 'projects', `pnpm-${version}`)
      fs.mkdirSync(project, { recursive: true })
      fs.writeFileSync(path.join(project, 'package.json'), JSON.stringify({ name: 'my-app', version: '0.1.0', private: true }))
      const entries = allowlistEntries(project, [{ name: '@nextsparkjs/core', file: tarball }])
      fs.writeFileSync(path.join(project, 'pnpm-workspace.yaml'), buildWorkspaceYaml(entries))

      const add = spawnSync('corepack', [`pnpm@${version}`, 'add', '-w', tarball], { cwd: project, env, encoding: 'utf8' })
      assert.equal(add.status, 0, `pnpm ${version} add exited ${add.status}:\n${add.stdout}\n${add.stderr}`)
      const built = path.join(project, 'node_modules', '@nextsparkjs', 'core', 'built')
      assert.ok(fs.existsSync(built), `pnpm ${version} installed @nextsparkjs/core without running its postinstall`)
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
