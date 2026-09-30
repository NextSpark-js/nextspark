import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { GITIGNORE_CONTENT, mergeGitignore, writeGitignore } from '../src/wizard/generators/git-init.js'

const REQUIRED = ['node_modules/', '.next/', '*.tsbuildinfo', 'next-env.d.ts', '.nextspark/', 'src/app/']
const lines = (text: string) => text.split('\n').map((line) => line.trim())

test('a flat project with no .gitignore gets the complete one', async () => {
  const project = await mkdtemp(join(tmpdir(), 'nextspark-gitignore-'))
  try {
    await writeGitignore(project)
    const written = lines(await readFile(join(project, '.gitignore'), 'utf8'))
    for (const pattern of REQUIRED) assert.ok(written.includes(pattern), `${pattern} is ignored`)
  } finally {
    await rm(project, { recursive: true, force: true })
  }
})

test('an existing .gitignore keeps its lines and gains only what it lacks', async () => {
  const project = await mkdtemp(join(tmpdir(), 'nextspark-gitignore-'))
  try {
    await writeFile(join(project, '.gitignore'), '.env\nmy-own-rule\n!.vscode/settings.json\n.nextspark/')
    await writeGitignore(project)
    const written = lines(await readFile(join(project, '.gitignore'), 'utf8'))
    assert.ok(written.includes('my-own-rule'))
    for (const pattern of REQUIRED) assert.ok(written.includes(pattern), `${pattern} is ignored`)
    // never the editor or tool folders, output or logs
    for (const pattern of ['.vscode/', '.idea/', '.claude/', 'dist/', 'out/', '*.log']) assert.ok(!written.includes(pattern), `${pattern} is not appended`)
    for (const pattern of ['.env', '.nextspark/', 'node_modules/']) assert.equal(written.filter((line) => line === pattern).length, 1, `${pattern} appears once`)
  } finally {
    await rm(project, { recursive: true, force: true })
  }
})

test('merging is idempotent and leaves a complete file alone', () => {
  const once = mergeGitignore('dist\n')
  assert.equal(mergeGitignore(once), once)
  assert.equal(mergeGitignore(GITIGNORE_CONTENT), GITIGNORE_CONTENT)
})

test('an existing CRLF .gitignore stays CRLF', () => {
  const merged = mergeGitignore('.env\r\ndist')
  assert.ok(merged.startsWith('.env\r\ndist\r\n'))
  assert.equal(merged.replace(/\r\n/g, '').includes('\n'), false, 'no bare LF was added')
  assert.ok(merged.includes('next-env.d.ts\r\n'))
})
