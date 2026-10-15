import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { validatePlugin } from '../src/lib/validator.js'
import type { NextSparkPackageJson } from '../src/types/nextspark-package.js'

/** Runs validatePlugin in a project whose node_modules holds `installed` (name -> version). */
async function issuesFor(peer: Record<string, string>, installed: Record<string, string>) {
  const project = await mkdtemp(join(tmpdir(), 'ns-peer-'))
  const plugin = await mkdtemp(join(tmpdir(), 'ns-peer-plugin-'))
  const cwd = process.cwd()
  try {
    await writeFile(
      join(project, 'package.json'),
      JSON.stringify({ dependencies: Object.fromEntries(Object.keys(installed).map((n) => [n, '*'])) })
    )
    for (const [name, version] of Object.entries(installed)) {
      await mkdir(join(project, 'node_modules', name), { recursive: true })
      await writeFile(join(project, 'node_modules', name, 'package.json'), JSON.stringify({ name, version }))
    }
    await writeFile(join(plugin, 'plugin.config.ts'), '')
    process.chdir(project)
    const pkg = { name: 'p', version: '1.0.0', peerDependencies: peer, nextspark: { type: 'plugin' } }
    return validatePlugin(pkg as unknown as NextSparkPackageJson, plugin).peerDepIssues
  } finally {
    process.chdir(cwd)
    await rm(project, { recursive: true, force: true })
    await rm(plugin, { recursive: true, force: true })
  }
}

test('a satisfied peer range reports nothing', async () => {
  assert.deepEqual(await issuesFor({ react: '^19.0.0' }, { react: '19.1.0' }), [])
})

test('an out-of-range version is an error naming both versions', async () => {
  const [issue] = await issuesFor({ react: '^19.0.0' }, { react: '18.3.1' })
  assert.deepEqual(issue, { name: 'react', required: '^19.0.0', installed: '18.3.1', severity: 'error' })
})

test('a prerelease inside the range passes', async () => {
  assert.deepEqual(
    await issuesFor({ '@nextsparkjs/core': '>=0.1.0-beta.100' }, { '@nextsparkjs/core': '0.1.0-beta.199' }),
    []
  )
})

test('a range semver cannot parse is skipped, not reported', async () => {
  assert.deepEqual(await issuesFor({ react: 'workspace:^' }, { react: '19.1.0' }), [])
})

test('a missing peer stays a warning', async () => {
  const [issue] = await issuesFor({ react: '^19.0.0' }, {})
  assert.deepEqual(issue, { name: 'react', required: '^19.0.0', installed: null, severity: 'warning' })
})

test('add:plugin prints a missing peer and goes on; an incompatible one throws naming both versions', async () => {
  const { reportPeerDepIssues } = await import('../src/commands/add-plugin.js')
  const lines: string[] = []
  const log = console.log
  console.log = (...args: unknown[]) => void lines.push(args.join(' '))
  try {
    reportPeerDepIssues([{ name: 'react', required: '^19.0.0', installed: null, severity: 'warning' }])
    assert.match(lines.join('\n'), /react@\^19\.0\.0 is not installed/)
    assert.throws(
      () => reportPeerDepIssues([{ name: 'react', required: '^19.0.0', installed: '18.3.1', severity: 'error' }]),
      /react: the plugin requires \^19\.0\.0, installed 18\.3\.1/
    )
  } finally {
    console.log = log
  }
})
