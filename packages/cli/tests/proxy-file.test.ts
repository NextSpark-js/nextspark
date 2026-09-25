import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { proxyFileNameFor, adaptProxySource } from '../src/utils/proxy-file.js'
import { withGeneratedTag } from '../src/utils/generated-tag.js'
import { writeProxyFile } from '../src/wizard/generators/proxy-file-writer.js'

const TEMPLATE = `/**\n * @nextspark-generated\n */\nexport async function proxy(request: NextRequest) {\n  return NextResponse.next()\n}\n`

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
  assert.equal(result?.path, 'middleware.ts')
  assert.equal(result?.written, true)
  assert.match(await readFile(join(root, 'middleware.ts'), 'utf-8'), /export async function middleware\(/)
  await cleanup()
})

test('a src-directory project gets the proxy beside its app directory', async () => {
  const { root, templates, cleanup } = await project('16.0.1')
  await mkdir(join(root, 'src', 'app'), { recursive: true })

  const result = await writeProxyFile(templates, root)

  assert.equal(result?.fileName, 'proxy.ts')
  assert.equal(result?.path, 'src/proxy.ts')
  assert.equal(result?.written, true)
  assert.equal(existsSync(join(root, 'proxy.ts')), false)
  assert.match(await readFile(join(root, 'src', 'proxy.ts'), 'utf-8'), /export async function proxy\(/)
  await cleanup()
})

test('moving to a src-directory project removes the generated root proxy', async () => {
  const { root, templates, cleanup } = await project('16.0.1')
  await writeFile(join(root, 'proxy.ts'), TEMPLATE)
  await mkdir(join(root, 'src', 'app'), { recursive: true })

  const result = await writeProxyFile(templates, root)

  assert.equal(result?.path, 'src/proxy.ts')
  assert.equal(existsSync(join(root, 'proxy.ts')), false)
  assert.equal(existsSync(join(root, 'src', 'proxy.ts')), true)
  await cleanup()
})

test('moving to a src-directory project removes a current intact tagged root proxy', async () => {
  const { root, templates, cleanup } = await project('16.0.1')
  await writeFile(join(root, 'proxy.ts'), withGeneratedTag('proxy.ts', Buffer.from(TEMPLATE), '0.1.0').toString())
  await mkdir(join(root, 'src', 'app'), { recursive: true })

  const result = await writeProxyFile(templates, root)

  assert.equal(result?.path, 'src/proxy.ts')
  assert.equal(existsSync(join(root, 'proxy.ts')), false)
  assert.deepEqual(result?.preserved, [])
  await cleanup()
})

test('a copied generated proxy at the wrong convention level is preserved', async () => {
  const { root, templates, cleanup } = await project('16.0.1')
  const copied = withGeneratedTag('src/proxy.ts', Buffer.from(TEMPLATE), '0.1.0').toString()
  await writeFile(join(root, 'proxy.ts'), copied)
  await mkdir(join(root, 'src', 'app'), { recursive: true })

  const result = await writeProxyFile(templates, root)

  assert.equal(await readFile(join(root, 'proxy.ts'), 'utf-8'), copied)
  assert.deepEqual(result?.preserved, ['proxy.ts'])
  await cleanup()
})

test('a customized tagged proxy at the wrong convention level is preserved', async () => {
  const { root, templates, cleanup } = await project('16.0.1')
  const customized = `${withGeneratedTag('proxy.ts', Buffer.from(TEMPLATE), '0.1.0').toString()}// customized\n`
  await writeFile(join(root, 'proxy.ts'), customized)
  await mkdir(join(root, 'src', 'app'), { recursive: true })

  const result = await writeProxyFile(templates, root)

  assert.equal(await readFile(join(root, 'proxy.ts'), 'utf-8'), customized)
  assert.deepEqual(result?.preserved, ['proxy.ts'])
  await cleanup()
})

test('a project-owned proxy at the wrong convention level is preserved and reported by path', async () => {
  const { root, templates, cleanup } = await project('16.0.1')
  const mine = 'export function proxy() { return new Response("mine") }\n'
  await writeFile(join(root, 'proxy.ts'), mine)
  await mkdir(join(root, 'src', 'app'), { recursive: true })

  const result = await writeProxyFile(templates, root)

  assert.equal(await readFile(join(root, 'proxy.ts'), 'utf-8'), mine)
  assert.deepEqual(result?.preserved, ['proxy.ts'])
  assert.equal(existsSync(join(root, 'src', 'proxy.ts')), true)
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

// A release has to be able to ship changes to this file. Recognising only the
// current template would freeze whatever an earlier release generated.
test('a file an earlier release generated is still ours to replace', async () => {
  const { root, templates, cleanup } = await project('15.5.24')
  await writeFile(join(root, 'middleware.ts'), '/**\n * @nextspark-generated\n */\nexport function middleware() { /* from an older release */ }\n')

  const result = await writeProxyFile(templates, root)

  assert.equal(result?.written, true)
  assert.match(await readFile(join(root, 'middleware.ts'), 'utf-8'), /export async function middleware\(/)
  await cleanup()
})

test('deleting the tag is how a project takes the file over', async () => {
  const { root, templates, cleanup } = await project('15.5.24')
  const mine = 'export function middleware() { return new Response("mine") }\n'
  await writeFile(join(root, 'middleware.ts'), mine)

  const result = await writeProxyFile(templates, root)

  assert.equal(await readFile(join(root, 'middleware.ts'), 'utf-8'), mine)
  assert.equal(result?.written, false)
  await cleanup()
})
