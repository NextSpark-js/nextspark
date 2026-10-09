/**
 * S114: the scaffold's src/proxy.ts and instrumentation.ts are facades over @nextsparkjs/core/proxy and
 * /instrumentation. The wizard's writer and migrate replace an unchanged copy of an earlier template (listed by the
 * installed core in scripts/build/registry/host/previous-templates.json) and keep anything else, with the same notices
 * as core's prepare (host/project-entries.mjs).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { adaptProxySource } from '../src/utils/proxy-file.js'
import { isPreviousTemplate, readPreviousTemplates } from '../src/utils/previous-templates.js'
import { writeProxyFile } from '../src/wizard/generators/proxy-file-writer.js'
import { isUnchangedEarlierTemplate } from '../src/wizard/generators/index.js'
import { INSTRUMENTATION_FACADE_WARNING, PROXY_FACADE_WARNING, instrumentationFacadeWarning, proxyFacadeWarning, proxyProtectedAreaWarning } from '../src/commands/migrate.js'

const CORE = join(import.meta.dirname, '../../core')
const PROXY = readFileSync(join(CORE, 'templates/proxy.ts'), 'utf8')
const INSTRUMENTATION = readFileSync(join(CORE, 'templates/instrumentation.ts'), 'utf8')
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex')
const OLD_PROXY = "export async function proxy(request: unknown) {\n  return null\n}\n"
const OLD_INSTRUMENTATION = "export async function register() {}\n"

/** A stand-in core: its templates and the previous-template list, next to a project pinned to Next 16. */
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-entries-'))
  const templates = join(root, 'core/templates')
  await mkdir(join(root, 'core/scripts/build/registry/host'), { recursive: true })
  await mkdir(templates, { recursive: true })
  await writeFile(join(templates, 'proxy.ts'), PROXY)
  await writeFile(join(templates, 'instrumentation.ts'), INSTRUMENTATION)
  await writeFile(join(root, 'core/scripts/build/registry/host/previous-templates.json'), JSON.stringify({ 'proxy.ts': [sha256(OLD_PROXY)], 'instrumentation.ts': [sha256(OLD_INSTRUMENTATION)] }))
  const project = join(root, 'project')
  await mkdir(join(project, 'node_modules/next'), { recursive: true })
  await writeFile(join(project, 'node_modules/next/package.json'), JSON.stringify({ version: '16.3.8' }))
  await writeFile(join(project, 'package.json'), '{}')
  return { templates, project, cleanup: () => rm(root, { recursive: true, force: true }) }
}

test('the facade proxy keeps its re-export when the file becomes middleware.ts for Next 15', () => {
  assert.match(adaptProxySource(PROXY, 'middleware.ts'), /^export \{ proxy as middleware \} from '@nextsparkjs\/core\/proxy'$/m)
  assert.equal(adaptProxySource(PROXY, 'proxy.ts'), PROXY)
})

test("the previous-template list is read from the installed core; the real one recognises the 0.1.0-beta.197 hashes' shape", () => {
  const real = readPreviousTemplates(join(CORE, 'templates'))
  assert.ok((real['proxy.ts'] ?? []).length > 0 && (real['instrumentation.ts'] ?? []).length > 0)
  assert.ok((real['proxy.ts'] ?? []).every(hash => /^[0-9a-f]{64}$/.test(hash)))
  assert.deepEqual(readPreviousTemplates(null), {})
  assert.deepEqual(readPreviousTemplates(join(tmpdir(), 'no-such-core', 'templates')), {})
  const previous = { 'proxy.ts': [sha256(OLD_PROXY)] }
  assert.equal(isPreviousTemplate('proxy.ts', OLD_PROXY, previous), true)
  assert.equal(isPreviousTemplate('proxy.ts', OLD_PROXY.replace(/\n/g, '\r\n'), previous), true)
  assert.equal(isPreviousTemplate('proxy.ts', OLD_PROXY.replace('function proxy(', 'function middleware('), previous), true)
  assert.equal(isPreviousTemplate('proxy.ts', `${OLD_PROXY} `, previous), false)
})

test('the same rule as core prepare decides what is an earlier template', async () => {
  const core = await import('../../core/scripts/build/registry/host/project-entries.mjs')
  const previous = { 'proxy.ts': [sha256(OLD_PROXY)], 'instrumentation.ts': [sha256(OLD_INSTRUMENTATION)] }
  for (const [kind, source] of [['proxy.ts', OLD_PROXY], ['proxy.ts', OLD_PROXY.replace('proxy(', 'middleware(')], ['proxy.ts', `${OLD_PROXY}\n`], ['instrumentation.ts', OLD_INSTRUMENTATION.replace(/\n/g, '\r\n')], ['instrumentation.ts', OLD_PROXY]] as const) {
    assert.equal(isPreviousTemplate(kind, source, previous), core.isPreviousTemplate(kind, source, previous), `${kind}: ${JSON.stringify(source)}`)
  }
})

test('the wizard writer replaces an unchanged earlier proxy and keeps an edited one', async () => {
  const { templates, project, cleanup } = await fixture()
  try {
    await mkdir(join(project, 'src'), { recursive: true })
    await writeFile(join(project, 'src/proxy.ts'), OLD_PROXY)
    assert.equal((await writeProxyFile(templates, project, 'src'))?.written, true)
    assert.equal(await readFile(join(project, 'src/proxy.ts'), 'utf8'), PROXY)

    const edited = OLD_PROXY.replace('return null', 'return undefined')
    await writeFile(join(project, 'src/proxy.ts'), edited)
    const kept = await writeProxyFile(templates, project, 'src')
    assert.equal(kept?.written, false)
    assert.deepEqual(kept?.preserved, ['src/proxy.ts'])
    assert.equal(await readFile(join(project, 'src/proxy.ts'), 'utf8'), edited)
  } finally {
    await cleanup()
  }
})

test("the wizard replaces an unchanged earlier instrumentation.ts, never the project's own", async () => {
  const { templates, project, cleanup } = await fixture()
  try {
    await writeFile(join(project, 'instrumentation.ts'), OLD_INSTRUMENTATION)
    assert.equal(await isUnchangedEarlierTemplate('instrumentation.ts', join(project, 'instrumentation.ts'), templates), true)
    await writeFile(join(project, 'instrumentation.ts'), `${OLD_INSTRUMENTATION}// mine\n`)
    assert.equal(await isUnchangedEarlierTemplate('instrumentation.ts', join(project, 'instrumentation.ts'), templates), false)
    assert.equal(await isUnchangedEarlierTemplate('eslint.config.mjs', join(project, 'instrumentation.ts'), templates), false, 'only instrumentation.ts is replaced this way')
  } finally {
    await cleanup()
  }
})

test("migrate's facade warnings carry the exact replacement and match core prepare's notices word for word", async () => {
  const core = await import('../../core/scripts/build/registry/host/project-entries.mjs')
  const previous = { 'proxy.ts': [sha256(OLD_PROXY)], 'instrumentation.ts': [sha256(OLD_INSTRUMENTATION)] }
  const root = await mkdtemp(join(tmpdir(), 'nextspark-entries-notices-'))
  try {
    for (const [proxySource, instrumentationSource] of [[OLD_PROXY, OLD_INSTRUMENTATION], [`${OLD_PROXY}// mine\n`, `${OLD_INSTRUMENTATION}// mine\n`]]) {
      await mkdir(join(root, 'src'), { recursive: true })
      await writeFile(join(root, 'src/proxy.ts'), proxySource)
      await writeFile(join(root, 'instrumentation.ts'), instrumentationSource)
      const prepare = core.projectEntryNotices(root, { previous }) as { code: string, message: string }[]
      const migrate = [
        proxyFacadeWarning('src/proxy.ts', proxySource, PROXY, previous),
        instrumentationFacadeWarning('instrumentation.ts', instrumentationSource, INSTRUMENTATION, previous),
      ]
      assert.deepEqual(migrate, prepare.map(notice => `[${notice.code}] ${notice.message}`))
      assert.ok(migrate[0]?.startsWith(`[${PROXY_FACADE_WARNING}] `))
      assert.ok(migrate[0]?.includes('cp node_modules/@nextsparkjs/core/templates/proxy.ts src/proxy.ts'))
      assert.ok(migrate.every(line => !/[\r\n]/.test(line ?? '')), 'one line each')
      assert.ok(migrate[1]?.startsWith(`[${INSTRUMENTATION_FACADE_WARNING}] `))
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a facade or a createProxy proxy needs no warning; a core without facades yet asks for none', () => {
  const custom = "import { createProxy } from '@nextsparkjs/core/proxy'\nexport const proxy = createProxy({ authenticatedPaths: ['/account'] })\n"
  for (const source of [PROXY, custom]) {
    assert.equal(proxyFacadeWarning('src/proxy.ts', source, PROXY, {}), null)
    assert.equal(proxyProtectedAreaWarning('src/proxy.ts', source), null)
  }
  assert.equal(instrumentationFacadeWarning('instrumentation.ts', INSTRUMENTATION, INSTRUMENTATION, {}), null)
  assert.equal(proxyFacadeWarning('src/proxy.ts', OLD_PROXY, null, {}), null)
})
