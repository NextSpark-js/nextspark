import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { proxyFileNameFor, adaptProxySource, writeProxyFile } from '../src/utils/proxy-file.js'

const TEMPLATE = `export async function proxy(request: NextRequest) {\n  return NextResponse.next()\n}\n`

/** A project root with a templates dir beside it, and a pinned Next version. */
async function project(nextVersion: string | null) {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-proxy-'))
  const templates = join(root, 'templates')
  await mkdir(templates, { recursive: true })
  await writeFile(join(templates, 'proxy.ts'), TEMPLATE)

  if (nextVersion) {
    await mkdir(join(root, 'node_modules', 'next'), { recursive: true })
    await writeFile(join(root, 'node_modules', 'next', 'package.json'), JSON.stringify({ version: nextVersion }))
  }
  await writeFile(join(root, 'package.json'), '{}')

  return { root, templates, cleanup: () => rm(root, { recursive: true, force: true }) }
}

test('the file name follows the major that decides which one Next loads', () => {
  assert.equal(proxyFileNameFor(15), 'middleware.ts')
  assert.equal(proxyFileNameFor(16), 'proxy.ts')
  assert.equal(proxyFileNameFor(null), 'proxy.ts')
})

test('the exported function is renamed along with the file', () => {
  assert.match(adaptProxySource(TEMPLATE, 'middleware.ts'), /export async function middleware\(/)
  assert.match(adaptProxySource(TEMPLATE, 'proxy.ts'), /export async function proxy\(/)
})

test('a project on Next 15 gets middleware.ts', async () => {
  const { root, templates, cleanup } = await project('15.5.24')

  const result = await writeProxyFile(templates, root)

  assert.equal(result?.fileName, 'middleware.ts')
  assert.equal(result?.written, true)
  assert.match(await readFile(join(root, 'middleware.ts'), 'utf-8'), /export async function middleware\(/)
  await cleanup()
})

test('moving to Next 16 drops the file the project no longer loads', async () => {
  const { root, templates, cleanup } = await project('16.0.1')
  await writeFile(join(root, 'middleware.ts'), adaptProxySource(TEMPLATE, 'middleware.ts'))

  const result = await writeProxyFile(templates, root)

  assert.equal(result?.fileName, 'proxy.ts')
  assert.equal(existsSync(join(root, 'middleware.ts')), false)
  await cleanup()
})

// This runs unattended: core's postinstall calls `sync:app --force`.
test('a middleware the project wrote itself is left alone', async () => {
  const { root, templates, cleanup } = await project('15.5.24')
  const mine = 'export function middleware() { return new Response("mine") }\n'
  await writeFile(join(root, 'middleware.ts'), mine)

  const result = await writeProxyFile(templates, root)

  assert.equal(await readFile(join(root, 'middleware.ts'), 'utf-8'), mine)
  assert.equal(result?.written, false)
  assert.deepEqual(result?.preserved, ['middleware.ts'])
  await cleanup()
})

test('a proxy.ts the project wrote itself is not deleted on the way to Next 15', async () => {
  const { root, templates, cleanup } = await project('15.5.24')
  const mine = 'export function proxy() { return new Response("mine") }\n'
  await writeFile(join(root, 'proxy.ts'), mine)

  const result = await writeProxyFile(templates, root)

  assert.equal(existsSync(join(root, 'proxy.ts')), true)
  assert.equal(await readFile(join(root, 'proxy.ts'), 'utf-8'), mine)
  assert.deepEqual(result?.preserved, ['proxy.ts'])
  await cleanup()
})

test('nothing to copy is not an error', async () => {
  const { root, cleanup } = await project('15.5.24')

  assert.equal(await writeProxyFile(join(root, 'no-templates'), root), null)
  await cleanup()
})
