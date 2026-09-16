/**
 * The installs `nextspark init` runs once the project is generated.
 *
 * The project install runs the real pnpm on a project whose dependencies are local directories so
 * nothing is fetched. Each project is first installed as it was, leaving a lockfile and a
 * node_modules behind, and then gets the dependency generation adds to package.json.
 *
 * The AI workflow setup runs a `pnpm` script on PATH that lands the package, setup script
 * included, and then exits with FAKE_PNPM_EXIT.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { execSync, spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { installProjectDependencies, setupAIWorkflow } from '../src/wizard/install-dependencies.js'

const pnpmAvailable = spawnSync('pnpm', ['--version'], { stdio: 'ignore' }).status === 0

/** A project installed with `first` as its only dependency, then `added` written into package.json. */
function installedProject(added: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'ns-install-'))
  for (const name of ['first', 'second']) {
    mkdirSync(join(root, 'deps', name), { recursive: true })
    writeFileSync(join(root, 'deps', name, 'package.json'), JSON.stringify({ name, version: '1.0.0' }))
  }

  const manifest = { name: 'app', version: '0.1.0', private: true, dependencies: { first: 'file:./deps/first' } }
  writeFileSync(join(root, 'package.json'), JSON.stringify(manifest))
  const { CI: _ci, ...withoutCi } = process.env
  execSync('pnpm install', { cwd: root, stdio: 'ignore', env: withoutCi })
  assert.ok(existsSync(join(root, 'pnpm-lock.yaml')) && existsSync(join(root, 'node_modules', 'first')))

  manifest.dependencies = { ...manifest.dependencies, ...added }
  writeFileSync(join(root, 'package.json'), JSON.stringify(manifest))
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) }
}

/** Runs `fn` with CI set, as a CI job runs create-nextspark-app. */
function inCi(fn: () => void): void {
  const previous = process.env.CI
  process.env.CI = '1'
  try {
    fn()
  } finally {
    if (previous === undefined) delete process.env.CI
    else process.env.CI = previous
  }
}

test('with CI set, the install takes in what generation added to package.json', { skip: !pnpmAvailable }, () => {
  const { root, cleanup } = installedProject({ second: 'file:./deps/second' })
  try {
    inCi(() => installProjectDependencies(root))

    assert.ok(existsSync(join(root, 'node_modules', 'second')), 'expected the dependency generation added to be installed')
    assert.match(readFileSync(join(root, 'pnpm-lock.yaml'), 'utf8'), /second/)
  } finally {
    cleanup()
  }
})

test('an install pnpm fails is reported as failed, though node_modules is already there', { skip: !pnpmAvailable }, () => {
  const { root, cleanup } = installedProject({ second: 'file:./deps/missing' })
  try {
    assert.ok(existsSync(join(root, 'node_modules')))
    assert.throws(() => installProjectDependencies(root), /pnpm install exited with code [1-9]/)
  } finally {
    cleanup()
  }
})

const FAKE_PNPM = `#!/bin/sh
dir=node_modules/@nextsparkjs/ai-workflow/scripts
mkdir -p "$dir"
echo "import { writeFileSync } from 'node:fs'; writeFileSync('setup-ran', process.argv[2])" > "$dir/setup.mjs"
exit "\${FAKE_PNPM_EXIT:-0}"
`

/** Runs setupAIWorkflow in a new project with the fake pnpm first on PATH, exiting `exitCode`. */
function setUpWithPnpmExiting(exitCode: number) {
  const root = mkdtempSync(join(tmpdir(), 'ns-ai-workflow-'))
  const bin = join(root, 'bin')
  const projectRoot = join(root, 'project')
  mkdirSync(bin)
  mkdirSync(projectRoot)
  writeFileSync(join(bin, 'pnpm'), FAKE_PNPM, { mode: 0o755 })

  const previousPath = process.env.PATH
  process.env.PATH = `${bin}:${previousPath}`
  process.env.FAKE_PNPM_EXIT = String(exitCode)
  try {
    const result = setupAIWorkflow({ projectRoot, choice: 'claude', isMonorepo: false, version: '0.0.0' })
    const marker = join(projectRoot, 'setup-ran')
    return { result, setupRan: existsSync(marker), setupFor: existsSync(marker) ? readFileSync(marker, 'utf8') : null }
  } finally {
    process.env.PATH = previousPath
    delete process.env.FAKE_PNPM_EXIT
    rmSync(root, { recursive: true, force: true })
  }
}

test('an AI workflow install pnpm fails is skipped, its setup script not run, though the package landed', { skip: process.platform === 'win32' }, () => {
  const { result, setupRan } = setUpWithPnpmExiting(7)

  assert.equal(result, 'skip')
  assert.equal(setupRan, false, 'the setup script ran after pnpm add exited 7')
})

test('an AI workflow install pnpm finishes runs the setup script for the assistant picked', { skip: process.platform === 'win32' }, () => {
  const { result, setupFor } = setUpWithPnpmExiting(0)

  assert.equal(result, 'claude')
  assert.equal(setupFor, 'claude', 'expected the setup script to run for the assistant picked')
})
