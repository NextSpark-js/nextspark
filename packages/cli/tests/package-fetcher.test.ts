import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, chmod, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'

import { fetchPackage } from '../src/lib/package-fetcher.js'

const posixOnly = { skip: process.platform === 'win32' && 'the fake npm is a shell script' }

/** Runs `body` with an `npm` on PATH that prints `stderr` and exits with `code`. */
async function withFakeNpm(stderr: string, code: number, body: () => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'ns-fake-npm-'))
  await mkdir(join(dir, 'bin'))
  const npm = join(dir, 'bin', 'npm')
  await writeFile(npm, `#!/bin/sh\ncat >&2 <<'OUT'\n${stderr}\nOUT\nexit ${code}\n`)
  await chmod(npm, 0o755)
  const path = process.env.PATH
  process.env.PATH = `${join(dir, 'bin')}${delimiter}${path}`
  try {
    await body()
  } finally {
    process.env.PATH = path
    await rm(dir, { recursive: true, force: true })
  }
}

async function failure(spec: string): Promise<string> {
  try {
    await fetchPackage(spec)
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
  throw new Error('fetchPackage did not fail')
}

test('a failed npm pack does not pass npm output on in the error', posixOnly, async () => {
  await withFakeNpm('npm error code E500\nnpm error 500 Internal Server Error - GET https://ci-user:TOPSECRET@registry.example/pkg', 7, async () => {
    const message = await failure('fake-package')
    assert.ok(!message.includes('TOPSECRET'), message)
    assert.ok(!message.includes('registry.example'), message)
    assert.match(message, /npm pack fake-package exited with code 7/)
  })
})

test('a package the registry does not have is reported as not found', posixOnly, async () => {
  await withFakeNpm('npm error code E404\nnpm error 404 Not Found - GET https://ci-user:TOPSECRET@registry.example/fake-package', 1, async () => {
    const message = await failure('fake-package')
    assert.equal(message, 'Package not found: fake-package. Verify the package name exists on npm.')
  })
})

test('an unreachable registry is reported as a network error', posixOnly, async () => {
  await withFakeNpm('npm error code ENOTFOUND\nnpm error request to https://ci-user:TOPSECRET@registry.example failed', 1, async () => {
    assert.equal(await failure('fake-package'), 'Network error. Check your internet connection.')
  })
})

test('an empty package spec fails closed with an actionable error', async () => {
  assert.equal(await failure(undefined as unknown as string), 'Package spec is required.')
  assert.equal(await failure('   '), 'Package spec is required.')
})
