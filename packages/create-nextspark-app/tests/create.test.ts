/**
 * create-nextspark-app writes the build-script allowlist before its first install, in whichever
 * form the pnpm installing the project reads. That pnpm is picked per directory: Corepack takes
 * the version from the nearest `packageManager` field above where it runs, so the directory
 * create-nextspark-app starts from can resolve another pnpm than the new project does.
 *
 * `pnpm` and `npx` are replaced by scripts on PATH: `pnpm --version` answers the way Corepack
 * resolves it, and `pnpm add` leaves core "installed".
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createProject } from '../src/create.js'

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
  add) mkdir -p node_modules/@nextsparkjs/core ;;
esac
`

interface Scenario {
  /** The pnpm the directory create-nextspark-app starts from pins with `packageManager`. */
  callerPnpm: string
  /** The pnpm every other directory resolves, the new project's included. */
  projectPnpm: string
}

interface Created {
  project: string
  packageJson: { pnpm?: { onlyBuiltDependencies?: string[] } }
  /** The keys of `allowBuilds`, or null when there is no pnpm-workspace.yaml. */
  allowBuilds: string[] | null
}

async function create({ callerPnpm, projectPnpm }: Scenario): Promise<Created> {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'create-nextspark-app-')))
  const bin = path.join(root, 'bin')
  const caller = path.join(root, 'caller')
  const project = path.join(root, 'projects', 'my-app')

  fs.mkdirSync(bin)
  fs.writeFileSync(path.join(bin, 'pnpm'), FAKE_PNPM, { mode: 0o755 })
  fs.writeFileSync(path.join(bin, 'npx'), '#!/bin/sh\nexit 0\n', { mode: 0o755 })
  fs.mkdirSync(path.join(caller, '.packages'), { recursive: true })
  fs.writeFileSync(path.join(caller, 'package.json'), JSON.stringify({ name: 'caller', packageManager: `pnpm@${callerPnpm}` }))
  for (const tarball of TARBALLS) fs.writeFileSync(path.join(caller, '.packages', tarball), '')

  const previousCwd = process.cwd()
  const previousPath = process.env.PATH
  process.chdir(caller)
  process.env.PATH = `${bin}${path.delimiter}${previousPath}`
  process.env.FAKE_PNPM_DEFAULT_VERSION = projectPnpm
  try {
    await createProject({ projectName: 'my-app', projectPath: project })
  } finally {
    process.chdir(previousCwd)
    process.env.PATH = previousPath
    delete process.env.FAKE_PNPM_DEFAULT_VERSION
  }

  const workspaceYaml = path.join(project, 'pnpm-workspace.yaml')
  const created: Created = {
    project,
    packageJson: JSON.parse(fs.readFileSync(path.join(project, 'package.json'), 'utf8')),
    allowBuilds: fs.existsSync(workspaceYaml)
      ? [...fs.readFileSync(workspaceYaml, 'utf8').matchAll(/^ {2}'([^']+)': true$/gm)].map(match => match[1])
      : null,
  }
  fs.rmSync(root, { recursive: true, force: true })
  return created
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

test('the allowlist is allowBuilds when the project installs with pnpm 11, whatever the caller runs', async () => {
  const { packageJson, allowBuilds } = await create({ callerPnpm: '9.0.0', projectPnpm: '11.17.0' })

  assert.equal(packageJson.pnpm, undefined, 'pnpm 11 ignores the pnpm field and warns about it on every command')
  assert.ok(allowBuilds, 'expected a pnpm-workspace.yaml carrying allowBuilds')
  assert.ok(allowBuilds.includes('@nextsparkjs/core'))
  assert.ok(allowBuilds.includes(coreTarballSpec), `expected ${coreTarballSpec} in ${allowBuilds.join(', ')}`)
})

test('the allowlist is pnpm.onlyBuiltDependencies when the project installs with pnpm 10, whatever the caller runs', async () => {
  const { packageJson, allowBuilds } = await create({ callerPnpm: '11.17.0', projectPnpm: '10.34.5' })

  assert.equal(allowBuilds, null, 'expected no pnpm-workspace.yaml')
  const listed = packageJson.pnpm?.onlyBuiltDependencies ?? []
  assert.ok(listed.includes('@nextsparkjs/core'))
  assert.ok(listed.includes(coreTarballSpec), `expected ${coreTarballSpec} in ${listed.join(', ')}`)
})

test('pnpm 9 gets pnpm.onlyBuiltDependencies, never a pnpm-workspace.yaml without packages', async () => {
  const { packageJson, allowBuilds } = await create({ callerPnpm: '11.17.0', projectPnpm: '9.0.0' })

  assert.equal(allowBuilds, null, 'pnpm 9 rejects a pnpm-workspace.yaml without packages')
  assert.ok(packageJson.pnpm?.onlyBuiltDependencies?.includes('@nextsparkjs/core'))
})

test('the allowlist names every package with an install script that this repository installs', async () => {
  const { allowBuilds } = await create({ callerPnpm: '11.17.0', projectPnpm: '11.17.0' })
  assert.ok(allowBuilds, 'expected a pnpm-workspace.yaml carrying allowBuilds')

  const required = packagesWithInstallScripts()
  assert.ok(required.includes('esbuild'), `the scan found no esbuild; is the repository installed? Found: ${required.join(', ')}`)
  const missing = required.filter(name => !allowBuilds.includes(name))
  assert.deepEqual(missing, [], `pnpm 11 fails the install over each of these: ${missing.join(', ')}`)
})
